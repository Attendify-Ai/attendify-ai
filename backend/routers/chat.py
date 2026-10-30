from datetime import date as dt_date, timedelta
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from database import get_db
from services.auth_service import get_current_user

router = APIRouter(tags=["Chat"])

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2"

# Keyword groups used to decide which slices of the database are worth
# pulling into the prompt -- keeps the context small and relevant instead of
# dumping the whole database on every question.
KEYWORD_GROUPS = {
    "houses": ["house", "point", "rank", "bhagiratha", "karna", "arjuna", "ekalavya"],
    "late_entries": ["late", "entry", "entries", "arrived", "today", "class", "week", "section"],
    "review_queue": ["review", "pending", "unverified", "unconfirmed", "queue"],
    "students": ["student", "frequent", "offender", "repeat", "who"],
}

SYSTEM_PROMPT = (
    "You are the Attendify AI Assistant, embedded in a school's attendance and house-points "
    "admin dashboard. Answer the user's question using ONLY the data provided below. Be "
    "concise and specific, citing real numbers and names from the data. If the data doesn't "
    "contain the answer, say so plainly instead of guessing or inventing details."
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None


def _matches(question: str, keywords: List[str]) -> bool:
    return any(kw in question for kw in keywords)


def _build_context(db: Session, question: str) -> str:
    q = question.lower()
    today = dt_date.today()
    sections = [f"Today's date: {today.isoformat()}"]

    houses = db.query(models.House).order_by(models.House.current_points.desc()).all()
    sections.append(
        "House standings (ranked by points, highest first):\n"
        + "\n".join(f"{i + 1}. {h.name}: {h.current_points} pts" for i, h in enumerate(houses))
    )

    today_count = (
        db.query(func.count(models.LateEntry.id))
        .filter(models.LateEntry.date == today, models.LateEntry.status != "unknown")
        .scalar()
    )
    review_count = (
        db.query(func.count(models.LateEntry.id))
        .filter(models.LateEntry.status == "needs_review")
        .scalar()
    )
    total_students = db.query(func.count(models.Student.id)).scalar()
    sections.append(
        f"Quick stats: {today_count} students late today, {review_count} entries awaiting "
        f"review, {total_students} total students enrolled."
    )

    if _matches(q, KEYWORD_GROUPS["late_entries"]) or _matches(q, KEYWORD_GROUPS["students"]):
        week_start = today - timedelta(days=today.weekday())
        rows = (
            db.query(
                models.LateEntry,
                models.Student.name.label("student_name"),
                models.Student.class_.label("student_class"),
                models.House.name.label("house_name"),
            )
            .join(models.Student, models.LateEntry.student_id == models.Student.id, isouter=True)
            .join(models.House, models.LateEntry.house_id == models.House.id, isouter=True)
            .filter(models.LateEntry.date >= week_start, models.LateEntry.status != "unknown")
            .order_by(models.LateEntry.date.desc())
            .limit(150)
            .all()
        )
        lines = [
            f"- {student_name or 'Unknown'} ({student_class or '?'}, {house_name or '?'}): "
            f"{entry.minutes_late}m late on {entry.date}, -{entry.points_deducted} pts, status={entry.status}"
            for entry, student_name, student_class, house_name in rows
        ]
        sections.append(
            "Late entries this week (most recent 150):\n" + ("\n".join(lines) if lines else "None")
        )

    if _matches(q, KEYWORD_GROUPS["students"]):
        offenders = (
            db.query(
                models.Student.name,
                models.Student.class_,
                models.House.name.label("house_name"),
                func.count(models.LateEntry.id).label("late_count"),
            )
            .join(models.LateEntry, models.Student.id == models.LateEntry.student_id)
            .join(models.House, models.Student.house_id == models.House.id, isouter=True)
            .filter(models.LateEntry.status != "unknown")
            .group_by(models.Student.id, models.Student.name, models.Student.class_, models.House.name)
            .order_by(func.count(models.LateEntry.id).desc())
            .limit(10)
            .all()
        )
        lines = [
            f"- {name} ({cls}, {house_name or '?'}): late {late_count} times"
            for name, cls, house_name, late_count in offenders
        ]
        sections.append(
            "Most frequent late students (top 10 all-time):\n" + ("\n".join(lines) if lines else "None")
        )

    if _matches(q, KEYWORD_GROUPS["review_queue"]):
        queue = (
            db.query(models.LateEntry, models.Student.name.label("student_name"))
            .join(models.Student, models.LateEntry.student_id == models.Student.id, isouter=True)
            .filter(models.LateEntry.status == "needs_review")
            .order_by(models.LateEntry.date.desc())
            .limit(50)
            .all()
        )
        lines = [
            f"- Entry #{entry.id}: {student_name or 'Unidentified'} on {entry.date}, "
            f"confidence={entry.confidence_score}"
            for entry, student_name in queue
        ]
        sections.append(
            "Review queue (entries needing manual review):\n"
            + ("\n".join(lines) if lines else "None — queue is empty")
        )

    return "\n\n".join(sections)


@router.post("/chat")
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    context = _build_context(db, payload.message)
    user_label = f"{current_user.name} ({current_user.role})"

    history_block = ""
    if payload.history:
        turns = "\n".join(f"{t.role}: {t.content}" for t in payload.history[-6:])
        history_block = f"Conversation so far:\n{turns}\n\n"

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Logged in as: {user_label}\n\n"
        f"--- ATTENDIFY DATA ---\n{context}\n--- END DATA ---\n\n"
        f"{history_block}"
        f"Question: {payload.message}\n\nAnswer:"
    )

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                OLLAMA_URL,
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Ollama isn't reachable at localhost:11434. Make sure it's running (`ollama serve`).",
        )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Ollama request failed: {e}")

    data = resp.json()
    answer = (data.get("response") or "").strip() or "I couldn't generate a response."
    return {"response": answer}
