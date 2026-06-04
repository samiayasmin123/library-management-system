from sqlalchemy import Column, Integer, ForeignKey, String, Float
from app.database import Base

class Fine(Base):
    __tablename__ = "fines"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"))
    borrow_id = Column(Integer, ForeignKey("borrow_records.id"))

    amount = Column(Float, default=0.0)
    status = Column(String, default="unpaid")  # unpaid / paid