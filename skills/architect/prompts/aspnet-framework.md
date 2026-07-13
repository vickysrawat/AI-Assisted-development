# Prompts — Legacy ASP.NET Framework

---

## File 1 Prompt — architecture.md

You are a software architect documenting a legacy ASP.NET Framework application.
Read in order: the .sln file, all .csproj files, packages.config files,
Web.config (root), Global.asax, and the top-level folder structure.

Populate architecture.md completely:

**Technology Stack** — .NET Framework version (from .csproj TargetFrameworkVersion),
ASP.NET type (WebForms, MVC, Web API, or mixed), authentication (Forms Auth,
Windows Auth, Identity), ORM or data access (Entity Framework version,
Dapper, ADO.NET direct), JavaScript framework (jQuery version, any SPA libraries),
CSS framework, NuGet packages from packages.config.

**Solution Structure** — list every project with folder path and one-line purpose.

**Request Pipeline** — read Global.asax Application_Start. List every
HttpModule registered, HttpHandler registered, route table configuration,
and filter registration (GlobalFilters for MVC).

**Authentication & Authorization** — read Web.config authentication section,
any custom AuthorizeAttribute, membership provider configuration.

**Web.config Transforms** — list every Web.{Environment}.config transform file
and summarise what each overrides (connection strings, app settings, debug flags).

**Database Access Pattern** — identify which database access pattern is used:
Entity Framework (version, Code First/DB First/Model First), Dapper, raw ADO.NET.
List connection string names from Web.config.

**Upgrade Risk Areas** — identify patterns that are blockers or risks
for a future migration to .NET: synchronous HttpModules, WebForms ViewState,
COM interop, HttpContext.Current usage, static state, non-DI instantiation patterns.

Every fact must come from source files.
Sections that cannot be determined: `> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are documenting request flows through a legacy ASP.NET Framework application.

For MVC controllers: trace each action method through the call chain
(controller → service/manager → repository/DAL → database).

For WebForms: trace each Page_Load and event handler through the call chain.

For Web API controllers: trace each ApiController action.

For each flow document:
- Entry point (route URL or page file)
- Every method call in sequence with class names
- Database calls (connection string used, query type)
- Any external HTTP calls
- Session or ViewState usage
- Auth check points

**HttpModule Pipeline** — list every module in the request pipeline
with its event subscriptions (BeginRequest, AuthenticateRequest, etc.)
and what it does.

**jQuery/JavaScript Patterns** — identify key JavaScript interaction patterns:
AJAX calls (endpoints called, data format), form submission patterns,
any SPA-like patterns built with jQuery.

Read actual code files — do not infer from naming conventions.
Mark incomplete traces: `> ⚠ Partial trace — review manually`

---

## File 3 Prompt — architecture-reference.md

You are documenting reference data for a legacy ASP.NET Framework application.

**NuGet Package Versions** — read all packages.config files.
List every package with id, version, and which project it belongs to.
Copy version strings exactly.

**Web.config App Settings** — list every key in <appSettings> from the
root Web.config (use placeholder for values that look like secrets).

**Connection Strings** — list every connection string name and its
providerName (not the actual connection string value).

**Registered Routes** — list every explicitly registered route from
RouteConfig.cs or Global.asax with its URL pattern and defaults.

**Build / Publish Configuration** — list publish profiles found
in Properties/PublishProfiles/ with their deployment targets.

**CI/CD Pipelines** — for each pipeline file: name, trigger, purpose.

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
