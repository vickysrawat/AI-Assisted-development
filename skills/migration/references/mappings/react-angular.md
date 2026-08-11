# Parity Mapping: React → Angular

_Unidirectional — React as source, Angular as target (FRONTEND track)._

---

## GREEN — Migrates Cleanly

| React | Angular equivalent | Confidence |
|---|---|---|
| React Router `<Route path="..." element={<C />} />` | `@angular/router` routes array + `loadComponent` lazy loading | Verified |
| Axios / Fetch | Angular `HttpClient` (injected) | Verified |
| CSS Modules (`styles.module.css`) | Component-scoped `styleUrls` | Verified |
| `CRA` / `Vite` bundler | Angular CLI (Webpack/esbuild) | Verified |
| Jest `test()` + `expect()` | Vitest or Jest (Angular Jest preset) | Verified |
| Cypress / Playwright E2E | Playwright (preferred) — same API | Verified |
| Props down (`<Child name={name} />`) | `@Input() name: string` | Verified |
| Callback up (`onSave={handleSave}`) | `@Output() save = new EventEmitter<void>()` | Verified |
| `children` prop | `<ng-content>` projection | Verified |
| `React.lazy` + `Suspense` | `loadComponent` in routes (built-in lazy loading) | Verified |
| `useNavigate()` | `inject(Router).navigate(['/path'])` | Verified |

---

## YELLOW — Needs Rework

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `useState(val)` | `signal(val)` — same concept, different API. `setCount(n)` → `count.set(n)` or `count.update(fn)`. | S | LOW |
| `useMemo(() => expr, deps)` | `computed(() => expr)` — no dependency array needed; auto-tracks. | S | LOW |
| `useEffect(() => fn, deps)` | `effect(() => fn)` — auto-tracks dependencies; no array. Cleanup: return from effect function. | M | MEDIUM — different cleanup timing |
| `useCallback(fn, deps)` | Not needed — DI provides stable service references. Extract logic to service method instead. | S | LOW |
| `useRef(null)` DOM ref | `@ViewChild('myRef') el!: ElementRef` | S | LOW |
| React Context (simple global) | Injectable Angular Service + `signal()` | M | LOW |
| JSX template (`onClick`, `onChange`, `className`) | Angular template: `(click)="fn()"`, `(ngModelChange)="fn($event)"`, `class="..."` | M | MEDIUM — syntax is entirely different |
| React Testing Library | `@testing-library/angular` — same `getByRole` / `findBy*` query API | M | MEDIUM — TestBed requires `detectChanges()` |
| `React.memo` | `ChangeDetectionStrategy.OnPush` | S | LOW |
| CSS-in-JS (Styled Components) | Angular `styleUrls` or inline `styles` — component-scoped by default | M | LOW |
| `useParams()` | `inject(ActivatedRoute).snapshot.params['id']` or `params$` Observable | S | LOW |

---

## RED — Will Break

**`useEffect` with complex dependency arrays → RxJS / Signals**
- What breaks: `useEffect` with deps array is React-specific. Angular has no equivalent concept. The closest mapping depends on the use case:
  - Data fetching on param change: `rxResource({ request: () => this.id(), loader: (r) => this.http.get('/api/' + r.request) })`
  - Timer / interval: `interval(1000).pipe(takeUntilDestroyed())`
  - Event subscription: Observable + `takeUntilDestroyed()`
  - Simple derived value: `computed()`
- Behavioral risk: HIGH — requires case-by-case analysis; no mechanical translation.
- Recommendation: Inventory every `useEffect` in the source codebase by category before migration. Assign each to a target Angular pattern.

**Redux / RTK with complex middleware (thunk, saga) → NgRx**
- What breaks: Redux Toolkit's `createAsyncThunk` and Redux-Saga have no Angular equivalent without NgRx Effects.
- Options:
  - (A) NgRx Store + Effects: full Redux parity, ~500 lines boilerplate per feature, requires team training.
  - (B) Services + Signals: sufficient for 80% of apps, far less code, no boilerplate.
  - (C) NgRx Component Store: per-feature scoped state, RxJS-native.
- Decision rule: use NgRx only if the app requires time-travel debugging, cross-feature event coordination, or the team already knows Redux. Start with Services + Signals.
- Behavioral risk: MEDIUM for state logic; HIGH if sagas encode complex async orchestration.

**React-specific patterns with no Angular equivalent**
| React pattern | Status in Angular |
|---|---|
| Higher-Order Components (HOC) | Use structural directives or `ng-content` instead |
| Render props | Use content projection (`ng-content`) or template refs (`TemplateRef`) |
| `React.createPortal` | Use Angular CDK `Overlay` service |
| Compound components | `ng-content` + `@ContentChildren` |
| Controlled / uncontrolled inputs | Angular Reactive Forms (controlled) — no uncontrolled form concept |

---

## State Management Decision for Migrated App

| Source (React) | Target (Angular) | Rationale |
|---|---|---|
| `useState` + props | `signal()` + `@Input()` | Direct equivalent, no change in complexity |
| Context API (light) | Service + `signal()` | Simpler than Context; hierarchical injection scope |
| Zustand / Jotai | Service + `signal()` | Services are singletons by default — same as Zustand global store |
| Redux Toolkit (medium) | NgRx Component Store or Services + Signals | Evaluate complexity first; NgRx only if DevTools needed |
| Redux + Saga (complex) | NgRx Store + Effects | Only reasonable mapping for complex async orchestration |
| TanStack Query / SWR | `rxResource()` (Angular 19+) | Built-in Angular server state management |

---

## Key Testing Difference

React Testing Library in React vs. Angular:
```typescript
// React Testing Library (React)
const { getByRole } = render(<UserCard userId="1" />);
expect(getByRole('heading')).toHaveTextContent('Alice');

// @testing-library/angular (Angular)
const { getByRole } = await render(UserCardComponent, {
  componentProperties: { userId: '1' }
});
expect(getByRole('heading')).toHaveTextContent('Alice');
```

The query API (`getByRole`, `findBy*`, `queryBy*`) is identical. The setup wraps TestBed.
`detectChanges()` is called automatically by `@testing-library/angular` — unlike raw TestBed where it must be manual.

Karma is deprecated. Use `ng test` with `@angular-builders/jest` or `vitest` preset.
