from enum import Enum

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tables import Approval


class Level(str, Enum):
    READ = "read"      # runs automatically
    DRAFT = "draft"    # runs automatically, output needs approval before use
    SUBMIT = "submit"  # blocked unless an approval record exists


def assert_submit_approved(db: Session, application_id: int) -> None:
    """Second lock: the latest submission approval must be 'approved' before anything is sent."""
    latest = db.scalar(
        select(Approval)
        .where(Approval.application_id == application_id, Approval.kind == "submission")
        .order_by(Approval.id.desc()).limit(1)
    )
    if not latest or latest.decision != "approved":
        raise HTTPException(403, "Blocked: no approved submission on record")