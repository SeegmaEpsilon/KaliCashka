# app/ws.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from .services import ws_manager

router_ws = APIRouter()


@router_ws.websocket("/ws/{user_id}")      # ← передаём id прямо в URL
async def websocket_endpoint(ws: WebSocket, user_id: str):
    await ws_manager.connect(ws, user_id)  # без проверки подписи
    try:
        while True:
            await ws.receive_text()         # ждём ping'и клиента
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(ws, user_id)
