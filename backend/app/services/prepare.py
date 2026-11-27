from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tables import Application, Approval, CandidateProfile, Match, Opportunity
from app.services.audit import audit
from app.services.writer import generate

LOCKED = ("submitted", "interview", "offer", "rejected")


class PrepareError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def prepare_application(db: Session, opp: Opportunity, force: bool = False, actor: str = "user") -> dict:
    """Drafts resume + cover letter and creates a pending approval. Used by the route and by the agent."""
    prow = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == opp.user_id))
    if not prow or not prow.confirmed:
        raise PrepareError(400, "Confirm your profile first")
    match = db.scalar(select(Match).where(Match.opportunity_id == opp.id))
    if match and match.category == "unsuitable" and not force:
        raise PrepareError(400, f"Marked unsuitable: {match.explanation}")

    key = f"{opp.user_id}:{opp.id}"  # idempotency: one application per job
    app = db.scalar(select(Application).where(Application.idempotency_key == key))
    if app and app.status in LOCKED:
        raise PrepareError(400, f"Application already {app.status}")
    if not app:
        app = Application(opportunity_id=opp.id, idempotency_key=key, status="draft")
        db.add(app)
        db.flush()
        db.add(Approval(
            application_id=app.id, kind="job",
            payload={"opportunity_id": opp.id, "picked_by": actor},
            decision="approved" if actor == "user" else "auto",  # an agent pick is not a user approval
            decided_at=datetime.now(),
        ))
        db.commit()

    for old in db.scalars(select(Approval).where(
            Approval.application_id == app.id, Approval.kind == "resume", Approval.decision == "pending")):
        old.decision = "superseded"

    approver = "user" if actor == "user" else None
    try:
        out = generate(app.id, prow.data, opp)
    except Exception as exc:
        db.rollback()
        app.status = "needs_attention"
        audit(db, opp.user_id, "writer.generate", {"opportunity_id": opp.id},
              {"error": str(exc)[:200]}, status="error")
        db.commit()
        raise PrepareError(502, f"Generation failed: {str(exc)[:200]}")

    app.cover_letter = out["letter"]
    app.resume_file = out["file"]
    app.status = "awaiting_approval"
    appr = Approval(application_id=app.id, kind="resume", decision="pending", payload={
        "selected": out["selected"],
        "fact_check": {"passed": not out["issues"], "issues": out["issues"]},
    })
    db.add(appr)
    audit(db, opp.user_id, "writer.generate", {"opportunity_id": opp.id},
          {"application_id": app.id, "fact_check_passed": not out["issues"]}, approved_by=approver)
    db.commit()
    return {"application_id": app.id, "approval_id": appr.id, "fact_check_passed": not out["issues"]}