import secrets

from fastapi import Header, HTTPException

from app.config import settings


def require_key(x_api_key: str = Header(default="")) -> None:
    # compare as bytes: compare_digest raises on non-ASCII str, which would turn a bad key into a 500
    expected = settings.N8N_API_KEY.encode()
    if not expected or not secrets.compare_digest(x_api_key.encode("utf-8", "ignore"), expected):
        raise HTTPException(401, "Invalid API key")