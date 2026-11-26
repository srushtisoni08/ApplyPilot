import os
import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models.db import get_db
from app.models.tables import User
from app.security import (
    SESSION_COOKIE,
    OAUTH_STATE_COOKIE,
    _check_origin,
    clear_session_cookie,
    get_current_user,
    hash_password,
    oauth_state,
    require_owner,
    session_user_id,
    secure_cookie,
    set_session_cookie,
    verify_oauth_state,
    verify_password,
)
from app.services.crypto import encrypt
from app.services.gmail import SCOPES, fetch_emails

os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")
if settings.GOOGLE_REDIRECT_URI.startswith(("http://localhost:", "http://127.0.0.1:")):
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
else:
    os.environ.pop("OAUTHLIB_INSECURE_TRANSPORT", None)

router = APIRouter(prefix="/auth", tags=["auth"])
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterBody(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UpdateProfileBody(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)


class PasswordBody(BaseModel):
    current_password: str | None = Field(default=None, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


def _public_user(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "gmail_email": user.gmail_email,
        "gmail_connected": bool(user.google_refresh_token),
    }


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
        autogenerate_code_verifier=False,
    )


@router.post("/register", status_code=201)
def register(body: RegisterBody, request: Request, response: Response, db: Session = Depends(get_db)):
    _check_origin(request)
    email = body.email.strip().lower()
    full_name = body.full_name.strip()
    if not EMAIL_PATTERN.fullmatch(email):
        raise HTTPException(422, "Enter a valid email address")
    if not full_name:
        raise HTTPException(422, "Full name is required")
    existing = db.scalar(select(User).where(func.lower(User.email) == email))
    if existing:
        raise HTTPException(409, "An account with this email already exists. Please log in.")
    user = User(email=email, full_name=full_name, password_hash=hash_password(body.password), is_active=True)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists. Please log in.") from exc
    db.refresh(user)
    set_session_cookie(response, user.id)
    return _public_user(user)


@router.post("/login")
def login(body: LoginBody, request: Request, response: Response, db: Session = Depends(get_db)):
    _check_origin(request)
    email = body.email.strip().lower()
    if not EMAIL_PATTERN.fullmatch(email):
        raise HTTPException(422, "Enter a valid email address")
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Email or password is incorrect")
    set_session_cookie(response, user.id)
    return _public_user(user)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return _public_user(user)


@router.patch("/me")
def update_me(body: UpdateProfileBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    full_name = body.full_name.strip()
    if not full_name:
        raise HTTPException(422, "Full name is required")
    user.full_name = full_name
    db.commit()
    return _public_user(user)


@router.post("/password")
def update_password(body: PasswordBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.password_hash and not verify_password(body.current_password or "", user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"updated": True}


@router.post("/logout", dependencies=[Depends(get_current_user)])
def logout(response: Response):
    clear_session_cookie(response)
    return {"logged_out": True}


@router.get("/gmail-status")
def gmail_status(user: User = Depends(get_current_user)):
    return {"connected": bool(user.google_refresh_token), "email": user.gmail_email}


@router.get("/google")
def google_login(request: Request, db: Session = Depends(get_db)):
    cookie = request.cookies.get(SESSION_COOKIE)
    user_id = session_user_id(cookie)
    if user_id:
        user = db.get(User, user_id)
        if not user or not user.is_active:
            raise HTTPException(401, "Please log in to continue")
    state = oauth_state(user_id)
    url, _ = _flow().authorization_url(
        state=state, access_type="offline", prompt="consent", include_granted_scopes="true"
    )
    response = RedirectResponse(url)
    response.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=secure_cookie(),
        samesite="lax",
        path="/auth",
    )
    return response


@router.get("/callback")
def callback(code: str, state: str, request: Request, db: Session = Depends(get_db)):
    state_user_id = verify_oauth_state(state)
    if request.cookies.get(OAUTH_STATE_COOKIE) != state:
        raise HTTPException(400, "OAuth state cookie is missing or does not match")
    cookie_user_id = session_user_id(request.cookies.get(SESSION_COOKIE))
    if state_user_id is not None and cookie_user_id != state_user_id:
        raise HTTPException(400, "OAuth session does not match the logged-in account")

    flow = _flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    svc = build("gmail", "v1", credentials=creds, cache_discovery=False)
    email = svc.users().getProfile(userId="me").execute()["emailAddress"].strip().lower()

    if state_user_id is not None:
        user = db.get(User, state_user_id)
        if not user or not user.is_active:
            raise HTTPException(401, "Please log in to continue")
        if user.gmail_email and user.gmail_email.lower() != email:
            raise HTTPException(409, "A different Gmail account is already connected. Contact support to change it.")
    else:
        user = db.scalar(select(User).where(func.lower(User.email) == email))
        if not user or user.password_hash is not None:
            raise HTTPException(400, "Log in to ApplyPilot before connecting this Gmail account.")
        if not user.is_active:
            raise HTTPException(401, "This account is inactive")

    linked_elsewhere = db.scalar(
        select(User).where(func.lower(User.gmail_email) == email, User.id != user.id)
    )
    if linked_elsewhere:
        raise HTTPException(409, "This Gmail account is already connected to another ApplyPilot account.")

    user.gmail_email = email
    user.google_access_token = encrypt(creds.token)
    if creds.refresh_token:
        user.google_refresh_token = encrypt(creds.refresh_token)
    db.commit()

    response = RedirectResponse(f"{settings.FRONTEND_URL}/?gmail=connected")
    response.delete_cookie(
        OAUTH_STATE_COOKIE,
        httponly=True,
        secure=secure_cookie(),
        samesite="lax",
        path="/auth",
    )
    if state_user_id is None:
        set_session_cookie(response, user.id)
    return response


@router.get("/test-emails/{user_id}")
def test_emails(
    user_id: int,
    n: int = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_owner(user_id, user)
    if not user.google_refresh_token:
        raise HTTPException(404, "User not connected")
    emails = fetch_emails(db, user, max_results=max(1, min(n, 100)))
    for email in emails:
        print(email["sender"], "|", email["subject"], "|", len(email["attachments"]))
    return [{**email, "body": email["body"][:200]} for email in emails]
