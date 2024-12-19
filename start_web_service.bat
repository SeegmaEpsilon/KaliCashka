@echo off
chcp 65001 > nul
:: Запуск бэкенда

echo Перемещение в папку backend...
cd backend

echo Активация виртуального окружения...
call venv\Scripts\activate

:: Запускаем бэкенд в новом окне
echo Запуск бэкенда...
start cmd /k "cd /d %cd% && call venv\Scripts\activate && uvicorn main:app --reload"

:: Возвращаемся в корневую папку
cd ..

:: Запуск фронтенда

echo Перемещение в папку frontend...
cd frontend

:: Запускаем фронтенд в новом окне
echo Запуск фронтенда...
start cmd /k "cd /d %cd% && npm start"

echo Проект запущен! Бэкенд доступен по адресу http://127.0.0.1:8000
echo Фронтенд доступен по адресу http://localhost:3000

pause
