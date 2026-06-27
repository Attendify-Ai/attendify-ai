from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from database import get_db
import models
from services.auth_service import get_current_user, require_admin
from services.point_service import apply_point_adjustment

router = APIRouter(prefix="/houses", tags=["Houses"])


def house_to_dict(house, rank=None, late_count=None):
    return {
        "id": house.id,
        "name": house.name,
        "current_points": house.current_points,
        "rank": rank,
        "total_late_entries": late_count,
        "created_at": house.created_at,
    }


@router.get("/")
def get_all_houses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    houses = db.query(models.House).all()
    ranked = sorted(houses, key=lambda h: h.current_points, reverse=True)
    result = []
    for i, house in enumerate(ranked):
        late_count = (
            db.query(func.count(models.LateEntry.id))
            .filter(models.LateEntry.house_id == house.id, models.LateEntry.status != "unknown")
            .scalar()
        )
        result.append(house_to_dict(house, rank=i + 1, late_count=late_count))
    return result


@router.get("/{house_id}")
def get_house(
    house_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    house = db.query(models.House).filter(models.House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")

    all_houses = db.query(models.House).all()
    ranked = sorted(all_houses, key=lambda h: h.current_points, reverse=True)
    rank = next((i + 1 for i, h in enumerate(ranked) if h.id == house_id), None)

    late_count = (
        db.query(func.count(models.LateEntry.id))
        .filter(models.LateEntry.house_id == house_id, models.LateEntry.status != "unknown")
        .scalar()
    )
    return house_to_dict(house, rank=rank, late_count=late_count)


class PointAdjustmentRequest(BaseModel):
    points: int  # positive to add, negative to deduct
    reason: str


@router.post("/{house_id}/adjust-points")
def adjust_points(
    house_id: int,
    payload: PointAdjustmentRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    house = db.query(models.House).filter(models.House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")
    if not payload.reason.strip():
        raise HTTPException(status_code=400, detail="Reason is required for point adjustments")

    adjustment = apply_point_adjustment(db, house_id, payload.points, payload.reason, current_user.id)
    db.refresh(house)
    return {
        "adjustment_id": adjustment.id,
        "house_id": house_id,
        "house_name": house.name,
        "points_changed": payload.points,
        "reason": payload.reason,
        "new_total": house.current_points,
        "adjusted_by": current_user.name,
        "created_at": adjustment.created_at,
    }


@router.get("/{house_id}/history")
def point_history(
    house_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    house = db.query(models.House).filter(models.House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")

    # Manual adjustments
    adjustments = (
        db.query(models.PointAdjustment, models.User.name.label("user_name"))
        .join(models.User, models.PointAdjustment.awarded_by == models.User.id, isouter=True)
        .filter(models.PointAdjustment.house_id == house_id)
        .all()
    )

    # Late-entry deductions
    late_entries = (
        db.query(models.LateEntry, models.Student.name.label("student_name"))
        .join(models.Student, models.LateEntry.student_id == models.Student.id, isouter=True)
        .filter(models.LateEntry.house_id == house_id, models.LateEntry.status != "unknown")
        .order_by(models.LateEntry.created_at.desc())
        .limit(100)
        .all()
    )

    history = []
    for adj, user_name in adjustments:
        history.append({
            "type": "adjustment",
            "points": adj.points,
            "reason": adj.reason,
            "by": user_name,
            "at": adj.created_at,
        })
    for entry, student_name in late_entries:
        history.append({
            "type": "late_entry",
            "points": -entry.points_deducted,
            "reason": f"{student_name or 'Unknown'} arrived {entry.minutes_late} min late",
            "by": None,
            "at": entry.created_at,
            "late_entry_id": entry.id,
        })

    history.sort(key=lambda x: x["at"] or "", reverse=True)
    return {"house": house_to_dict(house), "history": history}
