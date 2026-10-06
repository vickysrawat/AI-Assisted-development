# Parity Mapping: .NET Core / .NET 5–8 → .NET 10

_Loaded when source = `dotnet` (NET Core/5-8) and target = a modern .NET upgrade._

> **Scope — modern→modern only.** This file covers **net-core → net-core** version upgrades, where
> the breaking-change set is the cumulative removals over `(source, target]`. It does NOT apply to
> **.NET Framework → .NET** — that is a *re-platform* (System.Web→ASP.NET Core, Web.config→
> appsettings, WCF→CoreWCF/gRPC), covered by `dotnet-framework-to-dotnet.md`. For a **mixed** source
> (some Framework projects, some modern), apply this file per-cluster to the modern projects and the
> parity file to the Framework projects (posture is per-project — see the migration feasibility step).

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

## Pre-hop blockers — check BEFORE running the tool

These items block a safe upgrade and must be resolved before running `dotnet upgrade-assistant`.

### HintPath DLL compatibility

If any `.csproj` contains `<Reference><HintPath>` entries pointing to pre-compiled DLLs, verify
each DLL's CLR version before upgrading:

```powershell
[System.Reflection.Assembly]::LoadFile("path\to\Assembly.dll").ImageRuntimeVersion
# v4.0.30319 = .NET Framework 4.x — must be eliminated before hop 1
# v4.0.30319 with target .NET Standard = may be OK, but verify the API surface
```

The .NET 8 framework compatibility shim loads .NET Fx 4.x binaries silently. .NET 9/10 narrows
the compat surface and these binaries will cause runtime failures. Fix: identify which types are
actually used, inline them into a shared project or NuGet, and remove all `<Reference><HintPath>`
entries from the `.csproj`.

### ASP.NET Core types in non-Web class libraries

A `Microsoft.NET.Sdk` (non-Web) class library that uses `IHttpContextAccessor`, `HttpContext`, or
`RequestDelegate` must NOT pin `Microsoft.AspNetCore.Http.Abstractions` via a versioned
`PackageReference` — the explicit version pin becomes incompatible with each new .NET target
(e.g. `2.2.0` fails on .NET 9+).

```xml
<!-- Remove -->
<PackageReference Include="Microsoft.AspNetCore.Http.Abstractions" Version="2.2.0" />
<!-- Add -->
<FrameworkReference Include="Microsoft.AspNetCore.App" />
```

