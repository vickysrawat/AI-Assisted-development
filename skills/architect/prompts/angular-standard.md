# Prompts — Angular Standard Workspace

---

## File 1 Prompt — architecture.md

You are a software architect documenting a standard Angular workspace.
Read in order: angular.json, tsconfig.json, package.json, and the
top-level folder structure under src/ and projects/.

Populate architecture.md completely:

**Technology Stack** — Angular version, state management, UI component library,
HTTP client pattern, test frameworks (Karma/Jest/Cypress/Playwright), build tool.

**Workspace Structure** — list every project defined in angular.json:
name, type (application/library), root folder, one-line purpose.

**Library Dependency Map** — identify libraries under projects/ or libs/.
For each: its public API surface (index.ts), what it exports, which apps import it.
Read tsconfig.base.json paths to find library aliases.

**API Consumption Map** — read environment files and service files to find
backend API base URLs and the endpoints each service calls.
Present as: Service class → API endpoint → HTTP method.

**Routing Structure** — read app-routing.module.ts or app.routes.ts per project.
List top-level routes, lazy-loaded paths, and their guard/resolver requirements.

**State Management** — identify pattern used: NgRx, Signals, BehaviorSubject services,
or simple component state. If NgRx: list feature stores and their slices.

**Module Structure** (if NgModules used) — list feature modules, shared module,
core module, and what each provides/exports.

Every fact must come from source files.
Sections that cannot be determined: `> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are documenting user and data flows in an Angular application.
Read component, service, and routing files for each project.

For each primary user journey (login, main feature workflows):
- Route URL → component → service → HTTP call sequence
- State changes (store dispatches, BehaviorSubject updates, signal writes)
- Route guards and resolvers that run before activation
- Error handling path (error interceptor, component-level, global)

**Component Tree** — for each app's main views, draw the parent-child
component hierarchy showing Input/Output bindings and service injections.

**HTTP Interceptors** — list every interceptor, what it adds/modifies
(auth headers, error handling, loading state), and the order they apply.

**Service Dependency Graph** — list services and what they inject,
identifying any circular patterns or deep chains.

Read actual TypeScript and template files.
Mark incomplete traces: `> ⚠ Partial trace — review manually`

---

## File 3 Prompt — architecture-reference.md

You are documenting reference data for an Angular workspace.

**npm Package Versions** — read package.json. Extract every dependency
and devDependency with exact version string, grouped by category.

**Angular.json Project Targets** — for each project in angular.json,
list its configured targets (build, test, lint, serve, e2e) and
the builder/executor used.

**Environment Variables** — list all environment files per project
and the variables they define.

**Test Configuration** — list test frameworks, config files,
and any coverage thresholds per project.

**CI/CD Pipelines** — for each pipeline file: name, trigger, purpose.
