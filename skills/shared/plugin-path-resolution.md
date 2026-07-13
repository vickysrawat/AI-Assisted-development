# Shared spec: canonical plugin-path & stack resolution

Single source of truth for how skills locate the installed plugin and detect the
project stack. Every skill that needs `PLUGIN_DIR` or the project stack MUST use one
of the snippets below verbatim — do **not** glob `plugins/*/plugins/…`, `find` over
`~/.claude`, or crawl the source tree. Those improvisations are what caused slow
syncs and permission prompts.

---

## 0. Fast path — `.claude/plugin-path.txt`

`setup-init` and `setup-sync` write the installed plugin's absolute path (forward-slash
separators, trailing newline) to `.claude/plugin-path.txt`. This is the preferred way for
SKILL.md instructions to resolve plugin reference files — no Node.js or registry lookup
required.

**In SKILL.md Read instructions:**
```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, resolve via §1a below), then
Read $PLUGIN_DIR/skills/X
```
Always include the §1a fallback — the file is absent when the project has not run
setup-init yet, or when a skill is invoked in the stale-window between a plugin upgrade
and the next setup-sync run. The §1a fallback always returns the correct current path.

**In bash variable-capture blocks:**
```bash
PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null | tr -d '\r\n')
[ -z "$PLUGIN_DIR" ] && PLUGIN_DIR="$(node -e '...')"   # §1a fallback below
```

**Stale-window caveat:** After `install.sh --update` installs a new plugin version,
`plugin-path.txt` still points to the previous cache until setup-sync runs. Skills
invoked in this window use old reference files. Dream-status detects version drift and
prompts setup-sync, which updates the file. Do not rely on `plugin-path.txt` in projects
where setup-status reports UPGRADE PENDING.

---

## 1. Plugin path — resolve from the registry

`~/.claude/plugins/installed_plugins.json` is authoritative: it names the active
`installPath` (the versioned **cache** copy that actually runs) and `version`
together. The resolver is **fork-agnostic** (matches any marketplace key starting
with `ai-assisted-development@`), prefers the `user`-scope entry, verifies the path
exists, and **falls back** to the historical source-tree glob if the registry is
missing/unreadable. It never crawls and never throws.

### 1a. Bash flavour — for shell blocks that use `$PLUGIN_DIR` with `ls`/`cp`/`cat`/`find`

Single-quoted `node -e '…'` (no bash escaping), double-quoted JS strings, and it
normalises `\` → `/` so git-bash tools accept the Windows path.

```bash
# Path only:
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
```

```bash
# Path + version together (registry gives both; falls back to plugin.json for version):
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
```

### 1b. Node flavour — for use *inside* an existing `node -e` script

Drop this function in (assumes `fs` is already required, as the surrounding scripts
do). Uses only single quotes and no backslashes, so it is safe inside a
double-quoted `node -e "…"` block. No `\`→`/` normalisation needed — Node accepts
mixed separators on Windows.

```javascript
function resolvePluginDir(){
  const os=require('os'), pth=require('path');
  const base=pth.join(os.homedir(),'.claude','plugins');
  try{
    const reg=JSON.parse(fs.readFileSync(pth.join(base,'installed_plugins.json'),'utf8'));
    const key=Object.keys(reg.plugins||{}).find(k=>k.startsWith('ai-assisted-development@'));
    if(key){const a=reg.plugins[key]||[];const e=a.find(x=>x.scope==='user')||a[0];
      if(e&&e.installPath&&fs.existsSync(e.installPath))return e.installPath;}
  }catch(e){}
  try{for(const m of fs.readdirSync(base)){const d=pth.join(base,m,'plugins','ai-assisted-development');if(fs.existsSync(d))return d;}}catch(e){}
  return pth.join(base,'local-marketplace','plugins','ai-assisted-development');
}
```

---

## 2. Project stack — read the cached result first

`setup-init` writes `detected_stacks` into `.claude/dream-init-state.json`. Read that
first; only run the `find`-based detection when the state file is absent. The
canonical stack keys — and their rule files — are the single source of truth defined
by `setup-init` (Step 4a `stackMap`):

| Stack key          | Rule file                    |
|--------------------|------------------------------|
| `dotnet`           | `dotnet-rules.md`            |
| `dotnet_framework` | `dotnet-framework-rules.md`  |
| `angular`          | `angular-rules.md`           |
| `nodejs`           | `nodejs-rules.md`            |
| `javascript`       | `javascript-rules.md`        |
| `java`             | `java-rules.md`              |
| `python`           | `python-rules.md`            |

Any consumer that maps stacks to flags/rules MUST cover all seven keys, or it will
silently drop `dotnet_framework` / `javascript` projects.

```bash
# Cache-first: read detected_stacks; empty result → caller runs the find fallback.
STACKS="$(node -e '
try{const s=JSON.parse(require("fs").readFileSync(".claude/dream-init-state.json","utf8"));
process.stdout.write((s.detected_stacks||[]).join(" "));}catch(e){}' 2>/dev/null)"
```

---

## 3. Plugin version + drift — use the `plugin-state.cjs` tool

`scripts/plugin-state.cjs` is the **single canonical, node-only** way to learn the installed
plugin version, its install path, the project's provisioned version, and the drift between them.
It resolves the installed version from `installed_plugins.json` (registry) — an O(1) read, **no
recursive `find`** of the plugin cache.

**Hard rules (these bugs have bitten us):**
- Resolve the installed version ONLY from `installed_plugins.json` (or the `plugin.json` at its
  recorded `installPath`). **Never** read a *relative* `.claude-plugin/plugin.json` — at runtime the
  CWD is the target project, which has no such file, so it yields `unknown`.
- **Never** build a plugin path from a version (e.g. `cache/<marketplace>/<plugin>/<version>`),
  and never from `dream_init_plugin_version` — a stale value points at a cache dir that no longer
  exists.
- **Never** `find`/crawl `~/.claude/plugins`. Run the tool instead.
- Prefer the tool over rolling your own inline check — do not improvise a version lookup.

**Invocation** (locate the plugin dir with §1a first, then run the tool):
```bash
# §1a gives PLUGIN_DIR (path-only variant). Then load the state in one call:
eval "$(node "$PLUGIN_DIR/scripts/plugin-state.cjs")"
# → $INSTALLED_VERSION  $INSTALL_PATH  $PROVISIONED_VERSION  $DRIFT
#   DRIFT ∈ UP_TO_DATE | UPGRADE_PENDING | DOWNGRADE | NO_STATE | INSTALLED_UNKNOWN
```
`--json` emits a JSON object; `--field INSTALL_PATH` prints a single value. Exit code is always 0 —
branch on `$DRIFT`, not on exit status. Values are quoted, so `eval` is safe with spaces in paths.
