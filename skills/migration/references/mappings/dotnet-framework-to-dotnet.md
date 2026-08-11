# Parity Mapping: .NET Framework 4.x → .NET 10

_Loaded when source = `dotnet_framework` and target = .NET 10._
_Also read `stacks/dotnet-framework.md` for source stack context._
_Also read `shared/ef6-to-efcore.md` if EF6/.edmx detected._

---

## Overview

This is a major platform migration — not a version upgrade. The runtime, hosting model, HTTP pipeline, authentication, configuration, and data access layers all change fundamentally. Many .NET Framework technologies are removed entirely in .NET 8+ with no automatic migration path (WebForms, WCF server, .NET Remoting, BinaryFormatter).

**Strangler Fig approach is strongly recommended for large apps.** See Strangler Fig section below.

---

## GREEN — Migrates Cleanly

| .NET Framework | .NET 10 target | Confidence |
|---|---|---|
| C# language features (generics, LINQ, lambdas) | Same or improved in C# 12/13 | Verified |
| BCL types (collections, string, math, etc.) | Same namespace; same API | Verified |
| Constructor-based DI (if already used) | Microsoft.Extensions.DependencyInjection | Verified |
| `System.Net.Http.HttpClient` | Same API | Verified |
| `Task`/`async`/`await` | Same semantics | Verified |
| MSTest / NUnit unit tests | Run on .NET 10 (multi-targeted) | Verified |
| Class libraries targeting `netstandard2.0` | Fully compatible with .NET 10 | Verified |
| `System.Text.Json` (if already used) | Same package | Verified |
| Azure SDKs | All support .NET 10 | Verified |
| SQL Server client (`Microsoft.Data.SqlClient`) | Supported on .NET 10 | Verified |

---

## YELLOW — Needs Rework

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `web.config` → `appsettings.json` | Basic `<appSettings>` and `<connectionStrings>` map directly. Custom config sections require manual `IOptions<T>` binding. Environment-specific transforms (`web.Debug.config`) → `appsettings.Development.json`. | M | LOW |
| `ConfigurationManager` | Replace with `IConfiguration` + `IOptions<T>` throughout. `ConfigurationManager.AppSettings["key"]` → `_config["key"]` or typed options binding. | M | LOW |
| Authentication (Forms Auth / OWIN) | ASP.NET Core Identity + cookie middleware. Cookie encryption uses Data Protection (different keys). During Strangler Fig phase, must share Data Protection key ring and configure common cookie domain. | L | HIGH |
| Session state | ASP.NET Core session backed by `IDistributedCache`. API is async — no sync session reads. No cookieless session mode in ASP.NET Core. | M | MEDIUM |
| HTTP Modules → Middleware | HTTP Modules (`IHttpModule`) and `Global.asax` event handlers must be rewritten as ASP.NET Core middleware. Cannot be automated — requires manual rewrite of each module. | M | MEDIUM |
| `HttpContext.Current` (static) | Does NOT exist in ASP.NET Core. Inject `IHttpContextAccessor` as a bridge; then remove HTTP context from non-web layers entirely. | M | HIGH |
| ASP.NET MVC 5 controllers | ASP.NET Core MVC controllers have the same conceptual model. `[HttpGet]`, `[HttpPost]`, `[Authorize]` work the same. Main differences: no `ActionResult` sync variants needed; use `IActionResult` and `async Task<IActionResult>`. | M | LOW |
| Web API 2 controllers | Near 1:1 with ASP.NET Core Web API. `ApiController` → `[ApiController]`; routing syntax similar. `OData` queries need `Microsoft.AspNetCore.OData` package. | S | LOW |
| EF6 → EF Core | See `shared/ef6-to-efcore.md` for the full 9-item silent-bug table and migration procedure. This is the highest-risk component in most .NET Framework migrations. | L | HIGH |
| Bundling / minification (`BundleConfig.cs`) | No built-in equivalent. Use webpack, Vite, or `libman` for frontend assets. If frontend is Angular/React, this becomes the frontend track. | M | LOW |
| SignalR (old ASP.NET SignalR) | ASP.NET Core SignalR has a different JavaScript client package (`@microsoft/signalr`). Server API is similar but JS client must be updated. | M | MEDIUM |
| Windsor / Unity / Autofac DI container | Replace with `Microsoft.Extensions.DependencyInjection` for standard apps. Autofac has an ASP.NET Core integration package if complex container features are needed. | M | LOW |
| `Thread.Sleep` / synchronous blocking in web handlers | Rewrite as `await Task.Delay` and ensure all I/O operations use async APIs. | M | MEDIUM |

---

## RED — Will Break

### WebForms (.aspx + codebehind) — NO upgrade path
- What breaks: WebForms has NO migration path to .NET 8+. There is no tooling. The Upgrade Assistant explicitly excludes WebForms.
- Options:
  - (A) **Razor Pages** — page-centric server-rendering, closest structural equivalent. Each `.aspx` page becomes a Razor Page. `Page_Load` → `OnGet`/`OnPost` handlers. ViewState → either form binding or `TempData`.
  - (B) **ASP.NET Core MVC** — controller + view model + Razor view. More flexible for complex page hierarchies.
  - (C) **Blazor Server** — component-based server-side rendering. Closest mental model to WebForms (server-side event handling). A rewrite, not a port.
  - (D) **Angular/React SPA** — full frontend rewrite (activates two-track migration mode).
