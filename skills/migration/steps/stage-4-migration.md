# Migration Step — Stage 4: Parallel Cluster Migration

_Part of the `migration` skill. Loaded and dispatched by the orchestrator
(`skills/migration/SKILL.md`) — not a standalone/registered skill. Cross-session resume: `MIGRATE RESUME ADO-{ID} [BACKEND|FRONTEND]` · `RETRY CLUSTER {name} ADO-{ID}`._
_Heavy — the orchestrator dispatches one subagent per cluster on isolated branches; agents RETURN a ClusterResult, the orchestrator merges + records status in `clusters{}`._

**Persona:** [SE] Elena Fischer — Senior Software Engineer. **Model tier:** `${ICEA_MODEL:-claude-opus-4-8}`.
**Checkpoint:** single source of truth (schema 1.9); the orchestrator is its single writer — cluster
agents do not write it. Per-cluster status → `clusters{}` ({status, tier, branch, date, feature_ids}).

---

## Stage 4 — Parallel Cluster Migration

Phase 2 runs as a multi-agent workflow. Each cluster agent gets its own git branch in the TARGET
repository (current directory). Agents write only to their assigned paths.

**Hard rule:** SOURCE files are read-only. No isolation needed for source reads — multiple agents
reading the same source files in parallel is safe. Isolation (worktree) is for TARGET writes.

**Target execution profile:** already loaded at Stage 3 start. If entering Stage 4 fresh (e.g.
`MIGRATE RESUME ADO-{ADO_ID}` in a new session), re-load it now:
`Read $PLUGIN_DIR/skills/migration/references/strategies/{target_token}.md`. All `{profile TOKEN}`
references below resolve from it (ONE profile per run — a `frontend` run's is `angular.md` or
`react.md`, per `target_token`); if its `STATUS` is not exactly `implemented` or it is absent →
**STOP** (no cross-stack fallback), and if its `MATURITY` is `⚠ Unverified`, get the developer's
explicit go-ahead first (per the Stage 3 preamble).

### Step 4.0 — Context budget check

```bash
SIZE_SIGNAL=$(find "{SOURCE_PATH}" -type f \( -name "*.cs" -o -name "*.java" -o -name "*.ts" -o -name "*.js" \) \
  ! -path "*/node_modules/*" ! -path "*/bin/*" ! -path "*/obj/*" | wc -l)
```

Read `$PLUGIN_DIR/skills/shared/context-budget-check.md` and execute it with
`recovery_command = "MIGRATE RESUME ADO-{ADO_ID}"` and `skip_keywords = ["MIGRATE RESUME ADO-"]`
so a Stage-4 cluster resume is treated as a fresh path. The Stage 1–3 keywords
(`MIGRATE ARCH/FEAS/CLUSTERS`) do not affect this check — they resume earlier stages only.

### Step 4.1 — Compute cluster tiers

From cluster plan in TARGET-ARCHITECTURE.md:
- Tier 0 (sequential prerequisite): SharedKernel
- Tier 1 (parallel): clusters depending only on SharedKernel
- Tier 2+ (parallel within tier): clusters with Tier 1+ dependencies

Record tiers in checkpoint.

**Run type:** a `backend` / `upgrade` run uses the standard cluster flow (Steps 4.2–4.5) and, if it
feeds a downstream frontend run, **publishes** the contract at Step 4.5. A `frontend` run uses the
**frontend cluster flow (Step 4.6 — it replaces 4.2–4.5)**: it consumes the contract collected at
Step 0 and touches only the Angular app (no backend code). Each run migrates its own single target;
a full-stack effort is the backend run followed by a separate frontend run.

### Step 4.2 — SharedKernel (sequential)

