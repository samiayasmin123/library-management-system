from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.utils.deps import get_current_user

router = APIRouter(tags=["Borrow"])


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

    # Check availability
    if not book.is_available:
        raise HTTPException(
            status_code=400,
            detail="Book is already borrowed"
        )

    # Create borrow record
    borrow_record = models.BorrowRecord(
        user_id=current_user.id,
        book_id=book.id,
        borrow_date=datetime.utcnow(),
        status="borrowed"
    )

    # Update book
    book.is_available = False

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

    borrow_record.return_date = datetime.utcnow()
    borrow_record.status = "returned"

    book.is_available = True

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