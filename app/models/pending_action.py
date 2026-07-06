from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from datetime import datetime
from app.database import Base


class PendingAction(Base):
    __tablename__ = "pending_actions"

    id = Column(Integer, primary_key=True, index=True)

    session_id = Column(Integer, ForeignKey("chat_sessions.id"))

    action = Column(String)      # borrow / return

    book_id = Column(Integer, ForeignKey("books.id"))

    status = Column(String, default="pending")

    created_at = Column(DateTime, default=datetime.utcnow)