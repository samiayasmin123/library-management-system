from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey

from app.database import Base


class BookCopy(Base):

    __tablename__ = "book_copies"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)

    copy_number = Column(Integer, nullable=False)

    condition = Column(String, default="good", nullable=False)

    status = Column(String, default="available", nullable=False)

    acquired_date = Column(Date, nullable=True)

    notes = Column(Text, nullable=True)