---
name: migration
description: >
  Migrate an application from one tech stack to another. Run this command FROM INSIDE the
  new TARGET project folder. Provide the SOURCE application path when prompted.
  Supports: .NET Framework → .NET 10, Java ↔ .NET, React+Express → Angular+.NET, Node.js → .NET.
  Uses the source project's knowledge graph to derive parallel migration clusters.
  Each cluster agent works on its own branch of the TARGET repository.
---

# Skill: migration

_Skill version: 1.17 · Last changed: 2026-08-26 · Plugin compatibility: ≥3.13.0 · Consent: A_

> ⚠ **Feature Gate bypass**: This skill generates implementation code without a prior ICEA.
> The architecture documents produced in Stage 1 serve as the governance substitute.
> The Write Gate (§0) still applies — no source code written until `APPROVE MIGRATION ADO-{ID}`.

> 📌 **Run this skill FROM the target project folder**, not the source.
> `mkdir my-new-app && cd my-new-app && /migration`

## Purpose

Migrates an application from one tech stack to another in four stages:

1. **Stage 0** — Read source, display findings, ask 3 minimal questions
2. **Stage 1** — AI designs complete target architecture (Mermaid diagrams + ADR per component); user reviews and approves
3. **Stage 2** — Migration feasibility assessment against approved architecture
4. **Stage 3** — Cluster plan + per-cluster executable specs
5. **Stage 4+** — Parallel cluster migration (branch per cluster, worktree isolation)

**Core principle:** Ask only what is needed. If additional information is required during architecture design, ask at that specific decision point. Never assume.

Triggered by:
- `/migration` or `/migration ADO-1847`
- `MIGRATE ADO-1847`
- `MIGRATE RESUME ADO-1847 [CLUSTER-NAME]`
- `MIGRATE STATUS ADO-1847`
- `RETRY CLUSTER {name} ADO-1847`
- `MIGRATE OPTIONS ADO-1847`   (cross-session resume/regenerate Stage 0.5 target-options analysis)
- `MIGRATE INVENTORY ADO-1847` (cross-session resume/regenerate Stage 0.6 source behavioral inventory)
- `MIGRATE ARCH ADO-1847`      (cross-session resume/regenerate Stage 1 architecture docs)
- `MIGRATE FEAS ADO-1847`      (cross-session resume/regenerate Stage 2 feasibility)
- `MIGRATE CLUSTERS ADO-1847`  (cross-session resume/regenerate Stage 3 cluster specs)

---

## Persona

**Stage 0–1** — **[SA] Rafael Mendes — Solution Architect**. Proposes the right target architecture for this specific application — not a generic pattern. Always explains the reasoning. Recommends one approach and justifies it; doesn't ask the developer to choose between options unless there is genuine ambiguity the AI cannot resolve.

**Stage 4+** — **[SE] Elena Fischer — Senior Software Engineer**. Idiomatic target-stack code following the approved architecture standards. Never migrates + refactors + changes behaviour in the same step.

See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## Model routing

- Stage 0.5 (target options analysis): `${ICEA_MODEL:-claude-opus-4-8}`
- Stage 0–1 (architecture): `${ICEA_MODEL:-claude-opus-4-8}`
- Stage 2 (feasibility analysis): `${REVIEW_MODEL:-claude-sonnet-4-6}`
- Stage 3 (cluster planning): `${ICEA_MODEL:-claude-opus-4-8}`
- Stage 4+ (code generation): `${ICEA_MODEL:-claude-opus-4-8}`
- Verification (incl. Stage 5.0 golden-master replay harness): `${REVIEW_MODEL:-claude-sonnet-4-6}`

---

## Codebase Orientation — before Stage 0

Resolve PLUGIN_DIR:
```
Read .claude/plugin-path.txt → PLUGIN_DIR
(if absent: §1a resolver from $PLUGIN_DIR/skills/shared/plugin-path-resolution.md)
```

Current directory is the TARGET — a new empty folder. No architecture docs exist here yet.
SOURCE_PATH has not been collected. Do not read any source files here.

---

## Step 0 — Collect identifiers and SOURCE_PATH

Extract ADO_ID from command argument. If missing:
```
To start this migration I need:
  ADO work item #:       [e.g. 1847]
  Release #:             [e.g. 3]
  Sprint #:              [e.g. 12]
  Source application:    [path to existing app, e.g. C:/repos/my-java-app]
```

Normalise ADO ID: `ADO-1847`, `ADO #1847`, and `1847` all resolve the same.

**Verify TARGET (current directory) is a git repository:**
```bash
# Use the same git binary as Stage 4 (CLAUDE.md §0b); on non-Windows the plain `git` on PATH is fine.
GIT="C:/Program Files/Git/mingw64/bin/git.exe"; [ -x "$GIT" ] || GIT=git
"$GIT" rev-parse --is-inside-work-tree 2>/dev/null || {
  "$GIT" init && "$GIT" commit --allow-empty -m "Initial commit — migration target"
  echo "✅ Git initialized in current directory"
}
```

**Verify SOURCE_PATH:**
```bash
[ -d "{SOURCE_PATH}" ] || { echo "❌ Source path does not exist: {SOURCE_PATH}"; exit 1; }
echo "✅ Source confirmed: {SOURCE_PATH}"
```

**If this is a `frontend` run:** also collect the **API contract it will consume** — either the
`ADO-{ID}-integration-contract.md` (+ `openapi.json`) **published by the backend run**, or an
**existing backend's** OpenAPI URL/file. Record it as `mode.contract_source` and freeze its hash
(the Stage 4 gate checks drift against it). A frontend run cannot proceed without a contract to build
against — STOP and ask if none is available.

**Register SOURCE_PATH as additionalDirectory:**
```bash
node -e '
const fs=require("fs");
const p=".claude/settings.local.json";
let s={};try{s=JSON.parse(fs.readFileSync(p,"utf8"));}catch(e){}
if(!s.additionalDirectories)s.additionalDirectories=[];
const src=process.argv[1];
if(!s.additionalDirectories.includes(src)){
  s.additionalDirectories.push(src);
  fs.mkdirSync(".claude",{recursive:true});
  fs.writeFileSync(p,JSON.stringify(s,null,2));
  console.log("✅ Registered in additionalDirectories:",src);
}else console.log("ℹ️  Already registered");' -- "{SOURCE_PATH}"
```

Planning docs path: `docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/`

**Check for existing checkpoint:**
```bash
node -e '
try{const c=JSON.parse(require("fs").readFileSync(".claude/migration-checkpoint.json","utf8"));
if(c.ado_id===process.argv[1])process.stdout.write(JSON.stringify(c,null,2));}catch(e){}
' -- "{ADO_ID}" 2>/dev/null
```

If checkpoint found: offer resume based on its `phase` and `stage_gates` —
`MIGRATE ARCH` / `MIGRATE FEAS` / `MIGRATE CLUSTERS` for the document stages, `MIGRATE RESUME` for
Stage 4 clusters, or `START OVER`. If `schema_version` is missing or `< 1.6` (a legacy run — those
only wrote a checkpoint at Stage 3), treat `stage_gates`/`mode` as unknown and offer only
`MIGRATE RESUME ADO-{ADO_ID}` (Stage 4) or `START OVER`.

---

## Stage 0 — Understand the Source & Confirm Target

### Step 0.1 — Read and display source analysis

