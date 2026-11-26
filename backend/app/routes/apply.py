from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.db import get_db
from app.models.tables import Application, Approval, CandidateProfile, Opportunity, User
from app.services.apply import fill_application
from app.services.apply_target import classify_apply_target
from app.services.email_apply import prepare_email
from app.services.audit import audit
from app.services.writer import OUT_DIR
from app.security import get_current_user, require_owner

router = APIRouter(tags=["apply"])


@router.get("/applications/list/{user_id}")
def list_applications(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_owner(user_id, current_user)
    rows = db.execute(
        select(Application, Opportunity)
        .join(Opportunity, Application.opportunity_id == Opportunity.id)
        .where(Opportunity.user_id == current_user.id)
        .order_by(Application.id.desc())
    ).all()
    return [
        {"application_id": a.id, "company": o.company, "role": o.role, "status": a.status,
         "submitted_at": a.submitted_at, "reference_number": a.reference_number,
         "apply_method": classify_apply_target(o.apply_link)["method"]}
        for a, o in rows
    ]


@router.delete("/applications/{app_id}")
def delete_application(
    app_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    opp = db.get(Opportunity, app.opportunity_id)
    if not opp or opp.user_id != current_user.id:
        raise HTTPException(404, "Application not found")
    if app.status == "submitting":
        raise HTTPException(409, "Cannot delete while a submission is in progress")

    application_id = app.id
    status = app.status
    audit(
        db,
        opp.user_id,
        "application.delete",
        {"application_id": application_id},
        {"previous_status": status},
        approved_by="user",
    )
    db.execute(delete(Approval).where(Approval.application_id == application_id))
    db.delete(app)
    db.commit()

    cleanup_warnings = []
    for path in (
        OUT_DIR / f"app_{application_id}.pdf",
        OUT_DIR / f"app_{application_id}.docx",
        OUT_DIR / f"app_{application_id}_filled.png",
        OUT_DIR / f"app_{application_id}_done.png",
    ):
        try:
            path.unlink()
        except FileNotFoundError:
            continue
        except OSError:
            cleanup_warnings.append(path.name)

    return {"deleted": True, "cleanup_warnings": cleanup_warnings}


@router.post("/applications/{app_id}/fill")
def fill(
    app_id: int,
    watch: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    opp = db.get(Opportunity, app.opportunity_id)
    if not opp or opp.user_id != current_user.id:
        raise HTTPException(404, "Application not found")
    if app.status not in ("ready", "needs_attention", "awaiting_submit") or not app.resume_file:
        raise HTTPException(400, f"Status is '{app.status}'. Approve the resume first.")
    target = classify_apply_target(opp.apply_link)
    if target["method"] == "none":
        raise HTTPException(400, f"{target['reason']} Apply manually using the original email.")
    prow = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == opp.user_id))

    if target["method"] == "email":  # no website form: prepare an email, nothing is sent yet
        try:
            em = prepare_email(app, opp, prow.data)
        except (ValueError, FileNotFoundError) as exc:
            raise HTTPException(400, str(exc))
        for old in db.scalars(select(Approval).where(
                Approval.application_id == app.id, Approval.kind == "submission", Approval.decision == "pending")):
            old.decision = "superseded"
        appr = Approval(application_id=app.id, kind="submission", decision="pending", payload={
            "method": "email", "email": em,
            "preview": [{"label": "To", "value": em["to"]}, {"label": "Subject", "value": em["subject"]},
                        {"label": "Attachment", "value": em["attachment"]},
                        {"label": "Message", "value": em["body"][:300]}],
        })
        db.add(appr)
        app.status = "awaiting_submit"
        audit(db, opp.user_id, "apply.prepare_email", {"application_id": app.id}, {"to": em["to"]})
        db.commit()
        return {"status": "awaiting_submit", "approval_id": appr.id, "method": "email"}

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
def screenshot(
    app_id: int,
    kind: str = "filled",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.get(Application, app_id)
    opp = db.get(Opportunity, app.opportunity_id) if app else None
    if not opp or opp.user_id != current_user.id:
        raise HTTPException(404, "Screenshot not found")
    path = OUT_DIR / f"app_{app_id}_{'done' if kind == 'done' else 'filled'}.png"
    if not path.exists():
        raise HTTPException(404, "No screenshot")
    return FileResponse(path, media_type="image/png")

@router.post("/applications/{app_id}/mark-applied")
def mark_applied(
    app_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """User applied by themselves outside ApplyPilot. Lets reply and deadline tracking work for it."""
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    opp = db.get(Opportunity, app.opportunity_id)
    if not opp or opp.user_id != current_user.id:
        raise HTTPException(404, "Application not found")
    if app.status in ("submitted", "interview", "offer", "rejected"):
        raise HTTPException(400, f"Already '{app.status}'")
    if app.status == "submitting":
        raise HTTPException(400, "A submission is in progress. Wait for it to finish.")
    for old in db.scalars(select(Approval).where(
            Approval.application_id == app.id, Approval.decision == "pending")):
        old.decision = "superseded"  # nothing left to approve
    app.status = "submitted"
    app.submitted_at = datetime.now()
    audit(db, opp.user_id, "apply.mark_applied", {"application_id": app.id}, {"by": "user"}, approved_by="user")
    db.commit()
    return {"application_status": app.status}