from app.database import SessionLocal
from app.models.book import Book
from app.utils.embedding import get_embedding
import csv
import os


def book_seeder():
    db = SessionLocal()
    books = []

    try:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        CSV_PATH = os.path.join(BASE_DIR, "../../data/Best_Books_Ever.csv")

        with open(CSV_PATH, "r", encoding="utf-8") as file:
            reader = csv.DictReader(file)

            for i, row in enumerate(reader):

                # STOP AFTER 100 BOOKS
                if i >= 100:
                    break

                text = f"{row.get('title','')} {row.get('genres','')} {row.get('description','')}"
                embedding = get_embedding(text)

                books.append(
                    Book(
                        title=row.get("title", ""),
                        author=row.get("author", ""),
                        genre=row.get("genres", ""),
                        description=row.get("description", ""),
                        is_available=True,
                        embedding=embedding
                    )
                )

            db.add_all(books)
            db.commit()

        print("SEEDING COMPLETED: 100 BOOKS ONLY")

    except Exception as e:
        db.rollback()
        print("ERROR:", e)

    finally:
        db.close()