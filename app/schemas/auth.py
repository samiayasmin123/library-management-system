from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "member"


class UserLogin(BaseModel):
    email: EmailStr
    password: str

