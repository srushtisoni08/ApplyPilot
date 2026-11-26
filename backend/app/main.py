from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.models.db import engine
from app.routes import auth
from app.services.object_storage import check_object_storage
from app.routes import documents
from app.routes import profile
from app.routes import matches
from app.routes import applications
from app.routes import apply, dummy
from app.routes import automation

from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(profile.router)
app.include_router(matches.router)
app.include_router(applications.router)
app.include_router(apply.router)
app.include_router(dummy.router)
app.include_router(automation.router)

@app.get("/health")
def health() -> dict[str, object]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL is unavailable",
        ) from exc

    try:
        check_object_storage()
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Object storage is unavailable",
        ) from exc

    return {
        "status": "ok",
        "services": {"postgres": "ok", "object_storage": "ok"},
    }