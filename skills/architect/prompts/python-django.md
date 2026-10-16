# Prompts — Python / Django

---

## File 1 Prompt — architecture.md

You are a software architect documenting a Django codebase for the first time.
Read the following in order: the dependency manifest, `manage.py`, the project
settings module, `urls.py` at the project root, the installed apps list, and
README files. Do not read individual view or model files yet — work from
manifest, settings, and URL configuration for this pass.

Populate architecture.md completely, filling every section:

**Technology Stack** — read the manifest and settings and extract: Python version,
Django version, REST framework (DRF) if present, database engine, migration usage,
auth backend, caching, task queue (Celery), logging, test frameworks,
containerization. Present as a table.

**App Structure** — list every Django app in `INSTALLED_APPS` (first-party) with
its path and a one-line responsibility. Include test modules.

**Layer Dependency Diagram** — Mermaid flowchart showing url → view → service (if a
service layer exists) → model dependencies across apps.

**URL Configuration** — read root and per-app `urls.py`; summarise the URL
namespace structure.

**Middleware Chain** — read `MIDDLEWARE` in settings and list each in order with a
one-line description.

**API Endpoints / Views** — list every view or DRF viewset with: HTTP method(s),
URL pattern, permission classes, request/serializer, and response.

**Settings of Note** — list security-relevant and environment-driven settings
(DEBUG, ALLOWED_HOSTS, auth, database) with their source (env var).

**Background Jobs** — state whether Celery tasks, management commands, or signals
exist. If none, say so.

Every fact must come from source files.
Sections where the answer cannot be determined: write
`> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are a software architect producing developer-facing workflow documentation for a Django application. Your audience is developers who do not know the codebase. Your output must show every user-facing workflow as a Mermaid sequence diagram with a plain-English summary.

---

### Step 1 — Discovery: build a complete workflow inventory

Read ALL URL configuration files (`urls.py` at project and app level) and every view/viewset they reference. For each URL pattern record:
- HTTP verb(s) + full resolved path
- What user action or system event triggers it
- What it returns / what state it changes

Group related endpoints into logical workflows. A workflow is a user action that may span more than one HTTP call. Do NOT create one workflow per endpoint. Name each workflow with a short, user-facing label and number them sequentially starting at 1.

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
- Include every participant: user role, Browser/Client, Django (view or viewset), DRF Serializer (where used), each named database, each external service, Celery worker (where used)
- Every HTTP call: verb + exact URL path + payload type in parentheses — read from actual `urls.py` and view source
- Every serializer step: label it `validate` or `serialize` with the serializer class name — read from actual serializer source
- Every ORM operation: SQL type (SELECT / INSERT / UPDATE / DELETE) + model name — read from actual queryset calls in views, managers, or querysets
- Every external service call: protocol + operation
- Celery-dispatched tasks: show as an async `par` block or `opt` block with a note that the work runs out of band
- `alt`/`else` for conditional branches (permissions, feature flags, validation failures), `opt` for optional paths, `par` for concurrent or out-of-band operations
- Response arrows use `-->>` (dashed)
- Emit inside a fenced ` ```mermaid ` block

**"What happens:" bullet list:** Bold heading, 4-6 bullets, plain English business rules, no code identifiers, intelligible to a non-technical reader.

---

### Step 4 — Coverage requirement

Document ALL user-facing workflows — do not skip minor ones. If there are 16, document all 16. Background/Celery-triggered endpoints and management-command-driven flows are included with a note in the lead paragraph.

---

### Step 5 — Fallbacks for untraceable flows

Emit what IS traceable. Replace unknown steps with `> ⚠ Could not determine — needs manual input`. Never invent table names, URL paths, or actor names. Never omit a workflow because it is partially untraceable.

---

### Hard rules

1. Table of Contents is ALWAYS the first thing in the file.
2. Never group unrelated endpoints into one workflow for convenience.
3. Never invent database table names, URL paths, model names, or external service details — read from source (`urls.py`, view/viewset, serializer, model, migration).
4. `sequenceDiagram` only.
5. Every HTTP verb + path must match an actual URL pattern in source.
6. Every DB table or model name must match an actual Django model class, `db_table` meta attribute, or migration in source.
7. Do not produce a Dependency Graph of inter-app or module imports.
8. Do not produce call-chain traces (module.function → module.function).

---

## File 3 Prompt — architecture-reference.md

You are a software architect cataloguing reference data for a Django project.
This is a reference-only file — precision matters more than narrative.

**Dependency Versions** — read the manifest (and lockfile). Extract every
dependency with its exact pinned version. Copy exactly. Table sorted by name.

**CI/CD Pipelines** — read every pipeline file. For each: filename, trigger, purpose.

**Apps by size** — the 10 apps with the most views/models.
**Most-depended-on apps** — apps imported by the most other apps.

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
