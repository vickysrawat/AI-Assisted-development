---
description: Per-project setup — runs the bootstrap script to handle all mechanical work (dirs, stubs, hooks, state files, gitignore, CLAUDE.md sections), then guides Claude through LLM-only tasks in order (CLAUDE.md content via /init, architect skill which auto-triggers Bootstrap Phase 2 to deploy rules and pre-copy architecture templates, graph-sync). Safe to re-run — manifest tracks progress; completed steps are skipped.
argument-hint: (no arguments needed)
---
# /setup-init — Initialise Dream memory structure for this project

Run this once in a new project to set up the Dream memory system.
Safe to re-run — all steps are idempotent; the manifest tracks what's done.

---

## What this command does

```
your-project/
├── memory/
│   ├── MEMORY.md           ← manual override inbox + auto-capture bookmarks
│   └── dream-log.md        ← append-only audit trail (starts empty)
├── .claude/
│   ├── commands/           ← 37 command stubs (makes plugin commands visible in VS Code)
│   ├── rules/              ← rule files deployed after architecture analysis (LLM Step 4)
│   │   ├── project-rules.md          ← Layer 0 — always deployed
│   │   ├── backend-base-rules.md     ← Layer 1 — auto with any backend language
│   │   ├── csharp-dotnet-rules.md    ← Layer 3 — .NET 6+ detected
│   │   ├── nodejs-typescript-rules.md← Layer 3 — Express/Fastify/Nest detected
│   │   └── {ecosystem-rules}.md      ← Layer 2/3/4 — React, Next.js, Playwright, etc.
│   ├── hooks/              ← enforcement floor (icea-floor.sh, pre-commit, CI scripts)
│   ├── architecture/       ← populated by architect skill (Step 3a)
│   │   ├── architecture.md            ← overview + End-to-End & Layered Mermaid diagrams
│   │   ├── architecture-{callchains|flows|api}.md
│   │   ├── architecture-reference.md
│   │   ├── architecture-data.md       ← data model / schema / ownership
│   │   ├── architecture-integrations.md ← external deps + resilience
│   │   ├── architecture-security.md   ← trust zones + authorization model
│   │   ├── architecture-decisions.md  ← append-only decision log
│   │   └── architecture-deployment.md ← hosting/auth/secrets + NFR
│   ├── graph/              ← knowledge graph (graph-sync Step 3b)
│   │   └── graph-index.md
│   ├── dream-init-state.json
│   ├── file-cache.json
│   └── settings.json       ← PreToolUse hook wired here by bootstrap
├── token-analysis/
│   └── token-graph.json    ← empty graph seeded by bootstrap
└── CLAUDE.md               ← created from template or Dream sections appended
```

---

## Steps

### Step 0 — Resolve PLUGIN_DIR

Use the resolver from `skills/shared/plugin-path-resolution.md §1a`:

```bash
PLUGIN_DIR="$(node -e '
const fs=require("fs"),os=require("os"),path=require("path");
const base=path.join(os.homedir(),".claude","plugins");
const norm=p=>p?p.split(String.fromCharCode(92)).join("/"):"";
let dir="";
try{
  const reg=JSON.parse(fs.readFileSync(path.join(base,"installed_plugins.json"),"utf8"));
  const key=Object.keys(reg.plugins||{}).find(k=>k.startsWith("ai-assisted-development@"));
  if(key){const a=reg.plugins[key]||[];const e=a.find(x=>x.scope==="user")||a[0];
    if(e&&e.installPath&&fs.existsSync(e.installPath))dir=e.installPath;}
}catch(e){}
if(!dir){try{for(const m of fs.readdirSync(base)){const p=path.join(base,m,"plugins","ai-assisted-development");if(fs.existsSync(p)){dir=p;break;}}}catch(e){}}
process.stdout.write(norm(dir));
')"
[ -z "$PLUGIN_DIR" ] && echo "⚠ Cannot resolve plugin dir — is the plugin installed?" && exit 1
```

---

### Step 1 — Bootstrap (all mechanical work)

Bootstrap handles: directories, 37 command stubs, 5 hooks + `.hashes`,
git pre-commit hook (git repos only, backs up any existing hook), PreToolUse
hook wiring, state file seeding, npm dep list, gitignore sync, external dir scan,
CLAUDE.md managed sections, and git/bash path detection. All in one deterministic
pass — crash-safe, fully idempotent.

