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

**Layer Dependency Diagram** — draw an ASCII diagram showing package/module
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