Resolve PLUGIN_DIR (bash block):
```bash
PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null | tr -d '\r\n')
[ -z "$PLUGIN_DIR" ] && PLUGIN_DIR="$(node -e '
const fs=require("fs"),os=require("os"),path=require("path");
const base=path.join(os.homedir(),".claude","plugins");
const norm=p=>p?p.split(String.fromCharCode(92)).join("/"):"";
let dir="";
try{const reg=JSON.parse(fs.readFileSync(path.join(base,"installed_plugins.json"),"utf8"));
const key=Object.keys(reg.plugins||{}).find(k=>k.startsWith("ai-assisted-development@"));
if(key){const a=reg.plugins[key]||[];const e=a.find(x=>x.scope==="user")||a[0];
if(e&&e.installPath&&fs.existsSync(e.installPath))dir=e.installPath;}}catch(e){}
if(!dir){try{for(const m of fs.readdirSync(base)){const p=path.join(base,m,"plugins","ai-assisted-development");if(fs.existsSync(p)){dir=p;break;}}}catch(e){}}
process.stdout.write(norm(dir));')"
```

Read source stack:
```bash
STACKS="$(node -e '
try{const s=JSON.parse(require("fs").readFileSync(process.argv[1]+"/.claude/dream-init-state.json","utf8"));
process.stdout.write((s.detected_stacks||[]).join(" "));}catch(e){}' -- "{SOURCE_PATH}" 2>/dev/null)"
```

Read source knowledge graph:
```bash
node -e '
try{
  const g=JSON.parse(require("fs").readFileSync(process.argv[1]+"/.claude/graph/graph.json","utf8"));
  const mods=Object.keys(g.modules||{});
  const hubs=mods.filter(m=>g.modules[m].isHub);
  const edges=Object.keys(g.edges||{}).length;
  process.stdout.write(JSON.stringify({modules:mods.length,hubs,edges,names:mods}));
}catch(e){process.stdout.write("NO_GRAPH");}' -- "{SOURCE_PATH}" 2>/dev/null
```

**If graph absent:** suggest running `/graph-sync` in SOURCE_PATH for better cluster analysis.
```
⚠ No knowledge graph at {SOURCE_PATH}/.claude/graph/graph.json
  (A) Run /graph-sync in {SOURCE_PATH} first — recommended
  (B) Continue — migration will use directory structure analysis instead
```

Read source architecture docs if available:
```
Read {SOURCE_PATH}/.claude/architecture/architecture.md        (skip if absent)
Read {SOURCE_PATH}/.claude/architecture/architecture-deployment.md  (skip if absent)
```

Detect data layer:
```bash
find "{SOURCE_PATH}" -name "*.edmx" 2>/dev/null | head -3
find "{SOURCE_PATH}" -name "*DbContext.cs" 2>/dev/null | head -3
find "{SOURCE_PATH}" -name "pom.xml" | xargs grep -l "spring-data\|jpa\|hibernate" 2>/dev/null | head -3
find "{SOURCE_PATH}" -type f -name "package.json" | xargs grep -l "typeorm\|sequelize\|prisma" 2>/dev/null | head -3
```

Detect authentication patterns:
```bash
grep -r "WebSecurityConfigurerAdapter\|SecurityFilterChain\|AddAuthentication\|passport\|jsonwebtoken" \
  "{SOURCE_PATH}" --include="*.java" --include="*.cs" --include="*.js" --include="*.ts" -l 2>/dev/null | head -5
```

Estimate source size:
```bash
find "{SOURCE_PATH}" -type f \( -name "*.cs" -o -name "*.java" -o -name "*.ts" -o -name "*.js" \) \
  ! -path "*/node_modules/*" ! -path "*/bin/*" ! -path "*/obj/*" | wc -l
```

**Display source analysis:**
```
SOURCE APPLICATION ANALYSIS — {SOURCE_PATH}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Stack:           {STACKS} ({app type description})
  Modules:         {count} ({bounded context count} bounded contexts{, N hub modules})
  Source files:    {size estimate}
  Data layer:      {detected: JPA/Hibernate | EF6 | Dapper | Sequelize | none}
  Authentication:  {detected patterns | not detected}
  Knowledge graph: {available: N modules | not available — heuristic mode}
  Arch docs:       {available | not available}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Is this correct? Reply YES to continue or correct what I missed.
```

Wait for confirmation before proceeding.

**Load source stack reference file immediately after confirmation:**
```
Read $PLUGIN_DIR/skills/migration/references/stacks/{source-token}.md
```
Also load the matching rule file for the source stack if present (`rules/{stack}-rules.md` or
`.claude/rules/{stack}-rules.md`) — it holds the authoritative coding guardrails (anti-patterns,
pipeline order) for that stack. On any conflict between a stacks reference and a rule file, the rule
file wins.

### Step 0.2 — Tooling pre-check

```bash
dotnet --version 2>/dev/null | head -1
java --version 2>/dev/null | head -1
mvn --version 2>/dev/null | head -1 || gradle --version 2>/dev/null | head -1
node --version 2>/dev/null
ng version 2>/dev/null | head -3
```

MISSING tools required for the migration = BLOCKER. Report before asking target questions.

### Step 0.3 — Ask target questions (minimal)

**Before Q1 — run Stage 0.5 (Target Options Analysis) unless this is a `dotnet` version upgrade.**
For a version upgrade (source token `dotnet` → .NET 10 upgrade) there is no genuine target
choice: skip to Q2 (target is fixed); `options_approved` is recorded `true` when the checkpoint is
written at Step 0.4. Otherwise:
```
Read $PLUGIN_DIR/skills/migration/references/specs/target-options-spec.md
```
Produce `docs/.../ADO-{ADO_ID}-target-options.md` (planning doc, no Write Gate) with 2–3 scored
candidate targets, a migration posture per bounded context (port / re-architecture /
rewrite-from-spec), a weighted decision matrix, a rough order of magnitude, and ONE recommendation
as an ADR. Then present the Stage 0.5 gate from that spec and STOP. Only
`APPROVE OPTIONS ADO-{ADO_ID}` (or an explicit override naming another candidate) advances. Record
the approval — it is persisted as `stage_gates.options_approved = true` when the checkpoint is
written at Step 0.4 (or updated in place if a checkpoint already exists from a prior run) — then
pre-fill Q1 with the recommendation. This turns Q1 from a cold menu pick into a confirmation.

**Q1 — Target platform**
Q1 CONFIRMS the Stage 0.5 recommendation — present the recommended target pre-selected and let the
developer confirm or pick another row. (For a `dotnet` version upgrade, present ".NET 10 upgrade"
as the only option.) Present only valid options for the detected source. If the source stack has
no migration mapping reference:
```
❌ '{stack}' has no migration mapping reference yet, so I cannot produce a verified plan.
Migration-supported sources today: dotnet_framework · dotnet · java · nodejs · react(FE) · angular(FE)
Note: Python is a TARGET from Node.js (nodejs→python — `references/mappings/nodejs-python.md`) and
React is a TARGET from Angular (angular→react — `references/mappings/angular-react.md`). Python as a
SOURCE and java/dotnet→python have NO migration mapping references yet. I will not guess a mapping —
an unverified parity table is worse than none.
```
Stop completely. No fallback — do not fabricate a parity table for an unmapped stack.

| Source | Options |
|---|---|
| `dotnet_framework` | .NET 10 MVC · .NET 10 Web API · .NET 10 Blazor · .NET 10 Worker |
| `dotnet` | .NET 10 upgrade |
| `java` | .NET Core Web API · .NET Core MVC |
| `dotnet` → Java | Java Spring Boot |
| `nodejs` | .NET Core Web API · Java Spring Boot · Python FastAPI |
| `angular` + `nodejs` | Backend run: .NET Core Web API (nodejs→.NET) · Frontend run: Angular (react/angular→Angular) OR React (angular→React) |

