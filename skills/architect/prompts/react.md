# Prompts — React Application

---

## File 1 Prompt — architecture.md

You are a software architect documenting a React application.
Read in order: package.json, vite.config/webpack.config/next.config (whichever exists),
tsconfig.json, and the top-level src/ folder structure.

Populate architecture.md completely:

**Technology Stack** — React version, meta-framework (Next.js, Remix, Vite, CRA),
routing library (React Router, TanStack Router, Next.js App Router),
state management (Redux, Zustand, Jotai, Context, TanStack Query),
UI component library (MUI, shadcn/ui, Chakra, Tailwind, custom),
HTTP client (Axios, fetch, generated client, TanStack Query),
test frameworks (Jest, Vitest, RTL, Playwright, Cypress), build tool.

**Folder Structure** — read src/ top-level folders and describe the convention:
features-based, type-based (components/hooks/services), domain-based, or mixed.
List each top-level folder with its purpose.

**Component Library Inventory** — if there is a shared components folder or
a separate UI package, list the exported components with one-line descriptions.

**API Consumption Map** — read service files, API client files, and hooks
to find backend base URLs and the endpoints consumed.
Present as: Hook/Service → API endpoint → HTTP method.

**Routing Structure** — read the router configuration or pages/ directory.
List all top-level routes, dynamic segments, layout routes, and protected routes.

**State Management** — identify what manages global vs server vs local state.
If Redux/Zustand: list stores and their slices/atoms.
If TanStack Query: list query keys and mutation patterns.

Every fact must come from source files.
Sections that cannot be determined: `> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are a software architect documenting user-facing workflows in a React SPA (applies to both standard CRA/Vite projects and monorepo setups using Nx, Turborepo, or similar).

Read the page/route components, custom hooks, context providers, data-fetching layer (fetch/axios/TanStack Query/SWR), and state management files (useState, useReducer, Redux slices, Zustand stores, Jotai atoms) for each app. Your goal is to produce a workflow reference that a developer or QA engineer can use to understand every user journey end-to-end — from the user's action to the HTTP call to the state update to the UI re-render.

**Do NOT produce a dependency graph or code call-chain diagram. Produce sequence diagrams of user-facing workflows.**

---

**Step 1 — Enumerate ALL workflows.**

Scan every route definition, every component with a user-triggered handler (onClick, onSubmit, onChange that triggers a side effect), and every HTTP call in every service file or hook. Produce a numbered list of ALL distinct user journeys. A workflow is any user action that results in an HTTP call, a route navigation, or a meaningful state change. Do not limit to the "happy path" or "main features" — enumerate every workflow you can trace, including:

- Authentication flows (login, logout, token refresh, SSO redirect, protected route enforcement)
- Every CRUD operation for every entity (list, create, edit, delete, detail view)
- Search and filter interactions that trigger HTTP calls or store updates
- File upload / download flows
- Navigation flows guarded by route loaders, protected route wrappers, or auth checks
- Modal / dialog flows that submit data
- Real-time / WebSocket subscription flows
- Error and retry flows (error boundary scope, query retry behaviour, fallback UI)
- Pagination, sorting, infinite scroll, cursor-based loading flows
- Permission / role-based conditional rendering flows
- Optimistic update flows (UI updates before server confirmation)
- Cache invalidation flows (TanStack Query `invalidateQueries`, SWR `mutate`)

For monorepos: enumerate workflows per app. Group by app, then number workflows within each app.

---

**Step 2 — Write one section per workflow.**

Use this exact structure for every workflow:

**Heading:** `## Workflow N — Name`

**Lead paragraph:** One or two sentences of plain English — what user action triggers this workflow, what the system does, and what the user sees when it completes.

