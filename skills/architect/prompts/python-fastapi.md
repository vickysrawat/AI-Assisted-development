# Prompts — Python / FastAPI

---

## File 1 Prompt — architecture.md

You are a software architect documenting a FastAPI codebase for the first time.
Read the following in order: the dependency manifest (pyproject.toml or
requirements.txt), the app entry point (where `FastAPI()` is instantiated), any
settings/config module, the top-level package structure, and README files. Do not
read individual router or service files yet — work from manifest and entry-point
files for this pass.

Populate architecture.md completely, filling every section:

**Technology Stack** — read the manifest and extract: Python version, FastAPI
version, ASGI server (uvicorn/gunicorn), ORM/data layer (SQLAlchemy/Tortoise/etc.),
migration tool (Alembic), validation (Pydantic version), auth libraries, logging,
test frameworks, build/packaging, containerization. Present as a table.

**Package Structure** — list every top-level package/module with its path and a
one-line responsibility. Include test packages.

**Layer Dependency Diagram** — ASCII diagram showing router → service →
repository/data-access → model dependencies. Read imports to determine actual edges.

**Routers & Responsibilities** — for each `APIRouter`: its prefix, tags, and
responsibility.

**Middleware & Dependencies** — list registered middleware in order, and the
shared `Depends(...)` dependencies (auth, db session, etc.) with a one-line
description of each.

**API Endpoints** — read all routers; list every path operation with: HTTP verb,
path, auth dependency, request model, and response model.

**Configuration** — read the settings module (`BaseSettings`) and list every
config field with its purpose and source (env var name).

**Background Jobs** — state whether any `BackgroundTasks`, Celery tasks, or
startup/shutdown event handlers exist. If none, say so.

Every fact must come from source files.
Sections where the answer cannot be determined: write
`> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are a software architect tracing request flows through a FastAPI app.
Read every router, then follow each path operation through the full call chain:
route handler → service → repository/data-access → database or external API.

For each endpoint trace:
- Entry point: router module, function name, path
- Every call in sequence with fully qualified module.function name
- At each step: which database (name the session/engine) or external service is
  called, and how (ORM query, httpx/requests client)
- Any async concurrency (`asyncio.gather`, background tasks) — list what runs concurrently
- Conditional branches that significantly change the flow
- Return type / response model at each layer

After the call chains, produce a **Dependency Graph**: for each non-trivial module,
list what it imports and the `Depends(...)` it relies on.

If a function body is too large to trace fully, mark
`> ⚠ Partial trace — complex function, review manually`.

---

## File 3 Prompt — architecture-reference.md

You are a software architect cataloguing reference data for a FastAPI project.
This is a reference-only file — precision matters more than narrative.

**Dependency Versions** — read the manifest (and lockfile if present). Extract
every dependency with its exact pinned version. Copy version strings exactly.
Present as a table sorted by package name.

**CI/CD Pipelines** — read every pipeline file. For each: filename, trigger, purpose.

**Most-imported modules** — the 10 internal modules imported by the most other modules.
**Largest modules** — the 10 modules with the most public functions/classes.

Do not summarise or paraphrase package names or versions — copy exactly.
