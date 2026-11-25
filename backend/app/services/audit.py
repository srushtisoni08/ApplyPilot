from sqlalchemy.orm import Session

from app.models.tables import AuditLog


def audit(db: Session, user_id: int | None, tool: str, input: dict | None = None,
          output: dict | None = None, approved_by: str | None = None, status: str = "ok") -> None:
    """Caller commits. Never pass full resume text here."""
    db.add(AuditLog(user_id=user_id, tool=tool, input=input, output=output,
                    approved_by=approved_by, status=status))