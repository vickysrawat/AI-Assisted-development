# Prompts — .NET Web API

---

## File 1 Prompt — architecture.md

You are a software architect documenting a .NET codebase for the first time.
Read the following in order: the .sln file, all .csproj files, Program.cs,
the top-level folder structure, and any README files at the solution root.
Do not read individual service or controller files yet — work only from
project-level files for this pass.

Populate architecture.md completely, filling every section:

**Technology Stack** — read all .csproj files and extract: framework version,
auth library, data access library, database driver, logging library, config
provider, API documentation library, health check library, test frameworks,
CI/CD tooling, containerization. Present as a table.

**Solution Structure** — list every project in the solution with its folder
path and a one-line statement of its responsibility. Include test projects.

**Layer Dependency Diagram** — draw an ASCII diagram showing which projects
reference which. Read the `<ProjectReference>` entries in each .csproj to
determine actual edges, not assumed architecture. Note any deviations from
Clean Architecture convention.

**Project Responsibilities** — for each project: its responsibility,
the DI extension method it exposes (look for `Add*Services()` or `Add*()`
methods in Extensions/ folders), and its `InternalsVisibleTo` test project if present.

**Middleware Pipeline Order** — read Program.cs and list every `app.Use*()`,
`app.Map*()`, and middleware registration in the exact order they appear,
with a one-line description of each.

**API Endpoints** — read all Controller files, list every action method with:
HTTP verb, route template, auth requirement (from attributes), and return type.

**Configuration Sections** — read AppSetting or equivalent config model classes
and list every config section with its model class and purpose.

**Background Jobs** — state explicitly whether any IHostedService,
BackgroundService, or hosted worker exists. If none, say so.

Every fact must come from source files.
Sections where the answer cannot be determined: write
`> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-callchains.md

You are a software architect tracing request flows through a .NET Web API.
Read every Controller file, then follow each action method through the full
call chain: controller → service → repository → database or external API.

For each endpoint trace:
- Entry point: controller class, method name, route
- Every method call in sequence with fully qualified class name
- At each step: which database (name the connection string key) or
  external service is called, and how (REST, SQL query, named HttpClient)
- Any parallel operations: Task.WhenAll, Parallel.ForEach — list what runs in parallel
- Conditional branches that significantly change the flow:
  feature flags, null short-circuits, UseWall-style toggles
- Return type at each layer

After all call chains, produce a **Class-Level Dependency Graph**:
For each non-trivial class (controllers, services, repositories, external API managers),
read its constructor and list every injected dependency by interface name.

Then produce two tables:
- **Highest Fan-In** (top 10 types most depended upon) — count how many constructors
  inject each type
- **Highest Fan-Out** (top 10 classes with most constructor parameters)

Read actual constructors and method bodies — do not infer from interface names alone.
If a method body is too large to trace fully, note the stopping point and
mark `> ⚠ Partial trace — complex method, review manually`.

---

## File 3 Prompt — architecture-reference.md

You are a software architect cataloguing reference data for a .NET solution.
This is a reference-only file — precision matters more than narrative.

**NuGet Package Versions** — read every .csproj file.
Extract every `<PackageReference>` with its exact `Version` attribute and
which project file it appears in. Copy version strings exactly — do not
round or abbreviate. Present as a table sorted by package name.

**CI/CD Pipelines** — read every .yml/.yaml file in pipelines/ or .azure/
or any pipeline folder at the root. For each file: filename, trigger condition,
and purpose in one sentence.

**Top Fan-Out classes** — list the 10 classes with the most direct constructor
dependencies, with their dependency count and list of types.

**Top Fan-In types** — list the 10 types injected into the most constructors,
with the count and names of classes that depend on them.

Do not summarise or paraphrase package names or versions — copy exactly.
