from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.utils.deps import get_current_user, admin_only
from app.schemas.borrow import BorrowRecordOut

router = APIRouter(tags=["Borrow"])


def _sync_book_availability(db, book_id: int):

    available_count = (
        db.query(models.BookCopy)
        .filter(
            models.BookCopy.book_id == book_id,
            models.BookCopy.status == "available",
        )
        .count()
    )

    book = (
        db.query(models.Book)
        .filter(models.Book.id == book_id)
        .first()
    )

    if book is not None:
        book.is_available = available_count > 0


@router.post("/borrow/{book_id}")
def borrow_book(
    book_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if book exists
    book = db.query(models.Book).filter(
        models.Book.id == book_id
    ).first()

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found"
        )

    # Block a duplicate active borrow of the same book by this user
    existing_borrow = db.query(models.BorrowRecord).filter(
        models.BorrowRecord.book_id == book_id,
        models.BorrowRecord.user_id == current_user.id,
        models.BorrowRecord.status == "borrowed"
    ).first()

    if existing_borrow:
        raise HTTPException(
            status_code=400,
            detail="You already have an active borrow for this book"
        )

    # Try to find a specific available copy first
    copy = db.query(models.BookCopy).filter(
        models.BookCopy.book_id == book_id,
        models.BookCopy.status == "available"
    ).first()

    if copy is not None:

        # ---------------------------------------------
        # New path: copy-tracked book
        # ---------------------------------------------

        copy.status = "borrowed"
        db.flush()

        _sync_book_availability(db, book_id)

        borrow_record = models.BorrowRecord(
            user_id=current_user.id,
            book_id=book.id,
            copy_id=copy.id,
            borrow_date=datetime.utcnow(),
            status="borrowed"
        )

        db.add(borrow_record)
        db.commit()
        db.refresh(borrow_record)

        return {
            "message": "Book borrowed successfully",
            "book_id": book.id,
            "title": book.title,
            "copy_id": copy.id,
            "copy_number": copy.copy_number,
            "borrowed_by": current_user.id,
            "borrowed_by_name": current_user.name,
            "status": borrow_record.status,
            "borrow_date": borrow_record.borrow_date
        }

    # ---------------------------------------------
    # Legacy path: no tracked copies for this book
    # ---------------------------------------------

    if not book.is_available:
        raise HTTPException(
            status_code=400,
            detail="Book is already borrowed"
        )

    book.is_available = False

    borrow_record = models.BorrowRecord(
        user_id=current_user.id,
        book_id=book.id,
        copy_id=None,
        borrow_date=datetime.utcnow(),
        status="borrowed"
    )

    db.add(borrow_record)
    db.commit()
    db.refresh(borrow_record)

    return {
        "message": "Book borrowed successfully",
        "book_id": book.id,
        "title": book.title,
        "borrowed_by": current_user.id,
        "borrowed_by_name": current_user.name,
        "status": borrow_record.status,
        "borrow_date": borrow_record.borrow_date
    }


@router.post("/return/{book_id}")
def return_book(
    book_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    borrow_record = db.query(models.BorrowRecord).filter(
        models.BorrowRecord.book_id == book_id,
        models.BorrowRecord.user_id == current_user.id,
        models.BorrowRecord.status == "borrowed"
    ).first()

    if not borrow_record:
        raise HTTPException(
            status_code=404,
            detail="No active borrow record found"
        )

    book = db.query(models.Book).filter(
        models.Book.id == book_id
    ).first()

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found"
        )

    if borrow_record.copy_id is not None:

        # ---------------------------------------------
        # New path: this borrow was tied to a specific copy
        # ---------------------------------------------

        copy = db.query(models.BookCopy).filter(
            models.BookCopy.id == borrow_record.copy_id
        ).first()

        if copy is not None:
            copy.status = "available"
            db.flush()

        _sync_book_availability(db, book_id)

    else:

        # ---------------------------------------------
        # Legacy path: no copy tracking for this borrow
        # ---------------------------------------------

        book.is_available = True

    borrow_record.return_date = datetime.utcnow()
    borrow_record.status = "returned"

    db.commit()

    return {
        "message": "Book returned successfully",
        "book_id": book.id,
        "title": book.title,
        "returned_by": current_user.id,
        "returned_by_name": current_user.name,
        "status": borrow_record.status,
        "return_date": borrow_record.return_date
    }


 
# ===================================================
# MY BORROW HISTORY (Authenticated user)
# ===================================================
 
@router.get("/borrow/my", response_model=List[BorrowRecordOut])
def get_my_borrows(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    borrows = db.query(models.BorrowRecord).filter(
        models.BorrowRecord.user_id == current_user.id
    ).order_by(
        models.BorrowRecord.borrow_date.desc()
    ).all()
 
    return borrows
 
 
# ===================================================
# MY ACTIVE BORROWS (Authenticated user)
# ===================================================
 
@router.get("/borrow/active", response_model=List[BorrowRecordOut])
def get_my_active_borrows(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    borrows = db.query(models.BorrowRecord).filter(
        models.BorrowRecord.user_id == current_user.id,
        models.BorrowRecord.status == "borrowed"
    ).order_by(
        models.BorrowRecord.borrow_date.desc()
    ).all()
 
    return borrows
 
 
# ===================================================
# ALL BORROW RECORDS, PAGINATED (Admin only)
# ===================================================
 
@router.get("/borrow/all", response_model=List[BorrowRecordOut])
def get_all_borrows(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    admin=Depends(admin_only),
    db: Session = Depends(get_db)
):
    borrows = db.query(models.BorrowRecord).order_by(
        models.BorrowRecord.borrow_date.desc()
    ).offset(skip).limit(limit).all()
 
    return borrows