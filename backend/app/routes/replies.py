from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.models.tables import User
from app.security import get_current_user, require_owner
from app.services.tracking import check_replies, list_replies

router = APIRouter(tags=["replies"])


@router.get("/replies/{user_id}")
def replies_list(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_owner(user_id, current_user)
    return list_replies(db, current_user.id)


@router.post("/replies/check")
def replies_check(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.google_refresh_token:
        raise HTTPException(400, "Connect Gmail first")
    try:
        updates = check_replies(db, current_user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(502, f"Could not check replies: {str(exc)[:200]}")
    return {"updates": updates, "replies": list_replies(db, current_user.id)}