# Stack Reference: .NET Core / .NET 5–10

_For migration skills — loaded when source or target stack token = `dotnet`_

---

## Core Patterns

**Dependency Injection**
- Registration in `Program.cs`: `builder.Services.AddScoped<IRepo, Repo>()`
- Default: constructor injection. Prefer over property injection for testability.
- `inject(ServiceClass)` (function-based) for modern .NET Minimal APIs.
- Never use service locator pattern (`IServiceProvider.GetService()` in business code).

**Configuration**
- `appsettings.json` + `appsettings.{Environment}.json` overlays.
- Always use strongly-typed `IOptions<T>` — never raw `IConfiguration["key"]` string lookups (case-sensitive on Linux, silent null if key missing).
- Environment selection: `ASPNETCORE_ENVIRONMENT` variable.

**Async / await**
- `async` all the way up the call stack. NEVER `.Result` or `.Wait()` — causes deadlocks under concurrent load on the thread pool.
- Use `ConfigureAwait(false)` in library/infrastructure code; omit in controller code.
- `IAsyncEnumerable<T>` for streaming results.

**Middleware Pipeline (ASP.NET Core)**
Ordering matters — violations cause silent auth/routing failures:
1. `UseExceptionHandler` / `UseHsts`
2. `UseHttpsRedirection`
3. `UseStaticFiles`
4. `UseRouting`
5. `UseCors` — must come AFTER `UseRouting`, BEFORE `UseAuthentication`
6. `UseAuthentication` → `UseAuthorization`
7. `MapControllers` / endpoint mapping

**Controllers vs Minimal APIs**
- Minimal APIs: `app.MapGet("/path", handler)` — lean, no controllers, ideal for small APIs.
- Controllers: `[ApiController]` + `[Route]` — better for larger surface areas, filters, OpenAPI.
- Never mix patterns in the same project without a clear boundary.

**Data Access**
- Dapper (if project rules mandate it): parameterised SQL only — `_db.QueryAsync<T>("SELECT ... WHERE Id = @Id", new { Id = id })`. NEVER string interpolation in SQL.
- EF Core: use explicit `.Include()` for navigation properties — lazy loading is opt-in and adds N+1 risk.
- Repository per aggregate root, not per entity.

**Logging**
- `ILogger<T>` injected via constructor. Never `Console.WriteLine` in production code.
- Structured logging: `_logger.LogInformation("Order {OrderId} created", orderId)` — NOT string interpolation.
- Use Serilog for sinks (file, Seq, Application Insights).

**Testing Stack**
- xUnit: `[Fact]` (single test), `[Theory]` + `[InlineData]` (parameterised).
- Mocking library: follow the deployed project rule (`csharp-dotnet-rules.md` → **Moq**) — that rule is authoritative, not this generic example.
- No `[SetUp]` attribute — xUnit uses the constructor for setup and `IDisposable.Dispose()` for teardown.
- Testcontainers (.NET) for real-DB integration tests.
- FluentAssertions: `result.Should().Be(expected)`.

---

## Anti-Patterns

Enforced anti-patterns + coding conventions for this stack live in `rules/csharp-dotnet-rules.md`
(authoritative — `## Anti-patterns` + `## Middleware pipeline order`). This reference adds only the
migration-specific context below.

---

## Common NuGet Packages (target stack)

| Purpose | Package |
|---|---|
| Structured logging | Serilog + Serilog.AspNetCore |
| Validation | FluentValidation + FluentValidation.AspNetCore |
| Background jobs | Hangfire or Quartz.NET |
| Real-time | Microsoft.AspNetCore.SignalR |
| Health checks | Microsoft.AspNetCore.Diagnostics.HealthChecks |
| OpenAPI | Swashbuckle.AspNetCore or Microsoft.AspNetCore.OpenApi (.NET 9+) |
| Test coverage | coverlet.collector |
| Architecture tests | NetArchTest.Rules |
| DB integration tests | Testcontainers |
| HTTP mocking | WireMock.Net |
| Date/time | NodaTime |

---

## Key Gotchas When Coming FROM Another Stack

- **`System.Text.Json` is case-sensitive by default** — coming from Jackson (case-insensitive) or JSON.parse (JavaScript) causes silent deserialization failures with null fields. Set `PropertyNameCaseInsensitive = true` or use `[JsonPropertyName]` attributes.
- **No Spring-style auto-configuration** — adding a NuGet package does NOT auto-wire anything. Every capability must be explicitly registered in `Program.cs`.
- **No `@Transactional` equivalent** — every write path must explicitly call `await _context.SaveChangesAsync()`. This is the #1 correctness bug in Java→.NET migrations.
- **No classpath scanning** — unlike Spring's `@Component` scan, .NET DI requires explicit registration.
