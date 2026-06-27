import os
import uuid
import base64
from datetime import datetime, time as dt_time, date as dt_date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models
from services.auth_service import get_current_user
from services.point_service import calculate_points_deducted, deduct_points_for_late_entry, restore_points_for_late_entry

router = APIRouter(prefix="/late-entries", tags=["Late Entries"])

SCHOOL_START = dt_time(8, 30)
CAPTURED_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "captures")
os.makedirs(CAPTURED_DIR, exist_ok=True)


def entry_to_dict(entry, student=None, house=None, reviewer=None):
    return {
        "id": entry.id,
        "student_id": entry.student_id,
        "student_name": student.name if student else None,
        "student_code": student.student_code if student else None,
        "student_class": student.class_ if student else None,
        "house_id": entry.house_id,
        "house_name": house.name if house else None,
        "date": entry.date,
        "arrival_time": entry.arrival_time,
        "minutes_late": entry.minutes_late,
        "points_deducted": entry.points_deducted,
        "confidence_score": entry.confidence_score,
        "status": entry.status,
        "reviewed_by": entry.reviewed_by,
        "reviewer_name": reviewer.name if reviewer else None,
        "reviewed_at": entry.reviewed_at,
        "captured_image": entry.captured_image,
        "created_at": entry.created_at,
    }


def _fetch_entry_with_relations(db: Session, entry_id: int):
    entry = db.query(models.LateEntry).filter(models.LateEntry.id == entry_id).first()
    if not entry:
        return None, None, None, None
    student = db.query(models.Student).filter(models.Student.id == entry.student_id).first() if entry.student_id else None
    house = db.query(models.House).filter(models.House.id == entry.house_id).first() if entry.house_id else None
    reviewer = db.query(models.User).filter(models.User.id == entry.reviewed_by).first() if entry.reviewed_by else None
    return entry, student, house, reviewer


