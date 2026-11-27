"""Workflow 4: discover jobs via Crustdata and store them as opportunities (same shape as email ones)."""
from datetime import date, datetime, timedelta

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.config import settings
from app.models.schemas import OpportunityData
from app.models.tables import CandidateProfile, Opportunity, User
from app.services.audit import audit
from app.services.llm import extract
from app.services.matching import profile_skills

URL = "https://api.crustdata.com/job/search"
FIELDS = ["crustdata_job_id", "job_details.title", "job_details.url", "company.basic_info.name",
          "content.description", "location.raw", "metadata.date_added"]
DEFAULT_ROLES = ["Backend Developer", "AI Engineer", "Full Stack Developer"]


def _transient(exc: BaseException) -> bool:
    if isinstance(exc, requests.HTTPError):
        code = exc.response.status_code if exc.response is not None else 0
        return code == 429 or code >= 500
    return isinstance(exc, (requests.ConnectionError, requests.Timeout))


@retry(retry=retry_if_exception(_transient), stop=stop_after_attempt(3),
       wait=wait_exponential(multiplier=2, min=2, max=10), reraise=True)
def search_jobs(role: str, location: str | None, days: int, limit: int) -> list[dict]:
    conds = [
        {"field": "job_details.title", "type": "(.)", "value": role},
        {"field": "metadata.date_added", "type": "=>", "value": (date.today() - timedelta(days=days)).isoformat()},
    ]
    if location:
        conds.append({"field": "location.raw", "type": "(.)", "value": location})
    r = requests.post(
        URL,
        headers={"Authorization": f"Bearer {settings.CRUSTDATA_API_KEY}", "x-api-version": "2025-11-01"},
        json={"filters": {"op": "and", "conditions": conds}, "fields": FIELDS,
              "sorts": [{"field": "metadata.date_added", "order": "desc"}], "limit": limit},
        timeout=60,
    )
    r.raise_for_status()
    return r.json().get("job_listings") or []


def _get(d: dict, path: str):
    for k in path.split("."):
        d = (d or {}).get(k)
    return d


def discover(db: Session, user: User, roles: list[str] | None = None, location: str | None = None,
             days: int = 7, per_role: int = 10, max_extract: int = 10) -> dict:
    if not settings.CRUSTDATA_API_KEY:
        raise ValueError("CRUSTDATA_API_KEY not set")
    prow = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == user.id))
    skills = {s.lower() for s in profile_skills(prow.data)} if prow else set()
    roles = roles or DEFAULT_ROLES
    location = location or (prow.data.get("location") if prow else None)
    stats = {"found": 0, "duplicate": 0, "no_skill_overlap": 0, "saved": [], "errors": []}

    for role in roles:
        try:
            jobs = search_jobs(role, None, days, per_role)  # location is a soft preference, not a hard filter
        except Exception as exc:
            stats["errors"].append({"role": role, "error": str(exc)[:200]})
            continue
        for j in jobs:
            stats["found"] += 1
            src = f"crustdata:{j.get('crustdata_job_id')}"
            if db.scalar(select(Opportunity.id).where(Opportunity.user_id == user.id,
                                                      Opportunity.source_email_id == src)):
                stats["duplicate"] += 1
                continue
            desc = _get(j, "content.description") or ""
            # cheap pre-filter (free) before spending an LLM call
            if skills and not any(s in desc.lower() for s in skills):
                stats["no_skill_overlap"] += 1
                continue
            if len(stats["saved"]) >= max_extract:
                break
            title, company = _get(j, "job_details.title"), _get(j, "company.basic_info.name")
            link, loc = _get(j, "job_details.url"), _get(j, "location.raw")
            try:
                o = extract(OpportunityData,
                            f"Title: {title}\nCompany: {company}\nLocation: {loc}\n\n{desc[:6000]}",
                            "Extract the job details. Only extract what is written; use null if missing. deadline must be YYYY-MM-DD.")
                try:
                    deadline = date.fromisoformat(o.deadline) if o.deadline else None
                except ValueError:
                    deadline = None
                row = Opportunity(
                    user_id=user.id, source_email_id=src, company=company or o.company, role=title or o.role,
                    required_skills=o.required_skills, min_cgpa=o.min_cgpa, graduation_year=o.graduation_year,
                    experience_years=o.experience_years, location=loc or o.location,
                    compensation=o.compensation, apply_link=link or o.apply_link, deadline=deadline,
                    confidence={"low": o.low_confidence_fields, "source": "crustdata"},
                )
                db.add(row)
                db.commit()
                stats["saved"].append({"id": row.id, "company": row.company, "role": row.role})
            except Exception as exc:
                db.rollback()
                stats["errors"].append({"job": str(title)[:80], "error": str(exc)[:200]})
    audit(db, user.id, "discover_jobs", {"roles": roles, "days": days},
          {"found": stats["found"], "saved": len(stats["saved"]), "errors": len(stats["errors"])})
    db.commit()
    return stats
