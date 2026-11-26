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
    AUTH_SECRET_KEY: str = ""
    AUTH_COOKIE_SECURE: bool | None = None
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-3.5-flash-lite"
    LLM_FALLBACK_MODEL: str = "gemini-3.8-flash"
    LLM_PROVIDER: str = "gemini"  # "gemini" or "groq"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    OLOSTEP_API_KEY: str = ""
    N8N_API_KEY: str = ""
    CRUSTDATA_API_KEY: str = ""
    TESSERACT_CMD: str = ""
    TESSDATA_PREFIX: str = ""
    PLAYWRIGHT_BROWSERS_PATH: str = ""
    
settings = Settings()