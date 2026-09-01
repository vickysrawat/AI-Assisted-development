---
name: session-start
description: >
  Zero-cost session warm-up — loads CLAUDE.md, memory, and architecture context in one pass so
  you can start working immediately without re-establishing context manually. Invoked by the
  /session-start command.
---

_Skill version: 1.0 · Last changed: 2026-08-31 · Plugin compatibility: ≥1.14.0 · Consent: C_

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

> **Related specs:** Consent Category C — architecture docs + memory only, never source (`skills/shared/source-file-consent.md`); canonical memory read set per `skills/shared/dream-memory-reading-spec.md`. Severity vocabulary per `skills/shared/business-context-severity.md`.

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
cat .claude/architecture/architecture-deployment.md 2>/dev/null | head -20
cat .claude/graph/graph-index.md 2>/dev/null
```

> `architecture-deployment.md` (hosting/auth/secrets + NFR) is loaded for deployment-context
> awareness; it never reads application source.

---

## Step 1b — Resolve session identity (best-effort, non-blocking)

Populate `.claude/session-context.json` so the governance audit trail can attribute events to a
verified person, not just the OS login. This is best-effort: every part degrades to empty and
NEVER blocks the session. It is cached for 7 days (identity rarely changes) so it does not add
per-session latency — the ADO call runs at most once a week.

```bash
CTX=.claude/session-context.json
FRESH=0
if [ -f "$CTX" ]; then
  AGE_DAYS=$(( ( $(date +%s) - $(stat -c %Y "$CTX" 2>/dev/null || echo 0) ) / 86400 ))
  [ "$AGE_DAYS" -lt 7 ] && FRESH=1
fi
if [ "$FRESH" = "0" ]; then
  UPN=$(whoami.exe /upn 2>/dev/null || echo "")          # AD UPN on Windows; empty elsewhere
  GITEMAIL=$(git config user.email 2>/dev/null || echo "")
  PRINCIPAL=""
  if [ -n "${AZURE_DEVOPS_PAT:-}" ]; then                 # PAT-verified cloud identity (optional)
    PRINCIPAL=$(curl -s --ssl-no-revoke -4 --max-time 5 \
      "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1" \
      -H "Authorization: Basic $(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w 0)" 2>/dev/null \
      | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).emailAddress||'')}catch(e){console.log('')}})" 2>/dev/null || echo "")
  fi
  SC_UPN="$UPN" SC_EMAIL="$GITEMAIL" SC_PRINCIPAL="$PRINCIPAL" node -e "
    const fs=require('fs');
    const upn=process.env.SC_UPN||'', email=process.env.SC_EMAIL||'', principal=process.env.SC_PRINCIPAL||'';
    fs.mkdirSync('.claude',{recursive:true});
    fs.writeFileSync('.claude/session-context.json', JSON.stringify({
      git_email: email, upn, principal_name: principal,
      verified_actor: principal || upn || '',      // PAT identity (strongest) else AD UPN
      resolved_at: new Date().toISOString()
    }, null, 2));
  " 2>/dev/null || true
fi
```

The audit helper reads `verified_actor` from this file; when it is present, events are tagged
`actor_confidence: "verified"`. If this step produces nothing (no PAT, non-Windows, offline),
attribution simply falls back to the OS login — nothing breaks.

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
  Tip: for a large reviewed plan, reply APPROVE ALL ADO-{ID} once — writes proceed without a per-file pause (diffs still shown; secrets/findings gates never skip).

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
