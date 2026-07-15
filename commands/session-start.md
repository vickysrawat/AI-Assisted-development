---
description: Zero-cost session warm-up — loads CLAUDE.md, memory, and architecture context in one pass so you can start working immediately without re-establishing context manually.
argument-hint: (no arguments needed)
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

## Persona
Acts with a **[DL] Delivery Lead** lens — orient fast on true project state and the next action;
always asks "what does the developer need to know to start?" Lens only; never assume, never attribute
in output. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

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

## Step 3 — Print the session brief

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

  Tip: scope each request to one file or one function — broad requests produce broad output.

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
- If nothing is in memory yet, say "No memory yet — run /dream after a few sessions"
