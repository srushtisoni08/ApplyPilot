import random
import string
from datetime import date, timedelta
from html import escape

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.models.tables import Opportunity, User
from app.services.matching import run_matching
from app.security import get_current_user, require_owner

router = APIRouter(prefix="/dummy", tags=["dummy"])

APPLY_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>Demo Corp - Apply</title>
<style>body{font-family:system-ui;max-width:640px;margin:2rem auto;padding:0 1rem}label{display:block;margin-top:1rem;font-weight:600}input,select,textarea{width:100%;padding:.5rem;margin-top:.25rem;box-sizing:border-box}button{margin-top:1.5rem;padding:.7rem 1.5rem}</style></head><body>
<h1>Software Engineer Intern - Demo Corp</h1>
<form action="/dummy/submit" method="post" enctype="multipart/form-data">
<label for="fullname">Full Name *</label><input id="fullname" name="fullname" required>
<label for="email">Email *</label><input id="email" name="email" type="email" required>
<label for="phone">Phone *</label><input id="phone" name="phone" type="tel" required>
<label for="qualification">Highest qualification *</label>
<select id="qualification" name="qualification" required><option value="">Select</option><option>Diploma</option><option>B.E. / B.Tech</option><option>M.E. / M.Tech</option><option>Other</option></select>
<label for="cgpa">CGPA *</label><input id="cgpa" name="cgpa" type="number" step="0.01" required>
<label for="gradyear">Graduation year *</label><input id="gradyear" name="gradyear" type="number" required>
<label for="skills">Key skills</label><input id="skills" name="skills">
<label for="salary">Expected salary (optional)</label><input id="salary" name="salary">
<label for="resume">Resume (PDF) *</label><input id="resume" name="resume" type="file" accept=".pdf" required>
<label for="cover">Cover letter *</label><textarea id="cover" name="cover" rows="8" required></textarea>
<button type="submit">Submit application</button>
</form></body></html>"""


@router.get("/apply", response_class=HTMLResponse)
def apply_page():
    return APPLY_HTML


@router.post("/submit", response_class=HTMLResponse)
async def submit(
    fullname: str = Form(...), email: str = Form(...), phone: str = Form(...),
    qualification: str = Form(...), cgpa: float = Form(...), gradyear: int = Form(...),
    cover: str = Form(...), resume: UploadFile = File(...),
    skills: str = Form(""), salary: str = Form(""),
):
    ref = "AP-" + "".join(random.choices(string.digits, k=6))
    return (f"<!doctype html><body style='font-family:system-ui;max-width:640px;margin:2rem auto'>"
            f"<h1>Application submitted</h1><p>Thank you, {escape(fullname)}.</p>"
            f"<p>Reference number: <b>{ref}</b></p></body>")


@router.post("/create-opportunity/{user_id}")
def create_opportunity(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Adds a Demo Corp opportunity that points at the dummy form, and scores it."""
    require_owner(user_id, current_user)
    o = Opportunity(
        user_id=current_user.id, source_email_id=f"dummy-{random.randint(1000, 9999)}",
        company="Demo Corp", role="Software Engineer Intern",
        required_skills=["Python", "FastAPI", "React", "SQL"],
        apply_link="http://localhost:8000/dummy/apply",
        deadline=date.today() + timedelta(days=30), confidence={"low": []},
    )
    db.add(o)
    db.commit()
    return {"opportunity_id": o.id, "matching": run_matching(db, current_user.id)}