**Full-stack = TWO coordinated single-track runs, not one invocation.** Migrate the **backend first**
(a normal single-track run — it *publishes* the API contract at completion), then run a **separate
frontend migration** that *consumes* that contract. Choose which run THIS is: `mode.track = backend`
or `frontend`. "Backend only" is just the backend run; "Frontend only" is a frontend run against an
**existing** backend's published/served contract. The skill prints the command for the other run at
completion. This keeps every run single-source / single-graph / single-mapping.

**Q2 — Cloud / hosting**
```
Where will the target application run?
  (A) Azure (App Service, AKS, or Azure Functions)
  (B) AWS (Elastic Beanstalk, ECS, or Lambda)
  (C) On-premises / private cloud
  (D) Local / development only (no cloud decision yet)
```

**Q3 — Hard constraints (ask only if relevant)**
```
Do any of these apply? (leave blank if none)
  - Database engine is fixed: ___________
  - External API contract must be preserved exactly (SOAP/REST shape)
  - Specific package must be kept: ___________
```

If the developer answers all three and everything is clear: confirm TARGET spec and proceed to Stage 1.
If something is ambiguous or requires more context: ask that specific clarifying question.

**TARGET spec confirmation:**
```
CONFIRMED TARGET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  source:      {stack} ({app type})
  target:      {Q1 answer}
  cloud:       {Q2 answer}
  constraints: {Q3 answer | none}
  graph:       {available | heuristic}
  source path: {SOURCE_PATH}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reply YES to begin architecture design, or correct any item.
```

Load target stack reference after confirmation:
```
Read $PLUGIN_DIR/skills/migration/references/stacks/{target-token}.md
Read $PLUGIN_DIR/skills/migration/references/mappings/{pair}.md  (if exists)
Read $PLUGIN_DIR/skills/migration/references/shared/clean-architecture.md
```
Also load the matching rule file for the target stack if present (`rules/{stack}-rules.md` or
`.claude/rules/{stack}-rules.md`) — it holds the authoritative coding guardrails (anti-patterns,
pipeline order) for the target and governs all generated code. On any conflict between a stacks
reference and a rule file, the rule file wins. These rule files are also **deployed** into the
target `.claude/rules/` at Step 3.3a (before Stage 4) so the parallel cluster agents generate under
them — not just the orchestrator.

### Step 0.4 — Write initial checkpoint

Write `.claude/migration-checkpoint.json` NOW — at the end of Stage 0, before any document is
generated. This is the resume anchor for every later stage (the context-budget checks in Stages
1–3 rely on it being present). All values below are known from the Stage 0 analysis and answers:
`mode.graph` from the graph-availability check (Step 0.1), `mode.track` ∈ {`backend`, `frontend`, `upgrade`} from the Q1 run type (a full-stack effort is two
runs — one `backend`, then one `frontend`; a `frontend` run's `target_token` is its chosen frontend target — `angular` (react/angular→Angular) or `react` (angular→React)); `source_token`/`target_token`
are the resolved stack tokens; `source_file_count`/`source_module_count` from the Step 0.1 size
and graph counts.

> **Script transparency** (per `rules/project-rules.md`) — this `node -e` block:
> 1. **What it does:** writes/updates `.claude/migration-checkpoint.json` with the Stage-0
>    identifiers, `mode`, and seed `decision_log`; sets `phase:"Stage 0.6"` and seeds `stage_gates`
>    (`options_approved` true, the rest false). If a checkpoint already exists it MERGES (keeps any existing `decision_log`/
>    `clusters`), never clobbers.
> 2. **What it touches:** only `.claude/migration-checkpoint.json` (creates `.claude/` if absent).
> 3. **What it does NOT do:** no network calls, no git operations, no reads of source files, no
>    writes anywhere else.
> 4. **APIs used:** Node.js `fs.readFileSync`, `fs.mkdirSync`, `fs.writeFileSync`, `JSON`.
> 5. **How to verify:** `cat .claude/migration-checkpoint.json` — confirm `schema_version:"1.8"`,
>    `phase:"Stage 0.6"`, `stage_gates.options_approved:true` (and `inventory_approved:false`), and
>    your Stage-0 answers under `mode`/`decision_log`.

```bash
node -e '
const fs=require("fs");
const p=".claude/migration-checkpoint.json";
let c={};try{c=JSON.parse(fs.readFileSync(p,"utf8"));}catch(e){}
const [ado,src,graph,track,st,tt,fileCount,modCount,auth,cloud]=process.argv.slice(1);
const dl=c.decision_log||{};
c.schema_version="1.8";
c.ado_id=ado; c.source_path=src; c.phase=c.phase&&c.ado_id===ado?c.phase:"Stage 0.6";
c.stage_gates=c.stage_gates||{options_approved:true,inventory_approved:false,architecture_approved:false,feasibility_approved:false,migration_approved:false,stage4_started:false};
c.mode={graph:graph==="true",track,source_token:st,target_token:tt};
c.contract_version=c.contract_version||1; c.contract_hash=c.contract_hash||"";
c.decision_log={auth:dl.auth||auth||"",data_access:dl.data_access||"",architecture:dl.architecture||"",cloud:dl.cloud||cloud||"",red_items:dl.red_items||[],yellow_count:dl.yellow_count||0,source_file_count:Number(fileCount)||0,source_module_count:Number(modCount)||0};
c.clusters=c.clusters||{};
fs.mkdirSync(".claude",{recursive:true});
fs.writeFileSync(p,JSON.stringify(c,null,2));
console.log("✅ Checkpoint written — phase:",c.phase,"schema:",c.schema_version);
' -- "{ADO_ID}" "{SOURCE_PATH}" "{graph true|false}" "{backend|frontend|upgrade}" "{source-token}" "{target-token}" "{source_file_count}" "{source_module_count}" "{proposed auth intent|}" "{Q2 cloud}"
```

Confirm `.claude/migration-checkpoint.json` is covered by the ignore file (checkpoint files are
never committed — see `$PLUGIN_DIR/skills/shared/checkpoint-schema.md`). If it is NOT ignored,
flag it to the developer and stop before the Step 3.3 `git add .`; do NOT auto-edit the ignore
file (`rules/project-rules.md` forbids modifying it automatically).

---

## Stage 0.6 — Source Behavioral Inventory (human review-gate before rewrite)

Produce a behavioral inventory of the SOURCE that a human reviews and signs off before the target is
built. It is a behavioral discovery — NOT a claimed requirements spec. Depth follows the Stage 0.5
posture: **mechanical port = Light** (feature/endpoint catalog to seed golden-master),
**re-architecture = Medium** (+ business rules & workflows), **rewrite-from-spec = Full** (the design input).

```
Read $PLUGIN_DIR/skills/migration/references/specs/source-inventory-spec.md
```

**Preconditions — fresh source graph (posture-scoped).** The scope manifest, coverage denominator,
and decomposition units all derive from the SOURCE knowledge graph, so:
- **rewrite-from-spec → HARD prerequisite:** a fresh source graph is required. "Fresh" = present at
  `{SOURCE_PATH}/.claude/graph/graph.json`, not `.stale`, and its fingerprint baseline matches the
  source baseline SHA recorded below. Absent/stale → STOP; instruct: run `/graph-sync` in
  `{SOURCE_PATH}` first (on a never-initialised source this is initial graph *creation*, which needs
  the graph scaffolding). Do NOT fall back to directory-structure mode for this posture.
- **re-architecture → recommended:** warn if absent/stale, allow override to heuristic mode.
- **mechanical port → optional:** directory-structure derivation is acceptable (light catalog).

**Scope manifest + baseline (no re-scan).** Build a machine-readable scope manifest from the Step 0.1
analysis — reuse `source_module_count` / `source_file_count` from the checkpoint and the graph
`{modules, hubs, names}`, and add behaviour-bearing node counts (routes/controllers/services/handlers,
per `stacks/{stack}.md`). This one manifest feeds three consumers: the context-budget signal, the
absolute-scope gate, and the §3 coverage denominator. Record the source baseline
`git -C {SOURCE_PATH} rev-parse HEAD` (or a timestamp if not a git repo) in the doc header.

**Two independent scope checks — different axes, run BOTH:**
1. **Context-budget check** (shared `context-budget-check.md`) — *session-depth* risk; reuse Step 0.1
   counts, do NOT re-scan.
2. **Absolute-scope gate** (Stage-0.6-specific — NOT the budget check) — *source size vs. single-pass
   read capacity*, evaluated even in a fresh session. The gate trips (→ decompose) if **ANY** of these
   measured signals exceed threshold — cluster count is not the only knob, because 6 *huge* modules
   would otherwise slip through as "small":
   - `source_module_count` > **6** clusters, OR
   - `source_file_count` > **60** behaviour-bearing source files, OR
   - the manifest's behaviour-bearing node count (routes/controllers/services/handlers) > **80**, OR
   - the largest single cluster's file count alone would not fit a single honest read pass.

   When the gate trips, the **index + one file per cluster layout is MANDATORY** — not a judgement
   call. (Thresholds are heuristics tuned to keep one pass within a fresh context's read budget; when
   any measured signal is borderline, decompose — the lower-risk choice.) Decomposition unit = graph
   module / bounded context (the unit Stage 3.1 uses); decompose along bounded contexts / vertical
   slices, never
   horizontal layers.

**Decomposition — orchestrator + per-cluster sub-agents (when the absolute-scope gate trips).**
Context isolation is the root fix for exhaustion-driven confabulation, so a large inventory is NOT
extracted in one accumulating context. Mirror the Stage 4 cluster model:
- **Small scope (gate not tripped):** extract in the main context, single file — unchanged.
- **Large scope (gate tripped):** the ORCHESTRATOR spawns one sub-agent per cluster. Each sub-agent
  receives ONLY its cluster's source file list (the graph module assignment) and returns a STRUCTURED
  fragment — §5 feature rows + §6 rules, each carrying a confidence tier, a `PROV:` token, and (for
  INFERRED / high-risk) Given/When/Then with verbatim outcomes. A fresh context per cluster = full
  read budget per cluster, so each agent can actually read the lines it cites.
- **Orchestrator owns everything cross-cutting** — §1 roll-ups, §4 actor map, §7 cross-cluster entity
  relationships, §8 integrations, §9 auth/authz, and the consolidated §11 — which a slice-scoped agent
  cannot see. It also assigns the global `F-NN` IDs post-collection (parallel agents must NOT
  self-assign — collision) and runs a stitch pass for features that span clusters.
- **Per-fragment trace-verify-before-merge:** run
  `$PLUGIN_DIR/tests/migration-validation/verify-inventory-trace.cjs` on each returned fragment
  against that cluster's assigned file set BEFORE merging it into the index (the script ships with
  the plugin — it is NOT in the TARGET repo, so it MUST be invoked via the resolved `$PLUGIN_DIR`,
  never a bare relative path; a bare path resolves against the target CWD and fails file-not-found)
  (mirrors Stage 4's
  build/test-before-merge). A fragment with a missing-file / out-of-range PROV token is rejected back
  to its agent, not merged. Isolation removes the exhaustion vector; the verifier removes the
  wrong-citation vector.

