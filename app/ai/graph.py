from langgraph.graph import StateGraph, END

from app.ai.state import ChatState
from app.ai.agent import agent
from app.database import SessionLocal
from app.ai import tools
from app.ai.rag import retrieve_context


def detect_intent(state: ChatState):

    message = state["message"].lower().strip()

    if message in ["yes", "y"]:
        return {"intent": "confirm"}

    if message in ["no", "n"]:
        return {"intent": "cancel"}

    if "tell me about" in message or "description" in message or "details" in message:
        return {"intent": "details"}

    if "search" in message:
        return {"intent": "search"}

    if "available" in message:
        return {"intent": "availability"}

    if "borrow" in message:
        return {"intent": "borrow"}

    if "return" in message:
        return {"intent": "return"}

    if (
        "recommend" in message
        or "suggest" in message
        or "recommendation" in message
    ):
        return {"intent": "recommend"}

    if (
        "my books" in message
        or "borrowed books" in message
        or "active books" in message
    ):
        return {"intent": "active"}

    return {"intent": "chat"}


# -------------------------------------------------
# Execute Tool
# -------------------------------------------------

def tool_node(state: ChatState):

    db = SessionLocal()

    try:

        intent = state["intent"]
        message = state["message"]

        session_id = state["session_id"]
        user_id = state["user_id"]

        # =====================================================
        # BOOK DETAILS
        # =====================================================

        if intent == "details":

            query = (
                message.lower()
                .replace("tell me about", "")
                .replace("description", "")
                .replace("details", "")
                .replace("about", "")
                .strip()
            )

            book = tools.get_book_details(query, db)

            if book is None:

                result = "Book not found."

            else:

                status = (
                    "Available"
                    if book["available"]
                    else "Borrowed"
                )

                genre = (
                    ", ".join(book["genre"])
                    if isinstance(book["genre"], list)
                    else book["genre"]
                )

                result = (
                    f"Title: {book['title']}\n"
                    f"Author: {book['author']}\n"
                    f"Genre: {genre}\n"
                    f"Description: {book['description']}\n"
                    f"Status: {status}"
                )

        # =====================================================
        # SEARCH BOOKS
        # =====================================================

        elif intent == "search":

            query = (
                message.lower()
                .replace("search", "")
                .replace("for", "")
                .strip()
            )

            books = tools.search_books(query, db)

            if books:

                text = ""

                for book in books:

                    availability = (
                        "Available"
                        if book["available"]
                        else "Not Available"
                    )

                    text += (
                        f"Title: {book['title']}\n"
                        f"Author: {book['author']}\n"
                        f"Status: {availability}\n\n"
                    )

                result = text

            else:

                result = "No matching books found."

        # =====================================================
        # AVAILABILITY
        # =====================================================

        elif intent == "availability":

            result = "Availability feature coming soon."

        # =====================================================
        # BORROW
        # =====================================================

        elif intent == "borrow":

            query = (
                message.lower()
                .replace("borrow", "")
                .replace("book", "")
                .strip()
            )

            books = tools.search_books(query, db)

            if not books:

                result = "No matching books found."

            else:

                first_book = books[0]

                tools.stage_borrow(
                    session_id=session_id,
                    book_id=first_book["id"],
                    db=db
                )

                result = (
                    f'I found "{first_book["title"]}".\n\n'
                    "Reply YES to borrow this book."
                )

        # =====================================================
        # RETURN
        # =====================================================

        elif intent == "return":

            query = (
                message.lower()
                .replace("return", "")
                .replace("book", "")
                .strip()
            )

            book = tools.find_user_borrowed_book(
                user_id=user_id,
                query=query,
                db=db
            )

            if book is None:

                result = "You have not borrowed this book."

            else:

                tools.stage_return(
                    session_id=session_id,
                    book_id=book["book_id"],
                    db=db
                )

                result = (
                    f'I found "{book["title"]}".\n\n'
                    "Reply YES to return this book."
                )

        # =====================================================
        # CONFIRM
        # =====================================================

        elif intent == "confirm":

            pending = tools.get_pending_action(
                session_id=session_id,
                db=db
            )

            if pending is None:

                result = "There is no pending action."

            elif pending.action == "borrow":

                result = tools.execute_borrow(
                    session_id=session_id,
                    user_id=user_id,
                    db=db
                )["message"]

            elif pending.action == "return":

                result = tools.execute_return(
                    session_id=session_id,
                    user_id=user_id,
                    db=db
                )["message"]

            else:

                result = "Unknown pending action."

        # =====================================================
        # CANCEL
        # =====================================================

        elif intent == "cancel":

            pending = tools.get_pending_action(
                session_id=session_id,
                db=db
            )

            if pending:

                db.delete(pending)
                db.commit()

            result = "Request cancelled."

        # =====================================================
        # RECOMMEND BOOKS
        # =====================================================

        elif intent == "recommend":

            query = (
                message.lower()
                .replace("recommend", "")
                .replace("suggest", "")
                .replace("books", "")
                .replace("book", "")
                .strip()
            )

            books = tools.recommend_books(query, db)

            if not books:

                result = "No recommendations found."

            else:

                text = " AI Recommended Books:\n\n"

                for book in books:

                    status = (
                        "Available"
                        if book["available"]
                        else "Borrowed"
                    )

                    text += (
                        f"Title: {book['title']}\n"
                        f"Author: {book['author']}\n"
                        f"Status: {status}\n\n"
                        f"Similarity Score: {book['score']}\n\n"
                    )

                result = text

        # =====================================================
        # ACTIVE BORROWED BOOKS
        # =====================================================

        elif intent == "active":

            borrows = tools.get_active_borrows(
                user_id=user_id,
                db=db
            )

            if not borrows:

                result = "You have no borrowed books."

            else:

                text = "Your borrowed books:\n\n"

                for borrow in borrows:

                    text += f"• Book ID: {borrow.book_id}\n"

                result = text

        # =====================================================
        # CHAT
        # =====================================================

        else:

            result = ""

        return {
            "tool_result": result
        }

    finally:

        db.close()


# -------------------------------------------------
# AI Response
# -------------------------------------------------

def response_node(state: ChatState):

    db = SessionLocal()

    try:

        tool_result = state["tool_result"]

        # If tool already produced a response,
        # don't call Gemini.

        if tool_result != "":

            return {
                "response": tool_result
            }

        # -------------------------
        # RAG
        # -------------------------

        context = retrieve_context(
            state["message"],
            db
        )

        prompt = f"""
You are an AI Library Assistant.

Answer ONLY using the information below.

If the answer is not present,
say you couldn't find it.

Library Information

{context}

User Question

{state["message"]}
"""

        result = agent.run_sync(prompt)

        return {

            "response": result.output

        }

    finally:

        db.close()


# -------------------------------------------------
# Build LangGraph
# -------------------------------------------------

builder = StateGraph(ChatState)

builder.add_node("intent", detect_intent)

builder.add_node("tool", tool_node)

builder.add_node("response", response_node)

builder.set_entry_point("intent")

builder.add_edge("intent", "tool")

builder.add_edge("tool", "response")

builder.add_edge("response", END)

graph = builder.compile()