from datetime import datetime

from langchain_core.tools import tool
from langgraph.types import interrupt
from sqlalchemy.orm import Session

from app.models.book import Book
from app.models.book_copy import BookCopy
from app.models.borrow import BorrowRecord
from app.utils.embedding import get_embedding


# ===================================================
# RECOMPUTE BOOK AVAILABILITY FROM COPIES
# ===================================================

def _sync_book_availability(db: Session, book_id: int):
    """
    Recomputes Book.is_available for a book that has tracked copies,
    based on whether at least one copy has status "available".
    Books with zero tracked copies are left untouched.
    """

    has_tracked_copies = (
        db.query(BookCopy)
        .filter(BookCopy.book_id == book_id)
        .first()
        is not None
    )

    if not has_tracked_copies:
        return

    available_count = (
        db.query(BookCopy)
        .filter(
            BookCopy.book_id == book_id,
            BookCopy.status == "available",
        )
        .count()
    )

    book = db.query(Book).filter(Book.id == book_id).first()

    if book is not None:
        book.is_available = available_count > 0


# ===================================================
# SHARED BOOK LOOKUP HELPER (embedding-based)
# ===================================================

def _find_book_by_embedding(query: str, db: Session):

    query_embedding = get_embedding(query)

    return (
        db.query(Book)
        .filter(Book.embedding.isnot(None))
        .order_by(Book.embedding.cosine_distance(query_embedding))
        .first()
    )


# ===================================================
# TOOL FACTORY
# ===================================================