To skip the enforcement floor (hooks + PreToolUse + pre-commit), add `--no-hooks`
to the bootstrap command below — the opt-out must then be recorded in
`.claude/architecture/architecture-deployment.md` (ADR 0009: a missing floor is an
attributable decision, never a silent default).

**Check manifest state first:**

```bash
node -e "
const fs = require('fs');
const p = '.claude/_bootstrap-manifest.json';
if (!fs.existsSync(p)) { console.log('NO_MANIFEST'); process.exit(0); }
const m = JSON.parse(fs.readFileSync(p, 'utf8'));
const pending = (m.needsLLMPopulation || []).filter(x => x.status === 'pending');
console.log('STATUS=' + m.status);
console.log('PENDING=' + pending.length);
"
```

| STATUS | PENDING | Action |
|---|---|---|
| `NO_MANIFEST` | — | Run bootstrap below |
| `complete` | 0 | Skip to Step 3 (all work done) |
| `complete` | >0 | Skip to Step 2 (resume LLM work) |
| `partial` or `failed` | — | Re-run bootstrap (idempotent) |

**Run bootstrap:**

```bash
node "$PLUGIN_DIR/scripts/setup-init-bootstrap.cjs" --mode init
```

**Read manifest and surface warnings:**

```bash
node -e "
const m = JSON.parse(require('fs').readFileSync('.claude/_bootstrap-manifest.json','utf8'));
console.log('status   : ' + m.status);
if (m.warnings && m.warnings.length) {
  console.log('warnings :');
  m.warnings.forEach(w => console.log('  ⚠ ' + w));
}
console.log('LLM work :');
(m.needsLLMPopulation || []).forEach(t =>
  console.log('  [' + t.order + '] ' + t.status.toUpperCase() + '  ' + t.id)
);
"
```

If status is not `complete`, re-run bootstrap before proceeding.

---

### Step 2 — Foundation LLM work (manifest items order 1–3)

Read the manifest to find pending items:

```bash
node -e "
const m = JSON.parse(require('fs').readFileSync('.claude/_bootstrap-manifest.json','utf8'));
(m.needsLLMPopulation || []).filter(x => x.status === 'pending' && x.order <= 3)
  .forEach(t => console.log('[' + t.order + '] PENDING  ' + t.id + ' — ' + t.description));
"
```

After completing each item, mark it done immediately before moving to the next:

```bash
node -e "
const fs=require('fs'), p='.claude/_bootstrap-manifest.json';
const m=JSON.parse(fs.readFileSync(p,'utf8'));
const item = m.needsLLMPopulation.find(x => x.id === '{ITEM_ID}');
if (item) { item.status = 'done'; item.description = 'completed'; }
fs.writeFileSync(p, JSON.stringify(m, null, 2));
"
```

**2a — `init_claude_md`** (if pending):
Run `/init` NOW. Do not describe what you are about to do — execute immediately.
Do not read or summarise the other pending items first. `/init` analyses the codebase
and populates `./CLAUDE.md` with project-specific content. Wait for `/init` to fully
complete, then mark `init_claude_md` done in the manifest before reading order 2.

**2b — `resolve_git_bash_paths`** (if pending):
Bootstrap attempted auto-detection. Check manifest `operations.gitBashPaths`
for `gitPath`/`bashPath` values. If either is null, ask the developer to run
`where.exe git` / `where.exe bash` and substitute the `⚠ NOT DETECTED` placeholder
in CLAUDE.md §0b manually. Mark done when both placeholders are resolved.

**2c — `verify_external_dirs`** (if pending):
Check manifest `operations.externalDirScan.externalPaths`. If non-empty,
show the paths and ask the developer to confirm they match their local checkout.
Correct any wrong paths in `.claude/settings.local.json`. Mark done when confirmed.
If `externalPathsFound` is 0, mark done immediately.

**2d — External Repository Discovery** (always run — guarded by `external_stacks_prompted` flag):

```bash
node -e "
const fs=require('fs');
try {
  const s=JSON.parse(fs.readFileSync('.claude/dream-init-state.json','utf8'));
  console.log(s.external_stacks_prompted===true ? 'SKIP' : 'ASK');
} catch(e) { console.log('ASK'); }
"
```

If output is `SKIP` → skip this step entirely (user was already asked).

If output is `ASK`:
1. Read current `additionalDirectories` from `.claude/settings.local.json` and show them:
   `"Auto-detected external directories: [list, or 'none']"`

