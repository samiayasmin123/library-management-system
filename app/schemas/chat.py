from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    message: str
    session_id: UUID | None = None
    awaiting_confirmation: bool = False


class ChatMessageOut(BaseModel):
    id: int
    role: str
    message: str
    created_at: datetime
    metadata_: dict | None = None

    model_config = ConfigDict(from_attributes=True)


class ChatSessionOut(BaseModel):
    # Exposed as "id" to the frontend, but sourced from the model's
    # public_id (a UUID) rather than its internal integer primary
    # key - callers never see the sequential database ID.
    id: UUID = Field(validation_alias="public_id")
    user_id: int
    title: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ChatResponse(BaseModel):
    session_id: UUID
    response: str
    awaiting_confirmation: bool