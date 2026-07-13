---
paths: ["**/*.vue", "**/composables/**", "**/stores/**"]
detect:
  dependencies: ["vue"]
  excludeIfDependencies: ["nuxt"]
---

# Vue Ecosystem Rules — Applied to all Vue 3 projects

Covers Vue 3 + Pinia + Vitest + Testing Library. Does not apply to Nuxt projects
(see `nuxt-ecosystem-rules.md`).

## TypeScript
- Strict mode enabled — all props, emits, and composable return types explicitly typed
- `defineProps<Props>()` and `defineEmits<Emits>()` — never runtime object declarations
- No implicit `any` — prop types must be specific interfaces, not `object` or `{}`

## File Naming
- Components: `PascalCase.vue` (e.g. `UserFilterPanel.vue`)
- Composables: `camelCase.ts` prefixed with `use` (e.g. `useUserFilter.ts`)
- Stores: `camelCase.ts` in `stores/` (e.g. `userStore.ts`)
- Test files co-located: `UserFilterPanel.spec.ts`

## Component Rules
- `<script setup lang="ts">` on every component — no Options API, no `defineComponent` wrapper
- `defineProps` and `defineEmits` at the top of `<script setup>`, before any logic
- One component per file
- Never mutate props — emit events upward; use `v-model` with `defineModel()` for two-way binding
- `<template>` has a single root element unless using fragments intentionally

## Composables
- All composables prefixed with `use` — e.g. `useUserFilter`, `useAuth`
- Composables return reactive refs/computeds — never plain values
- Stateless composables (pure utility) are clearly distinguished from stateful ones
- Side effects (watchers, event listeners) cleaned up in `onUnmounted`

## Template Rules
- Use `:prop` shorthand for v-bind and `@event` for v-on — never verbose `v-bind:` / `v-on:`
- `v-for` always paired with `:key` — unique stable ID, never array index for dynamic lists
- No business logic in templates beyond simple ternaries — extract to computed properties
- `v-if` and `v-for` never on the same element — wrap with `<template>` if needed

## Pinia
- Define stores with Composition API style: `defineStore('name', () => { ... })`
- State as `ref()` / `reactive()`, getters as `computed()`, actions as plain functions
- One store per domain concern — no monolithic catch-all store
- Never mutate state outside the store's own actions
- `storeToRefs()` when destructuring store in components to preserve reactivity

## Testing (Vitest + @testing-library/vue)
- Queries in priority order: `getByRole` → `getByLabelText` → `getByText` → `getByTestId`
- Use `userEvent` — not `fireEvent` for user interactions
- Await async UI with `await screen.findByX` — never `nextTick()` chains manually
- Always mount with required plugins (Pinia, Router) — never mock them out entirely
- Test covers: happy path, empty state, error state, loading state, and ICEA permission boundary

## Accessibility
- All interactive elements keyboard-reachable
- ARIA labels on icon-only buttons
- Focus management on dialog open/close
- Dynamic content announced with `aria-live="polite"`

## Out of bounds
- No Options API in new code — Composition API only
- No `this` inside `<script setup>`
- No direct prop mutation — emit events or use `defineModel()`
- No `v-if` and `v-for` on the same element
- No array index as `:key` for dynamic lists
