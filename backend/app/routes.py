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
def chat(message: Message, current_user: int = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Эндпоинт для чата.
    """
    response = send_message_to_ai(user_id=current_user, message=message.message, db=db)
    save_chat_history(user_id=current_user, user_message=message.message, bot_response=response)
    return {"response": response}


@router.get("/chat-history/{user_id}")
def get_user_chat_history(user_id: int, db: Session = Depends(get_db)):
    """
    Эндпоинт для получения истории чата пользователя.
    """
    print(f"db type: {type(db)}")  # Отладка
    return db.query(ChatHistory).filter(ChatHistory.user_id == user_id).all()
