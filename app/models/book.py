#from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
#from app.database import Base

#class Book(Base):
    #__tablename__ = "books"

    #id = Column(Integer, primary_key=True, index=True)

    #title = Column(String, nullable=False)
    #author = Column(String, nullable=False)
    #genre = Column(String)
    #description = Column(String)

    #is_available = Column(Boolean, default=True)

    ##category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
from sqlalchemy import Column, Integer, String, Text, Boolean
from pgvector.sqlalchemy import Vector

from app.database import Base


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    author = Column(String)
    genre = Column(Text)
    description = Column(Text)
    is_available = Column(Boolean, default=True)

    embedding = Column(Vector(384))