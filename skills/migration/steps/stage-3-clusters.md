# Migration Step — Stage 3: Cluster Plan + Executable Specs

_Part of the `migration` skill. Loaded and dispatched by the orchestrator
(`skills/migration/SKILL.md`) — not a standalone/registered skill. Cross-session resume: `MIGRATE CLUSTERS ADO-{ID}`._

**Persona:** [SA] Rafael Mendes — Solution Architect. **Model tier:** `${ICEA_MODEL:-claude-opus-4-8}`.
**Checkpoint:** single source of truth (schema 1.9); on `APPROVE MIGRATION` (skeleton Write Gate) merge
`stage_gates.migration_approved = true`, `phase = "Stage 4"`. Per-cluster status lives in `clusters{}`.

---

## Stage 3 — Cluster Plan + Executable Specs

**Load the target execution profile(s) first — Stages 3–6 are stack-agnostic and read every
command, path, and example from the profile.** Resolve `mode.target_token` from
`.claude/migration-checkpoint.json` and:
```
Read $PLUGIN_DIR/skills/migration/references/strategies/{target_token}.md
```
Resolve the token to its file by the `references/stacks/` convention (`dotnet`→`dotnet.md`,
`angular`→`angular.md`, `react`→`react.md`, `java`→`java-spring.md`, `nodejs`→`nodejs-express.md`, `python`→`python.md`).
Each run loads exactly ONE target profile (its own target — a `frontend` run's `target_token` is its
chosen frontend target: `angular` or `react`). If a resolved profile's `STATUS` is not
exactly `implemented` (e.g. `not-implemented` / `profile-ready`), or the file is absent → **STOP**
(no cross-stack fallback; see `strategies/README.md`). **Also read the profile's `MATURITY` line:**
if it carries a `⚠ Unverified` marker (java-spring / python / react today), the profile's commands
have NOT been run end-to-end by the plugin — a bare `STATUS: implemented` is not that assurance.
Surface this plainly to the developer and get an explicit go-ahead to proceed with the unverified
`{target_token}` profile before generating any target code from it (verified profiles proceed
without the extra confirmation).
Every `{profile TOKEN}` reference in Stages 3–6 — `SKELETON`, `STANDARDS_EXAMPLE`, `BUILD`,
`TEST_CLUSTER`, `TEST_ALL`, `TEST_FRAMEWORK`, `COVERAGE`, `LAYOUT`, `COMPOSITION`, `CONFIG`,
`BUILD_UNIT`, `RULES`, `PKG_ADD`, `SERVE`, `E2E`, `FITNESS` — comes from it. The git/tier/gate
orchestration around those tokens is identical for every target.

**Resolution rule (important):** YOU, the orchestrator, replace every `{profile …}` token with its
concrete value from the loaded profile *before* running a command or composing a cluster-agent
prompt. Bash cannot resolve `{profile …}`, and the spawned cluster sub-agents do **not** load the
profile — a prompt or command handed off with an unresolved `{profile …}` token will fail (or, in a
`cp … || true` line, silently skip). (Resume via `MIGRATE CLUSTERS` re-loads the profile here;
`MIGRATE RESUME` / `RETRY CLUSTER` re-load it at Step 4.0.)

### Step 3.0 — Context budget check + resume

**Resume path** — if entered via `MIGRATE CLUSTERS ADO-{ADO_ID}`: read the checkpoint. If
`stage_gates.feasibility_approved` is not `true`, STOP and point the developer to
`MIGRATE FEAS ADO-{ADO_ID}` first. Otherwise read the 5 architecture docs + the feasibility doc
from `docs/.../`; if `mode.graph` is `true` re-run the Step 3.1 cluster node script (cheap compute,
not context-heavy), else derive clusters from the source directory structure; then proceed to
Step 3.2. Also load the target execution profile(s) per the Stage 3 preamble — the cluster specs and
Stage-4 commands reference its `{profile …}` tokens. Do NOT re-read the source spec.

**Budget check** — otherwise, measure the accumulated planning-doc size and run the shared check:

