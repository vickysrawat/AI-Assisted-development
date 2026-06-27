# Prompts — ASP.NET Core MVC with Razor Views

---

## File 1 Prompt — architecture.md

You are a software architect documenting an ASP.NET Core MVC application with Razor Views.
Read in order: the .sln file, all .csproj files, Program.cs, and
the top-level folder structure including Views/, Controllers/, and wwwroot/.

Populate architecture.md completely:

**Technology Stack** — .NET version, ASP.NET Core MVC version, authentication
(Identity, Entra ID, Cookie, OpenIdConnect), data access (EF Core version,
Dapper, ADO.NET), client-side bundling (LibMan, Bundler & Minifier, webpack,
Vite), CSS framework, JavaScript libraries in wwwroot/, test frameworks.

**Solution Structure** — list every project with folder path and one-line purpose.

**Controller / Action / View Map** — read every Controller class.
For each action: HTTP verb, route, return type (View, PartialView, JSON, Redirect),
View file path, and auth requirement.

**Razor Layout Hierarchy** — identify _Layout.cshtml files and which
_ViewStart.cshtml files reference them. Map the layout hierarchy per area.

**Partial Views and View Components** — list all partial views and
View Components with their purpose and where they are used.

**Tag Helpers and HTML Helpers** — identify any custom Tag Helpers or
HTML Helpers defined in the project and their purpose.

**Middleware Pipeline** — read Program.cs and list every middleware
registration in order with its purpose.

**Client-Side Bundling** — read bundleconfig.json or libman.json.
List input files, output bundle files, and minification settings.

Every fact must come from source files.
Sections that cannot be determined: `> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are documenting request flows in an ASP.NET Core MVC application with Razor Views.

For each significant controller/action trace the full flow:
- Route URL → controller → action → service/repository → database
- View rendering: which .cshtml is rendered, which partial views it includes,
  what model is passed
- AJAX endpoints: actions that return JSON for partial page updates,
  and the JavaScript that calls them
- Form submissions: which actions handle POST, model binding, validation,
  redirect-after-post pattern

**Razor View Data Flow** — for key views, document:
- ViewModel type passed from controller
- ViewBag/ViewData keys used (flag these as code smells)
- Sections defined and rendered (@section, @RenderSection)

**Authentication Flows** — trace the login, logout, and access-denied flows.
Identify which middleware handles redirects and which controller actions
handle the auth callbacks.

**JavaScript / AJAX Patterns** — list the key AJAX calls made from
Razor views: the JS file, the endpoint called, and what DOM element it updates.

Read actual controller, service, and view files.
Mark incomplete traces: `> ⚠ Partial trace — review manually`

---

## File 3 Prompt — architecture-reference.md

You are documenting reference data for an ASP.NET Core MVC application.

**NuGet Package Versions** — read all .csproj files.
Extract every PackageReference with exact version. Copy exactly.
Group by: ASP.NET Core, EF Core, Identity, Auth, client-side, testing, other.

**Static Asset Inventory** — read wwwroot/ structure.
List JS libraries (from lib/ or vendor/) with versions where identifiable
from filenames or package manifests.

**appsettings Configuration** — list every appsettings.{Environment}.json file.
For each key in the root appsettings.json, note its purpose
(use placeholder for secret-looking values).

**Areas** — list every Area defined in the project with its purpose.

**CI/CD Pipelines** — for each pipeline file: name, trigger, purpose.

**Bundle Files** — if bundleconfig.json exists, list every output bundle
with its input files.
