# Parity Mapping: .NET Core / .NET 5–8 → .NET 10

_Loaded when source = `dotnet` (NET Core/5-8) and target = .NET 10 upgrade._

---

## Overview

This is an in-place version upgrade, not a technology migration. The app model (MVC, Web API, Minimal API, Worker) stays the same. The primary work is:
1. Update `<TargetFramework>` in `.csproj` files
2. Update NuGet package versions
3. Fix breaking API changes introduced between the source and target version
4. Enable new capabilities (nullable reference types, Minimal API improvements, etc.)

**The gap is much smaller than .NET Framework → .NET 10.** Most apps migrate cleanly with package updates and a handful of targeted fixes.

---

## Step 1 — Identify Source Version

Before populating the feasibility doc, determine the exact source version:
```bash
grep -r "TargetFramework" . --include="*.csproj" | head -10
# Look for: net5.0, net6.0, net7.0, net8.0, net9.0
```

The further back the source version, the more breaking changes accumulate. Each version section below is **additive** — migrating from .NET 6 to .NET 10 means applying .NET 7 + .NET 8 + .NET 9 + .NET 10 changes.

---

## GREEN — Migrates Cleanly (all versions)

| Component | Notes |
|---|---|
| ASP.NET Core controllers + routing | No changes to `[ApiController]`, `[Route]`, `[HttpGet]` etc. |
| Dependency injection (`IServiceCollection`) | No changes |
| `IOptions<T>` configuration | No changes |
| `async`/`await` + Task | No changes |
| `ILogger<T>` / Serilog | No changes to interface; Serilog sinks may need package version bump |
| xUnit tests | No changes to test authoring |
| `IHostedService` / `BackgroundService` | No changes |
| Entity Framework Core | See YELLOW — minor version-specific behavioral changes |
| Minimal API route handlers | Additive improvements; existing syntax still valid |
| Middleware pipeline | No ordering changes |
| `HttpClient` / `IHttpClientFactory` | No changes |

---

## YELLOW — Needs Rework (version-specific)

### Migrating FROM .NET 5 or 6

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `WebApplication.CreateBuilder()` style | Introduced in .NET 6. If source uses `.NET 5` startup pattern (`Startup.cs` + `CreateHostBuilder`), consolidate into `Program.cs` single-file pattern. Both work in .NET 10 but the old pattern is discouraged. | S | LOW |
| Nullable reference types | Enabled by default from .NET 6 onwards. Source code with null-unsafe patterns generates compiler warnings → turn into errors if `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` is set. | M | LOW (warnings not runtime failures) |
| `System.Text.Json` source generators | Available from .NET 6. Not required, but improves performance for high-throughput APIs. | S | LOW |
| Minimal APIs | Introduced in .NET 6. No migration needed if not using them; voluntary adoption in target. | S | LOW |
| gRPC improvements | .NET 6 added gRPC-Web + HTTP/3 support. If source uses gRPC, update client/server config. | S | LOW |

### Migrating FROM .NET 7

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Rate limiting middleware | `RateLimiter` middleware introduced in .NET 7. If source uses a third-party rate limiter (e.g., `AspNetCoreRateLimit`), consider switching to the built-in. | S | LOW |
| Output caching | New built-in `IOutputCacheStore`. If source uses response caching, the API is similar but not identical. | S | LOW |
| `IExceptionHandler` (new) | Introduced .NET 8 — replaces `UseExceptionHandler` callback. No breaking change; optional adoption. | S | LOW |
| Route groups (Minimal API) | `MapGroup()` introduced .NET 7. Adopt in target for cleaner Minimal API organization. | S | LOW |

### Migrating FROM .NET 8

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Keyed services (`AddKeyedScoped`) | Introduced .NET 8. No migration needed; may simplify existing factory patterns. | S | LOW |
| `TimeProvider` abstraction | .NET 8 introduced `TimeProvider` for testable time. If source uses `DateTime.Now` or `DateTimeOffset.Now` directly, consider migrating to `TimeProvider` for better testability. | S | LOW |
| Blazor SSR / streaming rendering | .NET 8 Blazor rendering modes. If source uses Blazor, review rendering mode config. | M | MEDIUM |
| `IProblemDetailsService` | .NET 8 improved ProblemDetails. If source returns `ProblemDetails` manually, align to the new service. | S | LOW |

### Migrating FROM .NET 9

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| OpenAPI built-in (`Microsoft.AspNetCore.OpenApi`) | .NET 9 ships a first-party OpenAPI package that can replace Swashbuckle. Migration is optional — Swashbuckle still works. | S | LOW |
| `HybridCache` | New distributed+in-memory cache combining `IMemoryCache` and `IDistributedCache`. Optional upgrade from existing caching setup. | S | LOW |
| LINQ `CountBy()` / `AggregateBy()` | New methods in .NET 9. No migration needed; adoption is voluntary. | S | LOW |

