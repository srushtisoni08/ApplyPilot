import re
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.schemas import ReplyClass
from app.models.tables import Application, AuditLog, Match, Opportunity, User
from app.services.audit import audit
from app.services.gmail import fetch_emails
from app.services.llm import extract

TRACKED = ("submitted", "interview")
DONE = ("submitted", "interview", "offer", "rejected")


def _seen(db: Session, email_id: str) -> bool:
    return db.scalar(select(AuditLog.id).where(
        AuditLog.tool == "reply.classify",
        AuditLog.input["email_id"].as_string() == email_id,
    )) is not None


def check_replies(db: Session, user: User) -> list[dict]:
    """Looks at the last 3 days of mail, links emails to submitted applications by company name,
    classifies them with the LLM, and updates the application status."""
    apps = db.execute(
        select(Application, Opportunity)
        .join(Opportunity, Application.opportunity_id == Opportunity.id)
        .where(Opportunity.user_id == user.id, Application.status.in_(TRACKED))
    ).all()
    if not apps:
        return []

    updates = []
    for e in fetch_emails(db, user, since=datetime.now() - timedelta(days=3), max_results=50):
        if user.email.lower() in e["sender"].lower() or _seen(db, e["id"]):
            continue
        text = f"Subject: {e['subject']}\nFrom: {e['sender']}\n\n{e['body']}"
        hay = text[:3000].lower()
        hit = next(((a, o) for a, o in apps if o.company and o.company.lower() in hay), None)
        if not hit:
            continue
        a, o = hit
        try:
            c = extract(
                ReplyClass, text,
                f"This email may be a reply about a job application to {o.company} ({o.role}). "
                "Classify it as exactly one of: "
                "offer (the candidate is selected, shortlisted for hiring, hired, or gets an offer letter), "
                "interview (invites to an interview, test, assignment or call), "
                "rejection (not selected, will not move forward), "
                "received (only acknowledges the application), or other.",
            )
        except Exception:
            db.rollback()
            break  # LLM unavailable: stop, the next scheduled run retries (email not marked as seen)
        cat = c.category if c.category in ("offer", "interview", "rejection", "received", "other") else "other"
        audit(db, user.id, "reply.classify", {"email_id": e["id"], "application_id": a.id}, {
            "category": cat,
            "reason": str(getattr(c, "reason", "") or "")[:300],
            "subject": e["subject"][:200],
            "sender": e["sender"][:200],
            "date": e.get("date", "")[:60],
            "snippet": re.sub(r"\s+", " ", e["body"]).strip()[:500],
        })
        new = {"offer": "offer", "interview": "interview", "rejection": "rejected"}.get(cat)
        if new and a.status != new and a.status not in ("rejected", "offer"):
            a.status = new
            updates.append({"company": o.company, "role": o.role, "status": new, "subject": e["subject"][:80]})
        db.commit()
    return updates


def deadlines_soon(db: Session, user_id: int, days: int) -> list[dict]:
    today = date.today()
    rows = db.execute(
        select(Opportunity, Match, Application)
        .join(Match, Match.opportunity_id == Opportunity.id)
        .outerjoin(Application, Application.opportunity_id == Opportunity.id)
        .where(
            Opportunity.user_id == user_id,
            Opportunity.deadline.is_not(None),
            Opportunity.deadline >= today,
            Opportunity.deadline <= today + timedelta(days=days),
            Match.category != "unsuitable",
        )
        .order_by(Opportunity.deadline)
    ).all()
    return [
        {
            "company": o.company, "role": o.role, "deadline": str(o.deadline),
            "days_left": (o.deadline - today).days, "score": round(m.score),
            "status": a.status if a else "not started",
        }
        for o, m, a in rows
        if not a or a.status not in DONE
    ]
def list_replies(db: Session, user_id: int, limit: int = 100) -> list[dict]:
    logs = db.scalars(
        select(AuditLog).where(AuditLog.tool == "reply.classify", AuditLog.user_id == user_id)
        .order_by(AuditLog.id.desc()).limit(limit)
    ).all()
    apps = {a.id: (a, o) for a, o in db.execute(
        select(Application, Opportunity)
        .join(Opportunity, Application.opportunity_id == Opportunity.id)
        .where(Opportunity.user_id == user_id)
    ).all()}
    out = []
    for log in logs:
        hit = apps.get((log.input or {}).get("application_id"))
        if not hit:
            continue
        a, o = hit
        d = log.output or {}
        out.append({
            "id": log.id, "application_id": a.id, "company": o.company, "role": o.role,
            "application_status": a.status, "category": d.get("category", "other"),
            "subject": d.get("subject"), "sender": d.get("sender"), "date": d.get("date"),
            "snippet": d.get("snippet"), "reason": d.get("reason"), "received_at": log.created_at,
        })
    return out