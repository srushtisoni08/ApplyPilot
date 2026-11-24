import base64
import re
from datetime import datetime

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from app.config import settings
from app.models.tables import User
from app.services.crypto import decrypt, encrypt

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def _service(db: Session, user: User):
    creds = Credentials(
        token=decrypt(user.google_access_token),
        refresh_token=decrypt(user.google_refresh_token),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )
    creds.refresh(Request())  # expiry isn't stored, so always refresh
    user.google_access_token = encrypt(creds.token)
    db.commit()
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _b64(data: str) -> str:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", errors="ignore")


def _walk(part, texts, attachments):
    mime = part.get("mimeType", "")
    body = part.get("body", {})
    if part.get("filename") and body.get("attachmentId"):
        attachments.append({
            "filename": part["filename"],
            "mime_type": mime,
            "attachment_id": body["attachmentId"],
        })
    elif mime in ("text/plain", "text/html") and body.get("data"):
        texts.setdefault(mime, []).append(_b64(body["data"]))
    for sub in part.get("parts", []) or []:
        _walk(sub, texts, attachments)


def _parse(msg: dict) -> dict:
    headers = {h["name"].lower(): h["value"] for h in msg["payload"].get("headers", [])}
    texts, attachments = {}, []
    _walk(msg["payload"], texts, attachments)
    if "text/plain" in texts:
        body = "\n".join(texts["text/plain"])
    else:
        html = "\n".join(texts.get("text/html", []))
        body = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()
    return {
        "id": msg["id"],
        "subject": headers.get("subject", ""),
        "sender": headers.get("from", ""),
        "date": headers.get("date", ""),
        "body": body,
        "attachments": attachments,
    }


def fetch_emails(db: Session, user: User, since: datetime | None = None, max_results: int = 20) -> list[dict]:
    svc = _service(db, user)
    q = f"after:{int(since.timestamp())}" if since else None
    resp = svc.users().messages().list(userId="me", q=q, maxResults=max_results).execute()
    emails = []
    for m in resp.get("messages", []):
        full = svc.users().messages().get(userId="me", id=m["id"], format="full").execute()
        emails.append(_parse(full))
    return emails


def get_attachment(db: Session, user: User, message_id: str, attachment_id: str) -> bytes:
    svc = _service(db, user)
    att = svc.users().messages().attachments().get(
        userId="me", messageId=message_id, id=attachment_id
    ).execute()
    return base64.urlsafe_b64decode(att["data"] + "=" * (-len(att["data"]) % 4))