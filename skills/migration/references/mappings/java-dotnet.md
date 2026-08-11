# Parity Mapping: Java Spring Boot ↔ .NET Core

_Bidirectional — read the applicable direction section based on resolved TARGET spec._

---

## Direction: Java Spring Boot → .NET Core

### GREEN — Migrates Cleanly

| Java (Spring Boot) | .NET target | Confidence |
|---|---|---|
| `@Component` / `@Service` / `@Repository` | Registered in `IServiceCollection` (explicit, no scanning) | Verified |
| `@RestController` + `@GetMapping` | `[ApiController]` + `[Route]` + `[HttpGet]` | Verified |
| `@ControllerAdvice` + `@ExceptionHandler` | `IExceptionHandler` / `UseExceptionHandler` middleware | Verified |
| `application.yml` config | `appsettings.json` + `IOptions<T>` | Verified |
| `@ConfigurationProperties` | `IOptions<T>` binding | Verified |
| Spring profiles (`spring.profiles.active`) | `ASPNETCORE_ENVIRONMENT` + `appsettings.{Env}.json` | Verified |
| JUnit 5 `@Test` | xUnit `[Fact]` | Verified |
| JUnit 5 `@ParameterizedTest` | xUnit `[Theory]` + `[InlineData]` | Verified |
| Mockito `@Mock` + `when().thenReturn()` | NSubstitute `Substitute.For<>()` + `.Returns()` | Verified |
| Lombok `@Data` / `@Value` | C# record / init-only properties | Verified — native language feature |
| Lombok `@Slf4j` | `ILogger<T>` injected via constructor | Verified |
| Flyway / Liquibase SQL migrations | DbUp or EF Core Migrations | Verified (different format) |
| Maven `pom.xml` | `.csproj` (SDK-style) | Verified — structurally equivalent |
| Spring Boot Actuator `/health` | `AddHealthChecks()` + `/healthz` | Verified |

