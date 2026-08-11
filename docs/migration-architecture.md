# Migration Architecture Guide

> **Purpose:** A comprehensive reference for all migration paths supported by the migration skill.
> Synthesises verified findings from web research (August 2026) across four migration domains:
> .NET modernisation, Java ↔ .NET, React/Angular frontends, Node.js/Express backends.
>
> **Audience:** Developers, architects, and tech leads planning or executing a stack migration.
>
> **Companion:** This document informs the reference files under `skills/migration/references/`.
> The skill loads the relevant sections dynamically based on detected source and target stacks.

---

## Table of Contents

1. [Migration Philosophy](#1-migration-philosophy)
2. [.NET Framework → .NET 10](#2-net-framework--net-10)
3. [.NET Core / 5–8 → .NET 10 Version Upgrade](#3-net-core--58--net-10-version-upgrade)
4. [EF6 → EF Core](#4-ef6--ef-core)
5. [Clean Architecture](#5-clean-architecture)
6. [Java Spring Boot ↔ .NET Core](#6-java-spring-boot--net-core)
7. [ORM Comparison: JPA/Hibernate · EF Core · Dapper](#7-orm-comparison)
8. [Language Idiom Mapping (Java ↔ C#)](#8-language-idiom-mapping)
9. [Node.js / Express → .NET Core](#9-nodejs--express--net-core)
10. [React → Angular](#10-react--angular)
11. [Full-Stack Migration Patterns](#11-full-stack-migration-patterns)
12. [Testing Strategy by Stack](#12-testing-strategy-by-stack)
13. [Performance Characteristics](#13-performance-characteristics)
14. [Source Citations](#14-source-citations)

---

## 1. Migration Philosophy

### Core Principles

**Behaviour preservation first.** A migration that changes behaviour is a feature change wearing a disguise. Keep them separate, always. If a behaviour change is necessary, it gets its own commit, its own PR, and its own review.

**Incremental over big-bang.** Every successful large-scale migration in published case studies uses an incremental/strangler-fig approach. Big-bang rewrites that halt feature development almost never ship. Teams run out of time, money, or will.

**Verify, don't assume.** "Compiles" is not "behaves identically." Silent data bugs (null navigation properties, discarded transactions, wrong table names) are more dangerous than compilation errors because tests don't catch what they don't cover.

**Test the original first.** Characterisation tests written against the original codebase before any migration begins are the primary regression safety net. Without them, you are migrating blind.

### When to Use Each Approach

| Source situation | Recommended approach |
|---|---|
| Large .NET Framework app (>50 endpoints) | Strangler Fig + YARP (incremental, zero downtime) |
| Small .NET Framework app (<20 files) | In-place migration to TARGET_PATH (full migration) |
| .NET Core version upgrade | In-place TFM bump in TARGET_PATH (low risk) |
| Java → .NET | Full migration to TARGET_PATH, slice by layer |
| React+Express → Angular+.NET | Two-track migration, backend first |
| Any migration with WebForms or WCF | Plan for a rewrite budget, not a port budget |

---

## 2. .NET Framework → .NET 10

### Technologies Removed in .NET 8+ (No Upgrade Path)

These are **not** deprecated — they do not exist in .NET 8+. There is no compatibility shim for production use.

| Technology | Removed | Alternative |
|---|---|---|
| WebForms (.aspx + codebehind) | ✗ | Blazor Server (rewrite), Razor Pages (rewrite) |
| WCF Server | ✗ | CoreWCF (lift-and-shift), gRPC, REST |
| .NET Remoting | ✗ | gRPC, SignalR, System.IO.Pipes |
| `BinaryFormatter` serialisation | ✗ | System.Text.Json, Protobuf, MessagePack |
| `AppDomain` isolation | ✗ | Separate processes, `AssemblyLoadContext` |
| Code Access Security (CAS) | ✗ | OS-level security (containers, user accounts) |
| `Delegate.BeginInvoke` / `EndInvoke` | ✗ | async/await + Task |
| `ObjectContext` (EF) | ✗ | EF Core |
| ASMX web services | ✗ | REST or gRPC |

### Best Practices

**1. Strangler Fig + YARP for large apps**
Run the legacy app and the new ASP.NET Core app side-by-side. YARP proxies all traffic to the legacy app initially. As endpoints are migrated, update YARP routing. Clients see one entry point throughout. This is the only approach that allows shipping migrated features to production continuously during a long migration.

```
[Client] → [YARP facade] → /api/orders → [new ASP.NET Core app]
                         → /api/legacy  → [old .NET Framework app]
```

**2. Port class libraries first (target `netstandard2.0`)**
Business logic and data-access libraries that target `netstandard2.0` run on both .NET Framework and .NET Core simultaneously. Extract them from the web project first so they can be shared during the transition period.

**3. Run new and old in parallel, compare outputs**
For each migrated endpoint: run both the legacy and new implementation against the same input, diff the responses. Switch traffic only when outputs match. This is the strangler fig pattern applied at the response level.

**4. Move authentication first**
Authentication touches every route. When both old and new apps are live simultaneously, they must agree on who the user is. Solve this before migrating any business endpoints. Options:
- Share Data Protection key ring + common cookie domain for cookie auth
- Externalise identity to an IdP (Entra ID, Auth0) — both apps validate the same token

**5. Never add new features to the legacy app during migration**
Every feature added to the legacy system is another thing to port. All new features go into the new system from day 1, even if the YARP facade isn't yet routing that domain.

### Anti-Patterns

| Anti-Pattern | Consequence |
|---|---|
| Big-bang rewrite (stop all features, rewrite, cut over) | Almost never ships for production apps; teams run out of budget/time/will |
| `HttpContext.Current` left in business logic | Static ambient context does not exist in ASP.NET Core; will throw `NullReferenceException` |
| `System.Web.Adapters` as a permanent solution | A transition tool, not an endpoint; imports the old tight coupling into the new app |
| Mixing HttpModules/Handlers patterns with middleware | Produces hidden coupling; must be a clean rewrite |
| Adding `BinaryFormatter` workarounds | It was removed for security; find a real replacement |
| Treating a clean build as a successful migration | Silent behavioral differences are not compile-time errors |

### Key Gotchas

**1. WebForms has absolutely no automated migration path**
The Upgrade Assistant explicitly excludes WebForms. Every `.aspx` page is a manual rewrite. Budget 0.5–2 developer-days per page depending on complexity.

**2. Session state API is fundamentally different**
ASP.NET Framework session is synchronous (`Session["key"]`). ASP.NET Core session is asynchronous (`await session.GetAsync("key")`). Code that reads/writes session synchronously throughout business logic requires significant restructuring.

**3. Authentication cookie encryption keys differ**
During a side-by-side Strangler Fig migration, the old app and new app must share Data Protection keys and a common cookie domain, or users will be logged out when YARP routes them to the new backend.

**4. `BeginInvoke` / `EndInvoke` on delegates throws**
`Delegate.BeginInvoke` is not supported and throws `PlatformNotSupportedException` at runtime (not a compile error).

**5. `web.config` transforms require manual mapping**
The Upgrade Assistant migrates basic `<appSettings>` and `<connectionStrings>`. Custom configuration sections, `<system.web>` settings, and environment-specific transforms (`web.Debug.config`) require manual conversion to `appsettings.{Environment}.json` and `IOptions<T>` binding.

### WCF Migration Decision Matrix

| Factor | CoreWCF | gRPC | REST / Web API |
|---|---|---|---|
| Existing SOAP client compatibility | High — minimal client change | Requires new client | Requires new client |
| Performance | Similar to WCF | Highest (binary, HTTP/2) | Moderate |
| Browser callable | No | No (without gRPC-Web) | Yes |
| Long-term viability | Limited (community-maintained) | Strong (Microsoft-backed) | Strong |
| MS recommendation | Transition tool only | Internal services / B2B | Public APIs |

**CoreWCF supports:** BasicHttpBinding, WSHttpBinding, NetTcpBinding, WSDL, WS-Federation, Kafka/RabbitMQ bindings (2024).
**CoreWCF does NOT support:** WSDualHttpBinding, MSMQ, full WS-Security, distributed transactions.

For WCF → non-CoreWCF: SOAP contracts, bindings, and duplex/session semantics WILL NOT survive. Require explicit acknowledgment from the developer before proceeding.

### .NET Upgrade Assistant Status (2025–2026)

The free .NET Upgrade Assistant was **deprecated in late 2025**. Microsoft now directs teams to GitHub Copilot App Modernization (paid Copilot subscription). Community feedback on the AI-based tool is mixed for large undocumented codebases.

**What automated tools handle:**
- Converting legacy `.csproj` to SDK-style format
- Updating `<TargetFramework>` references
- Migrating basic `web.config` keys
- Updating some NuGet package versions

**What NO tool handles:**
- WebForms → Blazor/Razor Pages (full manual rewrite)
- HTTP Modules → Middleware (flagged only)
- WCF service contracts (flagged only)
- EDMX / T4 templates
- `HttpContext.Current` in business logic (flagged only)

---

## 3. .NET Core / 5–8 → .NET 10 Version Upgrade

This is an in-place version upgrade, not a platform migration. The primary work is:
1. Update `<TargetFramework>` in `.csproj` files
2. Bump NuGet package versions
3. Fix version-specific breaking API changes

### Version-Specific Breaking Changes Summary

**From .NET 5 / 6:**
- `Startup.cs` + `CreateHostBuilder` pattern → single-file `Program.cs` (both work in .NET 10, old pattern discouraged)
- Nullable reference types enabled by default from .NET 6
- `BinaryFormatter` deprecated (removed in .NET 8)

**From .NET 7:**
- Rate limiting middleware built-in (`RateLimiter`) — third-party rate limiters can be replaced

**From .NET 8:**
- `BinaryFormatter` **removed** — throws `NotSupportedException` at runtime
- `IExceptionHandler` introduced (replaces `UseExceptionHandler` callback)
- Keyed services (`AddKeyedScoped`) introduced

**From .NET 9:**
- `Microsoft.AspNetCore.OpenApi` first-party package available (can replace Swashbuckle — optional)
- EF Core 9: throws if `Migrate()` called with pending model changes (previously silent no-op)

### Package Audit (Run Before Migrating)

```bash
dotnet list package --outdated
dotnet list package --vulnerable
```

Packages most commonly requiring major version bumps:

| Package | Migration note |
|---|---|
| `Microsoft.EntityFrameworkCore.*` | Must match .NET version (EF Core 10 for .NET 10) |
| `Swashbuckle.AspNetCore` | v6 → v7 has breaking config changes; or migrate to `Microsoft.AspNetCore.OpenApi` |
| `AutoMapper` | v12+ has breaking changes from v10/11 |
| `MediatR` | v12 (for .NET 8+) changed `IRequest` / `IRequestHandler` signatures |
| `FluentValidation` | v11+ removed sync validation methods |
| Old Azure SDK (`WindowsAzure.Storage.*`) | Replace with `Azure.*` SDK family |

---

## 4. EF6 → EF Core

### The Fundamental Warning

**EF Core is NOT a drop-in replacement for EF6.** The official Microsoft documentation states: *"just because your application compiles does not mean it is successfully ported to EF Core."*

Many behavioral differences cause **silent data bugs at runtime** — not compile errors.

### 9 Silent Behavioral Differences

| # | Difference | Risk level | Detection |
|---|---|---|---|
| 1 | **Client-side evaluation throws** (EF Core 3+): `Where()` with custom C# method that EF6 silently loaded all rows for | HIGH | Runtime `InvalidOperationException` |
| 2 | **Lazy loading disabled by default**: navigation properties return `null` silently without `UseLazyLoadingProxies()` + `virtual` | HIGH | Silent null — no exception |
| 3 | **Table naming changed**: EF6 pluralises class names; EF Core uses `DbSet<T>` property name | HIGH | Silent wrong-table query |
| 4 | **GroupBy element projection**: grouping + projecting elements (not just aggregates) throws in EF Core 3–5 | MEDIUM | Runtime exception |
| 5 | **Cascade delete changed** (EF Core 6/7): severing optional dependent no longer deletes it in EF Core 7 | MEDIUM | Silent orphan records |
| 6 | **String comparison collation**: PostgreSQL is case-sensitive by default; same query returns zero rows | MEDIUM | Silent empty results on non-SQL-Server |
| 7 | **`DbSet.Add` graph traversal**: key detection differs from EF6's recursive mark-as-added | MEDIUM | Silent unchanged-entity on disconnected graph |
| 8 | **Pending model changes throw** (EF Core 9+): `Migrate()` with un-scaffolded changes throws; previously silent | LOW | CI pipeline failure on deploy |
| 9 | **Optional dependent data loss**: owned types with no required properties silently lose data | HIGH | Silent data loss |

### EF6 Features with No EF Core Equivalent

- EDMX visual designer and model wizard
- Entity SQL text-based query language
- Independent associations (no FK property)
- `IDatabaseInitializer` (auto-create DB)
- `ObjectContext` API
- T4 templates for code generation

### .edmx Migration Procedure

1. If live DB connection available: `dotnet ef dbcontext scaffold "connection-string" Provider.Name --output-dir Models`
2. If no DB: parse `.edmx` XML to extract `<EntityType>` and `<Association>` elements manually
3. **Always** start a fresh EF Core migration baseline — there is no path from EF6 migration files to EF Core migrations
4. Scaffold an initial EF Core migration and empty its `Up()` / `Down()` methods to create the baseline

### Pre-Migration Audit Checklist

Before touching any EF6 code:
- [ ] `Where(x => CustomMethod(x.Prop))` — client-evaluation risk
- [ ] `GroupBy(...)` followed by accessing group elements
- [ ] Virtual navigation properties without lazy loading config
- [ ] Table name mismatches (entity name vs DbSet property name)
- [ ] `ObjectContext` / `IObjectContextAdapter` usage
- [ ] `BinaryFormatter` on entity types (removed in .NET 8)
- [ ] Cascade delete expectations (test against real DB post-migration)

---

## 5. Clean Architecture

### The One Non-Negotiable Rule

**Dependencies point inward only.**

Domain → has zero dependencies on anything.
Application → depends on Domain only.
Infrastructure → depends on Application + Domain (implements their interfaces).
API/Host → depends on everything (entry point + composition root).

Enforced at compile time via project references. Inner layers literally cannot import outer layers.

### Proportionality Decision

| Scenario | Structure |
|---|---|
| Single bounded context, ≤20 files, 0 RED findings | Simplified (one project, logical folders) |
| Multiple bounded contexts OR >20 files OR ≥2 RED findings | Four-layer (Domain, Application, Infrastructure, API) |

### .NET Four-Layer Structure

```
Solution/
├── Name.Domain/          ← entities, value objects, domain events — NO framework deps
├── Name.Application/     ← use cases, IRepository interfaces, DTOs — depends on Domain only
├── Name.Infrastructure/  ← Dapper/EF Core, external HTTP, email — implements Application interfaces
├── Name.Api/             ← controllers, middleware, DI registration (Program.cs)
└── Name.Tests/           ← xUnit, NSubstitute, Testcontainers
```

### Java Spring Boot Equivalent

```
src/main/java/{package}/
├── domain/            ← @Entity classes, value objects
├── application/       ← @Service classes, use case interfaces
├── infrastructure/    ← @Repository implementations, JPA, external clients
└── api/               ← @RestController classes, request/response DTOs
```

### Anti-Patterns

**Anemic Domain Model** — entities as data bags (all getters/setters, no methods). Business logic in Application services. Eliminates the value of having a Domain layer. Every entity should have at least one method enforcing a business rule.

**EF Core / Dapper leaking into Domain** — `IQueryable<T>`, `DbSet<T>`, `[Column]` annotations on domain entities. Breaks the dependency rule and couples business logic to ORM.

**Repository per entity** — `IOrderRepository` and `IOrderLineRepository` both created. Correct: one repository per aggregate root (`IOrderRepository` owns both `Order` and `OrderLine`).

**MediatR as default** — adds abstraction without value for simple CRUD. Valuable only when pipeline behaviors, notification dispatch, or decoupled routing are genuinely needed.

**Logic in controllers** — controllers should parse HTTP, call Application services, and return HTTP responses. Business logic in controllers is untestable without the full HTTP pipeline.

### Architecture Fitness Tests

**NetArchTest (.NET):**
```csharp
Types.InAssembly(typeof(MyEntity).Assembly)
    .Should().NotHaveDependencyOn("MyApp.Infrastructure")
    .GetResult().IsSuccessful // must be true
```

**ArchUnit (Java):**
```java
noClasses().that().resideInAPackage("..domain..")
    .should().dependOnClassesThat().resideInAPackage("..infrastructure..")
```

---

## 6. Java Spring Boot ↔ .NET Core

### Conceptual Mapping

| Java Spring Boot | .NET Core | Notes |
|---|---|---|
| `@SpringBootApplication` + `main()` | `Program.cs` | Entry point + composition root |
| `@Component` / `@Service` scanning | Explicit `builder.Services.AddScoped<I, T>()` | Spring scans; .NET requires explicit registration |
| `@RestController` + `@GetMapping` | `[ApiController]` + `[Route]` + `[HttpGet]` | Near 1:1 |
| `@ControllerAdvice` + `@ExceptionHandler` | `IExceptionHandler` | Direct equivalent |
| `@ConfigurationProperties` | `IOptions<T>` | Both bind config section to typed POCO |
| `application.yml` + profiles | `appsettings.json` + `appsettings.{Env}.json` | `ASPNETCORE_ENVIRONMENT` = `spring.profiles.active` |
| `@Transactional` | `SaveChangesAsync()` (EF Core) / `TransactionScope` | **No implicit equivalent in .NET — explicit required** |
| JUnit 5 `@Test` | xUnit `[Fact]` | Direct equivalent |
| Mockito `@Mock` + `when().thenReturn()` | NSubstitute `Substitute.For<>()` + `.Returns()` | Different syntax, same concept |
| Lombok `@Data` / `@Value` | C# record / init-only properties | Native language feature in C# |
| Lombok `@Slf4j` | `ILogger<T>` injected via constructor | No field injection in .NET |
| Flyway / Liquibase | DbUp or EF Core Migrations | SQL files → SQL files (DbUp) or C# code-first (EF Core) |
| Spring AOP / AspectJ | Scrutor / Castle DynamicProxy / MediatR behaviors | No HTTP-agnostic AOP equivalent |
| HikariCP connection pool | ADO.NET built-in pooling | Configure `Max Pool Size` ↔ `maximumPoolSize` |

### Java → .NET: Top 5 Correctness Bugs

**1. `@Transactional` → nothing (Silent data loss)**
The single most common correctness bug. Spring `@Transactional` declaratively wraps the method in a DB transaction. In .NET, no implicit equivalent exists. Developers port the service code without adding `SaveChangesAsync()` — changes are silently discarded.

**Rule:** Every write service method must explicitly call `await _context.SaveChangesAsync()`. Add to code review checklist before every PR merge.

**2. `System.Text.Json` is case-sensitive; Jackson is not**
A Spring API client sending `{"userId": 1}` will fail deserialization against a C# model expecting `UserId` unless `PropertyNameCaseInsensitive = true` is configured in `JsonSerializerOptions`.

**3. EF Core lazy loading is opt-in; navigation properties return null silently**
Without `UseLazyLoadingProxies()` + `virtual` on navigation properties, `_order.Customer` returns `null` with no exception. JUnit tests written against the Java model won't catch this because the test setup explicitly loads the graph.

**4. Spring classpath scanning → explicit DI registration**
`@Service` classes are auto-discovered by Spring. In .NET, nothing is registered unless explicitly added in `Program.cs`. The error `InvalidOperationException: Unable to resolve service for type 'IMyService'` is the most common first-week .NET bug for Java developers.

**5. Spring AOP / AspectJ has no domain-layer equivalent in .NET**
Spring AOP can intercept any Spring-managed bean method. ASP.NET Core middleware intercepts HTTP requests only. Domain-service-level cross-cutting concerns (logging, auditing, caching) must be implemented via Scrutor decorators or Castle DynamicProxy — neither is as elegant as AspectJ pointcut expressions.

### .NET → Java: Top 5 Correctness Bugs

**1. `@Transactional` boundary — `LazyInitializationException`**
Accessing a JPA lazy collection outside a `@Transactional` method throws `LazyInitializationException`. EF Core has no equivalent constraint. Fix: keep all business logic inside `@Service` methods annotated `@Transactional`; use DTOs at the controller boundary.

**2. Checked exceptions — won't compile**
Java's `IOException`, `SQLException`, and hundreds of others are checked — the compiler requires them to be handled or declared. C# has no checked exceptions. Ported code that swallowed checked exceptions with empty catch blocks becomes silent failure.

**3. Java type erasure vs. C# reified generics**
`List<String>` at runtime in Java is just `List` — generic type information is erased. `TypeReference<List<MyClass>>` Jackson deserialization patterns have different semantics and boilerplate requirements.

**4. Default Spring Bean scope is Singleton**
In .NET DI, the developer explicitly chooses `AddScoped` (request), `AddSingleton`, or `AddTransient`. In Spring, `@Service` is Singleton by default. C# developers migrating to Java accidentally share mutable request-scoped state across users.

**5. `Optional<T>` ≠ nullable reference types**
Java `Optional<T>` is not a null wrapper — `.get()` without `.isPresent()` throws `NoSuchElementException`. Use `.orElse()`, `.orElseThrow()`, or `.ifPresent()`.

### Jackson → System.Text.Json Attribute Mapping

| Concern | Jackson (Java) | System.Text.Json (.NET) | Critical difference |
|---|---|---|---|
| Property rename | `@JsonProperty("name")` | `[JsonPropertyName("name")]` | None |
| Ignore property | `@JsonIgnore` | `[JsonIgnore]` | None |
| Class-level ignore | `@JsonIgnoreProperties({"f1","f2"})` | **No equivalent** | Must annotate each property |
| Ignore null | `@JsonInclude(Include.NON_NULL)` | `[JsonIgnore(Condition = WhenWritingNull)]` | None |
| Case sensitivity | Case-insensitive by default | **Case-sensitive by default** | Configure `PropertyNameCaseInsensitive = true` |
| Custom serialiser | `@JsonSerialize(using = X.class)` | `[JsonConverter(typeof(X))]` | Same concept |
| Polymorphic types | `@JsonTypeInfo` + `@JsonSubTypes` | `[JsonPolymorphic]` + `[JsonDerivedType]` (.NET 7+) | .NET 7+ added this; older versions need custom converter |

### Lombok → C# Equivalents

| Lombok | C# | Gap |
|---|---|---|
| `@Data` | Auto-properties + mutable record | `@Data` generates mutable class; C# record is immutable by default |
| `@Value` | `record` (positional) | Near-identical for immutable value objects |
| `@Builder` | Object initializers or manual fluent builder | No native builder in C#; `@Builder` + `@Jacksonized` combo has no 1:1 equivalent |
| `@EqualsAndHashCode(of = "id")` | Value semantics in `record` | Required in Java for Hibernate proxy comparison; not needed in EF Core |
| `@Slf4j` | `ILogger<T>` injected via constructor | No field injection; constructor injection only |

---

## 7. ORM Comparison

### Lazy Loading Behaviour

| Behaviour | JPA/Hibernate | EF Core | Dapper |
|---|---|---|---|
| Default for collections | Lazy (`FetchType.LAZY`) | **Disabled** (opt-in) | Not supported |
| Enable lazy loading | Default | `UseLazyLoadingProxies()` + `virtual` nav props | N/A |
| N+1 problem mitigation | `JOIN FETCH` / `@EntityGraph` | `.Include()` / `.ThenInclude()` | You write the JOIN |
| Exception when loading after session closed | `LazyInitializationException` | `ObjectDisposedException` | N/A |
| Change tracking | Dirty checking (persistence context) | Automatic (`ChangeTracker`) | None — explicit writes only |
| Detached entity re-attach | `em.merge()` returns new managed instance | `dbContext.Update(entity)` updates in place | N/A |

**Critical Hibernate gotcha:** `em.merge(detachedEntity)` returns a NEW managed instance. The original passed-in object stays detached. Any setters called on the original after merge are silently dropped. No EF Core equivalent — `dbContext.Update(entity)` marks the passed-in object itself.

### The Hybrid Pattern (Recommended for .NET)

Use **EF Core for write paths** (domain model, change tracking, transactional integrity) and **Dapper for read paths** (reporting, projections, high-throughput queries). This mirrors the CQRS read/write split naturally.

```csharp
// Write path — EF Core (change tracking, transactions)
var order = await _context.Orders.FindAsync(id);
order.Cancel();
await _context.SaveChangesAsync();

// Read path — Dapper (fast projection, no tracking overhead)
var report = await _db.QueryAsync<OrderSummary>(
    "SELECT o.Id, o.Total, c.Name FROM Orders o JOIN Customers c ON ...",
    new { CustomerId = customerId });
```

---

## 8. Language Idiom Mapping

### Spring AOP → .NET Options

Spring AOP can intercept **any Spring bean method**. ASP.NET Core middleware intercepts **HTTP requests only** — it cannot intercept domain service method calls.

| Use case | .NET equivalent | Notes |
|---|---|---|
| HTTP-level concerns (logging, timing, auth) | ASP.NET Core middleware or Action Filters | Direct equivalent |
| Service-level concerns (auditing, caching, retry) | Scrutor `.Decorate<IService, AuditingService>()` | Wraps service at DI layer |
| Method-level interception (any class) | Castle DynamicProxy | Full AOP proxy generation |
| CQRS command cross-cutting (transaction, validation) | MediatR pipeline behaviors | Fits CQRS-only; not general AOP |
| Mixin / interface introduction (`@DeclareParents`) | **Not natively supported** | PostSharp (commercial) |
| Compile-time weaving (AspectJ full mode) | **Not natively supported** | PostSharp (commercial) |

### Maven/Gradle → NuGet Philosophical Differences

| Dimension | Maven | Gradle | NuGet |
|---|---|---|---|
| Version conflict resolution | Nearest-wins (breadth-first) | Highest-version-wins (full graph) | **Single version per package** |
| BOM pattern | `<dependencyManagement>` | Platform dependencies | `Directory.Packages.props` with `ManagePackageVersionsCentrally` |
| Build caching | Limited | Full incremental + build cache | MSBuild incremental |
| Lock files | No native lock | Opt-in dependency locking | `packages.lock.json` (opt-in, .NET 5+) |

**Key difference:** Maven and Gradle allow multiple versions of the same transitive dependency. NuGet enforces exactly one version per package across the entire solution. Diamond-dependency conflicts surface earlier in .NET but resolve more cleanly.

---

## 9. Node.js / Express → .NET Core

### Async Model: Event Loop vs. Thread Pool

| Aspect | Node.js | .NET Core |
|---|---|---|
| Concurrency model | Single-threaded event loop | Managed thread pool + async state machines |
| `async/await` releases thread | No — yields to event loop microtask queue | Yes — genuinely releases thread back to pool |
| CPU-bound work | Blocks event loop; must offload to `worker_threads` | Handled naturally by thread pool |
| `.Result` / `.Wait()` equivalent | No equivalent risk | **Thread pool deadlock under concurrent load** |

**The critical difference:** In Node.js, `async/await` is syntactic sugar — everything runs on one event loop thread. In .NET, `await` genuinely frees the thread for other requests. This means .NET handles mixed CPU/IO workloads better, but any `.Result` / `.Wait()` call in a concurrent context deadlocks under load.

### Express Middleware → ASP.NET Core Middleware

| Express | ASP.NET Core | Notes |
|---|---|---|
| `app.use(fn)` | `app.Use(async (ctx, next) => { ... })` | Same pipeline concept |
| `app.use(path, router)` | `app.Map("/path", ...)` | Path branching |
| `next()` | `await next()` | Must await in .NET |
| `express.json()` | Built-in JSON binding | No package needed |
| `cors()` | `app.UseCors()` | After `UseRouting`, before `UseAuthentication` |
| `helmet()` | `UseHsts()` + `UseHttpsRedirection()` | Built-in |
| `morgan` | `ILogger<T>` + Serilog | Structured logging |
| `passport` | `Microsoft.AspNetCore.Authentication.*` | First-party per provider |
| `express-session` | `Microsoft.AspNetCore.Session` | Async API; no cookieless mode |
| `socket.io` | ASP.NET Core SignalR | Different wire protocol — clients must update to `@microsoft/signalr` |
| `bull` / `bullmq` | Hangfire or Quartz.NET | Both have dashboard UIs |

**ASP.NET Core middleware MUST be registered in this order (unlike Express):**
1. Exception handling
2. HTTPS redirect
3. Static files
4. Routing
5. CORS ← after routing, before authentication
6. Authentication → Authorization
7. Endpoint mapping

### Session Handling Difference

ASP.NET Core does NOT support cookieless session mode (passing session IDs in query strings or hidden form fields). Any legacy code using this must be redesigned — JWT bearer tokens (stateless) are the recommended replacement.

---

## 10. React → Angular

### The Paradigm Shift

React gives developers primitives and lets them build their own architecture. Angular prescribes a complete, integrated ecosystem. This is not a syntax migration — it is a **mental model migration**.

### Modern Angular State Model (Signals, v17+)

| React | Angular | Notes |
|---|---|---|
| `useState(val)` | `signal(val)` | `.set()` / `.update()` instead of setter |
| `useMemo(() => expr, deps)` | `computed(() => expr)` | Auto-tracks deps — no array |
| `useEffect(() => fn, deps)` | `effect(() => fn)` | Auto-tracks deps — no array; different cleanup timing |
| `useCallback(fn, deps)` | Not needed | DI provides stable service references |
| `React.memo` | `ChangeDetectionStrategy.OnPush` | Default in Angular v22+ |

### When to Migrate React → Angular

**Migrate toward Angular when:**
- Enterprise scale requiring enforced architectural standards
- Complex reactive forms with cross-field validation (Angular Reactive Forms are superior)
- Team already knows RxJS and TypeScript deeply
- Long-lived application where Angular's opinions reduce coordination overhead

**Stay on React when:**
- Small team that values flexibility
- Benefits from React Server Components / Next.js SSR ecosystem
- Team cannot budget the 4–6 week RxJS/Signals proficiency ramp per developer

### State Management: Redux/Zustand → NgRx vs. Services

| React source | Angular target | Decision rule |
|---|---|---|
| `useState` | `signal()` | Always |
| Context API | Service + `signal()` | Always |
| Zustand / Jotai | Service + `signal()` | Start here — far less code |
| Redux (medium) | NgRx Component Store | If RxJS selectors or per-feature scoping needed |
| Redux + Saga (complex) | NgRx Store + Effects | Only mapping for complex async orchestration |
| TanStack Query | `rxResource()` (Angular 19+) | Built-in server state management |

**NgRx costs:** ~500 lines of boilerplate per feature (actions, reducer, effects, selectors). Use only when time-travel debugging, cross-feature event coordination, or Redux DevTools are genuinely required.

### RxJS: Top 5 Migration Pitfalls

**1. No subscription cleanup → memory leak**
```typescript
// WRONG: Memory leak
this.service.getData().subscribe(d => this.data = d);

// RIGHT: takeUntilDestroyed()
this.service.getData().pipe(takeUntilDestroyed()).subscribe(d => this.data = d);
// OR: toSignal() (auto-manages subscription)
this.data = toSignal(this.service.getData());
```

**2. `switchMap` where `concatMap` is needed**
`switchMap` cancels the previous inner observable — correct for search typeahead, dangerous for form saves (the second save cancels the first). Use `concatMap` to queue, `exhaustMap` to ignore until done.

**3. Nesting `.subscribe()` calls**
The Observable equivalent of callback hell. Use `switchMap`, `concatMap`, `mergeMap` to compose.

**4. HTTP call inside `effect()`**
Runs outside Angular's change detection scheduling. Use `rxResource()` or trigger from a service method instead.

**5. Object mutation with OnPush**
Mutating `this.user.name = 'Alice'` will NOT trigger re-render with `ChangeDetectionStrategy.OnPush`. Must replace the reference: `this.user = { ...this.user, name: 'Alice' }`.

### Angular Template Syntax: Key Differences from JSX

| React JSX | Angular template | Note |
|---|---|---|
| `onClick={fn}` | `(click)="fn()"` | Parentheses for events |
| `className="box"` | `class="box"` | Standard HTML attribute |
| `<p>{name}</p>` | `<p>{{ name }}</p>` | Double-curly interpolation |
| `{condition && <El />}` | `@if (condition) { <el /> }` | v17+ control flow |
| `{items.map(i => <li key={i.id}>{i.name}</li>)}` | `@for (i of items; track i.id) { <li>{{ i.name }}</li> }` | `track` required for performance |
| `prop={value}` | `[prop]="value"` | Square brackets for property binding |
| No brackets: `prop="value"` | No brackets: `prop="literal-string"` | Passes the STRING "value", not the variable |

**Common mistake:** `<p title="name">` passes the string "name". `<p [title]="name">` binds the variable. Forgetting brackets is a silent bug — no error, wrong value.

---

## 11. Full-Stack Migration Patterns

### Backend-First Rationale

Always migrate the backend before the frontend begins. Rationale:
1. API contracts (OpenAPI/Swagger) must be defined before Angular writes `HttpClient` calls
2. The new .NET API can serve both old React and new Angular simultaneously during transition
3. Authentication, CORS, and session decisions constrain the frontend
4. Backend endpoints can be validated with Postman before frontend code exists

**Recommended phasing:**
```
Backend slices B1–B4 complete → Integration contract finalised → Frontend slices begin
```

### JWT Token Compatibility in Hybrid Phase

During the hybrid phase (old frontend + new backend, or vice versa), both systems must accept the same tokens.

**Recommended: RS256 with JWKS endpoint**

RS256 uses asymmetric keys. The auth server signs with a private key; both old and new backends validate using the public key fetched from the JWKS endpoint:
```
https://{auth-domain}/.well-known/jwks.json
```

Benefits: neither backend needs the private key; the same token is valid for both simultaneously; key rotation is automatic via JWKS.

**Token claims mapping:**

| JWT claim | .NET `ClaimTypes` | Configuration required |
|---|---|---|
| `sub` | `ClaimTypes.NameIdentifier` | `NameClaimType = "sub"` in `TokenValidationParameters` |
| `roles` | `ClaimTypes.Role` | `RoleClaimType = "roles"` (must match your token's claim name) |
| `email` | `ClaimTypes.Email` | Auto-mapped |

⚠ Without `NameClaimType = "sub"` configured, `.User.Identity.Name` returns null — a silent authentication failure.

### CORS During Hybrid Phase

```csharp
services.AddCors(options => {
    options.AddPolicy("HybridMigration", policy => {
        policy.WithOrigins(
            "https://old-react-app.domain.com",    // remove when decommissioned
            "https://new-angular-app.domain.com"
        )
        .AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});
```

**NEVER use `AllowAnyOrigin()` with `AllowCredentials()` — the framework throws an exception.**
**NEVER use `AllowAnyOrigin()` in production.**

For local development: use the Angular CLI proxy (`proxy.conf.json`) to forward `/api` to `localhost:5001` — avoids CORS pre-flight requests entirely.

### Integration Contract Management

When running two independent migration tracks (BACKEND + FRONTEND), maintain a contract document capturing:
- All API endpoints: method, path, request schema, response schema, auth requirements
- Authentication scheme and JWT claims structure
- Standard error response shape
- Breaking change classification and history

**Breaking change classification:**

| Change | Classification | Impact |
|---|---|---|
| Added optional response field | Non-breaking | Auto-allow |
| Removed field | **BREAKING** | Pause frontend track |
| Renamed field | **BREAKING** | Pause frontend track |
| Changed field type | **BREAKING** | Pause frontend track |
| Added required request param | **BREAKING** | Pause frontend track |

### Top 6 Full-Stack Migration Failure Modes

1. **Strangler facade becomes permanent** — Accumulates business logic; set explicit sunset date
2. **New features continue going into old stack** — Policy: all new features → new stack from day 1
3. **API contract diverges mid-migration** — Track contract hash in checkpoint; gate on breaking changes
4. **Auth token incompatible on cutover** — Use RS256 + JWKS so both backends validate the same tokens
5. **CORS opened too wide for convenience** — `WithOrigins` always; `AllowAnyOrigin` never in production
6. **Frontend deployed before API is stable** — Backend-first; gate frontend slices on backend API layer completion

---

## 12. Testing Strategy by Stack

### Target Stack Test Frameworks

| Target stack | Unit tests | Mocking | Integration tests | Coverage | E2E |
|---|---|---|---|---|---|
| .NET Core | xUnit | NSubstitute | Testcontainers (.NET) | coverlet | Playwright |
| Java Spring Boot | JUnit 5 | Mockito | Testcontainers (Java) | JaCoCo | Playwright |
| Angular SPA | Jasmine/Jest | Angular TestBed / `@testing-library/angular` | `HttpClientTestingModule` | Istanbul/nyc | Playwright / Cypress |
| Node.js | Jest / Vitest | jest.fn() | Supertest | Istanbul/nyc | Playwright |

### Migration-Specific Testing Strategies

**Characterisation tests (before migrating anything)**
Write tests that document what the current code *does* (not what it *should* do). Run them against the original. Then run them against the migrated code. These are the primary regression safety net when migrating legacy code without tests.

**Parity tests (during Strangler Fig migrations)**
Run the same inputs through both the old .NET Framework app and the new ASP.NET Core app. Assert identical outputs. Retire parity tests when the legacy endpoint is decommissioned.

**EF6 / ORM migration tests**
Test every unique LINQ query shape against a real database (not the EF Core in-memory provider — it does not replicate SQL translation behaviour). Run on EF6 first to capture expected results; run on EF Core and diff.

**Risk-aligned coverage targets**

| Layer | Target | Stop-Phase-3 threshold |
|---|---|---|
| Domain / pure business logic | 95%+ | <90% |
| Application / use cases | 90%+ | <85% |
| Infrastructure / I/O-bound | 70%+ | <60% |
| Host / bootstrap / generated | Excluded | N/A |

### xUnit + NSubstitute Patterns (most common .NET target)

```csharp
// Setup
_repo = Substitute.For<IOrderRepository>();
_service = new OrderService(_repo);

// Configure return value
_repo.GetByIdAsync(1).Returns(new Order { Id = 1, Status = OrderStatus.Pending });

// Act
var result = await _service.CancelOrderAsync(1);

// Assert
await _repo.Received(1).SaveAsync(Arg.Is<Order>(o => o.Status == OrderStatus.Cancelled));
result.IsSuccess.Should().BeTrue();
```

### JUnit 5 + Mockito Patterns (Java target)

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository orderRepository;
    @InjectMocks OrderService orderService;

    @Test void cancel_order_marks_as_cancelled() {
        var order = new Order(1L, OrderStatus.PENDING);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));

        orderService.cancelOrder(1L);

        verify(orderRepository, times(1)).save(argThat(o -> o.getStatus() == CANCELLED));
    }
}
```

---

## 13. Performance Characteristics

### Benchmark Context (TechEmpower Round 23, Feb 2025 — archived March 2026)

| Framework | Fortunes relative score | Notes |
|---|---|---|
| ASP.NET Core (.NET 9) | 36.3× baseline | Top-tier |
| Java Spring Boot | 14.5× baseline | ~2.5× behind ASP.NET Core |
| Node.js Express | 4.7× baseline | |

**Caveats:** TechEmpower uses optimised, non-representative implementations. Real-world REST APIs with auth, DB, and business logic show much closer results. Performance gains from migrating Node.js → .NET are workload-dependent: I/O-bound apps near Node.js's ceiling see smaller gains; CPU-bound or mixed workloads see the largest.

**Published real-world cases:**
- One medium mixed I/O/CPU app: 90% throughput improvement after Node.js → .NET
- Raygun async queue handoff: 2,000% throughput increase (highly specific workload)
- Microsoft App Center: 40% improvement

### JVM Startup vs .NET Cold Start

| | .NET | Java Spring Boot |
|---|---|---|
| Traditional cold start | <100ms | 2–8 seconds |
| With AOT / native | Near-zero (Native AOT, .NET 7+) | Near-zero (GraalVM Native Image, Spring 3+) |
| Memory footprint | Lower base | Higher base JVM heap |
| Warmup (JIT) | Minimal | JVM warms up over first N requests |

Java 21 virtual threads (`spring.threads.virtual.enabled=true` in Spring Boot 3.2+) close the async model gap with .NET significantly — blocking-style code with non-blocking I/O, similar to .NET's `async/await` model.

### Connection Pool Mapping

| .NET | Java Spring Boot |
|---|---|
| `Max Pool Size` in connection string | HikariCP `maximumPoolSize` |
| `Min Pool Size` | HikariCP `minimumIdle` |
| `Connection Timeout` (seconds) | HikariCP `connectionTimeout` (milliseconds) |
| `Command Timeout` | HikariCP `queryTimeout` |

Mismatched pool settings between source and target cause under- or over-utilisation. Always align these during migration.

---

## 14. Source Citations

All research findings are based on verified sources from August 2026. Key sources consulted:

### .NET / ASP.NET Core
- [.NET Framework technologies unavailable on .NET 6+](https://learn.microsoft.com/en-us/dotnet/core/porting/net-framework-tech-unavailable)
- [Migrate from ASP.NET Framework to ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/migration/fx-to-core/)
- [Incremental ASP.NET to ASP.NET Core migration](https://learn.microsoft.com/en-us/aspnet/core/migration/inc/overview)
- [Breaking changes in .NET 8](https://learn.microsoft.com/en-us/dotnet/core/compatibility/8.0)
- [.NET Upgrade Assistant Overview](https://learn.microsoft.com/en-us/dotnet/core/porting/upgrade-assistant-overview)
- [Strangler Fig Pattern — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig)
- [Jimmy Bogard — Tales from the .NET Migration Trenches](https://www.jimmybogard.com/tales-from-the-net-migration-trenches/)

### EF6 / EF Core
- [Compare EF6 and EF Core](https://learn.microsoft.com/en-us/ef/efcore-and-ef6/)
- [Porting from EF6 to EF Core — Behavior Changes](https://learn.microsoft.com/en-us/ef/efcore-and-ef6/porting/port-behavior)
- [Breaking changes in EF Core 7.0](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-7.0/breaking-changes)
- [Breaking changes in EF Core 9.0](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-9.0/breaking-changes)
- [EF6 to EF Core: 5 query translations that quietly break in production](https://dev.to/agave_info_solutions/ef6-to-ef-core-5-query-translations-that-quietly-break-in-production-1ghm)

### WCF
- [Why migrate WCF to ASP.NET Core gRPC](https://learn.microsoft.com/en-us/aspnet/core/grpc/why-migrate-wcf-to-dotnet-grpc)
- [CoreWCF v1 Released](https://devblogs.microsoft.com/dotnet/corewcf-v1-released/)

### Clean Architecture
- [Clean Architecture in .NET — Milan Jovanovic](https://milanjovanovic.tech/blog/clean-architecture-dotnet)
- [Clean Architecture Anti-Patterns](https://milanjovanovic.tech/blog/clean-architecture-anti-patterns)
- [Clean Architecture with ASP.NET Core — ardalis](https://ardalis.com/clean-architecture-asp-net-core/)

### Java ↔ .NET
- [Spring Boot vs .NET Core: Complete Developer Migration Guide](https://dev.to/umesh_kushwaha_6655ba4c0d/spring-boot-vs-net-core-complete-developer-migration-guide-4mfk)
- [Spring Boot for C# and ASP.NET Core Developers](https://www.iamraghuveer.com/posts/spring-boot-for-csharp-developers/)
- [Spring Security — Moving from WebSecurityConfigurerAdapter to SecurityFilterChain](https://spring.io/blog/2022/02/21/spring-security-without-the-websecurityconfigureradapter/)
- [Aspect Oriented Programming with Spring](https://docs.spring.io/spring-framework/reference/core/aop.html)
- [Tangible Software Java to C# Converter](https://www.tangiblesoftwaresolutions.com/product-details/java-to-csharp-converter.html)
- [OpenRewrite Documentation](https://docs.openrewrite.org/)

### React / Angular
- [Angular for React Developers: Signals, RxJS, and Best Practices](https://billieheidelberg.com/blog/angular-for-react-developers)
- [Angular Signals in 2025: Replacing Heavy RxJS Patterns](https://prabhatgiri.com/blogs/angular-signals-in-2025-replacing-heavy-rxjs-patterns-the-right-way/)
- [Angular v21 Goes Zoneless by Default](https://push-based.io/article/angular-v21-goes-zoneless-by-default-what-changes-why-its-faster-and-how-to)
- [RFC: Setting OnPush as Default Change Detection — Angular GitHub](https://github.com/angular/angular/discussions/66779)

### Node.js → .NET
- [From Node.js to .NET Core 8: How We Boosted Performance](https://medium.com/@murataslan1/from-node-js-to-net-core-8-how-we-boosted-performance-9e26ee9fb602)
- [.NET Core or Node.js? — Raygun Blog](https://raygun.com/blog/dotnet-vs-nodejs/)
- [Moving from Node.js to .NET Core — Microsoft App Center](https://devblogs.microsoft.com/appcenter/moving-from-node-js-to-net-core/)

### Full-Stack Integration
- [RS256 vs HS256: JWT Signing Algorithms — WorkOS](https://workos.com/blog/rs256-vs-hs256-jwt-signing-algorithms)
- [Connecting Angular to .NET APIs: CORS and Authentication](https://medium.com/@mina.abdo/connecting-angular-to-net-apis-cors-and-authentication-b21ce6496ff9)
- [Strangler Fig with Micro Frontends](https://ijcesen.com/index.php/ijcesen/article/view/4965)

### Performance
- [TechEmpower Framework Benchmarks — Round 23](https://www.techempower.com/benchmarks/#section=data-r13)
- [Performance comparison of CRUD operations in Spring Boot and ASP.NET Core](https://ph.pollub.pl/index.php/jcsi/article/view/7198)