---

## RED — Will Break

### Package compatibility (check ALL packages)

This is the most common source of breakage in version upgrades. Every NuGet package has a minimum supported target framework. A package that targets `net6.0` will work on .NET 10, but a package targeting `netstandard2.0` without `.NET 8+` support may have issues.

**Audit command:**
```bash
cd "{SOURCE_PATH}"
dotnet list package --outdated
dotnet list package --vulnerable   # also check for security vulnerabilities
```

Packages most commonly needing major version bumps:
| Package | Common upgrade notes |
|---|---|
| `Microsoft.EntityFrameworkCore.*` | Major version must match .NET version (EF Core 8 for .NET 8, EF Core 9 for .NET 9+). Check breaking changes per version — see `shared/ef6-to-efcore.md` for EF Core behavioral differences. |
| `Swashbuckle.AspNetCore` | v6 → v7 has breaking config changes. Alternatively migrate to `Microsoft.AspNetCore.OpenApi` (.NET 9+). |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | Package version must match SDK version. |
| `Serilog.AspNetCore` | Generally backward-compatible; check changelog. |
| `AutoMapper` | v12+ has breaking changes from v10/11. |
| `MediatR` | v12 (for .NET 8+) has `IRequest`/`IRequestHandler` changes. |
| `FluentValidation` | v11+ has breaking changes from v10 (removed sync methods). |

### Removed APIs (version-specific)

**.NET 7 removals:**
- `IAsyncDisposable` sync wrappers in some HTTP types — use `await using`.

**.NET 8 removals:**
- `BinaryFormatter` serialization — completely removed. Any `BinaryFormatter.Serialize`/`Deserialize` calls throw at runtime. Replace with `System.Text.Json`, Protobuf, or MessagePack.
- Some obsolete HTTP client patterns.

**.NET 9 removals:**
- `System.Runtime.CompilerServices.RuntimeHelpers.IsReferenceOrContainsReferences` behavior changes.
- `Encoding.Default` changes on non-Windows platforms.

**.NET 10 removals:**
- Review [learn.microsoft.com — Breaking changes in .NET 10](https://learn.microsoft.com/en-us/dotnet/core/compatibility/10.0) before migrating.

### EF Core version-specific breaking changes

If the app uses EF Core, check the breaking changes for each version crossed:
- [EF Core 7.0 breaking changes](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-7.0/breaking-changes) — cascade delete behavior changed
- [EF Core 8.0 breaking changes](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-8.0/breaking-changes) — complex type mapping
- [EF Core 9.0 breaking changes](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-9.0/breaking-changes) — pending model changes now throw

---

## Migration Procedure

### Step 1 — Update target framework in each .csproj
```xml
<!-- Before -->
<TargetFramework>net6.0</TargetFramework>

<!-- After -->
<TargetFramework>net10.0</TargetFramework>
```

### Step 2 — Update all Microsoft.* NuGet packages
```bash
# In TARGET_PATH (copied from source)
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer --version 10.*
dotnet add package Microsoft.EntityFrameworkCore.SqlServer --version 10.*
# Repeat for all Microsoft.* packages
```

### Step 3 — Build and fix compilation errors
```bash
cd "{TARGET_PATH}" && dotnet build 2>&1
```
Fix each error. Common patterns:
- Removed API → find the replacement in the breaking changes docs
- Ambiguous overload → specify explicitly
- Nullable warning-as-error → add null check or `!` suppressor with justification

### Step 4 — Run all tests
```bash
cd "{TARGET_PATH}" && dotnet test
```
Fix any behavioral regressions — these indicate a silent breaking change.

### Step 5 — Enable new features (optional, Phase 4 recommendations)
- Enable `<Nullable>enable</Nullable>` if not already set (raises code quality)
- Consider `<ImplicitUsings>enable</ImplicitUsings>` to reduce boilerplate
- Consider `Microsoft.AspNetCore.OpenApi` if replacing Swashbuckle

---

## Recommended Slice Plan for Version Upgrade

Unlike major migrations, this can be done in fewer, larger slices:

| Slice | Name | Content |
|---|---|---|
| U1 | Framework + core packages | Update TFM, Microsoft.* packages, build fixes |
| U2 | Third-party packages | Update third-party NuGets, fix breaking API changes |
| U3 | Behavioral regressions | Fix any test failures from EF Core / ASP.NET changes |
| U4 | New feature adoption | Optional: Nullable, OpenAPI, TimeProvider, etc. |