**No silent caps + coverage reconciliation (mandatory, before the gate).** The manifest is the
denominator; §5 is the numerator. After extraction and before presenting the Stage 0.6 gate, the
orchestrator MUST reconcile them explicitly: enumerate every manifest entity — each behaviour-bearing
node (route/controller/service/handler) and each data entity — and confirm it maps to at least one
§5 feature-ID. Any manifest item with **zero** §5 coverage is either (a) inventoried, or (b) recorded
in §3 as a named skipped cluster AND logged as a §11 GAP (`type: coverage-gap`) — never dropped
silently. §1/§3 then state the true `covered / total` counts from this reconciliation, not an
estimate. If budget forced a subset, inventory the top-N clusters by importance and list every
un-inventoried cluster in §3 — so any un-inventoried cluster is a reconciled, visible gap. (This is
a deterministic-in-principle check: the per-fragment trace verifier flags dangling feature-IDs, but
the manifest-vs-§5 reconciliation is the orchestrator's responsibility because only it holds the
consolidated manifest.)

Write the inventory per the spec (planning doc — no Write Gate). **Output layout by scope:** a
small/module inventory is one file `docs/.../ADO-{ADO_ID}-source-inventory.md`; a large/whole-app
inventory is an **index + one file per cluster** (`…-source-inventory-{cluster}.md`) per the spec's
Output Organization, so the review stays tractable one cluster at a time. Every
item carries a confidence tier (OBSERVED / STATIC / INFERRED) + a machine-readable `PROV:` provenance
token (spec § Machine-readable provenance token); INFERRED is
never presented as a confirmed requirement. Mask PII values (names/shapes only). Populate §10
(Cannot Be Derived — stakeholder questions) honestly; never fabricate NFRs / rationale / priorities.
Log any code you saw but could not resolve statically to the **Gaps Report (§11)** (with `file:line`
+ how to resolve it) — never as a guessed behaviour. Express INFERRED / high-risk behaviours as
Given/When/Then with outcomes quoted **verbatim** (exact status codes / error strings / thresholds),
and cover error/edge paths, not just the happy path.

**Framework-fact self-learning.** When tiering a declarative outcome STATIC required web-grounding a
framework attribute's guaranteed behaviour (spec Tier cut-line, step 2), the ORCHESTRATOR writes a
`Framework-fact` entry to the repo-root `memory/MEMORY.md` — `attribute · framework@version ·
guaranteed outcome · official-doc URL · date` — so `/dream` can propose promoting it into the
`stacks/{stack}.md` LEARNED block for reuse by later runs. **No official-doc URL → do not write it**
(it stays a per-run INFERRED). Reuse a grounded fact within the same run without re-searching. Never
write to `stacks/*.md` directly from a migration run — promotion is `/dream`'s job (the review gate).

### Stage 0.6 Gate
Present the gate banner from the spec and STOP. The reviewer dispositions the **Review Focus** set
(all INFERRED business rules, all high-risk/high-impact features, all §10 stakeholder questions, and
all open Gaps Report items) in the document, then replies `APPROVE INVENTORY ADO-{ADO_ID}`.

- **rewrite-from-spec:** approval is REQUIRED and BLOCKS Stage 1 — the architecture is designed FROM
  the approved inventory.
- **re-architecture:** approval recommended; the inventory is the behavior-preservation contract.
- **mechanical port:** optional/light — informs feasibility and seeds golden-master; does not block
  (may proceed to Stage 1 without `APPROVE INVENTORY`).

On `APPROVE INVENTORY ADO-{ADO_ID}`: update the checkpoint (merge) with
`stage_gates.inventory_approved = true` and `phase = "Stage 1"`.

---

## Stage 1 — Design Target Architecture

**Rewrite-from-spec gate:** if the Stage 0.5 posture is rewrite-from-spec, require
`stage_gates.inventory_approved = true` before designing — STOP and point the developer to
`MIGRATE INVENTORY ADO-{ADO_ID}` / `APPROVE INVENTORY ADO-{ADO_ID}` if not. Design the architecture
FROM the approved Source Behavioral Inventory (its feature IDs are the spine). For
port/re-architecture the inventory is input but not a hard gate.

