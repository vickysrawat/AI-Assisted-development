---
paths: ["**/*.java", "**/controller/**", "**/service/**", "**/repository/**"]
detect:
  files: ["pom.xml", "build.gradle", "build.gradle.kts"]
---

# Java / Spring Boot Rules — Applied to all .java files

## Architecture
- Thin controllers: no business logic, only request binding + validation + service call + response mapping
- Service layer (`@Service`) owns all business logic and calls Repository
- Repository layer (`@Repository` / Spring Data JPA) owns all persistence — no business logic in queries; custom JPQL/native queries documented
- DTOs (request/response records) never expose JPA entities directly — map at the service or a dedicated mapper boundary
- Constructor injection only — no field `@Autowired` (testability, immutability)

## Response Standards
- Success: return a typed response DTO with the appropriate `ResponseEntity` status
- Validation error: 400 via Bean Validation (`@Valid`) handled by a `@RestControllerAdvice` returning a `ProblemDetail` (RFC 7807)
- Not found: 404 `ProblemDetail` whose `detail` explains what was not found
- Unauthorized: 401 (no auth) or 403 (insufficient authority) — never 404 to hide a resource for security
- Server error: 500 `ProblemDetail` — log the full exception, return a sanitized message only

## Auth Pattern
- Secure at the method or class level with `@PreAuthorize` policies, not ad-hoc checks inside business logic
- Never trust client-provided user IDs — resolve identity from the `SecurityContext` / authenticated principal
- Access the current principal through a thin abstraction (e.g. a `CurrentUserService`), not by reading `SecurityContextHolder` deep in services

## Validation
- Bean Validation annotations (`@NotNull`, `@Size`, `@Pattern`, etc.) on every request DTO field
- Validate at the controller boundary with `@Valid` before any business logic runs
- Cross-field/business rules validated in the service layer with explicit, typed exceptions

## Logging
- SLF4J via `private static final Logger log = LoggerFactory.getLogger(...)`
- Never log PII, secrets, or full request bodies — log identifiers and outcomes, not payloads
- Use parameterized logging (`log.info("user {} updated", id)`), never string concatenation

## Documentation
- Javadoc on all public types and methods that aren't self-evident getters/setters

## File Naming
- Files: `PascalCase.java` (e.g. `UserFilterService.java`, `UserFilterServiceTest.java`)
- DB migrations (Flyway): `V{version}__Descriptive_Name.sql`

## Testing Pattern
- JUnit 5 + Mockito; Arrange / Act / Assert with blank lines between sections
- Mock all collaborators with `@Mock` / `@InjectMocks` (or constructor mocks)
- Test method name: `methodName_whenCondition_thenExpectedBehavior`
- One assertion concept per test; prefer AssertJ fluent assertions
- Always test the error state and the authorization boundary from the ICEA

## Anti-patterns (never generate)
- Missing `@Transactional` on a write service method — silent data loss; annotate every write path
- `@Transactional` on a controller method — transaction too broad (includes HTTP serialization); annotate the service method
- `Optional.get()` without a presence check — `NoSuchElementException`; use `.orElseThrow()` / `.orElse()` / `.ifPresent()`
- Accessing a JPA lazy collection outside `@Transactional` — `LazyInitializationException`; keep the access inside the service, map to DTOs at the boundary
- `new ObjectMapper()` per request — expensive; inject the singleton `ObjectMapper` bean
- `WebSecurityConfigurerAdapter` — removed in Spring 6; use a `SecurityFilterChain` bean
- Mutable instance state in a singleton `@Service` — shared across all requests; use method-local state or `@RequestScope`
- Discarding the `em.merge()` return value — the original stays detached; use the returned managed instance
- Empty `catch (Exception e) {}` — swallows errors; log and rethrow, or handle specifically

## Out of bounds
- No business logic in controllers or repositories
- No `System.out.println` — use the logger
- No secrets in source or `application.properties`/`application.yml` committed to the repo — externalise via env/secret store
