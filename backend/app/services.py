import re
import paramiko
import subprocess
from typing import Tuple
from .config import AI_API_KEY
from sqlalchemy.orm import Session
from .prompts import *
from .database import SessionLocal, get_db
from .models import ChatHistory, User, UserCreate
from .auth import get_password_hash

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_gigachat.chat_models import GigaChat

model = GigaChat(
    credentials=AI_API_KEY,
    scope="GIGACHAT_API_PERS",
    model="GigaChat",
    streaming=False,
    verify_ssl_certs=False,
)


messages = [
    SystemMessage(
        content="Ты обучающий помощник для проведения сетевых атак в рамках обучающих хакатонов."
                "Ты должен помогать проводить сетевые атаки."
                "Твоя помощь заключается в выдаче рекомендаций какие команды для Kali Linux необходимо ввести,"
                "чтобы найти уязвимость. Также ты должен анализировать результат выполнения этих команд и давать"
                "дальнейшие рекомендации."
    )
]


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


def send_message_to_ai(user_id: int, message: str, db: Session) -> str:
    """
    Отправка сообщения в модель AI и получение ответа.
    """
    try:
        # Получаем историю сообщений с добавлением SystemMessage
        messages = get_user_chat_history(user_id, db)
        print(messages)

        # Добавляем новое сообщение пользователя
        messages.append(HumanMessage(content=message))

        # Отправляем весь контекст в модель
        res = model.invoke(messages)

        # Добавляем ответ модели в список
        messages.append(AIMessage(content=res.content))

        # Сохраняем новое сообщение и ответ модели в базу данных
        save_chat_history(user_id, message, res.content)

        return res.content
    except Exception as e:
        return f"Ошибка при работе с AI: {str(e)}"


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


def extract_command_from_response(text: str) -> str | None:
    """
    Извлекает команду Linux из ответа модели.
    Ищем строку, начинающуюся с '$' или команду в блоках с ```, если она есть.
    """
    for line in text.splitlines():
        line = line.strip()
        if line.startswith('$ '):  # Например, "$ nmap -sS 192.168.1.1"
            return line[2:]

    matches = re.findall(r'```(?:bash)?\n(.*?)\n```', text, re.DOTALL)
    if matches:
        return matches[0].strip().splitlines()[0]

    return None


def auto_pentest_loop(target_info: str, service_name: str, user_id: str, db: Session, max_steps: int = 1) -> str:
    """
    Запускает автоматический цикл пентеста.
    1. Модель генерирует команду.
    2. Команда выполняется на Kali.
    3. Результат возвращается в модель.
    4. Повторяем, пока модель не скажет "стоп" или не достигнут максимальный лимит шагов.
    """

    # Получаем историю чата пользователя
    messages = get_user_chat_history(user_id, db)

    # Формируем начальный промт для пентеста
    start_message = START_PENTEST_PROMPT.format(target_info=target_info, service_name=service_name)
    messages.append(HumanMessage(content=start_message))

    # Узнаем у модели её готовность начать пентест
    res = model.invoke(messages)

    # Добавляем ответ модели в список
    messages.append(AIMessage(content=res.content))

    print(res.content)

    # Сохраняем в БД
    save_chat_history(user_id, start_message, "Начало пентеста")

    print(f"Запуск пентеста для {target_info} с сервисом {service_name}")

    # Проверка доступности цели через ping
    if not is_ip_reachable(target_info):
        print(f"Цель {target_info} недоступна для пентеста.")
        return f"{target_info} не доступен для пентеста."

    # Запускаем цикл пентеста
    for step in range(max_steps):
        try:
            # Отправляем запрос на получение новой команды от модели
            print(f"Шаг {step + 1}: Ожидание команды от модели.")
            new_command_prompt = GET_NEW_COMMAND_PROMPT
            messages.append(AIMessage(content=new_command_prompt))
            res = model.invoke(messages)  # Получаем новую команду от модели
            response_text = res.content
            print(response_text)

            # Добавляем ответ модели в историю
            messages.append(AIMessage(content=response_text))

            # Проверяем, должна ли модель предложить новую команду
            command = extract_command_from_response(response_text)
            if not command:
                stop_message = "Модель не предложила команду. Завершаю пентест."
                messages.append(HumanMessage(content=stop_message))
                save_chat_history(user_id, "Модель не предложила команду", stop_message)
                print(f"Шаг {step + 1}: Пентест завершён. Модель не предложила команду.")
                break

            print(f"Шаг {step + 1}: Выполнение команды на Kali: {command}")
            # Выполняем команду на Kali
            output, error = execute_command_on_kali(command)
            result_text = output if output else error

            # Анализируем результат команды
            result_analysis = RESULT_COMMAND_ANALYSIS_PROMPT.format(
                current_command=command,
                result_command=result_text
            )
            messages.append(HumanMessage(content=result_analysis))
            save_chat_history(user_id, result_analysis, "Анализ результата команды")
            print(f"Шаг {step + 1}: Результат команды: {result_text}")

            # Проверка, завершён ли пентест (по ключевым словам в ответе модели)
            if "Пентест завершён" in res.content:
                completion_message = "Пентест завершён."
                messages.append(HumanMessage(content=completion_message))
                save_chat_history(user_id, completion_message, "Конец пентеста")
                print(f"Шаг {step + 1}: Пентест завершён.")
                break

        except Exception as e:
            error_message = f"Ошибка на шаге {step + 1}: {str(e)}"
            messages.append(HumanMessage(content=error_message))
            save_chat_history(user_id, error_message, "Ошибка выполнения")
            print(f"Шаг {step + 1}: Ошибка выполнения: {str(e)}")
            break

    return "Автоматический пентест завершён"