### Step 1.0 — Context budget check + resume

**Resume path** — if this stage was entered via `MIGRATE ARCH ADO-{ADO_ID}` (a fresh session
after `/compact` or a new session): read `.claude/migration-checkpoint.json`, restore the
identifiers + `decision_log` + `mode` from it, load the source/target stack references and
`phase1-architecture-spec.md` from disk, then jump straight to Step 1.2. Do NOT re-run the Stage 0
source-detection scans and do NOT re-read source architecture docs unless a specific document
genuinely needs fresh source detail.

**Budget check** — otherwise, before loading the 500-line spec or generating anything, measure the
source size (reuse the Step 0.1 counts — do NOT re-run `find`) and run the shared check:

```
Read $PLUGIN_DIR/skills/shared/context-budget-check.md and execute it with:
  operation_name    = "Stage 1 — architecture design (5 documents)"
  size_signal       = {source_module_count + source_file_count; heuristic mode = file count only}
  size_label        = "Source: {N} modules / {M} files"
  threshold_medium  = 40
  threshold_high    = 120
  recovery_command  = "MIGRATE ARCH ADO-{ADO_ID}"
  skip_keywords     = ["MIGRATE ARCH ADO-"]
  operation_needs   = ["read source graph + selective source files",
                       "generate 5 architecture docs with Mermaid diagrams + ADRs"]
  risks_if_continue = ["truncated or placeholder Mermaid diagrams",
                       "missing ADR sections",
                       "inconsistent tech-stack decisions across the 5 docs"]
  saved_context     = "Stage 0 decisions are in .claude/migration-checkpoint.json; nothing generated yet"
```

On `BUDGET_WARN` / `BUDGET_STOP`, stop and wait for the developer. On `BUDGET_OK` /
`BUDGET_SKIPPED`, proceed.

Load architecture document specifications:
```
Read $PLUGIN_DIR/skills/migration/references/specs/phase1-architecture-spec.md
```

Stage 1 produces ALL architecture documents in one comprehensive design pass.
Each document is written to `docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/` (planning docs — no Write Gate).

### Step 1.1 — Read source in detail

Read source architecture docs from SOURCE_PATH (already registered in additionalDirectories):
- Read bounded context boundaries from source graph
- Identify key entities, services, and their relationships
- Identify external integrations (database, cache, message queue, auth provider, APIs)
- Identify cross-cutting concerns (logging, auth, error handling)

If source architecture docs exist at `{SOURCE_PATH}/.claude/architecture/`: read them.
If not: derive from source graph + selective source file reads (Consent: A).

If the AI needs a specific decision during source analysis that it cannot infer: stop and ask that one question. Example:
```
I see the source has two separate authentication flows — one for web users and one for API clients.
Should the target maintain both (A), or consolidate to a single auth strategy (B)?
```

### Step 1.2 — Produce target architecture documents

Load architecture document spec:
```
Read $PLUGIN_DIR/skills/migration/references/specs/phase1-architecture-spec.md
```

Generate the following documents. Each one is written as a complete, standalone document.
All diagrams MUST be in Mermaid format — no inline ASCII art, no described diagrams.
Each architectural component MUST have an ADR section.

**ADR format (required for every significant component):**
```markdown
### [Component Name]

**What it does:** [one sentence]

**Recommendation:** [chosen approach]

**Why this approach:**
| Option | Verdict | Reason |
|---|---|---|
| [Option A] | Rejected | [reason] |
| [Option B] | Rejected | [reason] |
| **[Chosen option]** | **Chosen** | [reason — tie to source analysis] |

**Benefits for this migration:**
- [specific benefit grounded in source app's characteristics]
- [second benefit]
```

---

**Document 1: `COMPONENT-ARCHITECTURE.md`**

Sections:
1. System Overview — what the application does; primary actors
2. Technology Stack — final confirmed stack (runtime, framework, database, cache, auth, logging)
3. Component Inventory — table: name | responsibility | layer | source origin (which source cluster)
4. Component Interaction Diagram — Mermaid C4 Level 2:
   ```mermaid
   C4Context / C4Component diagram showing all bounded contexts,
   their connections (sync vs async), and external dependencies
   ```
5. Layer Architecture — pattern chosen (simplified / four-layer), layer map with dependency arrows
6. External Dependencies — IdP, Key Vault, Redis, Service Bus, external APIs
7. ADR per component (above format)

---

**Document 2: `DATA-ARCHITECTURE.md`**

Sections:
1. Data Strategy — data access approach (Dapper / EF Core / JPA) with ADR
2. Entity Map — key domain entities from source, how they map to target
3. Entity Relationship Diagram — Mermaid ER diagram:
   ```mermaid
   erDiagram
     [entities and relationships derived from source analysis]
   ```
4. Data Flow Diagram — Mermaid sequence showing how data moves from API to DB and back
5. PII Inventory — if PII detected in source, list fields requiring protection
6. Schema Migration Approach — how existing DB schema is handled (EF Core baseline / DbUp / Flyway)
7. ADR for data access pattern

---

**Document 3: `SECURITY-ARCHITECTURE.md`**

Sections:
1. Authentication Strategy — provider chosen (derived from source auth pattern + target stack + cloud)
   - If source uses Spring Security JWT: propose .NET bearer with same JWT structure
   - If source uses session auth: propose JWT bearer (stateless is preferred for modern apps)
   - If source uses API keys: propose API key authentication handler
   - Ask developer if the proposed auth doesn't match their intent
2. Authentication Flow Diagram — Mermaid sequence diagram:
   ```mermaid
   sequenceDiagram
     [end-to-end auth flow: client → IdP → API → response]
   ```
3. Authorization Model — roles, claims, policies (derived from source permission patterns)
4. Secrets Management — where secrets live (Key Vault / AWS Secrets Manager / env vars, based on Q2 cloud)
5. Data Protection — encryption at rest (if PII found in source), TLS enforcement
6. ADR for authentication strategy

---

**Document 4: `INFRASTRUCTURE-ARCHITECTURE.md`**

Sections:
1. Environment Map — dev / staging / prod (standard for the cloud chosen in Q2)
2. Hosting Topology Diagram — Mermaid deployment diagram:
   ```mermaid
   graph TB
     [where each component runs: App Service / AKS / on-prem,
      how they connect, what sits in the DMZ]
   ```
3. CI/CD Pipeline Outline — standard pipeline for the target cloud (stages: build → test → deploy)
4. External Service Connections — database, cache, secrets vault, message queue
5. Health Monitoring — health check endpoints, alerting approach
6. ADR for hosting model

---

**Document 5: `ARCHITECTURE-DECISIONS.md`**

Running log of all significant architectural decisions made during this migration.
Populated from ADR sections in docs 1–4 above, plus any additional decisions surfaced during migration.

Format per entry:
```markdown
## ADR-{N}: {Decision title}
Date: {date}
Status: Accepted

### Context
[what drove this decision — source app characteristics, target requirements]

### Decision
[what was decided]

### Options Considered
| Option | Verdict | Reason |
|---|---|---|
| ... | ... | ... |

### Consequences
[what this means for the migration and the resulting app]
```

---

**Write all five documents** in one pass. Use Mermaid for ALL diagrams.
If any diagram cannot be generated without additional information: insert a placeholder
`[DIAGRAM PENDING — {specific question}]` and ask the developer.

### Step 1.3 — Present for review

