from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.ai.graph import graph
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.schemas.chat import ChatRequest

router = APIRouter(tags=["Chat"])


@router.post("/chat")
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
):

    user_id = request.user_id
    message = request.message
    session_id = request.session_id

    # --------------------------
    # Create new session
    # --------------------------

    if session_id is None:

        session = ChatSession(
            user_id=user_id
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        session_id = session.id

    # --------------------------
    # Save user message
    # --------------------------

    user_message = ChatMessage(
        session_id=session_id,
        role="user",
        message=message
    )

    db.add(user_message)
    db.commit()

    # --------------------------
    # Run LangGraph
    # --------------------------

    result = graph.invoke(
        {
            "session_id": session_id,
            "user_id": user_id,
            "message": message,
            "intent": "",
            "book_id": None,
            "tool_result": {},
            "response": ""
        }
    )

    # --------------------------
    # Save AI response
    # --------------------------

    assistant_message = ChatMessage(
        session_id=session_id,
        role="assistant",
        message=result["response"]
    )

    db.add(assistant_message)
    db.commit()

    return {
        "session_id": session_id,
        "response": result["response"]
    }