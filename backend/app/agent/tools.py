from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from app.agent.permissions import Level
from app.models.tables import Opportunity, User
from app.services.extraction import process_emails
from app.services.matching import run_matching
from app.services.prepare import PrepareError, prepare_application
from app.services.tracking import check_replies


@dataclass
class Tool:
    name: str
    level: Level
    fn: Callable
    doc: str


def _scan_inbox(db, user: User, **_):
    started = datetime.now()
    stats = process_emails(db, user, n=50, since=user.last_email_sync)
    clean = not stats["errors"] and not stats["stopped_early"]
    if clean:  # only move the sync marker if nothing failed, so failed emails are retried
        user.last_email_sync = started
        db.commit()
    return {"fetched": stats["fetched"], "saved": stats["saved"],
            "enriched": stats.get("enriched", 0), "errors": len(stats["errors"]), "clean": clean}


def _score(db, user: User, **_):
    r = run_matching(db, user.id)
    return {"matched": r["matched"], "errors": len(r["errors"])}


def _replies(db, user: User, **_):
    return {"updates": check_replies(db, user)}


def _prepare(db, user: User, opportunity_id: int, **_):
    opp = db.get(Opportunity, opportunity_id)
    if not opp or opp.user_id != user.id:
        raise PrepareError(404, "Opportunity not found")
    return prepare_application(db, opp, actor="agent")


# There is deliberately NO submit/send tool. Submitting only happens through the approval routes.
TOOLS = {t.name: t for t in [
    Tool("scan_inbox", Level.READ, _scan_inbox, "Fetch new emails and extract opportunities"),
    Tool("score_opportunities", Level.READ, _score, "Score opportunities against the profile"),
    Tool("check_replies", Level.READ, _replies, "Detect interview and rejection replies"),
    Tool("prepare_documents", Level.DRAFT, _prepare, "Draft resume and cover letter (needs approval)"),
]}