"""add public_id uuid to chat_sessions

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-08-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid


# revision identifiers, used by Alembic.
revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade():
    # Add the column as nullable first, since existing rows won't
    # have a value yet - we backfill them below, then lock it down.
    op.add_column(
        "chat_sessions",
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Backfill every existing session with a fresh, random UUID.
    connection = op.get_bind()
    chat_sessions = sa.table(
        "chat_sessions",
        sa.column("id", sa.Integer),
        sa.column("public_id", postgresql.UUID(as_uuid=True)),
    )

    existing_rows = connection.execute(sa.select(chat_sessions.c.id)).fetchall()
    for row in existing_rows:
        connection.execute(
            chat_sessions.update()
            .where(chat_sessions.c.id == row.id)
            .values(public_id=uuid.uuid4())
        )

    # Now that every row has a value, enforce NOT NULL and uniqueness.
    op.alter_column("chat_sessions", "public_id", nullable=False)
    op.create_unique_constraint(
        "uq_chat_sessions_public_id", "chat_sessions", ["public_id"]
    )
    op.create_index(
        "ix_chat_sessions_public_id", "chat_sessions", ["public_id"]
    )


def downgrade():
    op.drop_index("ix_chat_sessions_public_id", table_name="chat_sessions")
    op.drop_constraint("uq_chat_sessions_public_id", "chat_sessions", type_="unique")
    op.drop_column("chat_sessions", "public_id")