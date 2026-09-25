---
name: setup-sync
description: >
  Re-provision an existing project after a plugin upgrade. Compares the version that
  provisioned the project against the installed plugin version and applies only the
  version-sensitive changes listed in docs/migrations/ for each version in range —
  re-copies hooks, refreshes the ignore-file managed block, seeds new state/rule files —
  then re-stamps the provisioned version. Idempotent and safe to re-run; never overwrites
  developer content. Use when setup-status reports plugin version drift (UPGRADE PENDING).
  Alias: setup-init --upgrade.
---

# Skill: setup-sync

_Skill version: 1.0 · Last changed: 2026-07-07 · Consent: C_

> **Business context severity:** infrastructure skill — no security findings. See
> `$PLUGIN_DIR/skills/shared/business-context-severity.md` for the B-series model it does not trigger.

## Purpose
Re-provision an existing project after a plugin upgrade. Reads the provisioned
version from `.claude/dream-init-state.json` and the installed version from the
plugin's registry. Calls the bootstrap script (sync mode) to re-copy hooks,
re-deploy stubs, update `.claude/plugin-path.txt` (the pointer skills use to
locate plugin reference files in the cache), update plugin-owned project skills in
`.claude/skills/` (respecting developer customisations via `.hashes`), and restore
missing rule files from `deployed_rules[]`, then re-stamps the version.

Triggered by: `/setup-sync` or `/setup-init --upgrade`

---

## Persona
Acts with a **[DPE] DevOps/Platform Engineer** lens — idempotent re-provisioning, state integrity,
safe-to-re-run; always asks "is this idempotent, and what happens on partial failure?" Lens only;
never assume, never attribute in output. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## --commands flag (scoped deployment, deterministic)

When invoked as `/setup-sync --commands`, skip Steps 1–7 entirely and run only this:

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

**3. Display the script output verbatim. Stop — do not proceed to Steps 1–7.**

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

**3. Display output verbatim. Stop — do not proceed to Steps 1–7.**

This copies all source files to the installed plugin location at
`~/.claude/plugins/{marketplace}/plugins/ai-assisted-development/`.
After this, run `/setup-sync --commands` in each target project to deploy the updated stubs.

---

## Step 1 — Resolve plugin path and read versions

> ⚠️ **HARD RULE — DO NOT IMPROVISE VERSION DETECTION.**
> Run the node command below exactly. It reads `INSTALLED_VERSION` from the Claude plugin
> registry (`installed_plugins.json`) — the authoritative source. It self-heals `plugin-path.txt`
> if stale. Never infer the installed version from `CLAUDE.md` or construct it from the state field.

```javascript
node -e "
const fs=require('fs'),os=require('os'),path=require('path');
// Fast path: get PLUGIN_DIR from plugin-path.txt
const ptf = '.claude/plugin-path.txt';
let cachedDir = '';
try { cachedDir = fs.existsSync(ptf) ? fs.readFileSync(ptf,'utf8').trim() : ''; } catch(e) {}

// Authoritative: installed version + registered path from Claude plugin registry
const base=path.join(os.homedir(),'.claude','plugins');
let registeredDir='', installedVersion='unknown';
try {
  const reg=JSON.parse(fs.readFileSync(path.join(base,'installed_plugins.json'),'utf8'));
  const key=Object.keys(reg.plugins||{}).find(k=>k.startsWith('ai-assisted-development@'));
  if(key){ const a=reg.plugins[key]||[]; const e=a.find(x=>x.scope==='user')||a[0];
    if(e){ registeredDir=(e.installPath||'').split(path.sep).join('/'); installedVersion=e.version||'unknown'; }}
} catch(e) {}

// Use registered path if cache is stale or absent; self-heal plugin-path.txt
const pluginDir = (registeredDir && fs.existsSync(registeredDir)) ? registeredDir : cachedDir;
if(!pluginDir || !fs.existsSync(pluginDir)) {
  console.error('PLUGIN_DIR_NOT_FOUND'); process.exit(1);
}
if(pluginDir !== cachedDir) {
  fs.writeFileSync(ptf, pluginDir+'\n');
  console.log('PLUGIN_PATH_UPDATED='+pluginDir);
}

// Provisioned version from state
let provisionedVersion = 'unknown';
try { provisionedVersion = JSON.parse(fs.readFileSync('.claude/dream-init-state.json','utf8')).dream_init_plugin_version || 'unknown'; } catch(e) {}

console.log('PLUGIN_DIR='+pluginDir);
console.log('INSTALLED_VERSION='+installedVersion);
console.log('PROVISIONED_VERSION='+provisionedVersion);
"
```

