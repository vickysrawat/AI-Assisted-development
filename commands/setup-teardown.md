---
description: "Remove plugin-managed content from a target project by scope (--full, --skills, --hooks, --rules, --commands, --state). Always dry-runs first and requires explicit CONFIRM before removing anything. memory/ is never removed. Use to clean up after version changes, resolve .hashes conflicts, or fully exit the plugin workflow."
argument-hint: "[--full | --skills | --hooks | --rules | --commands | --state]"
---

<skill>setup-teardown</skill>

## Your task

Run the deterministic teardown. **All removal logic lives in `scripts/setup-teardown.cjs`** —
your only job is to resolve the plugin path, run the script twice, and gate execution on a
single confirmation.

**Do NOT read `skills/setup-teardown/SKILL.md`. Do NOT improvise path resolution**
(`where`, `npm root`, `ls` of AppData, globbing `~/.claude`). Those are what made this
command take 10+ minutes. Follow these steps exactly.

### Step 1 — Resolve the script path (one bash call, no probing)

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
echo "PLUGIN_DIR=$PLUGIN_DIR"
```

This is the canonical §1a resolver from `skills/shared/plugin-path-resolution.md`. Use it
verbatim — do not substitute anything.

### Step 2 — Determine scope

The scope may be given as the command argument (`--full`, `--skills`, `--hooks`, `--rules`,
`--commands`, `--state`). If an argument was passed, use it and skip the scope question.

If **no** argument was passed, ask the developer with a single AskUserQuestion (header
"Scope"): offer `--full`, `--skills`, `--hooks` as options and rely on "Other" for
`--rules` / `--commands` / `--state`. Capture the chosen `{SCOPE}` (without the `--`).

### Step 3 — Dry-run (mandatory)

```bash
node "$PLUGIN_DIR/scripts/setup-teardown.cjs" --scope {SCOPE} --dry-run
```

Display the output verbatim — it lists exactly what will be removed plus any warnings.

### Step 4 — Confirm

Ask the developer with a single AskUserQuestion (header "Confirm"): "Permanently remove the
items listed above?" with options **CONFIRM** and **Cancel**. If they choose anything other
than CONFIRM, print `Cancelled — nothing removed.` and stop.

### Step 5 — Execute

```bash
node "$PLUGIN_DIR/scripts/setup-teardown.cjs" --scope {SCOPE} --execute --yes
```

`--yes` skips the script's own prompt (you already confirmed in Step 4; the Bash tool is
non-interactive, so a prompt would hang). Display the output verbatim.

### Step 6 — Advise

Print the matching next step:
- `--skills` / `--hooks` / `--rules` / `--commands`: "Run /setup-sync to redeploy."
- `--state` / `--full`: "Run /setup-init to re-provision this project from scratch."

`memory/` is never removed — it is always developer-owned.
