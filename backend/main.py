import json
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Set

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError

from game import GameActionError, GameState, Pack

STATIC_DIR = Path(__file__).resolve().parent / "static"

game_state = GameState()

BACKEND_DIR = Path(__file__).resolve().parent
PACK_FILE = BACKEND_DIR / "pack.json"


def _try_load_pack_from_disk() -> None:
    if not PACK_FILE.is_file():
        return
    try:
        raw = PACK_FILE.read_text(encoding="utf-8")
        data = json.loads(raw)
        pack = Pack.model_validate(data)
        game_state.load_pack(pack)
    except (OSError, json.JSONDecodeError, ValidationError):
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    _try_load_pack_from_disk()
    yield


app = FastAPI(title="Свояк API", lifespan=lifespan)

# CORS на всех окружениях: прод (Railway) без ENVIRONMENT=development иначе не подключался бы middleware;
# кросс-доменные админки / инструменты тоже смогут дергать API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clients.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._clients.discard(websocket)

    async def broadcast(self, message: str) -> None:
        dead: list[WebSocket] = []
        for client in self._clients:
            try:
                await client.send_text(message)
            except Exception:
                dead.append(client)
        for c in dead:
            self._clients.discard(c)


manager = ConnectionManager()


async def broadcast_state() -> None:
    payload = json.dumps(game_state.to_broadcast_dict(), ensure_ascii=False)
    await manager.broadcast(payload)


def _format_validation_error(exc: ValidationError) -> str:
    parts: list[str] = []
    for err in exc.errors():
        loc = " → ".join(str(x) for x in err["loc"] if x != "body")
        msg = err.get("msg", "")
        if loc:
            parts.append(f"{loc}: {msg}")
        else:
            parts.append(msg)
    return "Ошибка в структуре пака: " + "; ".join(parts) if parts else str(exc)


class ActionRequest(BaseModel):
    action: str
    payload: dict = Field(default_factory=dict)


class JoinRequest(BaseModel):
    name: str


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/build-info")
async def build_info() -> dict:
    """Диагностика деплоя: время сборки index.html и имена hashed-ассетов."""
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        return {"status": "missing", "detail": "frontend not built (no backend/static/index.html)"}
    st = index.stat()
    text = index.read_text(encoding="utf-8")
    js_names = re.findall(r'/static/assets/(index-[A-Za-z0-9_-]+\.js)', text)
    css_names = re.findall(r'/static/assets/(index-[A-Za-z0-9_-]+\.css)', text)
    return {
        "status": "ok",
        "index_html_mtime_utc": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
        "asset_js": js_names,
        "asset_css": css_names,
    }


@app.get("/api/state")
async def get_state() -> dict:
    return game_state.to_broadcast_dict()


@app.get("/api/admin/state")
async def get_admin_state() -> dict:
    return game_state.to_admin_dict()


@app.post("/api/reset")
async def reset_game() -> dict:
    print("RESET called", flush=True)
    try:
        game_state.reset_game()
    except GameActionError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await broadcast_state()
    return {"status": "ok"}


@app.get("/api/pack")
async def get_pack_full() -> dict:
    if game_state.pack is None:
        raise HTTPException(status_code=404, detail="Пак не загружен")
    return game_state.pack.model_dump()


@app.post("/api/join")
async def join(body: JoinRequest) -> dict:
    player = game_state.join_player(body.name)
    await broadcast_state()
    return {"player_id": player.id, "name": player.name}


@app.post("/api/action")
async def game_action(body: ActionRequest) -> dict:
    try:
        game_state.apply_action(body.action, body.payload)
    except GameActionError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await broadcast_state()
    return {"status": "ok"}


@app.post("/api/pack")
async def upload_pack(file: UploadFile = File(...)) -> dict:
    name = (file.filename or "").lower()
    if not name.endswith(".json"):
        raise HTTPException(
            status_code=400,
            detail="Ожидается JSON-файл с расширением .json",
        )

    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail="Файл должен быть в кодировке UTF-8",
        ) from e

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Некорректный JSON: {e.msg} (строка {e.lineno}, позиция {e.colno})",
        ) from e

    try:
        pack = Pack.model_validate(data)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=_format_validation_error(e)) from e

    game_state.load_pack(pack)
    if PACK_FILE.parent.is_dir():
        PACK_FILE.write_text(
            json.dumps(pack.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    await broadcast_state()
    return {"status": "ok", "rounds": len(pack.rounds)}


@app.put("/api/pack")
async def put_pack(pack: Pack) -> dict:
    if PACK_FILE.parent.is_dir():
        PACK_FILE.write_text(
            json.dumps(pack.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    game_state.load_pack(pack)
    await broadcast_state()
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        payload = json.dumps(game_state.to_broadcast_dict(), ensure_ascii=False)
        await websocket.send_text(payload)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


if STATIC_DIR.is_dir():
    app.mount(
        "/static",
        StaticFiles(directory=str(STATIC_DIR)),
        name="static",
    )


_SPA_CACHE_HEADERS = {
    # Свежий index.html — иначе браузер держит старую оболочку и подгружает старые hashed CSS/JS.
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
}


def _spa_index_response():
    index = STATIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(index, headers=_SPA_CACHE_HEADERS)
    return JSONResponse({"error": "Frontend not built"}, status_code=503)


@app.get("/")
async def spa_root():
    return _spa_index_response()


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api") or full_path.startswith("static/"):
        raise HTTPException(status_code=404, detail="Not found")
    return _spa_index_response()
