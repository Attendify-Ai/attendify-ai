from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date as dt_date
from database import get_db
import models
from services.auth_service import get_current_user, require_admin

router = APIRouter(prefix="/calendar", tags=["Calendar"])


class CalendarEntry(BaseModel):
    date: dt_date
    label: str


@router.get("/")
def list_calendar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entries = db.query(models.SchoolCalendar).order_by(models.SchoolCalendar.date).all()
    return [
        {
            "id": e.id,
            "date": e.date,
            "label": e.label,
            "is_active": e.is_active,
            "created_at": e.created_at,
        }
        for e in entries
    ]


@router.post("/")
def create_calendar_entry(
    payload: CalendarEntry,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    existing = db.query(models.SchoolCalendar).filter(models.SchoolCalendar.date == payload.date).first()
    if existing:
        raise HTTPException(status_code=400, detail="Entry for this date already exists")

    entry = models.SchoolCalendar(date=payload.date, label=payload.label, is_active=True)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "date": entry.date, "label": entry.label, "is_active": entry.is_active}


@router.delete("/{entry_id}")
def delete_calendar_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    entry = db.query(models.SchoolCalendar).filter(models.SchoolCalendar.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Calendar entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Deleted"}
