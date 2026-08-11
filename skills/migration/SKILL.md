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

_Skill version: 1.6 · Last changed: 2026-08-11 · Plugin compatibility: ≥3.13.0 · Consent: A_

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

- Stage 0–1 (architecture): `${ICEA_MODEL:-claude-opus-4-6}`
- Stage 2 (feasibility analysis): `${REVIEW_MODEL:-claude-sonnet-4-6}`
- Stage 3 (cluster planning): `${ICEA_MODEL:-claude-opus-4-6}`
- Stage 4+ (code generation): `${ICEA_MODEL:-claude-opus-4-6}`
- Verification: `${REVIEW_MODEL:-claude-sonnet-4-6}`

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
git rev-parse --is-inside-work-tree 2>/dev/null || {
  git init && git commit --allow-empty -m "Initial commit — migration target"
  echo "✅ Git initialized in current directory"
}
```

**Verify SOURCE_PATH:**
```bash
[ -d "{SOURCE_PATH}" ] || { echo "❌ Source path does not exist: {SOURCE_PATH}"; exit 1; }
echo "✅ Source confirmed: {SOURCE_PATH}"
```

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

**Q1 — Target platform**
Present only valid options for the detected source. If source not in supported matrix:
```
❌ '{stack}' is not a supported migration source.
Supported: dotnet_framework · dotnet · java · nodejs · angular+nodejs
```
Stop completely. No fallback.

| Source | Options |
|---|---|
| `dotnet_framework` | .NET 10 MVC · .NET 10 Web API · .NET 10 Blazor · .NET 10 Worker |
| `dotnet` | .NET 10 upgrade |
| `java` | .NET Core Web API · .NET Core MVC |
| `dotnet` → Java | Java Spring Boot |
| `nodejs` | .NET Core Web API · Java Spring Boot |
| `angular` + `nodejs` | Angular + .NET 10 API · Backend only · Frontend only |

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
reference and a rule file, the rule file wins.

### Step 0.4 — Write initial checkpoint

Write `.claude/migration-checkpoint.json` NOW — at the end of Stage 0, before any document is
generated. This is the resume anchor for every later stage (the context-budget checks in Stages
1–3 rely on it being present). All values below are known from the Stage 0 analysis and answers:
`mode.graph` from the graph-availability check (Step 0.1), `mode.track` = `two-track` when Q1 is a
full-stack target (e.g. "Angular + .NET 10 API"), else `single`; `source_token`/`target_token`
are the resolved stack tokens; `source_file_count`/`source_module_count` from the Step 0.1 size
and graph counts.

> **Script transparency** (per `rules/project-rules.md`) — this `node -e` block:
> 1. **What it does:** writes/updates `.claude/migration-checkpoint.json` with the Stage-0
>    identifiers, `mode`, and seed `decision_log`; sets `phase:"Stage 1"` and all `stage_gates`
>    to `false`. If a checkpoint already exists it MERGES (keeps any existing `decision_log`/
>    `clusters`), never clobbers.
> 2. **What it touches:** only `.claude/migration-checkpoint.json` (creates `.claude/` if absent).
> 3. **What it does NOT do:** no network calls, no git operations, no reads of source files, no
>    writes anywhere else.
> 4. **APIs used:** Node.js `fs.readFileSync`, `fs.mkdirSync`, `fs.writeFileSync`, `JSON`.
> 5. **How to verify:** `cat .claude/migration-checkpoint.json` — confirm `schema_version:"1.6"`,
>    `phase:"Stage 1"`, and your Stage-0 answers under `mode`/`decision_log`.

```bash
node -e '
const fs=require("fs");
const p=".claude/migration-checkpoint.json";
let c={};try{c=JSON.parse(fs.readFileSync(p,"utf8"));}catch(e){}
const [ado,src,graph,track,st,tt,fileCount,modCount,auth,cloud]=process.argv.slice(1);
const dl=c.decision_log||{};
c.schema_version="1.6";
c.ado_id=ado; c.source_path=src; c.phase=c.phase&&c.ado_id===ado?c.phase:"Stage 1";
c.stage_gates=c.stage_gates||{architecture_approved:false,feasibility_approved:false,migration_approved:false,stage4_started:false};
c.mode={graph:graph==="true",track,source_token:st,target_token:tt};
c.contract_version=c.contract_version||1; c.contract_hash=c.contract_hash||"";
c.decision_log={auth:dl.auth||auth||"",data_access:dl.data_access||"",architecture:dl.architecture||"",cloud:dl.cloud||cloud||"",red_items:dl.red_items||[],yellow_count:dl.yellow_count||0,source_file_count:Number(fileCount)||0,source_module_count:Number(modCount)||0};
c.clusters=c.clusters||{};
fs.mkdirSync(".claude",{recursive:true});
fs.writeFileSync(p,JSON.stringify(c,null,2));
console.log("✅ Checkpoint written — phase:",c.phase,"schema:",c.schema_version);
' -- "{ADO_ID}" "{SOURCE_PATH}" "{graph true|false}" "{single|two-track}" "{source-token}" "{target-token}" "{source_file_count}" "{source_module_count}" "{proposed auth intent|}" "{Q2 cloud}"
```

Confirm `.claude/migration-checkpoint.json` is covered by the ignore file (checkpoint files are
never committed — see `$PLUGIN_DIR/skills/shared/checkpoint-schema.md`). If it is NOT ignored,
flag it to the developer and stop before the Step 3.3 `git add .`; do NOT auto-edit the ignore
file (`rules/project-rules.md` forbids modifying it automatically).

---

## Stage 1 — Design Target Architecture

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

### Step 3.0 — Context budget check + resume

**Resume path** — if entered via `MIGRATE CLUSTERS ADO-{ADO_ID}`: read the checkpoint. If
`stage_gates.feasibility_approved` is not `true`, STOP and point the developer to
`MIGRATE FEAS ADO-{ADO_ID}` first. Otherwise read the 5 architecture docs + the feasibility doc
from `docs/.../`; if `mode.graph` is `true` re-run the Step 3.1 cluster node script (cheap compute,
not context-heavy), else derive clusters from the source directory structure; then proceed to
Step 3.2. Do NOT re-read the source spec.

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
                       "truncated integration-contract for two-track"]
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
Derived from approved architecture documents:
```markdown
AUTH:    {e.g. Entra ID — AddMicrosoftIdentityWebApiAuthentication() in Program.cs}
DB:      {e.g. Dapper — parameterised SQL, IDbConnection injected}
LOGGING: {e.g. Serilog — structured: _logger.LogInformation("{Action} {Id}", action, id)}
ERRORS:  {e.g. RFC 7807 ProblemDetails on all 4xx/5xx}
ASYNC:   NEVER .Result or .Wait(). Async all the way up.
```

**2. Cluster Plan:**
```markdown
SharedKernel: {N files} — migrate first (sequential)
Tier 1 (parallel after SharedKernel): {cluster names}
Tier 2 (parallel after Tier 1): {cluster names}
```

**3. Shared Kernel Spec:**
```markdown
Source files: {file list}
Target path:  {layer}/{Name}/Shared/
Patterns:     {e.g. BaseEntity, IRepository<T>, Result<T>}
Standards:    No framework deps, nullable enabled
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
Build command:  dotnet build {Name}.sln --no-incremental 2>&1 | tail -5
```

**5. Integration Layer Spec:**
```markdown
Program.cs:       DI wiring for all clusters + middleware pipeline
appsettings.json: configuration skeleton (placeholders only)
Health check:     /healthz checking database + cache (per approved architecture)
Auth setup:       {exact registration from SECURITY-ARCHITECTURE.md}
```

**6. Migration Tracker** — write to `docs/.../ADO-{ADO_ID}-migration.tracker.md`:
```markdown
| Cluster | Files | Status | Branch | Date |
|---|---|---|---|---|
| SharedKernel | {N} | ⏳ Pending | | |
```

**7. Integration Contract** (two-track only):
Write `docs/.../ADO-{ADO_ID}-integration-contract.md`.
Load: `Read $PLUGIN_DIR/skills/migration/references/shared/fullstack-integration.md`
Include auth from approved SECURITY-ARCHITECTURE.md.

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

  Project skeleton (Write Gate — written to current directory):
  [1] {Name}.Domain/{Name}.Domain.csproj
  [2] {Name}.Application/{Name}.Application.csproj
  ...
```

