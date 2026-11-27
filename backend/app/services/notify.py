"""Telegram notifications. Never raises: a failed notification must not break a scheduled job."""
import logging
import sys

import requests

from app.config import settings

log = logging.getLogger("applypilot.notify")
_API = "https://api.telegram.org/bot{token}/{method}"


def telegram_configured() -> bool:
    return bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)


def send_telegram(text: str) -> bool:
    if not text.strip():
        return False
    if not telegram_configured():
        log.warning("Telegram not configured; skipping notification")
        return False
    ok = True
    for chunk in [text[i:i + 3800] for i in range(0, len(text), 3800)]:
        try:
            r = requests.post(
                _API.format(token=settings.TELEGRAM_BOT_TOKEN, method="sendMessage"),
                json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": chunk, "disable_web_page_preview": True},
                timeout=15,
            )
            if r.status_code != 200:
                log.error("Telegram error %s: %s", r.status_code, r.text[:200])
                ok = False
        except requests.RequestException as exc:
            log.error("Telegram request failed: %s", type(exc).__name__)
            ok = False
    return ok


def find_chat_ids() -> list[str]:
    r = requests.get(_API.format(token=settings.TELEGRAM_BOT_TOKEN, method="getUpdates"), timeout=15)
    r.raise_for_status()
    seen = {}
    for u in r.json().get("result", []):
        chat = (u.get("message") or u.get("edited_message") or {}).get("chat")
        if chat:
            seen[str(chat["id"])] = chat.get("first_name") or chat.get("title") or ""
    return [f"{cid}  ({name})" for cid, name in seen.items()]


if __name__ == "__main__":
    if not settings.TELEGRAM_BOT_TOKEN:
        sys.exit("Set TELEGRAM_BOT_TOKEN in .env.local first.")
    ids = find_chat_ids()
    print("\n".join(ids) if ids else "No messages found. Open your bot in Telegram, press Start, send 'hi', then run this again.")