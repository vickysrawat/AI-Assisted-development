# Stack Reference: .NET Framework 4.x

_For migration skills — loaded when source stack token = `dotnet_framework`_

---

## What Exists in .NET Framework (and must migrate)

**Removed entirely in .NET 8+ — no upgrade path:**
| Technology | Status | Migration target |
|---|---|---|
| WebForms (.aspx + codebehind) | Removed | Blazor Server (rewrite) or Razor Pages (rewrite) |
| WCF server | Removed | CoreWCF (lift-and-shift), gRPC, or REST/Web API |
| .NET Remoting | Removed | gRPC, SignalR, or System.IO.Pipes |
| `BinaryFormatter` serialization | Removed | System.Text.Json, Protobuf, MessagePack |
| `AppDomain` isolation | Removed | Separate processes or `AssemblyLoadContext` |
| Code Access Security (CAS) | Removed | OS-level security boundaries |
| `Delegate.BeginInvoke` / `EndInvoke` | Throws `PlatformNotSupportedException` | async/await + Task |
| `ObjectContext` (EF) | Not available | EF Core (if migrating ORM) |
| ASMX web services | Removed | REST or gRPC |
| `System.Web` namespace | Removed | ASP.NET Core equivalents |

---

## Key .NET Framework Patterns and Their Migrations

**HttpContext.Current (static ambient context)**
Used throughout business logic in legacy apps. Does NOT exist in ASP.NET Core.
→ Migration: inject `IHttpContextAccessor` during transition period; then eliminate HTTP context from non-web layers entirely.

**HTTP Modules / Global.asax (Application_BeginRequest etc.)**
→ Migration: rewrite as ASP.NET Core middleware. Cannot be automated — requires manual rewrite.

**Forms Authentication / OWIN pipeline**
→ Migration: ASP.NET Core Identity + cookie/JWT middleware. Cookie encryption uses Data Protection (different keys). During side-by-side migration, must share Data Protection key ring and configure a common cookie domain.

**web.config / ConfigurationManager**
→ Migration: `appsettings.json` + `IOptions<T>`. Environment-specific transforms (`web.Debug.config`) → `appsettings.Development.json`.
Note: The .NET Upgrade Assistant migrates basic `<appSettings>` and `<connectionStrings>`. Complex custom config sections require manual mapping.

**Session state (System.Web.SessionState)**
→ Migration: ASP.NET Core session backed by `IDistributedCache`. API is async (no sync equivalent). Cookieless session mode does NOT exist in ASP.NET Core.

**EF6 / EDMX**
→ See `shared/ef6-to-efcore.md` for full behavioral difference table and migration procedure.
`.edmx` visual designer and T4 templates have no EF Core equivalent. Models must be regenerated.

**WCF Decision Matrix**

| Factor | CoreWCF | gRPC | REST/Web API |
|---|---|---|---|
| Existing SOAP client compat | High | Requires new client | Requires new client |
| Performance | Similar to WCF | Highest | Moderate |
| Browser callable | No | No (without gRPC-Web) | Yes |
| Long-term viability | Limited (community) | Strong | Strong |
| MS recommendation | Transition tool only | Internal RPC | Public APIs |

CoreWCF supports: BasicHttpBinding, WSHttpBinding, NetTcpBinding, WSDL, WS-Federation.
CoreWCF does NOT support: WSDualHttpBinding, MSMQ, full WS-Security, distributed transactions.

---

## Incremental Migration Pattern (Strangler Fig + YARP)

For large apps that cannot be migrated in one sprint:
1. Add `Yarp.ReverseProxy` to the new ASP.NET Core project.
2. Configure YARP to proxy ALL traffic to the legacy app initially.
3. As each endpoint is migrated to ASP.NET Core, update YARP routing config to point to the new app.
4. Decommission the legacy app when its last route is removed.
5. Clients see one entry point throughout — zero downtime migration.

Authentication during hybrid phase: must share Data Protection key ring and configure a common cookie domain, OR externalize identity to an IdP (recommended for new projects).

