from sqlalchemy import Column, Integer, ForeignKey, DateTime, String
from datetime import datetime
from app.database import Base

class BorrowRecord(Base):
    __tablename__ = "borrow_records"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"))
    book_id = Column(Integer, ForeignKey("books.id"))

    borrow_date = Column(DateTime, default=datetime.utcnow)
    return_date = Column(DateTime, nullable=True)

    status = Column(String, default="borrowed")  # borrowed / returned