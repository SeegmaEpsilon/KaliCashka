from datetime import timedelta

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from fastapi import BackgroundTasks              # ↑ добавьте импорт
from .models import PentestRequest

from .models import UserCreate, UserResponse, Message, User, ChatHistory, CommandRequest
from .database import SessionLocal, get_db
from .services import create_user, save_chat_history, send_message_to_ai, execute_command_on_kali, auto_pentest_loop
from .auth import create_access_token, verify_password, get_current_user
from .config import ACCESS_TOKEN_EXPIRE_MINUTES
from .prompts import *


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


# routes.py
@router.post("/chat")
def chat(message: Message, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Эндпоинт для отправки сообщения в GigaChat.
    """
    user_id = current_user["id"]  # Используем числовой ID пользователя

    chat_prompt = DEFAULT_CHAT_PROMPT.format(prompt_text=message.message)
    response = send_message_to_ai(user_id, chat_prompt, db)
    return {"response": response}


@router.get("/chat-history")
def get_user_chat_history(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Эндпоинт для получения истории чата текущего пользователя.
    """
    username = current_user["username"]  # Извлекаем логин пользователя
    history = db.query(ChatHistory).filter(ChatHistory.user_id == current_user["id"]).all()

    # Преобразуем объекты в JSON-совместимый формат
    serialized_history = [
        {"user": item.user_message, "bot": item.bot_response} for item in history
    ]

    return {"history": serialized_history}


@router.delete("/chat-history")
def clear_chat_history(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Эндпоинт для очистки истории чата текущего пользователя.
    """
    username = current_user["username"]  # Используем логин пользователя
    deleted_count = db.query(ChatHistory).filter(ChatHistory.user_id == current_user["id"]).delete()
    db.commit()
    return {"message": f"История чата очищена. Удалено записей: {deleted_count}"}


@router.post("/execute-command")
def execute_command(
    request: CommandRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Эндпоинт для выполнения команды на Kali Linux.
    """
    output, error = execute_command_on_kali(request.command)

    if error:
        raise HTTPException(status_code=500, detail=f"Ошибка выполнения команды: {error}")

    return {"output": output}


@router.post("/auto-pentest")
async def auto_pentest(
    req: PentestRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    background.add_task(
        auto_pentest_loop,
        req.target,
        req.service,
        current_user["username"],               # или ["id"] — как используете в ws_manager
        db,
    )
    return {"detail": "started"}


