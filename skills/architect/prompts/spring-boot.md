# Prompts — Java / Spring Boot

---

## File 1 Prompt — architecture.md

You are a software architect documenting a Spring Boot codebase for the first time.
Read the following in order: the build file (pom.xml or build.gradle), the main
`@SpringBootApplication` class, `application.properties`/`application.yml`, the
top-level package structure, and any README files at the project root. Do not
read individual service or controller files yet — work only from build-level and
config files for this pass.

Populate architecture.md completely, filling every section:

**Technology Stack** — read the build file and extract: Java version, Spring Boot
version, key starters (web, data-jpa, security, validation), database driver,
migration tool (Flyway/Liquibase), logging, API documentation (springdoc), test
frameworks, build tool, containerization. Present as a table.

**Module Structure** — list every module (multi-module Maven/Gradle) or top-level
package with its path and a one-line responsibility. Include test sources.

**Layer Dependency Diagram** — produce a Mermaid flowchart showing package/module
dependencies (controller → service → repository → entity). Read imports and
module dependencies to determine actual edges, not assumed architecture.

**Bean & Component Responsibilities** — for each `@Service`, `@Component`,
`@Configuration`: its responsibility and the beans it exposes.

**Filter / Interceptor Chain** — read security config and any `OncePerRequestFilter`
/ `HandlerInterceptor` registrations and list them in order with a one-line
description of each.

**API Endpoints** — read all `@RestController`/`@Controller` classes; list every
mapping with: HTTP verb, route (`@RequestMapping`/`@GetMapping` etc.), auth
requirement (`@PreAuthorize`), and return type.

**Configuration Properties** — read `@ConfigurationProperties` classes and
`application.*` and list every config section with its binding class and purpose.

**Background Jobs** — state explicitly whether any `@Scheduled`, `@Async`, or
message-listener beans exist. If none, say so.

Every fact must come from source files.
Sections where the answer cannot be determined: write
`> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-callchains.md

You are a software architect documenting every user-facing API workflow in a Spring Boot project as sequence diagrams. Your audience is developers who do not know the codebase. Your output must show every HTTP endpoint as a Mermaid sequence diagram with a plain-English summary.

---

**Step 1 — Enumerate all workflows.**

Read every `@RestController` and `@Controller` class. For each `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping`, or `@RequestMapping` method, treat it as one workflow. Group by resource or feature area (e.g. all handler methods in `OrderController` are the "Orders" feature group).

Produce a **Table of Contents** at the top of the document in this format:

| # | Workflow | HTTP Verb + Route |
|---|----------|-------------------|
| 1 | Create Order | POST /api/orders |
| 2 | Get Order by ID | GET /api/orders/{id} |

Number workflows sequentially across all controllers. Every mapped handler method in every controller must appear — do not omit "minor" endpoints.

---

**Step 2 — For each workflow, write a section.**

**Heading:** `## Workflow N — Name` (use a plain-English name for the action, not the method name)

**Lead paragraph:** One paragraph — plain English, what HTTP request triggers this workflow, who calls it, and what business outcome it produces. No code jargon. No class names.

**Mermaid sequence diagram** (hard constraints):
- `sequenceDiagram` syntax only — never `flowchart` or `graph`
- Declare all actors/participants at the top: `actor Caller as API Caller`, then `participant` for each layer
- Standard actor set: `API Caller` → `{ControllerClass}` → `{ServiceClass}` → `{RepositoryClass}` → `{DataSourceName}` → `{ExternalServiceName}` (include only what the workflow actually calls)
- Every HTTP call: verb + exact route + payload type, e.g. `Caller->>Ctrl: POST /api/orders (OrderRequest)`
- Every database call: SQL operation + entity/table name, e.g. `Repo->>DB: INSERT INTO orders` or `Repo->>DB: SELECT FROM orders WHERE id = ?`
- Every external call: HTTP method + endpoint, e.g. `Svc->>Ext: POST https://payments.api/charge`
- `alt`/`else` blocks for meaningful branching (validation failure, `Optional.empty()` not-found, auth failure, business rule guard)
- `opt` blocks for optional paths (optional cache lookup, optional event publish)
- `par` blocks for parallel operations (`@Async`, `CompletableFuture.allOf`) — list each parallel branch explicitly
- If a `@Service` queries the DB directly via JDBC rather than through a repository, show `Svc->>DB` directly — do not invent a repository actor
- Response arrows use `-->>` (dashed), e.g. `Ctrl-->>Caller: HTTP 201 Created {id}`
- Emit inside a fenced ` ```mermaid ` block

**"What happens:" bullet list:** Bold heading, 4-6 bullets, plain English only — no class names, bean names, or technical terms a non-developer would not understand. Cover: what triggers the workflow, what the server validates, what data it reads or writes, what the caller receives, what happens on the main error path.

---

**Actor naming:**

| Actor label | Represents |
|---|---|
| `API Caller` | The external system or client sending the HTTP request |
| `{ControllerClass}` | The Spring `@RestController` that receives the request (use actual class name) |
| `{ServiceClass}` | The `@Service` bean handling business logic (use actual bean class name) |
| `{RepositoryClass}` | The `@Repository`, JPA repository interface, or DAO (use actual name) |
| `{DataSourceName}` | The database (use the datasource name from `application.yml` / `application.properties`) |
| `{ExternalServiceName}` | `RestClient`, `WebClient`, or external SDK target — include only when the workflow actually calls it |

---

**Completeness rules:**

- Every mapped handler method in every controller = one workflow section. Do not skip any.
- If a handler delegates 100% of its logic to another method or bean, trace into that bean until you reach an actual service or repository call.
- If a method body is too large or deeply nested to trace fully, emit the diagram up to the point traceable and mark the stopping point with `> ⚠ Partial trace — complex method, review manually`
- Do not invent actors, database tables, external services, or entity names not present in source.
- Sections where the target cannot be determined: write `> ⚠ Could not determine — needs manual input`

---

**Hard rules:**

1. Table of Contents is ALWAYS the first thing in the file.
2. Never group unrelated endpoints into one workflow for convenience.
3. Never invent database table names, HTTP routes, or external service details — read from source.
4. `sequenceDiagram` only.
5. Every HTTP verb + route must match an actual `@GetMapping`/`@PostMapping`/etc. annotation in source.
6. Every DB table or entity name must match an actual `@Entity` class, `@Table` annotation, or SQL script in source.
7. Do not produce a Bean-Level Dependency Graph.
8. Do not produce Fan-In / Fan-Out tables — those belong in `architecture-reference.md`.

---

## File 3 Prompt — architecture-reference.md

You are a software architect cataloguing reference data for a Spring Boot project.
This is a reference-only file — precision matters more than narrative.

**Dependency Versions** — read the build file. Extract every dependency with its
exact version (resolve managed versions from the Spring Boot BOM where used) and
which module declares it. Copy version strings exactly. Present as a table sorted
by group:artifact.

**CI/CD Pipelines** — read every pipeline file (.yml/.yaml in CI folders,
Jenkinsfile). For each: filename, trigger condition, purpose in one sentence.

**Top Fan-Out beans** — the 10 beans with the most constructor dependencies.
**Top Fan-In types** — the 10 types injected into the most constructors.

Do not summarise or paraphrase dependency coordinates or versions — copy exactly.

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
