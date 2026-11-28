"""Built-in scheduler. Runs inside the FastAPI process."""
import logging
import sys
import time

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.agent.orchestrator import report_lines, run_cycle
from app.config import settings
from app.models.db import SessionLocal
from app.models.tables import User
from app.services.notify import send_telegram, telegram_configured

log = logging.getLogger("applypilot.scheduler")

_sent: dict[tuple[int, str], float] = {}
DEDUPE_SECONDS = 24 * 3600


def fresh_lines(user_id: int, lines: list[str]) -> list[str]:
    """Drops lines already sent to this user in the last 24h."""
    now = time.time()
    for k in [k for k, t in _sent.items() if now - t > DEDUPE_SECONDS]:
        del _sent[k]
    out = []
    for line in lines:
        if (user_id, line) not in _sent:
            out.append(line)
            _sent[(user_id, line)] = now
    return out


def _user_ids(db) -> list[int]:
    wanted = [int(x) for x in settings.SCHEDULER_USER_IDS.replace(" ", "").split(",") if x.isdigit()]
    q = select(User.id).where(User.is_active.is_(True), User.google_refresh_token.is_not(None))
    if wanted:
        q = q.where(User.id.in_(wanted))
    return list(db.scalars(q))


def _notify(user_id: int, title: str, lines: list[str], multi: bool, email: str) -> None:
    lines = fresh_lines(user_id, lines)
    if not lines:
        return
    head = f"{title} ({email})" if multi else title
    send_telegram(head + "\n" + "\n".join(lines))


def _for_each_user(job: str, fn) -> None:
    with SessionLocal() as db:
        ids = _user_ids(db)
    for uid in ids:
        try:
            with SessionLocal() as db:
                user = db.get(User, uid)
                if user:
                    fn(db, user, len(ids) > 1)
        except Exception as exc:  # one user's failure must not stop the others
            log.exception("job %s failed for user %s: %s", job, uid, type(exc).__name__)


def agent_job() -> None:
    def run(db, user, multi):
        report = run_cycle(db, user, settings.SCHEDULER_AUTO_PREPARE)
        _notify(user.id, "ApplyPilot update", report_lines(report), multi, user.email)
    _for_each_user("agent", run)


def replies_job() -> None:
    from app.services.tracking import check_replies

    def run(db, user, multi):
        ups = check_replies(db, user)
        _notify(user.id, "Application updates",
                [f"{u['company']} - {u['role']}: now {u['status'].upper()} ({u['subject']})" for u in ups],
                multi, user.email)
    _for_each_user("replies", run)


def deadlines_job() -> None:
    from app.services.tracking import deadlines_soon

    def run(db, user, multi):
        items = deadlines_soon(db, user.id, settings.DEADLINE_DAYS)
        _notify(user.id, f"Deadlines in the next {settings.DEADLINE_DAYS} days",
                [f"{i['company']} - {i['role']}: due {i['deadline']} ({i['days_left']}d left, "
                 f"{i['score']}% match, {i['status']})" for i in items], multi, user.email)
    _for_each_user("deadlines", run)


def discovery_job() -> None:
    from app.services.discovery import discover
    from app.services.matching import run_matching

    def run(db, user, multi):
        discover(db, user, days=7)
        try:
            matched = run_matching(db, user.id)["matched"]
        except ValueError:
            matched = []
        _notify(user.id, "New discovered jobs",
                [f"{m['company'] or '?'} - {m['role'] or '?'}: {round(m['score'])}% ({m['category']})"
                 for m in matched if m["category"] != "unsuitable"], multi, user.email)
    _for_each_user("discovery", run)


JOBS = {"agent": agent_job, "replies": replies_job, "deadlines": deadlines_job, "discovery": discovery_job}
_scheduler: BackgroundScheduler | None = None


def start_scheduler() -> BackgroundScheduler | None:
    global _scheduler
    if not settings.SCHEDULER_ENABLED or _scheduler:
        return _scheduler
    if not telegram_configured():
        log.warning("SCHEDULER_ENABLED but Telegram is not configured: jobs will run, nothing will be sent")
    s = BackgroundScheduler(timezone=settings.SCHEDULER_TIMEZONE)
    common = dict(max_instances=1, coalesce=True, misfire_grace_time=300)
    s.add_job(agent_job, "interval", minutes=max(1, settings.AGENT_INTERVAL_MIN), id="agent", **common)
    s.add_job(replies_job, "interval", minutes=max(1, settings.REPLIES_INTERVAL_MIN), id="replies", **common)
    s.add_job(deadlines_job, "cron", hour=min(23, max(0, settings.DEADLINE_HOUR)), minute=0, id="deadlines", **common)
    if settings.DISCOVERY_ENABLED:
        s.add_job(discovery_job, "interval", hours=max(1, settings.DISCOVERY_INTERVAL_HOURS), id="discovery", **common)
    s.start()
    _scheduler = s
    log.info("Scheduler started: %s", [j.id for j in s.get_jobs()])
    return s


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


# python -m app.services.scheduler test | agent | replies | deadlines | discovery
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "test":
        print("sent" if send_telegram("ApplyPilot: Telegram is connected.") else "FAILED (check token and chat id)")
    elif cmd in JOBS:
        _sent.clear()
        JOBS[cmd]()
        print(f"{cmd} job finished")
    else:
        sys.exit("usage: python -m app.services.scheduler [test|agent|replies|deadlines|discovery]")