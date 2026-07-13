---
description: Zero-cost session warm-up — loads CLAUDE.md, memory, and architecture context in one pass so you can start working immediately without re-establishing context manually. Also surfaces any red setup-status items.
argument-hint: (no arguments needed)
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `skills/shared/model-routing-spec.md` for the full specification.

## Persona
Acts with a **[DL] Delivery Lead** lens — orient fast on true project state and the next action;
always asks "what does the developer need to know to start?" Lens only; never assume, never attribute
in output. See `skills/shared/personas-spec.md`.

---

# /session-start — Session context warm-up

Loads all project context in one structured pass. Run this at the start of every
Claude Code session instead of typing "we're working on X, here's our stack..." manually.

---

## Step 0 — Pre-load feature gate rule

Read and hold the following rule in active context for the duration of this session.
This ensures the ICEA gate fires before any feature request is processed, not reactively.

---

**FEATURE GATE — active for this session**

Before writing any implementation code for a new feature or capability:
1. STOP
2. Confirm an approved ICEA exists at `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-*.icea.md`
3. If not: run `/ai-assisted-development:icea-feature`
4. 
4. Do not generate implementation code until the ICEA is APPROVED

This applies when the developer's message:
- Describes a new feature, capability, or user-facing behaviour to build
- References an ADO work item ID (e.g. ADO #1847, #1847, story 1847)
- Is a user story format ("As a [role] I want...")
- Contains build/implement/add/create/develop intent toward new functionality

This does NOT apply to:
- Bug fixes on existing behaviour → use `/bug`
- Refactoring with no new behaviour
- Questions, explanations, code reviews, or running commands
- Requests explicitly prefixed with `/skip-icea` (warns once, then proceeds)

The constraint is on **output** — implementation code — not on the request itself.
Orientation, clarifying questions, and reading architecture docs are always permitted.

---

## Step 1 — Load project intelligence

Read the following files in order. Skip silently if any are absent.

```bash
cat CLAUDE.md 2>/dev/null || echo "NO_CLAUDE_MD"
cat memory/MEMORY.md 2>/dev/null || echo "NO_MEMORY"
ls memory/topic-*.md 2>/dev/null | head -5
cat memory/dream-log.md 2>/dev/null | tail -20
cat .claude/architecture/architecture.md 2>/dev/null | head -60
cat .claude/graph/graph-index.md 2>/dev/null
```

---

## Step 2 — Read recent topic files

For each topic file found (max 5, most recently modified first):

```bash
ls -t memory/topic-*.md 2>/dev/null | head -5
```

Read each one. Extract only: decisions still in force, patterns confirmed, errors to avoid.
Do not summarise — extract actionable facts only.

**Citation telemetry** (feeds /dream-audit): for each topic file whose content
actually influenced this session brief (i.e. at least one extracted fact came from
it), update its `Last-cited:` header stamp:

```bash
# For each cited file — update or insert the stamp on line 2
sed -i "0,/^Last-cited:.*/s//Last-cited: $(date +%Y-%m-%d)/" memory/topic-{name}.md
grep -q "^Last-cited:" memory/topic-{name}.md || sed -i "2i Last-cited: $(date +%Y-%m-%d)" memory/topic-{name}.md
```

Only stamp files that were genuinely used — a file read but contributing nothing
is not a citation. This distinction is what makes /dream-audit's staleness
analysis meaningful.

---

## Step 3 — Quick infrastructure check

Run these silently. Only surface ❌ Red results — do not report ✅ Green items:

```bash
ls CLAUDE.md 2>/dev/null || echo "MISSING: CLAUDE.md"
ls memory/MEMORY.md 2>/dev/null || echo "MISSING: memory/MEMORY.md"
ls .claude/graph/graph-index.md 2>/dev/null || echo "MISSING: graph-index.md — run /setup-init"
ls .claude/architecture/architecture-deployment.md 2>/dev/null || echo "MISSING: architecture-deployment.md — run /update-arch --deployment"
ls .claude/file-cache.json 2>/dev/null || echo "MISSING: file-cache.json — run /setup-init"
ls token-analysis/token-graph.json 2>/dev/null || echo "MISSING: token-graph.json — run /setup-init"
[ -f ".claude/settings.json" ] && git check-ignore -q ".claude/settings.json" 2>/dev/null \
  || echo "WARNING: .claude/settings.json not gitignored — credential leak risk"
# Enforcement floor presence (ADR 0010 — the local floor is the only floor)
if ! grep -q "Enforcement floor: DECLINED" .claude/architecture/architecture-deployment.md 2>/dev/null; then
  [ -x .git/hooks/pre-commit ] && grep -q "findings-gate" .git/hooks/pre-commit 2>/dev/null \
    || echo "FLOOR: findings-gate pre-commit hook not installed — run /setup-init or see _project-deploy/hooks/README.md"
  grep -q "icea-floor.sh" .claude/settings.json 2>/dev/null \
    || echo "FLOOR: PreToolUse icea-floor hook not wired — run /setup-init or see _project-deploy/hooks/README.md"
fi
```

Check for a stale knowledge graph flag set by the post-merge hook:

```bash
ls .claude/graph/.stale 2>/dev/null && echo "GRAPH_STALE" || echo "GRAPH_CURRENT"
```

If `GRAPH_STALE` is emitted, surface as a WARNING in the Step 4 brief:
```
⚠ Knowledge graph is stale since last git pull — run /graph-sync to refresh.
```

Plugin version-drift check — compare the version that provisioned this project against the
version actually installed. The installed version is read **only** from `installed_plugins.json`
(the registry, authoritative) or the `plugin.json` at its recorded `installPath` — **never**
construct a plugin path from the state's version field, since a stale value points at a cache dir
that no longer exists:

Use the canonical `plugin-state.cjs` tool (semver-aware, no `find`, no relative plugin.json —
see `skills/shared/plugin-path-resolution.md §3`). Resolve the plugin dir with the §1a one-liner,
then read the state in one call:

```bash
PLUGIN_DIR="$(node -e '
const fs=require("fs"),os=require("os"),path=require("path");
const base=path.join(os.homedir(),".claude","plugins");const norm=p=>p?p.split(String.fromCharCode(92)).join("/"):"";let dir="";
try{const reg=JSON.parse(fs.readFileSync(path.join(base,"installed_plugins.json"),"utf8"));const key=Object.keys(reg.plugins||{}).find(k=>k.startsWith("ai-assisted-development@"));if(key){const a=reg.plugins[key]||[];const e=a.find(x=>x.scope==="user")||a[0];if(e&&e.installPath&&fs.existsSync(e.installPath))dir=e.installPath;}}catch(e){}
if(!dir){try{for(const m of fs.readdirSync(base)){const p=path.join(base,m,"plugins","ai-assisted-development");if(fs.existsSync(p)){dir=p;break;}}}catch(e){}}
process.stdout.write(norm(dir));')"
if [ -n "$PLUGIN_DIR" ]; then
  eval "$(node "$PLUGIN_DIR/scripts/plugin-state.cjs")"
  [ "$DRIFT" = "UPGRADE_PENDING" ] && echo "PLUGIN_DRIFT: provisioned v$PROVISIONED_VERSION -> installed v$INSTALLED_VERSION"
fi
```

If `PLUGIN_DRIFT` is emitted, surface as a WARNING in the Step 4 brief:
```
⚠ Plugin upgraded {old} → {new} — run /setup-sync to re-provision this project.
```

Also check for sensitive gitignore skips (surface only if sensitive patterns were declined):

```bash
node -e "
const fs = require('fs');
try {
  const state = JSON.parse(fs.readFileSync('.claude/dream-init-state.json','utf8'));
  const skipped = state.gitignore_skipped_by_developer || [];
  const sensitive = skipped.filter(e => /\.env|appsettings\.|secret|credential|password|token|\.pem|\.key|\.p12/i.test(e));
  if (sensitive.length > 0) console.log('SENSITIVE_SKIPS: ' + sensitive.join(', '));
} catch(e) {}
" 2>/dev/null
```

If `SENSITIVE_SKIPS` is emitted, surface as a WARNING alongside the other items.

Also check whether any rule files deployed by setup-init are missing from
`.claude/rules/`. Read `deployed_rules` from `dream-init-state.json` (written by
the frontmatter-discovery loop in setup-init Step 4b/4c) and verify each file exists.

```bash
node -e "
const fs   = require('fs');
const path = require('path');

try {
  const state = JSON.parse(fs.readFileSync('.claude/dream-init-state.json', 'utf8'));

  // Modern path: deployed_rules[] written by frontmatter-discovery setup-init
  if (Array.isArray(state.deployed_rules) && state.deployed_rules.length > 0) {
    const missing = state.deployed_rules
      .filter(f => !fs.existsSync(path.join('.claude/rules', f)));
    if (missing.length > 0) console.log('RULES_OUT_OF_SYNC: ' + missing.join(', '));
    return;
  }

  // Legacy fallback: older setup-init wrote detected_stacks[] with canonical keys
  const STACK_RULES = {
    dotnet:            'csharp-dotnet-rules.md',
    dotnet_framework:  'csharp-framework48-rules.md',
    java:              'java-rules.md',
    python:            'python-rules.md',
  };
  const stacks = state.detected_stacks || [];
  const missing = stacks
    .filter(s => STACK_RULES[s])
    .map(s => STACK_RULES[s])
    .filter(f => !fs.existsSync(path.join('.claude/rules', f)));
  if (!fs.existsSync('.claude/rules/project-rules.md')) missing.unshift('project-rules.md');
  if (missing.length > 0) console.log('RULES_OUT_OF_SYNC: ' + missing.join(', '));
} catch(e) {}
" 2>/dev/null
```

If `RULES_OUT_OF_SYNC` is emitted, surface as:
```
⚠ Rules out of sync — the following rule files are registered for this project
  but missing from .claude/rules/ (likely added in a plugin update):
    {file list, one per line}
  Run /setup-init to deploy them.
```

---

## Step 3b — Verify external directory map

Check whether any manifest files have changed since `setup-init` last ran the
external directory scan. Only surface this if staleness is detected — do not
report anything when everything is current.

```bash
node -e "
const fs = require('fs');
try {
  const state = JSON.parse(fs.readFileSync('.claude/dream-init-state.json', 'utf8'));
  const snap = state.external_dir_snapshot || {};
  const stale = Object.entries(snap).filter(([file, saved]) => {
    try { return fs.statSync(file).mtimeMs > saved.mtime; } catch { return false; }
  }).map(([f]) => f);
  if (stale.length > 0) console.log('STALE_MANIFESTS: ' + stale.join(', '));
} catch(e) {}
" 2>/dev/null
```

If `STALE_MANIFESTS` is emitted, surface as:
```
⚠ Project manifests have changed since last /setup-init:
    {file list, one per line}
  Run /sync-dirs to re-sync external directories.
```

If `.claude/dream-init-state.json` is absent or has no `external_dir_snapshot`
key, skip silently — the project may not have external directories or may not
have run `setup-init` yet.

---

## Step 4 — Print the session brief

Output this block and nothing else. Keep it under 20 lines:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Session ready — {project name from CLAUDE.md}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Stack         : {stack from CLAUDE.md e.g. .NET 8 · Angular 17 · Node.js}
  ADO project   : {org/project from CLAUDE.md}
  Target branch : {target branch from CLAUDE.md}

  Last decision : {most recent architecture/approach decision from memory}
  Last fix      : {most recent error-resolved entry from memory}
  Active areas  : {modules from graph-index, comma-separated}

  Sessions since last /dream: {calculate from dream-log.md last run date}
  {⚠ Run /dream soon — N sessions since last consolidation  |  (omit if ≤5 sessions)}
  {⚠ Knowledge graph is stale since last git pull — run /graph-sync to refresh.  |  (omit if GRAPH_CURRENT)}

  Tip: scope each request to one file or one function — broad requests produce broad output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If any ❌ Red items were found in Step 3, append:

```
  ⚠ Setup issues:
    {list each MISSING or WARNING item, one per line}
  Run /setup-status for the full health report.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If CLAUDE.md is missing entirely, output:
```
⚠ No CLAUDE.md found. Run /setup-init to set up this project.
```
And stop.

---

## Hard Rules

- NEVER scan source files — read only the four files listed in Step 1
- NEVER ask the developer for information — infer everything from what is on disk
- NEVER output more than 20 lines — this is a brief, not a report
- NEVER run /setup-status in full — only check the five items in Step 3
- If nothing is in memory yet, say "No memory yet — run /dream after a few sessions"
