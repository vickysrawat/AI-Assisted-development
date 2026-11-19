---
name: setup-sync
description: >
  Re-provision an existing project after a plugin upgrade. Runs scripts/setup-sync.cjs — the
  one-command deterministic sync (version stamp, hooks, command stubs, plugin-owned skills,
  ignore-file managed block, stack re-detection, rule redeploy, CLAUDE.md path retry, external
  stacks, run record) — then handles only the steps that need judgement: the migration notes in
  docs/migrations/ for each version in range, the external-repos question, the business-context
  offer and the onboarding guide. Idempotent and safe to re-run; never overwrites developer
  content. Use when setup-status reports plugin version drift (UPGRADE PENDING).
  Alias: setup-init --upgrade.
---

# Skill: setup-sync

_Skill version: 2.0 · Last changed: 2026-11-19 · Consent: C_

> **Business context severity:** infrastructure skill — no security findings. See
> `$PLUGIN_DIR/skills/shared/business-context-severity.md` for the B-series model it does not trigger.

## Purpose
Re-provision an existing project after a plugin upgrade. Every mechanical step is in
`scripts/setup-sync.cjs` (ADO-83), which a developer can also run without Claude:

```
cd <target repo> && node "<installed plugin>/scripts/setup-sync.cjs"
```

The script stamps the installed version early, runs the bootstrap in sync mode (hooks, stubs,
`.claude/plugin-path.txt`, plugin-owned `.claude/skills/` respecting `.hashes`, CLAUDE.md
sections, `.gitignore` / `.tfignore`), re-detects the stack and redeploys rules, retries
`⚠ NOT DETECTED` git/bash paths in CLAUDE.md, refreshes external-stack detection when it is
already set up, records the run, and prints the in-range migration notes and a **Needs Claude**
list. This skill runs that script, then does only what the list asks for.

Triggered by: `/setup-sync` or `/setup-init --upgrade`
---

## Persona
Acts with a **[DPE] DevOps/Platform Engineer** lens — idempotent re-provisioning, state integrity,
safe-to-re-run; always asks "is this idempotent, and what happens on partial failure?" Lens only;
never assume, never attribute in output. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## --commands flag (scoped deployment, deterministic)

When invoked as `/setup-sync --commands`, skip Steps 1–6 entirely and run only this:

**1. Read PLUGIN_DIR from `.claude/plugin-path.txt`:**

```javascript
node -e "
const fs=require('fs');
const p='.claude/plugin-path.txt';
if(!fs.existsSync(p)){console.error('PLUGIN_DIR_NOT_FOUND');process.exit(1);}
console.log('PLUGIN_DIR='+fs.readFileSync(p,'utf8').trim());
"
```

If `PLUGIN_DIR_NOT_FOUND`:
```
⚠ .claude/plugin-path.txt not found. Run /setup-init first.
```
Stop here.

**2. Run the deterministic deploy script** (substitute the actual PLUGIN_DIR value — no shell variables):

```
node {PLUGIN_DIR}/scripts/deploy-commands.cjs
```

**3. Display the script output verbatim. Stop — do not proceed to Steps 1–6.**

The script copies every `.md` from the plugin's `.claude/commands/` to the current project's `.claude/commands/`. Files present in the target but absent from the plugin are never deleted (target-only files are reported as "Kept").

---

## --reinstall flag (push source to installed copy, deterministic)

When invoked as `/setup-sync --reinstall`:

**1. Verify this is the plugin source directory:**

```javascript
node -e "
const fs=require('fs');
if(!fs.existsSync('install.cjs')){
  console.error('NOT_PLUGIN_SOURCE');process.exit(1);
}
console.log('OK');
"
```

If `NOT_PLUGIN_SOURCE`:
```
⚠ Run /setup-sync --reinstall from the plugin source directory (where install.cjs lives).
```
Stop here.

**2. Run the installer in update mode:**

```
node install.cjs --update
```

**3. Display output verbatim. Stop — do not proceed to Steps 1–6.**

This copies all source files to the installed plugin location at
`~/.claude/plugins/{marketplace}/plugins/ai-assisted-development/`.
After this, run `/setup-sync --commands` in each target project to deploy the updated stubs.

---

## Step 1 — Run the sync script

> ⚠️ **HARD RULE — DO NOT IMPROVISE THE SYNC.** Run the installed plugin's script exactly as
> below. Do not re-run the bootstrap, repo-detect or the version stamp by hand — the script
> does all of them, in order, and is the single source of truth for this step.

