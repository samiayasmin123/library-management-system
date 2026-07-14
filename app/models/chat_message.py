from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from datetime import datetime
from app.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)

    session_id = Column(Integer, ForeignKey("chat_sessions.id"))

    role = Column(String)      # user / assistant / system

    message = Column(Text)

    metadata_ = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)