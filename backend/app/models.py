from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from .database import Base
from sqlalchemy.orm import relationship


# Модель для авторизации
class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Отношение к модели ChatHistory
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")


# Модель для сообщений
class Message(BaseModel):
    message: str


class CommandRequest(BaseModel):
    command: str


# Схема для ответа API (без пароля)
class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        orm_mode = True  # Позволяет использовать SQLAlchemy объекты


# Схема для создания пользователя
class UserCreate(BaseModel):
    username: str
    password: str


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)  # ForeignKey связывает с таблицей User
    user_message = Column(String, nullable=False)
    bot_response = Column(String, nullable=False)

    # Отношение к модели User
    user = relationship("User", back_populates="chat_history")


# Таблица выполненных команд
class CommandHistory(Base):
    __tablename__ = "command_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)  # Внешний ключ можно добавить позже
    command = Column(Text)
    result = Column(Text)


class PentestRequest(BaseModel):
    target: str        # IP/хост
    service: str       # “http”, “ssh” …
