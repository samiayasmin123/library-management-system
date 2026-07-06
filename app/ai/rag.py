from sqlalchemy.orm import Session
import numpy as np

from app.models.book import Book
from app.utils.embedding import get_embedding
from app.utils.similarity import cosine_similarity


def retrieve_context(query: str, db: Session):

    query_embedding = np.array(get_embedding(query))

    books = db.query(Book).all()

    scored = []

    for book in books:

        if book.embedding is None:
            continue

        score = cosine_similarity(
            query_embedding,
            np.array(book.embedding)
        )

        scored.append((score, book))

    scored.sort(
        key=lambda x: x[0],
        reverse=True
    )

    context = ""

    for score, book in scored[:3]:

        context += (
            f"Title: {book.title}\n"
            f"Author: {book.author}\n"
            f"Genre: {book.genre}\n"
            f"Description: {book.description}\n\n"
        )

    return context