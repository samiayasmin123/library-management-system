from app.database import SessionLocal
from app.models import Book, Category


def book_seeder():
    import csv
    with open("data/Best_Books_Ever.csv", "r") as file:
        reader = csv.reader(file)
        next(reader)
        batch = []
        for i, row in enumerate(reader):
            batch.append(Book(title=row[1], author=row[3], genre=row[8], description=row[5]))

        db = SessionLocal()
        db.add_all(batch)
        db.commit()
        db.close()
