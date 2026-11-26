import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.db import get_db
from app.models.tables import User
from app.services.crypto import encrypt
from app.services.gmail import SCOPES, fetch_emails

os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")  # tolerate Google returning extra/fewer scopes
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")  # local http only; remove in prod

router = APIRouter(prefix="/auth", tags=["auth"])


def _flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        autogenerate_code_verifier=False,  # avoids "Missing code verifier" in callback
    )


@router.get("/google")
def google_login():
    url, _ = _flow().authorization_url(
        access_type="offline", prompt="consent", include_granted_scopes="true"
    )
    return RedirectResponse(url)


@router.get("/callback")
def callback(code: str, db: Session = Depends(get_db)):
    flow = _flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    svc = build("gmail", "v1", credentials=creds, cache_discovery=False)
    email = svc.users().getProfile(userId="me").execute()["emailAddress"]

    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(email=email)
        db.add(user)
    user.google_access_token = encrypt(creds.token)
    if creds.refresh_token:  # only sent on first consent
        user.google_refresh_token = encrypt(creds.refresh_token)
    db.commit()
    db.refresh(user)

    return RedirectResponse(f"{settings.FRONTEND_URL}/?user_id={user.id}")


@router.get("/test-emails/{user_id}")  # temporary: delete after testing
def test_emails(user_id: int, n: int = 20, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or not user.google_refresh_token:
        raise HTTPException(404, "User not connected")
    emails = fetch_emails(db, user, max_results=n)
    for e in emails:
        print(e["sender"], "|", e["subject"], "|", len(e["attachments"]), "attachments")
    return [{**e, "body": e["body"][:200]} for e in emails]