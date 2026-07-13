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

You are a software architect tracing request flows through a Django app.
Read each view/viewset, then follow each through the full chain: url → view →
service/manager → model/ORM → database or external API.

For each endpoint trace:
- Entry point: app, view class/function, URL pattern
- Every call in sequence with fully qualified module path
- At each step: which database/table or external service, and how (ORM queryset,
  requests/httpx)
- Any async or Celery-dispatched work — list what runs out of band
- Conditional branches (permissions, feature flags) that change the flow
- Serializer/response shape at each layer

After the call chains, produce a **Dependency Graph** of inter-app imports and
shared utilities. If a view is too large to trace fully, mark
`> ⚠ Partial trace — complex view, review manually`.

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