2. Ask the developer:
   ```
   Does this application depend on services in separate repositories NOT listed above?
   (e.g. a .NET API, a Java service, a Python microservice in its own git repo)

   Enter absolute path(s), one per line — or press Enter to skip.
   You can add more later with /sync-dirs.
   ```

3. If paths provided: validate each exists on disk (warn and skip missing).
   Merge valid paths into `additionalDirectories` in `.claude/settings.local.json` (no duplicates).

4. Set `external_stacks_prompted: true` in `.claude/dream-init-state.json`
   (write this BEFORE running detection — guards against re-prompt if detection fails):
   ```bash
   node -e "
   const fs=require('fs'), p='.claude/dream-init-state.json';
   const s=JSON.parse(fs.readFileSync(p,'utf8'));
   s.external_stacks_prompted=true;
   fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n');
   "
   ```

5. Run external stack detection:
   ```bash
   node "$PLUGIN_DIR/scripts/external-stack-detection.cjs"
   ```

6. Tell the developer: `"external_detected_stacks: [result]. Add more repos later with /sync-dirs."`

---

### Step 3 — Analysis LLM work (manifest items order 4–5)

**3a — `generate_architecture`** (if pending):
```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
Read $PLUGIN_DIR/skills/architect/SKILL.md and execute it in full.

Architect Step 1 (repo type detection) automatically runs Bootstrap Phase 2, which
deploys matching rules to .claude/rules/ and pre-copies architecture templates.
This marks deploy_rules done in the manifest — no separate LLM step needed.

Step 0.5 (deployment questionnaire) still requires APPROVED reply.
Step 7-2 writes graph.json then calls graph-extract-edges.js for EXTRACTED edges.
```
Wait for architect to complete. Mark `generate_architecture` done in manifest.

**3b — `build_knowledge_graph`** (if pending):
```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
Read $PLUGIN_DIR/skills/graph-sync/SKILL.md and execute it in full.
Graph-sync Step 8a also calls graph-extract-edges.js after updating graph.json —
this refines EXTRACTED edges and is the authoritative final pass.
```
Wait for graph-sync to complete. Confirm `.claude/graph/graph-index.md` exists.
Mark `build_knowledge_graph` done in manifest.

---

### Step 4 — Finalise

All `needsLLMPopulation` items are `done`. Delete the manifest and print the summary.

```bash
rm .claude/_bootstrap-manifest.json
```

Verify `architecture-deployment.md` exists and is answered:
```bash
ls .claude/architecture/architecture-deployment.md 2>/dev/null || echo "MISSING"
grep -c "Not yet answered" .claude/architecture/architecture-deployment.md 2>/dev/null || echo "0"
```

If MISSING or unanswered count > 0:
```
⚠ .claude/architecture/architecture-deployment.md is missing or incomplete.
  Run: /update-arch --deployment
  Both /app-readiness and /plugin-readiness require this file.
```

Print final summary:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Dream initialised
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memory/          ✓   .claude/rules/     ✓ ({N} rules deployed)
  .claude/commands/✓   .claude/hooks/     ✓
  .claude/graph/   ✓   CLAUDE.md          ✓
  dream-init-state ✓   .gitignore         ✓

Next steps:
  1. Update the Repository line in CLAUDE.md with this project's ADO repo name
  2. Review any ⚠ flagged sections in .claude/architecture/ and fill in manually
  3. All plugin commands are now visible in Claude Code (VS Code) — type / to see them
  4. Work normally — auto-capture writes to memory/MEMORY.md at trigger points
  5. Run /dream every 5–8 sessions to consolidate
  6. Run /dream-health to see the memory dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Rules

- NEVER overwrite any file that already exists — bootstrap is skip-if-exists for all user-owned files
- NEVER modify existing CLAUDE.md body content — only append missing Dream sections
- NEVER remove or reorder existing `.gitignore` entries — only append via managed block
- ALWAYS re-run bootstrap if manifest status is `partial` or `failed` before proceeding to LLM steps
- ALWAYS mark each `needsLLMPopulation` item done in the manifest immediately after completing it
- `.claude/_npm-deps.json` is deleted automatically by Bootstrap Phase 2 (called from architect Step 1) — do not delete it manually before architect runs
- NEVER delete the manifest until ALL `needsLLMPopulation` items are `done` — it is the resume checkpoint
- If `/init` fails or is unavailable, ask the developer to create CLAUDE.md manually then re-run
- If `memory/` already contains `topic-*.md` files, the project is already initialised — bootstrap
  still runs (idempotent), but `/init` may be skipped if CLAUDE.md already has project content
