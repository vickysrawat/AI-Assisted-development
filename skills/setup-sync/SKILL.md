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
> `../shared/business-context-severity.md` for the B1–B7 model it does not trigger.

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
never assume, never attribute in output. See `../shared/personas-spec.md`.

---

## Step 1 — Resolve plugin path and read versions

> ⚠️ **HARD RULE — DO NOT IMPROVISE VERSION DETECTION.**
> Run the bash command below exactly as written. The installed version comes ONLY from
> `installed_plugins.json` (the registry). Never read `.claude-plugin/plugin.json` as a relative
> path (it does not exist in target projects), never infer the installed version from `CLAUDE.md`,
> and never construct a plugin path from the state's version field. Those approaches all produce
> false "no drift" verdicts that silently skip upgrades. If the bash command returns
> `INSTALLED_VERSION=unknown`, report that and stop — do not guess.

```bash
# Resolve the installed plugin dir + version from the registry (installed_plugins.json).
# Fork-agnostic, prefers user scope, normalises \ -> /, falls back to the source glob.
# Canonical resolver: see skills/shared/plugin-path-resolution.md §1a.
IFS=$'\t' read -r PLUGIN_DIR INSTALLED_VERSION < <(node -e '
const fs=require("fs"),os=require("os"),path=require("path");
const base=path.join(os.homedir(),".claude","plugins");
const norm=p=>p?p.split(String.fromCharCode(92)).join("/"):"";
let dir="",ver="";
try{
  const reg=JSON.parse(fs.readFileSync(path.join(base,"installed_plugins.json"),"utf8"));
  const key=Object.keys(reg.plugins||{}).find(k=>k.startsWith("ai-assisted-development@"));
  if(key){const a=reg.plugins[key]||[];const e=a.find(x=>x.scope==="user")||a[0];
    if(e&&e.installPath&&fs.existsSync(e.installPath)){dir=e.installPath;ver=e.version||"";}}
}catch(e){}
if(!dir){try{for(const m of fs.readdirSync(base)){const p=path.join(base,m,"plugins","ai-assisted-development");if(fs.existsSync(p)){dir=p;break;}}}catch(e){}}
if(dir&&!ver){try{ver=JSON.parse(fs.readFileSync(path.join(dir,".claude-plugin","plugin.json"),"utf8")).version||"";}catch(e){}}
process.stdout.write(norm(dir)+"\t"+(ver||"unknown"));
')
PLUGIN_HOOKS="$PLUGIN_DIR/_project-deploy/hooks"
PLUGIN_STUBS="$PLUGIN_DIR/_project-deploy/commands"
PLUGIN_RULES="$PLUGIN_DIR/_project-deploy/rules"

# Read provisioned version
PROVISIONED_VERSION=$(node -e "
  const fs = require('fs');
  try {
    const s = JSON.parse(fs.readFileSync('.claude/dream-init-state.json', 'utf8'));
    process.stdout.write(s.dream_init_plugin_version || 'unknown');
  } catch(e) { process.stdout.write('unknown'); }
")
```

Display:
```
🔄 setup-sync — v$PROVISIONED_VERSION → v$INSTALLED_VERSION
```

If `INSTALLED_VERSION` is `unknown`:
```
⚠ Cannot read installed plugin version.
  Ensure the plugin is installed: bash install.sh
```
Stop here.

**Stamp the state to the installed version NOW — before the deployment steps below.**
This is resilience: if the sync is interrupted or a later step fails, the state still reflects
the installed version, so it is never left stale. A stale version is what triggers setup-sync in
the first place, and can lead tooling to look for a plugin cache dir that no longer exists (the
exact failure this guards against). The deployment steps are all idempotent, and `setup-status`
independently verifies that rules/hooks/stubs are actually present — so the version field and the
artifact-presence are checked separately.

```bash
node -e "
  const fs = require('fs');
  const p = '.claude/dream-init-state.json';
  let s = {};
  try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e) {}
  s.dream_init_plugin_version = '$INSTALLED_VERSION';
  fs.mkdirSync('.claude', { recursive: true });
  fs.writeFileSync(p, JSON.stringify(s, null, 2));
  console.log('  ✓ state stamped to v$INSTALLED_VERSION (early — survives a partial run)');
"
```

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

```bash
node "$PLUGIN_DIR/scripts/setup-init-bootstrap.cjs" --mode sync
```

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

```bash
grep -qE "\{GIT_PATH\}|\{BASH_PATH\}|NOT DETECTED.*where\.exe" ./CLAUDE.md 2>/dev/null
```

If placeholders or NOT DETECTED values found, resolve them:

```bash
# Strip any existing NOT DETECTED values back to placeholders so detection can overwrite them
sed -i 's|⚠ NOT DETECTED — run where\.exe git and update manually|{GIT_PATH}|g' ./CLAUDE.md
sed -i 's|⚠ NOT DETECTED — run where\.exe bash and update manually|{BASH_PATH}|g' ./CLAUDE.md

# Git path — try where.exe, then which, then known locations
GIT_PATH=$(where.exe git 2>/dev/null | head -1 | tr -d '\r\n')
[ -z "$GIT_PATH" ] && GIT_PATH=$(which git 2>/dev/null | tr -d '\r\n')
[ -z "$GIT_PATH" ] && GIT_PATH=$(ls "/mingw64/bin/git.exe" "/usr/bin/git" "C:/Program Files/Git/bin/git.exe" "C:/Program Files/Git/mingw64/bin/git.exe" 2>/dev/null | head -1)

# Bash path — try where.exe, then which, then known locations
BASH_PATH=$(where.exe bash 2>/dev/null | head -1 | tr -d '\r\n')
[ -z "$BASH_PATH" ] && BASH_PATH=$(which bash 2>/dev/null | tr -d '\r\n')
[ -z "$BASH_PATH" ] && BASH_PATH=$(ls "/usr/bin/bash" "/bin/bash" "C:/Program Files/Git/bin/bash.exe" "C:/Program Files/Git/usr/bin/bash.exe" 2>/dev/null | head -1)

if [ -n "$GIT_PATH" ]; then
  sed -i "s|{GIT_PATH}|$GIT_PATH|g" ./CLAUDE.md
  echo "  ✅ Git path resolved: $GIT_PATH"
else
  sed -i 's|{GIT_PATH}|⚠ NOT DETECTED — run where.exe git and update manually|g' ./CLAUDE.md
  echo "  ⚠ Git path not detected — placeholder left in CLAUDE.md"
fi

if [ -n "$BASH_PATH" ]; then
  sed -i "s|{BASH_PATH}|$BASH_PATH|g" ./CLAUDE.md
  echo "  ✅ Bash path resolved: $BASH_PATH"
else
  sed -i 's|{BASH_PATH}|⚠ NOT DETECTED — run where.exe bash and update manually|g' ./CLAUDE.md
  echo "  ⚠ Bash path not detected — placeholder left in CLAUDE.md"
fi
```

echo "  ✓ Shell & Git paths resolved in ./CLAUDE.md"

Also check whether `## 0b. Shell & Git Configuration` section is missing
entirely (projects provisioned before v2.2.0). If missing, add it from
the installed plugin's `CLAUDE.md` before resolving placeholders.

---

## Step 5 — Re-run gitignore-sync

```
Run /ai-assisted-development:gitignore-sync
```

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
