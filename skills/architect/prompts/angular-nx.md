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
note the build pipeline. Produce a Mermaid flowchart of app → lib dependencies.

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

---

## File 1 addendum — architecture.md diagrams

In addition to the sections above, `architecture.md` MUST contain two Mermaid diagrams:

- **`## End-to-End Architecture`** — a `flowchart LR`: user → app (routes/entry) → HTTP layer →
  backend API → data store, plus any external services. Label edges with protocol/auth where
  known. Only include nodes confirmed from source — never invent one.
- **`## Layered View`** — a `flowchart TB` of the real client layers with dependency direction
  (e.g. components → services → state/store → HTTP), derived from actual imports/module
  boundaries (for a library: public API surface → internals).

Emit valid fenced ` ```mermaid ` blocks; keep node labels short, free of `()[]{}`. If the layer
graph cannot be determined, keep the `> ⚠ Could not determine — needs manual input` marker
instead of an empty or invalid diagram.

---

## File 4 Prompt — architecture-data.md

Document the client data model (for a library: the exported data types). Read state stores/
slices/services, typed models/interfaces, and API client code.

- **Client State Model** — each store/slice/stateful service: state shape (key fields), owning
  feature, persistence (memory/localStorage/none). *(Library: list Exported Data Types instead —
  type/interface, kind, public?, purpose.)*
- **API DTO Shapes** — request/response models exchanged with the backend, from typed
  models/interfaces: DTO, used-by, endpoint, direction.
- **State Ownership & Flow** — which feature owns each piece of state and how it flows
  (inputs/props, selectors, events/actions); derived vs source-of-truth. *(Library: how the
  exported types compose + public-shape versioning constraints.)*
- **Caching / Invalidation** — client-side caching and how it is invalidated.

Every fact from source. Undetectable → `> ⚠ Could not determine — needs manual input`.

---

## File 5 Prompt — architecture-integrations.md

Catalogue external dependencies the app/library calls. Read HTTP client setup, API base-URL
config, third-party SDKs, and any browser/runtime integrations.

- **External Dependencies** — name, kind (REST/GraphQL/SDK/browser API), contract (endpoint),
  where called from, auth (token attachment).
- **Resilience & Failure Behavior** — per-dependency timeout, retry, and UI fallback on failure
  (from code). The **"on failure — what the user sees"** and **SLA/ownership** are usually human
  knowledge — if not in code, write `> ⚠ Could not determine — needs manual input`.
- **Data Exchanged** — what crosses each boundary; flag B1–B7 sensitive data.

Never invent timeouts, SLAs, or owners. Extract only what code shows; flag the rest.

---

## File 6 Prompt — architecture-security.md

Document the trust map and client-side authorization. Read route guards / protected-route
wrappers, auth context/interceptors, token storage, and any role/permission checks in the UI.

- **Trust Boundaries / Zones** — browser → API and any third-party embed; note that the client
  is untrusted and the API is the real enforcement point.
- **Authorization Model** — table of Route/Action → Guard/Role → Enforced-at (name the
  guard/wrapper/interceptor). Note where the UI only *hides* vs actually *enforces* (server does).
- **Business Rules Gating Actions** — role/permission-driven UI gating; flag human-knowledge gaps.
- **Secrets Handling (summary)** — token storage (session vs local), no secrets in the bundle.
- **Sensitive Data Handling** — B1–B7 data rendered/stored client-side and how it is protected.

Do NOT claim the client enforces security the server must — flag "UI-only" gating explicitly.

---

## File 7 Prompt — architecture-decisions.md (SEED ONLY)

Seed the decision log — create the first few `AD-NNN` entries from *detectable, non-obvious*
choices; do not populate the whole file, and **never invent the rationale**.

For each detected choice: **Decision** (from code/config — state-management choice, routing/
auth approach, build tooling, framework/layering), **Rationale** = `> ⚠ Could not determine —
needs manual input`, **Alternatives rejected**, **Date** = `unknown` unless evidenced,
**Status** = `Accepted`.

Seed at most 3–5 entries. **If the file already contains real `AD-NNN` entries with filled
rationale, do not modify it** — it is an append-only human log.
