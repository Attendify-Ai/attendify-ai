import csv
import io
from sqlalchemy.orm import Session
from sqlalchemy import func
import models


def export_late_entries_csv(db: Session, date_from=None, date_to=None, house_id=None) -> str:
    query = (
        db.query(
            models.LateEntry,
            models.Student.name.label("student_name"),
            models.Student.student_code,
            models.Student.class_.label("student_class"),
            models.House.name.label("house_name"),
        )
        .join(models.Student, models.LateEntry.student_id == models.Student.id, isouter=True)
        .join(models.House, models.LateEntry.house_id == models.House.id, isouter=True)
    )

    if date_from:
        query = query.filter(models.LateEntry.date >= date_from)
    if date_to:
        query = query.filter(models.LateEntry.date <= date_to)
    if house_id:
        query = query.filter(models.LateEntry.house_id == house_id)

    rows = query.order_by(models.LateEntry.date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Date", "Arrival Time", "Student Name", "Student Code",
        "Class", "House", "Minutes Late", "Points Deducted",
        "Confidence Score", "Status",
    ])

    for entry, student_name, student_code, student_class, house_name in rows:
        writer.writerow([
            entry.id,
            entry.date,
            entry.arrival_time,
            student_name or "Unknown",
            student_code or "",
            student_class or "",
            house_name or "",
            entry.minutes_late,
            entry.points_deducted,
            f"{entry.confidence_score:.2f}" if entry.confidence_score else "",
            entry.status,
        ])

    return output.getvalue()
