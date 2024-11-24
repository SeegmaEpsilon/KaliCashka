from fastapi import FastAPI
from app.routes import router
from app.database import init_db

# Инициализация базы данных
init_db()

# Создаём приложение FastAPI
app = FastAPI(
    title="KaliCashka API",
    description="Бэкенд для управления командами Kali Linux через чат",
    version="1.0.0",
)

# Подключаем маршруты из файла routes.py
app.include_router(router)