```bash
CLUS_SIGNAL=$(cat docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/COMPONENT-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/DATA-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/SECURITY-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/INFRASTRUCTURE-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/ARCHITECTURE-DECISIONS.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/ADO-{ADO_ID}-migration-feasibility.md 2>/dev/null | wc -l)
```

```
Read $PLUGIN_DIR/skills/shared/context-budget-check.md and execute it with:
  operation_name    = "Stage 3 — cluster plan + executable specs"
  size_signal       = {CLUS_SIGNAL}
  size_label        = "Approved planning docs: {CLUS_SIGNAL} lines (5 arch + feasibility)"
  threshold_medium  = 1000
  threshold_high    = 2500
  recovery_command  = "MIGRATE CLUSTERS ADO-{ADO_ID}"
  skip_keywords     = ["MIGRATE CLUSTERS ADO-"]
  operation_needs   = ["read approved architecture + feasibility docs",
                       "derive cluster tiers from source graph",
                       "write self-contained per-cluster executable specs + integration contract"]
  risks_if_continue = ["incomplete per-cluster source-file lists",
                       "missing PATTERN_ID generation rules",
                       "truncated integration-contract (backend run)"]
  saved_context     = "All Stage 1–2 docs are on disk; the checkpoint records both prior gates"
```

On `BUDGET_WARN` / `BUDGET_STOP`, stop and wait. On `BUDGET_OK` / `BUDGET_SKIPPED`, proceed.

### Step 3.1 — Derive cluster plan from graph

**If graph available:**
```bash
node -e '
const g=JSON.parse(require("fs").readFileSync(process.argv[1]+"/.claude/graph/graph.json","utf8"));
const modules=g.modules||{};
const inDeg={};
Object.values(g.edges||{}).forEach(edges=>edges.forEach(e=>{inDeg[e.to]=(inDeg[e.to]||0)+1;}));
const sharedKernel=Object.keys(modules).filter(m=>inDeg[m]>2||modules[m].isHub);
const visited=new Set();const clusters=[];
Object.keys(modules).forEach(start=>{
  if(visited.has(start)||sharedKernel.includes(start))return;
  const cluster=[];const queue=[start];
  while(queue.length){const node=queue.shift();if(visited.has(node))continue;
    visited.add(node);cluster.push(node);
    (g.edges[node]||[]).forEach(e=>{if(!visited.has(e.to)&&!sharedKernel.includes(e.to))queue.push(e.to);});}
  if(cluster.length>0)clusters.push(cluster);});
const fileMap={};Object.keys(modules).forEach(m=>{fileMap[m]=modules[m].files||[];});
process.stdout.write(JSON.stringify({shared_kernel:sharedKernel,clusters,file_map:fileMap},null,2));
' -- "{SOURCE_PATH}" 2>/dev/null
```

**If graph absent:** derive from directory structure at SOURCE_PATH.

If a Stage 0.6 Source Behavioral Inventory exists, record which inventory **feature-IDs** each derived
cluster covers — this completes the feature → migration-cluster → Stage-4-agent spine (the inventory
groups by source bounded-context/module; the mapping to migration clusters is established here).

### Step 3.2 — Write TARGET-ARCHITECTURE.md (cluster executable specs)

Load cluster spec template:
```
Read $PLUGIN_DIR/skills/migration/references/specs/phase1-architecture-spec.md
```

Write `docs/.../ADO-{ADO_ID}-target-architecture.md`.

This document is the executable spec for Stage 4 agents — each cluster section must be self-contained.
Agents read ONLY their cluster section + listed source files. They do NOT reload reference files.

**Document sections:**

**1. Architecture Standards Reference** (compact — ~20 lines for agents):
Derived from the approved architecture documents, expressed in the target stack's idioms. Use the
profile `STANDARDS_EXAMPLE` as the shape (auth · data access · logging · errors · async), filled
from the approved AUTH / DATA / INFRASTRUCTURE decisions.

**2. Cluster Plan:**
```markdown
SharedKernel: {N files} — migrate first (sequential)
Tier 1 (parallel after SharedKernel): {cluster names}
Tier 2 (parallel after Tier 1): {cluster names}
```