**Mermaid sequence diagram** (hard constraints):
- `sequenceDiagram` syntax only — never `flowchart` or `graph`
- Declare all actors/participants at the top using `actor` for human roles and `participant` for systems, with short alias and readable label
- Include every participant that appears: user role, Component, Hook, HTTP Client, Backend API, State store, Router, Guards, ErrorBoundary
- Every HTTP call: verb + exact path + payload type in parentheses — read from actual hook/service source
- Every state operation: show setState, dispatch, store action, or signal update
- `alt`/`else` for conditional branches, `opt` for optional paths, `par` for concurrent operations
- Response arrows use `-->>` (dashed)
- Emit inside a fenced ` ```mermaid ` block

**"What happens:" bullet list:** Bold heading `**What happens:**`, 4-6 bullets, plain English business rules, no TypeScript syntax or hook internals, intelligible to a non-technical reader.

---

**Diagram actor conventions:**

| Actor label | When to use |
|---|---|
| `actor User` | The human interacting with the browser |
| `participant Component as <ComponentName>` | The React component that owns the JSX event handler (use actual component name) |
| `participant Hook as <useHookName>` | The custom hook that encapsulates data-fetching or state logic (use actual hook name) |
| `participant Query as TanStack Query / SWR` | The caching/fetching layer when TanStack Query or SWR is used |
| `participant Client as HTTP Client` | The fetch/axios layer that makes the network call |
| `participant API as Backend API` | The backend REST/GraphQL/WebSocket endpoint |
| `participant Store as useState` | Local component state via `useState` or `useReducer` |
| `participant Store as Redux Store` | Redux store (dispatch in, selector/useSelector out) |
| `participant Store as Zustand Store` | Zustand store (actions in, subscribed state out) |
| `participant Store as Context` | React Context value — when a context provider owns the state that re-renders consumers |
| `participant Router as React Router` | React Router — when `navigate()`, `<Navigate>`, loader, or `useNavigate` is part of the flow |
| `participant Guard as <ProtectedRouteName>` | Protected route wrapper component — when it conditionally redirects unauthenticated users |
| `participant Boundary as ErrorBoundary` | Error boundary — when a render error or thrown promise is caught and a fallback UI is shown |

Show only the actors that actually participate in a given workflow.

---

**State management — show the full update and re-render cycle:**

For `useState`/`useReducer`: show `setState(newValue)` on the arrow to Store, and `state value triggers re-render` on the return arrow.
For Redux Toolkit: show `dispatch(actionCreator({payload}))` and `useSelector(selector) emits updated state`.
For Zustand: show `store.actionName(payload)` and `useStore(selector) re-renders with updated slice`.
For TanStack Query: show `useMutation`/`useQuery` status transitions and `queryClient.invalidateQueries([key])` for cache invalidation.
For optimistic updates: show both phases — immediate state update, then server confirmation or rollback.

---

**Custom Hooks Inventory — add this section after all workflow sections:**

### Custom Hooks Inventory

For every custom hook found in `hooks/`, `src/hooks/`, or co-located with components:

| Hook | Encapsulates | Returns | Used By |
|---|---|---|---|
| `useRates` | Fetches rates list via TanStack Query | `{ data, isLoading, isError, refetch }` | `RatesListPage`, `RatesSummaryWidget` |

If a hook exists but is never imported by any component or other hook, note it as `> ⚠ Orphaned hook — defined but not traced to any workflow`.

---

**Coverage requirement:**

The Table of Contents at the top of the document must list every workflow. After writing all sections, verify: does every route in the router configuration have at least one corresponding workflow? Does every hook or service function that calls `fetch`, `axios`, `useQuery`, `useMutation`, or `useSWR` appear in at least one sequence diagram? If any are missing, add stub sections with `> ⚠ Partial trace — review manually`.

---

**Hard rules:**

1. Table of Contents is ALWAYS the first thing in the file.
2. Never group unrelated flows into one workflow for convenience.
3. Never invent HTTP paths, API endpoints, or state management details — read from actual source files.
4. `sequenceDiagram` only.
5. Every HTTP verb + path must match an actual fetch/axios/query call in source.
6. Do not produce a Component Composition Pattern catalogue or Data Fetching Pattern description.
7. Do not produce call-chain traces (module.function → module.function).

Read actual source files — component function bodies, custom hook implementations, Redux slice files, Zustand store definitions, TanStack Query definitions, React Router configuration, and axios/fetch wrapper modules. Do not infer workflows from filenames or route paths alone.

---

## File 3 Prompt — architecture-reference.md

You are documenting reference data for a React application.

**npm Package Versions** — read package.json. Extract every dependency
and devDependency with exact version string, grouped by category
(framework, routing, state, UI, testing, build, utilities).

**Build Configuration** — read vite.config, webpack.config, or next.config.
Document: aliases defined, environment variable handling, proxy rules,
bundle splitting strategy, output targets.

**Environment Variables** — list every .env file and the variables defined
(.env, .env.development, .env.production, etc.).

**Test Configuration** — jest.config or vitest.config: test setup files,
coverage reporters, coverage thresholds, module name mappers.

**CI/CD Pipelines** — for each pipeline file: name, trigger, purpose.

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
