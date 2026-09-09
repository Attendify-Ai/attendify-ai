from datetime import datetime, time as dt_time, date as dt_date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from database import get_db
import models
from services.point_service import calculate_points_deducted, deduct_points_for_late_entry

router = APIRouter(prefix="/recognition", tags=["Recognition"])

SCHOOL_START = dt_time(8, 30)


class ProcessFramePayload(BaseModel):
    student_name: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    arrival_time: datetime
    date: dt_date
    test_mode: bool = False  # testing only: skips the holiday/time-of-day gates below


@router.post("/process-frame")
def process_frame(payload: ProcessFramePayload, db: Session = Depends(get_db)):
    """Called by face-recognition/recognize_face.py after a face is matched."""
    if payload.test_mode:
        arrival_dt = datetime.now()
        arrival = arrival_dt.time()
        entry_date = arrival_dt.date()
    else:
        holiday = db.query(models.SchoolCalendar).filter(
            models.SchoolCalendar.date == payload.date,
            models.SchoolCalendar.is_active == True,
        ).first()
        if holiday:
            return {"status": "holiday", "message": f"Holiday — {holiday.label}"}

        arrival = payload.arrival_time.time()
        entry_date = payload.date

    minutes_late = (arrival.hour * 60 + arrival.minute) - (SCHOOL_START.hour * 60 + SCHOOL_START.minute)
    if not payload.test_mode and minutes_late <= 0:
        return {"status": "not_late", "message": "Not late", "minutes_late": minutes_late}

    student = db.query(models.Student).filter(
        func.lower(models.Student.name) == payload.student_name.strip().lower()
    ).first()
    if not student:
        return {"status": "student_not_found", "message": f"No student named '{payload.student_name}' found"}

    existing = db.query(models.LateEntry).filter(
        models.LateEntry.student_id == student.id,
        models.LateEntry.date == entry_date,
    ).first()
    if existing:
        return {"status": "duplicate", "message": "Already logged today", "student_name": student.name}

    if payload.confidence_score > 0.6:
        status = "auto_confirmed"
    elif payload.confidence_score >= 0.4:
        status = "needs_review"
    else:
        status = "unknown"

    points = calculate_points_deducted(minutes_late) if status == "auto_confirmed" else 0

    entry = models.LateEntry(
        student_id=student.id,
        house_id=student.house_id,
        date=entry_date,
        arrival_time=arrival,
        minutes_late=minutes_late,
        points_deducted=points,
        confidence_score=payload.confidence_score,
        status=status,
    )
    db.add(entry)
    db.flush()

    if status == "auto_confirmed":
        deduct_points_for_late_entry(db, entry)

    db.commit()
    db.refresh(entry)

    return {
        "status": status,
        "message": "Logged",
        "student_name": student.name,
        "minutes_late": minutes_late,
        "points_deducted": points,
        "entry_id": entry.id,
    }
