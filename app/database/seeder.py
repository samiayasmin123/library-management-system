#from app.database import SessionLocal
#from app.models import Book, Category


##def book_seeder():
    #import csv
    #with open("data/Best_Books_Ever.csv", "r") as file:
        #reader = csv.reader(file)
        #next(reader)
        #batch = []
        #for i, row in enumerate(reader):
            #batch.append(Book(title=row[1], author=row[3], genre=row[8], description=row[5]))

        #db = SessionLocal()
        #db.add_all(batch)
        #db.commit()
        #db.close()

from app.database import SessionLocal
from app.models.book import Book
from app.utils.embedding import get_embedding
import csv


def book_seeder():
    db = SessionLocal()

    try:
        books = []

        with open("data/Best_Books_Ever.csv", "r", encoding="utf-8") as file:
            reader = csv.DictReader(file)

            for i, row in enumerate(reader):
                # 1. Create combined text for embedding
                text = f"{row['title']} {row['genres']} {row['description']}"

                # 2. Get embedding vector
                embedding = get_embedding(text)

                # 3. Create Book object
                book = Book(
                    title=row["title"],
                    author=row["author"],
                    genre=row["genres"],
                    description=row["description"],
                    is_available=True,
                    embedding=embedding
                )

                books.append(book)
                if i == 0:
                   
                   break


        
        db.add_all(books)
        db.commit()

        print(f"Books seeded successfully: {len(books)} records inserted")

    except Exception as e:
        db.rollback()
        print("Seeding failed:", e)

    finally:
        db.close()