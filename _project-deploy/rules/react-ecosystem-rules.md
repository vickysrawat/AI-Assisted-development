---
paths: ["**/*.tsx", "**/*.jsx", "**/components/**", "**/hooks/**"]
detect:
  dependencies: ["react"]
  excludeIfDependencies: ["next", "@remix-run/react"]
---

# React Ecosystem Rules — Applied to all React projects

Covers React + state management (RTK / Zustand / TanStack Query) + unit testing
(Vitest + Testing Library) + UI libraries (MUI / shadcn / Radix UI).

## TypeScript
- Strict mode enabled — no implicit `any`, strict null checks, strict function types
- Props typed with an explicit `interface` — never inline object type or `any`
- Event handler types from React: `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent`, etc.
- `React.FC` avoided — prefer plain function with explicit return type

## File Naming
- Components: `PascalCase.tsx` (e.g. `UserFilterPanel.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g. `useUserFilter.ts`)
- Test files co-located: `UserFilterPanel.test.tsx`

## Component Rules
- Functional components only — no class components
- One component per file — no multi-export component files
- Props destructured in the function signature, not inside the body
- Never mutate props or state directly — always derive new values
- Memoize with `React.memo` only when a profiler confirms unnecessary re-renders

## Hooks Rules
- Custom hooks must start with `use` — enforced by lint
- Never call hooks conditionally or inside loops
- `useEffect` dependency arrays must be exhaustive — never suppress the lint rule
- Prefer `useReducer` over multiple related `useState` calls when state transitions are complex
- Data fetching belongs in TanStack Query, not `useEffect`

## JSX Rules
- No inline styles — use CSS Modules, Tailwind, or a styled component
- Prefer fragments (`<>...</>`) over wrapping `<div>` when no DOM element is needed
- Conditional rendering: use `&&` for single branch, ternary for two branches, extracted component for complex logic
- Lists always have a stable, unique `:key` — never use array index as key for dynamic lists

## State Management
- **Server state** (data from an API): TanStack Query (`useQuery`, `useMutation`) — not `useEffect + useState`
- **Complex client state** (multi-slice, normalized): Redux Toolkit — slice per feature, RTK Query for API cache
- **Simple shared client state** (UI state, user preferences): Zustand — one store file per domain slice
- **Local component state**: `useState` / `useReducer` — do not lift to global store unless needed by siblings

## TanStack Query
- Query keys are arrays — always include all variables the query depends on: `['users', userId, filters]`
- Mutations call `queryClient.invalidateQueries` on success — never manually update cache unless optimistic update is intentional
- Handle `isLoading`, `isError`, `data` states explicitly in every consumer component

## Redux Toolkit (if used)
- One slice per feature in `features/` — no monolithic single reducer
- Actions created with `createAction` or `createSlice` — never plain object literals
- Async logic in `createAsyncThunk` or RTK Query endpoints — never in reducers

## Zustand (if used)
- Define store with `create<StateType>()((set, get) => ({ ... }))`
- One file per store — no single global catch-all store
- Actions are functions inside the store definition — not dispatched separately

## Testing (Vitest + Testing Library)
- Queries in priority order: `getByRole` → `getByLabelText` → `getByText` → `getByTestId`
- Use `userEvent` (from `@testing-library/user-event`) — not `fireEvent` for user interactions
- Await async UI changes with `await screen.findByX` — never `waitFor(() => expect(...))`
- Never test implementation details (state shape, internal method calls)
- Test file covers: happy path, empty state, error state, loading state, and permission boundary from ICEA

## UI Components (MUI / shadcn / Radix)
- MUI: use `sx` prop for one-off overrides; `styled()` for reusable variants — never override `.MuiXxx-root` CSS globally
- shadcn: customise inside `components/ui/` — never edit the shadcn source files directly; re-generate instead
- Radix: always pass `asChild` when composing a Radix primitive with a custom element

## Accessibility
- All interactive elements keyboard-reachable
- ARIA labels on icon-only buttons: `aria-label="Close"`
- Focus returns to trigger element on modal/dialog close
- Dynamic content announced with `aria-live="polite"` or `role="status"`

## Out of bounds
- No class components
- No `React.FC` with implicit children — use `React.PropsWithChildren<Props>` or explicit `children: React.ReactNode`
- No direct DOM manipulation via `document.querySelector` — use refs
- No data fetching in `useEffect` — use TanStack Query
- No array index as list key for dynamic data
