# Prompts — Legacy ASP.NET Framework

---

## File 1 Prompt — architecture.md

You are a software architect documenting a legacy ASP.NET Framework application.
Read in order: the .sln file, all .csproj files, packages.config files,
Web.config (root), Global.asax, and the top-level folder structure.

Populate architecture.md completely:

**Technology Stack** — .NET Framework version (from .csproj TargetFrameworkVersion),
ASP.NET type (WebForms, MVC, Web API, or mixed), authentication (Forms Auth,
Windows Auth, Identity), ORM or data access (Entity Framework version,
Dapper, ADO.NET direct), JavaScript framework (jQuery version, any SPA libraries),
CSS framework, NuGet packages from packages.config.

**Solution Structure** — list every project with folder path and one-line purpose.

**Request Pipeline** — read Global.asax Application_Start. List every
HttpModule registered, HttpHandler registered, route table configuration,
and filter registration (GlobalFilters for MVC).

**Authentication & Authorization** — read Web.config authentication section,
any custom AuthorizeAttribute, membership provider configuration.

**Web.config Transforms** — list every Web.{Environment}.config transform file
and summarise what each overrides (connection strings, app settings, debug flags).

**Database Access Pattern** — identify which database access pattern is used:
Entity Framework (version, Code First/DB First/Model First), Dapper, raw ADO.NET.
List connection string names from Web.config.

**Upgrade Risk Areas** — identify patterns that are blockers or risks
for a future migration to .NET: synchronous HttpModules, WebForms ViewState,
COM interop, HttpContext.Current usage, static state, non-DI instantiation patterns.

Every fact must come from source files.
Sections that cannot be determined: `> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are documenting request flows through a legacy ASP.NET Framework application.

For MVC controllers: trace each action method through the call chain
(controller → service/manager → repository/DAL → database).

For WebForms: trace each Page_Load and event handler through the call chain.

For Web API controllers: trace each ApiController action.

For each flow document:
- Entry point (route URL or page file)
- Every method call in sequence with class names
- Database calls (connection string used, query type)
- Any external HTTP calls
- Session or ViewState usage
- Auth check points

**HttpModule Pipeline** — list every module in the request pipeline
with its event subscriptions (BeginRequest, AuthenticateRequest, etc.)
and what it does.

**jQuery/JavaScript Patterns** — identify key JavaScript interaction patterns:
AJAX calls (endpoints called, data format), form submission patterns,
any SPA-like patterns built with jQuery.

Read actual code files — do not infer from naming conventions.
Mark incomplete traces: `> ⚠ Partial trace — review manually`

---

## File 3 Prompt — architecture-reference.md

You are documenting reference data for a legacy ASP.NET Framework application.

**NuGet Package Versions** — read all packages.config files.
List every package with id, version, and which project it belongs to.
Copy version strings exactly.

**Web.config App Settings** — list every key in <appSettings> from the
root Web.config (use placeholder for values that look like secrets).

**Connection Strings** — list every connection string name and its
providerName (not the actual connection string value).

**Registered Routes** — list every explicitly registered route from
RouteConfig.cs or Global.asax with its URL pattern and defaults.

**Build / Publish Configuration** — list publish profiles found
in Properties/PublishProfiles/ with their deployment targets.

**CI/CD Pipelines** — for each pipeline file: name, trigger, purpose.
