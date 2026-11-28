from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.tables import CandidateProfile, Match, Opportunity, SkillEmbedding
from app.services.embeddings import embed

SIM_FULL = 0.82      # >= counts as a full match
SIM_PARTIAL = 0.70   # >= counts as half a match (e.g. React vs Vue)
SUITABLE_AT = 60     # score >= 60 -> suitable
UNSUITABLE_BELOW = 30


def _dedupe(items: list[str]) -> list[str]:
    seen, out = set(), []
    for s in items:
        s = (s or "").strip()
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out


def profile_skills(profile: dict) -> list[str]:
    skills = list(profile.get("skills") or [])
    for p in profile.get("projects") or []:
        skills += p.get("tech") or []
    return _dedupe(skills)


# ---------- Part A: hard rules (no AI) ----------
def check_eligibility(profile: dict, opp: Opportunity) -> tuple[list[str], list[str]]:
    """Returns (failed_reasons, missing_profile_fields)."""
    fails, missing = [], []
    cgpa, gy = profile.get("cgpa"), profile.get("grad_year")

    if opp.min_cgpa is not None:
        if cgpa is None:
            missing.append("cgpa")
        elif cgpa < opp.min_cgpa:
            fails.append(f"CGPA {cgpa} is below required {opp.min_cgpa}")

    if opp.graduation_year:
        if gy is None:
            missing.append("grad_year")
        elif gy not in opp.graduation_year:
            fails.append(f"Graduation year {gy} not in {opp.graduation_year}")

    if opp.deadline and opp.deadline < date.today():
        fails.append(f"Deadline passed ({opp.deadline})")
    return fails, missing


# ---------- Part B: skill matching (embeddings + pgvector) ----------
def _sync_embeddings(db: Session, owner_type: str, owner_id: int, skills: list[str]) -> None:
    db.execute(delete(SkillEmbedding).where(
        SkillEmbedding.owner_type == owner_type, SkillEmbedding.owner_id == owner_id))
    if skills:
        for s, v in zip(skills, embed(skills)):
            db.add(SkillEmbedding(owner_type=owner_type, owner_id=owner_id, skill=s, embedding=v))
    db.flush()


def skill_match(db: Session, user_id: int, opp: Opportunity) -> dict:
    req = _dedupe(opp.required_skills or [])
    _sync_embeddings(db, "opportunity", opp.id, req)
    rows = db.scalars(select(SkillEmbedding).where(
        SkillEmbedding.owner_type == "opportunity", SkillEmbedding.owner_id == opp.id)).all()

    matched, partial, missing = [], [], []
    for r in rows:
        dist = SkillEmbedding.embedding.cosine_distance(r.embedding)
        best = db.execute(
            select(SkillEmbedding.skill, dist.label("d"))
            .where(SkillEmbedding.owner_type == "profile", SkillEmbedding.owner_id == user_id)
            .order_by(dist).limit(1)
        ).first()
        sim = 1 - best.d if best else 0
        if sim >= SIM_FULL:
            matched.append(r.skill)
        elif sim >= SIM_PARTIAL:
            partial.append(f"{r.skill} (~{best.skill})")
        else:
            missing.append(r.skill)

    score = round(100 * (len(matched) + 0.5 * len(partial)) / len(req), 1) if req else None
    return {"total": len(req), "matched": matched, "partial": partial,
            "missing": missing, "score": score}


# ---------- Combine ----------
def match_opportunity(db: Session, user_id: int, profile: dict, opp: Opportunity) -> dict:
    fails, missing_fields = check_eligibility(profile, opp)

    if fails:  # hard rule failed -> skip embeddings entirely
        return {"score": 0.0, "category": "unsuitable", "explanation": "; ".join(fails)}

    sk = skill_match(db, user_id, opp)
    parts = []
    if sk["score"] is None:
        parts.append("No required skills listed in the email.")
    else:
        parts.append(f"You match {len(sk['matched'])} of {sk['total']} skills.")
        if sk["partial"]:
            parts.append("Partial: " + ", ".join(sk["partial"]) + ".")
        if sk["missing"]:
            parts.append("Missing: " + ", ".join(sk["missing"]) + ".")
    if missing_fields:
        parts.append("Cannot verify (missing in your profile): " + ", ".join(missing_fields) + ".")

    if sk["score"] is None or missing_fields:
        category = "uncertain"
    elif sk["score"] >= SUITABLE_AT:
        category = "suitable"
    elif sk["score"] >= UNSUITABLE_BELOW:
        category = "uncertain"
    else:
        category = "unsuitable"
    return {"score": sk["score"] or 0.0, "category": category, "explanation": " ".join(parts)}


def run_matching(db: Session, user_id: int, force: bool = False) -> dict:
    prow = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == user_id))
    if not prow:
        raise ValueError("Build the profile first")
    profile = prow.data

    opps = db.scalars(select(Opportunity).where(Opportunity.user_id == user_id)).all()
    opp_ids = [o.id for o in opps]
    done = set(db.scalars(select(Match.opportunity_id).where(Match.opportunity_id.in_(opp_ids))).all())
    todo = [o for o in opps if force or o.id not in done]
    out = {"profile_confirmed": prow.confirmed, "matched": [], "errors": []}
    if not todo:
        return out

    _sync_embeddings(db, "profile", user_id, profile_skills(profile))
    db.commit()

    for o in todo:
        try:
            r = match_opportunity(db, user_id, profile, o)
            m = db.scalar(select(Match).where(Match.opportunity_id == o.id))
            if not m:
                m = Match(opportunity_id=o.id)
                db.add(m)
            m.score, m.category, m.explanation = r["score"], r["category"], r["explanation"]
            db.commit()
            out["matched"].append({"opportunity_id": o.id, "company": o.company, "role": o.role, **r})
        except Exception as exc:
            db.rollback()
            out["errors"].append({"opportunity_id": o.id, "error": str(exc)[:200]})
    return out