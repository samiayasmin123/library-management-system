from pydantic import BaseModel

class BookCreate(BaseModel):
    title: str
    author: str
    genre: str
    description: str

class BookOut(BaseModel):
    id: int
    title: str
    author: str
    genre: str
    description: str
    is_available: bool

    class Config:
        from_attributes = True