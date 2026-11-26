from datetime import datetime, date
from sqlalchemy import String, Text, Float, Integer, Date, DateTime, ForeignKey, JSON, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from app.models.db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    password_hash: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
    gmail_email: Mapped[str | None] = mapped_column(String(255))
    google_access_token: Mapped[str | None] = mapped_column(Text)    # encrypted
    google_refresh_token: Mapped[str | None] = mapped_column(Text)   # encrypted
    last_email_sync: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(20))   # pdf / docx / image
    extracted_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)   # education, skills, projects, cgpa, grad_year
    needs_confirmation: Mapped[list] = mapped_column(JSON, default=list)
    confirmed: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Opportunity(Base):
    __tablename__ = "opportunities"
    __table_args__ = (UniqueConstraint("user_id", "source_email_id"),)  # dedupe
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    source_email_id: Mapped[str | None] = mapped_column(String(100))
    company: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(255))
    required_skills: Mapped[list] = mapped_column(JSON, default=list)
    min_cgpa: Mapped[float | None] = mapped_column(Float)
    graduation_year: Mapped[list | None] = mapped_column(JSON)
    experience_years: Mapped[float | None] = mapped_column(Float)
    location: Mapped[str | None] = mapped_column(String(255))
    compensation: Mapped[str | None] = mapped_column(String(255))
    apply_link: Mapped[str | None] = mapped_column(Text)
    deadline: Mapped[date | None] = mapped_column(Date)
    confidence: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Match(Base):
    __tablename__ = "matches"
    id: Mapped[int] = mapped_column(primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), unique=True)
    score: Mapped[float] = mapped_column(Float, default=0)
    category: Mapped[str] = mapped_column(String(20))   # suitable / unsuitable / uncertain
    explanation: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = mapped_column(primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"))
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True)  # never submit twice
    status: Mapped[str] = mapped_column(String(30), default="draft")
    # draft / awaiting_approval / submitted / interview / rejected / needs_attention
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    reference_number: Mapped[str | None] = mapped_column(String(100))
    resume_file: Mapped[str | None] = mapped_column(String(255))
    cover_letter: Mapped[str | None] = mapped_column(Text)


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int | None] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(30))   # profile / job / resume / submission / follow_up
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    decision: Mapped[str] = mapped_column(String(20), default="pending")  # pending / approved / rejected
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    tool: Mapped[str] = mapped_column(String(100))
    input: Mapped[dict | None] = mapped_column(JSON)
    output: Mapped[dict | None] = mapped_column(JSON)
    approved_by: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="ok")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SkillEmbedding(Base):
    """Used in Step 5 for skill matching."""
    __tablename__ = "skill_embeddings"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_type: Mapped[str] = mapped_column(String(20))   # profile / opportunity
    owner_id: Mapped[int] = mapped_column(Integer)
    skill: Mapped[str] = mapped_column(String(255))
    embedding = mapped_column(Vector(384))   # all-MiniLM-L6-v2