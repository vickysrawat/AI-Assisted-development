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

**Layer Dependency Diagram** — ASCII diagram showing blueprint/view → service →
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

You are a software architect tracing request flows through a Flask app.
Read each view, then follow each through: route → service → repository/data-access
→ database or external API.

For each endpoint trace:
- Entry point: blueprint/module, view function, rule
- Every call in sequence with fully qualified module.function name
- At each step: which database or external service, and how (ORM, requests/httpx)
- Any out-of-band work (Celery/RQ) — list it
- Conditional branches (auth decorators, feature flags) that change the flow
- Response shape at each layer

After the call chains, produce a **Dependency Graph** of inter-module imports.
If a view is too large to trace fully, mark
`> ⚠ Partial trace — complex view, review manually`.

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
