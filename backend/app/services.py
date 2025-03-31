import paramiko
from typing import Tuple
from .config import AI_API_KEY
from sqlalchemy.orm import Session
from fastapi import Depends
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


def auto_pentest_loop(target_info: str, user_id: int, db: Session):
    """
    Запускает автоматический цикл пентеста:
    1. Модель генерирует команду
    2. Команда выполняется на Kali
    3. Результат возвращается в модель
    4. Повторяем, пока модель не скажет "стоп"
    """
    messages = get_user_chat_history(user_id, db)  # история чата
    # Добавим от пользователя команду "Начать пентест: <target_info>"
    messages.append(HumanMessage(content=f"Начинаем пентест {target_info}"))

    while True:
        # 1. Генерируем ответ модели
        ai_response = model.invoke(messages)
        response_text = ai_response.content

        # 2. Добавляем в историю
        messages.append(AIMessage(content=response_text))

        # 3. Пробуем извлечь команду из ответа
        command = extract_command_from_response(response_text)
        if not command:
            # Если модель не дала команду (или сказала "стоп"), завершаем цикл
            break

        # 4. Выполняем команду на Kali
        output, error = execute_command_on_kali(command)
        result_text = output if output else error

        # 5. Сохраняем команду и результат в БД (CommandHistory)
        save_command_history(user_id, command, result_text, db)

        # 6. Передаём результат обратно в контекст как HumanMessage,
        #    чтобы модель могла его проанализировать
        messages.append(HumanMessage(
            content=f"Результат команды:\n{result_text}"
        ))

    return "Автоматический пентест завершён"