**3. Shared Kernel Spec:**
```markdown
Source files: {file list}
Target path:  {profile LAYOUT → shared kernel}
Patterns:     {shared abstractions — e.g. base entity, repository interface, Result<T>}
Standards:    No framework dependencies in the shared/domain layer
```

**4. Per-Cluster Specs** (one section per cluster):
```markdown
### Cluster: {ClusterName}

Source files: {exact file list — agents read ONLY these}
Depends on:   SharedKernel{, OtherCluster}

Source Patterns Identified:
  - {PATTERN_ID}: {file}:{line} — {description}
    → Generation rule: {what to generate in target}

Target Generation:
  Domain:         {types to generate} → {target path}
  Application:    {types to generate} → {target path}
  Infrastructure: {types to generate} → {target path}
  API:            {endpoints to generate} → {target path}
  Tests:          {test types to generate} → {target path}

data-testid:    {list of form fields, buttons, messages needing data-testid attributes}
Build command:  {profile BUILD — skeleton-verify variant}
```

**5. Integration Layer Spec** (files from the profile `COMPOSITION` token):
```markdown
Composition root: DI wiring for all clusters + middleware pipeline   ({profile COMPOSITION})
Config skeleton:  placeholders only, no secrets                      ({profile COMPOSITION})
Health check:     health endpoint checking database + cache (per approved architecture)
Auth setup:       {exact registration from SECURITY-ARCHITECTURE.md}
```

**6. Cluster status → checkpoint `clusters{}`** (no separate tracker file — the checkpoint is the
single source of truth; `/migration-status` renders it). Seed one entry per planned cluster in the
checkpoint (merge — do not clobber other fields):
```json
"clusters": { "SharedKernel": {"status":"pending","tier":0,"branch":"","date":"","feature_ids":[]} }
```

**7. Integration Contract** (backend run authors → publishes; frontend run consumes):
- **Backend run:** write `docs/.../ADO-{ADO_ID}-integration-contract.md` from the approved API + auth
  (SECURITY-ARCHITECTURE.md); load `Read $PLUGIN_DIR/skills/migration/references/shared/fullstack-integration.md`.
  It is finalised + **published** at Stage 4.5 (with the built OpenAPI) for a downstream frontend run.
- **Frontend run:** the contract is an INPUT collected at Step 0 (`mode.contract_source`) — do NOT
  author it here (the backend owns it); the Stage-4 per-cluster gate checks drift against it.

Record the contract hash in the checkpoint — the anchor the Stage-4 frontend gate (Step 4.3a) compares
against (makes the "ALWAYS check contract hash" hard rule enforceable, not decorative).

> **Script transparency** (per `rules/project-rules.md`) — this `node -e` block:
> 1. **What it does:** reads the integration-contract file, computes a SHA-256 of its bytes,
>    stores the first 16 hex chars as `contract_hash` in `.claude/migration-checkpoint.json`.
> 2. **What it touches:** reads the contract `.md`; reads + writes only the checkpoint JSON.
> 3. **What it does NOT do:** no network, no git, no source reads, no other writes.
> 4. **APIs used:** Node.js `fs.readFileSync`/`writeFileSync`, `crypto.createHash`, `JSON`.
> 5. **How to verify:** `cat .claude/migration-checkpoint.json` — confirm `contract_hash` is set.

```bash
node -e '
const fs=require("fs"),c=require("crypto");
const f=process.argv[1], p=".claude/migration-checkpoint.json";
const h=c.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0,16);
const s=JSON.parse(fs.readFileSync(p,"utf8")); s.contract_hash=h;
fs.writeFileSync(p,JSON.stringify(s,null,2)); console.log("contract_hash",h);
' -- "docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/ADO-{ADO_ID}-integration-contract.md"
```

### Step 3.3 — Write skeleton to TARGET + commit

