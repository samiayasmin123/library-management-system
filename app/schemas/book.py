from pydantic import BaseModel
from typing import List


class BookCreate(BaseModel):
    title: str
    author: str
    genre: List[str]
    description: str

class BookOut(BaseModel):
    id: int
    title: str
    author: str
    genre: List[str]
    description: str
    is_available: bool

    class Config:
        from_attributes = True