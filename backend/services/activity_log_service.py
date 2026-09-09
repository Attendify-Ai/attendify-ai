from typing import Optional
from sqlalchemy.orm import Session
import models


def log_activity(db: Session, user_id: Optional[int], action: str, details: str = ""):
    entry = models.ActivityLog(user_id=user_id, action=action, details=details)
    db.add(entry)
    db.commit()
    return entry
