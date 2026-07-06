from typing import TypedDict
from typing import Optional
from typing import Any


class ChatState(TypedDict):
    session_id: int
    user_id: int

    message: str

    intent: str

    book_id: Optional[int]

    tool_result: Any

    response: str