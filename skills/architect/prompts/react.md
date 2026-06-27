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
