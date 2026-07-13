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

You are documenting user and data flows in a React application.
Read page components, hooks, and service files.

For each primary user journey:
- Entry route → page component → data-fetching hook → API call sequence
- State changes triggered (store updates, cache invalidations, optimistic updates)
- Auth guard or loader that runs before rendering
- Error boundary scope and error handling path

**Component Composition Patterns** — identify how components are composed:
render props, compound components, HOCs, custom hooks. List representative examples.

**Custom Hooks Inventory** — list every custom hook in hooks/ or equivalent,
what it encapsulates, what it returns, and which components use it.

**Data Fetching Pattern** — describe the pattern used for fetching:
useEffect + useState, TanStack Query, SWR, server components, loaders.
Show a representative example with caching and error handling.

Read actual component and hook files.
Mark incomplete traces: `> ⚠ Partial trace — review manually`

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
