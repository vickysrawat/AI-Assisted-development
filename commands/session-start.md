---
description: Zero-cost session warm-up — loads CLAUDE.md, memory, and architecture context in one pass so you can start working immediately without re-establishing context manually. Also surfaces any red dream-status items.
argument-hint: (no arguments needed)
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `skills/shared/model-routing-spec.md` for the full specification.

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
ls .claude/graph/graph-index.md 2>/dev/null || echo "MISSING: graph-index.md — run /dream-init"
ls .claude/architecture/architecture-deployment.md 2>/dev/null || echo "MISSING: architecture-deployment.md — run /update-arch --deployment"
ls .claude/file-cache.json 2>/dev/null || echo "MISSING: file-cache.json — run /dream-init"
ls token-analysis/token-graph.json 2>/dev/null || echo "MISSING: token-graph.json — run /dream-init"
[ -f ".claude/settings.json" ] && git check-ignore -q ".claude/settings.json" 2>/dev/null \
  || echo "WARNING: .claude/settings.json not gitignored — credential leak risk"
# Enforcement floor presence (ADR 0010 — the local floor is the only floor)
if ! grep -q "Enforcement floor: DECLINED" .claude/architecture/architecture-deployment.md 2>/dev/null; then
  [ -x .git/hooks/pre-commit ] && grep -q "findings-gate" .git/hooks/pre-commit 2>/dev/null \
    || echo "FLOOR: findings-gate pre-commit hook not installed — run /dream-init or see hooks/README.md"
  grep -q "icea-floor.sh" .claude/settings.json 2>/dev/null \
    || echo "FLOOR: PreToolUse icea-floor hook not wired — run /dream-init or see hooks/README.md"
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

Also check whether any rule files expected by the plugin are missing from
`.claude/rules/`. Read the deployed stacks from `dream-init-state.json` and
compare against the plugin's known rule manifest:

```bash
node -e "
const fs   = require('fs');
const path = require('path');

// Map each stack flag to its rule file
const STACK_RULES = {
  dotnet:            'dotnet-rules.md',
  dotnet_framework:  'dotnet-framework-rules.md',
  angular:           'angular-rules.md',
  nodejs:            'nodejs-rules.md',
  javascript:        'javascript-rules.md',
  java:              'java-rules.md',
  python:            'python-rules.md',
};

try {
  const state = JSON.parse(fs.readFileSync('.claude/dream-init-state.json', 'utf8'));
  const stacks = state.detected_stacks || [];           // array of stack keys saved by dream-init
  const missing = stacks
    .filter(s => STACK_RULES[s])
    .map(s => STACK_RULES[s])
    .filter(f => !fs.existsSync(path.join('.claude/rules', f)));
  // Always check project-rules.md regardless of stack
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
  Run /dream-init to deploy them.
```

---

## Step 3b — Verify external directory map

Check whether any manifest files have changed since `dream-init` last ran the
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
⚠ Project manifests have changed since last /dream-init:
    {file list, one per line}
  Run /sync-dirs to re-sync external directories.
```

If `.claude/dream-init-state.json` is absent or has no `external_dir_snapshot`
key, skip silently — the project may not have external directories or may not
have run `dream-init` yet.

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
  Run /dream-status for the full health report.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If CLAUDE.md is missing entirely, output:
```
⚠ No CLAUDE.md found. Run /dream-init to set up this project.
```
And stop.

---

## Hard Rules

- NEVER scan source files — read only the four files listed in Step 1
- NEVER ask the developer for information — infer everything from what is on disk
- NEVER output more than 20 lines — this is a brief, not a report
- NEVER run /dream-status in full — only check the five items in Step 3
- If nothing is in memory yet, say "No memory yet — run /dream after a few sessions"
