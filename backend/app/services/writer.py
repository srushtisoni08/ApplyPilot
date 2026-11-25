import json
import re
from xml.sax.saxutils import escape

from docx import Document as Docx
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate

from app.config import BACKEND_DIR
from app.models.schemas import CoverLetter, FactCheck, Selection
from app.models.tables import Opportunity
from app.services.llm import extract

OUT_DIR = BACKEND_DIR / "generated"
OUT_DIR.mkdir(exist_ok=True)
NUM = re.compile(r"\d+(?:\.\d+)?")


def _proj_line(p: dict) -> str:
    return f"{p.get('name') or ''} - {', '.join(p.get('tech') or [])}"


def _exp_line(e: dict) -> str:
    return f"{e.get('role') or ''} at {e.get('company') or ''}"


def _numbered(items: list, fmt) -> str:
    return "\n".join(f"{i}: {fmt(x)}" for i, x in enumerate(items)) or "(none)"


def _pick(items: list, idx: list[int], limit: int) -> list:
    out, seen = [], set()
    for i in idx:
        if isinstance(i, int) and 0 <= i < len(items) and i not in seen:
            seen.add(i)
            out.append(items[i])
    return out[:limit]


# ---------- 1. SELECT (never write) ----------
def select_items(profile: dict, opp: Opportunity) -> dict:
    skills = profile.get("skills") or []
    projects = profile.get("projects") or []
    exps = profile.get("experience") or []
    text = (
        f"JOB: {opp.role} at {opp.company}. Required skills: {', '.join(opp.required_skills or [])}\n\n"
        f"SKILLS:\n{_numbered(skills, str)}\n\n"
        f"PROJECTS:\n{_numbered(projects, _proj_line)}\n\n"
        f"EXPERIENCE:\n{_numbered(exps, _exp_line)}"
    )
    sel = extract(
        Selection, text,
        "Select the items that best fit the job. Return only indices that exist in the lists. "
        "At most 12 skills, 3 projects, 3 experiences.",
    )
    return {
        **{k: profile.get(k) for k in ("name", "email", "phone", "location", "cgpa", "grad_year")},
        "education": profile.get("education") or [],
        "certificates": profile.get("certificates") or [],
        "skills": _pick(skills, sel.skill_indices, 12) or skills[:12],
        "projects": _pick(projects, sel.project_indices, 3) or projects[:2],
        "experience": _pick(exps, sel.experience_indices, 3) or exps[:3],
    }


# ---------- 2. RESUME ----------
def build_blocks(s: dict) -> list[tuple[str, str]]:
    b = [("name", s.get("name") or "")]
    contact = " | ".join(x for x in [s.get("email"), s.get("phone"), s.get("location")] if x)
    b.append(("contact", contact))
    if s["education"]:
        b.append(("h", "Education"))
        for e in s["education"]:
            b.append(("sub", ", ".join(x for x in [e.get("degree"), e.get("field"), e.get("institution")] if x)))
            years = "-".join(str(y) for y in [e.get("start_year"), e.get("end_year")] if y)
            cg = f"CGPA {e['cgpa']}" if e.get("cgpa") else ""
            b.append(("p", " | ".join(x for x in [years, cg] if x)))
    if s["skills"]:
        b += [("h", "Skills"), ("p", ", ".join(s["skills"]))]
    if s["experience"]:
        b.append(("h", "Experience"))
        for e in s["experience"]:
            b += [("sub", _exp_line(e)), ("p", e.get("duration") or ""), ("p", e.get("description") or "")]
    if s["projects"]:
        b.append(("h", "Projects"))
        for p in s["projects"]:
            tech = f" ({', '.join(p['tech'])})" if p.get("tech") else ""
            b += [("sub", (p.get("name") or "") + tech), ("p", p.get("description") or "")]
    if s["certificates"]:
        b.append(("h", "Certificates"))
        b += [("b", c) for c in s["certificates"]]
    return b


def render_docx(blocks, path) -> None:
    d = Docx()
    for kind, text in blocks:
        if not text:
            continue
        if kind == "name":
            d.add_heading(text, 0)
        elif kind == "h":
            d.add_heading(text, 2)
        elif kind == "sub":
            d.add_paragraph().add_run(text).bold = True
        elif kind == "b":
            d.add_paragraph(text, style="List Bullet")
        else:
            d.add_paragraph(text)
    d.save(path)


def render_pdf(blocks, path) -> None:
    ss = getSampleStyleSheet()
    st = {
        "name": ParagraphStyle("n", parent=ss["Title"], fontSize=20, alignment=0),
        "contact": ss["Normal"],
        "h": ParagraphStyle("h", parent=ss["Heading3"], spaceBefore=10),
        "sub": ParagraphStyle("s", parent=ss["Normal"], fontName="Helvetica-Bold"),
        "b": ParagraphStyle("b", parent=ss["Normal"], leftIndent=12),
        "p": ss["Normal"],
    }
    story = [
        Paragraph(("• " if k == "b" else "") + escape(t), st[k])
        for k, t in blocks if t
    ]
    SimpleDocTemplate(str(path), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                      topMargin=1.8 * cm, bottomMargin=1.8 * cm).build(story)


# ---------- 3. COVER LETTER + FACT CHECK ----------
def _facts(selected: dict, opp: Opportunity) -> str:
    return json.dumps({
        "candidate": selected,
        "job": {"company": opp.company, "role": opp.role,
                "required_skills": opp.required_skills, "location": opp.location},
    }, default=str, ensure_ascii=False)


def write_cover_letter(selected: dict, opp: Opportunity, feedback: str = "") -> str:
    task = (
        "Write a cover letter for this candidate applying to this job. Use ONLY facts in the document: "
        "no invented employers, projects, skills, numbers or achievements. Mention at most 2 projects. "
        "3 short paragraphs, under 220 words, plain text, no placeholders. Start with 'Dear Hiring Team,' "
        f"and end with 'Sincerely,' then the candidate's name."
    )
    if feedback:
        task += f" The previous draft had unsupported claims, remove them: {feedback}"
    return extract(CoverLetter, _facts(selected, opp), task).body.strip()


def check_letter(letter: str, selected: dict, opp: Opportunity) -> list[str]:
    facts = _facts(selected, opp)
    issues = [f"number not in profile: {n}" for n in sorted({n for n in NUM.findall(letter) if n not in facts})]
    fc = extract(
        FactCheck, f"FACTS:\n{facts}\n\nLETTER:\n{letter}",
        "List every claim in LETTER (employer, project, skill, number, achievement) that is NOT "
        "supported by FACTS. Return an empty list if all claims are supported.",
    )
    return issues + fc.unsupported_claims


# ---------- Orchestrator ----------
def generate(app_id: int, profile: dict, opp: Opportunity) -> dict:
    sel = select_items(profile, opp)
    letter = write_cover_letter(sel, opp)
    issues = check_letter(letter, sel, opp)
    if issues:  # one regeneration attempt
        letter = write_cover_letter(sel, opp, "; ".join(issues))
        issues = check_letter(letter, sel, opp)

    blocks = build_blocks(sel)
    base = OUT_DIR / f"app_{app_id}"
    render_docx(blocks, base.with_suffix(".docx"))
    render_pdf(blocks, base.with_suffix(".pdf"))
    return {
        "letter": letter,
        "issues": issues,
        "file": base.name,
        "selected": {
            "skills": sel["skills"],
            "projects": [p.get("name") for p in sel["projects"]],
            "experience": [_exp_line(e) for e in sel["experience"]],
        },
    }