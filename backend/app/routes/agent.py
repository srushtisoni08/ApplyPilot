from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.orchestrator import run_cycle
from app.models.db import get_db
from app.models.tables import AuditLog, User
from app.security import get_current_user, require_key
from app.agent.orchestrator import report_lines, run_cycle

router = APIRouter(tags=["agent"])
n8n_router = APIRouter(prefix="/automation", tags=["automation"], dependencies=[Depends(require_key)])


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


@n8n_router.post("/agent/{user_id}")
def run_agent_for_n8n(user_id: int, auto_prepare: bool = False, db: Session = Depends(get_db)):
    """For n8n: runs one cycle and returns count + message for the Telegram node."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    report = run_cycle(db, user, auto_prepare)
    lines = report_lines(report)

    for a in (report["state"] or {}).get("needs_attention", []):
        lines.append(f"Needs attention: {a['company']} - {a['role']}")
    return {"count": len(lines), "message": "\n".join(lines), "blocked": report["blocked"]} 