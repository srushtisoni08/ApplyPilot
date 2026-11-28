# ApplyPilot

AI agent that reads your Gmail, finds job/internship emails, scores them against your profile, drafts a tailored resume and cover letter, fills the application form, and submits **only after you approve**.

## Pipeline
Reader (Gmail, OCR, Olostep) → Understander (LLM extraction) → Judge (hard rules + embeddings) → Writer (grounded resume/cover letter) → Doer (Playwright, approval gates). Discovery via Crustdata. Scheduler + Telegram alerts.

## Setup
Requirements: Python 3.11+, Node 18+, Tesseract OCR, a Postgres with pgvector (Neon), an S3-compatible bucket.

```
cp .env.example .env.local        # fill it in
cd backend
python -m venv venv && venv\Scripts\activate      # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
alembic upgrade head
uvicorn app.main:app --reload

cd ../frontend
npm install && npm run dev        # http://localhost:5173
```
Google Cloud: enable Gmail API, create OAuth credentials, redirect URI `http://localhost:8000/auth/callback`, add teammates as test users. Scopes: gmail.readonly + gmail.send (send is used only for approved email applications).

## Background automation
Set in `.env.local`: `SCHEDULER_ENABLED=true`, `SCHEDULER_USER_IDS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (and `DISCOVERY_ENABLED=true`). Test:
```
python -m app.services.scheduler test | agent | replies | deadlines | discovery
```

## Demo
```
python -m app.services.demo_seed <user_id>
```
Sends 2 filtered emails + 3 opportunities (suitable / unsuitable / uncertain) to the connected inbox. The Demo Corp job links to `/dummy/apply`, a local form safe for live submit. Reply-tracking step: send an interview email naming "Demo Corp" from a second account.

## Safety
- No submit/send tool exists for the agent; submitting needs an approval record (`agent/permissions.py`).
- Idempotency key per application; every tool call is written to `audit_logs`.
- Tokens encrypted; resume text is never logged; resume/cover letter claims are checked against the profile.
- Real sites: use fill-only mode (CAPTCHAs/logins stop and ask you).
