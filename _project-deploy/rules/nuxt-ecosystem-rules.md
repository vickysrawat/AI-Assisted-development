---
paths: ["**/*.vue", "**/pages/**", "**/server/**", "**/composables/**"]
detect:
  dependencies: ["nuxt"]
---

# Nuxt Ecosystem Rules — Applied to all Nuxt 3 projects

Covers Nuxt 3 with Vue 3 Composition API, Pinia, auto-imports, and server routes.
Vue rules are self-contained here — `vue-ecosystem-rules.md` is NOT deployed alongside.

## TypeScript
- Strict mode enabled — all props, composable returns, and server route handlers explicitly typed
- `defineProps<Props>()` and `defineEmits<Emits>()` — never runtime object declarations
- `nuxt.config.ts` — always `.ts`, not `.js`

## File-Based Routing
- Pages in `pages/` — file name maps to route: `pages/users/[id].vue` → `/users/:id`
- Layouts in `layouts/` — set per page with `definePageMeta({ layout: 'name' })`
- Middleware in `middleware/` — named middleware declared in `definePageMeta({ middleware: ['auth'] })`
- Never manipulate routes manually outside `pages/`, `layouts/`, `middleware/`

## Auto-Imports
- Composables in `composables/` are auto-imported — no explicit `import` needed in `.vue` files
- Utils in `utils/` are auto-imported — use for pure helper functions only
- Components in `components/` are auto-imported by PascalCase name
- Never rely on auto-imports in plain `.ts` files outside these directories — import explicitly

## Data Fetching
- `useFetch` or `useAsyncData` for SSR data — not raw `fetch()` in `onMounted` (breaks SSR)
- `server: false` in `useFetch` options only for client-only data (user-specific, post-hydration)
- `useNuxtData` for sharing cached data between pages — not prop drilling
- `$fetch` (auto-imported H3 client) for programmatic calls within server routes

## Server Routes
- API handlers in `server/api/` — file convention: `server/api/users/[id].get.ts`
- Use method-suffixed file names (`.get.ts`, `.post.ts`, `.delete.ts`) for clarity
- Validate request body/params with Zod before any logic
- Return typed objects — let Nitro serialise them; never `JSON.stringify` manually
- Auth/session checked at the top of every protected handler via `useServerSession` or custom `defineEventHandler` middleware

## Pinia
- `defineStore('name', () => { ... })` Composition API style — not Options API
- `storeToRefs()` when destructuring in components
- One store per domain concern in `stores/`
- Never mutate store state outside actions

## SEO / Meta
- `useSeoMeta` or `useHead` in every page component — never raw `<head>` manipulation
- `definePageMeta` for static page-level config (layout, middleware, validation)
- OG image and description set per page, not only globally in `nuxt.config.ts`

## Testing (Vitest + @nuxt/test-utils)
- `mountSuspended` for async component tests (handles Nuxt's async setup)
- `useNuxtApp` mocked via `mockNuxtImport` — not manual vi.mock
- Server route handlers tested as plain async functions with a mock H3 event
- Test covers: happy path, error state, loading state, and ICEA permission boundary

## Accessibility
- All interactive elements keyboard-reachable
- ARIA labels on icon-only buttons
- `aria-live` for dynamic content

## Out of bounds
- No raw `fetch()` in `onMounted` for SSR-critical data — use `useFetch` / `useAsyncData`
- No Options API in new code — Composition API only
- No routes registered outside the `pages/` convention
- No `window.*` access in server-side code — guard with `process.client` or `import.meta.client`
