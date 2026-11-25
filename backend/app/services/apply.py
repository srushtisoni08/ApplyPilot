import json
import re

from app.models.schemas import FormMapping
from app.models.tables import Application, Opportunity
from app.services.browser import run_worker
from app.services.llm import extract
from app.services.writer import OUT_DIR

SOURCES = {"name", "email", "phone", "location", "cgpa", "grad_year", "degree",
           "institution", "field_of_study", "skills", "cover_letter", "resume"}
CONFIRM = re.compile(r"submitted|thank you|received|success", re.I)
REF = re.compile(r"(?:reference|ref)(?:\s*(?:no\.?|number|id))?\s*[:#]?\s*([A-Z0-9-]*\d[A-Z0-9-]*)", re.I)


def _value(source: str, profile: dict, cover_letter: str | None):
    edu = (profile.get("education") or [{}])[0] or {}
    return {
        "name": profile.get("name"), "email": profile.get("email"), "phone": profile.get("phone"),
        "location": profile.get("location"), "cgpa": profile.get("cgpa"), "grad_year": profile.get("grad_year"),
        "degree": edu.get("degree"), "institution": edu.get("institution"),
        "field_of_study": edu.get("field"),
        "skills": ", ".join(profile.get("skills") or []) or None,
        "cover_letter": cover_letter,
    }.get(source)


def build_plan(fields: list[dict], profile: dict, cover_letter: str | None, resume_path: str):
    edu = (profile.get("education") or [{}])[0] or {}
    doc = json.dumps({
        "fields": fields,
        "candidate": {"degree": edu.get("degree"), "field_of_study": edu.get("field"),
                      "grad_year": profile.get("grad_year"), "cgpa": profile.get("cgpa")},
    })
    mapping = extract(
        FormMapping, doc,
        "For each form field choose which profile source fills it. Sources: name, email, phone, location, "
        "cgpa, grad_year, degree, institution, field_of_study, skills, cover_letter, resume (file upload "
        "for the resume), none (no matching source). For select fields also return option: the exact "
        "option text that best matches the candidate data, chosen only from that field's options, else null. "
        "Use none when unsure. Never guess.",
    )
    by_key = {m.key: m for m in mapping.fields}
    plan, missing = [], []
    for f in fields:
        m = by_key.get(f["key"])
        src = m.source if m and m.source in SOURCES else "none"
        kind = "select" if f["tag"] == "select" else "file" if f["type"] == "file" else "text"
        value = None
        if f["type"] in ("radio", "checkbox") or src == "none":
            value = None
        elif kind == "file":
            value = resume_path if src == "resume" else None
        elif kind == "select":
            value = m.option if m.option in f["options"] else None
        elif src != "resume":
            value = _value(src, profile, cover_letter)
        if value in (None, ""):
            if f["required"]:
                missing.append(f["label"] or f["key"])
            continue  # optional + unknown: leave empty
        plan.append({"key": f["key"], "label": f["label"], "kind": kind, "value": str(value)})
    return plan, missing


def fill_application(app: Application, opp: Opportunity, profile: dict, watch: bool = False) -> dict:
    resume = str(OUT_DIR / f"{app.resume_file}.pdf")
    read = run_worker({"mode": "read", "url": opp.apply_link, "watch": watch})
    if read["blocked"]:
        return {"status": "needs_attention", "reason": f"{read['blocked']} detected, please apply manually"}
    plan, missing = build_plan(read["fields"], profile, app.cover_letter, resume)
    if missing:
        return {"status": "needs_attention", "reason": "No data for required fields", "missing": missing}
    run_worker({"mode": "fill", "url": opp.apply_link, "plan": plan, "watch": watch,
                "shot": str(OUT_DIR / f"app_{app.id}_filled.png")})
    return {"status": "filled", "plan": plan}


def submit_application(app: Application, opp: Opportunity, plan: list[dict]) -> dict:
    res = run_worker({"mode": "submit", "url": opp.apply_link, "plan": plan,
                      "shot_after": str(OUT_DIR / f"app_{app.id}_done.png")})
    text = res.get("text", "")
    m = REF.search(text)
    return {"verified": bool(CONFIRM.search(text)), "reference": m.group(1) if m else None}