# Parity Mapping: Node.js/Express → Python/FastAPI

_Unidirectional — Node.js/Express as source, Python/FastAPI as target. This is the best-grounded
Python-target pair: both stacks are dynamic, event-loop-async, and JSON-first, so most web
constructs map cleanly. Derived from documented framework equivalences; validate against the actual
source before relying on YELLOW/RED items._

---

## GREEN — Migrates Cleanly

| Node.js / Express | Python / FastAPI equivalent | Confidence |
|---|---|---|
| `app.get('/x', handler)` / `app.post(...)` | `@router.get("/x")` / `@router.post(...)` | Verified |
| `async` request handlers | `async def` endpoints (same event-loop model) | Verified |
| `req.body` (JSON) | Pydantic model body parameter (parsed + validated) | Verified |
| `req.params.id` | typed path param `{id}` in the route + function arg | Verified |
| `req.query.q` | typed query param (function arg with default) | Verified |
| `res.json(obj)` | `return obj` (dict / Pydantic model — auto-serialized) | Verified |
| `express.json()` body parsing | built-in — FastAPI parses JSON bodies by default | Verified |
| `process.env.KEY` | `pydantic-settings` `BaseSettings` / `os.environ` | Verified |
| `app.use(cors(...))` | `CORSMiddleware` (`app.add_middleware`) | Verified |
| `console.log`/`morgan` | `logging`/`structlog` + a logging middleware | Verified (format differs) |
| Jest `test()` + `expect()` | `pytest` + `assert` | Verified |
| Supertest HTTP assertions | `httpx` / `TestClient` | Verified |
| `npm` scripts | `pyproject.toml` scripts / `uv run` / Makefile | Verified |
| OpenAPI via swagger-jsdoc | built-in — FastAPI generates OpenAPI from types | Verified — native |

---

## YELLOW — Needs Rework

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Passport.js | FastAPI security: `OAuth2PasswordBearer` / dependency-based auth + `pyjwt`/`python-jose`. Strategy-per-provider → one dependency per scheme. | M | MEDIUM |
| `express-session` | Server-side session via `SessionMiddleware` (starlette) or Redis; or drop for stateless JWT. No cookieless mode. | M | MEDIUM |
| Sequelize / Prisma / TypeORM | SQLAlchemy 2.0 (async) or SQLModel + Alembic migrations. Every ORM call rewritten; use an async driver (`asyncpg`) to avoid blocking. | L | HIGH |
| Joi / express-validator | Pydantic v2 models — validation moves INTO the DTO (types + `Field` constraints + validators). | M | LOW |
| `bull` / `bullmq` jobs | Celery / `arq` / Dramatiq (Redis-backed). | M | LOW |
| `morgan`/winston logging | `logging`/`structlog` + middleware; structured format differs. | S | LOW |
| npm libs (lodash / moment / axios) | stdlib + `itertools`, `datetime`/`pendulum`, `httpx`. | S–M | LOW |
| TypeScript types | Python type hints + `mypy`. Structural (TS) vs nominal-ish (Python) typing differs; enforce mypy in CI. | M | MEDIUM |
| Express error-handling middleware | `@app.exception_handler(...)` + `HTTPException`. | S | LOW |
| `helmet` | Set security headers via middleware explicitly (no single drop-in). | S | LOW |

---

## RED — Will Break / Paradigm Shift

**Blocking calls inside async handlers stall the loop (worse than Node)**
- What breaks: Node's ecosystem is async-by-default; Python's is not. A synchronous DB/HTTP/file call
  inside an `async def` blocks the entire event loop under load — a silent throughput cliff.
- Options: (A) async drivers end-to-end (`asyncpg`, `httpx`); (B) offload blocking calls via
  `run_in_threadpool` / `run_in_executor`; (C) use sync endpoints (FastAPI runs `def` endpoints in a
  threadpool) where async isn't worth it.
- Behavioral risk: HIGH (fine in dev, catastrophic under concurrency).

**GIL — CPU parallelism model differs from Node cluster**
- What breaks: `pm2`/cluster fork-per-core doesn't translate; threads don't give CPU parallelism in
  CPython. Scale with worker PROCESSES (`uvicorn --workers N` / gunicorn).
- Behavioral risk: MEDIUM.

**Node streams / backpressure**
- What breaks: `Readable`/`Writable` stream pipelines have no 1:1 equivalent.
- Options: async generators + `StreamingResponse`; chunked responses.
- Behavioral risk: MEDIUM.

**`socket.io`**
- What breaks: proprietary protocol; browser `socket.io-client` cannot talk to plain WebSockets.
- Options: (A) FastAPI WebSockets + a standard client; (B) `python-socketio` (protocol-compatible) as
  a sidecar/native server.
- Behavioral risk: HIGH — clients break until updated.

**Dynamic JS patterns (prototype tweaks, monkey-patching, duck-typing on shapes)**
- What breaks: Python discourages monkey-patching; Pydantic/dataclasses are stricter about shape.
- Fix: model data explicitly with Pydantic; replace prototype tricks with composition.
- Behavioral risk: MEDIUM.

---

## Shared Gotchas
1. **Async purity is end-to-end** — one sync dependency undoes the async design; audit drivers.
2. **Types are runtime-optional** — without `mypy` + Pydantic, TS's compile-time safety is lost.
3. **Packaging** — `package.json`/lockfile → `pyproject.toml` + `uv.lock`; no `node_modules` analogue at runtime.
4. **Startup** — keep app construction in a factory/lifespan, not at import time (workers + tests).
