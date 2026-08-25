# Target Execution Profile: angular

STATUS: implemented
ROLE: frontend (a standalone `frontend` run — see SKILL.md two-track re-model)

_The concrete tokens for an Angular frontend target. A `frontend` run's target folder IS the Angular
app, so all paths are **root-relative** (no `web/` prefix) — same convention as `dotnet.md`. The run
consumes an API contract (from a backend run, or an existing backend) and calls the API only through
the generated client. SKILL.md Stages 3–6 reference the `{TOKEN}`s below._

---

## STACK
Angular 17+ (standalone components, signals) · TypeScript · Vite/esbuild

## SKELETON (workspace scaffolded in Step 3.3)
```
angular.json
package.json
src/app/app.config.ts     ← providers (router, HttpClient + interceptors)
src/app/app.routes.ts     ← route table (lazy loadComponent/loadChildren + guards)
src/app/shared/           ← shared components/services (UI kernel)
src/app/api/              ← GENERATED API client (Step 4.6.0 — do not hand-edit)
src/environments/         ← per-env API base URL (placeholders only)
```
Scaffold with `ng new . --routing --style=scss` (or the confirmed setup) so `angular.json`/`package.json` exist before Step 4.6.0.

## STANDARDS_EXAMPLE (idioms for the Architecture Standards block)
```
STATE:   signal()/computed(); services with signals for shared state
HTTP:    the GENERATED client (src/app/api) — never hand-rolled URLs; auth via HttpInterceptorFn (Bearer)
RXJS:    NEVER subscribe without takeUntilDestroyed() or toSignal()
CHANGE:  ChangeDetectionStrategy.OnPush; immutable inputs
TEMPLATE: @if/@for/@switch control flow (not *ngIf/*ngFor)
```

## BUILD
```bash
ng build 2>&1 | tail -5
```
Skeleton verify (Step 3.3): `ng build 2>&1 | tail -5`.

## TEST_CLUSTER
```bash
ng test --watch=false --include "**/{feature}/**" 2>&1 | tail -10
```

## TEST_ALL
```bash
ng test --watch=false 2>&1 | tail -20
```

## TEST_FRAMEWORK
Jest (Angular Jest preset) or Vitest + `@testing-library/angular`. Karma is deprecated — do not use.

## COVERAGE
```bash
ng test --code-coverage --watch=false 2>&1 | tail -20
# Parse coverage/lcov-report/index.html (or the lcov summary) against component/service targets.
```

## LAYOUT
| Slot | Path |
|---|---|
| Shared / UI kernel | `src/app/shared/` |
| Generated API client | `src/app/api/` (generated — FORBIDDEN to clusters) |
| Cluster (feature) | `src/app/{feature}/` |
| Cluster / char tests | co-located `*.spec.ts` beside components |

## COMPOSITION (integration layer — Step 4.6.3 writes these)
- `src/app/app.config.ts` — providers (`provideHttpClient(withInterceptors([authInterceptor]))`, router)
- `src/app/app.routes.ts` — route table with lazy loading + guards
- `src/environments/` — API base URL per environment = the **consumed contract's backend URL** (placeholders only, no secrets)

## CONFIG (dev configuration + Step 6.2 pre-flight)
Dev config: `src/environments/environment.development.ts`. Pre-flight — fail if `apiBaseUrl` is empty
or a `{placeholder}` before E2E (a frontend needs a backend URL to talk to).

## BUILD_UNIT (per-cluster FORBIDDEN set)
`angular.json` · `package.json` · `src/app/app.config.ts` · `src/app/app.routes.ts` · `src/app/api/` (generated)

## RULES (deployed to .claude/rules/ at Step 3.3a)
`project-rules.md` (always) · `angular-rules.md`

## PKG_ADD
```bash
npm install {package}@{ver}
```
Requested via the orchestrator; clusters never edit `package.json` directly.

## SERVE (Stage 6.2 startup + health probe)
```bash
ng serve --port 4200 --no-open > /tmp/frontend.log 2>&1 &
timeout 60 bash -c 'until curl -sf http://localhost:4200>/dev/null 2>&1;do sleep 2;done' \
  || { echo "❌ Frontend failed to start"; tail -20 /tmp/frontend.log; exit 1; }
```
Dev-run (Step 6.4): `ng serve`. The app talks to the **consumed backend URL**; local dev may use a
`proxy.conf.json` to that backend rather than widening CORS (see `fullstack-integration.md`).

## E2E
Playwright against the running SPA (`navigation.spec` from the routing module, `forms.spec` from
cluster `data-testid` attributes). Requires the consumed backend reachable at its URL.

## FITNESS
N/A (no Angular architecture-fitness runner in this plugin; rely on lint + `angular-rules.md`).
