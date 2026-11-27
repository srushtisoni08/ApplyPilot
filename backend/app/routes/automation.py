from datetime import datetime
from sqlalchemy import select
from app.models.tables import Opportunity, Match
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.models.tables import User
from app.security import require_key
from app.services.extraction import process_emails
from app.services.discovery import discover
from app.services.matching import run_matching
from app.services.tracking import check_replies, deadlines_soon

router = APIRouter(prefix="/automation", tags=["automation"], dependencies=[Depends(require_key)])


def _user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or not user.google_refresh_token:
        raise HTTPException(404, "User not connected")
    return user


@router.post("/pipeline/{user_id}")
def pipeline(user_id: int, db: Session = Depends(get_db)):
    user = _user(db, user_id)
    started = datetime.now()

    # Step 1: Scan emails and extract opportunities
    stats = process_emails(
        db,
        user,
        n=50,
        since=user.last_email_sync
    )

    # Step 2: Run matching for opportunities that don't have matches yet
    try:
        matching_result = run_matching(db, user_id)
    except ValueError:
        matching_result = {
            "matched": [],
            "errors": [{"error": "Build the candidate profile first"}]
        }

    # Step 3: Update email sync time only if extraction and matching succeeded
    if (
        not stats["errors"]
        and not stats["stopped_early"]
        and not matching_result["errors"]
        and not any(
            error.get("error") == "Build the candidate profile first"
            for error in matching_result["errors"]
        )
    ):
        user.last_email_sync = started
        db.commit()

    # Step 4: Fetch ALL opportunities and their existing match records
    rows = db.execute(
        select(Opportunity, Match)
        .outerjoin(
            Match,
            Match.opportunity_id == Opportunity.id
        )
        .where(Opportunity.user_id == user_id)
        .order_by(Opportunity.created_at.desc())
    ).all()

    # Step 5: Prepare structured response
    opportunities = []

    for opportunity, match in rows:
        opportunities.append({
            "opportunity_id": opportunity.id,
            "company": opportunity.company,
            "role": opportunity.role,
            "required_skills": opportunity.required_skills or [],
            "location": opportunity.location,
            "compensation": opportunity.compensation,
            "apply_link": opportunity.apply_link,
            "deadline": (
                opportunity.deadline.isoformat()
                if opportunity.deadline else None
            ),
            "score": match.score if match else None,
            "category": match.category if match else "unmatched",
            "explanation": match.explanation if match else None
        })

    # Step 6: Count newly processed matches separately
    newly_matched = [
        item for item in matching_result["matched"]
        if item["category"] != "unsuitable"
    ]

    return {
        "count": len(opportunities),
        "newly_matched_count": len(newly_matched),
        "opportunities": opportunities,
        "errors": (
            len(stats["errors"])
            + len(matching_result["errors"])
        )
    }
@router.post("/replies/{user_id}")
def replies(user_id: int, db: Session = Depends(get_db)):
    """Workflow 2: detect interview / rejection emails and update application status."""
    updates = check_replies(db, _user(db, user_id))
    lines = [f"• {u['company']} - {u['role']}: now {u['status'].upper()} ({u['subject']})" for u in updates]
    return {"count": len(updates), "message": ("Application updates:\n" + "\n".join(lines)) if updates else ""}


@router.get("/deadlines/{user_id}")
def deadlines(user_id: int, days: int = 3, db: Session = Depends(get_db)):
    """Workflow 3: deadlines in the next N days for jobs you have not applied to yet."""
    items = deadlines_soon(db, user_id, days)
    lines = [
        f"• {i['company']} - {i['role']}: due {i['deadline']} ({i['days_left']}d left, {i['score']}% match, {i['status']})"
        for i in items
    ]
    return {"count": len(items), "message": (f"Deadlines in the next {days} days:\n" + "\n".join(lines)) if items else ""}


@router.post("/discover/{user_id}")
def discover_route(user_id: int, days: int = 7, db: Session = Depends(get_db)):
    """Workflow 4: Crustdata discovery, then score. Returns message for Telegram."""
    user = _user(db, user_id)
    try:
        stats = discover(db, user, days=days)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    try:
        matched = run_matching(db, user_id)["matched"]
    except ValueError:
        matched = []
    good = [m for m in matched if m["category"] != "unsuitable"]
    lines = [f"• {m['company']} - {m['role']}: {round(m['score'])}% ({m['category']})" for m in good]
    return {"count": len(good), "found": stats["found"], "errors": len(stats["errors"]),
            "message": ("New discovered jobs:\n" + "\n".join(lines)) if lines else ""}
