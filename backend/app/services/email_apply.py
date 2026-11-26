import re

from app.models.tables import Application, Opportunity
from app.services.apply_target import classify_apply_target
from app.services.writer import OUT_DIR


def _one_line(text, limit: int = 150) -> str:
    return re.sub(r"\s+", " ", text or "").strip()[:limit]


def prepare_email(app: Application, opp: Opportunity, profile: dict) -> dict:
    """Builds the application email from what the user already approved:
    the cover letter as the body and the resume PDF as the attachment. Nothing is sent here."""
    target = classify_apply_target(opp.apply_link)
    if target["method"] != "email":
        raise ValueError("This opportunity does not apply by email.")
    pdf = OUT_DIR / f"{app.resume_file}.pdf"
    if not app.resume_file or not pdf.exists():
        raise FileNotFoundError("Resume PDF not found. Click Prepare application again.")
    body = (app.cover_letter or "").strip()
    if not body:
        raise ValueError("No cover letter yet. Click Prepare application again.")

    name = _one_line(profile.get("name")) or "Candidate"
    role = _one_line(opp.role) or "the open position"
    safe_name = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_") or "Candidate"
    return {
        "to": target["target"],
        "subject": f"Application for {role} - {name}",
        "body": body,
        "attachment": f"{safe_name}_Resume.pdf",
    }