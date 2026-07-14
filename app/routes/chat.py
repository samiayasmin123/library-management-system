import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from langchain_core.messages import HumanMessage
from langgraph.types import Command

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.ai.graph import graph
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatSessionOut,
    ChatMessageOut,
)

router = APIRouter(tags=["Chat"])

logger = logging.getLogger(__name__)


def _extract_text(content) -> str:
    """
    AIMessage.content is normally a plain string, but some providers
    (including ChatGoogleGenerativeAI in some responses) return a
    list of content blocks instead, e.g.:
        [{"type": "text", "text": "..."}, {"type": "...", ...}]
    Postgres can't store a list/dict directly in a Text column, so
    this pulls out just the actual text parts and joins them.
    """

    if isinstance(content, str):
        return content

    if isinstance(content, list):

        parts = []

        for block in content:

            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))

        return "".join(parts)

    return str(content)


@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):

    user_id = current_user.id
    message = request.message
    session_id = request.session_id

    # --------------------------
    # Session management
    # --------------------------

    if session_id is None:

        session = ChatSession(
            user_id=user_id,
            title=message[:60],
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        session_id = session.id

    else:

        session = (
            db.query(ChatSession)
            .filter(ChatSession.id == session_id)
            .first()
        )

        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")

        if session.user_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this session",
            )

    # --------------------------
    # Save the user's message
    # --------------------------

    user_message = ChatMessage(
        session_id=session_id,
        role="user",
        message=message,
    )

    db.add(user_message)
    db.commit()

    config = {"configurable": {"thread_id": str(session_id)}}

    # --------------------------
    # Invoke the graph
    # --------------------------

    try:

        if not request.awaiting_confirmation:

            result = graph.invoke(
                {
                    "messages": [HumanMessage(content=message)],
                    "user_id": user_id,
                    "session_id": session_id,
                },
                config=config,
            )

        else:

            result = graph.invoke(
                Command(resume=message),
                config=config,
            )

        # --------------------------
        # Interrupt detection
        # --------------------------

        if "__interrupt__" in result:

            question = result["__interrupt__"][0].value

            system_message = ChatMessage(
                session_id=session_id,
                role="system",
                message=question,
            )

            db.add(system_message)
            db.commit()

            return ChatResponse(
                session_id=session_id,
                response=question,
                awaiting_confirmation=True,
            )

        response_text = _extract_text(result["messages"][-1].content)

        assistant_message = ChatMessage(
            session_id=session_id,
            role="assistant",
            message=response_text,
        )

        db.add(assistant_message)
        db.commit()

        return ChatResponse(
            session_id=session_id,
            response=response_text,
            awaiting_confirmation=False,
        )

    except Exception:

        logger.exception(
            "Chat graph invocation failed for session_id=%s", session_id
        )

        return ChatResponse(
            session_id=session_id,
            response="I'm sorry, something went wrong. Please try again.",
            awaiting_confirmation=False,
        )


# ===================================================
# LIST MY CHAT SESSIONS
# ===================================================

@router.get("/chat/sessions", response_model=list[ChatSessionOut])
def list_chat_sessions(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):

    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )

    return sessions


# ===================================================
# GET MESSAGES FOR ONE SESSION
# ===================================================

@router.get(
    "/chat/sessions/{session_id}/messages",
    response_model=list[ChatMessageOut],
)
def get_chat_session_messages(
    session_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):

    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id)
        .first()
    )

    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this session",
        )

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return messages