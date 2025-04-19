import os
import re
import time
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

import asyncio, json
from fastapi import WebSocket
from typing import Dict, List

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage


api_key = AI_API_KEY


class WebSocketManager:
    def __init__(self) -> None:
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_id: str) -> None:
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, ws: WebSocket, user_id: str) -> None:
        if user_id in self.active and ws in self.active[user_id]:
            self.active[user_id].remove(ws)

    async def send(self, user_id: str, payload: dict | str) -> None:
        if isinstance(payload, str):
            payload = {"message": payload}
        # Для унификации ‒ всегда строки JSON
        text = json.dumps(payload, ensure_ascii=False)
        for ws in self.active.get(user_id, []):
            await ws.send_text(text)


ws_manager = WebSocketManager()


# services.py
async def _emit(user_id: str, stage: str, data: dict | str) -> None:
    """
    Отправляет клиенту сообщение в сокет 'ws_session', независимо от user_id.
    """
    if isinstance(data, str):
        data = {"message": data}
    data["stage"] = stage

    # 🔧 Принудительно отправляем только в канал "ws_session"
    target_id = "ws_session"

    print(f"[WS → {target_id}] {json.dumps(data, ensure_ascii=False)}", flush=True)

    await ws_manager.send(target_id, data)



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
        formatted_model_response = remove_think_block(model_response)

        save_chat_history(user_id, message, formatted_model_response)

        return formatted_model_response

    except Exception as e:
        error_msg = f"Ошибка при работе с AI: {str(e)}"
        print(error_msg)
        return error_msg


def execute_command_on_kali(command: str, timeout: int = 60) -> Tuple[str, str]:
    """
    Выполняет команду на удалённой машине Kali Linux через SSH с тайм-аутом.
    """
    host = os.getenv("KALI_SSH_HOST")  # IP Kali Linux
    port = int(os.getenv("KALI_SSH_PORT"))  # Порт SSH
    username = os.getenv("KALI_SSH_USER")  # Имя пользователя SSH
    password = os.getenv("KALI_SSH_PASSWORD")  # Пароль SSH

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, port, username, password)
        stdin, stdout, stderr = client.exec_command(command)

        # Ожидаем завершения команды с тайм-аутом
        start_time = time.time()
        while True:
            if stdout.channel.exit_status_ready():
                break
            if time.time() - start_time > timeout:
                stdout.channel.close()
                stderr.channel.close()
                return "", "Команда превысила максимальное время ожидания."

            time.sleep(0.5)  # Пауза, чтобы не нагружать процессор

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


def extract_result_from_response(analysis_response: str) -> str:
    """
    Извлекает содержимое внутри треугольных скобок из строки ответа.
    Пример: "Результат: <ошибка подключения>" -> "ошибка подключения"
    """
    match = re.search(r'<(.*?)>', analysis_response)
    return match.group(1) if match else ""


async def auto_pentest_loop(          # ← теперь async!
    target_info: str,
    service_name: str,
    user_id: str,
    db: Session,
    max_steps: int = 10,
) -> str:
    await _emit(user_id, "init", f"Запуск автопентеста против {target_info}")

    start_msg = START_PENTEST_PROMPT.format(target_info=target_info,
                                            service_name=service_name)
    await _emit(user_id, "prompt", "Отправка стартового сообщения модели")
    start_resp = send_message_to_ai(user_id, start_msg, db)
    await _emit(user_id, "prompt_response",
                extract_result_from_response(start_resp))

    if not is_ip_reachable(target_info):
        text = f"⛔ Цель {target_info} недоступна."
        await _emit(user_id, "unreachable", text)
        return text

    for step in range(max_steps):
        try:
            await _emit(user_id, "step_start", {"step": step + 1})

            cmd_resp = send_message_to_ai(user_id, GET_NEW_COMMAND_PROMPT, db)
            extract = extract_command_and_stage_from_response(cmd_resp)
            if not extract:
                await _emit(user_id, "no_command", "Команда не получена, завершаю.")
                break
            stage_name, command = extract
            await _emit(user_id, "command", {"stage_name": stage_name,
                                             "command": command})

            output, error = execute_command_on_kali(command)
            result = output or error
            await _emit(user_id, "command_result",
                        {"stage_name": stage_name, "result": result})

            analysis_prompt = RESULT_COMMAND_ANALYSIS_PROMPT.format(
                current_command=command, result_command=result)
            analysis_resp = send_message_to_ai(user_id, analysis_prompt, db)
            analysis = extract_result_from_response(
                remove_think_block(analysis_resp))
            await _emit(user_id, "analysis",
                        {"stage_name": stage_name, "analysis": analysis})

            if "Пентест завершён" in (cmd_resp + analysis_resp):
                await _emit(user_id, "complete", "Пентест завершён ✅")
                break

        except Exception as exc:
            await _emit(user_id, "error",
                        f"Ошибка на шаге {step + 1}: {str(exc)}")
            break

    await _emit(user_id, "finished", "Автоматический пентест завершён")
    return "Автоматический пентест завершён"


async def test_ws_output(user_id: str):
    await _emit(user_id, "test", "Тест отправки сообщения по WS")
    return "Тест отправки сообщения по WS"





