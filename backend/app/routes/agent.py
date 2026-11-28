from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.orchestrator import run_cycle
from app.models.db import get_db
from app.models.tables import AuditLog, User
from app.config import settings
from app.security import get_current_user
from app.agent.orchestrator import report_lines, run_cycle

router = APIRouter(tags=["agent"])


@router.post("/agent/run")
def run_agent(
    auto_prepare: bool = False,
    max_prepare: int = 3,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return run_cycle(db, current_user, auto_prepare, max(1, min(max_prepare, 5)))


@router.get("/agent/activity")
def activity(
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(AuditLog).where(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.id.desc()).limit(max(1, min(limit, 300)))
    ).all()
    return [
        {"id": r.id, "time": r.created_at, "tool": r.tool, "status": r.status,
         "approved_by": r.approved_by, "input": r.input, "output": r.output}
        for r in rows
    ]


@router.get("/agent/status")
def agent_status(current_user: User = Depends(get_current_user)):
    """Read-only view of the background scheduler (configured in .env.local)."""
    from app.services.notify import telegram_configured
    return {
        "scheduler_enabled": settings.SCHEDULER_ENABLED,
        "agent_interval_min": settings.AGENT_INTERVAL_MIN,
        "replies_interval_min": settings.REPLIES_INTERVAL_MIN,
        "deadline_hour": settings.DEADLINE_HOUR,
        "deadline_days": settings.DEADLINE_DAYS,
        "discovery_enabled": settings.DISCOVERY_ENABLED,
        "discovery_interval_hours": settings.DISCOVERY_INTERVAL_HOURS,
        "auto_prepare": settings.SCHEDULER_AUTO_PREPARE,
        "telegram_configured": telegram_configured(),
    }