After writing all documents:
```
ARCHITECTURE DESIGN COMPLETE — ADO-{ADO_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Documents written to docs/.../

  ✅ COMPONENT-ARCHITECTURE.md   — {N} components, {N} Mermaid diagrams
  ✅ DATA-ARCHITECTURE.md        — {N} entities, ER diagram
  ✅ SECURITY-ARCHITECTURE.md    — Auth: {proposed strategy}
  ✅ INFRASTRUCTURE-ARCHITECTURE.md — Hosting: {proposed model}
  ✅ ARCHITECTURE-DECISIONS.md   — {N} ADRs

Please review the documents and diagrams.
Mermaid diagrams render in VS Code (Markdown Preview Enhanced) or mermaid.live

Reply APPROVE ARCHITECTURE ADO-{ADO_ID} to proceed to feasibility assessment.
Or request changes: "Revise the auth strategy to use Entra ID instead"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Support revision requests before the gate. Re-generate only the affected document and diagram.
A revision request is a same-session continuation — it does NOT re-run the Step 1.0 budget check.
Only `APPROVE ARCHITECTURE ADO-{ADO_ID}` advances to Stage 2.

On `APPROVE ARCHITECTURE ADO-{ADO_ID}`: update `.claude/migration-checkpoint.json` (merge — keep
existing fields) with `stage_gates.architecture_approved = true`, `phase = "Stage 2"`, and populate
`decision_log.auth` / `data_access` / `architecture` / `cloud` from the approved documents, before
entering Stage 2.

---

## Stage 2 — Migration Feasibility Assessment

### Step 2.0 — Context budget check + resume

**Resume path** — if entered via `MIGRATE FEAS ADO-{ADO_ID}`: read the checkpoint. If
`stage_gates.architecture_approved` is not `true`, STOP and tell the developer to run
`MIGRATE ARCH ADO-{ADO_ID}` first (feasibility needs the approved architecture as input). Otherwise
read the 5 approved architecture docs from `docs/.../` and `feasibility-spec.md` from disk — do NOT
re-read the source spec or re-run Stage 0 scans — then proceed to feasibility generation.

**Budget check** — otherwise, measure the accumulated architecture-doc size and run the shared check:

```bash
FEAS_SIGNAL=$(cat docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/COMPONENT-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/DATA-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/SECURITY-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/INFRASTRUCTURE-ARCHITECTURE.md \
  docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/ARCHITECTURE-DECISIONS.md 2>/dev/null | wc -l)
```

```
Read $PLUGIN_DIR/skills/shared/context-budget-check.md and execute it with:
  operation_name    = "Stage 2 — feasibility assessment"
  size_signal       = {FEAS_SIGNAL}
  size_label        = "Approved architecture: {FEAS_SIGNAL} lines across 5 docs"
  threshold_medium  = 800
  threshold_high    = 2000
  recovery_command  = "MIGRATE FEAS ADO-{ADO_ID}"
  skip_keywords     = ["MIGRATE FEAS ADO-"]
  operation_needs   = ["read 5 approved architecture docs",
                       "run dependency version checks",
                       "generate GREEN/YELLOW/RED/BLOCKER feasibility doc"]
  risks_if_continue = ["under-counted RED items",
                       "missing resolution options on RED items",
                       "GREEN mislabelled without verification"]
  saved_context     = "Approved architecture docs are on disk in docs/...; the Stage 1 gate is recorded in the checkpoint"
```

On `BUDGET_WARN` / `BUDGET_STOP`, stop and wait. On `BUDGET_OK` / `BUDGET_SKIPPED`, proceed.

Load feasibility spec:
```
Read $PLUGIN_DIR/skills/migration/references/specs/feasibility-spec.md
```

Now that the target architecture is approved, assess what it takes to get FROM the source TO that architecture.

If a Stage 0.6 Source Behavioral Inventory exists, drive the assessment from its feature catalog —
map each feature ID to GREEN/YELLOW/RED and record the feature ID against each item — rather than
re-scanning the source. The inventory is the source-behavior lens; this feasibility is the
migration-difficulty lens over the same features.

Write `docs/.../ADO-{ADO_ID}-migration-feasibility.md` (planning doc, no Write Gate).

### Honesty rules
- NEVER classify as GREEN without verification — UNKNOWN is honest, GREEN is a commitment
- Every RED must have at least one resolution option. No path exists = BLOCKER
- "Compiles" ≠ "behaves identically" — call out behavioral risk on every YELLOW and RED
- Dependency verification: run `dotnet list package --outdated` / `mvn versions:display-dependency-updates` / `npm outdated`

### Behavioral risk scale
INFORMATIONAL · MEDIUM · HIGH · BLOCKER
Worst-case rule: component rating = worst sub-item rating.

### Document sections

Use parity tables from loaded stack and mapping reference files:

**1. Executive Summary** — source → approved target, tooling BLOCKERs, GREEN/YELLOW/RED/BLOCKER counts, overall verdict (STRAIGHTFORWARD / MODERATE / HIGH-RISK / has BLOCKERS).

**2. GREEN — Migrates Cleanly** — from mapping file GREEN table (stack-specific).

**3. YELLOW — Needs Rework** — from mapping file YELLOW table.
Each row: Component | What changes | Effort S/M/L | Behavioral risk level.
Include architecture-specific items: "Entra ID setup requires Microsoft.Identity.Web package — M effort, LOW risk."

**4. RED — Will Break** — from mapping file RED table.
Each item: What breaks & why · Options (2–3 with tradeoffs + reversibility) · Recommendation · Behavioral risk level.

**5. Blockers** — no viable resolution under current constraints. Include tooling BLOCKERs.

**6. Dependency Ledger** — every package (NuGet / Maven / npm): Package | Current ver | Target status | Action.

**7. Architecture Alignment** — how each approved architecture decision affects migration effort:
- Auth strategy → specific packages and config patterns required
- Hosting decision → connection string format, health check targets
- Data access → Dapper SQL generation vs EF Core vs JPA migration scope

Load EF6 reference if detected:
```
Read $PLUGIN_DIR/skills/migration/references/shared/ef6-to-efcore.md
```

### Stage 2 Gate
```
FEASIBILITY SUMMARY — ADO-{ADO_ID}
  GREEN: {N} · YELLOW: {N} · RED: {N} · BLOCKERS: {N}
  Verdict: {STRAIGHTFORWARD / MODERATE / HIGH-RISK / has BLOCKERS}

{BLOCKERs must be resolved before proceeding}

Reply APPROVE FEASIBILITY ADO-{ADO_ID} to proceed to cluster planning.
```

On `APPROVE FEASIBILITY ADO-{ADO_ID}`: update the checkpoint (merge) with
`stage_gates.feasibility_approved = true`, `phase = "Stage 3"`, and set `decision_log.red_items`
and `decision_log.yellow_count` from the feasibility document.

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

**6. Migration Tracker** — write to `docs/.../ADO-{ADO_ID}-migration.tracker.md`:
```markdown
| Cluster | Files | Status | Branch | Date |
|---|---|---|---|---|
| SharedKernel | {N} | ⏳ Pending | | |
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
  ✅ docs/.../ADO-{ADO_ID}-migration.tracker.md

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
  "schema_version": "1.8",
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

For each completed cluster:
- `status = complete AND build_status = passed AND test_status = passed` → merge branch to main
- `build_status = failed` → STOP that cluster, report to developer
  ```
  ❌ Cluster {name} build failed.
  Reply RETRY CLUSTER {name} ADO-{ADO_ID} to re-run, or
  review files_written manually, fix issues, then RETRY.
  ```
