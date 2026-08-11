# Stack Reference: React

_For migration skills — loaded when source stack token = `react`_

---

## Core Patterns

**Component Model**
- Functional components with hooks (class components are legacy).
- JSX: HTML-like syntax compiled to `React.createElement()`. Event handlers use camelCase: `onClick`, `onChange`.
- Props are immutable inputs; state is local mutable data.
- Composition over inheritance — prefer component composition and render props over HOC chains.

**State Management (Hooks)**
```javascript
const [count, setCount] = useState(0);                     // local state
const memoized = useMemo(() => expensive(count), [count]); // memoized value
const cb = useCallback(() => doSomething(count), [count]); // stable function ref
const ref = useRef(null);                                   // DOM ref or mutable value
```

**Side Effects**
```javascript
useEffect(() => {
  const sub = fetchData(id).subscribe(setData);
  return () => sub.unsubscribe(); // cleanup on unmount / dep change
}, [id]); // dependency array — re-runs when id changes
```
⚠ Missing dependencies in the array cause stale closure bugs. Empty `[]` runs once on mount.

**Data Fetching**
- TanStack Query (React Query): `useQuery`, `useMutation` — server state management with caching, refetching, loading states.
- SWR: lightweight alternative.
- Raw `fetch` / `axios` in `useEffect` with cleanup (fragile — prefer TanStack Query).

**Context API (simple global state)**
```javascript
const ThemeContext = createContext(null);
// Provider wraps tree; useContext(ThemeContext) consumes
```
Limitation: any context value change re-renders ALL consumers. Use with care for high-frequency updates.

**State Management Libraries**
- **Redux Toolkit** (RTK): `createSlice`, `createAsyncThunk`, Redux DevTools. Full ecosystem for complex apps.
- **Zustand**: lightweight, no boilerplate. `create((set) => ({ count: 0, inc: () => set(s => ({ count: s.count+1 })) }))`.
- **Jotai**: atomic state. `atom(initialValue)` — composable, fine-grained.
- **Recoil**: Facebook's atom-based state (less maintained in 2025).

**Routing**
- React Router v6: `<Routes>`, `<Route path="..." element={<Component />} />`, `useNavigate()`, `useParams()`.
- Nested routes, lazy loading: `const Component = lazy(() => import('./Component'))`.

**Styling**
- CSS Modules: `import styles from './Button.module.css'` — scoped by default.
- Styled Components / Emotion: CSS-in-JS.
- Tailwind CSS: utility-first.

**Testing**
- React Testing Library: `render()`, `screen.getByRole()`, `userEvent.click()`. Tests behavior, not implementation.
- Jest: test runner + assertion library.
- Vitest: faster alternative (ESM-native).
- MSW (Mock Service Worker): intercept HTTP calls in tests without mocking axios/fetch.

---

## Anti-Patterns

Enforced anti-patterns + coding conventions for this stack live in `rules/react-ecosystem-rules.md`
(authoritative — `## Anti-patterns` / `## Out of bounds`). This reference adds only the
migration-specific context below.

---

## React → Angular Conceptual Mapping Summary

| React | Angular |
|---|---|
| `useState(val)` | `signal(val)` |
| `useMemo(() => ..., deps)` | `computed(() => ...)` |
| `useEffect(() => ..., deps)` | `effect(() => ...)` — auto-tracks deps, no array |
| `useCallback(fn, deps)` | Not needed — DI handles stable references |
| `useRef` | `@ViewChild()` |
| `useContext(Ctx)` | `inject(Service)` |
| `React.memo` | `ChangeDetectionStrategy.OnPush` |
| Redux / RTK | NgRx Store + Effects |
| Zustand / simple state | Angular Service + `signal()` |
| TanStack Query | `rxResource()` (Angular 19+) |
| React Router | `@angular/router` |
| CSS Modules | Component-scoped `styleUrls` |
| React Testing Library | `@testing-library/angular` |
| JSX `onClick={fn}` | Angular template `(click)="fn()"` |
| Props down | `@Input()` |
| Callback up | `@Output() EventEmitter` |
| `children` | `<ng-content>` |
