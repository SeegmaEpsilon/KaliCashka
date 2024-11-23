from datetime import timedelta

from fastapi import APIRouter, HTTPException, Depends

from sqlalchemy.orm import Session

from .models import UserCreate, UserResponse, Message, User
from .database import SessionLocal
from .services import create_user, save_chat_history
from .auth import create_access_token, verify_password, get_current_user
from .config import ACCESS_TOKEN_EXPIRE_MINUTES


# Создаём маршрутизатор
router = APIRouter()


@router.post("/chat")
async def chat_endpoint(message: Message):
    """
    Эндпоинт для чата.
    Принимает сообщение от пользователя и возвращает пример команды.
    """
    user_message = message.message
    response = f"Попробуйте команду: ping {user_message}"
    return {"response": response}


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
def login(user: UserCreate):
    """
    Эндпоинт для входа пользователя.
    """
    db: Session = SessionLocal()
    db_user = db.query(User).filter(User.username == user.username).first()

    # Проверка существования пользователя
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    # Генерация JWT токена
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/protected")
def protected_route(current_user: str = Depends(get_current_user)):
    """
    Пример защищённого маршрута.
    """
    return {"message": f"Привет, {current_user}! Вы имеете доступ к защищённому ресурсу."}

@router.post("/chat")
def chat(message: Message, user_id: int):
    """
    Эндпоинт для чата с сохранением истории.
    """
    response = send_message_to_chatgpt(message.message)
    save_chat_history(user_id=user_id, user_message=message.message, bot_response=response)
    return {"response": response}