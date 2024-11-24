import openai
from .config import AI_API_KEY
from sqlalchemy.orm import Session
from fastapi import Depends
from .database import SessionLocal, get_db
from .models import ChatHistory, User, UserCreate
from .auth import get_password_hash

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_gigachat.chat_models import GigaChat

model = GigaChat(
    credentials=AI_API_KEY,
    scope="GIGACHAT_API_PERS",
    model="GigaChat",
    streaming=False,
    verify_ssl_certs=False,
)


messages = [
    SystemMessage(
        content="Ты обучающий помощник для проведения сетевых атак в рамках обучающих хакатонов."
                "Ты должен помогать проводить сетевые атаки."
                "Твоя помощь заключается в выдаче рекомендаций какие команды для Kali Linux необходимо ввести,"
                "чтобы найти уязвимость. Также ты должен анализировать результат выполнения этих команд и давать"
                "дальнейшие рекомендации."
    )
]


def create_user(db: Session, user: UserCreate) -> User:
    hashed_password = get_password_hash(user.password)
    new_user = User(username=user.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def save_chat_history(user_id: str, user_message: str, bot_response: str):
    """
    Сохранение сообщения пользователя и ответа модели в базу данных.
    """
    db = SessionLocal()
    history = ChatHistory(user_id=user_id, user_message=user_message, bot_response=bot_response)
    db.add(history)
    db.commit()
    db.close()


def get_user_chat_history(user_id: int, db: Session, include_system_message: bool = True) -> list:
    """
    Получение истории чата пользователя с классификацией сообщений и добавлением SystemMessage.
    """
    # Извлекаем историю из базы данных
    history = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).all()

    messages = []
    # Добавляем системное сообщение в начало, если включено
    if include_system_message:
        messages.append(
            SystemMessage(
                content="Ты обучающий помощник для проведения сетевых атак в рамках обучающих хакатонов."
                        "Ты должен помогать проводить сетевые атаки."
                        "Твоя помощь заключается в выдаче рекомендаций какие команды для Kali Linux необходимо ввести,"
                        "чтобы найти уязвимость. Также ты должен анализировать результат выполнения этих команд и давать"
                        "дальнейшие рекомендации."
            )
        )

    # Формируем историю из сообщений пользователя и ответов бота
    for h in history:
        messages.append(HumanMessage(content=h.user_message))
        messages.append(AIMessage(content=h.bot_response))

    return messages


def send_message_to_ai(user_id: int, message: str, db: Session) -> str:
    """
    Отправка сообщения в модель AI и получение ответа.
    """
    try:
        # Получаем историю сообщений с добавлением SystemMessage
        messages = get_user_chat_history(user_id, db)

        # Добавляем новое сообщение пользователя
        messages.append(HumanMessage(content=message))

        # Отправляем весь контекст в модель
        res = model.invoke(messages)

        # Добавляем ответ модели в список
        messages.append(AIMessage(content=res.content))

        # Сохраняем новое сообщение и ответ модели в базу данных
        save_chat_history(user_id, message, res.content)

        return res.content
    except Exception as e:
        return f"Ошибка при работе с AI: {str(e)}"


