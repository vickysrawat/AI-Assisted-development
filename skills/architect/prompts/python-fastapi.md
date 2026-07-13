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

**Layer Dependency Diagram** — Mermaid flowchart showing router → service →
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

---

## File 1 addendum — architecture.md diagrams

In addition to the sections above, `architecture.md` MUST contain two Mermaid diagrams:

- **`## End-to-End Architecture`** — a `flowchart LR`: caller/actor → API/entry point →
  services → data access → data store(s) → external dependencies. Label edges with
  protocol/auth where known. Only include nodes confirmed from source — never invent one.
- **`## Layered View`** — a `flowchart TB` of the real layers with dependency direction,
  derived from actual module/package/project references (not assumed layering).

Emit valid fenced ` ```mermaid ` blocks; keep node labels short, free of `()[]{}`. If the
layer graph cannot be determined, keep the `> ⚠ Could not determine — needs manual input`
marker instead of an empty or invalid diagram.

---

## File 4 Prompt — architecture-data.md

Document the data model. Read entity/model classes, ORM mappings or migrations, SQL scripts,
and repository/DAO classes.

- **Entities / Tables** — each persisted entity/table with owning module, key columns, purpose.
- **Relationships** — from foreign keys / associations: from, to, cardinality, FK, on-delete.
- **Data Ownership** — which module/service is the system-of-record for each table; who else reads it.
- **Key Aggregates** — the main consistency boundaries (root entity + what loads/saves with it).
- **Access Patterns** — the data-access approach actually used (ORM entities/repositories or a
  query surface). For each repository/DAO: its queries/operations, tables touched, read vs write.
- **Migrations / Schema Source** — where the schema is defined.

Every fact from source. Undetectable → `> ⚠ Could not determine — needs manual input`.

---

## File 5 Prompt — architecture-integrations.md

Catalogue external dependencies. Read HTTP client setup, config for base URLs/endpoints, retry/
resilience policies, message-queue/event/SDK usages, and any SOAP/gRPC clients.

- **External Dependencies** — name, kind (REST/SOAP/gRPC/queue/event bus/SMTP/file share/SDK),
  contract (protocol + endpoint), where called from, auth.
- **Resilience & Failure Behavior** — per-dependency timeout, retry/backoff, circuit breaker
  (from code). The **"on failure — what happens"** and **SLA/ownership** are usually human
  knowledge — if not in code, write `> ⚠ Could not determine — needs manual input`.
- **Data Exchanged** — what crosses each boundary; flag B1–B7 sensitive data leaving the system.

Never invent timeouts, SLAs, or owners. Extract only what code shows; flag the rest.

---

## File 6 Prompt — architecture-security.md

Document the authorization model and trust map. Read authentication/authorization setup, route/
method authorization (framework attributes/decorators/guards/policies), custom authorization
handlers, and resource-based checks.

- **Trust Boundaries / Zones** — where trust changes and what is validated at each crossing.
- **Authorization Model** — table of Action/Resource → Role/Policy → Enforced-at (name the
  class/method that enforces). Derive from the framework's authorization primitives.
- **Business Rules Gating Actions** — rules beyond role checks (ownership, tenancy). Usually
  human knowledge — flag with `> ⚠ Could not determine — needs manual input`.
- **Secrets Handling (summary)** — only what the application code does; cross-link deployment.md.
- **Sensitive Data Handling** — which endpoints/tables carry B1–B7 data and how it is protected.

Do NOT invent authorization rules or claim protections not present in code — flag gaps.

---

## File 7 Prompt — architecture-decisions.md (SEED ONLY)

Seed the decision log — create the first few `AD-NNN` entries from *detectable, non-obvious*
choices; do not populate the whole file, and **never invent the rationale**.

For each detected choice: **Decision** (from code/config/CLAUDE.md — data-access approach, auth
model, framework/layering choice), **Rationale** = `> ⚠ Could not determine — needs manual input`,
**Alternatives rejected**, **Date** = `unknown` unless evidenced, **Status** = `Accepted`.

Seed at most 3–5 entries. **If the file already contains real `AD-NNN` entries with filled
rationale, do not modify it** — it is an append-only human log.
