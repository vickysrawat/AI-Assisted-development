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

You are a software architect documenting user-facing workflows in an Angular SPA (applies to both standard Angular and Nx monorepo projects).

Read the component files, service files, routing configuration, NgRx store files (actions, reducers, effects, selectors), and signal-based state files for each app. Your goal is to produce a workflow reference that a developer or QA engineer can use to understand every user journey end-to-end — from the user's action to the HTTP call to the state update to the UI re-render.

**Do NOT produce a dependency graph or code call-chain diagram. Produce sequence diagrams of user-facing workflows.**

---

**Step 1 — Enumerate ALL workflows.**

Scan every route definition, every component with a user-triggered method (click handler, form submit, route activation), and every HTTP call in every service. Produce a numbered list of ALL distinct user journeys. A workflow is any user action that results in an HTTP call, a route navigation, or a meaningful state change. Do not limit to the "happy path" or "main features" — enumerate every workflow you can trace, including:

- Authentication flows (login, logout, token refresh, SSO redirect)
- Every CRUD operation for every entity (list, create, edit, delete, detail view)
- Search and filter interactions that trigger HTTP calls
- File upload / download flows
- Navigation flows guarded by route guards or resolvers
- Modal / dialog flows that submit data
- Real-time / WebSocket subscription flows
- Error and retry flows (HTTP interceptor behaviour, error boundary components)
- Pagination, sorting, infinite scroll flows
- Permission / role-based conditional flows

For Nx monorepos: enumerate workflows per app. Group by app, then number workflows within each app.

---

**Step 2 — Write one section per workflow.**

Use this exact structure for every workflow:

**Heading:** `## Workflow N — Name`

**Lead paragraph:** One or two sentences of plain English — what user action triggers this workflow, what the system does, and what the user sees when it completes.

**Mermaid sequence diagram** (hard constraints):
- `sequenceDiagram` syntax only — never `flowchart` or `graph`
- Declare all actors/participants at the top using `actor` for human roles and `participant` for systems, with short alias and readable label
- Include every participant that appears: user role, Component, Service, Angular HttpClient, Backend API, NgRx Store / Signals, Guards, Resolvers, Interceptors
- Every HTTP call: verb + exact path + payload type in parentheses — read from actual service source
- Every database/state operation: show dispatch, selector emit, or signal update
- `alt`/`else` for conditional branches, `opt` for optional paths, `par` for concurrent operations
- Response arrows use `-->>` (dashed)
- Emit inside a fenced ` ```mermaid ` block

**"What happens:" bullet list:** Bold heading `**What happens:**`, 4-6 bullets, plain English business rules, no TypeScript syntax or class names, intelligible to a non-technical reader.

---

**Diagram actor conventions:**

| Actor label | When to use |
|---|---|
| `actor User` | The human interacting with the browser |
| `participant Component as <ComponentName>` | The Angular component that owns the template event (use actual class name) |
| `participant Service as <ServiceName>` | The injected service that owns the HTTP call (use actual class name) |
| `participant HTTP as Angular HttpClient` | The Angular HttpClient layer (interceptors fire here) |
| `participant API as Backend API` | The backend REST/GraphQL/WebSocket endpoint |
| `participant Store as NgRx Store` | NgRx store (actions in, selectors out) |
| `participant Store as Signals` | Signal-based state (if the project uses Angular signals instead of NgRx) |
| `participant Guard as <GuardName>` | Route guard — show when a guard conditionally blocks or redirects |
| `participant Resolver as <ResolverName>` | Route resolver — show when pre-fetched data is loaded before component activation |
| `participant Interceptor as <InterceptorName>` | HTTP interceptor — show when auth token injection or global error handling is part of the flow |

Show only the actors that actually participate in a given workflow. Do not include actors that play no role.

---

**NgRx / signals — show the full dispatch-select cycle:**

For NgRx workflows: show `dispatch(ActionName({payload}))` on the arrow from Component or Effect to Store, and `selector emits <EntityList>` on the return arrow. If an Effect handles the HTTP call, add a `participant Effect as <EffectClassName>` and show the full: Store → Effect → HTTP → Effect → Store chain.

For signal-based workflows: show `signal.set(value)` or `signal.update(fn)` on the arrow to Store, and `computed(() => ...)` emitting on the return arrow.

---

**Nx monorepo — additional requirements:**

After the per-app workflow sections, add a final section:

### Library Impact Map

For each shared library in the monorepo, list which apps are affected if it changes:

| Library | Affected Apps | Workflows Impacted |
|---|---|---|
| `@org/ui-components` | app-a, app-b | Workflow 1, 4, 7 (app-a); Workflow 2 (app-b) |

---

**Coverage requirement:**

The Table of Contents at the top of the document must list every workflow. After writing all sections, verify: does every route in the router configuration have at least one corresponding workflow? Does every service method that calls HttpClient appear in at least one sequence diagram? If any are missing, add stub sections with `> ⚠ Partial trace — review manually`.

---

**Hard rules:**

1. Table of Contents is ALWAYS the first thing in the file.
2. Never group unrelated flows into one workflow for convenience.
3. Never invent HTTP paths, API endpoints, or state management details — read from actual source files.
4. `sequenceDiagram` only.
5. Every HTTP verb + path must match an actual HttpClient call in source.
6. Do not produce a Component Dependency Graph or Service Dependency Graph.
7. Do not produce call-chain traces (module.function → module.function).
8. If a service method exists but is never called from any component or effect you can find, note it as `> ⚠ Orphaned service method — not traced to any workflow`.

Read actual TypeScript source files — component class bodies, service methods, NgRx effect classes, router module or standalone route arrays. Do not infer workflows from filenames or route paths alone.

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
- **Data Exchanged** — what crosses each boundary; flag B-series sensitive data.

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
- **Sensitive Data Handling** — B-series data rendered/stored client-side and how it is protected.

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
