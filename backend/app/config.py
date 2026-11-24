from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env", PROJECT_DIR / ".env.local"),
        extra="ignore",
    )
    DATABASE_URL: str
    DATABASE_URL_UNPOOLED: str | None = None
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_ENDPOINT_URL_S3: str
    AWS_REGION: str
    OBJECT_STORAGE_BUCKET: str = "assets"
    ENCRYPTION_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    FRONTEND_URL: str = "http://localhost:5173"
    LLM_API_KEY: str = ""
    OLOSTEP_API_KEY: str = ""
    CRUSTDATA_API_KEY: str = ""

settings = Settings()