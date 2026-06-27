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

**Layer Dependency Diagram** — ASCII diagram showing url → view → service (if a
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
