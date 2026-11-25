from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.models.tables import Application, Approval, CandidateProfile, Match, Opportunity
from app.services.audit import audit
from app.services.writer import OUT_DIR, generate
from app.services.apply import submit_application

router = APIRouter(tags=["applications"])
LOCKED = ("submitted", "interview", "rejected")


@router.post("/applications/start/{opportunity_id}")
def start(opportunity_id: int, force: bool = False, db: Session = Depends(get_db)):
    """Gate 1: user picked this job. (Re)generates resume + cover letter, then waits for approval."""
    opp = db.get(Opportunity, opportunity_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    prow = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == opp.user_id))
    if not prow or not prow.confirmed:
        raise HTTPException(400, "Confirm your profile first")
    match = db.scalar(select(Match).where(Match.opportunity_id == opp.id))
    if match and match.category == "unsuitable" and not force:
        raise HTTPException(400, f"Marked unsuitable: {match.explanation}")

    key = f"{opp.user_id}:{opp.id}"  # idempotency: one application per job
    app = db.scalar(select(Application).where(Application.idempotency_key == key))
    if app and app.status in LOCKED:
        raise HTTPException(400, f"Application already {app.status}")
    if not app:
        app = Application(opportunity_id=opp.id, idempotency_key=key, status="draft")
        db.add(app)
        db.flush()
        db.add(Approval(application_id=app.id, kind="job", payload={"opportunity_id": opp.id},
                        decision="approved", decided_at=datetime.now()))
        db.commit()

    for old in db.scalars(select(Approval).where(
            Approval.application_id == app.id, Approval.kind == "resume", Approval.decision == "pending")):
        old.decision = "superseded"

    try:
        out = generate(app.id, prow.data, opp)
    except Exception as exc:
        db.rollback()
        app.status = "needs_attention"
        audit(db, opp.user_id, "writer.generate", {"opportunity_id": opp.id},
              {"error": str(exc)[:200]}, status="error")
        db.commit()
        raise HTTPException(502, f"Generation failed: {str(exc)[:200]}")

    app.cover_letter = out["letter"]
    app.resume_file = out["file"]
    app.status = "awaiting_approval"
    appr = Approval(application_id=app.id, kind="resume", decision="pending", payload={
        "selected": out["selected"],
        "fact_check": {"passed": not out["issues"], "issues": out["issues"]},
    })
    db.add(appr)
    audit(db, opp.user_id, "writer.generate", {"opportunity_id": opp.id},
          {"application_id": app.id, "fact_check_passed": not out["issues"]}, approved_by="user")
    db.commit()
    return {"application_id": app.id, "approval_id": appr.id, "fact_check_passed": not out["issues"]}


@router.get("/approvals/{user_id}")
def pending_approvals(user_id: int, db: Session = Depends(get_db)):
    rows = db.execute(
        select(Approval, Application, Opportunity)
        .join(Application, Approval.application_id == Application.id)
        .join(Opportunity, Application.opportunity_id == Opportunity.id)
        .where(Opportunity.user_id == user_id, Approval.decision == "pending")
        .order_by(Approval.created_at.desc())
    ).all()
    return [
        {
            "approval_id": a.id, "kind": a.kind, "application_id": app.id,
            "company": o.company, "role": o.role, "cover_letter": app.cover_letter,
            "selected": a.payload.get("selected"), "fact_check": a.payload.get("fact_check"),
            "preview": a.payload.get("preview"),
        }
        for a, app, o in rows
    ]


class Decision(BaseModel):
    decision: Literal["approved", "rejected"]


@router.post("/approvals/{approval_id}/decide")
def decide(approval_id: int, body: Decision, db: Session = Depends(get_db)):
    a = db.get(Approval, approval_id)
    if not a:
        raise HTTPException(404, "Approval not found")
    if a.decision != "pending":
        raise HTTPException(400, f"Already {a.decision}")
    if a.kind == "resume" and body.decision == "approved" and not (a.payload.get("fact_check") or {}).get("passed"):
        raise HTTPException(400, "Fact check failed. Reject, then click Prepare again.")

    a.decision = body.decision
    a.decided_at = datetime.now()
    app = db.get(Application, a.application_id)
    opp = db.get(Opportunity, app.opportunity_id)
    if a.kind == "resume":
        app.status = "ready" if body.decision == "approved" else "draft"
    elif a.kind == "submission":
        if body.decision == "rejected":
            app.status = "ready"
        elif app.status != "awaiting_submit" or app.reference_number:
            raise HTTPException(400, f"Cannot submit while status is '{app.status}'")
        else:
            app.status = "submitting"  # blocks double submit
    audit(db, opp.user_id, "approval.decide", {"approval_id": a.id, "kind": a.kind},
          {"decision": body.decision}, approved_by="user")
    db.commit()

    if a.kind == "submission" and body.decision == "approved":
        # GATE 2 passed: only now does the browser touch the real submit button
        try:
            r = submit_application(app, opp, a.payload["plan"])
            app.reference_number = r["reference"]
            app.status = "submitted" if r["verified"] else "needs_attention"
            if r["verified"]:
                app.submitted_at = datetime.now()
            audit(db, opp.user_id, "apply.submit", {"application_id": app.id},
                  {"verified": r["verified"], "reference": r["reference"]}, approved_by="user")
        except Exception as exc:
            app.status = "needs_attention"
            audit(db, opp.user_id, "apply.submit", {"application_id": app.id},
                  {"error": str(exc)[:200]}, approved_by="user", status="error")
        db.commit()
    return {"decision": a.decision, "application_status": app.status}


@router.get("/applications/{app_id}/file/{ext}")
def get_file(app_id: int, ext: str, db: Session = Depends(get_db)):
    app = db.get(Application, app_id)
    path = OUT_DIR / f"{app.resume_file}.{ext}" if app and app.resume_file and ext in ("pdf", "docx") else None
    if not path or not path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(path, filename=f"resume.{ext}")