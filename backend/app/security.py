import base64
import hashlib
import hmac
import secrets
import time
from urllib.parse import urlsplit

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.models.db import get_db
from app.models.tables import User

SESSION_COOKIE = "applypilot_session"
OAUTH_STATE_COOKIE = "applypilot_oauth_state"
SESSION_MAX_AGE = 60 * 60 * 24 * 7


def _secret() -> bytes:
    secret = settings.AUTH_SECRET_KEY or settings.ENCRYPTION_KEY
    if len(secret) < 32:
        raise HTTPException(500, "Authentication signing key must contain at least 32 characters")
    return hashlib.sha256(b"applypilot-session:" + secret.encode()).digest()


def secure_cookie() -> bool:
    if settings.AUTH_COOKIE_SECURE is not None:
        return settings.AUTH_COOKIE_SECURE
    return settings.FRONTEND_URL.lower().startswith("https://")


def _sign(value: str) -> str:
    return hmac.new(_secret(), value.encode(), hashlib.sha256).hexdigest()


def create_session(user_id: int) -> str:
    payload = f"{user_id}.{int(time.time()) + SESSION_MAX_AGE}.{secrets.token_urlsafe(16)}"
    return f"{payload}.{_sign(payload)}"


def session_user_id(value: str | None) -> int | None:
    if not value:
        return None
    try:
        user_id, expires, nonce, signature = value.split(".", 3)
        payload = f"{user_id}.{expires}.{nonce}"
        if not hmac.compare_digest(_sign(payload), signature) or int(expires) < int(time.time()):
            return None
        parsed_id = int(user_id)
        return parsed_id if parsed_id > 0 else None
    except ValueError:
        return None


def hash_password(password: str) -> str:
    if len(password) < 8 or len(password) > 128:
        raise HTTPException(422, "Password must be between 8 and 128 characters")
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=64)
    salt_text = base64.urlsafe_b64encode(salt).decode()
    digest_text = base64.urlsafe_b64encode(digest).decode()
    return f"scrypt${salt_text}${digest_text}"


def verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        algorithm, salt_text, digest_text = encoded.split("$")
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_text)
        expected = base64.urlsafe_b64decode(digest_text)
        actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=len(expected))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def set_session_cookie(response, user_id: int) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        create_session(user_id),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=secure_cookie(),
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response) -> None:
    response.delete_cookie(
        SESSION_COOKIE,
        httponly=True,
        secure=secure_cookie(),
        samesite="lax",
        path="/",
    )


def _check_origin(request: Request) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    origin = request.headers.get("origin")
    if not origin:
        if request.cookies.get(SESSION_COOKIE):
            raise HTTPException(403, "Request origin is required")
        return
    frontend_origin = urlsplit(settings.FRONTEND_URL)
    allowed = {f"{frontend_origin.scheme}://{frontend_origin.netloc}", "http://127.0.0.1:5173"}
    if origin not in allowed:
        raise HTTPException(403, "Untrusted request origin")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    _check_origin(request)
    user_id = session_user_id(request.cookies.get(SESSION_COOKIE))
    user = db.get(User, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(401, "Please log in to continue")
    return user


def require_owner(user_id: int, current_user: User) -> None:
    if user_id != current_user.id:
        raise HTTPException(404, "Not found")


def oauth_state(user_id: int | None) -> str:
    expires = int(time.time()) + 600
    owner = str(user_id) if user_id is not None else "legacy"
    nonce = secrets.token_urlsafe(18)
    payload = f"{owner}.{expires}.{nonce}"
    return f"{payload}.{_sign('oauth:' + payload)}"


def verify_oauth_state(value: str | None) -> int | None:
    if not value:
        raise HTTPException(400, "Missing OAuth state")
    try:
        owner, expires, nonce, signature = value.split(".", 3)
        payload = f"{owner}.{expires}.{nonce}"
        if not hmac.compare_digest(_sign("oauth:" + payload), signature) or int(expires) < int(time.time()):
            raise HTTPException(400, "Invalid or expired OAuth state")
        return None if owner == "legacy" else int(owner)
    except (ValueError, HTTPException) as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(400, "Invalid OAuth state") from exc


def require_key(x_api_key: str = Header(default="")) -> None:
    # compare as bytes: compare_digest raises on non-ASCII str, which would turn a bad key into a 500
    expected = settings.N8N_API_KEY.encode()
    if not expected or not secrets.compare_digest(x_api_key.encode("utf-8", "ignore"), expected):
        raise HTTPException(401, "Invalid API key")