If `PLUGIN_DIR_NOT_FOUND`:
```
⚠ Cannot locate installed plugin. Run /setup-init to restore plugin-path.txt, then re-run /setup-sync.
```
Stop here.

If `INSTALLED_VERSION` is `unknown`:
```
⚠ Cannot read installed plugin version from registry.
  Install the plugin first: node install.cjs  (or install.sh / install.ps1)
```
Stop here.

Display:
```
🔄 setup-sync — v$PROVISIONED_VERSION → v$INSTALLED_VERSION
```

If `INSTALLED_VERSION` is `unknown`:
```
⚠ Cannot read installed plugin version.
  Install the plugin first: node install.cjs  (or install.sh / install.ps1)
```
Stop here.

**Stamp the state to the installed version NOW — before the deployment steps below.**
This is resilience: if the sync is interrupted or a later step fails, the state still reflects
the installed version, so it is never left stale. A stale version is what triggers setup-sync in
the first place, and can lead tooling to look for a plugin cache dir that no longer exists (the
exact failure this guards against). The deployment steps are all idempotent, and `setup-status`
independently verifies that rules/hooks/stubs are actually present — so the version field and the
artifact-presence are checked separately.

Write `.claude/dream-init-state.json` using the Write tool — substitute the actual
`INSTALLED_VERSION` value you read in step 3 above:

```javascript
// Read the current state first, then write back with updated version
node -e "
  const fs = require('fs');
  const p = '.claude/dream-init-state.json';
  let s = {};
  try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e) {}
  s.dream_init_plugin_version = 'ACTUAL_VERSION_FROM_STEP_3';
  fs.mkdirSync('.claude', { recursive: true });
  fs.writeFileSync(p, JSON.stringify(s, null, 2));
  console.log('  ✓ state stamped to v' + s.dream_init_plugin_version + ' (early — survives a partial run)');
"
```

> Replace `ACTUAL_VERSION_FROM_STEP_3` with the exact version string read from
> `{PLUGIN_DIR}/.claude-plugin/plugin.json` in Step 3. Do not use shell variable
> interpolation — substitute the literal value directly into the script string.

### Step 1c — Prerequisite check: did setup-init ever complete?

setup-sync restores rules from `deployed_rules[]` and refreshes what `setup-init` created.
If `setup-init` never ran to completion (e.g. stopped after the mechanical bootstrap), the
state has no `detected_stacks`/`deployed_rules`, so Step 3 has nothing to restore — silently.
Warn clearly, but do NOT block: re-copying hooks/stubs is still useful.

```bash
node -e "
const fs=require('fs');
let s={}; try{ s=JSON.parse(fs.readFileSync('.claude/dream-init-state.json','utf8')); }catch(e){}
const stacks = Array.isArray(s.detected_stacks) ? s.detected_stacks : [];
console.log(stacks.length ? 'INIT_COMPLETE' : 'INIT_INCOMPLETE');
"
```

If `INIT_INCOMPLETE`:
```
⚠ setup-init may not have completed — detected_stacks is empty in dream-init-state.json.
  Rules cannot be restored (no deployment record). Hooks/stubs will still be refreshed.
  Run /setup-init to finish initial setup, or /setup-status to diagnose.
```
Continue with the remaining steps regardless.

---

## Step 2 — Bootstrap (re-provision hooks, stubs, and skill files)

Bootstrap in sync mode re-copies all hooks (always overwrite — plugin owns them),
always overwrites command stubs (plugin owns stubs in sync mode),
updates `.claude/plugin-path.txt` with the current plugin cache path (all plugin skill
reference files are read directly from the cache via this pointer — no copies in target
repos), updates plugin-owned project skills in `.claude/skills/` respecting developer
customisations (files modified by the developer are protected via `.hashes`; developer-
created files with no `.hashes` entry are never touched),
appends any new Dream sections to CLAUDE.md, and refreshes `.claude/hooks/.hashes`.
Does NOT write `needsLLMPopulation` — sync is not an init operation.

Using the `PLUGIN_DIR` value read from `.claude/plugin-path.txt` in Step 1, run:

```
node {PLUGIN_DIR}/scripts/setup-init-bootstrap.cjs --mode sync
```

> Substitute the actual PLUGIN_DIR path — do not use shell variable syntax.
> `plugin-path.txt` is updated by the bootstrap itself so subsequent skill reads get the refreshed path.

---

## Step 3 — Re-run scored detection + rule deployment (ADR 0059)

