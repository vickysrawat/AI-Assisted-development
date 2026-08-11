# Stack Reference: Java Spring Boot

_For migration skills — loaded when source or target stack token = `java`_

---

## Core Patterns

**Dependency Injection**
- Convention-based scanning: `@Component`, `@Service`, `@Repository`, `@Controller` are auto-discovered.
- Default scope: Singleton. `@RequestScope` and `@SessionScope` must be explicitly declared.
- Prefer constructor injection (Spring recommends; a single constructor doesn't need `@Autowired`).
- `@ConfigurationProperties` binds config sections to POCOs — the equivalent of .NET's `IOptions<T>`.

**@Transactional (CRITICAL for outbound migrations)**
- Declaratively wraps a method in a DB transaction. ALL write service methods must be annotated.
- When migrating TO .NET: there is NO implicit equivalent. Every write path must explicitly call `SaveChangesAsync()`. This is the #1 correctness bug in Java→.NET migrations.
- Accessing a JPA lazy collection OUTSIDE a `@Transactional` method → `LazyInitializationException`.

**Spring Security**
- Modern API (Spring 6+): `SecurityFilterChain` bean. `WebSecurityConfigurerAdapter` is REMOVED — do not port it.
- JWT auth: `oauth2ResourceServer().jwt()` with `JwtDecoder` bean.
- Method security: `@PreAuthorize("hasRole('ADMIN')")` or policy-based.
- Claims: JWT `sub` claim is the principal identity.

**Spring MVC / REST**
- `@RestController` = `@Controller` + `@ResponseBody`.
- `@GetMapping`, `@PostMapping` etc. — method-level route mapping.
- `@ControllerAdvice` + `@ExceptionHandler` = global exception handling.
- `@Valid` + Bean Validation (Jakarta Validation) for request body validation.

**Data Access**
- Spring Data JPA: `JpaRepository<T, ID>` with method-name derivation (`findByEmail(String email)`).
- `@Query("SELECT u FROM User u WHERE ...")` for complex JPQL.
- Hibernate lazy loading: default for collections (`FetchType.LAZY`). Use `JOIN FETCH` or `@EntityGraph` to avoid N+1.
- `em.merge(detachedEntity)` returns a NEW managed instance — the passed-in object stays detached. Any setters on the original after merge are silently dropped.
- Flyway / Liquibase for schema migrations (SQL files, idempotent).

**Configuration**
- `application.yml` / `application.properties`. Profile overlays: `application-dev.yml`.
- Active profile: `spring.profiles.active` env var.
- `@ConfigurationProperties(prefix = "myapp")` binds to strongly typed class.

**Lombok (common annotations)**
- `@Data` → mutable class with getters/setters/equals/hashCode/toString
- `@Value` → immutable class (all fields final)
- `@Builder` → builder pattern (pair with `@Jacksonized` for Jackson deserialization)
- `@Slf4j` → injects `private static final Logger log`
- `@EqualsAndHashCode(of = "id")` → required for Hibernate entity proxy comparison

**Jackson (JSON)**
- Case-insensitive by default (unlike System.Text.Json).
- `@JsonProperty("snake_case")` → rename field.
- `@JsonIgnore` → exclude field.
- `@JsonIgnoreProperties({"field1", "field2"})` → class-level ignore list (no S.T.J equivalent).
- `@JsonInclude(Include.NON_NULL)` → omit null values.
- `ObjectMapper` is thread-safe after configuration — create once as a singleton bean.

**Testing Stack**
- JUnit 5: `@Test`, `@BeforeEach`, `@AfterEach`, `@ParameterizedTest`.
- Mockito: `@Mock` + `@ExtendWith(MockitoExtension.class)` · `when(x.foo()).thenReturn(y)` · `verify(x).foo()`.
- Spring Boot Test: `@SpringBootTest` for full integration · `@WebMvcTest` for controller slice.
- `@MockBean` to override a Spring bean in integration tests.
- Testcontainers for real-DB integration.

---

## Anti-Patterns

Enforced anti-patterns + coding conventions for this stack live in `rules/java-rules.md`
(authoritative — `## Anti-patterns` / `## Out of bounds`). This reference adds only the
migration-specific context below.

---

## Spring AOP → .NET Migration Notes

Spring AOP intercepts any Spring-managed bean method. ASP.NET Core middleware is HTTP-scoped only — it cannot intercept domain service method calls.

When migrating Spring AOP `@Aspect` to .NET:
- HTTP-level concerns (logging, timing, auth): → ASP.NET Core middleware or Action Filters
- Domain/service-level concerns (auditing, retry, caching): → Scrutor `.Decorate<IService, LoggingService>()` or Castle DynamicProxy
- CQRS command cross-cutting (transaction, validation): → MediatR pipeline behaviors

Spring AOP capabilities with NO .NET equivalent:
- `@DeclareParents` (mixin/introduction) — no native equivalent
- AspectJ compile-time weaving — no native equivalent (PostSharp commercial)

---

## Key Gotchas for Outbound Migration (Java → .NET)

1. **Checked exceptions have no C# equivalent** — Java `IOException`, `SQLException` must be handled at declaration. In C# all exceptions are unchecked. Ported code with empty catch blocks for checked exceptions becomes silent failure.
2. **Java type erasure** — `List<String>` at runtime is just `List` in Java. C# reified generics retain full type info. `TypeReference<List<T>>` Jackson deserialization patterns don't translate 1:1.
3. **`Optional<T>` ≠ nullable reference types** — Java `Optional` is not a null wrapper. `.get()` without `.isPresent()` throws. Map to C# nullable types or `Result<T>` patterns.
4. **JVM startup cost** — Spring Boot traditionally 2–8s startup vs. <100ms for Kestrel. Spring Boot 3.3+ with GraalVM native image closes this gap but requires a separate AOT build pipeline.
5. **`equals()`/`hashCode()` on entities** — Hibernate needs `equals`/`hashCode` for proxy comparison. EF Core uses reference identity internally. When generating .NET entities, do NOT port Java `equals`/`hashCode` unless there's a specific requirement.
