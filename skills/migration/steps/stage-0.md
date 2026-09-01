# Migration Step — Stage 0: Understand the Source & Confirm Target

_Part of the `migration` skill. Loaded and dispatched by the orchestrator
(`skills/migration/SKILL.md`) — not a standalone/registered skill. Cross-session resume: `MIGRATE ADO-{ID}`._

**Persona:** [SA] Rafael Mendes — Solution Architect (orchestrator persona map · personas-spec.md).
**Model tier:** `${ICEA_MODEL:-claude-opus-4-8}`.
**Checkpoint:** single source of truth (`.claude/migration-checkpoint.json`, schema 1.9); this step
seeds it at Step 0.4 — never clobbering `decision_log`/`clusters`.

> Stage 0.5 (Target Options Analysis, invoked before Q1 in Step 0.3) is its own step file:
> `steps/stage-0.5-options.md`.

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
> 5. **How to verify:** `cat .claude/migration-checkpoint.json` — confirm `schema_version:"1.9"`,
>    `phase:"Stage 0.6"`, `stage_gates.options_approved:true` (and `inventory_approved:false`), and
>    your Stage-0 answers under `mode`/`decision_log`.

```bash
node -e '
const fs=require("fs");
const p=".claude/migration-checkpoint.json";
let c={};try{c=JSON.parse(fs.readFileSync(p,"utf8"));}catch(e){}
const [ado,src,graph,track,st,tt,fileCount,modCount,auth,cloud]=process.argv.slice(1);
const dl=c.decision_log||{};
c.schema_version="1.9";
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

