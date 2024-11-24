import os


SECRET_KEY = "your_secret_key_here"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Путь до базы данных
DATABASE_URL = "sqlite:///./app.db"

# Конфигурация для AI
AI_API_KEY = os.getenv("AI_API_KEY")

# Настройки Kali Linux
KALI_HOST = "192.168.1.100"
USERNAME = "root"
PASSWORD = "password"
