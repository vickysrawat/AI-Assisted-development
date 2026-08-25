# Target Execution Profile: react

STATUS: implemented
ROLE: frontend (a standalone `frontend` run)
MATURITY: ⚠ Unverified end-to-end. Reachable as a frontend target from an **Angular** source
(`angular→react` — parity in `mappings/angular-react.md`, idioms in `stacks/react.md`). Commands are
standard React/Vite tooling but not yet run against a real migration.

_A `frontend` run's target folder IS the React app, so all paths are **root-relative** (same
convention as `angular.md`/`dotnet.md`). The run consumes an API contract and calls the API only
through the generated client. SKILL.md Step 4.6 resolves its `{TOKEN}`s from here._

---

## STACK
React 18+ · TypeScript · Vite · TanStack Query · React Router v6

## SKELETON (workspace scaffolded in Step 3.3)
```
package.json
vite.config.ts
tsconfig.json
index.html
src/main.tsx          ← app entry: providers (QueryClient, Router, auth)
src/app/router.tsx    ← route table (lazy routes + loaders/guards)
src/shared/           ← shared components/hooks (UI kernel)
src/api/              ← GENERATED API client (Step 4.6.0 — do not hand-edit)
src/features/         ← feature clusters
.env                  ← VITE_API_BASE_URL (placeholder only)
```
Scaffold with `npm create vite@latest . -- --template react-ts` (or the confirmed setup).

## STANDARDS_EXAMPLE (idioms for the Architecture Standards block)
```
STATE:   useState/useReducer local; Zustand or Context for shared state
HTTP:    the GENERATED client (src/api) + TanStack Query (useQuery/useMutation) — never hand-rolled URLs
EFFECTS: correct useEffect dependency arrays; no stale closures; cleanup on unmount
ROUTING: React Router v6 (routes + loaders + guards); lazy() + Suspense for code-split
FORMS:   react-hook-form (controlled); explicit value + onChange
```

## BUILD
```bash
npm run build 2>&1 | tail -5      # tsc -b && vite build
```
Skeleton verify (Step 3.3): `npm run build 2>&1 | tail -5`.

## TEST_CLUSTER
```bash
npx vitest run src/features/{feature} 2>&1 | tail -10
```

## TEST_ALL
```bash
npx vitest run 2>&1 | tail -20
```

## TEST_FRAMEWORK
Vitest + React Testing Library + MSW (mock HTTP). Query the DOM by role/text, not implementation.

## COVERAGE
```bash
npx vitest run --coverage 2>&1 | tail -20
# Parse coverage/coverage-summary.json (or the lcov summary) against component/hook targets.
```

## LAYOUT
| Slot | Path |
|---|---|
| Shared / UI kernel | `src/shared/` |
| Generated API client | `src/api/` (generated — FORBIDDEN to clusters) |
| Cluster (feature) | `src/features/{feature}/` |
| Cluster / char tests | co-located `*.test.tsx` beside components |

## COMPOSITION (integration layer — Step 4.6.3 writes these)
- `src/main.tsx` — providers: `QueryClientProvider`, `RouterProvider`, auth/token provider + the fetch/axios interceptor
- `src/app/router.tsx` — route table with lazy routes + loaders/guards
- `.env` — `VITE_API_BASE_URL` = the **consumed contract's backend URL** (placeholder only, no secrets)

## CONFIG (dev configuration + Step 6.2 pre-flight)
Dev config: `.env`. Pre-flight — fail if `VITE_API_BASE_URL` is empty/`{placeholder}` before E2E:
```bash
[ -f .env ] || { echo "ℹ️  no .env — skipping"; exit 0; }
v=$(grep "^VITE_API_BASE_URL=" .env | head -1 | cut -d= -f2-)
{ [ -z "$v" ] || echo "$v" | grep -q "{"; } && { echo "❌ Set VITE_API_BASE_URL before E2E"; exit 1; }
echo "✅ VITE_API_BASE_URL set"
```

## BUILD_UNIT (per-cluster FORBIDDEN set)
`package.json` · `vite.config.ts` · `tsconfig.json` · `src/main.tsx` · `src/app/router.tsx` · `src/api/` (generated)

## RULES (deployed to .claude/rules/ at Step 3.3a)
`project-rules.md` (always) · `react-ecosystem-rules.md`

## PKG_ADD
```bash
npm install {package}@{ver}
```
Requested via the orchestrator; clusters never edit `package.json` directly.

## SERVE (Stage 6.2 startup + health probe)
```bash
npm run dev -- --port 5173 > /tmp/frontend.log 2>&1 &     # vite dev
timeout 60 bash -c 'until curl -sf http://localhost:5173>/dev/null 2>&1;do sleep 2;done' \
  || { echo "❌ Frontend failed to start"; tail -20 /tmp/frontend.log; exit 1; }
```
Dev-run (Step 6.4): `npm run dev`. Talks to the **consumed backend URL**; local dev may use Vite's
`server.proxy` to that backend rather than widening CORS.

## E2E
Playwright against the running SPA (`navigation.spec` from the router, `forms.spec` from `data-testid`).
Requires the consumed backend reachable at its URL.

## FITNESS
```bash
npx depcruise src --config .dependency-cruiser.js 2>&1 | tail -20
```
`dependency-cruiser` layer/import-boundary rules (React analogue of NetArchTest/ArchUnit); or ESLint
`import/no-restricted-paths`. `N/A` acceptable if none configured.
