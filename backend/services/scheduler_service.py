from datetime import date as dt_date, timedelta
from database import SessionLocal
import models
from services.activity_log_service import log_activity


def generate_weekly_reports_job():
    """Runs every Monday morning. Reports are computed live on demand;
    this just records that a fresh weekly report is available per house."""
    db = SessionLocal()
    try:
        today = dt_date.today()
        week_start = today - timedelta(days=today.weekday())
        managers = db.query(models.User).filter(
            models.User.role == "house_manager",
            models.User.assigned_house_id.isnot(None),
        ).all()
        for manager in managers:
            house = db.query(models.House).filter(models.House.id == manager.assigned_house_id).first()
            if not house:
                continue
            log_activity(
                db,
                manager.id,
                "weekly_report_generated",
                f"Weekly report available for {house.name} — week of {week_start}",
            )
    finally:
        db.close()
