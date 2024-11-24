from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Подключение к SQLite
DATABASE_URL = "sqlite:///./app.db"

# Создание подключения
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовая модель для определения таблиц
Base = declarative_base()
metadata = MetaData()


def init_db():
    from .models import User, ChatHistory, CommandHistory
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    """
    Генератор сессий базы данных.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