Rule deployment is driven by the scored `detection` object in `.claude/dream-init-state.json`.
setup-sync **re-runs detection and the scored deploy** so a project picks up corrected
signals (e.g. the `.slnx`/generation/pruning fixes) and any newly added rules — it no longer
just re-copies the old `deployed_rules[]` list.

```bash
# 1. (Re)detect — refresh the scored `detection` object. Needed for pre-ADR-0059 installs that
#    have no `detection` in state, and to pick up detector improvements. --force overwrites.
node "$PLUGIN_DIR/scripts/repo-detect.cjs" --force --root=.

# 2. Re-run the scored, hash-tracked deploy (reads state.detection; honors .claude/rules/.hashes,
#    so developer-edited rules are protected, not clobbered; writes _deploy-manifest.json).
node "$PLUGIN_DIR/scripts/setup-init-bootstrap.cjs" --mode post-detect --repo-type "$(node -e 'try{process.stdout.write(JSON.parse(require("fs").readFileSync(".claude/dream-init-state.json","utf8")).repo_type||"")}catch(e){}')"
```

Report the deploy summary (deployed / customised-protected counts + threshold) from the
bootstrap output.

> **v3.19.0 — version-spread backfill (Shared, automatic here).** The `--force` re-detect above now
> also backfills `generations.dotnet.versions[]` / `packages` / `generations_meta` for pre-3.19
> projects (safe, no rule change). **Track-A per-project rule scoping stays OFF** unless
> `PER_PROJECT_RULES=1` / `per_project_rules:true` — when OFF the deploy is byte-identical to before.
> If enabling, run the deploy once with `PER_PROJECT_RULES_DRYRUN=1` first to preview the scoped-path
> plan + the one-time `.hashes` body-hash re-baseline before applying.

> **Dropping wrong rules:** re-deploy is idempotent-**add** — it (re)writes the correct set and
> the manifest, but does NOT delete rules that are no longer detected (avoids clobbering
> possibly developer-edited files). To remove stale rules from a mis-provisioned project, run
> `/setup-teardown --rules` then re-run `/setup-sync` (or `/setup-init`). See migration 028.

---

## Step 4 — Apply migration files

Read all migration files in `$PLUGIN_DIR/docs/migrations/` for versions
between `PROVISIONED_VERSION` and `INSTALLED_VERSION` (exclusive of provisioned,
inclusive of installed). Display the migration notes so the developer can
review what changed. Do not auto-apply code changes — migrations are informational.

```bash
ls "$PLUGIN_DIR/docs/migrations/"*.md 2>/dev/null | sort
```

For each migration file in range, display its content with a header that makes the
informational-only nature explicit (Issue 5 — developers otherwise assume it auto-applied):
```
📋 Migration {version} (informational — review and apply any manual steps yourself):
{content}
```

After displaying all in-range migrations, close with:
```
If any migration above lists a manual action, complete it before running /setup-status.
(Migrations are notes, not auto-applied changes.)
```
If no migration files are in range, say so: `No migration notes between v{prov} and v{inst}.`

---

## Step 4b — Resolve Shell & Git paths if placeholders remain

Check whether `./CLAUDE.md` still contains unresolved placeholders **or**
a previously failed `⚠ NOT DETECTED` value that should be retried:

```javascript
node -e "
const fs = require('fs');
const { execSync } = require('child_process');
const content = fs.readFileSync('./CLAUDE.md', 'utf8');
const hasPlaceholders = /\{GIT_PATH\}|\{BASH_PATH\}|NOT DETECTED.*where\.exe/.test(content);
if (!hasPlaceholders) { console.log('  ✓ No unresolved placeholders'); process.exit(0); }
const tryCmd = cmd => { try { return execSync(cmd,{encoding:'utf8',stdio:['pipe','pipe','ignore']}).split('\n')[0].trim(); } catch(e){ return ''; } };
const gitPath  = tryCmd('where.exe git')  || tryCmd('which git')  || '';
const bashPath = tryCmd('where.exe bash') || tryCmd('which bash') || '';
const out = content
  .replace(/\{GIT_PATH\}/g,  gitPath  || '⚠ NOT DETECTED — run where.exe git and update manually')
  .replace(/\{BASH_PATH\}/g, bashPath || '⚠ NOT DETECTED — run where.exe bash and update manually')
  .replace(/⚠ NOT DETECTED — run where\.exe git and update manually/g,  gitPath  || '⚠ NOT DETECTED — run where.exe git and update manually')
  .replace(/⚠ NOT DETECTED — run where\.exe bash and update manually/g, bashPath || '⚠ NOT DETECTED — run where.exe bash and update manually');
fs.writeFileSync('./CLAUDE.md', out);
if (gitPath)  console.log('  ✅ Git path resolved: ' + gitPath);
else          console.log('  ⚠ Git path not detected — placeholder left in CLAUDE.md');
if (bashPath) console.log('  ✅ Bash path resolved: ' + bashPath);
else          console.log('  ⚠ Bash path not detected — placeholder left in CLAUDE.md');
"
```

