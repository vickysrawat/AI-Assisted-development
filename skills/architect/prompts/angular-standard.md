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