- `files_outside_scope` is non-empty → flag for review before merge

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

Update tracker: mark clusters ✅ Done, then `git tag stage4-complete`. (This is a `backend`/`upgrade`
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
Update the tracker: mark frontend clusters ✅ Done. Frontend *behavioural* verification is the
Playwright suite (Stage 5.3 / 6.2), keyed to the same feature-IDs — golden-master (Stage 5.0) covers
the API level only.

---

## Stage 5 — Test Coverage

### Step 5.0 — Golden-master behavioral verification (external oracle)

Capture an INDEPENDENT behavioral oracle from the running SOURCE and replay it against the TARGET.
This is stronger than characterization tests (which the migrating agent writes from its own
reading of the source) because the oracle is recorded from the real source, not inferred.

```
Read $PLUGIN_DIR/skills/migration/references/specs/golden-master-spec.md
```

**Staging note — this step spans two points in the flow; do NOT try to complete it in one sitting
at 5.0.** At Step 5.0 you only decide runnability (Step 1) and **capture** the recordings from the
SOURCE (Step 2) — the TARGET is not built yet, so there is nothing to replay against. The **replay +
diff + report** (Steps 3–4) run **after the Stage 6.1 Release build**; return here from Step 6.1 to
execute them. Concretely: decide whether the source can run (Step 1), record request→response
recordings from SOURCE (Step 2) now; then AFTER Step 6.1, replay against the built TARGET (Step 3)
and write `docs/.../ADO-{ADO_ID}-golden-master-report.md` (Step 4). The replay harness is a script —
the LLM writes it and reads the summary, no LLM during the run.

- If the source cannot be run: SKIP capture and record `⚠ No external oracle — parity is INFERRED
  only` in the report and the checkpoint `decision_log`. Do NOT claim behavioral parity.
- Any `drift` on a HIGH-risk item or any `error` → carry to the Stage 6 completion gate: the
  migration is NOT COMPLETE until each is explained (linked to a feasibility RED/YELLOW) or
  explicitly accepted with a recorded reason.

The migration posture from Stage 0.5 selects the oracle basis: port/re-architecture judges drift
against source behaviour; rewrite-from-spec judges it against the feature-parity inventory.

Where a Stage 0.6 Source Behavioral Inventory exists, its GM-verifiable INFERRED items and its
`run-the-source` gaps are the recordings to prioritise; each recording carries the item's
`feature_id`/`gap_id`. Record verdicts in the golden-master **report** (verified / gap-resolved /
drift) and APPEND a "Stage 5.0 verification results" note to the inventory's §13 Review Log — do NOT
rewrite the approved §5/§11 (the signed inventory is an immutable baseline). Internal rules the
inventory marks human-verify-only are out of golden-master scope.

### Step 5.1 — Characterization tests (verify behavioral preservation)

These tests document SOURCE behavior and verify the migrated code preserves it.
They run against the TARGET code — not the source.

For each YELLOW / RED item from Stage 2 feasibility:
1. Read source behavior by reading `{SOURCE_PATH}` files
2. Write the test in the profile `TEST_FRAMEWORK` at the profile `LAYOUT` characterization/unit-tests path
3. Mark: `// CHARACTERIZATION: {literal | inferred} — {behavior description}`

Write Gate: `APPROVE MIGRATION ADO-{ADO_ID}`.
After writing: `git add && git commit -m "test(characterization): behavioral contract [ADO-{ADO_ID}]"`

If no HIGH/MEDIUM risk items: skip.

### Step 5.2 — Unit tests per layer

Follow the profile `TEST_FRAMEWORK`.

Risk-aligned coverage targets (enforced):
| Layer | Target | FAIL threshold |
|---|---|---|
| Domain / pure logic | 95%+ | <90% → STOP |
| Application / use cases | 90%+ | <85% → STOP |
| Infrastructure / I/O | 70%+ | <60% → STOP |
| Host / bootstrap | excluded | N/A |

**Measure coverage — the thresholds above are enforced only if measured. Never assert a
percentage you did not measure.** Run the profile `COVERAGE` command(s), parse the report as the
profile specifies, and compare per-layer line coverage to the table. Any layer below its FAIL
threshold → STOP and report which layer + the measured %.

### Step 5.3 — E2E tests (Playwright — generated from migration knowledge)

Install and configure the profile `E2E` harness. Then generate the test files from migration
knowledge (no LLM involvement during execution):
- `tests/e2e/health.spec.ts` — from INFRASTRUCTURE-ARCHITECTURE.md health check config
- `tests/e2e/auth.spec.ts` — from SECURITY-ARCHITECTURE.md auth flow
- `tests/e2e/api-contract.spec.ts` — from integration-contract.md (one test per endpoint)
- `tests/e2e/navigation.spec.ts` — from the Angular routing module (frontend run)
- `tests/e2e/forms.spec.ts` — from cluster specs with data-testid attributes

Configure the E2E harness headless with screenshot-on-failure (per the profile `E2E`).

Write Gate: `APPROVE MIGRATION ADO-{ADO_ID}`.
After writing: `git add && git commit -m "test(e2e): Playwright tests [ADO-{ADO_ID}]"`

---

## Stage 6 — Verification

### Step 6.1 — Full build + unit tests

```
{profile BUILD — Release}
{profile TEST_ALL}
```

**After a green Release build — run the deferred golden-master replay (Step 5.0, Steps 3–4).** The
recordings captured at Step 5.0 now have a built TARGET to replay against: execute the replay + diff,
write `docs/.../ADO-{ADO_ID}-golden-master-report.md`, and carry any HIGH-risk drift / error to the
Step 6.5 completion gate. (Skip only if Step 5.0 recorded `⚠ No external oracle`.)

### Step 6.2 — Automated E2E (Playwright — headless, no LLM during execution)

Pre-flight: run the profile `CONFIG` check — fail if the target's dev config still holds placeholder
connection strings/URLs.

Start the target using the profile `SERVE` (+ health probe). A **backend run** serves the backend; a
**frontend run** serves the Angular app and points it at the **consumed contract's backend URL** (the
published/existing backend it talks to). Acquire a test token per the approved SECURITY-ARCHITECTURE.md
auth strategy (Entra ID client_credentials / custom-JWT endpoint / API-key env var / none).

Run the profile `E2E` harness headless, then stop the started process(es). A non-zero exit → E2E
failed (see the harness report).

### Step 6.3 — Architecture fitness (if developer chose Yes during architecture review)

```
{profile FITNESS}
```

### Step 6.4 — Visual Verification Checklist (for developer)

Generate checklist based on what was migrated:
```markdown
## Visual Verification Required — ADO-{ADO_ID}
Start: {profile SERVE — dev-run command}  (frontend run: `ng serve` + the consumed backend URL)

  [ ] Sign in via {auth strategy} — confirm redirect + dashboard
  [ ] {ClusterA} list — data renders, no blank/error state
  [ ] {ClusterA} create form — fills, validates, submits, success message
  [ ] Error state — trigger validation error, confirm message visible
  [ ] Health: {profile SERVE — health endpoint} → healthy
```

Run `/verify` for interactive browser-driven testing.

### Step 6.5 — Generate MIGRATION-REPORT.md

Load spec:
```
Read $PLUGIN_DIR/skills/migration/references/specs/migration-report-spec.md
```

Write `docs/.../ADO-{ADO_ID}-migration-report.md`.
Update `migration.tracker.md`: Status → COMPLETE.

### Completion

