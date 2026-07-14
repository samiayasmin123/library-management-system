from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BorrowRecordOut(BaseModel):

    id: int
    user_id: int
    book_id: int
    copy_id: int | None = None
    borrow_date: datetime
    return_date: datetime | None = None
    status: str

    model_config = ConfigDict(from_attributes=True)