- Recommendation: Razor Pages for simple form-based apps; Angular/React SPA for rich interactive UI.
- Behavioral risk: HIGH — every `.aspx` page is a manual rewrite. Budget 0.5–2 days per page.

### WCF Server — Removed
- See WCF decision matrix in `stacks/dotnet-framework.md` for CoreWCF/gRPC/REST options.
- Behavioral risk: HIGH for non-CoreWCF paths (contract compatibility lost).

### `BinaryFormatter` — Removed in .NET 8+
- Throws `NotSupportedException` at runtime.
- Fix: Replace all `BinaryFormatter.Serialize`/`Deserialize` with `System.Text.Json`, Protobuf, or MessagePack. If binary-serialized data is persisted in a DB or files, a data migration is also required.
- Behavioral risk: BLOCKER if persisted binary data exists.

### `AppDomain` isolation
- `AppDomain.CreateDomain()` throws `PlatformNotSupportedException`.
- Fix: Use separate processes or `AssemblyLoadContext` for dynamic assembly loading.
- Behavioral risk: HIGH.

### `Delegate.BeginInvoke` / `EndInvoke`
- Throws `PlatformNotSupportedException`.
- Fix: Rewrite as `Task.Run` + `await`.
- Behavioral risk: HIGH — compile-time silent, runtime throw.

### .NET Remoting
- Completely removed. No compatibility layer.
- Fix: Replace with gRPC, SignalR, or REST.
- Behavioral risk: BLOCKER for apps depending on remoting.

### `System.Web` namespace (general)
- `System.Web.HttpContext`, `System.Web.SessionState`, `System.Web.Security.*` etc. — all removed.
- The `Microsoft.AspNetCore.SystemWebAdapters` package provides bridge types for incremental migration only — NOT a permanent solution.
- Fix: Each type must be replaced with its ASP.NET Core equivalent.
- Behavioral risk: HIGH.

---

## Dependency Ledger Notes

**Packages that need special attention:**

| Framework package | .NET 10 status |
|---|---|
| `Microsoft.AspNet.Mvc` | Replaced by `Microsoft.AspNetCore.Mvc` (different package) |
| `Microsoft.AspNet.WebApi.*` | Replaced by ASP.NET Core Web API (built-in) |
| `EntityFramework` (EF6) | EF Core (`Microsoft.EntityFrameworkCore.*`) — see ef6-to-efcore.md |
| `Owin` / `Microsoft.Owin.*` | Removed — ASP.NET Core has no OWIN layer |
| `System.IdentityModel.*` (old) | `Microsoft.IdentityModel.*` + `System.IdentityModel.Tokens.Jwt` |
| `Newtonsoft.Json` | Still supported on .NET 10; or migrate to `System.Text.Json` |
| `AutoMapper` | v12+ supports .NET 10 (check for API changes from v10/11) |
| Old Azure SDK packages | Replaced by `Azure.*` SDK family (e.g., `Azure.Storage.Blobs`) |

---

## Strangler Fig + YARP (Recommended for >50 Endpoints)

For large .NET Framework applications, migrate incrementally rather than all at once:

1. **Create the new ASP.NET Core project** in `TARGET_PATH`. Add `Yarp.ReverseProxy` NuGet.
2. **Configure YARP** to proxy ALL traffic to the legacy .NET Framework app initially:
   ```json
   // appsettings.json
   "ReverseProxy": {
     "Routes": { "legacy": { "ClusterId": "legacy", "Match": { "Path": "{**catch-all}" } } },
     "Clusters": { "legacy": { "Destinations": { "app": { "Address": "http://localhost:5000/" } } } }
   }
   ```
3. **Migrate one endpoint at a time.** After each endpoint is migrated to ASP.NET Core, update YARP to route that path to the new app:
   ```json
   "Routes": {
     "migrated-users": { "ClusterId": "new", "Match": { "Path": "/api/users/{**rest}" } },
     "legacy": { "ClusterId": "legacy", "Match": { "Path": "{**catch-all}" } }
   }
   ```
4. **Authentication during Strangler Fig:** Share Data Protection key ring + common cookie domain, OR externalize identity to an IdP (Entra ID / Auth0) so both apps validate the same tokens.
5. **Decommission** the legacy app when its last route is removed from YARP config.

This approach allows teams to ship migrated endpoints to production continuously, with zero downtime and no big-bang cutover.

---

## Recommended Slice Plan

| Slice | Name | Content |
|---|---|---|
| F1 | Project scaffold | TARGET_PATH skeleton, YARP setup (if Strangler Fig), shared auth config |
| F2 | Authentication + Identity | Port auth middleware; share Data Protection keys; verify cookie/JWT compatibility |
| F3 | Configuration + Logging | web.config → appsettings.json; IOptions<T> binding; Serilog setup |
| F4 | Domain + Business Logic | Port class libraries; fix BinaryFormatter, BeginInvoke, AppDomain if present |
| F5 | Data Access | EF6 → EF Core (or Dapper); see ef6-to-efcore.md; schema migration baseline |
| F6 | API / Controllers | Web API 2 → ASP.NET Core Web API; HTTP Modules → middleware |
| F7 | UI Layer | WebForms / MVC → Razor Pages / Blazor / SPA (may be a separate FRONTEND track) |
| F8 | Integration + Tests | Characterization tests passing; parity tests against old endpoints if Strangler Fig |
