from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import ChatHistory, User, UserCreate
from .auth import get_password_hash


def create_user(db: Session, user: UserCreate) -> User:
    hashed_password = get_password_hash(user.password)
    new_user = User(username=user.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def save_chat_history(user_id: int, user_message: str, bot_response: str):
    db = SessionLocal()
    history = ChatHistory(user_id=user_id, user_message=user_message, bot_response=bot_response)
    db.add(history)
    db.commit()
    db.refresh(history)
    db.close()