```bash
SKELETON_SHA=$("C:/Program Files/Git/mingw64/bin/git.exe" rev-parse main)
BRANCH="feature/migration-cluster-shared-kernel-${SKELETON_SHA:0:6}"
"C:/Program Files/Git/mingw64/bin/git.exe" show-ref --verify --quiet "refs/heads/${BRANCH}" \
  && "C:/Program Files/Git/mingw64/bin/git.exe" branch -D "${BRANCH}"
"C:/Program Files/Git/mingw64/bin/git.exe" checkout -b "${BRANCH}" main
```

Spawn SharedKernel agent:
```
CLUSTER AGENT — shared-kernel
TARGET:        . (current directory — TARGET application)
SOURCE:        {SOURCE_PATH} (read-only)
Branch:        feature/migration-cluster-shared-kernel-{sha}

ARCHITECTURE STANDARDS:
  {Standards section from TARGET-ARCHITECTURE.md — compact, ~20 lines}

GUARDRAILS — read these TARGET rule files FIRST; they are authoritative and govern all code you
write. (They are deployed rule files in the target repo, NOT the plugin reference files, and are
exempt from the "do not reload reference files" rule.)
  .claude/rules/project-rules.md
  .claude/rules/{the profile RULES file(s) — the target language rule(s)}

SOURCE files to read (ONLY these):
  {file list from shared-kernel cluster spec}

ASSIGNED output paths (relative to .):
  {profile LAYOUT → shared kernel + shared-kernel tests}

FORBIDDEN paths (do not touch):
  {profile BUILD_UNIT — solution/build + composition files} · src/{other clusters}/

CLUSTER SPEC:
  {SharedKernel section from TARGET-ARCHITECTURE.md}

After writing:
  1. git checkout {branch}
  2. {profile BUILD — Debug}
  3. {profile TEST_CLUSTER — SharedKernel}
  4. git add {profile LAYOUT → shared kernel + shared-kernel tests}
  5. git commit -m "feat(shared-kernel): migrate shared kernel [ADO-{ADO_ID}]"

Return JSON: ClusterResult schema
```

Wait for SharedKernel agent. On success: merge branch to main.
```bash
"C:/Program Files/Git/mingw64/bin/git.exe" checkout main
"C:/Program Files/Git/mingw64/bin/git.exe" merge --no-ff feature/migration-cluster-shared-kernel-{sha} \
  -m "merge(shared-kernel): SharedKernel complete [ADO-{ADO_ID}]"
```

### Step 4.3 — Parallel Tier 1 cluster agents

For each Tier 1 cluster:
```bash
NEW_BASE=$("C:/Program Files/Git/mingw64/bin/git.exe" rev-parse main)
BRANCH="feature/migration-cluster-{cluster-name}-${NEW_BASE:0:6}"
"C:/Program Files/Git/mingw64/bin/git.exe" checkout -b "${BRANCH}" main
```

Spawn agent per cluster (all Tier 1 in parallel):
```
CLUSTER AGENT — {ClusterName}
TARGET:        . (current directory)
SOURCE:        {SOURCE_PATH} (read-only)
Branch:        feature/migration-cluster-{cluster}-{sha}

ARCHITECTURE STANDARDS:
  {Standards section from TARGET-ARCHITECTURE.md}

GUARDRAILS — read these TARGET rule files FIRST; they are authoritative and govern all code you
write. (Deployed rule files in the target repo, NOT the plugin reference files — exempt from the
"do not reload reference files" rule.)
  .claude/rules/project-rules.md
  .claude/rules/{the profile RULES file(s) — the target language rule(s)}

SOURCE files to read (ONLY these):
  {file list for this cluster}

SharedKernel types available (from merged main):
  {types list from SharedKernel spec}

ASSIGNED output paths:
  {profile LAYOUT → cluster source + cluster tests for {ClusterName}}

FORBIDDEN: src/{other clusters}/ · {profile BUILD_UNIT}

CLUSTER SPEC:
  {Full cluster section from TARGET-ARCHITECTURE.md}

After writing:
  1. {profile BUILD — Debug}
  2. {profile TEST_CLUSTER — {ClusterName}}
  3. git add {profile LAYOUT → cluster source + cluster tests}
  4. git commit -m "feat({cluster-name}): migrate {ClusterName} [ADO-{ADO_ID}]"

Return JSON: ClusterResult schema
```

