# Parity Mapping: Angular → React

_Unidirectional — Angular as source, React as target (a `frontend` run). The reverse (React →
Angular) is `react-angular.md`. Derived from documented framework equivalences; validate against the
actual source before relying on YELLOW/RED items._

---

## GREEN — Migrates Cleanly

| Angular (source) | React (target) | Confidence |
|---|---|---|
| Standalone `@Component` | Function component | Verified |
| `@Input() x` | `props.x` | Verified |
| `@Output() y = new EventEmitter()` | callback prop `onY` | Verified |
| `signal(v)` | `useState(v)` | Verified |
| `computed(() => …)` | `useMemo(() => …, [deps])` | Verified (deps become explicit) |
| `inject(Service)` (stateless) | a hook / imported module | Verified |
| `@if` / `@for` / `@switch` | JSX `{cond && …}` / `.map(...)` / switch | Verified |
| Routes array + `loadComponent` | React Router routes + `lazy()` | Verified |
| Reactive Forms | `react-hook-form` (controlled) | Verified |
| `HttpClient` call | generated client + TanStack Query `useQuery`/`useMutation` | Verified |
| `@testing-library/angular` | React Testing Library (same query API) | Verified |
| `<ng-content>` | `children` prop | Verified |
| CSS component styles | CSS Modules / Tailwind | Verified |

---

## YELLOW — Needs Rework

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| RxJS Observables in components | Replace with hooks + TanStack Query; simple streams → state + effects. Complex operator pipelines need redesign. | L | MEDIUM |
| `OnPush` + immutability | React re-renders on state/prop change by default; use `React.memo`/`useMemo` where perf matters. Different model. | M | MEDIUM |
| Hierarchical DI (`providedIn`, scoped providers) | React Context has no hierarchical-injector or multi-provider-token semantics — restructure to context + props. | M | MEDIUM |
| NgRx Store + Effects | Redux Toolkit (`createSlice`/`createAsyncThunk`) or Zustand. Effects → RTK Query / thunks. | L | MEDIUM |
| Pipes | Plain functions / `useMemo`. | S | LOW |
| Structural directives (custom `*xyz`) | Components + render props / children functions. | M | MEDIUM |
| `HttpInterceptor` | fetch/axios interceptor (or TanStack Query's `queryFn` wrapper). | S | LOW |
| Route guards (`canActivate`) | React Router loaders + a guard wrapper / redirect in the loader. | M | MEDIUM |

---

## RED — Will Break / Paradigm Shift

**`effect()` / `computed()` auto-tracking → `useEffect`/`useMemo` MANUAL dependency arrays**
- What breaks: Angular signals auto-track their reads; React requires you to enumerate every
  dependency. Missing deps = stale-closure bugs; extra deps = over-firing. There is no auto-tracking.
- Fix: inventory every `effect()`/`computed()` and translate to an explicit dep array; lint with
  `react-hooks/exhaustive-deps`.
- Behavioral risk: HIGH — silent stale-value bugs.

**Zone.js change detection → React's explicit render model**
- What breaks: Angular re-renders via Zone.js patching async APIs; anything relying on that
  "automatic" detection (mutating objects in place, async side effects updating the view) won't
  re-render in React without a state update.
- Fix: drive all UI state through `useState`/store; never mutate in place.
- Behavioral risk: HIGH.

**Two-way binding `[(ngModel)]` → controlled components**
- What breaks: React has no two-way binding; every input needs `value` + `onChange`.
- Fix: controlled inputs or `react-hook-form`.
- Behavioral risk: MEDIUM.

**Complex RxJS async orchestration (combineLatest/switchMap chains)**
- What breaks: no direct React equivalent. Rebuild with TanStack Query (dependent/parallel queries)
  or explicit promise composition; some stream semantics (backpressure, replay) don't map.
- Behavioral risk: HIGH — case-by-case redesign; no mechanical translation.

---

## Shared Gotchas
1. **Dependency arrays are the #1 risk** — Angular's auto-tracking hides what React makes explicit.
2. **No DI container** — services become hooks/modules/context; scoped/multi-provider patterns don't port.
3. **Change detection model differs** — immutability + state updates drive React renders, not Zone.js.
4. **Templates → JSX** — entirely different syntax; `(click)`→`onClick`, `[x]`→`x={}`, `*ngFor`→`.map`.
