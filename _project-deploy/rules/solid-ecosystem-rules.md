---
paths: ["**/*.tsx", "**/components/**", "**/routes/**"]
detect:
  dependencies: ["solid-js"]
---

# SolidJS Ecosystem Rules — Applied to all SolidJS projects

Covers SolidJS with fine-grained reactivity, JSX, and SolidStart (if used).

## TypeScript
- Strict mode enabled — no implicit `any`, strict null checks
- Props typed with an explicit interface passed to `Component<Props>`
- Signal types inferred where possible; annotate when inference is insufficient: `createSignal<User | null>(null)`

## File Naming
- Components: `PascalCase.tsx` (e.g. `UserFilterPanel.tsx`)
- Utilities: `camelCase.ts`
- Test files co-located: `UserFilterPanel.test.tsx`

## Component Rules
- Functional components only — Solid has no class components
- Components run once — never write code that assumes a component function re-runs (unlike React)
- Props accessed inside JSX or effects — never destructure props at the top level (breaks reactivity)
- Use `splitProps` to separate owned props from forwarded props: `const [local, rest] = splitProps(props, ['class'])`

## Signals and Stores
- `createSignal` for primitive reactive values
- `createStore` for nested/object reactive state — use `produce` or `reconcile` for deep updates
- `createMemo` for derived values that are expensive to recompute — never compute in JSX directly if costly
- `createEffect` for side effects only — never use to derive values (use `createMemo`)
- `on` helper for explicit dependency tracking in effects when reactive reads would be too broad

## JSX Rules
- Use `<Show when={condition}>` instead of `{condition && <Jsx>}` — avoids falsy-value rendering bugs
- Use `<For each={list}>` instead of `{list.map(...)}` — Fine-grained reconciliation, no key needed
- Use `<Switch>/<Match>` for multi-branch conditions — not nested ternaries
- No key prop needed in `<For>` — Solid reconciles by position via `<For>`

## SolidStart (if used)
- Route files in `routes/` following file-based routing convention
- `createRouteData` for server-side data loading — not `createResource` with manual fetch in components
- Form actions with `createRouteAction` — validate input server-side before processing

## Testing (Vitest + @solidjs/testing-library)
- Wrap renders in `render()` from `@solidjs/testing-library`
- Use `screen.getByRole` / `screen.getByLabelText` — not raw DOM queries
- `userEvent` for interactions — not `fireEvent`
- Remember components run once — test the reactive output, not the function call count
- Test covers: initial render, reactive updates, error state, and ICEA permission boundary

## Out of bounds
- No destructuring of `props` at the component top level — use `props.name` inside JSX/effects
- No `{list.map(...)}` for reactive lists — use `<For>`
- No `{condition && <Jsx>}` — use `<Show>`
- No `createEffect` for computing derived values — use `createMemo`
- No assumptions that component functions re-run (Solid ≠ React rendering model)
