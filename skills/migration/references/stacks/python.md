# Stack Reference: Python (FastAPI / Django / Flask)

_For migration skills — loaded when source or target stack token = `python`. FastAPI is the default
modern target; Django/Flask differences are noted. Enforced anti-patterns + coding conventions live
in `rules/python-rules.md` (authoritative); this reference adds migration-specific context._

---

## Core Patterns (FastAPI, async-first)

**Dependency Injection**
- `Depends()` providers — request-scoped by default; wire repositories/services through function
  or class dependencies. No convention-scanning container (explicit, like .NET DI).
- App-level singletons via `app.state` or module-level objects created in the lifespan handler.

**Web / routing**
- `APIRouter` per feature; `@router.get("/items/{id}")`, `@router.post(...)`.
- Path/query params are typed function args; request bodies are Pydantic models (validated + parsed).
- Return a dict or a Pydantic model — FastAPI serializes to JSON and generates OpenAPI automatically.

**Data access**
- SQLAlchemy 2.0 (async: `AsyncSession` + `asyncpg`) or SQLModel; Alembic for migrations.
- Repository pattern over the session; keep the session in the request scope (a `Depends` yield).
- **A synchronous DB driver blocks the event loop** — use async drivers end-to-end, or run blocking
  calls in a threadpool (`run_in_executor` / `fastapi.concurrency.run_in_threadpool`).

**Validation**
- Pydantic v2 models ARE the validation layer — types, constraints (`Field(gt=0)`), and custom
  validators live on the DTO. No separate Joi/FluentValidation step.

**Configuration**
- `pydantic-settings` `BaseSettings` reads env / `.env`; typed settings object injected via `Depends`.

**Errors**
- Register exception handlers (`@app.exception_handler(...)`) returning RFC 7807-style JSON;
  raise `HTTPException` for expected 4xx.

**Async model**
- `asyncio` single event loop (like Node), BUT the **GIL** means CPU-bound work needs
  worker processes (`uvicorn --workers` / gunicorn), not threads, for parallelism.
- Never call a blocking library inside `async def` without offloading — it stalls all requests.

**Testing**
- pytest (+ `pytest-asyncio` for async), `httpx`/`TestClient` for API tests, factory helpers for
  data, `pytest --cov` for coverage. Testcontainers-python for real-DB integration.

**Packaging / tooling**
- `pyproject.toml` (PEP 621); `uv` or `pip`; `ruff` (lint+format), `mypy` (types).
- Run: `uvicorn {package}.main:app` (FastAPI) · `manage.py runserver` (Django) · `flask run` (Flask).

---

## Django / Flask deltas (if the target is not FastAPI)
- **Django:** batteries-included (ORM, admin, auth, migrations built-in); sync by default (ASGI/async
  views since 3.1); `manage.py` workflow; apps as modules. Health/serve differ (`runserver`).
- **Flask:** minimal; sync WSGI by default; add extensions (SQLAlchemy, Marshmallow) explicitly;
  blueprints instead of routers.

---

## Key Gotchas for Migration
1. **Runtime types, not compile-time.** Python type hints are optional + erased at runtime unless
   validated (Pydantic) — enforce with `mypy` in CI or bugs slip through that a compiler would catch.
2. **GIL ≠ Node cluster.** Horizontal CPU scaling = multiple worker processes, not threads.
3. **Async purity.** One sync I/O call in an async path stalls the loop — audit every dependency for
   an async-capable driver, or offload explicitly.
4. **Import-time side effects.** Module-level code runs on import; keep app construction in a factory
   / lifespan, not at import, to keep tests and workers clean.
5. **No true privates.** Encapsulation is by convention (`_name`); rely on module boundaries +
   `import-linter` (the layer-fitness tool) rather than access modifiers.
