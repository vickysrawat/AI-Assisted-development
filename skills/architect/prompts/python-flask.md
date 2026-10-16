# Prompts — Python / Flask

---

## File 1 Prompt — architecture.md

You are a software architect documenting a Flask codebase for the first time.
Read the following in order: the dependency manifest, the app factory or entry
point (where `Flask(__name__)` is created), any config module, blueprint
registrations, the top-level package structure, and README files. Do not read
individual view or service files yet — work from manifest and app-setup files
for this pass.

Populate architecture.md completely, filling every section:

**Technology Stack** — read the manifest and extract: Python version, Flask
version, WSGI server (gunicorn/uwsgi), ORM (SQLAlchemy/Flask-SQLAlchemy),
migrations (Flask-Migrate/Alembic), validation (marshmallow/Pydantic), auth
extensions, logging, test frameworks, containerization. Present as a table.

**Package Structure** — list every package/module with its path and one-line
responsibility. Include tests.

**Layer Dependency Diagram** — Mermaid flowchart showing blueprint/view → service →
repository/data-access → model dependencies.

**Blueprints** — for each blueprint: its url_prefix and responsibility.

**Before/After Request & Extensions** — list registered `before_request`/
`after_request` handlers, error handlers, and Flask extensions in setup order.

**API Endpoints** — read every view/blueprint route; list each with HTTP method,
rule, auth decorator, request parsing, and response.

**Configuration** — read the config classes/objects and list every config key
with its purpose and source (env var).

**Background Jobs** — state whether Celery/RQ tasks or CLI commands exist. If none, say so.

Every fact must come from source files.
Sections where the answer cannot be determined: write
`> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are a software architect producing developer-facing workflow documentation for a Flask application. Your audience is developers who do not know the codebase. Your output must show every user-facing workflow as a Mermaid sequence diagram with a plain-English summary.

---

### Step 1 — Discovery: build a complete workflow inventory

Read ALL blueprint and route files. For each route function record:
- HTTP verb + full path (from `@app.route`, `@blueprint.route`, or `MethodView` decorators)
- What user action or system event triggers it
- What it returns / what state it changes

Group related routes into logical workflows. A workflow is a user action that may span more than one HTTP call. Do NOT create one workflow per route function. Name each workflow with a short, user-facing label and number them sequentially starting at 1.

---

### Step 2 — Table of Contents (MUST be first in the file)

The very first content must be: a one-line preamble describing the app and its actors, then a Table of Contents table with columns `#`, `Workflow`, and `Description`. List ALL workflows. No workflow sections appear before the TOC is complete.

---

### Step 3 — Per-workflow section

For each workflow, in order:

**Heading:** `## Workflow N — Name`

**Lead paragraph:** 1-3 sentences — what user role triggers this, what UI action starts it, what it accomplishes in business terms. No code identifiers.

**Mermaid sequence diagram** (hard constraints):
- `sequenceDiagram` syntax only — never `flowchart` or `graph`
- Declare all actors/participants at the top: `actor` for human roles, `participant` for systems, with short alias and readable label
- Include every participant: user role, Browser/Client, Flask, each named database, each external service
- Every HTTP call: verb + exact path + payload type in parentheses — read from actual blueprint/route decorator source
- Every DB operation: SQL type + table name — read from actual SQLAlchemy model, `db.session` call, or raw SQL string in source
- Every external service call: protocol + operation
- `alt`/`else` for conditional branches (including `@login_required`, `before_request` guards, and feature flags), `opt` for optional paths, `par` for concurrent operations
- Response arrows use `-->>` (dashed)
- Emit inside a fenced ` ```mermaid ` block

**"What happens:" bullet list:** Bold heading, 4-6 bullets, plain English business rules, no code identifiers, intelligible to a non-technical reader.

---

### Step 4 — Coverage requirement

Document ALL user-facing workflows — do not skip minor ones. If there are 16, document all 16. Background/scheduler-triggered routes (Celery tasks, APScheduler jobs, Click CLI commands registered on the app) are included with a note in the lead paragraph.

---

### Step 5 — Fallbacks for untraceable flows

Emit what IS traceable. Replace unknown steps with `> ⚠ Could not determine — needs manual input`. Never invent table names, paths, or actor names. Never omit a workflow because it is partially untraceable.

---

### Hard rules

1. Table of Contents is ALWAYS the first thing in the file.
2. Never group unrelated routes into one workflow for convenience.
3. Never invent database table names, HTTP paths, or external service details — read from source.
4. `sequenceDiagram` only.
5. Every HTTP verb + path must match an actual route decorator in source.
6. Every DB table name must match an actual SQLAlchemy model class, `__tablename__` string, or migration in source.
7. Do not produce a Dependency Graph of inter-module imports.
8. Do not produce call-chain traces (module.function → module.function).

---

## File 3 Prompt — architecture-reference.md

You are a software architect cataloguing reference data for a Flask project.
This is a reference-only file — precision matters more than narrative.

**Dependency Versions** — read the manifest (and lockfile). Extract every
dependency with its exact pinned version. Copy exactly. Table sorted by name.

**CI/CD Pipelines** — read every pipeline file. For each: filename, trigger, purpose.

**Most-imported modules** — the 10 internal modules imported by the most others.
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
