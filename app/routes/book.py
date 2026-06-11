from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.book import Book
from app.schemas.book import BookCreate, BookOut
from fastapi import HTTPException
from app.utils.embedding import get_embedding


router = APIRouter(prefix="/books", tags=["Books"])



@router.post("/", response_model=BookOut)
def create_book(book: BookCreate, db: Session = Depends(get_db)):

    
        text = f"{book.title} {book.author} {book.genre} {book.description}"
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

        return new_book
    


    

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


@router.get("/search")
def search_books(query: str, db: Session = Depends(get_db)):

    books = db.query(Book).filter(
        or_(
            Book.title.ilike(f"%{query}%"),
            Book.author.ilike(f"%{query}%")
        )
    ).all()

    return books


@router.get("/available")
def available_books(db: Session = Depends(get_db)):

    books = db.query(Book).filter(Book.is_available == True).all()

    return books


@router.get("/genre/{genre}")
def books_by_genre(genre: str, db: Session = Depends(get_db)):

    books = db.query(Book).filter(
        Book.genre.ilike(f"%{genre}%")
    ).all()

    return books

