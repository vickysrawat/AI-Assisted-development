---
paths: ["**/*.cs", "**/Controllers/**", "**/Services/**", "**/Repositories/**"]
detect:
  files: ["**/*.csproj", "**/*.sln"]
  excludeIfFiles: ["**/net4*.csproj"]
  excludeIfDependencies: ["System.Web"]
---

# C# / .NET Rules — Applied to .NET 6+ / .NET Core projects

Modern .NET (6, 7, 8, 9+). For legacy ASP.NET Framework 4.8 see `csharp-framework48-rules.md`.

## Architecture
- Thin controllers/endpoints: bind + validate → call service → map response — no business logic in the handler
- Service layer owns all business logic — stateless, framework-agnostic, independently testable
- Repository layer owns all data access — see `data-access-rules.md`; Dapper with parameterised SQL is the default

## Minimal API vs Controller Pattern
- Minimal API (`app.MapGet(...)`) for new microservices and simple endpoints — less ceremony
- Controller pattern (`[ApiController]`) for complex APIs with many shared filters, model binding, or when the team is already using it consistently
- Never mix both in the same service — pick one and be consistent

## Modern C# Features
- `record` types for DTOs and value objects — immutable by default, structural equality built-in
- Nullable reference types enabled (`<Nullable>enable</Nullable>`) — treat all nullable warnings as errors
- Pattern matching over `if`/`else` chains for type-checking and conditional logic
- `required` modifier on DTO properties — enforced at compile time, no runtime null checks needed
- `file`-scoped namespaces — one per file, no nesting

## Dependency Injection
- Constructor injection only — no property injection, no `IServiceLocator`
- Register services in `Program.cs` — no scattered `ServiceLocator.GetService<T>()` calls in business code
- Lifetimes: `AddSingleton` for stateless services, `AddScoped` for per-request (DB contexts, current user), `AddTransient` for lightweight factories

## Async / Await
- `async Task` throughout — no `.Result` or `.Wait()` (deadlock risk in sync-over-async contexts)
- `ConfigureAwait(false)` in library code — not required in ASP.NET Core application code (no sync context)
- `CancellationToken` threaded through from the controller action to all I/O calls
- `IAsyncEnumerable<T>` for streaming large result sets — not `List<T>` for everything

## Response Standards
- Success: typed DTO with `Results.Ok(dto)` or `TypedResults.Ok(dto)` — never raw `object`
- Validation error: 400 via FluentValidation + `ProblemDetails`
- Not found: `Results.NotFound(new ProblemDetails { Detail = "..." })`
- Unauthorized: 401 (missing/invalid auth) or 403 (insufficient permission) — never 404 to hide existence
- Server error: 500 `ProblemDetails` — log full exception, return sanitized message only

## Auth Pattern
- Policies on endpoints/controllers: `[Authorize(Policy = "FilterAdmin")]` — not role strings
- Identity resolved from `ICurrentUserService` wrapping `IHttpContextAccessor` — never read `HttpContext` directly in services
- Never trust client-provided user IDs — resolve from verified token claims

## Logging (Serilog)
- `ILogger<T>` injected via DI — never `Log.Logger.Information(...)` (static logger in app code)
- Structured log properties: `log.Information("User {UserId} updated filter {FilterId}", userId, filterId)`
- Never log PII — log identifiers (userId, filterId) not values (email, name)
- Minimum level `Information` in production; `Debug` in development

## Testing (xUnit + Moq)
- xUnit test classes — no `[TestClass]`/`[TestMethod]` (MSTest)
- `Moq` for dependencies — `Mock<IUserRepository>`, set up with `Setup().Returns()`
- Arrange / Act / Assert with blank lines between sections
- Test method: `MethodName_WhenCondition_ThenExpectedBehavior`
- Always test: happy path, validation error, not-found, and permission boundary from ICEA

## See also
- `backend-base-rules.md` — universal backend guardrails
- `rest-api-rules.md` — HTTP design conventions
- `auth-rules.md` — AuthN/AuthZ patterns
- `api-security-rules.md` — OWASP and attack surface
- `data-access-rules.md` — repository and connection patterns
- `observability-rules.md` — structured logging principles

## Out of bounds
- No `.Result` or `.Wait()` on async code
- No `HttpContext` access outside controllers and thin infrastructure
- No business logic in controllers or repositories
- No secrets in `appsettings.json` committed to the repo
- No `any` equivalent — no `dynamic` or `object` types without a typed wrapper
