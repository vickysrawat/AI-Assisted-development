# Skill: dream-sync

## Purpose
Re-provision an existing project after a plugin upgrade. Reads the provisioned
version from `.claude/dream-init-state.json` and the installed version from the
plugin registry, applies migration changes, re-copies hooks, redeploys missing
command stubs and rule files, then re-stamps the version.

Triggered by: `/dream-sync` or `/dream-init --upgrade`

---

## Step 1 — Resolve plugin path and read versions

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
  console.error('PLUGIN_DIR_NOT_FOUND');
  process.exit(1);
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

If `PLUGIN_DIR_NOT_FOUND`: plugin-path.txt missing or stale and registry lookup failed.
```
⚠ Cannot locate installed plugin — run /setup-init to restore plugin-path.txt, then re-run /dream-sync.
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
🔄 dream-sync — v{PROVISIONED_VERSION} → v{INSTALLED_VERSION}
```

**Stamp the installed version NOW (before deployment steps) for resilience** — if sync is
interrupted, state already reflects the installed version, preventing a stale-version loop:

```javascript
node -e "
const fs = require('fs');
const p = '.claude/dream-init-state.json';
let s = {};
try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e) {}
s.dream_init_plugin_version = 'ACTUAL_INSTALLED_VERSION';
fs.mkdirSync('.claude', { recursive: true });
fs.writeFileSync(p, JSON.stringify(s, null, 2));
console.log('  ✓ state stamped to v' + s.dream_init_plugin_version + ' (early — survives a partial run)');
"
```

> Replace `ACTUAL_INSTALLED_VERSION` with the exact version string from `INSTALLED_VERSION` above.

---

## Step 2 — Bootstrap (re-provision hooks, stubs, rules, and skill files)

Bootstrap in sync mode handles all mechanical re-provisioning: re-copies all hook files
(always overwrite — plugin owns them), re-deploys command stubs, updates plugin-path.txt,
updates plugin-owned project skills respecting developer customisations, refreshes
`.claude/hooks/.hashes`, and re-wires settings.json with the correct shell-type hook commands.

Using the `PLUGIN_DIR` from Step 1:

```
node {PLUGIN_DIR}/scripts/setup-init-bootstrap.cjs --mode sync
```

> Substitute the actual PLUGIN_DIR path. Do not use shell variable syntax.

---

## Step 3 — Apply migration files

Read all migration files in `{PLUGIN_DIR}/docs/migrations/` for versions between
`PROVISIONED_VERSION` (exclusive) and `INSTALLED_VERSION` (inclusive). Display
migration notes so the developer can review what changed. Do not auto-apply code
changes — migrations are informational.

```javascript
node -e "
const fs=require('fs'),path=require('path');
const pluginDir = fs.readFileSync('.claude/plugin-path.txt','utf8').trim();
const dir = path.join(pluginDir,'docs','migrations');
if(!fs.existsSync(dir)){console.log('(no migrations dir)');process.exit(0);}
const files = fs.readdirSync(dir).filter(f=>f.endsWith('.md')).sort();
files.forEach(f=>console.log(path.join(dir,f)));
"
```

For each migration file in version range, display its content with a header:
```
📋 Migration {version}:
{content}
```

---

## Step 4 — Resolve Shell & Git paths if placeholders remain

Check and resolve `{GIT_PATH}` / `{BASH_PATH}` placeholders in `./CLAUDE.md`:

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

Also check whether `## 0b. Shell & Git Configuration` section is missing entirely
(projects provisioned before v2.2.0). If missing, add it from the installed plugin's
`CLAUDE.md` before resolving placeholders.

---

## Step 5 — Re-run gitignore-sync

```
Run /ai-assisted-development:gitignore-sync
```

---

## Step 6 — Confirm

```
✅ dream-sync complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Plugin version: v{PROVISIONED_VERSION} → v{INSTALLED_VERSION}
  Bootstrap:      hooks re-copied + hashes refreshed, stubs re-deployed,
                  plugin-path.txt updated, settings.json hook commands refreshed
  Migrations:     {list of versions applied, or "none in range"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run /dream-status to verify all checks are green.
Knowledge graph may be stale after an upgrade — run /graph-sync to refresh.
```