---

## Upgrade Tooling Status (2025)

The .NET Upgrade Assistant was deprecated in late 2025. Microsoft now directs teams to GitHub Copilot App Modernization (requires paid Copilot subscription).

**What automated tools handle:**
- Converting legacy `.csproj` to SDK-style format
- Updating `<TargetFramework>` references
- Migrating basic `web.config` keys to `appsettings.json`
- Updating NuGet packages to compatible versions
- Removing some `System.Web` namespace imports

**What NO tool handles:**
- WebForms → Blazor/Razor Pages (full manual rewrite)
- HTTP Modules → Middleware (flagged but not converted)
- WCF service contracts (flagged but not converted)
- EDMX / T4 templates
- `HttpContext.Current` in business logic (flagged only)

---

## Anti-Patterns to Flag in Source Code

| Source pattern | Migration action |
|---|---|
| `HttpContext.Current` in service/repo | Must extract to controller boundary; inject `IHttpContextAccessor` short-term |
| `Response.Redirect()` in business logic | Move to controller layer |
| `Session["key"]` throughout codebase | Centralize into a typed session wrapper before migrating |
| `ConfigurationManager.AppSettings["key"]` | Map to `IOptions<T>` |
| Thread.Sleep / blocking in web requests | Rewrite as async |
| Global.asax event handlers | Rewrite as middleware |
| `[WebMethod]` ASMX | Rewrite as REST endpoint |
| Static shared mutable state | Refactor to scoped DI services |

---

## Framework-attribute tier reference (Stage 0.6)

Framework-provided attributes whose *declarative* outcome is framework-GUARANTEED → Stage 0.6 may
tier that outcome **STATIC** (see `specs/source-inventory-spec.md` → Tier cut-line). Hard rule: an
attribute **defined in the SOURCE tree is custom → INFERRED**. NOTE the big divergence from .NET
Core: Web API 2 does NOT auto-400 on invalid ModelState, and MVC5 `[Authorize]` does NOT split
401/403 — do not carry Core assumptions across.

### Curated (human-reviewed, web-grounded — ASP.NET MVC 5 / Web API 2, .NET Framework 4.x)
| attribute | framework@version | guaranteed outcome | source | grounded |
|---|---|---|---|---|
| `[Authorize]` (System.Web.Mvc) | ASP.NET MVC 5 | unauthenticated OR authenticated-but-unauthorized → **401** (does NOT distinguish 401/403); under Forms Auth the 401 is intercepted → **302 redirect to loginUrl**. A true 403 needs a custom `AuthorizeAttribute` (source-defined → INFERRED). | https://learn.microsoft.com/en-us/previous-versions/aspnet/dd460317(v=vs.118) | 2026-08-26 |
| `[AllowAnonymous]` (System.Web.Mvc) | ASP.NET MVC 5 | exempts an action/controller from `[Authorize]` | https://learn.microsoft.com/en-us/previous-versions/dd381413(v=vs.90) | 2026-08-26 |
| `[Required]` (DataAnnotations) | ASP.NET Web API 2 | populates `ModelState` (IsValid=false) on null/empty — but **NO automatic 400** (unlike Core `[ApiController]`); the 400 comes from source-side code (manual `ModelState.IsValid` check or a `ValidateModel` action filter) → that HTTP outcome is INFERRED | https://learn.microsoft.com/en-us/aspnet/web-api/overview/formats-and-model-binding/model-validation-in-aspnet-web-api | 2026-08-26 |

### Learned (managed by `/dream` — do not hand-edit inside the markers)
<!-- LEARNED:BEGIN (managed by /dream; rebuilt from memory/topic-framework-facts.md after upgrades) -->
| attribute | framework@version | guaranteed outcome | source (official doc) | date | trust |
|---|---|---|---|---|---|
<!-- no entries yet — /dream populates from Framework-fact memory entries -->
<!-- LEARNED:END -->
