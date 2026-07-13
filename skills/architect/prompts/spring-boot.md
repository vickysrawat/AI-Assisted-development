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

You are a software architect tracing request flows through a Spring Boot app.
Read every controller class, then follow each handler method through the full
call chain: controller → service → repository → database or external API.

For each endpoint trace:
- Entry point: controller class, method name, route
- Every method call in sequence with fully qualified class/bean name
- At each step: which database (name the datasource) or external service is
  called, and how (JPA repository, `RestClient`/`WebClient`, JDBC)
- Any parallel/async operations (`@Async`, `CompletableFuture`) — list what runs in parallel
- Conditional branches that significantly change the flow (feature flags, null short-circuits)
- Return type at each layer

After all call chains, produce a **Bean-Level Dependency Graph**: for each
non-trivial bean, read its constructor and list every injected dependency by type.

Then produce two tables:
- **Highest Fan-In** (top 10 types injected into the most constructors)
- **Highest Fan-Out** (top 10 beans with the most constructor parameters)

Read actual constructors and method bodies — do not infer from type names alone.
If a method body is too large to trace fully, mark
`> ⚠ Partial trace — complex method, review manually`.

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