Display Write Gate:
```
📁 WRITE PENDING — Project skeleton in current directory (TARGET)
   Reply APPROVE MIGRATION ADO-{ADO_ID} to write.

  Planning docs written immediately (no gate):
  ✅ docs/.../COMPONENT-ARCHITECTURE.md
  ✅ docs/.../DATA-ARCHITECTURE.md
  ✅ docs/.../SECURITY-ARCHITECTURE.md
  ✅ docs/.../INFRASTRUCTURE-ARCHITECTURE.md
  ✅ docs/.../ARCHITECTURE-DECISIONS.md
  ✅ docs/.../ADO-{ADO_ID}-migration-feasibility.md
  ✅ docs/.../ADO-{ADO_ID}-target-architecture.md

  Project skeleton (Write Gate — written to current directory; structure from profile SKELETON):
  {profile SKELETON — the project/solution files to scaffold for this target}
```

After `APPROVE MIGRATION ADO-{ADO_ID}`:

Verify skeleton builds (profile `BUILD` — skeleton-verify variant):
```
{profile BUILD — skeleton verify}
```

**Step 3.3a — Deploy target guardrail rules NOW (before Stage 4, not at Stage 6).** Cluster agents
in Stage 4 must generate under the enforced coding guardrails. Deploying the rule files into the
target repo now — and committing them with the skeleton — means every cluster branch carries them
and each agent can read them. This is a subset; `/setup-init` at Stage 6 completes the full rule set
+ graph + architecture docs (idempotent — it skips rules already present).

The rule files to deploy come from the loaded profile's `RULES` token (`project-rules.md` is always
included). Each run deploys its single target profile's `RULES` (a `frontend` run → `angular-rules.md` or `react-ecosystem-rules.md`).

> **Script transparency** (per `rules/project-rules.md`) — this copy:
> 1. **What it does:** copies `project-rules.md` + each file named in the profile `RULES` token from
>    the plugin's `_project-deploy/rules/` into the target `.claude/rules/`; `cp -n` never overwrites
>    an existing file (a developer's edited rule is preserved).
> 2. **What it touches:** only `.claude/rules/*.md` in the current (TARGET) directory.
> 3. **What it does NOT do:** no network, no git config changes, no source reads, no other writes.
> 4. **Commands used:** `mkdir -p`, `cp -n`, `ls`.
> 5. **How to verify:** `ls .claude/rules/` lists `project-rules.md` + the profile's rule file(s).

```bash
mkdir -p .claude/rules
# RULES = the files listed in the loaded profile's RULES token:
for r in project-rules.md {profile RULES files — space-separated}; do
  cp -n "$PLUGIN_DIR/_project-deploy/rules/$r" .claude/rules/ 2>/dev/null || true
done
ls .claude/rules/
```
Confirm `.claude/rules/` is NOT covered by the target's ignore file (rules are committed/team-shared);
if it is, flag it to the developer before the commit (do not auto-edit the ignore file).

Commit skeleton + rules to TARGET main branch (cluster branches inherit both):
```bash
git add .
git commit -m "Stage 3: Project skeleton + target guardrail rules — ADO-{ADO_ID}"
git tag stage3-skeleton
```

Update the checkpoint `.claude/migration-checkpoint.json` — this MERGES the checkpoint that already
exists from Step 0.4 (do NOT clobber the accumulated `decision_log`). On `APPROVE MIGRATION
ADO-{ADO_ID}` set `stage_gates.migration_approved = true`. The merged result is:
```json
{
  "schema_version": "1.9",
  "ado_id": "{ADO_ID}",
  "source_path": "{SOURCE_PATH}",
  "phase": "Stage 4",
  "stage_gates": {
    "options_approved": true,
    "inventory_approved": true,
    "architecture_approved": true,
    "feasibility_approved": true,
    "migration_approved": true,
    "stage4_started": false
  },
  "mode": {
    "graph": true,
    "track": "backend | frontend | upgrade",
    "source_token": "{source-token}",
    "target_token": "{target-token}"
  },
  "contract_version": 1,
  "contract_hash": "",
  "decision_log": {
    "auth": "{from SECURITY-ARCHITECTURE.md}",
    "data_access": "{Dapper / EF Core}",
    "architecture": "{simplified / four-layer}",
    "cloud": "{Azure / AWS / on-prem}",
    "red_items": [],
    "yellow_count": 0,
    "source_file_count": 0,
    "source_module_count": 0
  },
  "clusters": {}
}
```

---

