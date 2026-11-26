from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.models.schemas import CandidateProfileSchema
from app.models.tables import CandidateProfile, User
from app.services.extraction import build_profile, process_emails
from app.security import get_current_user, require_owner

router = APIRouter(tags=["profile"])


@router.post("/profile/build/{user_id}")
def build(
    user_id: int,
    doc_ids: list[int] | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_owner(user_id, current_user)
    try:
        row = build_profile(db, current_user.id, doc_ids)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # LLM or network failure: show the reason instead of a bare 500
        raise HTTPException(502, f"AI extraction failed: {str(e)[:300]}")
    return {"data": row.data, "needs_confirmation": row.needs_confirmation}


@router.get("/profile/{user_id}")
def get_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_owner(user_id, current_user)
    row = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
    if not row:
        raise HTTPException(404, "No profile yet")
    return {"data": row.data, "needs_confirmation": row.needs_confirmation, "confirmed": row.confirmed}


@router.put("/profile/{user_id}")  # user edits + confirms
def confirm_profile(
    user_id: int,
    body: CandidateProfileSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_owner(user_id, current_user)
    row = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
    if not row:
        raise HTTPException(404, "No profile yet")
    row.data = body.model_dump()
    row.needs_confirmation = []
    row.confirmed = True
    db.commit()
    return {"confirmed": True}


@router.post("/emails/process/{user_id}")
def process(
    user_id: int,
    n: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_owner(user_id, current_user)
    user = current_user
    if not user or not user.google_refresh_token:
        raise HTTPException(404, "User not connected")
    return process_emails(db, user, n)