from pydantic import BaseModel

class BookCreate(BaseModel):
    title: str
    author: str
    genre: str
    description: str

class BookResponse(BookCreate):
    id: int
    is_available: bool

    class Config:
        from_attributes = True