**ClusterResult schema:**
```json
{
  "cluster": "string",
  "status": "complete | partial | failed",
  "branch": "feature/migration-cluster-{name}-{sha}",
  "files_written": ["list"],
  "patterns_applied": ["PATTERN_ID list"],
  "warnings": ["string"],
  "manual_review": ["file:line — reason"],
  "build_status": "passed | failed",
  "test_status": "passed | failed | skipped",
  "files_outside_scope": ["list — should be empty"]
}
```

### Step 4.3a — Contract-hash gate (frontend run — before each cluster)

In a `frontend` run, before spawning ANY cluster, recompute the consumed integration-contract hash
and compare it to `checkpoint.contract_hash`. This implements the "ALWAYS check integration contract
hash before every frontend cluster" hard rule — it catches the upstream backend contract changing
under a frontend already being built against it.

```bash
node -e '
const fs=require("fs"),c=require("crypto");
const f=process.argv[1], p=".claude/migration-checkpoint.json";
const cur=c.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0,16);
const s=JSON.parse(fs.readFileSync(p,"utf8"));
process.stdout.write(cur===s.contract_hash?"MATCH":("DRIFT stored="+s.contract_hash+" current="+cur));
' -- "docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/ADO-{ADO_ID}-integration-contract.md"
```

- `MATCH` → proceed to spawn the cluster.
- `DRIFT` → the upstream backend contract changed since this frontend run consumed it. Run the
  Breaking Change Classification in `fullstack-integration.md`. On any BREAKING row: STOP, surface the
  change list, re-consume the updated contract + regenerate the API client (Step 4.6.0), then
  `MIGRATE RESUME ADO-{ADO_ID} FRONTEND`. On non-breaking drift only: bump `contract_version`, refresh
  `contract_hash`, and proceed.

(Backend / upgrade runs consume no contract — this gate is frontend-run only.)

### Step 4.4 — Evaluate results and merge Tier 1

For each completed cluster, first run the **per-cluster completeness score** (Step 4.4a below),
then apply the merge rules:
- `status = complete AND build_status = passed AND test_status = passed AND completeness goal met`
  → merge branch to main
- `build_status = failed` OR completeness ceiling reached → STOP that cluster, report to developer
  ```
  ❌ Cluster {name} incomplete ({percentDone}% · build {build_status}).
  Reply RETRY CLUSTER {name} ADO-{ADO_ID} to re-run, or
  review files_written manually, fix issues, then RETRY.
  ```
- `files_outside_scope` is non-empty → flag for review before merge

### Step 4.4a — Per-cluster completeness score (goal-loop)