@router.get("/")
def list_late_entries(
    date_from: Optional[dt_date] = None,
    date_to: Optional[dt_date] = None,
    house_id: Optional[int] = None,
    status: Optional[str] = None,
    student_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.LateEntry)
    if date_from:
        query = query.filter(models.LateEntry.date >= date_from)
    if date_to:
        query = query.filter(models.LateEntry.date <= date_to)
    if house_id:
        query = query.filter(models.LateEntry.house_id == house_id)
    if status:
        query = query.filter(models.LateEntry.status == status)
    if student_id:
        query = query.filter(models.LateEntry.student_id == student_id)

    total = query.count()
    entries = query.order_by(models.LateEntry.date.desc(), models.LateEntry.arrival_time.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for entry in entries:
        student = db.query(models.Student).filter(models.Student.id == entry.student_id).first() if entry.student_id else None
        house = db.query(models.House).filter(models.House.id == entry.house_id).first() if entry.house_id else None
        reviewer = db.query(models.User).filter(models.User.id == entry.reviewed_by).first() if entry.reviewed_by else None
        result.append(entry_to_dict(entry, student, house, reviewer))

    return {"total": total, "page": page, "page_size": page_size, "items": result}


@router.get("/review-queue")
def review_queue(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entries = (
        db.query(models.LateEntry)
        .filter(models.LateEntry.status == "needs_review")
        .order_by(models.LateEntry.date.desc())
        .all()
    )
    result = []
    for entry in entries:
        student = db.query(models.Student).filter(models.Student.id == entry.student_id).first() if entry.student_id else None
        house = db.query(models.House).filter(models.House.id == entry.house_id).first() if entry.house_id else None
        result.append(entry_to_dict(entry, student, house, None))
    return result


class ManualLateEntry(BaseModel):
    student_id: int
    date: dt_date
    arrival_time: str  # "HH:MM"
    notes: Optional[str] = None


@router.post("/")
def create_manual_entry(
    payload: ManualLateEntry,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    arrival = dt_time.fromisoformat(payload.arrival_time)
    start = SCHOOL_START
    minutes_late = (arrival.hour * 60 + arrival.minute) - (start.hour * 60 + start.minute)
    if minutes_late <= 0:
        raise HTTPException(status_code=400, detail="Arrival time is before school start — not a late entry")

    # Duplicate guard
    existing = db.query(models.LateEntry).filter(
        and_(models.LateEntry.student_id == payload.student_id, models.LateEntry.date == payload.date)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Late entry already exists for this student on this date")

    points = calculate_points_deducted(minutes_late)
    entry = models.LateEntry(
        student_id=student.id,
        house_id=student.house_id,
        date=payload.date,
        arrival_time=arrival,
        minutes_late=minutes_late,
        points_deducted=points,
        confidence_score=1.0,
        status="auto_confirmed",
        reviewed_by=current_user.id,
        reviewed_at=datetime.utcnow(),
    )
    db.add(entry)
    db.flush()
    deduct_points_for_late_entry(db, entry)
    db.refresh(entry)

    house = db.query(models.House).filter(models.House.id == entry.house_id).first()
    return entry_to_dict(entry, student, house, current_user)


class UpdateLateEntry(BaseModel):
    student_id: Optional[int] = None
    house_id: Optional[int] = None
    arrival_time: Optional[str] = None
    status: Optional[str] = None


@router.put("/{entry_id}")
def update_late_entry(
    entry_id: int,
    payload: UpdateLateEntry,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = db.query(models.LateEntry).filter(models.LateEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Late entry not found")

    old_status = entry.status
    old_points = entry.points_deducted
    old_house_id = entry.house_id

    if payload.student_id is not None:
        student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        entry.student_id = payload.student_id
        # Update house to match student's house
        entry.house_id = student.house_id

    if payload.house_id is not None:
        entry.house_id = payload.house_id

    if payload.arrival_time is not None:
        arrival = dt_time.fromisoformat(payload.arrival_time)
        start = SCHOOL_START
        minutes_late = (arrival.hour * 60 + arrival.minute) - (start.hour * 60 + start.minute)
        entry.arrival_time = arrival
        entry.minutes_late = max(1, minutes_late)
        new_points = calculate_points_deducted(entry.minutes_late)

        # Adjust house points for the difference
        if new_points != old_points:
            house = db.query(models.House).filter(models.House.id == entry.house_id).first()
            if house:
                house.current_points += old_points - new_points
            entry.points_deducted = new_points

    if payload.status is not None:
        valid_statuses = {"auto_confirmed", "needs_review", "manually_verified", "unknown"}
        if payload.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

        # If changing to unknown, restore points (student unidentified)
        if payload.status == "unknown" and old_status != "unknown":
            house = db.query(models.House).filter(models.House.id == entry.house_id).first()
            if house:
                house.current_points += entry.points_deducted
            entry.points_deducted = 0

        # If changing from unknown back to a confirmed status, deduct points again
        if old_status == "unknown" and payload.status != "unknown":
            points = calculate_points_deducted(entry.minutes_late)
            entry.points_deducted = points
            house = db.query(models.House).filter(models.House.id == entry.house_id).first()
            if house:
                house.current_points -= points

        entry.status = payload.status

    entry.reviewed_by = current_user.id
    entry.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(entry)

    student = db.query(models.Student).filter(models.Student.id == entry.student_id).first() if entry.student_id else None
    house = db.query(models.House).filter(models.House.id == entry.house_id).first() if entry.house_id else None
    return entry_to_dict(entry, student, house, current_user)


class RecognitionPayload(BaseModel):
    student_id: Optional[int] = None
    house_id: Optional[int] = None
    arrival_time: str  # "HH:MM:SS"
    date: dt_date
    confidence_score: float
    captured_image_b64: Optional[str] = None  # base64-encoded JPEG


@router.post("/from-recognition")
def create_from_recognition(
    payload: RecognitionPayload,
    db: Session = Depends(get_db),
):
    """Called by the camera service when it detects a late student."""
    # Calendar check — skip on non-school days
    calendar_entry = db.query(models.SchoolCalendar).filter(
        models.SchoolCalendar.date == payload.date,
        models.SchoolCalendar.is_active == True,
    ).first()
    if calendar_entry:
        return {"message": f"Skipped — {calendar_entry.label}"}

    arrival = dt_time.fromisoformat(payload.arrival_time[:5])
    start = SCHOOL_START
    minutes_late = (arrival.hour * 60 + arrival.minute) - (start.hour * 60 + start.minute)
    if minutes_late <= 0:
        return {"message": "Not late"}

    if payload.student_id:
        # Duplicate guard
        existing = db.query(models.LateEntry).filter(
            and_(
                models.LateEntry.student_id == payload.student_id,
                models.LateEntry.date == payload.date,
            )
        ).first()
        if existing:
            return {"message": "Already logged today"}

    status = "auto_confirmed" if payload.confidence_score >= 0.6 else "needs_review"
    points = calculate_points_deducted(minutes_late) if payload.student_id else 0

    # Save captured image
    image_path = None
    if payload.captured_image_b64:
        fname = f"{uuid.uuid4().hex}.jpg"
        image_path = os.path.join(CAPTURED_DIR, fname)
        with open(image_path, "wb") as f:
            f.write(base64.b64decode(payload.captured_image_b64))

    entry = models.LateEntry(
        student_id=payload.student_id,
        house_id=payload.house_id,
        date=payload.date,
        arrival_time=arrival,
        minutes_late=minutes_late,
        points_deducted=points,
        confidence_score=payload.confidence_score,
        status=status,
        captured_image=image_path,
    )
    db.add(entry)
    db.flush()

    if payload.student_id and status == "auto_confirmed":
        deduct_points_for_late_entry(db, entry)

    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "status": entry.status, "minutes_late": minutes_late}
