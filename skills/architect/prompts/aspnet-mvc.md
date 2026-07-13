# Prompts — ASP.NET Core MVC with Razor Views

---

## File 1 Prompt — architecture.md

You are a software architect documenting an ASP.NET Core MVC application with Razor Views.
Read in order: the .sln file, all .csproj files, Program.cs, and
the top-level folder structure including Views/, Controllers/, and wwwroot/.

Populate architecture.md completely:

**Technology Stack** — .NET version, ASP.NET Core MVC version, authentication
(Identity, Entra ID, Cookie, OpenIdConnect), data access (EF Core version,
Dapper, ADO.NET), client-side bundling (LibMan, Bundler & Minifier, webpack,
Vite), CSS framework, JavaScript libraries in wwwroot/, test frameworks.

**Solution Structure** — list every project with folder path and one-line purpose.

**Controller / Action / View Map** — read every Controller class.
For each action: HTTP verb, route, return type (View, PartialView, JSON, Redirect),
View file path, and auth requirement.

**Razor Layout Hierarchy** — identify _Layout.cshtml files and which
_ViewStart.cshtml files reference them. Map the layout hierarchy per area.

**Partial Views and View Components** — list all partial views and
View Components with their purpose and where they are used.

**Tag Helpers and HTML Helpers** — identify any custom Tag Helpers or
HTML Helpers defined in the project and their purpose.

**Middleware Pipeline** — read Program.cs and list every middleware
registration in order with its purpose.

**Client-Side Bundling** — read bundleconfig.json or libman.json.
List input files, output bundle files, and minification settings.

Every fact must come from source files.
Sections that cannot be determined: `> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are documenting request flows in an ASP.NET Core MVC application with Razor Views.

For each significant controller/action trace the full flow:
- Route URL → controller → action → service/repository → database
- View rendering: which .cshtml is rendered, which partial views it includes,
  what model is passed
- AJAX endpoints: actions that return JSON for partial page updates,
  and the JavaScript that calls them
- Form submissions: which actions handle POST, model binding, validation,
  redirect-after-post pattern

**Razor View Data Flow** — for key views, document:
- ViewModel type passed from controller
- ViewBag/ViewData keys used (flag these as code smells)
- Sections defined and rendered (@section, @RenderSection)

**Authentication Flows** — trace the login, logout, and access-denied flows.
Identify which middleware handles redirects and which controller actions
handle the auth callbacks.

**JavaScript / AJAX Patterns** — list the key AJAX calls made from
Razor views: the JS file, the endpoint called, and what DOM element it updates.

Read actual controller, service, and view files.
Mark incomplete traces: `> ⚠ Partial trace — review manually`

---

## File 3 Prompt — architecture-reference.md

You are documenting reference data for an ASP.NET Core MVC application.

**NuGet Package Versions** — read all .csproj files.
Extract every PackageReference with exact version. Copy exactly.
Group by: ASP.NET Core, EF Core, Identity, Auth, client-side, testing, other.

**Static Asset Inventory** — read wwwroot/ structure.
List JS libraries (from lib/ or vendor/) with versions where identifiable
from filenames or package manifests.

**appsettings Configuration** — list every appsettings.{Environment}.json file.
For each key in the root appsettings.json, note its purpose
(use placeholder for secret-looking values).

**Areas** — list every Area defined in the project with its purpose.

**CI/CD Pipelines** — for each pipeline file: name, trigger, purpose.

**Bundle Files** — if bundleconfig.json exists, list every output bundle
with its input files.

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
