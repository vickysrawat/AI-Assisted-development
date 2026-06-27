---
paths: ["**/*.ts", "**/*.html", "**/components/**", "**/services/**"]
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
