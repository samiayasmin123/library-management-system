from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
 
from app.database import get_db
from app.models.book import Book
from app.models.book_copy import BookCopy
from app.schemas.book_copy import (
    BookCopyCreate,
    BookCopyUpdate,
    BookCopyOut,
    BookCopySummary,
)
from app.utils.deps import get_current_user, admin_only

router = APIRouter(tags=["Book Copies"])


def _sync_book_availability(db, book_id: int):

    available_count = (
        db.query(BookCopy)
        .filter(
            BookCopy.book_id == book_id,
            BookCopy.status == "available",
        )
        .count()
    )

    book = (
        db.query(Book)
        .filter(Book.id == book_id)
        .first()
    )

    if book is not None:
        book.is_available = available_count > 0


 
# ===================================================
# ADD A NEW COPY (Admin only)
# ===================================================
 
@router.post("/books/{book_id}/copies", response_model=BookCopyOut)
def add_copy(
    book_id: int,
    copy_in: BookCopyCreate,
    db: Session = Depends(get_db),
    admin=Depends(admin_only),
):
 
    book = db.query(Book).filter(Book.id == book_id).first()
 
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
 
    last_number = (
        db.query(func.max(BookCopy.copy_number))
        .filter(BookCopy.book_id == book_id)
        .scalar()
    )
 
    next_number = (last_number or 0) + 1
 
    new_copy = BookCopy(
        book_id=book_id,
        copy_number=next_number,
        condition=copy_in.condition,
        acquired_date=copy_in.acquired_date,
        notes=copy_in.notes,
        status="available",
    )
 
    db.add(new_copy)
 
    book.is_available = True
 
    db.commit()
    db.refresh(new_copy)
 
    return new_copy
 
 
# ===================================================
# LIST ALL COPIES OF A BOOK (Open)
# ===================================================
 
@router.get("/books/{book_id}/copies", response_model=list[BookCopyOut])
def list_copies(
    book_id: int,
    db: Session = Depends(get_db),
):
 
    book = db.query(Book).filter(Book.id == book_id).first()
 
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
 
    copies = (
        db.query(BookCopy)
        .filter(BookCopy.book_id == book_id)
        .order_by(BookCopy.copy_number)
        .all()
    )
 
    return copies
 
 
# ===================================================
# LIST ONLY AVAILABLE COPIES (Open)
# ===================================================
 
@router.get("/books/{book_id}/copies/available", response_model=list[BookCopyOut])
def list_available_copies(
    book_id: int,
    db: Session = Depends(get_db),
):
 
    book = db.query(Book).filter(Book.id == book_id).first()
 
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
 
    copies = (
        db.query(BookCopy)
        .filter(
            BookCopy.book_id == book_id,
            BookCopy.status == "available",
        )
        .order_by(BookCopy.copy_number)
        .all()
    )
 
    return copies
 
 
# ===================================================
# COPY SUMMARY (Open)
# ===================================================
 
@router.get("/books/{book_id}/copies/summary", response_model=BookCopySummary)
def copies_summary(
    book_id: int,
    db: Session = Depends(get_db),
):
 
    book = db.query(Book).filter(Book.id == book_id).first()
 
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
 
    copies = (
        db.query(BookCopy)
        .filter(BookCopy.book_id == book_id)
        .all()
    )
 
    summary = {
        "total": len(copies),
        "available": 0,
        "borrowed": 0,
        "lost": 0,
        "retired": 0,
    }
 
    for copy in copies:
        if copy.status in summary:
            summary[copy.status] += 1
 
    return summary
 
 
# ===================================================
# GET A SINGLE COPY (Open)
# ===================================================
 
@router.get("/copies/{copy_id}", response_model=BookCopyOut)
def get_copy(
    copy_id: int,
    db: Session = Depends(get_db),
):
 
    copy = db.query(BookCopy).filter(BookCopy.id == copy_id).first()
 
    if copy is None:
        raise HTTPException(status_code=404, detail="Copy not found")
 
    return copy
 
 
# ===================================================
# UPDATE A COPY (Admin only)
# ===================================================
 
@router.put("/copies/{copy_id}", response_model=BookCopyOut)
def update_copy(
    copy_id: int,
    copy_in: BookCopyUpdate,
    db: Session = Depends(get_db),
    admin=Depends(admin_only),
):
 
    copy = db.query(BookCopy).filter(BookCopy.id == copy_id).first()
 
    if copy is None:
        raise HTTPException(status_code=404, detail="Copy not found")
 
    status_changed = (
        copy_in.status is not None and copy_in.status != copy.status
    )
 
    if copy_in.condition is not None:
        copy.condition = copy_in.condition
 
    if copy_in.notes is not None:
        copy.notes = copy_in.notes
 
    if copy_in.status is not None:
        copy.status = copy_in.status
 
    if status_changed:
        _sync_book_availability(db, copy.book_id)
 
    db.commit()
    db.refresh(copy)
 
    return copy
 
 
# ===================================================
# DELETE A COPY (Admin only)
# ===================================================
 
@router.delete("/copies/{copy_id}")
def delete_copy(
    copy_id: int,
    db: Session = Depends(get_db),
    admin=Depends(admin_only),
):
 
    copy = db.query(BookCopy).filter(BookCopy.id == copy_id).first()
 
    if copy is None:
        raise HTTPException(status_code=404, detail="Copy not found")
 
    if copy.status == "borrowed":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a copy that is currently borrowed",
        )
 
    book_id = copy.book_id
 
    db.delete(copy)
    db.flush()
 
    _sync_book_availability(db, book_id)
 
    db.commit()
 
    return {"message": "Copy deleted successfully"}