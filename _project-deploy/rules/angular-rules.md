---
paths: ["**/*.ts", "**/*.html", "**/components/**", "**/services/**"]
detect:
  dependencies: ["@angular/core"]
---

# Angular Rules — Applied to all Angular files

## TypeScript
- Strict mode enabled — no implicit `any`, strict null checks, strict function types

## File Naming
- Files: `kebab-case.component.ts` / `kebab-case.component.html` / `kebab-case.component.spec.ts`

## Component Rules
- Standalone: true on every component — no NgModule declarations
- changeDetection: ChangeDetectionStrategy.OnPush — mandatory
- No direct DOM manipulation — use Renderer2 or Angular CDK
- Inputs typed explicitly — never `any`
- Outputs typed with EventEmitter<T> — never untyped

## Template Rules
- All observables via async pipe — never subscribe in component, never manually unsubscribe
- Always handle three states: *ngIf with loading | error | content pattern
- No logic in templates beyond simple ternaries — complex logic goes in component methods
- Translate all user-facing strings via i18n pipe if project uses i18n

## Service Rules  
- All HTTP calls return typed Observable<T> — never `any`
- catchError on every HTTP call — transform to user-friendly error, never let it bubble raw
- Services provided in root unless feature-scoped

## Testing Rules
- TestBed.configureTestingModule for every spec
- Mock services with jasmine.createSpyObj
- One describe block per ICEA scenario — label them with the scenario name
- Test loading state, error state, and empty state explicitly

## Accessibility
- All interactive elements reachable by keyboard
- ARIA labels on all icon-only buttons
- Focus management on modal open/close
- Announce dynamic content changes with aria-live

## NgRx (if used)
- Feature store structure: actions → reducer → effects → selectors — strict separation, no blending
- Actions: typed with `createAction` + `props<T>()`; one action per intent, not one per HTTP method
- Reducers: pure functions only — no async, no side effects, no `Date.now()` calls
- Effects: all async work and side effects live here; always `catchError` returning an error action — never let an effect throw
- Selectors: use `createSelector` with memoisation; compose from smaller selectors — never read raw `state.slice` in components
- Never dispatch actions from within reducers or selectors

## Angular Material (if used)
- Import only the specific `MatXxxModule` needed — no catch-all `MaterialModule` barrel re-exports
- Apply theme via `mat.define-theme` mixins — never hardcode palette hex values
- Use `appearance="outline"` on all `mat-form-field` elements for visual consistency
- In tests, query by role or label — never by `.mat-*` CSS class names (implementation detail)

## Testing Library (@testing-library/angular)
- Prefer `screen.getByRole` / `screen.getByLabelText` over raw `.querySelector`
- Use `userEvent` over `fireEvent` for realistic user interaction simulation
- Await async renders with `await screen.findByX` — do not manually call `tick()` + `detectChanges()`
- Wrap component renders with the full module under test to surface injection errors early

## Change detection (OnPush)
With `OnPush`, a component re-checks only when: a bound `@Input()` reference changes (new reference, not
mutation), an event fires inside the component, a template Signal emits, an `async`-piped Observable
emits, or `markForCheck()` is called. Replace objects immutably (`this.user = { ...this.user, name }`) —
mutating `this.user.name` will not trigger a re-render.

## Anti-patterns (never generate)
- `BehaviorSubject` + manual `getValue()` for component state — bypasses reactivity, stale reads; use `signal()` (local) or a service + signal (shared)
- Mutating a signal value directly — no re-render; use `.set(newValue)` or `.update(fn)`
- HTTP call inside `effect()` — runs outside Angular scheduling; use `rxResource()` or a service method
- `providers: [MyService]` on sibling components — creates two instances; use `providedIn: 'root'` or provide at the correct shared scope
- Nesting `.subscribe()` calls — callback hell; use `switchMap`/`concatMap`/`mergeMap`
- `switchMap` for a form save — cancels an in-flight save on the next click; use `concatMap` (queue) or `exhaustMap` (ignore until done)
