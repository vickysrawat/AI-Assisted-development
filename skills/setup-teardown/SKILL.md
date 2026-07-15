---
name: setup-teardown
description: >
  Remove plugin-managed content from a target project, either completely (--full) or
  by scope (--skills, --hooks, --rules, --commands, --state). Always dry-runs first and
  requires explicit CONFIRM before touching the filesystem. Safe to run any time;
  memory/ is never removed.
  Triggered by /ai-assisted-development:setup-teardown.
---

# Dream Teardown Skill

_Skill version: 2.0 · Last changed: 2026-07-08 · Consent: C_

> **Business context severity:** infrastructure skill — no security findings. See
> `$PLUGIN_DIR/skills/shared/business-context-severity.md` for the B1–B7 model it does not trigger.

## Purpose

Remove plugin-managed content from a target project. Use when:
- Resolving conflicts from pre-`.hashes` `.claude/skills/` deployments
- Resetting a project after a major plugin version change
- Recovering from accumulated drift that setup-sync cannot fix incrementally
- A developer wants to fully exit the plugin workflow

`memory/` is NEVER removed — it is always developer-owned.

Triggered by: `/setup-teardown` or `/setup-teardown --<scope>`

---

## Persona

Acts with a **[DPE] DevOps/Platform Engineer** lens — safe-to-run, explicit confirmation,
no silent destruction, clear audit trail. Always shows exactly what will be removed before
touching anything.

---

## Step 1 — Resolve scope

If a scope flag was passed as an argument (`--full`, `--skills`, `--hooks`, `--rules`,
`--commands`, `--state`), capture it and skip to Step 2.

If no flag was passed, display the scope selection menu and wait for input:

```
🧹 setup-teardown — select what to remove:

  1. --full          Remove all plugin-managed content (complete clean slate)
  2. --skills        Remove .claude/skills/ and .hashes only
  3. --hooks         Remove .claude/hooks/ and pre-commit hook only
  4. --rules         Remove deployed rule files from .claude/rules/ only
  5. --commands      Remove command stubs from .claude/commands/ only
  6. --state         Remove dream-init-state.json and plugin-path.txt only

Enter a number (1–6) or the flag name directly:
```

Map numbers to flags: 1→`--full`, 2→`--skills`, 3→`--hooks`, 4→`--rules`,
5→`--commands`, 6→`--state`. Any other input → display the menu again.

---

## Step 2 — Dry-run

Resolve `PLUGIN_DIR` with the canonical **§1a resolver** from
`skills/shared/plugin-path-resolution.md` — a single `node -e` call. **Never improvise
path lookup** (`where`, `npm root -g`, `ls` of AppData, globbing `~/.claude`); that
crawling is banned by the resolution spec and is what made this command take 10+ minutes.

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
```

Then run the teardown script in dry-run mode:

```bash
node "$PLUGIN_DIR/scripts/setup-teardown.cjs" --scope {SCOPE} --dry-run
```

> The script is the deterministic source of truth for all removal. Run directly in a
> terminal with no `--scope`, it drives its own menu → dry-run → CONFIRM flow; `--yes`
> skips the confirm for CI. Inside Claude Code the Bash tool is non-interactive, so this
> skill supplies `--scope` and (on execute) `--yes`.

Display the script output verbatim. The script prints exactly what will be removed,
warnings (e.g. customised pre-commit hook skipped), and a count.

---

## Step 3 — Confirmation

Display:
```
⚠ This will permanently remove the items listed above. Type CONFIRM to proceed,
  or anything else to cancel:
```

If the developer types anything other than exactly `CONFIRM` (case-sensitive): print
`Cancelled — nothing removed.` and stop.

---

## Step 4 — Execute

```bash
node "$PLUGIN_DIR/scripts/setup-teardown.cjs" --scope {SCOPE} --execute
```

Display the script output verbatim.

---

## Step 5 — Advise

Follow with scope-specific advice:

- `--skills`: "Run /setup-sync to redeploy plugin project skills with .hashes tracking."
- `--hooks`: "Run /setup-sync to redeploy hooks."
- `--rules`: "Run /setup-sync to restore deployed rules."
- `--commands`: "Run /setup-sync to redeploy command stubs."
- `--state`: "Run /setup-init to re-provision this project from scratch."
- `--full`: "Run /setup-init to re-provision this project from scratch."

---

## Hard Rules

These are enforced by `scripts/setup-teardown.cjs` — not just documented.

- NEVER remove `memory/` — it is always developer property.
- NEVER remove CLAUDE.md entirely — only strip plugin-managed sections.
- NEVER remove `.claude/rules/` files not listed in `deployed_rules[]`.
- NEVER remove `.git/hooks/pre-commit` if its content differs from the plugin hook.
- ALWAYS dry-run before any filesystem change (Step 2 is mandatory).
- ALWAYS require `CONFIRM` before executing (Step 3 is mandatory).
- ALWAYS restore `.git/hooks/pre-commit.backup` if it exists and the plugin hook is removed.
