---
paths: ["**/*.cs", "**/Controllers/**", "**/Services/**", "**/Repositories/**", "**/App_Start/**"]
detect:
  files: ["**/*.csproj"]
  dependencies: ["System.Web", "Microsoft.AspNet.Mvc", "Microsoft.AspNet.WebApi.Core"]
---

> ⚠️ LEGACY — MAINTENANCE ONLY. Do not use these patterns for new features or new services.
> For new work, provision a .NET 8+ service and follow `csharp-dotnet-rules.md`.
> Layer 1 concern files (`rest-api-rules.md`, `auth-rules.md`, `api-security-rules.md`,
> `data-access-rules.md`) still apply unless a specific override is noted below.

# C# / ASP.NET Framework 4.8 Rules — Applies to ASP.NET MVC 5 and Web API 2 projects

## Architecture
- Thin controllers: no business logic — only model binding, validation, service call, and response mapping
- Service layer owns all business logic and calls Repository
- Repository layer owns all data access — Dapper with parameterised SQL (see `data-access-rules.md`)
- ViewModels and DTOs never expose domain entities or EF models directly — map at the service boundary
- Constructor injection via Unity / Autofac / Ninject — never `new` up dependencies inside classes

## Response Standards — Web API 2 (overrides rest-api-rules.md)
- Return `IHttpActionResult`: `Ok(dto)`, `Created(...)`, `BadRequest(ModelState)`, `NotFound()`, `InternalServerError(sanitizedException)`
- Always check `ModelState.IsValid` before business logic — return `BadRequest(ModelState)` on failure
- Status codes follow the same semantics as `rest-api-rules.md` — 401 vs 403 distinction applies

## Response Standards — MVC 5
- Return typed `ActionResult`: `View(model)`, `RedirectToAction(...)`, `Json(dto, JsonRequestBehavior.AllowGet)`
- POST-Redirect-GET pattern for all form submissions — prevents double-submit on browser refresh

## Auth Pattern (overrides csharp-dotnet approach — legacy decorator pattern)
- Decorate controllers or actions with `[Authorize]` / `[Authorize(Roles = "RoleName")]`
- Never trust client-provided user IDs — resolve from `User.Identity` / claims principal
- `ICurrentUserService` wrapping `HttpContext.Current` in a testable abstraction — do not access `HttpContext.Current` directly in services
- `[ValidateAntiForgeryToken]` on every POST/PUT/DELETE MVC action

## Model Validation
- `DataAnnotations` on all ViewModel/DTO properties; `FluentValidation` for complex cross-field rules
- Always check `ModelState.IsValid` — return `BadRequest` before any business logic

## Dependency Injection (Unity / Autofac)
- Register all dependencies in `App_Start/UnityConfig.cs` (or equivalent)
- `PerRequestLifetimeManager` for services that touch `HttpContext` or DbContext
- Never use `ServiceLocator` — constructor injection only

## Logging (log4net / NLog)
- Never `Console.WriteLine` or `Debug.Write` in production code
- Always log `{ operation, userId, duration }` — never log PII
- Unhandled exception logging in `Global.asax Application_Error`

## Testing (MSTest / NUnit + Moq)
- Arrange / Act / Assert with blank lines between sections
- Test method name: `MethodName_WhenCondition_ThenExpectedBehavior`
- Always test: `ModelState` invalid branch, not-found branch, and authorization boundary from ICEA
- `TestServer` / `HttpClient` for integration tests against Web API 2 controllers

## Out of bounds
- No business logic in controllers, repositories, or `Global.asax`
- No `HttpContext.Current` outside controllers and thin infrastructure helpers
- No connection strings or secrets in `web.config` committed to the repo
- No `Response.Write` or direct `HttpResponse` manipulation outside action results
