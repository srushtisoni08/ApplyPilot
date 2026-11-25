from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.models.tables import Application, Approval, CandidateProfile, Opportunity
from app.services.apply import fill_application
from app.services.audit import audit
from app.services.writer import OUT_DIR

router = APIRouter(tags=["apply"])


@router.get("/applications/list/{user_id}")
def list_applications(user_id: int, db: Session = Depends(get_db)):
    rows = db.execute(
        select(Application, Opportunity)
        .join(Opportunity, Application.opportunity_id == Opportunity.id)
        .where(Opportunity.user_id == user_id)
        .order_by(Application.id.desc())
    ).all()
    return [
        {"application_id": a.id, "company": o.company, "role": o.role, "status": a.status,
         "submitted_at": a.submitted_at, "reference_number": a.reference_number}
        for a, o in rows
    ]


@router.post("/applications/{app_id}/fill")
def fill(app_id: int, watch: bool = False, db: Session = Depends(get_db)):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    if app.status not in ("ready", "needs_attention", "awaiting_submit") or not app.resume_file:
        raise HTTPException(400, f"Status is '{app.status}'. Approve the resume first.")
    opp = db.get(Opportunity, app.opportunity_id)
    if not opp.apply_link:
        raise HTTPException(400, "This opportunity has no apply link")
    prow = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == opp.user_id))

    try:
        res = fill_application(app, opp, prow.data, watch)
    except Exception as exc:
        app.status = "needs_attention"
        audit(db, opp.user_id, "apply.fill", {"application_id": app.id}, {"error": str(exc)[:200]}, status="error")
        db.commit()
        raise HTTPException(502, f"Browser step failed: {str(exc)[:200]}")

    if res["status"] == "needs_attention":
        app.status = "needs_attention"
        audit(db, opp.user_id, "apply.fill", {"application_id": app.id}, res, status="needs_attention")
        db.commit()
        return res

    for old in db.scalars(select(Approval).where(
            Approval.application_id == app.id, Approval.kind == "submission", Approval.decision == "pending")):
        old.decision = "superseded"
    appr = Approval(application_id=app.id, kind="submission", decision="pending", payload={
        "plan": res["plan"],
        "preview": [{"label": p["label"], "value": "resume.pdf" if p["kind"] == "file" else p["value"][:300]}
                    for p in res["plan"]],
    })
    db.add(appr)
    app.status = "awaiting_submit"
    audit(db, opp.user_id, "apply.fill", {"application_id": app.id}, {"fields_filled": len(res["plan"])})
    db.commit()
    return {"status": "awaiting_submit", "approval_id": appr.id}


@router.get("/applications/{app_id}/screenshot")
def screenshot(app_id: int, kind: str = "filled"):
    path = OUT_DIR / f"app_{app_id}_{'done' if kind == 'done' else 'filled'}.png"
    if not path.exists():
        raise HTTPException(404, "No screenshot")
    return FileResponse(path, media_type="image/png")