After `APPROVE MIGRATION ADO-{ADO_ID}`:

Verify skeleton builds:
```bash
dotnet build {Name}.sln --no-incremental 2>&1 | tail -5
```

Commit skeleton to TARGET main branch:
```bash
git add .
git commit -m "Stage 3: Project skeleton — ADO-{ADO_ID}"
git tag stage3-skeleton
```

Update the checkpoint `.claude/migration-checkpoint.json` — this MERGES the checkpoint that already
exists from Step 0.4 (do NOT clobber the accumulated `decision_log`). On `APPROVE MIGRATION
ADO-{ADO_ID}` set `stage_gates.migration_approved = true`. The merged result is:
```json
{
  "schema_version": "1.6",
  "ado_id": "{ADO_ID}",
  "source_path": "{SOURCE_PATH}",
  "phase": "Stage 4",
  "stage_gates": {
    "architecture_approved": true,
    "feasibility_approved": true,
    "migration_approved": true,
    "stage4_started": false
  },
  "mode": {
    "graph": true,
    "track": "single | two-track",
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

SOURCE files to read (ONLY these):
  {file list from shared-kernel cluster spec}

ASSIGNED output paths (relative to .):
  src/Shared/
  tests/SharedKernel.Tests/

FORBIDDEN paths (do not touch):
  {Name}.sln · Program.cs · appsettings.json · Any .csproj · src/{other clusters}/

CLUSTER SPEC:
  {SharedKernel section from TARGET-ARCHITECTURE.md}

After writing:
  1. git checkout {branch}
  2. dotnet build {Name}.sln --configuration Debug 2>&1 | tail -5
  3. dotnet test {Name}.sln --filter "FullyQualifiedName~SharedKernel" --no-build 2>&1 | tail -10
  4. git add src/Shared/ tests/SharedKernel.Tests/
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

SOURCE files to read (ONLY these):
  {file list for this cluster}

SharedKernel types available (from merged main):
  {types list from SharedKernel spec}

ASSIGNED output paths:
  src/{ClusterName}/
  tests/{ClusterName}.Tests/

FORBIDDEN: src/{other clusters}/ · Program.cs · appsettings.json · Any .csproj

CLUSTER SPEC:
  {Full cluster section from TARGET-ARCHITECTURE.md}

After writing:
  1. dotnet build {Name}.sln --configuration Debug 2>&1 | tail -5
  2. dotnet test {Name}.sln --filter "FullyQualifiedName~{ClusterName}" --no-build 2>&1 | tail -10
  3. git add src/{ClusterName}/ tests/{ClusterName}.Tests/
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

After all clusters merged to main, write the integration layer:
- `Program.cs` — full DI wiring + middleware pipeline + auth setup per SECURITY-ARCHITECTURE.md
- `appsettings.json` — configuration skeleton (placeholders only, no secrets)
- `README.md` — project structure, build instructions, setup steps, link to architecture docs

```bash
dotnet build {Name}.sln --configuration Release 2>&1 | tail -5
```

Commit integration layer:
```bash
git add Program.cs appsettings.json README.md
git commit -m "feat(integration): wiring and configuration [ADO-{ADO_ID}]"
git tag stage4-complete
```

Update tracker: mark all clusters ✅ Done.

---

## Stage 5 — Test Coverage

### Step 5.1 — Characterization tests (verify behavioral preservation)

These tests document SOURCE behavior and verify the migrated code preserves it.
They run against the TARGET code — not the source.

For each YELLOW / RED item from Stage 2 feasibility:
1. Read source behavior by reading `{SOURCE_PATH}` files
2. Write test in target test framework at `./{Name}.Tests/`
3. Mark: `// CHARACTERIZATION: {literal | inferred} — {behavior description}`

