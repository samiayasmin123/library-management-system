"""
Adds extra copies to EVERY book in the database, regardless of how
many copies each one already has. Useful for making sure the whole
catalogue is easily borrowable, and for giving every book a buffer
against the "single copy stuck as borrowed" problem.

Run this once from your project root:

    python add_copies_to_all_books.py
"""

from app.database import SessionLocal
from app.models.book import Book
from app.models.book_copy import BookCopy


COPIES_TO_ADD = 2   # <-- change to 2 or 3, applied to every book


def main():
    db = SessionLocal()

    try:
        books = db.query(Book).all()

        print(f"Found {len(books)} books. Adding {COPIES_TO_ADD} copies to each...\n")

        for book in books:

            existing_count = (
                db.query(BookCopy)
                .filter(BookCopy.book_id == book.id)
                .count()
            )

            for i in range(1, COPIES_TO_ADD + 1):
                copy = BookCopy(
                    book_id=book.id,
                    copy_number=existing_count + i,
                    condition="good",
                    status="available",
                )
                db.add(copy)

            book.is_available = True

            print(f"  + {book.title} (id {book.id}): {existing_count} \u2192 {existing_count + COPIES_TO_ADD} copies")

        db.commit()

        print(f"\nDone. All {len(books)} books now have at least {COPIES_TO_ADD} more available copies.")

    finally:
        db.close()


if __name__ == "__main__":
    main()