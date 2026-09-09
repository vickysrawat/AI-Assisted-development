# Shared Reference: Clean Architecture for Migrations

_Loaded at Step 0.6 for all migrations — used to select and validate the target architecture structure._

---

## The One Non-Negotiable Rule

**Dependencies point inward only.**

- Domain has zero dependencies on Application, Infrastructure, or API.
- Application depends only on Domain.
- Infrastructure depends on Application and Domain (implements their interfaces).
- API/Host depends on everything (it is the entry point and composition root).

This is enforced at compile time via project references in .NET — you cannot import a class from a project that isn't referenced. Adding the wrong project reference is an immediate compiler error.

**This is the only structural requirement.** Everything else (MediatR, repositories, CQRS, AutoMapper) is optional and context-dependent.

---

## Proportionality Decision

### Simplified Structure
Use when: single bounded context, ≤ ~20 source files, ≤1 YELLOW finding, 0 RED findings.

```
{TARGET_PATH}/
├── {Name}/
│   ├── Domain/             ← entities, value objects, domain logic
│   ├── Services/           ← business operations (application-layer equivalent)
│   ├── Infrastructure/     ← data access, external services
│   └── {Name}.csproj
└── {Name}.Tests/
    └── {Name}.Tests.csproj
```

**When to upgrade from simplified to four-layer during migration:**
- ≥2 RED behavioral risk items → cleaner isolation of each RED item in its own layer
- Multiple bounded contexts surface during Phase 2 → split into separate projects

### Four-Layer Clean Architecture
Use when: multiple bounded contexts, >~20 source files, ≥2 RED findings, complex domain rules.

**.NET project structure:**
```
{TARGET_PATH}/
├── {Name}.Domain/          ← entities, value objects, domain events, domain service interfaces
│   └── {Name}.Domain.csproj   (no framework deps — just C#)
├── {Name}.Application/     ← use cases, IRepository interfaces, DTOs, application services
│   └── {Name}.Application.csproj  (depends on Domain only)
├── {Name}.Infrastructure/  ← DbContext, Dapper repos, external HTTP clients, EF migrations
│   └── {Name}.Infrastructure.csproj  (depends on Application + Domain)
├── {Name}.Api/             ← controllers, middleware, DI registration, Program.cs
│   └── {Name}.Api.csproj   (depends on all)
└── {Name}.Tests/
    └── {Name}.Tests.csproj  (depends on all for test setup)
```

**Java Spring Boot equivalent:**
```
{TARGET_PATH}/src/main/java/{base.package}/
├── domain/            ← @Entity classes, value objects, domain events
├── application/       ← @Service interfaces + implementations, use case classes
├── infrastructure/    ← @Repository implementations, JPA, external clients
└── api/               ← @RestController classes, request/response DTOs
src/test/java/{base.package}/
└── (mirrors main structure)
```

---

## Domain Layer Rules

- Zero framework dependencies — no `using Microsoft.EntityFrameworkCore`, no `import org.springframework`.
- Entities have behavior (methods that enforce invariants), not just getters/setters.
- Private setters on entity properties — state changes only via entity methods.
- Factory methods for complex construction — `Order.Create(customerId, items)` not `new Order { CustomerId = ..., Items = ... }`.
- Domain exceptions for invariant violations — `throw new InvalidOrderException("Order must have at least one item")`.

---

## Anti-Patterns to Reject During Code Generation

**Anemic Domain Model**
Entities as data bags (public getters/setters, no methods). All logic in Application services. This eliminates the primary value of having a Domain layer while keeping all its complexity.
Test: if every entity method is just `this.Property = value`, the domain is anemic.

**EF Core / Dapper leaking into Domain**
`IQueryable<T>` references, `DbSet<T>` types, `[Column]` data annotations on domain entities. Any of these break the dependency rule.

**Repository per Entity (not per Aggregate)**
An `Order` aggregate that owns `OrderLine` entities should have ONE `IOrderRepository`. Creating separate `IOrderLineRepository` breaks encapsulation — `OrderLine` is only accessible through `Order`.

**MediatR as default**
MediatR adds abstraction and indirection. It is valuable when you need: pipeline behaviors, notification dispatch, or decoupled command/query routing. It is NOT needed for a simple CRUD use case. A plain service class is cleaner.

**Static shared mutable state**
Singleton state shared across requests in a web application causes subtle race conditions. Use scoped DI services for request-scoped state.

**Logic in controllers**
Controllers are entry points — they parse HTTP, call Application services, return HTTP responses. Business logic in controllers is untestable without spinning up the full HTTP pipeline.

---

## Architecture Fitness Tests

### .NET — NetArchTest template
```csharp
[Category("Architecture")]
public class LayerDependencyTests
{
    [Fact]
    public void Domain_Should_Not_Reference_Application()
    {
        var result = Types.InAssembly(typeof(MyEntity).Assembly)
            .Should().NotHaveDependencyOn("MyApp.Application")
            .GetResult();
        Assert.True(result.IsSuccessful, string.Join("\n", result.FailingTypeNames ?? []));
    }

    [Fact]
    public void Domain_Should_Not_Reference_Infrastructure()
    {
        var result = Types.InAssembly(typeof(MyEntity).Assembly)
            .Should().NotHaveDependencyOn("MyApp.Infrastructure")
            .GetResult();
        Assert.True(result.IsSuccessful, string.Join("\n", result.FailingTypeNames ?? []));
    }

    [Fact]
    public void Application_Should_Not_Reference_Infrastructure()
    {
        var result = Types.InAssembly(typeof(IOrderRepository).Assembly)
            .Should().NotHaveDependencyOn("MyApp.Infrastructure")
            .GetResult();
        Assert.True(result.IsSuccessful, string.Join("\n", result.FailingTypeNames ?? []));
    }
}
```

### Java — ArchUnit template
```java
@AnalyzeClasses(packages = "com.example.myapp")
public class LayerDependencyTests {

    @ArchTest
    static final ArchRule domain_should_not_depend_on_application =
        noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAPackage("..application..");

    @ArchTest
    static final ArchRule domain_should_not_depend_on_infrastructure =
        noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAPackage("..infrastructure..");

    @ArchTest
    static final ArchRule application_should_not_depend_on_infrastructure =
        noClasses().that().resideInAPackage("..application..")
            .should().dependOnClassesThat().resideInAPackage("..infrastructure..");
}
```

---

## When to Deviate from Four-Layer

| Scenario | Deviation |
|---|---|
| Simple CRUD with no business rules | Skip Domain layer — use simplified structure |
| Read-heavy app with thin write paths | CQRS read side can bypass Application → Infrastructure directly (no domain needed for reads) |
| Microservice with single aggregate | Simplified structure is sufficient — four layers for one aggregate is over-engineering |
| Existing team unfamiliar with the pattern | Start simplified; introduce layers as complexity grows |
