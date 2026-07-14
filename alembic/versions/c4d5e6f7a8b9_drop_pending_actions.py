"""drop pending_actions table

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa


revision = "c4d5e6f7a8b9"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade():

    op.drop_table("pending_actions")


def downgrade():

    op.create_table(
        "pending_actions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("chat_sessions.id"),
        ),
        sa.Column("action", sa.String()),
        sa.Column(
            "book_id",
            sa.Integer(),
            sa.ForeignKey("books.id"),
        ),
        sa.Column("status", sa.String(), server_default="pending"),
        sa.Column("created_at", sa.DateTime()),
    )