# Prompts — .NET Web API

---

## File 1 Prompt — architecture.md

You are a software architect documenting a .NET codebase for the first time.
Read the following in order: the .sln file, all .csproj files, Program.cs,
the top-level folder structure, and any README files at the solution root.
Do not read individual service or controller files yet — work only from
project-level files for this pass.

Populate architecture.md completely, filling every section:

**Technology Stack** — prefer the already-computed `.claude/dream-init-state.json` →
`generations.dotnet` (avoids re-parsing): its `versions[]` gives the **per-project runtime**
(`path` · `tfm` · `role` · `generation`) and `version` the primary; `packages` gives NuGet versions.
Present a **Runtime** table with ONE ROW PER PROJECT (path · TFM · role) when `heterogeneous` is
true — do NOT collapse a mixed solution to a single runtime. If the state entry is missing/stale
(no `versions[]`, or a csproj newer than `generations_meta.detected_at`), fall back to reading the
.csproj files directly. Also extract: auth library, data access library, database driver, logging,
config provider, API docs library, health checks, test frameworks, CI/CD, containerization.

**Solution Structure** — list every project in the solution with its folder
path and a one-line statement of its responsibility. Include test projects.

**End-to-End Architecture** — produce a Mermaid `flowchart LR` showing the whole
system: caller/actor → API → services → repositories → data store(s) → external
dependencies. Use edge labels for protocol/auth where known (e.g. `HTTPS/JWT`,
`SQL`, `REST`). Only include nodes confirmed from source (Program.cs, .csproj,
controllers, appsettings) — never invent a component. Emit a valid fenced
` ```mermaid ` block; keep node labels short and free of characters that break
Mermaid (`()[]{}` inside labels).

**Layered View** — produce a Mermaid `flowchart TB` of the real layers with
dependency direction, derived from the `<ProjectReference>` edges in each .csproj
(not assumed Clean Architecture). Note deviations in a line under the diagram.
If the layer graph cannot be determined, keep the
`> ⚠ Could not determine — needs manual input` marker instead of emitting an empty
or invalid diagram.

**Project Responsibilities** — for each project: its responsibility,
the DI extension method it exposes (look for `Add*Services()` or `Add*()`
methods in Extensions/ folders), and its `InternalsVisibleTo` test project if present.

**Middleware Pipeline Order** — read Program.cs and list every `app.Use*()`,
`app.Map*()`, and middleware registration in the exact order they appear,
with a one-line description of each.

**API Endpoints** — read all Controller files, list every action method with:
HTTP verb, route template, auth requirement (from attributes), and return type.

**Configuration Sections** — read AppSetting or equivalent config model classes
and list every config section with its model class and purpose.

**Background Jobs** — state explicitly whether any IHostedService,
BackgroundService, or hosted worker exists. If none, say so.

Every fact must come from source files.
Sections where the answer cannot be determined: write
`> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-callchains.md

You are a software architect documenting every user-facing API workflow in a .NET Web API project as sequence diagrams. Your audience is developers who do not know the codebase. Your output must show every HTTP endpoint as a Mermaid sequence diagram with a plain-English summary.

---

**Step 1 — Enumerate all workflows.**

Read every Controller file. For each action method, treat it as one workflow. Group by resource or feature area (e.g. all `OrdersController` actions are the "Orders" feature group).

Produce a **Table of Contents** at the top of the document in this format:

| # | Workflow | HTTP Verb + Route |
|---|----------|-------------------|
| 1 | Create Order | POST /api/orders |
| 2 | Get Order by ID | GET /api/orders/{id} |

Number workflows sequentially across all controllers. Every action method in every controller must appear — do not omit "minor" endpoints.

---

**Step 2 — For each workflow, write a section.**

**Heading:** `## Workflow N — Name` (use a plain-English name for the action, not the method name)

**Lead paragraph:** One paragraph — plain English, what HTTP request triggers this workflow, who calls it, and what business outcome it produces. No code jargon. No class names.