Write Gate: `APPROVE MIGRATION ADO-{ADO_ID}`.
After writing: `git add && git commit -m "test(characterization): behavioral contract [ADO-{ADO_ID}]"`

If no HIGH/MEDIUM risk items: skip.

### Step 5.2 — Unit tests per layer

Follow test framework from loaded target stack reference.

Risk-aligned coverage targets (enforced):
| Layer | Target | FAIL threshold |
|---|---|---|
| Domain / pure logic | 95%+ | <90% → STOP |
| Application / use cases | 90%+ | <85% → STOP |
| Infrastructure / I/O | 70%+ | <60% → STOP |
| Host / bootstrap | excluded | N/A |

### Step 5.3 — E2E tests (Playwright — generated from migration knowledge)

Install Playwright:
```bash
npm init playwright@latest tests/e2e -- --lang=ts --quiet
npx playwright install --with-deps chromium
```

Generate test files from migration knowledge (no LLM involvement during execution):
- `tests/e2e/health.spec.ts` — from INFRASTRUCTURE-ARCHITECTURE.md health check config
- `tests/e2e/auth.spec.ts` — from SECURITY-ARCHITECTURE.md auth flow
- `tests/e2e/api-contract.spec.ts` — from integration-contract.md (one test per endpoint)
- `tests/e2e/navigation.spec.ts` — from Angular routing module (two-track only)
- `tests/e2e/forms.spec.ts` — from cluster specs with data-testid attributes

Generate `playwright.config.ts` with `headless: true`, `screenshot: 'only-on-failure'`.

Write Gate: `APPROVE MIGRATION ADO-{ADO_ID}`.
After writing: `git add && git commit -m "test(e2e): Playwright tests [ADO-{ADO_ID}]"`

---

## Stage 6 — Verification

### Step 6.1 — Full build + unit tests

```bash
dotnet build {Name}.sln --configuration Release 2>&1 | tail -5
dotnet test {Name}.sln --no-build --configuration Release 2>&1 | tail -20
```

### Step 6.2 — Automated E2E (Playwright — headless, no LLM during execution)

