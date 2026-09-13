# Target Execution Profile: python (FastAPI — Django/Flask noted)

STATUS: implemented
ROLE: backend (single-track)
MATURITY: ⚠ Unverified end-to-end. Selectable as a TARGET from a **Node.js** source only
(`nodejs→python` — parity in `mappings/nodejs-python.md`, idioms in `stacks/python.md`). Other
sources (`java`/`dotnet` → python) are NOT mapped — do not offer Python as their target until a
verified parity mapping exists. Commands below are standard Python tooling but not yet run
end-to-end against a real migration.

_FastAPI-oriented; Django/Flask differ where noted. The invoking migration skill's generate/verify phases reference the `{TOKEN}`s._

---

## STACK
Python 3.12 · FastAPI (Django / Flask are alternatives) · `uv`/`pip`

## SKELETON (project structure scaffolded at scaffold phase)
```
pyproject.toml
src/{package}/
  main.py            ← app factory / ASGI app (composition root)
  domain/            ← entities, value objects (pure Python, no framework)
  application/       ← use cases, ports (Protocols), Pydantic DTOs
  infrastructure/    ← repository impls, DB, external clients
  api/               ← routers (FastAPI APIRouter)
  settings.py        ← pydantic-settings BaseSettings (env-driven)
tests/
```

## STANDARDS_EXAMPLE (idioms for the Architecture Standards block)
```
TYPES:   full type hints; mypy clean
ASYNC:   async def endpoints + async I/O (httpx, async DB drivers)
DTO:     Pydantic v2 models for request/response + validation
DI:      FastAPI Depends() providers; constructor-style for services
ERRORS:  exception handlers → RFC 7807-style JSON; no bare except
LOGGING: structlog / structured logging; never print()
```

## BUILD
```bash
python -m compileall src 2>&1 | tail -5 && mypy src 2>&1 | tail -10   # "build" = compile + type-check
```
Skeleton verify (scaffold): `python -m compileall src`.

## TEST_CLUSTER
```bash
pytest tests/{cluster} -q 2>&1 | tail -10
```

## TEST_ALL
```bash
pytest -q 2>&1 | tail -20
```

## TEST_FRAMEWORK
pytest + `httpx`/`TestClient` (FastAPI) · `pytest-asyncio` for async · factories for test data.

## COVERAGE
```bash
pytest --cov=src --cov-report=term-missing --cov-report=xml -q 2>&1 | tail -20
# Parse coverage.xml (or the term summary) — compare per-package line coverage to the coverage target.
```

## LAYOUT
| Slot | Path |
|---|---|
| Shared kernel | `src/{package}/shared/` |
| Cluster source | `src/{package}/{cluster}/` |
| Cluster / char tests | `tests/{cluster}/` |

## COMPOSITION (integration layer — the integration step writes these)
- `src/{package}/main.py` — app factory: mounts routers, wires DI, middleware, exception handlers
- `src/{package}/settings.py` — pydantic-settings (env-driven; placeholders only, no secrets)
- `README.md` — structure, run instructions, link to architecture docs

## CONFIG (dev configuration + pre-flight before E2E)
Dev config: `.env` (loaded by pydantic-settings). DB-aware pre-flight — skip if no datastore, fail
only if a declared `DATABASE_URL` is empty/placeholder:
```bash
[ -f .env ] || { echo "ℹ️  no .env — skipping DB pre-flight"; exit 0; }
grep -q "^DATABASE_URL=" .env || { echo "ℹ️  no DATABASE_URL (DB-less) — skipping"; exit 0; }
v=$(grep "^DATABASE_URL=" .env | head -1 | cut -d= -f2-)
{ [ -z "$v" ] || echo "$v" | grep -q "{"; } && { echo "❌ Populate DATABASE_URL before E2E"; exit 1; }
echo "✅ DATABASE_URL populated"
```

## BUILD_UNIT (per-cluster FORBIDDEN set)
`pyproject.toml` / `requirements.txt` · `src/{package}/main.py` · `src/{package}/settings.py`

## RULES (deployed to .claude/rules/ at scaffold time)
`project-rules.md` (always) · `python-rules.md`

## PKG_ADD (skeleton-amendment path)
`uv add {package}` (or add to `pyproject.toml`/`requirements.txt` + `pip install -e .`) via the
orchestrator. Clusters never edit dependency files directly.

## SERVE (startup + health probe)
```bash
uvicorn {package}.main:app --port {port} > /tmp/backend.log 2>&1 &   # Django: manage.py runserver
BACKEND_PID=$!
timeout 30 bash -c 'until curl -sf http://localhost:{port}/health>/dev/null 2>&1;do sleep 1;done' \
  || { echo "❌ Backend failed to start"; tail -20 /tmp/backend.log; kill $BACKEND_PID; exit 1; }
```
Health endpoint: `/health` (define one). Dev-run: `uvicorn {package}.main:app --reload`.

## E2E
Playwright for a UI/API target, or `httpx` contract tests for API-only.

## FITNESS
```bash
lint-imports 2>&1 | tail -20
```
`import-linter` layer contracts (analogue of NetArchTest/ArchUnit).
