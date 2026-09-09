from datetime import date as dt_date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
import models


def _week_bounds(week_start: dt_date = None):
    if week_start is None:
        today = dt_date.today()
        week_start = today - timedelta(days=today.weekday())  # Monday
    week_end = week_start + timedelta(days=6)  # Sunday
    prev_week_start = week_start - timedelta(days=7)
    prev_week_end = week_start - timedelta(days=1)
    return week_start, week_end, prev_week_start, prev_week_end


def _week_totals(db: Session, house_id: int, start: dt_date, end: dt_date):
    row = (
        db.query(
            func.count(models.LateEntry.id).label("count"),
            func.coalesce(func.sum(models.LateEntry.points_deducted), 0).label("points"),
        )
        .filter(
            models.LateEntry.house_id == house_id,
            models.LateEntry.date.between(start, end),
            models.LateEntry.status != "unknown",
        )
        .first()
    )
    return {"late_entries": row.count or 0, "points_lost": row.points or 0}


def get_house_weekly_report(db: Session, house_id: int, week_start: dt_date = None) -> dict:
    house = db.query(models.House).filter(models.House.id == house_id).first()
    if not house:
        return None

    week_start, week_end, prev_week_start, prev_week_end = _week_bounds(week_start)

    daily_rows = (
        db.query(models.LateEntry.date, func.count(models.LateEntry.id).label("count"))
        .filter(
            models.LateEntry.house_id == house_id,
            models.LateEntry.date.between(week_start, week_end),
            models.LateEntry.status != "unknown",
        )
        .group_by(models.LateEntry.date)
        .all()
    )
    counts_by_date = {r.date: r.count for r in daily_rows}
    daily_trend = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        daily_trend.append({"date": str(d), "day": d.strftime("%a"), "count": counts_by_date.get(d, 0)})

    this_week = _week_totals(db, house_id, week_start, week_end)
    last_week = _week_totals(db, house_id, prev_week_start, prev_week_end)

    top_students_rows = (
        db.query(
            models.Student.id,
            models.Student.name,
            models.Student.student_code,
            models.Student.class_,
            func.count(models.LateEntry.id).label("late_count"),
        )
        .join(models.LateEntry, models.Student.id == models.LateEntry.student_id)
        .filter(
            models.LateEntry.house_id == house_id,
            models.LateEntry.date.between(week_start, week_end),
            models.LateEntry.status != "unknown",
        )
        .group_by(models.Student.id, models.Student.name, models.Student.student_code, models.Student.class_)
        .order_by(func.count(models.LateEntry.id).desc())
        .limit(5)
        .all()
    )
    top_students = [
        {
            "student_id": r.id,
            "name": r.name,
            "student_code": r.student_code,
            "class": r.class_,
            "late_count": r.late_count,
        }
        for r in top_students_rows
    ]

    all_houses = db.query(models.House).order_by(models.House.current_points.desc()).all()
    rank = next((i + 1 for i, h in enumerate(all_houses) if h.id == house_id), None)

    return {
        "house_id": house.id,
        "house_name": house.name,
        "house_colour": house.colour,
        "current_points": house.current_points,
        "rank": rank,
        "week_start": str(week_start),
        "week_end": str(week_end),
        "daily_trend": daily_trend,
        "this_week": this_week,
        "last_week": last_week,
        "top_students": top_students,
    }
