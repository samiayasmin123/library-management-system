from alembic import op
import sqlalchemy as sa


revision = "a2b3c4d5e6f7"
down_revision = "4f4e85aaa11b"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint(
        "book_copies_book_id_fkey",
        "book_copies",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "book_copies_book_id_fkey",
        "book_copies",
        "books",
        ["book_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_index(
        "ix_book_copies_book_id",
        "book_copies",
        ["book_id"],
    )


def downgrade():
    op.drop_index(
        "ix_book_copies_book_id",
        table_name="book_copies",
    )

    op.drop_constraint(
        "book_copies_book_id_fkey",
        "book_copies",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "book_copies_book_id_fkey",
        "book_copies",
        "books",
        ["book_id"],
        ["id"],
    )