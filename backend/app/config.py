import os


SECRET_KEY = "SECRET_KEY"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Путь до базы данных
DATABASE_URL = "sqlite:///./app.db"

# Конфигурация для AI
AI_API_KEY = os.getenv("AI_API_KEY")