import re
import paramiko
import subprocess
import requests
import json
from typing import Tuple
from .config import AI_API_KEY
from sqlalchemy.orm import Session
from .prompts import *
from .database import SessionLocal, get_db
from .models import ChatHistory, User, UserCreate
from .auth import get_password_hash

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_gigachat.chat_models import GigaChat


api_key = AI_API_KEY


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


def remove_think_block(text: str) -> str:
    """
    Удаляет блок <think>...</think> из текста.
    """
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def send_message_to_ai(user_id: int, message: str, db: Session) -> str:
    """
    Отправка сообщения в модель Novita AI и получение ответа.
    """
    try:
        # Загружаем историю чата (user_message и bot_response)
        history = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).all()

        # Начинаем с system-подсказки
        formatted_messages = [{
            "role": "user",
            "content": (
                "Ты обучающий помощник для проведения сетевых атак в рамках обучающих хакатонов. "
                "Ты должен помогать проводить сетевые атаки. Твоя помощь заключается в выдаче рекомендаций, "
                "какие команды для Kali Linux необходимо ввести, чтобы найти уязвимость. Также ты должен анализировать "
                "результат выполнения этих команд и давать дальнейшие рекомендации."
            )
        }]

        # Добавляем историю чата (user + assistant)
        for entry in history:
            formatted_messages.append({"role": "user", "content": entry.user_message})
            formatted_messages.append({"role": "assistant", "content": entry.bot_response})

        # Добавляем текущее сообщение
        formatted_messages.append({"role": "user", "content": message})

        # Формируем тело запроса
        request_data = {
            "model": "deepseek/deepseek-r1-turbo",
            "messages": formatted_messages,
            "response_format": {"type": "text"}
        }

        # Настройки запроса
        base_url = "https://api.novita.ai/v3/openai/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        # Отправляем запрос
        response = requests.post(base_url, headers=headers, data=json.dumps(request_data))

        if response.status_code != 200:
            raise Exception(f"Ошибка HTTP {response.status_code}: {response.text}")

        # Получаем ответ
        res_json = response.json()
        model_response = res_json["choices"][0]["message"]["content"]

        # Сохраняем сообщение и ответ
        save_chat_history(user_id, message, model_response)

        print(f"📤 Отправлено: {message}")
        print(f"📥 Ответ: {model_response}")

        formatted_model_response = remove_think_block(model_response)

        return formatted_model_response

    except Exception as e:
        error_msg = f"Ошибка при работе с AI: {str(e)}"
        print(error_msg)
        return error_msg


def execute_command_on_kali(command: str) -> Tuple[str, str]:
    """
    Выполняет команду на удалённой машине Kali Linux через SSH.
    """
    import os
    host = os.getenv("KALI_SSH_HOST")  # IP Kali Linux
    port = int(os.getenv("KALI_SSH_PORT"))  # Порт SSH
    username = os.getenv("KALI_SSH_USER")  # Имя пользователя SSH
    password = os.getenv("KALI_SSH_PASSWORD")  # Пароль SSH

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, port, username, password)
        stdin, stdout, stderr = client.exec_command(command)
        output = stdout.read().decode('utf-8').strip()
        error = stderr.read().decode('utf-8').strip()
        return output, error
    finally:
        client.close()


def is_ip_reachable(ip: str) -> bool:
    """
    Проверка доступности IP-адреса в локальной сети (с помощью ping).
    """
    try:
        # Пинг до IP для Linux/Unix
        result = subprocess.run(["ping", "-n", "1", ip], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        # Если статус завершения команды == 0, значит IP доступен
        return result.returncode == 0
    except Exception as e:
        print(f"Ошибка при пинге: {str(e)}")
        return False


def extract_command_and_stage_from_response(text: str) -> tuple[str, str] | None:
    """
    Извлекает название этапа и команду Linux из ответа модели.
    Название этапа в <...>, а команда — в `` `команда` ``.
    """
    # Ищем название этапа в <...>
    stage_match = re.search(r'<(.*?)>', text)
    # Ищем команду внутри обратных кавычек
    command_match = re.search(r'`(.*?)`', text)

    if stage_match and command_match:
        # Если оба совпадения найдены, возвращаем их
        stage_name = stage_match.group(1).strip()
        command = command_match.group(1).strip()
        return stage_name, command

    # Если что-то не найдено, возвращаем None
    return None


def auto_pentest_loop(target_info: str, service_name: str, user_id: str, db: Session, max_steps: int = 1) -> str:
    """
    Запускает автоматический цикл пентеста:
    1. Стартовое сообщение формируется и отправляется модели.
    2. На каждом шаге модель предлагает команду (GET_NEW_COMMAND_PROMPT).
    3. Команда выполняется на Kali, результат анализируется.
    4. Модель получает результат анализа через RESULT_COMMAND_ANALYSIS_PROMPT.
    5. Цикл продолжается до окончания пентеста или достижения max_steps.
    """

    # Стартовый промт
    start_message = START_PENTEST_PROMPT.format(
        target_info=target_info,
        service_name=service_name
    )

    # Отправка стартового сообщения в модель
    print("▶️ Стартовое сообщение отправлено модели.")
    start_response = send_message_to_ai(user_id, start_message, db)
    print(f"📩 Ответ на старт: {start_response}")

    # Проверка доступности цели
    if not is_ip_reachable(target_info):
        print(f"⛔ Цель {target_info} недоступна для пентеста.")
        return f"{target_info} не доступен для пентеста."

    # Основной цикл пентеста
    for step in range(max_steps):
        try:
            print(f"\n🔁 Шаг {step + 1}: Получение новой команды от модели...")
            # Получение команды от модели
            command_response = send_message_to_ai(user_id, GET_NEW_COMMAND_PROMPT, db)
            print(f"📦 Команда от модели:\n{command_response}")

            # Извлечение команды
            command = extract_command_and_stage_from_response(command_response)[1]
            if not command:
                print("🛑 Модель не предложила команду. Завершение пентеста.")
                break

            print(f"💻 Выполнение на Kali: {command}")
            output, error = execute_command_on_kali(command)
            result_text = output if output else error
            print(f"📄 Результат выполнения:\n{result_text}")

            # Формирование промта анализа результата
            result_prompt = RESULT_COMMAND_ANALYSIS_PROMPT.format(
                current_command=command,
                result_command=result_text
            )

            print("🧠 Отправка результата модели для анализа...")
            analysis_response = send_message_to_ai(user_id, result_prompt, db)
            print(f"📬 Ответ модели на анализ:\n{analysis_response}")

            # Проверка завершения
            if "Пентест завершён" in command_response or "Пентест завершён" in analysis_response:
                print("✅ Модель сообщила о завершении пентеста.")
                break

        except Exception as e:
            error_msg = f"❗ Ошибка на шаге {step + 1}: {str(e)}"
            print(error_msg)
            break

    print("🏁 Автоматический пентест завершён.")
    return "Автоматический пентест завершён"







