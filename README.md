# Свояк

Веб-приложение в формате «Своя игра» для живых мероприятий. Монорепозиторий: бэкенд (FastAPI) и фронтенд (React + Vite).

## Требования

- Python 3.11+ (рекомендуется)
- Node.js 20+ и npm

## Разработка (два процесса)

Бэкенд:

```bash
cd backend
python -m venv .venv
```

Активация окружения:

- Windows (PowerShell): `.\.venv\Scripts\Activate.ps1`
- macOS/Linux: `source .venv/bin/activate`

```bash
pip install -r requirements.txt
set ENVIRONMENT=development
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

На Windows PowerShell: `$env:ENVIRONMENT="development"` перед `uvicorn`.

Фронтенд (отдельный терминал):

```bash
cd frontend
npm install
npm run dev
```

Откройте http://127.0.0.1:5173 — Vite проксирует `/api` и `/ws` на порт 8000.

## Один сервер локально (как в production)

Собрать фронт в `backend/static` и поднять только uvicorn:

```bash
cd frontend && npm install && npm run build
cd ../backend && pip install -r requirements.txt && python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Проверки:

- http://127.0.0.1:8000/ — React
- http://127.0.0.1:8000/admin — админка
- http://127.0.0.1:8000/api/health — `{"status":"ok"}`

В этом режиме CORS не нужен (переменная `ENVIRONMENT` не равна `development`).

## Деплой на Railway

В корне репозитория: `nixpacks.toml`, запасной `Procfile`.

1. Подключите репозиторий к Railway, укажите **один сервис** (сборка из корня).
2. В переменных окружения задайте **`ENVIRONMENT=production`** (или не задавайте `ENVIRONMENT`, чтобы CORS был выключен).
3. Сборка: `npm run build` во `frontend` → артефакты в `backend/static`; затем `pip install -r backend/requirements.txt`.
4. Старт: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`.

Проверьте на выданном URL маршруты `/admin`, `/display`, `/player` и WebSocket `wss://…/ws`.

**Старая вёрстка после деплоя:** каталог `backend/static/` **не хранится в git** (игнор), он создаётся только `npm run build` на Railway. Раньше закоммиченные `index-*.css` из репозитория могли отдаваться, если сборка не выполнялась. Диагностика: откройте **`GET /api/build-info`** — там время `index.html` и имена hashed CSS/JS (сравните с локальной сборкой после `npm run build`).

## Структура

```
backend/
  main.py          # FastAPI, статика, SPA fallback
  game.py          # GameState
  static/          # продакшен-сборка Vite (после npm run build)
  requirements.txt
frontend/
  src/
  package.json
  vite.config.ts   # build.outDir → ../backend/static
nixpacks.toml
Procfile
README.md
```

## WebSocket

Эндпоинт `WS /ws`: клиент подключается к тому же хосту, что и страница (`ws:` / `wss:` от `window.location`).
