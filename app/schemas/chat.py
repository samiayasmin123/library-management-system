from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatRequest(BaseModel):
    message: str
    session_id: int | None = None
    awaiting_confirmation: bool = False


class ChatMessageOut(BaseModel):
    id: int
    role: str
    message: str
    created_at: datetime
    metadata_: dict | None = None

    model_config = ConfigDict(from_attributes=True)


class ChatSessionOut(BaseModel):
    id: int
    user_id: int
    title: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ChatResponse(BaseModel):
    session_id: int
    response: str
    awaiting_confirmation: bool