Also check whether `## 0b. Shell & Git Configuration` section is missing
entirely (projects provisioned before v2.2.0). If missing, add it from
the installed plugin's `CLAUDE.md` before resolving placeholders.

---

## Step 5 — Re-run gitignore-sync

```
Run /ai-assisted-development:gitignore-sync
```

---

## Step 5b — External stack detection

Field-state-triggered — runs after every sync, not tied to any specific migration.
`$PLUGIN_DIR` is already resolved in Step 1 — reuse it here.

Read the current state:

```bash
node -e "
const fs=require('fs');
try {
  const s=JSON.parse(fs.readFileSync('.claude/dream-init-state.json','utf8'));
  const prompted = s.external_stacks_prompted===true ? 'true' : 'false';
  const hasDirs  = ((JSON.parse(fs.readFileSync('.claude/settings.local.json','utf8'))||{}).additionalDirectories||[]).length > 0;
  console.log('PROMPTED=' + prompted);
  console.log('HAS_DIRS=' + hasDirs);
} catch(e) { console.log('PROMPTED=false'); console.log('HAS_DIRS=false'); }
"
```

**Case 1 — PROMPTED=true (user was already asked):**
Run detection silently to refresh results (dirs may have changed):
```bash
node "$PLUGIN_DIR/scripts/external-stack-detection.cjs"
```
Report: `"external_detected_stacks refreshed: [result]"`

**Case 2 — PROMPTED=false, HAS_DIRS=true:**
Set flag then run detection silently:
```bash
node -e "
const fs=require('fs'),p='.claude/dream-init-state.json';
const s=JSON.parse(fs.readFileSync(p,'utf8'));
s.external_stacks_prompted=true;
fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n');
"
node "$PLUGIN_DIR/scripts/external-stack-detection.cjs"
```
Report: `"external_detected_stacks: [result]"`

**Case 3 — PROMPTED=false, HAS_DIRS=false:**
Ask the developer:
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

## Step 6 — Mark successful completion

The version was already stamped in Step 1 (resilience). Record the successful-run date now —
reaching this step means the deployment steps completed.

```bash
node -e "
  const fs = require('fs');
  const statePath = '.claude/dream-init-state.json';
  let state = {};
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch(e) {}
  state.dream_init_plugin_version = '$INSTALLED_VERSION';   // re-affirm (idempotent)
  state.dream_sync_last_run = new Date().toISOString().slice(0, 10);
  fs.mkdirSync('.claude', { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log('  ✓ dream_sync_last_run recorded (state already at v$INSTALLED_VERSION)');
"
```

---

## Step 6b — Business context policy check (post-sync)

After the mechanical steps complete, check whether the domain-tailored severity
policy exists. This is not a reminder — run it actively.

```bash
node -e "
  const fs = require('fs');
  const bcPath = '.claude/business-context.md';
  if (!fs.existsSync(bcPath)) { console.log('MISSING'); process.exit(0); }
  const first = fs.readFileSync(bcPath, 'utf8').split('\n')[0] || '';
  console.log(first.includes('Not yet generated') ? 'STUB' : 'EXISTS');
"
```

**If `EXISTS`:** skip this step — business context is already configured. Continue to Step 7.

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

4. **On No:** note the decision and continue to Step 7. The Step 7 summary will include
   a brief reminder line so the developer sees it at the end.

---

## Step 7 — Confirm

```
✅ setup-sync complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Plugin version: v$PROVISIONED_VERSION → v$INSTALLED_VERSION
  Bootstrap:      hooks re-copied + hashes refreshed, stubs re-deployed,
                  plugin-path.txt updated, .claude/skills/ .hashes refreshed
  Rules:          {N} restored, {N} already present
  Migrations:     {list of versions applied}

  ⚠ NEXT STEP — the knowledge graph is likely STALE after a version upgrade.
    Run /graph-sync now to refresh it, or code-review/graph-viz/icea-review
    will orient off out-of-date module data.
  {if Step 6b ran SET DOMAIN → "  ✅ business-context.md generated — domain-tailored severity policy active."}
  {if Step 6b declined      → "  ⚠ business-context.md still missing — type SET DOMAIN when ready."}
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

## Step 7b — Onboarding guide refresh

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