Before merging a cluster, the orchestrator scores its returned `ClusterResult` against a
**cluster-completion rubric** — one criterion per assigned `feature_id` ("feature X is present and
mapped"), plus "build passed" and "cluster tests present + passed". This generalises the immediate
`RETRY CLUSTER` STOP into a bounded auto-retry:

```
Read $PLUGIN_DIR/skills/shared/goal-loop-spec.md and run the engine with:
  goal       = "{ClusterName} fully migrated per its cluster spec"
  rubric     = one criterion per assigned feature_id (verbatim from the cluster spec) +
               "build passed" + "cluster tests present and passed" (structural)
  artifact   = the returned ClusterResult (files_written, patterns_applied, build_status, test_status)
  regenerate = re-dispatch the cluster agent (Step 4.3 prompt) with each `remaining` appended as
               the delta to fix, on the same branch
  ceilings   = { maxIterations: 2 }
```

- The orchestrator scores in-context over the `ClusterResult` — **Category C**, writes nothing to
  source. Cluster agents return the result; they never score or write the checkpoint
  (`single-writer-assumption.md`).
- **Goal met** → the cluster is eligible to merge (subject to the build/test rules above).
- **Escalation** (2 iterations without reaching the goal, or no progress) → fall back to the
  `RETRY CLUSTER {name} ADO-{ADO_ID}` surface above — the human decides. The loop never merges,
  never `APPROVE`s, and never crosses the stage gate on its own (goal-loop-spec gate-stop rule).
- Persist loop progress under the checkpoint `goalLoop` block (see `checkpoint-schema.md`) so a
  `MIGRATE RESUME` continues the count instead of restarting. The orchestrator is the single writer.

Merge passing clusters in dependency order:
```bash
"C:/Program Files/Git/mingw64/bin/git.exe" checkout main
"C:/Program Files/Git/mingw64/bin/git.exe" merge --no-ff feature/migration-cluster-{name}-{sha} \
  -m "merge({name}): {ClusterName} complete [ADO-{ADO_ID}]"
```

If Tier 2+ clusters exist: repeat Steps 4.3–4.4 for each tier.

### Step 4.5 — Integration pass (orchestrator)

After all clusters merged to main, write the integration layer (files from profile `COMPOSITION`):
- Composition root — full DI wiring + middleware pipeline + auth per SECURITY-ARCHITECTURE.md
- Config skeleton — placeholders only, no secrets
- `README.md` — project structure, build instructions, setup steps, link to architecture docs

Build (profile `BUILD` — Release):
```
{profile BUILD — Release}
```

Commit the backend integration layer:
```bash
git add {profile COMPOSITION files} README.md
git commit -m "feat(integration): backend wiring and configuration [ADO-{ADO_ID}]"
```

Update the checkpoint `clusters{}` — each merged cluster → `{status:"complete", branch, date}` (merge,
do not clobber) — then `git tag stage4-complete`. (This is a `backend`/`upgrade`
run — Stage 4 ends here; a `frontend` run uses Step 4.6 instead.)

**If this backend feeds a frontend run — PUBLISH the contract.** Export the OpenAPI from the *built*
API (run the API and fetch `/swagger/v1/swagger.json`, or `dotnet swagger tofile`), reconcile it with
`ADO-{ADO_ID}-integration-contract.md`, recompute + record `contract_hash`, and copy both to a shared
path the frontend run can read (`docs/.../` is fine). Then print the frontend-run command:
`mkdir <new-frontend-app> && cd <new-frontend-app> && /migration ADO-{ADO_ID}   # frontend run — consume this contract`.

### Step 4.6 — Stage 4 for a FRONTEND run (track = frontend)

This IS Stage 4 when `mode.track = frontend` — it **replaces Steps 4.2–4.5**. It consumes the contract
collected at Step 0 (`mode.contract_source` — published by a backend run, or an existing backend's
OpenAPI). Every `{profile …}` token resolves from the frontend run's **target profile** (`angular.md`
or `react.md`, per `target_token`).

**4.6.0 — Generate the API client + auth wiring from the consumed contract.** From the consumed
OpenAPI, generate the typed API client (an Angular service, or React hooks / a fetch client — per the
target) + auth wiring per SECURITY-ARCHITECTURE.md, so agents call the API through a contract-accurate
generated client, never hand-written URLs. Use a **JS-native generator** (avoids a Java dependency):
```bash
npx orval --input {contract openapi.json} --output {profile LAYOUT → generated-client path} 2>&1 | tail -5   # or openapi-typescript
```
`npx orval` / `openapi-typescript` need network + npm. **If the registry is unreachable** (offline /
locked-down): STOP and tell the developer — do NOT silently hand-roll URLs (that defeats the
contract-accuracy guarantee). Acceptable fallbacks, in order: (a) a locally-installed/vendored
generator (`node_modules/.bin/orval`), (b) a pre-generated client the developer supplies, or
(c) as a last resort, hand-author the client strictly from the OpenAPI and mark every file
`// MANUAL-CLIENT: verify against contract` for review. Never proceed with ad-hoc URLs.
(JWT interceptor + CORS/proxy patterns: `fullstack-integration.md`.) Commit the generated client to
`main` so every cluster branch inherits it.

