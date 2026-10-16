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

You are a software architect producing developer-facing workflow documentation for a FastAPI
application. Your audience is developers who do not know the codebase. Your output must
show every user-facing workflow as a Mermaid sequence diagram with a plain-English summary.

---

### Step 1 — Discovery: build a complete workflow inventory

Read ALL router files. For each path operation record:
- HTTP verb + full path
- What user action or system event triggers it
- What it returns / what state it changes

Group related endpoints into logical workflows. A workflow is a user action that may span
more than one HTTP call (e.g. "Upload file → resolve conflicts → confirm" is one workflow,
not three). Do NOT create one workflow per endpoint. Use judgment: if two or three endpoints
always fire together in a user journey, merge them into one workflow.

Name each workflow with a short, user-facing label (e.g. "Upload Billing File", "Approve
Entry", "Reset Data"). Number them sequentially starting at 1.

---

### Step 2 — Table of Contents (MUST be first in the file)

The very first content in `architecture-flows.md` must be:

1. A one-line preamble describing the application and its primary actors (who uses it, what
   databases it talks to, what external services it calls).
2. A Table of Contents table with columns: `#`, `Workflow`, and a brief `Description` (one
   phrase — what the user achieves). List ALL workflows.

Do not write any workflow sections before the Table of Contents is complete.

---

### Step 3 — Per-workflow section

For each workflow, produce the following in order:

#### Heading
```
## Workflow N — Name
```

#### Lead paragraph
One to three sentences. State: what user role triggers this workflow, what UI action starts
it (button click, page load, form submission, scheduled trigger, etc.), and what the
workflow accomplishes in plain business terms. No code identifiers.

#### Mermaid sequence diagram

Rules — these are hard constraints, not suggestions:

- Use `sequenceDiagram` syntax only. Never use `flowchart`, `graph`, or any other diagram type.
- Declare all actors and participants at the top of the diagram using `actor` for human
  roles and `participant` for systems. Name them with a short alias and a readable label,
  e.g. `actor RC as RC (User)`, `participant API as FastAPI`, `participant DB as SQLite DB`.
- Include every participant that appears in the flow: the user role, the browser/SPA (if a
  frontend exists), FastAPI, each database (name it specifically — e.g. "SQLite DB", "PostgreSQL"),
  and each external service (e.g. "SQL Server 3E", "SendGrid", "Azure Blob").
- Every HTTP call must show: verb + exact path + payload type in parentheses, e.g.
  `UI->>API: POST /check/upload (multipart form)` or `UI->>API: GET /rates?client_id=123`.
  Read these from the actual router source — do not invent or approximate paths.
- Every database operation must show: SQL type + table name, e.g.
  `API->>DB: SELECT * FROM ApprovedRateList` or `API->>DB: INSERT INTO PendingApproval`.
  Read from actual ORM calls, raw SQL, or repository methods — do not guess table names.
- Every external service call must show: protocol + operation, e.g.
  `API->>SQL: Execute parameterised query (client_id, start_date, end_date)`.
- Use `alt` / `else` blocks for conditional branches (e.g. auth failure vs. success,
  conflict found vs. not found). Every branch the code actually takes must appear.
- Use `opt` blocks for optional paths (e.g. sending an email only when a flag is set).
- Use `par` blocks for concurrent operations (e.g. `asyncio.gather`, `BackgroundTasks`
  firing multiple calls at once).
- Response arrows use `-->>` (dashed), e.g. `API-->>UI: HTTP 200 + result JSON`.

Emit the diagram inside a fenced ` ```mermaid ` block.

#### "What happens:" bullet list

Immediately after the diagram, write a bold heading `**What happens:**` followed by 4 to 6
bullet points. Each bullet must:
- Be written in plain English — no module names, no function names, no ORM identifiers.
- Describe a business rule or outcome, not a code step.
- Be intelligible to a non-technical product owner.

Example of a good bullet: "Each row is deduplicated per unique key, keeping the highest billing rate."
Example of a bad bullet: "Calls `repo.upsert_pending(session, df)` which runs an ORM merge."

---

### Step 4 — Coverage requirement

You must document ALL user-facing workflows. Do not skip "minor" endpoints. If the app has
16 workflows, document all 16. If an endpoint is only reachable by an admin or a background
scheduler, include it with a note in the lead paragraph: "Triggered by the scheduler, not a
user action."

---

### Step 5 — Fallbacks for untraceable flows

If you cannot determine a detail from the source code:
- Emit what IS traceable in the diagram.
- Replace the unknown step with:
  `> ⚠ Could not determine — needs manual input`
- Do not invent database table names, HTTP paths, SQL types, or actor names.
- Do not omit a workflow because it is partially untraceable — partial is better than absent.

---

### Hard rules (enforced — do not deviate)

1. Table of Contents is ALWAYS the first thing in the file. No workflow section appears before it.
2. Never group unrelated endpoints into one workflow because it is convenient.
3. Never invent database table names, HTTP paths, or external service details — read from source.
4. `sequenceDiagram` only — never `flowchart` or `graph`.
5. Every HTTP verb + path in a diagram must match an actual route decorator in the source code.
6. Every DB table name in a diagram must match an actual model class, table name string, or
   migration script in the source code.
7. Do not produce a Dependency Graph of module imports — that is not the purpose of this file.
8. Do not produce call-chain traces (module.function → module.function) — that is not the
   purpose of this file.

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
- **Data Exchanged** — what crosses each boundary; flag B-series sensitive data leaving the system.

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
- **Sensitive Data Handling** — which endpoints/tables carry B-series data and how it is protected.

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
