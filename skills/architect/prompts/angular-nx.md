# Prompts — Angular Nx Monorepo

---

## File 1 Prompt — architecture.md

You are a software architect documenting an Nx Angular monorepo for the first time.
Read in order: nx.json, all project.json files, tsconfig.base.json,
package.json, and the top-level workspace folder structure.

Populate architecture.md completely:

**Technology Stack** — read package.json dependencies and devDependencies:
Angular version, Nx version, state management library (NgRx, Signals, Akita, etc.),
UI component library (Angular Material, PrimeNG, custom, etc.),
HTTP client pattern (HttpClient, generated client, custom wrapper),
test frameworks (Jest, Karma, Cypress, Playwright), build executor (Nx, Webpack, esbuild).

**Workspace Structure** — list every app and library in the Nx workspace from
project.json files. For each entry: name, type (app/lib), folder path,
one-line purpose, and tags (from project.json tags array).

**Library Dependency Graph** — read the `implicitDependencies` and `dependencies`
in project.json files. If `nx.json` has a `targetDefaults` or `namedInputs` section,
note the build pipeline. Draw an ASCII diagram of app → lib dependencies.

**Nx Configuration** — from nx.json extract: default base, affected base,
task pipeline (targetDefaults), any plugins registered, cache configuration.

**Shared Library Inventory** — list every library under libs/ with:
its public API entry point (index.ts exports), what it provides (components,
services, utilities, models), and which apps consume it.

**API Consumption Map** — for each app, identify which backend APIs it calls.
Read environment files and HttpClient service files to find base URLs and endpoints.
Present as: App → API base URL → endpoints consumed.

**Routing Structure** — for each app, read the main routing module or
app.routes.ts and list top-level routes and their lazy-loaded modules/components.

**State Management** — identify which state management pattern is used per app.
If NgRx: list stores, effects, and selectors. If Signals: list signal stores.

Every fact must come from source files.
Sections that cannot be determined: `> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are a software architect documenting user and data flows in an Nx Angular monorepo.
Read the component files, service files, and routing configuration for each app.

For each significant user journey (login, primary CRUD operations, key workflows):
- Entry point: route URL and component
- Component → service → HTTP call sequence
- State changes triggered (NgRx dispatches, signal updates, local state)
- Guard or resolver that runs before the component activates
- Error handling path

**Component Interaction Patterns** — for each app identify:
- Input/Output chains between parent and child components
- Any service-mediated cross-component communication
- EventEmitter vs signal vs store patterns used

**Library Usage Flows** — for each shared library, show a representative
call flow of how an app component uses it end-to-end.

**Nx Affected Impact Map** — based on the dependency graph, list which apps
are affected when each library changes. Present as: Library → Affected apps.

Read actual component templates and TypeScript files — do not infer from filenames.
Mark complex flows that need manual review: `> ⚠ Partial trace — review manually`

---

## File 3 Prompt — architecture-reference.md

You are documenting reference data for an Nx Angular monorepo.

**npm Package Versions** — read package.json. Extract every dependency and
devDependency with exact version string. Copy exactly — do not round.
Group by: Angular packages, Nx packages, UI libraries, state management,
testing, build tools, other.

**Nx Targets per Project** — read all project.json files.
For each project list its available targets (build, test, lint, e2e, serve, etc.)
and the executor used.

**Environment Configuration** — list every environment file found
(environment.ts, environment.prod.ts, etc.) per app, and the variables they define.

**Test Coverage Configuration** — list test frameworks, coverage reporters,
and any coverage thresholds defined in jest.config or karma.config per project.

**CI/CD Pipelines** — read pipeline files. For each: filename, trigger,
Nx affected commands used, and purpose.

Do not summarise or abbreviate package names or versions.
