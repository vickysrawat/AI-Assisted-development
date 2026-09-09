# Target Execution Profile: java-spring (Java / Spring Boot)

STATUS: implemented
ROLE: backend (single-track)
MATURITY: ⚠ Unverified against a real target — commands are standard Maven/Spring tooling but have
not been run end-to-end by the plugin. Validate on a real .NET→Java migration before relying on it.

_Concrete tokens for a Java Spring Boot target (Maven shown; Gradle equivalents noted). SKILL.md
Stages 3–6 reference the `{TOKEN}`s; this file is the only place the Java specifics live. Parity for
`.NET → Java` lives in `references/mappings/java-dotnet.md` (bidirectional)._

---

## STACK
Java 21 · Spring Boot 3.x · Maven (or Gradle)

## SKELETON (project structure scaffolded in Step 3.3)
```
pom.xml                                            (or build.gradle)
src/main/java/{basePackage}/
  {App}Application.java                            ← @SpringBootApplication (composition root)
  domain/            ← entities, value objects, domain services (no framework deps)
  application/       ← use cases, ports (interfaces), DTOs
  infrastructure/    ← @Repository impls, JPA/JDBC, external clients
  api/               ← @RestController, request/response records
src/main/resources/application.yml
src/test/java/{basePackage}/                       ← mirrors main
```

## STANDARDS_EXAMPLE (idioms for the ~20-line Architecture Standards block, Step 3.2 §1)
```
AUTH:    Spring Security 6 — SecurityFilterChain bean; JWT via oauth2ResourceServer().jwt()
DB:      Spring Data JPA (JpaRepository) or JdbcTemplate; @Transactional on EVERY write method
LOGGING: SLF4J — structured: log.info("{} completed for {}", action, id)
ERRORS:  @ControllerAdvice + Spring 6 ProblemDetail (RFC 7807)
TX:      @Transactional on writes — omission = silent no-commit; keep entities inside the tx boundary
```

## BUILD
```bash
mvn -q -DskipTests package 2>&1 | tail -5            # Gradle: ./gradlew build -x test
```
- Skeleton verify (Step 3.3): `mvn -q -DskipTests compile 2>&1 | tail -5`
- Cluster work: `mvn -q -DskipTests compile` · Stage 6.1 verify: `mvn -q package`

## TEST_CLUSTER
```bash
mvn -q -Dtest='{Cluster}*Test' test 2>&1 | tail -10   # Gradle: ./gradlew test --tests '*{Cluster}*'
```

## TEST_ALL
```bash
mvn -q test 2>&1 | tail -20
```

## TEST_FRAMEWORK
JUnit 5 + Mockito + AssertJ (+ Testcontainers for real-DB integration; `@SpringBootTest` for slices).

## COVERAGE
```bash
mvn -q verify 2>&1 | tail -5     # JaCoCo bound to the verify phase
# Parse target/site/jacoco/jacoco.csv — sum INSTRUCTION/LINE covered vs missed per package;
# compare package→layer coverage to the Step 5.2 table.
```

## LAYOUT
| Slot | Path |
|---|---|
| Shared kernel | `src/main/java/{basePackage}/shared/` |
| Shared-kernel tests | `src/test/java/{basePackage}/shared/` |
| Cluster source | `src/main/java/{basePackage}/{cluster}/` |
| Cluster tests | `src/test/java/{basePackage}/{cluster}/` |
| Characterization / unit tests | `src/test/java/{basePackage}/` |

## COMPOSITION (integration layer — Step 4.5 writes these)
- `{App}Application.java` — `@SpringBootApplication`; component scan wires the beans
- `application.yml` — configuration skeleton (placeholders only, no secrets); security/datasource config
- `README.md` — structure, build/run, link to architecture docs

## CONFIG (dev configuration + Step 6.2 pre-flight)
Dev config: `src/main/resources/application-dev.yml`. DB-aware pre-flight — skip if no datasource,
fail only if a declared datasource URL is empty/placeholder:
```bash
f=src/main/resources/application-dev.yml
[ -f "$f" ] || { echo "ℹ️  no application-dev.yml — skipping DB pre-flight"; exit 0; }
url=$(grep -E "^\s*url:" "$f" | head -1 | sed 's/.*url:[[:space:]]*//')
[ -z "$url" ] && { echo "ℹ️  no datasource url declared — skipping (DB-less)"; exit 0; }
case "$url" in *"{"*|'""'|"''") echo "❌ Populate spring.datasource.url before E2E"; exit 1;; esac
echo "✅ datasource url populated"
```

## BUILD_UNIT (per-cluster FORBIDDEN set)
`pom.xml` / `build.gradle` · `{App}Application.java` · `application.yml`

## RULES (deployed to .claude/rules/ at Step 3.3a)
`project-rules.md` (always) · `java-rules.md`

## PKG_ADD (skeleton-amendment path)
Add the dependency to `pom.xml` `<dependencies>` (or `build.gradle`) via the orchestrator, then
`mvn -q -DskipTests compile` to resolve. Clusters never edit `pom.xml`/`build.gradle` directly.

## SERVE (Stage 6.2 startup + health probe)
```bash
mvn -q spring-boot:run > /tmp/backend.log 2>&1 &          # Gradle: ./gradlew bootRun
BACKEND_PID=$!
timeout 60 bash -c 'until curl -sf http://localhost:{port}/actuator/health>/dev/null 2>&1;do sleep 1;done' \
  || { echo "❌ Backend failed to start"; tail -20 /tmp/backend.log; kill $BACKEND_PID; exit 1; }
```
Health endpoint: `/actuator/health` (Spring Boot Actuator). Dev-run (Step 6.4): `mvn spring-boot:run`.

## E2E
Playwright for a UI/API target, or REST-assured / `httpx` contract tests for API-only. Token
acquisition per SECURITY-ARCHITECTURE.md (OAuth2 client_credentials / JWT endpoint / API key / none).

## FITNESS
```bash
mvn -q -Dtest='*ArchTest' test 2>&1 | tail -20
```
ArchUnit layer-dependency tests (see `shared/clean-architecture.md`).
