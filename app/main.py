from fastapi import FastAPI
from app.database import Base, engine
from app.routes.book import router as book_router
from app.routes.auth import router as auth_router
from app.routes.borrow import router as borrow_router
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.pending_action import PendingAction
from app.routes.chat import router as chat_router
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse


app = FastAPI(
    title="Library Management System"
)

app.include_router(chat_router)


app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/")
def home():
    return FileResponse("app/static/index.html")


# Register routers
app.include_router(auth_router)
app.include_router(book_router)
app.include_router(borrow_router)


@app.get("/")
def home():
    return {
        "message": "Library Management System API is running."
    }