**4.6.1 — Cluster tiers.** From this run's clusters (the target's feature areas — Angular
routes/feature modules, or React feature folders/routes), compute tiers: a **shared UI kernel** (design-system components, guards,
interceptors, shared services) first, then feature clusters in parallel. Each frontend cluster carries
its inventory feature-IDs.

**4.6.2 — Per frontend cluster** (all in a tier in parallel):
1. **Contract-hash gate (Step 4.3a)** — MATCH required before spawning. The contract is frozen, so
   this should MATCH; a `DRIFT` means a late backend change slipped in → STOP the frontend track and
   surface it (do not migrate a feature against a stale contract).
2. Branch from `main`, spawn the **FRONTEND cluster agent** (prompt below).
3. `complete` + build + test passed → merge to `main` (Step 4.4 rules; `RETRY CLUSTER` on failure).

**FRONTEND cluster agent prompt:**
```
FRONTEND CLUSTER AGENT — {FeatureName}
TARGET:        . (current directory — this run's target IS the frontend app)
SOURCE:        {SOURCE_PATH} (read-only — the source frontend, e.g. React or Angular)
Branch:        feature/migration-cluster-fe-{feature}-{sha}

ARCHITECTURE STANDARDS (frontend):
  {Standards from TARGET-ARCHITECTURE.md — in the TARGET framework's idioms; see the target profile STANDARDS_EXAMPLE}

GUARDRAILS — read these TARGET rule files FIRST (authoritative, deployed rule files — not plugin refs):
  .claude/rules/project-rules.md
  .claude/rules/{the target profile RULES — angular-rules.md or react-ecosystem-rules.md}

INTEGRATION CONTRACT — READ ONLY (the backend owns it; do NOT change it):
  docs/.../ADO-{ADO_ID}-integration-contract.md   (endpoints, auth, error shape this feature uses)
  Generated API client: {profile generated-client path}   (call the API ONLY through this — never hand-rolled URLs)

SOURCE files to read (ONLY these):
  {source frontend files for this feature — components / containers / routes}

ASSIGNED output paths:
  {profile LAYOUT → this feature's dir + co-located tests}

FORBIDDEN: {profile BUILD_UNIT} · {other feature dirs} · the generated API client dir (do not edit)

CLUSTER SPEC:
  {Feature cluster section from TARGET-ARCHITECTURE.md — components, routes, guards, data-testid list}
  - Use the generated API client + auth wiring; parse errors per the contract's error shape.
  - Add every data-testid listed in the spec (Stage 5.3 / 6.2 E2E depends on them).
  - Follow the target profile STANDARDS_EXAMPLE + its rules (Angular: takeUntilDestroyed/OnPush;
    React: correct hook deps, no stale closures).

After writing:
  1. {profile BUILD}
  2. {profile TEST_CLUSTER — this feature}
  3. git add {this feature's dir}
  4. git commit -m "feat(fe/{feature}): migrate {FeatureName} [ADO-{ADO_ID}]"

Return JSON: ClusterResult schema
```

**4.6.3 — Frontend integration + finish.** Wire the app composition from the target profile
`COMPOSITION` (Angular: `app.config.ts` providers + `app.routes.ts` + `environments/`; React:
`main.tsx` providers + router + `.env`) — the API base URL = the **consumed backend URL** (placeholders
only). Then:
```bash
{profile BUILD}
git add {profile COMPOSITION files}
git commit -m "feat(fe-integration): frontend app wiring [ADO-{ADO_ID}]"
git tag stage4-complete
```
Update the checkpoint `clusters{}`: each frontend cluster → `{status:"complete", branch, date}` (merge).
Frontend *behavioural* verification is the
Playwright suite (Stage 5.3 / 6.2), keyed to the same feature-IDs — golden-master (Stage 5.0) covers
the API level only.

---