### YELLOW — Needs Rework

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Spring Security (JWT/OAuth2) | `SecurityFilterChain` → `AddAuthentication().AddJwtBearer()` + `AddAuthorization()`. Claims mapping: JWT `sub` → `ClaimTypes.NameIdentifier` — must configure `NameClaimType`. Role claim name must match `RoleClaimType`. | M | MEDIUM |
| Jackson → System.Text.Json | `@JsonProperty` → `[JsonPropertyName]`. **S.T.J is case-sensitive by default** — Jackson is case-insensitive. Set `PropertyNameCaseInsensitive = true` or annotate all properties. | S | MEDIUM |
| Jackson `@JsonIgnoreProperties` (class-level) | No S.T.J class-level equivalent. Must annotate each property with `[JsonIgnore]` or set global `UnknownTypeHandling`. | S | LOW |
| Spring Data JPA auto-generated queries | If Dapper rule applies: every JPA method-name query (`findByEmail`) must be rewritten as explicit Dapper parameterised SQL. | L | HIGH |
| Flyway / Liquibase | SQL files → DbUp (SQL files, similar) or EF Core Migrations (C# code-first). History table format differs — start fresh. | M | MEDIUM |
| `@Async` methods | `.NET async/await` — method returns `Task`. Caller must `await`; cannot fire-and-forget without explicit `Task.Run`. | M | MEDIUM |
| `@Scheduled` | `BackgroundService` + `PeriodicTimer` or Quartz.NET. | M | LOW |
| `@Valid` + Bean Validation | FluentValidation or DataAnnotations. `[Required]`, `[Range]`, `[StringLength]` annotations. | S | LOW |

### RED — Will Break

**@Transactional — NO implicit .NET equivalent (BLOCKER — silent data loss)**
- What breaks: Spring's `@Transactional` declaratively wraps the method in a DB transaction. In .NET, there is NO implicit equivalent. Without `SaveChangesAsync()`, EF Core silently discards all tracked changes. This is the #1 correctness bug in Java→.NET migrations.
- Options: (A) Every write path explicitly calls `await _context.SaveChangesAsync()`. (B) Wrap multi-step operations in `TransactionScope` for cross-context transactions.
- Recommendation: (A) for most cases. Add to code review checklist: every write service method must call `SaveChangesAsync`.
- Behavioral risk: BLOCKER

**Spring AOP / AspectJ — no HTTP-agnostic equivalent in .NET**
- What breaks: Spring AOP intercepts any Spring bean method. ASP.NET Core middleware is HTTP-scoped only — cannot intercept domain service calls.
- Options: (A) Scrutor `.Decorate<IService, LoggingService>()` for logging/auditing. (B) Castle DynamicProxy for method-level interception. (C) MediatR pipeline behaviors for CQRS commands.
- Recommendation: Scrutor for simple cross-cutting (logging, auditing). MediatR behaviors for transactional pipeline. Document which aspects have no .NET equivalent.
- Behavioral risk: HIGH

**JPA/Hibernate lazy loading**
- What breaks: EF Core lazy loading is opt-in (`UseLazyLoadingProxies()` + `virtual`). Without it, navigation properties return `null` silently — no exception. Easy to miss in testing (null is falsy in boolean checks).
- Options: (A) Enable lazy loading proxies temporarily, then replace with `.Include()`. (B) Add `.Include()` to every query touching navigation properties (recommended).
- Behavioral risk: HIGH (silent null — no exception thrown)

**`@JsonIgnoreProperties` + Jackson Builder pattern**
- What breaks: Lombok `@Builder` + `@Jacksonized` for immutable DTO deserialization has no 1:1 .NET equivalent. S.T.J requires `[JsonConstructor]` on the primary constructor.
- Options: Use C# record with `[JsonConstructor]` and `[JsonPropertyName]`.
- Behavioral risk: MEDIUM

---

## Direction: .NET Core → Java Spring Boot

### GREEN — Migrates Cleanly

| .NET | Java Spring Boot | Confidence |
|---|---|---|
| `[ApiController]` + `[Route]` + `[HttpGet]` | `@RestController` + `@RequestMapping` + `@GetMapping` | Verified |
| `IServiceCollection` constructor injection | `@Component` / `@Service` (constructor injection, single ctor) | Verified |
| `appsettings.json` + `IOptions<T>` | `application.yml` + `@ConfigurationProperties` | Verified |
| `IExceptionHandler` / `UseExceptionHandler` | `@ControllerAdvice` + `@ExceptionHandler` | Verified |
| xUnit `[Fact]` | JUnit 5 `@Test` | Verified |
| xUnit `[Theory]` + `[InlineData]` | JUnit 5 `@ParameterizedTest` + `@ValueSource` / `@CsvSource` | Verified |
| NSubstitute `Substitute.For<>()` | Mockito `@Mock` + `@ExtendWith(MockitoExtension.class)` | Verified |
| C# records / init-only props | Lombok `@Value` (immutable) or Java records (Java 16+) | Verified |
| `ILogger<T>` + Serilog | SLF4J + Logback (Spring Boot default) + `@Slf4j` | Verified |
| `ASPNETCORE_ENVIRONMENT` + `appsettings.{Env}.json` | `spring.profiles.active` + `application-{env}.yml` | Verified |

### YELLOW — Needs Rework

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| EF Core / Dapper | Spring Data JPA (`JpaRepository`) or JDBC Template. LINQ queries → method-name derivation or JPQL `@Query`. | L | MEDIUM |
| ASP.NET Core auth middleware | `SecurityFilterChain` bean (Spring 6). JWT: `oauth2ResourceServer().jwt()`. Role-based: `@PreAuthorize`. | M | MEDIUM |
| Middleware pipeline | Spring `Filter` (low-level) or `HandlerInterceptor` (MVC-level). Ordering: Spring has two-tier vs .NET's single chain. | M | MEDIUM |
| `async/await` + Task | Java 21 virtual threads (`spring.threads.virtual.enabled=true`) for similar non-blocking I/O. Avoid `CompletableFuture` chains unless reactive needed. | M | LOW |
| `BackgroundService` / Quartz | `@Scheduled` (cron or fixed delay) or Spring Batch for complex jobs. | M | LOW |
| FluentValidation | Jakarta Bean Validation (`@Valid`, `@NotNull`, `@Size`). | S | LOW |

### RED — Will Break

**Java checked exceptions — no C# equivalent**
- What breaks: Java `IOException`, `SQLException`, `URISyntaxException` are checked — won't compile until handled. C# has no checked exceptions. Ported code that relied on the compiler to enforce handling becomes silent failure.
- Fix: At every Java method that throws a checked exception, add `try/catch` or declare `throws` in the method signature. Check every service method called from controllers.
- Behavioral risk: MEDIUM

**`@Transactional` boundary — `LazyInitializationException`**
- What breaks: Accessing a JPA lazy collection OUTSIDE a `@Transactional` method throws `LazyInitializationException`. EF Core has no equivalent constraint — data either loads (if tracking) or returns null.
- Fix: Keep all business logic inside `@Service` methods annotated `@Transactional`. Use DTOs at controller boundary — never pass JPA entities to controllers.
- Behavioral risk: HIGH

**Java type erasure vs C# reified generics**
- What breaks: `List<String>` at runtime in Java is just `List` — generic type info is erased. Jackson `TypeReference<List<T>>` patterns that worked in C# generic deserialization have different semantics.
- Fix: Use `new TypeReference<List<MyClass>>() {}` for Jackson generic deserialization in Java.
- Behavioral risk: MEDIUM

**`@ConditionalOnMissingBean` — no .NET DI equivalent**
- What breaks: Spring's conditional bean registration has no .NET equivalent. Teams that relied on this to override beans must explicitly control registration order in .NET.
- Fix: Use explicit last-wins registration order in Spring's `@Configuration` classes, or restructure to avoid conditional beans.
- Behavioral risk: LOW

---

## Shared Gotchas (Both Directions)

1. **DI scope defaults differ** — Spring defaults to Singleton. .NET defaults depend on registration method (`AddScoped` is request-scoped). A Singleton Spring service migrated to `AddTransient` in .NET creates new instances per injection — a behavioral difference in stateful services.
2. **JVM warmup vs .NET startup** — Spring Boot 2–8s cold start vs .NET <100ms. Spring Boot 3.3+ GraalVM native closes this gap but requires an AOT build step.
3. **HikariCP (Spring) vs ADO.NET pooling (.NET)** — both pool DB connections. Map `maximumPoolSize` (Hikari) to `Max Pool Size` (connection string). Map `minimumIdle` to `Min Pool Size`. Mismatched pool settings cause under- or over-utilisation.