def make_tools(db: Session, user_id: int) -> list:
    """
    Builds a fresh set of LangChain tools bound to the given DB
    session and user_id via closure. @tool functions are invoked by
    ToolNode with only the arguments the LLM provides, so db/user_id
    can't be passed as normal parameters - they have to be captured
    from the enclosing scope instead. Call this once per request.
    """

    @tool
    def search_books(query: str) -> str:
        """Search library books by title, author, or keyword using semantic
        similarity. Returns title, author, genre, and availability for the
        best matching books."""

        query_embedding = get_embedding(query)

        books = (
            db.query(Book)
            .filter(Book.embedding.isnot(None))
            .order_by(Book.embedding.cosine_distance(query_embedding))
            .limit(5)
            .all()
        )

        if not books:
            return "No matching books found."

        lines = []

        for book in books:

            genre = (
                ", ".join(book.genre)
                if isinstance(book.genre, list)
                else book.genre
            )

            status = "Available" if book.is_available else "Not available"

            lines.append(
                f"Title: {book.title}\n"
                f"Author: {book.author}\n"
                f"Genre: {genre}\n"
                f"Status: {status}"
            )

        return "\n\n".join(lines)

    @tool
    def get_book_details(title: str) -> str:
        """Get full details for a specific book by title, including author,
        genre, description, and availability. Falls back to matching by
        author if no title matches."""

        book = (
            db.query(Book)
            .filter(Book.title.ilike(f"%{title}%"))
            .first()
        )

        if book is None:

            book = (
                db.query(Book)
                .filter(Book.author.ilike(f"%{title}%"))
                .first()
            )

        if book is None:
            book = _find_book_by_embedding(title, db)

        if book is None:
            return f'Could not find a book matching "{title}".'

        genre = (
            ", ".join(book.genre)
            if isinstance(book.genre, list)
            else book.genre
        )

        status = "Available" if book.is_available else "Borrowed"

        return (
            f"Title: {book.title}\n"
            f"Author: {book.author}\n"
            f"Genre: {genre}\n"
            f"Description: {book.description}\n"
            f"Status: {status}"
        )

    @tool
    def check_availability(title: str) -> str:
        """Check how many copies of a book are currently available to
        borrow."""

        book = _find_book_by_embedding(title, db)

        if book is None:
            return f'Could not find a book matching "{title}".'

        has_tracked_copies = (
            db.query(BookCopy)
            .filter(BookCopy.book_id == book.id)
            .first()
            is not None
        )

        if has_tracked_copies:

            available_count = (
                db.query(BookCopy)
                .filter(
                    BookCopy.book_id == book.id,
                    BookCopy.status == "available",
                )
                .count()
            )

            if available_count > 0:
                copy_word = "copy" if available_count == 1 else "copies"
                return f'"{book.title}" has {available_count} {copy_word} available.'

            return f'"{book.title}" has no copies available right now.'

        # Legacy path: no tracked copies for this book
        if book.is_available:
            return f'"{book.title}" is available.'

        return f'"{book.title}" is currently not available.'

    @tool
    def borrow_book(book_title: str) -> str:
        """Borrow a book from the library by title. Always asks for
        confirmation before borrowing."""

        book = _find_book_by_embedding(book_title, db)

        if book is None:
            return f'Could not find a book matching "{book_title}".'

        existing_borrow = (
            db.query(BorrowRecord)
            .filter(
                BorrowRecord.user_id == user_id,
                BorrowRecord.book_id == book.id,
                BorrowRecord.status == "borrowed",
            )
            .first()
        )

        if existing_borrow is not None:
            return f'You already have an active borrow for "{book.title}".'

        copy = (
            db.query(BookCopy)
            .filter(
                BookCopy.book_id == book.id,
                BookCopy.status == "available",
            )
            .order_by(BookCopy.copy_number)
            .first()
        )

        if copy is None:
            return f'"{book.title}" has no available copies right now.'

        answer = interrupt(
            f'Found "{book.title}". Do you want to borrow it? Reply YES or NO.'
        )

        if str(answer).strip().lower() not in ("yes", "y"):
            return "Borrow cancelled."

        copy.status = "borrowed"
        db.flush()

        _sync_book_availability(db, book.id)

        borrow_record = BorrowRecord(
            user_id=user_id,
            book_id=book.id,
            copy_id=copy.id,
            borrow_date=datetime.utcnow(),
            status="borrowed",
        )

        db.add(borrow_record)
        db.commit()

        return f'You have successfully borrowed "{book.title}" (copy #{copy.copy_number}).'

    @tool
    def return_book(book_title: str) -> str:
        """Return a borrowed book to the library by title. Always asks for
        confirmation before returning."""

        book = _find_book_by_embedding(book_title, db)

        if book is None:
            return f'Could not find a book matching "{book_title}".'

        borrow_record = (
            db.query(BorrowRecord)
            .filter(
                BorrowRecord.user_id == user_id,
                BorrowRecord.book_id == book.id,
                BorrowRecord.status == "borrowed",
            )
            .first()
        )

        if borrow_record is None:
            return f'You have not borrowed "{book.title}".'

        answer = interrupt(
            f'Confirm return of "{book.title}"? Reply YES or NO.'
        )

        if str(answer).strip().lower() not in ("yes", "y"):
            return "Return cancelled."

        borrow_record.status = "returned"
        borrow_record.return_date = datetime.utcnow()

        if borrow_record.copy_id is not None:

            copy = (
                db.query(BookCopy)
                .filter(BookCopy.id == borrow_record.copy_id)
                .first()
            )

            if copy is not None:
                copy.status = "available"
                db.flush()

        _sync_book_availability(db, book.id)

        db.commit()

        return f'You have successfully returned "{book.title}".'

    @tool
    def get_active_borrows() -> str:
        """List the current user's currently borrowed books, with title,
        author, and borrow date."""

        records = (
            db.query(BorrowRecord, Book)
            .join(Book, BorrowRecord.book_id == Book.id)
            .filter(
                BorrowRecord.user_id == user_id,
                BorrowRecord.status == "borrowed",
            )
            .order_by(BorrowRecord.borrow_date.desc())
            .all()
        )

        if not records:
            return "You have no borrowed books."

        lines = ["Your borrowed books:"]

        for borrow_record, book in records:

            borrow_date_str = (
                borrow_record.borrow_date.strftime("%Y-%m-%d")
                if borrow_record.borrow_date
                else "unknown date"
            )

            lines.append(
                f"- {book.title} by {book.author} (borrowed {borrow_date_str})"
            )

        return "\n".join(lines)

    @tool
    def recommend_books(query: str) -> str:
        """Recommend books similar to a topic, genre, or description using
        semantic similarity search."""

        query_embedding = get_embedding(query)

        books = (
            db.query(Book)
            .filter(Book.embedding.isnot(None))
            .order_by(Book.embedding.cosine_distance(query_embedding))
            .limit(5)
            .all()
        )

        if not books:
            return "No recommendations found."

        lines = ["Recommended books:"]

        for book in books:
            status = "Available" if book.is_available else "Borrowed"
            lines.append(f"- {book.title} by {book.author} ({status})")

        return "\n".join(lines)

    return [
        search_books,
        get_book_details,
        check_availability,
        borrow_book,
        return_book,
        get_active_borrows,
        recommend_books,
    ]