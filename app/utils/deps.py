from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from app.utils.jwt import verify_token
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.user import User

security = HTTPBearer()

def get_current_user(token=Depends(security), db: Session = Depends(get_db)):

    payload = verify_token(token.credentials)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == payload["user_id"]).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user

def admin_only(user=Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only access")
    return user