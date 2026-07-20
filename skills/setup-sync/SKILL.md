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
> `$PLUGIN_DIR/skills/shared/business-context-severity.md` for the B1–B7 model it does not trigger.

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

## Step 3 — Re-deploy missing rule files

Read `deployed_rules` from `.claude/dream-init-state.json` — this is the exact list
of rule files deployed during `setup-init`. Restore any that are missing from
`.claude/rules/` without re-running detection (detection is an init-time operation).

```bash
node -e "
const fs   = require('fs');
const path = require('path');
const PLUGIN_RULES = '$PLUGIN_DIR/_project-deploy/rules';
let state = {};
try { state = JSON.parse(fs.readFileSync('.claude/dream-init-state.json', 'utf8')); } catch(e) {}
const deployedRules = state.deployed_rules || [];
if (!deployedRules.length) {
  console.log('  ⚠ deployed_rules[] is empty — run /setup-init to detect and deploy rules');
  process.exit(0);
}
let restored = 0, alreadyPresent = 0;
for (const filename of deployedRules) {
  const src  = path.join(PLUGIN_RULES, filename);
  const dest = path.join('.claude', 'rules', filename);
  if (fs.existsSync(dest)) { alreadyPresent++; continue; }
  if (!fs.existsSync(src)) { console.log('  ⚠ rule not found in plugin: ' + filename); continue; }
  fs.copyFileSync(src, dest);
  console.log('  ✓ restored .claude/rules/' + filename);
  restored++;
}
console.log('  Rules: ' + restored + ' restored, ' + alreadyPresent + ' already present');
"
```

> **Note:** To pick up newly added rule files (e.g. a new ecosystem rule added
> to the plugin since last init), run `/setup-init` rather than `/setup-sync`.
> setup-sync restores the exact original set; setup-init re-runs full detection.

---

## Step 4 — Apply migration files

Read all migration files in `$PLUGIN_DIR/docs/migrations/` for versions
between `PROVISIONED_VERSION` and `INSTALLED_VERSION` (exclusive of provisioned,
inclusive of installed). Display the migration notes so the developer can
review what changed. Do not auto-apply code changes — migrations are informational.

```bash
ls "$PLUGIN_DIR/docs/migrations/"*.md 2>/dev/null | sort
```

For each migration file in range, display its content with a header:
```
📋 Migration {version}:
{content}
```

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

## Step 7 — Confirm

```
✅ setup-sync complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Plugin version: v$PROVISIONED_VERSION → v$INSTALLED_VERSION
  Bootstrap:      hooks re-copied + hashes refreshed, stubs re-deployed,
                  plugin-path.txt updated, .claude/skills/ .hashes refreshed
  Rules:          {N} restored, {N} already present
  Migrations:     {list of versions applied}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run /setup-status to verify all checks are green.
Knowledge graph may be stale after an upgrade — run /graph-sync to refresh.
```
