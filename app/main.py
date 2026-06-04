import uvicorn
from fastapi import FastAPI

from app.config import settings
from app.database import engine, Base, SessionLocal
from fastapi import Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.book import Book
from app.schemas.book import BookCreate
from app.models.user import User
from app.models.category import Category
from app.models.borrow import BorrowRecord
from app.models.fine import Fine
from datetime import datetime
from app.schemas.user import UserCreate
from sqlalchemy import or_, select
app = FastAPI()

def create_tables():
    Base.metadata.create_all(bind=engine)
    
create_tables()

@app.post("/books")
def create_book(book: BookCreate, db: Session = Depends(get_db)):

    new_book = Book(
        title=book.title,
        author=book.author,
        genre=book.genre,
        description=book.description,
        is_available=True
    )

    db.add(new_book)
    db.commit()
    db.refresh(new_book)

    return new_book

@app.get("/books")
def get_books(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return db.query(Book).offset(skip).limit(limit).all()


@app.post("/borrow/{user_id}/{book_id}")
def borrow_book(user_id: int, book_id: int, db: Session = Depends(get_db)):

    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        return {"message": "Book not found"}

    if not book.is_available:
        return {"message": "Book already borrowed"}

    # mark book unavailable
    book.is_available = False

    borrow = BorrowRecord(
        user_id=user_id,
        book_id=book_id,
        borrow_date=datetime.utcnow(),
        status="borrowed"
    )

    db.add(borrow)
    db.commit()

    return {"message": "Book borrowed successfully"}


@app.post("/users")
def create_user(user: UserCreate, db: Session = Depends(get_db)):

    new_user = User(
        name=user.name,
        email=user.email,
        password=user.password,
        role=user.role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@app.post("/return/{user_id}/{book_id}")
def return_book(user_id: int, book_id: int, db: Session = Depends(get_db)):

    borrow = db.query(BorrowRecord).filter(
        BorrowRecord.user_id == user_id,
        BorrowRecord.book_id == book_id,
        BorrowRecord.status == "borrowed"
    ).first()

    if not borrow:
        return {"message": "No active borrow found"}

    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        return {"message": "Book not found"}

    # make book available again
    book.is_available = True

    # update borrow record
    borrow.status = "returned"
    borrow.return_date = datetime.utcnow()

    db.commit()

    return {"message": "Book returned successfully"}



@app.get("/books/search")
def search_books(query: str, db: Session = Depends(get_db)):

    books = db.query(Book).filter(
        or_(
            Book.title.ilike(f"%{query}%"),
            Book.author.ilike(f"%{query}%")
        )
    ).all()

    return books


@app.get("/books/available")
def available_books(db: Session = Depends(get_db)):

    books = db.query(Book).filter(Book.is_available == True).all()

    return books


@app.get("/books/genre/{genre}")
def books_by_genre(genre: str, db: Session = Depends(get_db)):

    books = db.query(Book).filter(
        Book.genre.ilike(f"%{genre}%")
    ).all()

    return books

