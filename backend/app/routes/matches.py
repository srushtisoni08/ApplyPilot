from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.models.tables import Match, Opportunity, User
from app.security import get_current_user, require_owner
from app.services.apply_target import classify_apply_target
from app.services.matching import run_matching

router = APIRouter(prefix="/matches", tags=["matches"])


@router.post("/run/{user_id}")
def run(
    user_id: int,
    force: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_owner(user_id, current_user)
    try:
        return run_matching(db, current_user.id, force)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{user_id}")
def list_matches(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_owner(user_id, current_user)
    rows = db.execute(
        select(Opportunity, Match)
        .join(Match, Match.opportunity_id == Opportunity.id)
        .where(Opportunity.user_id == current_user.id)
        .order_by(Match.score.desc(), Opportunity.deadline.asc().nulls_last())
    ).all()
    return [
        {
            "opportunity_id": o.id, "company": o.company, "role": o.role,
            "deadline": o.deadline, "apply_link": o.apply_link,
            "apply_method": classify_apply_target(o.apply_link)["method"],
            "score": m.score, "category": m.category, "explanation": m.explanation,
        }
        for o, m in rows
    ]