Pre-flight: check `appsettings.Development.json` for placeholder connection strings:
```bash
node -e '
const s=JSON.parse(require("fs").readFileSync("appsettings.Development.json","utf8"));
const cs=s?.ConnectionStrings?.DefaultConnection||"";
if(!cs||cs.includes("{"))process.exit(1);' \
  || { echo "❌ Populate appsettings.Development.json before E2E tests"; exit 1; }
```

Start backend:
```bash
dotnet run --project {Name}.Api --no-build --environment Development > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
timeout 30 bash -c 'until curl -sf http://localhost:{port}/healthz>/dev/null 2>&1;do sleep 1;done' \
  || { echo "❌ Backend failed to start"; cat /tmp/backend.log | tail -20; kill $BACKEND_PID; exit 1; }
echo "✅ Backend ready"
```

Start frontend if two-track:
```bash
cd web && ng serve --port 4200 --no-open > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
timeout 60 bash -c 'until curl -sf http://localhost:4200>/dev/null 2>&1;do sleep 2;done' \
  || { echo "❌ Frontend failed to start"; cat /tmp/frontend.log | tail -20; exit 1; }
echo "✅ Frontend ready"
```

Acquire test token per SECURITY-ARCHITECTURE.md auth strategy:
- Entra ID: client_credentials flow against tenant token endpoint
- Custom JWT: POST to test token endpoint
- API Key: `export E2E_TOKEN=$E2E_API_KEY`
- No auth: `export E2E_TOKEN=""`

Run Playwright headless:
```bash
npx playwright test tests/e2e/ --reporter=html,list --timeout=30000 2>&1
PLAYWRIGHT_EXIT=$?
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
[ $PLAYWRIGHT_EXIT -eq 0 ] && echo "✅ All E2E tests passed" || echo "❌ E2E tests failed — see playwright-report/"
```

### Step 6.3 — Architecture fitness (if developer chose Yes during architecture review)

```bash
dotnet test {Name}.sln --filter "Category=Architecture" --no-build 2>&1 | tail -20
```

### Step 6.4 — Visual Verification Checklist (for developer)

Generate checklist based on what was migrated:
```markdown
## Visual Verification Required — ADO-{ADO_ID}
Start: dotnet run --project {Name}.Api
       cd web && ng serve (if two-track)

  [ ] Sign in via {auth strategy} — confirm redirect + dashboard
  [ ] {ClusterA} list — data renders, no blank/error state
  [ ] {ClusterA} create form — fills, validates, submits, success message
  [ ] Error state — trigger validation error, confirm message visible
  [ ] Health: http://localhost:{port}/healthz → {"status":"healthy"}
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
  Coverage:  {backend%} {| frontend%}

  Architecture docs:
  • docs/.../COMPONENT-ARCHITECTURE.md
  • docs/.../DATA-ARCHITECTURE.md
  • docs/.../SECURITY-ARCHITECTURE.md
  • docs/.../INFRASTRUCTURE-ARCHITECTURE.md
  • docs/.../ARCHITECTURE-DECISIONS.md

  Next:
  1. /setup-init — deploys {target} stack rules
  2. /graph-sync — builds knowledge graph for new codebase
  3. Complete visual verification checklist
  4. Populate appsettings.Development.json with real values
  5. {SOURCE_PATH} remains in additionalDirectories until validated

  Cleanup: rm .claude/migration-checkpoint.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Hard Rules

NEVER write generated code to current directory without `APPROVE MIGRATION ADO-{ID}`.
NEVER skip Stage 1 architecture design — the architecture docs are the governance substitute for ICEA.
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
ALWAYS check integration contract hash before every FRONTEND cluster in two-track mode.
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

# Loaded at Stage 1 start
$PLUGIN_DIR/skills/migration/references/specs/phase1-architecture-spec.md

# Conditionally loaded
$PLUGIN_DIR/skills/migration/references/shared/ef6-to-efcore.md      (if EF6/.edmx)
$PLUGIN_DIR/skills/migration/references/shared/fullstack-integration.md  (if two-track)

# Loaded at Stage 2
$PLUGIN_DIR/skills/migration/references/specs/feasibility-spec.md

# Loaded at Stage 6.5
$PLUGIN_DIR/skills/migration/references/specs/migration-report-spec.md

# DO NOT load docs/migration-architecture.md — human reference only
# Stage 4 cluster agents DO NOT load reference files — execute from TARGET-ARCHITECTURE.md
#
# Checkpoint (.claude/migration-checkpoint.json, schema 1.6) is written at Step 0.4 and updated
# (merged) at each stage gate — it is the resume anchor for MIGRATE ARCH/FEAS/CLUSTERS/RESUME.
# The context-budget check (context-budget-check.md) runs at Steps 1.0, 2.0, 3.0 and 4.0.
```
