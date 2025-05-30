from fastapi import FastAPI, WebSocket, Depends
from app.routes import router
from app.database import init_db
from fastapi.middleware.cors import CORSMiddleware
from app.ws import router_ws


# Инициализация базы данных
init_db()

# Создаём приложение FastAPI
app = FastAPI(
    title="KaliKashka Stepan",
    description="Бэкенд для управления командами Kali Linux через чат",
    version="1.0.0",
)

# Подключаем маршруты из файла routes.py
app.include_router(router_ws)
app.include_router(router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Разрешённый источник (фронтенд)
    allow_credentials=True,
    allow_methods=["*"],  # Разрешённые методы (GET, POST, OPTIONS и т.д.)
    allow_headers=["*"],  # Разрешённые заголовки (например, Authorization)
)


