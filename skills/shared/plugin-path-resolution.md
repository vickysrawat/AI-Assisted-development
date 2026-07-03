# Shared spec: canonical plugin-path & stack resolution

Single source of truth for how skills locate the installed plugin and detect the
project stack. Every skill that needs `PLUGIN_DIR` or the project stack MUST use one
of the snippets below verbatim — do **not** glob `plugins/*/plugins/…`, `find` over
`~/.claude`, or crawl the source tree. Those improvisations are what caused slow
syncs and permission prompts.

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

`dream-init` writes `detected_stacks` into `.claude/dream-init-state.json`. Read that
first; only run the `find`-based detection when the state file is absent. The
canonical stack keys — and their rule files — are the single source of truth defined
by `dream-init` (Step 4a `stackMap`):

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