No `.cs` changes required — using directives remain valid. The `FrameworkReference` resolves to
the correct SDK version automatically and never needs an explicit version pin.

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
| `Microsoft.EntityFrameworkCore.*` | EF Core's target framework is a **minimum, not a match** — pick an EF Core major whose min-TFM ≤ your target TFM (and ≥ your current). EF Core major need **not** equal the .NET major — e.g. **EF Core 9 runs on net8**. Support-matrix: **EF Core 8 → net8.0 (LTS)** · **EF Core 9 → net8.0 (STS)** · **EF Core 10 → net10.0 (LTS)**. Check breaking changes per major crossed — see `shared/ef6-to-efcore.md`. |
| `Swashbuckle.AspNetCore` | **v6 → v10 is a code change, not just a version bump** — budget 30–60 min for any project with custom Swagger configuration. `Microsoft.OpenApi` 2.x introduced 5 specific breaking changes: (1) **Namespace collapsed** — `using Microsoft.OpenApi.Models` → `using Microsoft.OpenApi`; (2) **Security scheme reference** — `new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }` → `new OpenApiSecuritySchemeReference("Bearer")`; (3) **AddSecurityRequirement signature** — `c.AddSecurityRequirement(requirement)` → `c.AddSecurityRequirement(_ => requirement)`; (4) **Parameter collection interface** — `new List<OpenApiParameter>()` → `new List<IOpenApiParameter>()`; (5) **Schema type enum** — `Schema = new OpenApiSchema { Type = "string" }` → `Schema = new OpenApiSchema { Type = JsonSchemaType.String }`. Also: `Scheme = "Bearer"` (capital B) in `AddSecurityDefinition` causes Swagger UI to drop the Authorization header — change to `Scheme = "bearer"` (lowercase). Alternatively, migrate to `Microsoft.AspNetCore.OpenApi` (.NET 9+). See [Swashbuckle v10 migration guide](https://github.com/domaindrivendev/Swashbuckle.AspNetCore/blob/master/docs/migrating-to-v10.md). |
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

### NU1605 — Stale explicit version pins

After each hop, run `dotnet restore` (not `--no-restore`) and check for `NU1605` errors.
These occur when upgrade-assistant bumps a Microsoft.* package and its transitive graph now
requires a higher version than an **explicit pin** you have in a `.csproj`.

**Fix:** Remove the explicit `<PackageReference>` entry — NuGet resolves it transitively at the
correct version. Only re-add an explicit pin if you need a version *higher* than the transitive
graph provides.

```xml
<!-- Remove the stale pin — let NuGet resolve transitively -->
<PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="8.0.2" />  <!-- REMOVE -->
```

Common stale-pin families: `System.IdentityModel.Tokens.Jwt`, `Serilog.Settings.Configuration`
(when you upgrade `Serilog.AspNetCore` without bumping sibling packages), any `Microsoft.Extensions.*`
version locked before the upgrade.

### upgrade-assistant WCF package mapping — client vs server

`dotnet upgrade-assistant` may incorrectly map `System.ServiceModel.*` packages to `CoreWCF.*`.
These serve **opposite roles**:

- `System.ServiceModel.*` (dotnet/wcf) = WCF **client** — calls a WCF service hosted elsewhere
- `CoreWCF.*` = WCF **server** — hosts a WCF service endpoint inside your process

Before accepting any WCF package changes from upgrade-assistant, verify the project's role.
Also check whether the packages are actually used — dead package references from earlier
development are common:

```bash
grep -r "using System.ServiceModel" src/ProjectName/
grep -r "using CoreWCF" src/ProjectName/
# If no results — the packages are dead weight; remove them entirely
```

After every major upgrade, audit each project's packages against actual `using` imports.
A project with only in-box SDK types (e.g. `System.Security.Cryptography`, `System.Text`)
should have zero `<PackageReference>` entries.

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

---

---

## Post-hop audit checklist

Run after EACH `dotnet upgrade-assistant` hop before committing:

```
[ ] dotnet restore (not --no-restore) → check for NU1605 errors (stale explicit pins)
[ ] dotnet build --no-restore → surfaces CS compile errors cleanly without NU noise
[ ] dotnet build (with restore) → surfaces NU1605 / feed auth issues
[ ] Review every package upgrade-assistant ADDED — verify it serves the correct role
      (CoreWCF = WCF server; System.ServiceModel.* = WCF client — do not accept a swap)
[ ] Review every package upgrade-assistant REPLACED — verify the replacement is correct family
[ ] Manually review community packages (not auto-upgraded):
      [ ] Serilog + Serilog.AspNetCore + Serilog.Settings.Configuration + Serilog.Sinks.*
            (bump all together — they version as a family; stale sibling causes NU1605)
      [ ] AspNetCore.HealthChecks.* — bump to compatible major version
      [ ] Swashbuckle.AspNetCore — check major version migration guide (code changes required)
      [ ] MediatR — verify .NET target-version compat
      [ ] Dapper — typically version-agnostic; verify latest
      [ ] Microsoft.Data.SqlClient — must be 7.0+ for .NET 10 (manual — not tool-handled)
[ ] Projects using only in-box SDK types should have zero PackageReferences after cleanup
[ ] HintPath <Reference> DLLs — verify CLR version (see Pre-hop blockers section above)
```

---

## behavioral_changes

Patterns for **Pass 3** codebase scan — grep each; flag files where found.

| Pattern | Changed In | Description | Required Action |
|---|---|---|---|
| `BinaryFormatter` | .NET 8 | Removed entirely at runtime | Replace with `System.Text.Json`, Protobuf, or MessagePack |
| `Encoding.Default` | .NET 9 (non-Windows) | Changed to UTF-8 on non-Windows | Specify `Encoding.UTF8` explicitly; do not rely on `Encoding.Default` |
| `DateTime.Now` | .NET 8+ intent | Not removed; `TimeProvider` now preferred | Consider migrating to `TimeProvider` for deterministic testing |
| `UseExceptionHandler(app =>` | .NET 8 | Callback-style works but `IExceptionHandler` is the new pattern | Optional: migrate to `IExceptionHandler` registration |
| `IRequest<` | MediatR v12 | `IRequest`/`IRequestHandler` interface contract changed in v12 | Follow MediatR v12 migration guide before bumping package |
| `AbstractValidator` | FluentValidation v11 | Sync `.Validate()` removed from `AbstractValidator` | Replace sync `Validate()` calls with `ValidateAsync()` |
| `CascadeTiming` | EF Core 7 | Cascade delete default timing changed | Review EF Core 7 cascade delete behavior; add explicit config if needed |
| `BlobContainerClient` | Azure SDK v12 restructure | Azure Blob SDK namespace moved in some versions | Check `Azure.Storage.Blobs` changelog for target version |
| `Microsoft.Data.SqlClient` | v5.x → 7.0+ for .NET 10 | v5.x does not support .NET 10; `dotnet upgrade-assistant` does NOT upgrade this automatically | Manually upgrade the DAL project to `Microsoft.Data.SqlClient` 7.0+ before completing hop 2 |
| `AspNetCore.HealthChecks.UI` | HealthChecks.UI 9.x / EF Core 10 | HealthChecks.UI 9.x references EF Core 9; .NET 10 loads EF Core 10, causing `MissingMethodException` at startup | Monitor [Xabaril/AspNetCore.Diagnostics.HealthChecks](https://github.com/Xabaril/AspNetCore.Diagnostics.HealthChecks) for a 10.x-compatible release; use the JSON `/health` endpoint as fallback if UI fails to initialize |
| Community packages — Serilog.*, Xabaril HealthChecks.*, MediatR, Dapper, Swashbuckle | All versions | **upgrade-assistant only auto-upgrades `Microsoft.*` packages.** All community packages are left at their pre-upgrade versions. After each hop, manually bump: `Serilog` + `Serilog.AspNetCore` + `Serilog.Settings.Configuration` + `Serilog.Sinks.*` (match major to .NET major — they ship as a coordinated family, stale sibling pins cause NU1605); `AspNetCore.HealthChecks.*`; `Swashbuckle.AspNetCore` (see above); `MediatR`; `Dapper`. **Note:** `Serilog` 4.x ships a `buildTransitive` MSBuild targets file that injects `global using Serilog;` into all consuming projects transitively — removing Serilog from the package graph silently breaks compilation with no obvious error message. | Manual post-hop review required for every community package family |
| `OpenApiDocument` / `OpenApiSchema` / `OpenApiSecurityScheme` | Swashbuckle v7+ / OpenAPI.NET v2 | 5 breaking changes in `Microsoft.OpenApi` 2.x — namespace collapsed, security scheme reference type changed, `AddSecurityRequirement` uses Func signature, parameter collection uses `IOpenApiParameter` interface, schema type is `JsonSchemaType` enum not string. See Swashbuckle row in Package compatibility above for all 5 patterns. | Replace all 5 patterns in every file that imports `Microsoft.OpenApi.Models` |
| `IConfiguration["SectionName"]` used as `Bind()` argument | .NET 10 / Microsoft.Identity.Web 3.x | `IConfiguration["key"]` returns `null` for section nodes (not leaf values); passing it to `Bind(null ?? "")` binds the **root** of configuration, silently skipping all section values. Hidden on older runtimes where env vars flatten to root. | Always use `configuration.GetSection("SectionName").Bind(options)` — never use `["key"]` as a section name argument to `Bind()` |
| `Scheme = "Bearer"` in Swagger `AddSecurityDefinition` | Swashbuckle 10.x | Swagger UI silently drops the Authorization header when `Scheme` is `"Bearer"` (capital B) — must be lowercase `"bearer"` | Change to `Scheme = "bearer"` in every `AddSecurityDefinition` call that configures Bearer auth |
