from contextlib import asynccontextmanager

from fastapi import FastAPI
from app.database import Base, engine
from app.routes.book import router as book_router
from app.routes.auth import router as auth_router
from app.routes.borrow import router as borrow_router
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.routes.chat import router as chat_router
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.routes.book_copy import router as book_copy_router
from app.utils.embedding import get_embedding


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_embedding("warmup")
    yield


app = FastAPI(
    title="Library Management System",
    lifespan=lifespan,
)

app.include_router(chat_router)
app.include_router(book_copy_router)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/")
def home():
    return FileResponse("app/static/index.html")


# Register routers
app.include_router(auth_router)
app.include_router(book_router)
app.include_router(borrow_router)