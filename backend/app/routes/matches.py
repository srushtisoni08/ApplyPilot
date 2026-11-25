from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.models.tables import Match, Opportunity, User
from app.services.matching import run_matching

router = APIRouter(prefix="/matches", tags=["matches"])


@router.post("/run/{user_id}")
def run(user_id: int, force: bool = False, db: Session = Depends(get_db)):
    if not db.get(User, user_id):
        raise HTTPException(404, "User not found")
    try:
        return run_matching(db, user_id, force)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{user_id}")
def list_matches(user_id: int, db: Session = Depends(get_db)):
    rows = db.execute(
        select(Opportunity, Match)
        .join(Match, Match.opportunity_id == Opportunity.id)
        .where(Opportunity.user_id == user_id)
        .order_by(Match.score.desc(), Opportunity.deadline.asc().nulls_last())
    ).all()
    return [
        {
            "opportunity_id": o.id, "company": o.company, "role": o.role,
            "deadline": o.deadline, "apply_link": o.apply_link,
            "score": m.score, "category": m.category, "explanation": m.explanation,
        }
        for o, m in rows
    ]