from datetime import timedelta

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .models import UserCreate, UserResponse, Message, User, ChatHistory
from .database import SessionLocal, get_db
from .services import create_user, save_chat_history, send_message_to_ai
from .auth import create_access_token, verify_password, get_current_user
from .config import ACCESS_TOKEN_EXPIRE_MINUTES


# Создаём маршрутизатор
router = APIRouter()


# Создание пользователя
@router.post("/register", response_model=UserResponse)
def register(user: UserCreate):
    db: Session = SessionLocal()
    existing_user = db.query(User).filter_by(username=user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    created_user = create_user(db, user)
    return created_user


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db: Session = SessionLocal()
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/protected")
def protected_route(current_user: str = Depends(get_current_user)):
    """
    Пример защищённого маршрута.
    """
    return {"message": f"Привет, {current_user}! Вы имеете доступ к защищённому ресурсу."}


@router.post("/chat")
def chat(message: Message, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Эндпоинт для отправки сообщения в GigaChat.
    """
    user_id = current_user["username"]  # Извлекаем логин пользователя
    response = send_message_to_ai(user_id, message.message, db)
    return {"response": response}



@router.get("/chat-history")
def get_user_chat_history(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Эндпоинт для получения истории чата текущего пользователя.
    """
    username = current_user["username"]  # Извлекаем логин пользователя
    history = db.query(ChatHistory).filter(ChatHistory.user_id == username).all()
    return {"history": history}


@router.delete("/chat-history")
def clear_chat_history(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Эндпоинт для очистки истории чата текущего пользователя.
    """
    username = current_user["username"]  # Используем логин пользователя
    deleted_count = db.query(ChatHistory).filter(ChatHistory.user_id == username).delete()
    db.commit()
    return {"message": f"История чата очищена. Удалено записей: {deleted_count}"}

