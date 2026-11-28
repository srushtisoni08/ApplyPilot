import re
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.schemas import CandidateProfileSchema, EmailCheck, OpportunityData
from app.models.tables import CandidateProfile, Document, Opportunity, User
from app.services.gmail import fetch_emails
from app.services.llm import extract
from app.services.olostep import find_job_link, scrape_page

KEYWORDS = re.compile(
    r"\b(apply|applications?|hiring|deadline|internships?|cgpa|eligib\w*|openings?|vacanc\w*|recruit\w*|job|position)\b",
    re.I,
)

REPLY_SUBJECT = re.compile(
    r"interview (invitation|scheduled|confirmation)|application (received|status|update)|not (been )?selected|unfortunately|regret to",
    re.I,
)

MAX_ERRORS = 3  # stop a run early if the LLM keeps failing (e.g. rate limit)


def _needs_confirmation(p: CandidateProfileSchema) -> list[str]:
    n = []
    if not p.name: n.append("name")
    if p.cgpa is None: n.append("cgpa")
    if p.grad_year is None: n.append("grad_year")
    if not p.skills: n.append("skills")
    n += [f for f in p.low_confidence_fields if f not in n]
    return n


def build_profile(db: Session, user_id: int, doc_ids: list[int] | None) -> CandidateProfile:
    q = select(Document).where(Document.user_id == user_id).order_by(Document.id)
    if doc_ids:
        q = q.where(Document.id.in_(doc_ids))
    docs = db.scalars(q).all()
    if not docs:
        raise ValueError("No documents found")
    text = "\n\n".join(f"--- {d.filename} ---\n{d.extracted_text or ''}" for d in docs)
    p = extract(CandidateProfileSchema, text, "Extract the candidate profile from these documents.")

    row = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == user_id))
    if not row:
        row = CandidateProfile(user_id=user_id)
        db.add(row)
    row.data = p.model_dump()
    row.needs_confirmation = _needs_confirmation(p)
    row.confirmed = False
    db.commit()
    db.refresh(row)
    return row


def process_emails(db: Session, user: User, n: int = 20, since=None) -> dict:
    stats = {
        "fetched": 0, "already_done": 0, "keyword_skip": 0,
        "not_opportunity": 0, "enriched": 0, "scrape_failed": 0,
        "saved": [], "errors": [], "stopped_early": False,
    }
    for e in fetch_emails(db, user, since=since, max_results=n):
        stats["fetched"] += 1
        if db.scalar(select(Opportunity.id).where(
            Opportunity.user_id == user.id, Opportunity.source_email_id == e["id"]
        )):
            stats["already_done"] += 1
            continue

        text = f"Subject: {e['subject']}\nFrom: {e['sender']}\n\n{e['body']}"
        if REPLY_SUBJECT.search(e["subject"] or ""):        # replies to applications are not new jobs
            stats["not_opportunity"] += 1
            continue
        if not KEYWORDS.search(text):                       # layer 1: free
            stats["keyword_skip"] += 1
            continue

        try:
            check = extract(EmailCheck, text, "Is this email a job/internship opportunity for a candidate? Answer is_opportunity and a short reason.")
            if not check.is_opportunity:                    # layer 2: LLM
                stats["not_opportunity"] += 1
                continue

            o = extract(OpportunityData, text, "Extract the job/internship opportunity details. deadline must be YYYY-MM-DD.")
            link = find_job_link(text)
            if link and not (o.role and o.required_skills):  # thin email: read the linked page
                try:
                    page = scrape_page(link)
                    if page:
                        o = extract(
                            OpportunityData,
                            f"{text[:3000]}\n\n--- LINKED PAGE ({link}) ---\n{page}",
                            "Extract the job/internship opportunity details from the email and its linked page. "
                            "deadline must be YYYY-MM-DD.",
                        )
                        if not o.apply_link:
                            o.apply_link = link
                        stats["enriched"] += 1
                except Exception:  # Olostep down or out of credits: keep the email-only result
                    stats["scrape_failed"] += 1
            if not o.company and not o.role:  # job-alert digest, not one real opportunity
                stats["not_opportunity"] += 1
                continue
            try:
                deadline = date.fromisoformat(o.deadline) if o.deadline else None
            except ValueError:
                deadline = None
            row = Opportunity(
                user_id=user.id, source_email_id=e["id"], company=o.company, role=o.role,
                required_skills=o.required_skills, min_cgpa=o.min_cgpa,
                graduation_year=o.graduation_year, experience_years=o.experience_years,
                location=o.location, compensation=o.compensation, apply_link=o.apply_link,
                deadline=deadline, confidence={"low": o.low_confidence_fields},
            )
            db.add(row)
            db.commit()
            stats["saved"].append({"id": row.id, "company": o.company, "role": o.role})
        except Exception as exc:                            # keep what was saved so far
            db.rollback()
            stats["errors"].append({"subject": e["subject"][:80], "error": str(exc)[:200]})
            if len(stats["errors"]) >= MAX_ERRORS:
                stats["stopped_early"] = True
                break
    return stats