```
✅ MIGRATION COMPLETE — ADO-{ADO_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Source:    {SOURCE_PATH} ({source stack})
  Target:    . ({target stack})
  Clusters:  {N} migrated · {N branches merged}
  Tests:     {N} passing
  E2E:       {N} passing (headless Playwright)
  Golden-master: {N} match · {N} drift (all explained) · coverage {FULL|PARTIAL|INFERRED}
  Coverage:  {backend%} {| frontend%}

  Architecture docs:
  • docs/.../COMPONENT-ARCHITECTURE.md
  • docs/.../DATA-ARCHITECTURE.md
  • docs/.../SECURITY-ARCHITECTURE.md
  • docs/.../INFRASTRUCTURE-ARCHITECTURE.md
  • docs/.../ARCHITECTURE-DECISIONS.md

  Next:
  1. /setup-init — completes the full rule set (project + {target} language rules were already
     deployed at Step 3.3a), builds the knowledge graph, and populates architecture docs
  2. /graph-sync — builds knowledge graph for new codebase
  3. Complete visual verification checklist
  4. Populate the profile CONFIG dev file (e.g. connection strings) with real values
  5. {SOURCE_PATH} remains in additionalDirectories until validated

  Cleanup: rm .claude/migration-checkpoint.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Hard Rules

NEVER write generated code to current directory without `APPROVE MIGRATION ADO-{ID}`.
NEVER skip Stage 0.5 target-options analysis except for a pure `dotnet` version upgrade — the recommendation ADR is the rewrite decision record.
NEVER begin Stage 1 architecture for a rewrite-from-spec posture without an APPROVED Stage 0.6 Source Behavioral Inventory — the human review of that document gates the rewrite.
NEVER present an INFERRED inventory item as a confirmed requirement, and NEVER fabricate the §10 "Cannot Be Derived From Code" items — code carries no NFRs, rationale, or priorities.
NEVER drop or guess code you couldn't resolve statically — log it in the inventory Gaps Report (§11) with `file:line` + how to resolve it (ask a dev / run the source via golden-master / check runtime config).
NEVER skip Stage 1 architecture design — the architecture docs are the governance substitute for ICEA.
NEVER report MIGRATION COMPLETE with unexplained HIGH-risk golden-master drift; if the source could not run, label behavioral parity INFERRED rather than claiming it.
NEVER fabricate a parity table for a stack with no migration mapping reference — STOP and offer to scaffold the reference.
NEVER run a target's build/test/serve toolchain without loading its execution profile from `references/strategies/{target_token}.md`; a missing or `STATUS: not-implemented` profile → STOP (no cross-stack fallback).
NEVER generate target code from a profile whose `MATURITY` line is `⚠ Unverified` (java-spring / python / react today) without surfacing that and getting the developer's explicit go-ahead — `STATUS: implemented` alone does NOT mean the profile was validated end-to-end.
ALWAYS invoke plugin-shipped scripts (e.g. `tests/migration-validation/verify-inventory-trace.cjs`) via the resolved `$PLUGIN_DIR` — never a bare relative path (CWD is the TARGET repo, which does not contain them).
ALWAYS deploy the target guardrail rules (`project-rules.md` + the target language rule) to `.claude/rules/` at Step 3.3a — before Stage 4 — and have each cluster agent read them, so generated code is governed by the enforced rules rather than only the ~20-line standards summary.
NEVER auto-proceed past any stage gate.
NEVER offer a fallback for unsupported source stacks — STOP with a clear error.
NEVER migrate + refactor + change behaviour in one step — separate each concern.
NEVER assume when ambiguous — stop and ask the specific question at the specific decision point.
NEVER use EF Core if CLAUDE.md contains a "Dapper only" rule.
NEVER skip Mermaid diagrams — all architecture diagrams must be in Mermaid format.
NEVER write secrets or connection strings to any document — placeholders only.
NEVER read source files from . (current dir is TARGET) — always read from SOURCE_PATH.
NEVER use .Result or .Wait() in .NET async code.
NEVER forget @Transactional on Java write methods — silent data loss.
NEVER subscribe to Angular Observables without takeUntilDestroyed() or toSignal().
ALWAYS produce an ADR for every significant architecture component in Stage 1.
ALWAYS commit skeleton to TARGET main before spawning any cluster agent.
ALWAYS register SOURCE_PATH in additionalDirectories in Step 0.
ALWAYS check the consumed integration-contract hash before every cluster in a `frontend` run (Step 4.3a).
A full-stack migration is TWO coordinated single-track runs — a `backend` run that PUBLISHES the contract, then a separate `frontend` run that CONSUMES it; NEVER migrate backend + frontend in one run.
A `frontend` run calls the API only through the generated client (never hand-rolled URLs) and never edits the contract (the backend owns it).
ALWAYS run /setup-init and /graph-sync in current directory at Stage 6 completion.

---

## Reference Files

```
# Always — plugin infrastructure
$PLUGIN_DIR/skills/shared/plugin-path-resolution.md
$PLUGIN_DIR/skills/shared/write-gate-spec.md
$PLUGIN_DIR/skills/shared/context-budget-check.md
$PLUGIN_DIR/skills/shared/checkpoint-schema.md
$PLUGIN_DIR/skills/shared/source-file-consent.md
$PLUGIN_DIR/skills/shared/model-routing-spec.md
$PLUGIN_DIR/skills/shared/personas-spec.md
$PLUGIN_DIR/skills/shared/interactive-menu-spec.md

# Loaded after Stage 0 source confirmed
$PLUGIN_DIR/skills/migration/references/stacks/{source-token}.md

# Loaded after Stage 0 target confirmed
$PLUGIN_DIR/skills/migration/references/stacks/{target-token}.md
$PLUGIN_DIR/skills/migration/references/mappings/{pair}.md  (if exists)
$PLUGIN_DIR/skills/migration/references/shared/clean-architecture.md

# Loaded at Stage 0.5 (target options analysis — skipped for dotnet version upgrade)
$PLUGIN_DIR/skills/migration/references/specs/target-options-spec.md

# Loaded at Stage 0.6 (source behavioral inventory — human review-gate before rewrite)
$PLUGIN_DIR/skills/migration/references/specs/source-inventory-spec.md

# Loaded at Stage 1 start
$PLUGIN_DIR/skills/migration/references/specs/phase1-architecture-spec.md

# Conditionally loaded
$PLUGIN_DIR/skills/migration/references/shared/ef6-to-efcore.md      (if EF6/.edmx)
$PLUGIN_DIR/skills/migration/references/shared/fullstack-integration.md  (backend run publishing, or frontend run consuming, a contract)

# Loaded at Stage 2
$PLUGIN_DIR/skills/migration/references/specs/feasibility-spec.md

# Loaded at Stage 4 start (target execution profile — keyed on mode.target_token; one profile per run)
$PLUGIN_DIR/skills/migration/references/strategies/{target-token}.md
$PLUGIN_DIR/skills/migration/references/strategies/README.md  (token contract — for adding a target)

# Loaded at Stage 5.0 (golden-master behavioral verification)
$PLUGIN_DIR/skills/migration/references/specs/golden-master-spec.md

# Loaded at Stage 6.5
$PLUGIN_DIR/skills/migration/references/specs/migration-report-spec.md

# DO NOT load docs/migration-architecture.md — human reference only
# Stage 4 cluster agents DO NOT load reference files — execute from TARGET-ARCHITECTURE.md
#
# Checkpoint (.claude/migration-checkpoint.json, schema 1.8) is written at Step 0.4 and updated
# (merged) at each stage gate — it is the resume anchor for MIGRATE ARCH/FEAS/CLUSTERS/RESUME.
# The context-budget check (context-budget-check.md) runs at Steps 1.0, 2.0, 3.0 and 4.0.
```
