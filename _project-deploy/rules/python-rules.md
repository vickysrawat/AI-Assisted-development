---
paths: ["**/*.py", "**/routers/**", "**/services/**", "**/models/**"]
detect:
  files: ["**/*.py", "requirements.txt", "pyproject.toml"]
---

# Python Rules — Applied to all .py files

Framework-aware: applies to FastAPI, Django, and Flask projects. Where a rule is
framework-specific it is marked; otherwise it applies to all Python code.

## Architecture
- Thin route/view handlers: bind + validate input, call a service, map the response — no business logic in the handler
- Service layer owns business logic; data-access layer (repository / ORM manager) owns persistence
- Schemas/serializers never expose ORM models directly — convert at the service or schema boundary
  - FastAPI: Pydantic models for request/response; ORM models stay internal
  - Django: DRF serializers; never return a model instance straight from a view
  - Flask: explicit marshalling (marshmallow or dataclasses) — no raw ORM objects in `jsonify`

## Typing
- Type hints on every function signature (params and return) — no implicit `Any`
- Run `mypy` (or `pyright`) clean; treat type errors as build failures
- Prefer `dataclasses`/Pydantic over untyped dicts for structured data

## Response Standards
- Success: typed response model with the correct status code
- Validation error: 422 (FastAPI/Pydantic) or 400 (Django/Flask) with a structured error body — never a bare string
- Not found: 404 with a body explaining what was not found
- Unauthorized: 401 (no auth) or 403 (insufficient permission) — never 404 to hide a resource
- Server error: 500 — log the full exception, return a sanitized message only

## Auth Pattern
- Enforce authorization in a dependency/decorator/permission class, not ad-hoc inside business logic
  - FastAPI: a `Depends(...)` auth dependency; Django: DRF permission classes; Flask: a decorator
- Never trust client-provided user IDs — resolve identity from the verified token/session
- Access the current user through one abstraction, not by re-parsing the token in multiple places

## Validation
- Validate at the boundary before business logic: Pydantic (FastAPI), serializers (Django), marshmallow/explicit (Flask)
- Business rules validated in the service layer with explicit, typed exceptions

## Logging
- Standard library `logging` with a module-level `logger = logging.getLogger(__name__)`
- Never log PII, secrets, or full request bodies — log identifiers and outcomes
- Use `%`-style parameterized logging (`logger.info("user %s updated", uid)`), not f-strings, in log calls

## Security
- Never use `eval`, `exec`, `pickle` on untrusted input, or `subprocess` with `shell=True` on user data
- Parameterized queries / ORM only — no string-formatted SQL
- No secrets in source or settings committed to the repo — externalise via env/secret store

## File Naming
- Files and modules: `snake_case.py` (e.g. `user_filter_service.py`, `test_user_filter_service.py`)
- Django migrations: framework-generated names left intact

## Testing Pattern
- `pytest`; Arrange / Act / Assert with blank lines between sections
- Mock collaborators with `unittest.mock` / `pytest` fixtures
- Test function name: `test_methodName_whenCondition_thenExpectedBehavior`
- One assertion concept per test
- Always test the error state and the authorization boundary from the ICEA

## Tooling
- Format with `black`; lint with `ruff` (or `flake8`); imports sorted (`ruff`/`isort`)
- Pin dependencies (`requirements.txt` with versions, or `pyproject.toml` with a lockfile)

## structlog (if used)
- `structlog.get_logger()` — never `logging.getLogger()` in structlog projects
- Bind request context at the boundary: `structlog.contextvars.bind_contextvars(request_id=..., user_id=...)`
- Never log PII; log identifiers (user_id, resource_id) not values (email, name, payload)

## FastAPI specifics
- All cross-cutting concerns (auth, db session, rate limiting) via `Depends()` — never inline in route functions
- DB sessions dependency-injected per request — never share a session across requests
- Background work via `BackgroundTasks` parameter — not raw `asyncio.create_task` in route handlers
- Response models declared on every endpoint — never return raw dicts

## Django specifics
- Permission classes declared on `ViewSet`/`APIView` class — not ad-hoc checks inside methods
- Field validation in `serializer.validate_<field>`; cross-field validation in `serializer.validate`
- Always use `select_related`/`prefetch_related` explicitly — never rely on implicit lazy loading

## Flask specifics
- Auth enforced via decorators (`@login_required`, `@require_role`) — not inline checks in view functions
- Use `current_app.logger` — never `print()` or a module-level `logging.getLogger()` in view code
- Blueprint-based organisation — no routes registered directly on the `app` object in production code

## Out of bounds
- No business logic in route handlers/views
- No `print()` for diagnostics — use the logger
- No bare `except:` — catch specific exceptions