**Mermaid sequence diagram** (hard constraints):
- `sequenceDiagram` syntax only — never `flowchart` or `graph`
- Declare all actors/participants at the top: `actor Caller as API Caller`, then `participant` for each layer
- Standard actor set: `API Caller` → `{ControllerClass}` → `{ServiceClass}` → `{RepositoryClass}` → `{DatabaseName}` → `{ExternalServiceName}` (include only what the workflow actually calls)
- Every HTTP call: verb + exact route + payload type, e.g. `Caller->>Ctrl: POST /api/orders (OrderCreateDto)`
- Every database call: SQL operation + table name, e.g. `Repo->>DB: INSERT INTO Orders` or `Repo->>DB: SELECT FROM Orders WHERE Id = @Id`
- Every external call: HTTP method + endpoint, e.g. `Svc->>Ext: POST https://payments.api/charge`
- `alt`/`else` blocks for meaningful branching (validation failure, not-found, auth failure, business rule guard)
- `opt` blocks for optional paths (optional cache check, optional notification send)
- `par` blocks for parallel operations (`Task.WhenAll`, `Parallel.ForEach`) — list each parallel branch explicitly
- If a service queries the DB directly (e.g. Dapper in the service layer), show `Svc->>DB` directly — do not invent a repository actor
- Response arrows use `-->>` (dashed), e.g. `Ctrl-->>Caller: HTTP 201 Created {id}`
- Emit inside a fenced ` ```mermaid ` block

**"What happens:" bullet list:** Bold heading, 4-6 bullets, plain English only — no class names, method names, or technical terms a non-developer would not understand. Cover: what triggers the workflow, what the server validates, what data it reads or writes, what the caller receives, what happens on the main error path.

---

**Actor naming:**

| Actor label | Represents |
|---|---|
| `API Caller` | The external system or client sending the HTTP request |
| `{ControllerClass}` | The .NET controller that receives the request (use actual class name) |
| `{ServiceClass}` | The service/business logic layer (use actual class name) |
| `{RepositoryClass}` | The repository or data-access class (use actual name) |
| `{DatabaseName}` | The database (use the connection string key name from `appsettings.json`) |
| `{ExternalServiceName}` | Named `HttpClient` or external SDK target — include only when the workflow actually calls it |

---

**Completeness rules:**

- Every action method in every controller = one workflow section. Do not skip any.
- If an action method delegates 100% of its logic to another method, trace into that method until you reach an actual service call.
- If a method body is too large or deeply nested to trace fully, emit the diagram up to the point traceable and mark the stopping point with `> ⚠ Partial trace — complex method, review manually`
- Do not invent actors, database tables, or external services not present in source.
- Sections where the target cannot be determined: write `> ⚠ Could not determine — needs manual input`

---

**Hard rules:**

1. Table of Contents is ALWAYS the first thing in the file.
2. Never group unrelated endpoints into one workflow for convenience.
3. Never invent database table names, HTTP routes, or external service details — read from source.
4. `sequenceDiagram` only.
5. Every HTTP verb + route must match an actual `[HttpGet]`/`[HttpPost]`/etc. attribute in source.
6. Every DB table name must match an actual entity class, SQL script, or migration in source.
7. Do not produce a Class-Level Dependency Graph.
8. Do not produce Fan-In / Fan-Out tables — those belong in `architecture-reference.md`.

---

## File 3 Prompt — architecture-reference.md

You are a software architect cataloguing reference data for a .NET solution.
This is a reference-only file — precision matters more than narrative.

**NuGet Package Versions** — read every .csproj file.
Extract every `<PackageReference>` with its exact `Version` attribute and
which project file it appears in. Copy version strings exactly — do not
round or abbreviate. Present as a table sorted by package name.

**CI/CD Pipelines** — read every .yml/.yaml file in pipelines/ or .azure/
or any pipeline folder at the root. For each file: filename, trigger condition,
and purpose in one sentence.

**Top Fan-Out classes** — list the 10 classes with the most direct constructor
dependencies, with their dependency count and list of types.

**Top Fan-In types** — list the 10 types injected into the most constructors,
with the count and names of classes that depend on them.

Do not summarise or paraphrase package names or versions — copy exactly.

---

## File 4 Prompt — architecture-data.md

You are a software architect documenting the data model of a .NET solution.
Read entity/model classes, any `DbContext` (for schema only — this project uses
Dapper for access), SQL scripts / migrations, and repository classes.

- **Entities / Tables** — list every persisted entity/table with its owning module,
  key columns (PK + notable columns), and purpose.
- **Relationships** — from foreign keys / navigation properties: from-table, to-table,
  cardinality (1:1 / 1:N / N:M), FK column, and on-delete behavior if known.
- **Data Ownership** — infer which module/service is the system-of-record for each
  table (the one that writes it); list who else reads it.
- **Key Aggregates** — the main consistency boundaries (root entity + what loads/saves with it).
- **Access Patterns** — this project mandates **Dapper + parameterised SQL**. For each
  repository, list its queries/stored-procs, the tables touched, and read vs write.
- **Migrations / Schema Source** — where the schema is defined (SQL scripts, DbUp, EF
  migrations-for-schema, DBA-managed).

Every fact must come from source. Where the answer is not derivable, write
`> ⚠ Could not determine — needs manual input` rather than guessing.

---

## File 5 Prompt — architecture-integrations.md

You are a software architect cataloguing this .NET API's external dependencies.
Read HttpClient registrations (named/typed clients), `appsettings*.json` for base
URLs/endpoints, Polly policy registrations, SDK usages (SDKs for queues, blob,
email, third-party APIs), and any SOAP/gRPC clients.

- **External Dependencies** — one row per external system: name, kind (REST/SOAP/queue/
  event bus/SMTP/file share/DB link/SDK), contract (protocol + endpoint/base URL),
  where it is called from (class), and auth mechanism.
- **Resilience & Failure Behavior** — from code: per-dependency timeout, retry/backoff
  (Polly `WaitAndRetry`, `HttpClient.Timeout`), circuit breaker. The **"on failure — what
  happens"** column and **SLA/ownership** are usually human knowledge — if not in code,
  write `> ⚠ Could not determine — needs manual input`.
- **Data Exchanged** — what data crosses each boundary; flag any B-series sensitive data
  leaving the system (see `business-context-severity.md`).

Never invent timeouts, SLAs, or owners. Extract only what code shows; flag the rest.

---

## File 6 Prompt — architecture-security.md

You are a software architect documenting the authorization model and trust map of a
.NET API. Read authentication/authorization setup in Program.cs (`AddAuthentication`,
`AddAuthorization`, policies), `[Authorize]`/`[AllowAnonymous]` attributes on controllers
and actions, `IAuthorizationHandler`/requirement classes, and any resource-based checks.

- **Trust Boundaries / Zones** — where trust changes (browser→API, API→DB, API→external),
  and what is authenticated/validated at each crossing.
- **Authorization Model** — table of Action/Resource → Role/Policy → Enforced-at (name the
  controller/action/handler that enforces it). Derive from `[Authorize(Roles=…/Policy=…)]`
  and policy definitions.
- **Business Rules Gating Actions** — rules beyond role checks (ownership, tenancy). Usually
  human knowledge — flag with `> ⚠ Could not determine — needs manual input`.
- **Secrets Handling (summary)** — only what the application code does (KeyVault client,
  config providers, no secrets in source); cross-link `architecture-deployment.md`.
- **Sensitive Data Handling** — which endpoints/tables carry B-series data and how it is
  protected in transit/at rest/in logs.

Do NOT invent authorization rules or claim protections not present in code — flag gaps.

---

## File 7 Prompt — architecture-decisions.md (SEED ONLY)

You are seeding a decision log for a .NET solution. This is a **seed pass only** — create
the first few `AD-NNN` entries from *detectable, non-obvious* choices; do not attempt to
populate the whole file, and **never invent the rationale**.

For each detected choice, write an entry with:
- **Decision** — what was chosen (from code/config/CLAUDE.md — e.g. "Dapper + parameterised
  SQL, not EF Core"; "single-tenant Entra ID bearer auth"; the layering/project split).
- **Rationale** — always `> ⚠ Could not determine — needs manual input` (the *why* is human).
- **Alternatives rejected** — the obvious alternatives (e.g. EF Core, raw ADO.NET).
- **Date** — `unknown` unless a date is evidenced.
- **Status** — `Accepted`.

Seed at most 3–5 entries. **If this file already contains real `AD-NNN` entries with filled
rationale, do not modify it** — it is an append-only human log.
