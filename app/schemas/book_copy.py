from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator


ALLOWED_CONDITIONS = {"good", "fair", "poor", "damaged"}
ALLOWED_STATUSES = {"available", "borrowed", "lost", "retired"}


# ===================================================
# CREATE
# ===================================================

class BookCopyCreate(BaseModel):

    condition: str = "good"
    acquired_date: date | None = None
    notes: str | None = None

    @field_validator("condition")
    @classmethod
    def validate_condition(cls, value: str) -> str:

        if value not in ALLOWED_CONDITIONS:

            raise ValueError(
                f"Invalid condition '{value}'. "
                f"Must be one of {sorted(ALLOWED_CONDITIONS)}."
            )

        return value


# ===================================================
# UPDATE
# ===================================================

class BookCopyUpdate(BaseModel):

    condition: str | None = None
    acquired_date: date | None = None
    notes: str | None = None
    status: str | None = None

    @field_validator("condition")
    @classmethod
    def validate_condition(cls, value: str | None) -> str | None:

        if value is not None and value not in ALLOWED_CONDITIONS:

            raise ValueError(
                f"Invalid condition '{value}'. "
                f"Must be one of {sorted(ALLOWED_CONDITIONS)}."
            )

        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:

        if value is not None and value not in ALLOWED_STATUSES:

            raise ValueError(
                f"Invalid status '{value}'. "
                f"Must be one of {sorted(ALLOWED_STATUSES)}."
            )

        return value


# ===================================================
# OUTPUT
# ===================================================

class BookCopyOut(BaseModel):

    id: int
    book_id: int
    copy_number: int
    condition: str
    status: str
    acquired_date: date | None = None
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


# ===================================================
# SUMMARY
# ===================================================

class BookCopySummary(BaseModel):

    total: int
    available: int
    borrowed: int
    lost: int
    retired: int