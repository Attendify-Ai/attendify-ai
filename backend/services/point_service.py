from sqlalchemy.orm import Session
import models
from datetime import datetime


def calculate_points_deducted(minutes_late: int) -> int:
    if minutes_late <= 10:
        return 2
    return 5


def deduct_points_for_late_entry(db: Session, late_entry: models.LateEntry):
    house = db.query(models.House).filter(models.House.id == late_entry.house_id).first()
    if house:
        house.current_points -= late_entry.points_deducted
        db.commit()


def restore_points_for_late_entry(db: Session, late_entry: models.LateEntry):
    """Restore points when a late entry is changed to 'unknown' (unidentified)."""
    house = db.query(models.House).filter(models.House.id == late_entry.house_id).first()
    if house and late_entry.points_deducted:
        house.current_points += late_entry.points_deducted
        db.commit()


def apply_point_adjustment(db: Session, house_id: int, points: int, reason: str, awarded_by: int):
    adjustment = models.PointAdjustment(
        house_id=house_id,
        points=points,
        reason=reason,
        awarded_by=awarded_by,
        created_at=datetime.utcnow(),
    )
    db.add(adjustment)

    house = db.query(models.House).filter(models.House.id == house_id).first()
    if not house:
        raise ValueError("House not found")
    house.current_points += points
    db.commit()
    db.refresh(adjustment)
    return adjustment
