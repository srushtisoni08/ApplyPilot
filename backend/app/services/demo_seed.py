"""Sends demo emails into the connected Gmail inbox (from the user's own account to itself).

python -m app.services.demo_seed <user_id>        (sends the demo emails)
python -m app.services.demo_seed <user_id> fix    (recreates Demo Corp so it is Suitable for you)
Then: scan inbox in the dashboard (or run the agent). Expected: 2 emails filtered out, 3 opportunities.
"""
import sys
import time
from datetime import date, timedelta

from app.models.db import SessionLocal
from app.models.tables import User
from app.services.gmail import send_email

D = lambda n: (date.today() + timedelta(days=n)).isoformat()

EMAILS = [
    # 1. pure newsletter: dropped by the free keyword filter
    ("Weekly Tech Digest #212",
     "This week: new Python release notes, a deep dive on database indexes, and a podcast on cloud costs.\n"
     "Read online. Unsubscribe anytime."),
    # 2. has keywords but is not an opportunity: dropped by the LLM check
    ("5 tips to prepare for interviews",
     "Our career blog shares 5 tips on resumes and how to prepare when companies are hiring.\n"
     "No openings are listed in this article."),
    # 3. SUITABLE: matches a Python/FastAPI/React profile, links to the local dummy form
    ("Hiring: Software Engineer Intern at Demo Corp",
     "Demo Corp is hiring a Software Engineer Intern.\n"
     "Skills: Python, FastAPI, React, SQL.\n"
     "Eligibility: CGPA 7.0 or above, 2027 graduates.\n"
     f"Location: Remote. Stipend: INR 25,000 per month. Deadline: {D(14)}.\n"
     "Apply here: http://localhost:8000/dummy/apply"),
    # 4. UNSUITABLE (hard rule fails): CGPA 9.9 and 2020 batch
    ("Applications open: Research Engineer at Orbit Labs",
     "Orbit Labs is hiring a Research Engineer.\n"
     "Skills: C++, CUDA, Linear Algebra.\n"
     "Eligibility: minimum CGPA 9.9, 2020 graduates only.\n"
     f"Deadline: {D(10)}. Apply: https://example.com/orbit-careers"),
    # 5. UNCERTAIN: partial skill overlap (tune the skills if your profile scores it differently)
    ("Job opening: Backend Developer at Nimbus Cloud",
     "Nimbus Cloud is hiring a Backend Developer.\n"
     "Skills: Java, Spring Boot, Kubernetes, AWS, Python.\n"
     f"Location: Bengaluru. Deadline: {D(20)}. Apply: https://example.com/nimbus-careers"),
]

REPLY = """
Reply email for the 'Interview' step (send it from a DIFFERENT Gmail account to your demo inbox,
after the Demo Corp application shows as submitted):

  Subject: Interview invitation - Software Engineer Intern at Demo Corp
  Body:    Hi, thank you for applying to Demo Corp. We would like to invite you to an interview
           on Monday at 11 AM. Please confirm your availability.

(It must come from another account: emails from your own address are ignored on purpose.)
Then run:  python -m app.services.scheduler replies
"""

def fix_demo_corp(db, user) -> None:
    """Replaces old Demo Corp rows with one that points to the local dummy form and has no batch limit."""
    from sqlalchemy import delete
    from app.models.tables import Opportunity
    from app.services.matching import run_matching
    db.execute(delete(Opportunity).where(Opportunity.user_id == user.id, Opportunity.company == "Demo Corp"))
    o = Opportunity(user_id=user.id, source_email_id=f"demo-{int(time.time())}", company="Demo Corp",
                    role="Software Engineer Intern", required_skills=["Python", "FastAPI", "React", "SQL"],
                    apply_link="http://localhost:8000/dummy/apply", deadline=date.today() + timedelta(days=30),
                    confidence={"low": []})
    db.add(o)
    db.commit()
    r = run_matching(db, user.id)["matched"]
    print("Demo Corp:", [(m["category"], round(m["score"])) for m in r if m["company"] == "Demo Corp"])


if __name__ == "__main__":
    if len(sys.argv) < 2 or not sys.argv[1].isdigit():
        sys.exit("usage: python -m app.services.demo_seed <user_id> [fix]")
    with SessionLocal() as db:
        user = db.get(User, int(sys.argv[1]))
        if not user or not user.google_refresh_token:
            sys.exit("User not found or Gmail not connected")
        if len(sys.argv) > 2 and sys.argv[2] == "fix":
            fix_demo_corp(db, user)
            sys.exit(0)
        for subject, body in EMAILS:
            send_email(db, user, user.email, subject, body)
            print("sent:", subject)
            time.sleep(1)
    print(REPLY)
