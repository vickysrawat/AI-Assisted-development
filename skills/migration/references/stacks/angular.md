# Stack Reference: Angular

_For migration skills — loaded when source or target stack token = `angular`_

---

## Core Patterns (Angular 17+, Signals era)

**Signals — modern local state (replaces RxJS for most component state)**
```typescript
count = signal(0);                           // writable signal
double = computed(() => this.count() * 2);  // derived — auto-tracks deps
effect(() => console.log(this.count()));    // side effect — auto-tracks deps

// Update
this.count.set(5);
this.count.update(n => n + 1);
```
`effect()` auto-detects what it reads — no dependency array needed (unlike `useEffect`).

**Standalone Components (default v17+)**
```typescript
@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, RouterModule],  // explicit imports
  template: `...`,
  styleUrls: ['./user.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush  // v22+ default
})
export class UserComponent { ... }
```
Never create `NgModules` for new code. Use standalone components + `importProvidersFrom` for providers.

**Dependency Injection**
```typescript
// Modern (v14+): function-based inject()
private userService = inject(UserService);

// Legacy: constructor injection (still valid)
constructor(private userService: UserService) {}
```
`inject()` is the Angular team's preferred pattern. Services provided at root (`providedIn: 'root'`) are singletons.

**Template Syntax (v17+ control flow)**
```html
@if (user()) { <p>{{ user()!.name }}</p> }
@for (item of items(); track item.id) { <li>{{ item.name }}</li> }
@switch (status()) { @case ('active') { ... } }
```
Prefer `@if` / `@for` / `@switch` over `*ngIf` / `*ngFor` for new code (better performance, no import needed).

**Data Fetching**
```typescript
// rxResource (Angular 19+) — preferred
data = rxResource({ loader: () => this.http.get<User[]>('/api/users') });

// toSignal — wraps Observable as Signal
users = toSignal(this.http.get<User[]>('/api/users'), { initialValue: [] });

// async pipe in templates — auto-subscribes and auto-unsubscribes
// {{ users$ | async }}
```

**RxJS — subscription cleanup (CRITICAL)**
```typescript
// Modern: takeUntilDestroyed() in injection context
this.service.getData()
  .pipe(takeUntilDestroyed())
  .subscribe(d => this.data.set(d));

// Alternative: toSignal() auto-manages subscription
this.data = toSignal(this.service.getData());
```
NEVER subscribe without cleanup. Memory leaks are the #1 Angular bug for React developers.

**State Management Decision**
| Scenario | Pattern |
|---|---|
| Local component state | `signal()` |
| Shared state across components | Injectable service + `signal()` |
| Complex async side effects, DevTools | NgRx Store + Effects |
| Per-feature state with RxJS selectors | NgRx Component Store |
| Server state (data fetching) | `rxResource()` / `HttpClient` + Signals |

**NgRx** adds ~500 lines of boilerplate per feature. Use only when: time-travel debugging needed, cross-feature event coordination needed, or team already knows Redux.

**HTTP**
```typescript
// HttpClient — injected, returns Observable
this.http.get<User[]>('/api/users')
  .pipe(catchError(err => throwError(() => err)))
  .subscribe(...)

// HttpClient interceptors for auth headers, error handling
```

**Routing**
```typescript
const routes: Routes = [
  { path: 'users', loadComponent: () => import('./users.component').then(m => m.UsersComponent) },
  { path: 'admin', canActivate: [authGuard], loadChildren: () => import('./admin/routes') }
];
```
Lazy loading is built-in. `canActivate` functional guard (v15+): `const authGuard = () => inject(AuthService).isLoggedIn()`.

**Testing**
```typescript
// @testing-library/angular — preferred for behavior tests
const { getByRole } = render(UserComponent, { componentProperties: { userId: '1' } });
await userEvent.click(getByRole('button', { name: 'Save' }));
expect(getByRole('status')).toHaveTextContent('Saved');

// TestBed — lower level, more setup
TestBed.configureTestingModule({ imports: [UserComponent] });
const fixture = TestBed.createComponent(UserComponent);
fixture.detectChanges(); // required!
```

---

## Anti-Patterns

Enforced anti-patterns + coding conventions for this stack live in `rules/angular-rules.md`
(authoritative — `## Anti-patterns` + `## Change detection (OnPush)`). This reference adds only the
migration-specific context below.

---

## Key RxJS Operators for Migration

| Scenario | Operator |
|---|---|
| Search typeahead (cancel previous) | `debounceTime(300)` + `distinctUntilChanged()` + `switchMap` |
| Sequential operations (order matters) | `concatMap` |
| Parallel operations | `forkJoin` or `combineLatest` |
| Fire-and-forget (ignore new until current done) | `exhaustMap` |
| Retry on error | `retry(3)` or `retryWhen` |
| Transform each value | `map` |
| Filter values | `filter` |
| Combine multiple streams | `merge`, `combineLatest`, `zip` |
| Side effect without transforming | `tap` |

---

## Change Detection (OnPush) Rules

With `ChangeDetectionStrategy.OnPush`, Angular re-checks the component ONLY when:
1. A bound `@Input()` reference changes (not mutation — must be new object reference).
2. An event originates inside the component (`(click)`, etc.).
3. A Signal in the template emits.
4. An Observable bound via `async` pipe emits.
5. `markForCheck()` is called manually.

**Immutability requirement:** mutating `this.user.name = 'Alice'` will NOT trigger re-render with OnPush. Must replace: `this.user = { ...this.user, name: 'Alice' }` or use `signal()`.

---

## Key Gotchas for Inbound Migration (React → Angular)

1. **No dependency array in `effect()`** — `effect()` auto-detects what it reads. Adding a fake array is an error.
2. **`detectChanges()` required in TestBed tests** — forgetting this makes tests pass/fail randomly.
3. **`[property]="value"` vs `property="literal"`** — square brackets bind a variable; without brackets, a string literal is passed. `<p title="name">` sets the string "name"; `<p [title]="name">` binds the variable.
4. **`inject()` must be called in injection context** — inside a constructor, field initializer, or `runInInjectionContext()`. Not inside methods called later.
5. **Karma deprecated** — use Vitest or Jest with the Angular Jest preset for new projects.
