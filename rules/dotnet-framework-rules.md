---
paths: ["**/*.cs", "**/Controllers/**", "**/Services/**", "**/Repositories/**", "**/App_Start/**"]
---

# .NET Framework / C# Rules — Applied to ASP.NET Framework projects

Applies to ASP.NET MVC 5, ASP.NET Web API 2, and .NET Framework 4.x projects.
Where a rule differs from .NET (Core) it is marked; otherwise both stacks share
the same intent.

## Architecture
- Thin controllers: no business logic — only model binding, validation, service call, and response mapping
- Service layer owns all business logic and calls Repository
- Repository layer owns all data access — no LINQ queries in controllers or services
- ViewModels and DTOs never expose domain entities or EF models directly — map at the service boundary
- Use constructor injection via Unity / Autofac / Ninject — never `new` up dependencies inside classes

## Response Standards (Web API 2)
- Success: return `IHttpActionResult` — `Ok(dto)`, `Created(...)`, `NoContent()`
- Validation error: `BadRequest(ModelState)` after checking `ModelState.IsValid`
- Not found: `NotFound()` with a message body — never an empty 404
- Unauthorized: `Unauthorized()` (401) or custom `403` result — never 404 to hide a resource
- Server error: `InternalServerError(sanitizedException)` — log full exception, never expose stack trace to caller

## Response Standards (MVC 5)
- Return typed `ActionResult` — `View(model)`, `RedirectToAction(...)`, `Json(dto, JsonRequestBehavior.AllowGet)`
- Never return raw strings or untyped `object` from actions
- POST-Redirect-GET pattern for all form submissions to prevent double-submit

## Auth Pattern
- Decorate controllers or actions with `[Authorize]` / `[Authorize(Roles = "RoleName")]`
- Never trust client-provided user IDs — always resolve from `User.Identity` / claims principal
- Use a thin `ICurrentUserService` abstraction — do not read `HttpContext.Current` directly in services
- Anti-forgery token (`[ValidateAntiForgeryToken]`) on every POST/PUT/DELETE in MVC controllers

## Model Validation
- Always check `ModelState.IsValid` at the top of every action before business logic
- Use `DataAnnotations` (`[Required]`, `[StringLength]`, `[RegularExpression]`) on ViewModel/DTO properties
- Use `FluentValidation` for complex cross-field rules when `DataAnnotations` are insufficient

## Dependency Injection
- Register all dependencies in `App_Start/UnityConfig.cs` (or equivalent container bootstrap)
- Use `PerRequestLifetimeManager` for services that touch `HttpContext` or DbContext
- Never use `ServiceLocator` anti-pattern — inject via constructor only

## Entity Framework (6.x)
- One `DbContext` per request — register with `PerRequestLifetimeManager`
- Repository pattern wrapping EF — no `DbContext` or `DbSet` references outside the Repository layer
- Migrations only via `Enable-Migrations` / `Add-Migration` / `Update-Database` — never hand-edit migration files
- No lazy loading in APIs — use explicit `.Include()` to avoid N+1 queries
- Always `AsNoTracking()` for read-only queries

## Logging
- Use `log4net` or `NLog` — never `Console.WriteLine` or `Debug.Write` in production code
- Always log `{ operation, userId, duration }` — never log PII
- Wrap unhandled exception logging in `Global.asax Application_Error`

## Documentation
- XML doc comments (`/// <summary>`) on all public methods, properties, and classes
- RoutePrefix / Route attributes documented with expected input/output shapes

## File Naming
- Files: `PascalCase.cs` (e.g. `UserFilterService.cs`, `IUserFilterService.cs`)
- DB migrations: `YYYYMMDD_DescriptiveName` (EF migration name convention)
- ViewModels: `{Feature}ViewModel.cs` — never reuse domain entities as ViewModels

## Global Configuration
- `WebApiConfig.cs` — API routing, formatters, filters
- `RouteConfig.cs` — MVC routing
- `FilterConfig.cs` — global action filters (logging, exception handling, auth)
- Never put routing or filter registration inside controllers

## Testing Pattern
- MSTest or NUnit; Arrange / Act / Assert with blank lines between sections
- Mock all dependencies with Moq
- Test method name: `MethodName_WhenCondition_ThenExpectedBehavior`
- One assertion concept per test
- Always test: `ModelState` invalid branch, not-found branch, and authorization boundary from the ICEA
- Use `TestServer` / `HttpClient` for integration tests against Web API 2 controllers

## Out of bounds
- No business logic in controllers, repositories, or `Global.asax`
- No `HttpContext.Current` references outside controllers and thin infrastructure helpers
- No connection strings or secrets in `web.config` committed to the repo — use `web.config` transforms + environment-specific overrides or Azure Key Vault
- No `Response.Write` or `HttpResponse` manipulation outside action results
