"""Add ApplyPilot password authentication and Gmail identity.

Revision ID: 20261126_add_user_auth
Revises: 8409dc669ae5
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261126_add_user_auth"
down_revision: Union[str, Sequence[str], None] = "8409dc669ae5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(length=255), nullable=False, server_default=""))
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("gmail_email", sa.String(length=255), nullable=True))
    op.execute(
        "UPDATE users SET full_name = split_part(email, '@', 1), "
        "gmail_email = email WHERE google_access_token IS NOT NULL OR google_refresh_token IS NOT NULL"
    )
    op.alter_column("users", "full_name", server_default=None)
    op.alter_column("users", "is_active", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "gmail_email")
    op.drop_column("users", "is_active")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "full_name")
