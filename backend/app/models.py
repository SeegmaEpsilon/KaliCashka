from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Text
from .database import Base


# Модель для авторизации
class User(BaseModel):
    username: str
    password: str


# Модель для сообщений
class Message(BaseModel):
    message: str


# Таблица пользователей
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)


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


# Таблица истории сообщений
class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)  # Внешний ключ можно добавить позже
    user_message = Column(Text)
    bot_response = Column(Text)


# Таблица выполненных команд
class CommandHistory(Base):
    __tablename__ = "command_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)  # Внешний ключ можно добавить позже
    command = Column(Text)
    result = Column(Text)
