from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, cast, String
from typing import List
from app.database import get_db
from app.models.book import Book
from app.schemas.book import BookCreate, BookOut
from fastapi import HTTPException
from app.utils.embedding import get_embedding
from app.utils.deps import admin_only



router = APIRouter(prefix="/books", tags=["Books"])



@router.post("/", response_model=BookOut, dependencies=[Depends(admin_only)])
def create_book(
    book: BookCreate,
    db: Session = Depends(get_db)
):

    text = f"{book.title} {book.author} {' '.join(book.genre)} {book.description}"
    embedding = get_embedding(text)

    new_book = Book(
        title=book.title,
        author=book.author,
        genre=book.genre,
        description=book.description,
        is_available=True,
        embedding=embedding
    )

    db.add(new_book)
    db.commit()
    db.refresh(new_book)

    return BookOut(
        id=new_book.id,
        title=new_book.title,
        author=new_book.author,
        genre=new_book.genre,
        description=new_book.description,
        is_available=new_book.is_available
    )

    

@router.get("/", response_model=list[BookOut])
def get_books(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):

    books = db.query(Book).offset(skip).limit(limit).all()

    return [
        BookOut(
            id=b.id,
            title=b.title,
            author=b.author,
            genre=b.genre,
            description=b.description,
            is_available=b.is_available
        )
        for b in books
    ]




@router.put("/{book_id}")
def update_book(book_id: int, book: BookCreate, db: Session = Depends(get_db)):

    existing_book = db.query(Book).filter(Book.id == book_id).first()

    if not existing_book:
        raise HTTPException(status_code=404, detail="Book not found")

    existing_book.title = book.title
    existing_book.author = book.author
    existing_book.genre = book.genre
    existing_book.description = book.description

    db.commit()
    db.refresh(existing_book)

    return existing_book


@router.delete("/{book_id}")
def delete_book(book_id: int, db: Session = Depends(get_db)):

    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    db.delete(book)
    db.commit()

    return {"message": "Book deleted successfully"}


@router.get("/search", response_model=list[BookOut])
def search_books(query: str, db: Session = Depends(get_db)):

    query_embedding = get_embedding(query)

    books = (
        db.query(Book)
        .filter(Book.embedding.isnot(None))
        .order_by(Book.embedding.cosine_distance(query_embedding))
        .limit(10)
        .all()
    )

    return [
        BookOut(
            id=book.id,
            title=book.title,
            author=book.author,
            genre=book.genre,
            description=book.description,
            is_available=book.is_available
        )
        for book in books
    ]


@router.get("/available", response_model=List[BookOut])
def available_books(db: Session = Depends(get_db)):

    books = db.query(Book).filter(Book.is_available == True).all()

    return books


@router.get("/genre/{genre}", response_model=List[BookOut])
def books_by_genre(genre: str, db: Session = Depends(get_db)):

    books = db.query(Book).filter(
        cast(Book.genre, String).ilike(f"%{genre}%")
    ).all()

    return books