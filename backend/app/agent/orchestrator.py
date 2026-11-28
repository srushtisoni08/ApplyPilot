from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.permissions import Level
from app.agent.tools import TOOLS
from app.models.tables import Application, CandidateProfile, Match, Opportunity, User
from app.services.apply_target import classify_apply_target
from app.services.audit import audit
from app.services.prepare import PrepareError
from app.services.tracking import deadlines_soon


# ---------- OBSERVE ----------
def observe(db: Session, user: User) -> dict:
    today = date.today()
    prow = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == user.id))
    rows = db.execute(
        select(Opportunity, Match, Application)
        .outerjoin(Match, Match.opportunity_id == Opportunity.id)
        .outerjoin(Application, Application.opportunity_id == Opportunity.id)
        .where(Opportunity.user_id == user.id)
    ).all()

    candidates = sorted(
        [(o, m) for o, m, a in rows if m and m.category == "suitable" and a is None],
        key=lambda r: -(r[1].score or 0),
    )
    to_prepare, manual = [], []
    for o, m in candidates:
        if o.deadline and o.deadline < today:
            continue
        if classify_apply_target(o.apply_link)["method"] == "none":
            manual.append({"opportunity_id": o.id, "company": o.company, "role": o.role})
        else:
            to_prepare.append(o.id)

    return {
        "profile_confirmed": bool(prow and prow.confirmed),
        "gmail_connected": bool(user.google_refresh_token),
        "unmatched": sum(1 for o, m, a in rows if m is None),
        "to_prepare": to_prepare,
        "manual_only": manual,
        "tracked": sum(1 for o, m, a in rows if a and a.status in ("submitted", "interview")),
        "waiting_for_you": sum(1 for o, m, a in rows if a and a.status in ("awaiting_approval", "awaiting_submit")),
        "needs_attention": [{"application_id": a.id, "company": o.company, "role": o.role}
                            for o, m, a in rows if a and a.status == "needs_attention"],
        "deadlines_soon": deadlines_soon(db, user.id, 3),
    }


# ---------- PLAN (deterministic rules, no LLM chooses actions) ----------
def _step(tool: str, args: dict, reason: str) -> dict:
    return {"tool": tool, "args": args, "reason": reason}


def plan(obs: dict, phase: str, auto_prepare: bool, max_prepare: int) -> list[dict]:
    steps = []
    if phase == "ingest":
        if obs["gmail_connected"]:
            steps.append(_step("scan_inbox", {}, "Check the inbox for new job emails"))
        if obs["gmail_connected"] or obs["unmatched"]:
            steps.append(_step("score_opportunities", {}, "Score opportunities that have no match yet"))
        if obs["gmail_connected"]:
            steps.append(_step("check_replies", {}, "Look for replies from companies you applied to"))
    elif phase == "draft" and auto_prepare:
        for oid in obs["to_prepare"][:max_prepare]:
            steps.append(_step("prepare_documents", {"opportunity_id": oid},
                               "Suitable match with no application: draft documents for your approval"))
    return steps


# ---------- VERIFY ----------
def verify(db: Session, user: User, name: str, result: dict) -> tuple[bool, str]:
    if name == "scan_inbox":
        return (True, "") if result["clean"] else (False, f"{result['errors']} email(s) failed, retried next run")
    if name == "score_opportunities":
        left = db.scalar(
            select(Opportunity.id).outerjoin(Match, Match.opportunity_id == Opportunity.id)
            .where(Opportunity.user_id == user.id, Match.id.is_(None)).limit(1)
        )
        return (True, "") if left is None else (False, "some opportunities are still unscored")
    if name == "prepare_documents":
        app = db.get(Application, result["application_id"])
        if not app or app.status != "awaiting_approval":
            return False, "application is not waiting for approval"
        return (True, "") if result["fact_check_passed"] else (False, "fact check failed, needs your review")
    return True, ""


def _summary(name: str, result: dict | None) -> dict:
    if not result:
        return {}
    if name == "scan_inbox":
        return {"fetched": result["fetched"], "saved": len(result["saved"]), "enriched": result["enriched"]}
    if name == "score_opportunities":
        return {"scored": len(result["matched"])}
    if name == "check_replies":
        return {"updates": len(result["updates"])}
    return {"application_id": result.get("application_id")}


# ---------- EXECUTE (permission check + audit on every call) ----------
def run_tool(db: Session, user: User, name: str, args: dict, reason: str) -> dict:
    tool = TOOLS.get(name)
    if tool is None or tool.level == Level.SUBMIT:
        audit(db, user.id, f"agent.{name}", args, {"blocked": "not an agent tool"}, status="blocked")
        db.commit()
        return {"tool": name, "level": "submit", "reason": reason, "ok": False,
                "note": "blocked: submitting needs your approval", "result": None}

    result, ok, note = None, False, ""
    for attempt in (1, 2):
        try:
            result = tool.fn(db, user, **args)
        except PrepareError as exc:  # deterministic refusal: retrying will not help
            db.rollback()
            result, ok, note = None, False, exc.message
            break
        except Exception as exc:
            db.rollback()
            result, ok, note = None, False, f"{type(exc).__name__}: {str(exc)[:160]}"
            continue
        ok, note = verify(db, user, name, result)
        if ok or tool.level != Level.READ:  # only read-only steps are safe to repeat
            break

    audit(db, user.id, f"agent.{name}", args,
          {"level": tool.level.value, "ok": ok, "note": note, **_summary(name, result)},
          status="ok" if ok else "failed")
    db.commit()
    return {"tool": name, "level": tool.level.value, "reason": reason, "ok": ok, "note": note, "result": result}


# ---------- One full cycle ----------
def run_cycle(db: Session, user: User, auto_prepare: bool = False, max_prepare: int = 3) -> dict:
    report: dict = {"steps": [], "blocked": None, "state": None}
    if not observe(db, user)["profile_confirmed"]:
        report["blocked"] = "Confirm your profile first. The agent only works from a confirmed profile."
        return report

    for phase in ("ingest", "draft"):
        obs = observe(db, user)  # re-observe so documents are drafted for jobs found this cycle
        for s in plan(obs, phase, auto_prepare, max_prepare):
            report["steps"].append(run_tool(db, user, s["tool"], s["args"], s["reason"]))

    final = observe(db, user)
    report["state"] = {k: final[k] for k in ("waiting_for_you", "needs_attention", "manual_only", "deadlines_soon")}
    audit(db, user.id, "agent.cycle", {"auto_prepare": auto_prepare},
          {"steps": len(report["steps"]), "failed": sum(1 for s in report["steps"] if not s["ok"])})
    db.commit()
    return report

def report_lines(report: dict) -> list[str]:
    lines = []
    for s in report["steps"]:
        r = s["result"] or {}
        if s["tool"] == "score_opportunities":
            lines += [f"New: {m['company'] or '?'} - {m['role'] or '?'} {round(m['score'])}% ({m['category']})"
                      for m in r.get("matched", []) if m["category"] != "unsuitable"]
        elif s["tool"] == "prepare_documents" and s["ok"]:
            lines.append(f"Documents ready for your approval (application {r['application_id']})")
        elif s["tool"] == "check_replies":
            lines += [f"Reply: {u['company']} - now {u['status'].upper()}" for u in r.get("updates", [])]
    for a in (report["state"] or {}).get("needs_attention", []):
        lines.append(f"Needs attention: {a['company']} - {a['role']}")
    return lines