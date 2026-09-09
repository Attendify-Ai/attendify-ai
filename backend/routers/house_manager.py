from datetime import date as dt_date
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
import models
from services.auth_service import require_role
from services.report_service import get_house_weekly_report
from services.excel_service import build_weekly_report_xlsx

router = APIRouter(prefix="/house-manager", tags=["House Manager"])


def _resolve_house_id(current_user: models.User) -> int:
    if not current_user.assigned_house_id:
        raise HTTPException(status_code=400, detail="No house assigned to this account")
    return current_user.assigned_house_id


@router.get("/report")
def report(
    week_start: Optional[dt_date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("house_manager")),
):
    house_id = _resolve_house_id(current_user)
    data = get_house_weekly_report(db, house_id, week_start)
    if not data:
        raise HTTPException(status_code=404, detail="House not found")
    return data


@router.get("/report/export")
def export_report(
    week_start: Optional[dt_date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("house_manager")),
):
    house_id = _resolve_house_id(current_user)
    data = get_house_weekly_report(db, house_id, week_start)
    if not data:
        raise HTTPException(status_code=404, detail="House not found")

    buf = build_weekly_report_xlsx(data)
    filename = f"{data['house_name']}_weekly_report_{data['week_start']}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
