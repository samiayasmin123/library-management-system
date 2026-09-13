import uuid
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from datetime import datetime
from app.database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    # Internal, sequential primary key - used only for foreign key
    # relationships (ChatMessage.session_id) inside the database.
    # Never exposed to the frontend or shown in a URL.
    id = Column(Integer, primary_key=True, index=True)

    # Public-facing identifier - a random UUID, not sequential or
    # guessable. This is what the API returns as "session_id" and
    # what appears in the /chat/<id> URL, the same way Claude uses
    # opaque conversation IDs instead of exposing a raw database
    # row number.
    public_id = Column(
        PG_UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid.uuid4,
        index=True,
    )

    user_id = Column(Integer, ForeignKey("users.id"))

    title = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )