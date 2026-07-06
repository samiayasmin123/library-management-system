from sqlalchemy.orm import Session

from app.models.book import Book
from app.models.borrow import BorrowRecord
from app.models.pending_action import PendingAction

from datetime import datetime


# ===================================================
# SEARCH BOOKS
# ===================================================

def search_books(query: str, db: Session):

    books = (
        db.query(Book)
        .filter(Book.title.ilike(f"%{query}%"))
        .all()
    )

    return [
        {
            "id": book.id,
            "title": book.title,
            "author": book.author,
            "available": book.is_available,
        }
        for book in books
    ]




# ===================================================
# FIND USER BORROWED BOOK
# ===================================================

def find_user_borrowed_book(user_id: int, query: str, db: Session):

    borrow = (
        db.query(BorrowRecord)
        .join(Book, BorrowRecord.book_id == Book.id)
        .filter(
            BorrowRecord.user_id == user_id,
            BorrowRecord.status == "borrowed",
            Book.title.ilike(f"%{query}%")
        )
        .first()
    )

    if borrow is None:
        return None

    book = (
        db.query(Book)
        .filter(Book.id == borrow.book_id)
        .first()
    )

    return {
        "book_id": book.id,
        "title": book.title
    }



# ===================================================
# CHECK AVAILABILITY
# ===================================================

def check_availability(book_id: int, db: Session):

    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        return None

    return {
        "id": book.id,
        "title": book.title,
        "available": book.is_available,
    }


# ===================================================
# ACTIVE BORROWS
# ===================================================

def get_active_borrows(user_id: int, db: Session):

    borrows = (
        db.query(BorrowRecord)
        .filter(
            BorrowRecord.user_id == user_id,
            BorrowRecord.status == "borrowed",
        )
        .all()
    )

    return borrows


# ===================================================
# STAGE BORROW
# ===================================================

def stage_borrow(session_id: int, book_id: int, db: Session):

    pending = PendingAction(
        session_id=session_id,
        action="borrow",
        book_id=book_id,
        status="pending",
    )

    db.add(pending)
    db.commit()
    db.refresh(pending)

    return pending


# ===================================================
# STAGE RETURN
# ===================================================

def stage_return(session_id: int, book_id: int, db: Session):

    pending = PendingAction(
        session_id=session_id,
        action="return",
        book_id=book_id,
        status="pending",
    )

    db.add(pending)
    db.commit()
    db.refresh(pending)

    return pending


# ===================================================
# GET PENDING ACTION
# ===================================================

def get_pending_action(session_id: int, db: Session):

    return (
        db.query(PendingAction)
        .filter(
            PendingAction.session_id == session_id,
            PendingAction.status == "pending"
        )
        .order_by(PendingAction.id.desc())
        .first()
    )


# ===================================================
# EXECUTE BORROW
# ===================================================

def execute_borrow(session_id: int, user_id: int, db: Session):

    pending = get_pending_action(session_id, db)

    if pending is None:

        return {
            "success": False,
            "message": "There is no pending borrow request."
        }

    if pending.action != "borrow":

        return {
            "success": False,
            "message": "Pending action is not a borrow request."
        }

    book = (
        db.query(Book)
        .filter(Book.id == pending.book_id)
        .first()
    )

    if book is None:

        return {
            "success": False,
            "message": "Book not found."
        }

    if not book.is_available:

        return {
            "success": False,
            "message": f'"{book.title}" is already borrowed.'
        }

    borrow = BorrowRecord(
        user_id=user_id,
        book_id=book.id,
        status="borrowed"
    )

    db.add(borrow)

    book.is_available = False

    pending.status = "completed"

    db.commit()

    return {
        "success": True,
        "message": f'You have successfully borrowed "{book.title}".'
    }


# ===================================================
# EXECUTE RETURN
# ===================================================



def execute_return(session_id: int, user_id: int, db: Session):

    pending = get_pending_action(session_id, db)

    if pending is None:

        return {
            "success": False,
            "message": "No pending return request."
        }

    if pending.action != "return":

        return {
            "success": False,
            "message": "Pending action is not a return request."
        }

    borrow = (
        db.query(BorrowRecord)
        .filter(
            BorrowRecord.user_id == user_id,
            BorrowRecord.book_id == pending.book_id,
            BorrowRecord.status == "borrowed"
        )
        .first()
    )

    if borrow is None:

        return {
            "success": False,
            "message": "Borrow record not found."
        }

    book = (
        db.query(Book)
        .filter(Book.id == pending.book_id)
        .first()
    )

    borrow.status = "returned"
    borrow.return_date = datetime.utcnow()

    book.is_available = True

    pending.status = "completed"

    db.commit()

    return {
        "success": True,
        "message": f'You have successfully returned "{book.title}".'
    }


    # ===================================================
# BOOK DETAILS
# ===================================================

def get_book_details(query: str, db: Session):

    book = (
        db.query(Book)
        .filter(Book.title.ilike(f"%{query}%"))
        .first()
    )

    if book is None:
        return None

    return {
        "title": book.title,
        "author": book.author,
        "genre": book.genre,
        "description": book.description,
        "available": book.is_available
    }


from app.utils.embedding import get_embedding
from app.utils.similarity import cosine_similarity
import numpy as np


# ===================================================
# AI RECOMMENDATION
# ===================================================

def recommend_books(query: str, db: Session):

    query_embedding = np.array(get_embedding(query))

    books = db.query(Book).all()

    scored_books = []

    for book in books:

        if book.embedding is None:
            continue

        book_embedding = np.array(book.embedding)

        score = cosine_similarity(
            query_embedding,
            book_embedding
        )

        scored_books.append((score, book))

    scored_books.sort(
        key=lambda x: x[0],
        reverse=True
    )

    recommendations = []

    for score, book in scored_books[:5]:

        recommendations.append(
            {
                "title": book.title,
                "author": book.author,
                "available": book.is_available,
                "score": round(float(score), 3)
            }
        )

    return recommendations