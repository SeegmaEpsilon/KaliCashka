# app/ws.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from jose import jwt, JWTError
from .config import SECRET_KEY, ALGORITHM
from .services import ws_manager

router_ws = APIRouter()


def parse_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]          # username
    except JWTError:
        return None


@router_ws.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    token = ws.query_params.get("token")
    username = parse_token(token)
    if not username:
        await ws.close(code=4401)      # Unauthorized
        return
    await ws_manager.connect(ws, username)
    try:
        while True:
            await ws.receive_text()    # ждём pings от клиента
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(ws, username)
