---
paths: ["**/*.svelte", "**/routes/**", "**/lib/**"]
detect:
  dependencies: ["svelte"]
---

# Svelte / SvelteKit Ecosystem Rules — Applied to all Svelte projects

Covers Svelte 5 (runes) and SvelteKit. Svelte 4 patterns noted where they differ.

## TypeScript
- `<script lang="ts">` on every component and module
- Props typed with `$props()` rune (Svelte 5) or `export let` with explicit type (Svelte 4)
- No implicit `any` — all event handler types from `svelte/elements`

## File Naming
- Components: `PascalCase.svelte` (e.g. `UserFilterPanel.svelte`)
- Utilities/stores: `camelCase.ts` in `lib/`
- SvelteKit route files follow the convention: `+page.svelte`, `+layout.svelte`, `+page.server.ts`, `+server.ts`
- Test files co-located: `UserFilterPanel.spec.ts`

## Component Rules
- One component per `.svelte` file
- Svelte 5: use runes — `$state()`, `$derived()`, `$effect()`, `$props()`; avoid legacy reactive statements
- Svelte 4: use `$:` reactive declarations sparingly; prefer explicit function calls for complex logic
- Never mutate parent-passed props — use events or two-way binding with `bind:`
- Avoid deeply nested `{#if}` blocks — extract sub-components

## Reactivity
- Svelte 5: `$state()` for mutable state, `$derived()` for computed values (not `$state` + `$effect`)
- Svelte 5: `$effect()` for side effects only — never use to compute derived values
- Svelte 4: `$: derivedValue = ...` for computed; `$: { sideEffect() }` for effects only when unavoidable
- Store subscriptions auto-unsubscribed with the `$store` syntax — never manual `.subscribe()` without cleanup

## SvelteKit Routing
- `+page.server.ts` for data loading (runs server-side only) — not `+page.ts` for sensitive data
- `+page.ts` for universal load functions (client + server) — only for public, non-sensitive data
- `+server.ts` for API route handlers — return `json()`, `text()`, or `error()` from `@sveltejs/kit`
- `load` functions return typed objects — define the `PageData` / `LayoutData` type via `PageLoad`
- Redirect with `redirect(303, '/path')` from `@sveltejs/kit` in load/action — never `window.location`

## Form Actions
- Use SvelteKit form actions (`+page.server.ts` `actions` export) for mutations — not custom API calls from the client
- Always validate input in the action before processing — return `fail(400, { errors })` on invalid input
- Redirect after successful mutation (`redirect(303, ...)`) to prevent double-submit

## Testing (Vitest + @testing-library/svelte)
- Mount components with `render(Component, { props })` from `@testing-library/svelte`
- Use `screen.getByRole` / `screen.getByLabelText` — not raw DOM queries
- `await userEvent.click(...)` for interactions — not `fireEvent`
- Test load functions and actions as plain async functions — no need to mount the component
- Test covers: happy path, error state, empty state, and ICEA permission boundary

## Accessibility
- All interactive elements keyboard-reachable
- ARIA labels on icon-only buttons
- Focus management on modal/drawer open/close
- Dynamic content with `aria-live="polite"`

## Out of bounds
- No class-based components
- No Svelte 4 `$:` reactive statements in new Svelte 5 code
- No `window.location` navigation — use `goto()` from `$app/navigation`
- No raw `fetch` in `+page.svelte` for server data — use load functions
- No array index as `:key` equivalent in `{#each}` for dynamic lists — use `(item.id)`
