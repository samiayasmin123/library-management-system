"""add chat session and message fields

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa


revision = "b3c4d5e6f7a8"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade():

    op.add_column(
        "chat_sessions",
        sa.Column("title", sa.String(), nullable=True),
    )

    op.add_column(
        "chat_sessions",
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "chat_messages",
        sa.Column("metadata_", sa.JSON(), nullable=True),
    )


def downgrade():

    op.drop_column("chat_messages", "metadata_")

    op.drop_column("chat_sessions", "updated_at")

    op.drop_column("chat_sessions", "title")