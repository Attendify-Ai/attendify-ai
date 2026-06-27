from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional
from datetime import date as dt_date, timedelta
import io
from database import get_db
import models
from services.auth_service import get_current_user
from services.export_service import export_late_entries_csv

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/late-trend")
def late_trend(
    period: str = "daily",  # daily | weekly | monthly
    date_from: Optional[dt_date] = None,
    date_to: Optional[dt_date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not date_from:
        date_from = dt_date.today() - timedelta(days=30)
    if not date_to:
        date_to = dt_date.today()

    if period == "daily":
        rows = (
            db.query(models.LateEntry.date, func.count(models.LateEntry.id).label("count"))
            .filter(models.LateEntry.date.between(date_from, date_to))
            .filter(models.LateEntry.status != "unknown")
            .group_by(models.LateEntry.date)
            .order_by(models.LateEntry.date)
            .all()
        )
        return [{"date": str(r.date), "count": r.count} for r in rows]

    elif period == "weekly":
        rows = (
            db.query(
                func.date_trunc("week", models.LateEntry.date).label("week"),
                func.count(models.LateEntry.id).label("count"),
            )
            .filter(models.LateEntry.date.between(date_from, date_to))
            .filter(models.LateEntry.status != "unknown")
            .group_by("week")
            .order_by("week")
            .all()
        )
        return [{"week": str(r.week.date()) if r.week else None, "count": r.count} for r in rows]

    elif period == "monthly":
        rows = (
            db.query(
                func.date_trunc("month", models.LateEntry.date).label("month"),
                func.count(models.LateEntry.id).label("count"),
            )
            .filter(models.LateEntry.date.between(date_from, date_to))
            .filter(models.LateEntry.status != "unknown")
            .group_by("month")
            .order_by("month")
            .all()
        )
        return [{"month": str(r.month.date()) if r.month else None, "count": r.count} for r in rows]

    return []


@router.get("/house-performance")
def house_performance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    houses = db.query(models.House).order_by(models.House.current_points.desc()).all()
    result = []
    for i, house in enumerate(houses):
        late_count = (
            db.query(func.count(models.LateEntry.id))
            .filter(
                models.LateEntry.house_id == house.id,
                models.LateEntry.status != "unknown",
            )
            .scalar()
        )
        total_deducted = (
            db.query(func.sum(models.LateEntry.points_deducted))
            .filter(models.LateEntry.house_id == house.id)
            .scalar()
            or 0
        )
        result.append({
            "id": house.id,
            "name": house.name,
            "current_points": house.current_points,
            "rank": i + 1,
            "total_late_entries": late_count,
            "total_points_deducted": total_deducted,
        })
    return result


@router.get("/frequent-offenders")
def frequent_offenders(
    limit: int = 10,
    date_from: Optional[dt_date] = None,
    date_to: Optional[dt_date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = (
        db.query(
            models.Student.id,
            models.Student.name,
            models.Student.student_code,
            models.Student.class_,
            models.House.name.label("house_name"),
            func.count(models.LateEntry.id).label("late_count"),
            func.sum(models.LateEntry.points_deducted).label("total_points_deducted"),
        )
        .join(models.LateEntry, models.Student.id == models.LateEntry.student_id)
        .join(models.House, models.Student.house_id == models.House.id, isouter=True)
        .filter(models.LateEntry.status != "unknown")
    )

    if date_from:
        query = query.filter(models.LateEntry.date >= date_from)
    if date_to:
        query = query.filter(models.LateEntry.date <= date_to)

    rows = query.group_by(
        models.Student.id,
        models.Student.name,
        models.Student.student_code,
        models.Student.class_,
        models.House.name,
    ).order_by(func.count(models.LateEntry.id).desc()).limit(limit).all()

    return [
        {
            "student_id": r.id,
            "name": r.name,
            "student_code": r.student_code,
            "class": r.class_,
            "house": r.house_name,
            "late_count": r.late_count,
            "total_points_deducted": r.total_points_deducted or 0,
        }
        for r in rows
    ]


@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from datetime import date
    today = date.today()

    today_count = (
        db.query(func.count(models.LateEntry.id))
        .filter(models.LateEntry.date == today, models.LateEntry.status != "unknown")
        .scalar()
    )
    review_queue_count = (
        db.query(func.count(models.LateEntry.id))
        .filter(models.LateEntry.status == "needs_review")
        .scalar()
    )
    total_students = db.query(func.count(models.Student.id)).scalar()

    return {
        "today_late_count": today_count,
        "review_queue_count": review_queue_count,
        "total_students": total_students,
    }


@router.get("/export")
def export_csv(
    date_from: Optional[dt_date] = None,
    date_to: Optional[dt_date] = None,
    house_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    csv_content = export_late_entries_csv(db, date_from, date_to, house_id)
    filename = f"late_entries_{dt_date.today()}.csv"
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