Resolve the installed plugin from the Claude plugin registry (authoritative — `plugin-path.txt`
may still point at the old version's cache folder until the script refreshes it):

```javascript
node -e "
const fs=require('fs'),os=require('os'),path=require('path');
let dir='';
try {
  const reg=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.claude','plugins','installed_plugins.json'),'utf8'));
  const key=Object.keys(reg.plugins||{}).find(k=>k.startsWith('ai-assisted-development@'));
  const a=key?reg.plugins[key]||[]:[]; const e=a.find(x=>x.scope==='user')||a[0];
  if(e&&e.installPath&&fs.existsSync(e.installPath)) dir=e.installPath;
} catch(e) {}
if(!dir){ try{ dir=fs.readFileSync('.claude/plugin-path.txt','utf8').trim(); }catch(e){} }
if(!dir||!fs.existsSync(path.join(dir,'scripts','setup-sync.cjs'))){ console.error('PLUGIN_DIR_NOT_FOUND'); process.exit(1); }
console.log('PLUGIN_DIR='+dir.split(path.sep).join('/'));
"
```

If `PLUGIN_DIR_NOT_FOUND`:
```
⚠ Cannot locate the installed plugin (or it predates scripts/setup-sync.cjs).
  Install or update it first: node install.cjs --update  (or install.sh / install.ps1)
```
Stop here.

Then run (substitute the actual PLUGIN_DIR — no shell variables):

```
node "{PLUGIN_DIR}/scripts/setup-sync.cjs"
```

Show the output **verbatim**, then branch on the exit code:

| Exit | Meaning | Action |
|---|---|---|
| 0 | every step ok | continue to Step 2 |
| 1 | a step failed (marked ✗); the later steps still ran and the version is stamped | show the ✗ lines, tell the developer to fix the cause and re-run `/setup-sync`, then continue to Step 2 — the judgement steps are still useful |
| 2 | not provisioned, or wrong arguments | show the message and stop. Not provisioned → `Run /setup-init first.` |

Keep the script's **Migration notes** and **Needs Claude** blocks — Steps 2–5 act only on what
they list. Ids in the Needs Claude list: `migration-notes`, `setup-init`, `external-repos`,
`business-context`, `onboarding-guide`, `graph-sync`, `claude-md-paths`.

---

## Step 2 — Show the migration notes

For each file the script listed under **Migration notes**, read it and display it with a header
that makes its informational-only nature explicit (developers otherwise assume it auto-applied):
```
📋 Migration {version} (informational — review and apply any manual steps yourself):
{content}
```

After all of them, close with:
```
If any migration above lists a manual action, complete it before running /setup-status.
(Migrations are notes, not auto-applied changes.)
```
If the script printed `Migration notes: none …`, repeat that line and continue.

---

## Step 3 — External repos (only when `external-repos` is listed)

The script already refreshed external-stack detection when the developer was asked before or
`additionalDirectories` is set. When `external-repos` is listed, nobody has been asked yet. Ask:
```
This project may call APIs in separate repositories (e.g. a .NET API, a Java service).
Providing paths lets Claude Code generate accurate Tech Specs spanning all layers.

Enter absolute path(s) to external repos, one per line — or Enter to skip:
```

If paths provided:
1. Validate each exists on disk (warn and skip missing)
2. Merge into `additionalDirectories` in `.claude/settings.local.json`
3. Set `external_stacks_prompted: true` (write before detection):
   ```bash
   node -e "
   const fs=require('fs'),p='.claude/dream-init-state.json';
   const s=JSON.parse(fs.readFileSync(p,'utf8'));
   s.external_stacks_prompted=true;
   fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n');
   "
   ```
4. `node "$PLUGIN_DIR/scripts/external-stack-detection.cjs"`
5. Report: `"external_detected_stacks: [result]"`

If skipped:
1. Set `external_stacks_prompted: true` (same bash above)
2. Tell developer: `"Run /sync-dirs any time to add external repos."`

---

## Step 4 — Business context policy (only when `business-context` is listed)

The script reported that the domain-tailored severity policy is missing. Confirm it, then
act on it — this is not a reminder.

```bash
node -e "
  const fs = require('fs');
  const bcPath = '.claude/business-context.md';
  if (!fs.existsSync(bcPath)) { console.log('MISSING'); process.exit(0); }
  const first = fs.readFileSync(bcPath, 'utf8').split('\n')[0] || '';
  console.log(first.includes('Not yet generated') ? 'STUB' : 'EXISTS');
"
```

**If `EXISTS`:** skip this step — business context is already configured. Continue to Step 5.

**If `MISSING` or `STUB`:**

1. **Check whether `architecture-data.md` is populated** using the two-signal test from
   `$PLUGIN_DIR/skills/shared/arch-populated-detect.md` (marker + scaffold-token check):

   ```bash
   node -e "
     const fs = require('fs');
     const f = '.claude/architecture/architecture-data.md';
     if (!fs.existsSync(f)) { console.log('MISSING'); process.exit(0); }
     const txt = fs.readFileSync(f, 'utf8');
     const marker = txt.split('\n')[0].includes('TEMPLATE');
     const scaffoldTokens = ['\\[Entity Name\\]','\\[Table Name\\]','_Generated by architect_'];
     const stub = scaffoldTokens.some(t => txt.includes(t));
     console.log(marker || stub ? 'UNFILLED' : 'FILLED');
   "
   ```

2. **Ask the developer one question** (use `AskUserQuestion`):

   - If `architecture-data.md` is **FILLED**:
     ```
     Question : Your business context policy (.claude/business-context.md) is missing.
                Every review skill uses a generic fallback without it — regulated-data
                findings will be under-scored.
                Would you like to generate it now?
     Options  : Yes — run SET DOMAIN now (recommended)
                No  — I will run SET DOMAIN manually later
     ```

   - If `architecture-data.md` is **MISSING or UNFILLED**:
     ```
     Question : Your business context policy (.claude/business-context.md) is missing,
                and architecture-data.md is not yet populated (domain inference reads
                entity/table names from it).
                Would you like to run the architect skill now to populate the architecture
                docs, then generate the business context policy?
     Options  : Yes — run /architect then SET DOMAIN (recommended)
                No  — I will do this manually later
     ```

3. **On Yes:**

   - If `architecture-data.md` **FILLED**: invoke `business-context-generation.md` directly
     (the `SET DOMAIN` flow — infer, confirm, ground, APPROVED gate).
   - If `architecture-data.md` **MISSING or UNFILLED**: read and execute
     `$PLUGIN_DIR/skills/architect/SKILL.md` in full, then invoke
     `business-context-generation.md` (the architect step already calls it as its
     "Business context" thin-caller step — do not call it twice if architect already ran it).

4. **On No:** note the decision and continue to Step 5. The Step 5 summary will include
   a brief reminder line so the developer sees it at the end.

---

## Step 5 — Confirm

```
✅ setup-sync complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Plugin version: v{from} → v{to}           (from the script's first line)
  Sync script:    {N} steps ok{, N warnings}{, N failed — re-run /setup-sync after fixing}
  Migrations:     {versions shown in Step 2, or "none in range"}

  {if graph-sync was listed → "⚠ NEXT STEP — the knowledge graph is likely STALE after a version
    upgrade. Run /graph-sync now, or code-review/graph-viz/icea-review will orient off
    out-of-date module data."}
  {if claude-md-paths was listed → "⚠ CLAUDE.md still has a ⚠ NOT DETECTED value — fill it in by hand."}
  {if setup-init was listed → "⚠ setup-init never finished (no detected stacks) — run /setup-init."}
  {if Step 4 ran SET DOMAIN → "✅ business-context.md generated — domain-tailored severity policy active."}
  {if Step 4 was declined   → "⚠ business-context.md still missing — type SET DOMAIN when ready."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Then run /setup-status to verify all checks are green.
```

**Only if a MIXED .NET solution is detected** (`generations.dotnet.heterogeneous === true` in
`.claude/dream-init-state.json`) **and** `per_project_rules !== true`, append inside the summary box:
```
  ℹ Mixed .NET (Framework + modern) — per-project rule scoping is available but OFF. Set
    "per_project_rules": true in .claude/dream-init-state.json (preview: PER_PROJECT_RULES_DRYRUN=1)
    to scope WCF/EF6/ADO.NET rules to their own projects. See DEVELOPER-GUIDE.md.
```
Skip it for pure-modern / pure-framework / non-.NET repos (no effect there).

> Issue 6: the graph-sync reminder is intentionally a prominent `⚠` line in the summary box,
> not a trailing note, because a stale graph silently degrades downstream skills.

---

## Step 6 — Onboarding guide

After the summary, check the onboarding guide state:

```bash
ls docs/ONBOARDING.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**If `MISSING`:**
```
ℹ No onboarding guide found.
  Generate docs/ONBOARDING.md for developers and tech leads? (yes / skip)
```
On `yes` → run the onboarding-guide skill (read `$PLUGIN_DIR/skills/onboarding-guide/SKILL.md`).
On `skip` → print: `Run ONBOARDING GUIDE any time to generate it.`

**If `EXISTS`:**
```
ℹ docs/ONBOARDING.md exists. Refresh it? Roles or stack may have changed since it was generated. (yes / skip)
```
On `yes` → run the onboarding-guide skill with `--refresh`.
On `skip` → print: `Run ONBOARDING GUIDE --refresh any time to regenerate.`
