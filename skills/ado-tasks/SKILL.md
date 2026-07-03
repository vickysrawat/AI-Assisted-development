---
name: ado-tasks
description: >
  Generates a complete Azure DevOps task breakdown from an approved ICEA document.
  Creates one task per Acceptance Criterion per active layer (the layers are read
  from architecture.md — e.g. backend, frontend, middleware, QA, DB, Infra — and
  are stack-agnostic), with titles, tags, and effort estimates. Use when a
  developer or PM
  asks to break down a story, create tasks, generate ADO tasks, estimate work,
  or plan a sprint item. Triggers on: "break down this story", "create tasks",
  "generate ADO tasks", "what tasks do I need", "plan this feature",
  "sprint planning", or any request to decompose a work item into sub-tasks.
---

# ADO Task Breakdown Skill

_Skill version: 1.1 · Last changed: 2026-06-09 · Plugin compatibility: ≥1.20.4 · Consent: C_
## Purpose
Turn an approved ICEA document into a complete, ready-to-create Azure DevOps
task list. Every Acceptance Criterion gets a corresponding task per layer.
No guesswork, no missed work, no surprises mid-sprint.

## Stack Context

Stack context is read from `.claude/architecture/architecture.md` during the
Codebase Orientation step. If that file is missing, fall back to the project
defaults below.

**Default layers (used only when architecture.md is absent — it overrides this):**
- Layers: backend · frontend · middleware (the actual stack is read from
  `architecture.md`; common combinations include .NET/Angular/Node, Spring Boot,
  and Python FastAPI/Django/Flask)
- Tracking: Azure DevOps — Epic → Feature → User Story → Task hierarchy
- Branch: `feature/ADO-[ID]-short-description`
- Commit: `[ADO-ID] Short description of change`
- PR title: `[ADO-ID] Feature name — brief summary`


## Codebase Orientation (optional — run if architecture docs exist)

> Schema: `../shared/graph-index-schema.md` · `../shared/graph-module-schema.md`

Before executing, check for orientation files — do not scan source:

1. **Read `.claude/architecture/architecture.md`** if present — use it to identify the active layers (backend/frontend/middleware) for this project. This determines which task categories to include.
2. **Read `.claude/graph/graph-index.md`** if present — use it to identify the module, domain, and entry-point file for context in output; read the matching `.claude/graph/<module>.md` for detail.
3. **Staleness check**: if `.claude/graph/.stale` exists, note it inline (run `/graph-sync`) — do not block.
4. If neither architecture file exists, continue with the default stack above.

## Execution Steps

### Step 1 — Collect the ICEA

**First, check whether an ICEA file already exists for this work item:**

```bash
ls docs/icea/ADO-{ID}-*.md 2>/dev/null | head -1
```

- **File found:** read it and proceed with the ICEA content below.
- **File not found:** fall back to fetching the work item directly from ADO
  (see Step 1b below).

If no ADO ID was provided and no ICEA is in context, ask:
```
Paste the approved ICEA for this story (or just the Context and
Acceptance Criteria sections).
ADO work item ID?
```

---

### Step 1b — ADO fallback (no ICEA file found)

When there is no ICEA file, fetch the work item directly from Azure DevOps.

**Resolve PAT** — check the environment:

```bash
echo $AZURE_DEVOPS_PAT
```

- **Set and non-empty:** use it silently. Never echo or log the value.
- **Not set:** prompt the developer:
  > "Your `AZURE_DEVOPS_PAT` is not set. Paste it here for this request
  > only, or set it as a Windows User Environment Variable for persistence.
  > See `references/ado-connection-guide.md` for storage options."

Build the auth header and immediately scrub the raw PAT:

```bash
AUTH=$(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w 0)
unset AZURE_DEVOPS_PAT
```

Read ADO coordinates from `CLAUDE.md`:

```bash
ADO_ORG=$(grep -E "^- Organization\s*:" CLAUDE.md 2>/dev/null | sed 's/.*: *//')
ADO_PROJECT=$(grep -E "^- Project\s*:" CLAUDE.md 2>/dev/null | sed 's/.*: *//')
```

Fetch the work item — **always include `--ssl-no-revoke -4`** on a
corporate network (see `references/ado-connection-guide.md` for why):

```bash
curl -s --ssl-no-revoke -4 \
  -H "Authorization: Basic $AUTH" \
  "https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/{ID}?\$expand=all&api-version=7.1" \
| node -e "
const chunks=[]; process.stdin.on('data',c=>chunks.push(c)); process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(chunks));
  const f=d.fields;
  const strip=s=>(s||'').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&quot;/g,'\"')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
    .replace(/\s+/g,' ').trim();
  console.log('Title:', f['System.Title']);
  console.log('Type:', f['System.WorkItemType']);
  console.log('State:', f['System.State']);
  console.log('Sprint:', f['System.IterationPath']);
  console.log('');
  console.log('=== Description ===');
  console.log(strip(f['System.Description']));
  console.log('');
  console.log('=== Acceptance Criteria ===');
  console.log(strip(f['Microsoft.VSTS.Common.AcceptanceCriteria']));
});"
```

> **Use Node.js, not Python.** On Windows, `python` may open the Microsoft
> Store rather than run. Node.js is always available in the Claude Code environment.

If the response is empty or curl exits non-zero:
```
❌ ADO fetch failed for item {ID}.
   Diagnosis: run with -v flag to see the full handshake.
   See references/ado-connection-guide.md for common failure patterns and fixes.
```
Do not proceed. Show the error and stop.

Treat the fetched `Description` + `Acceptance Criteria` fields as the ICEA
content for all subsequent steps. Note in the output:
```
ℹ No ICEA file found for ADO-{ID}. Working from ADO work item description directly.
  Run /icea-feature ADO-{ID} to generate a formal ICEA before the next sprint.
```

### Step 2 — Analyse Layers in Scope

From the ICEA Context section and `architecture.md`, identify which layers are active:
- Frontend component/route present (Angular, React, etc.) → frontend tasks required
- Backend endpoint present (.NET, Spring Boot, FastAPI/Django/Flask, etc.) → backend tasks required
- Middleware/service tier present (Node.js, etc.) → middleware tasks required
- DB entity / migration present → Database tasks required
- Any of the above → QA tasks always required
- Auth policy or pipeline changes → Infra tasks if needed

Name each task in the language/framework of the active layer as declared in
`architecture.md` — do not assume a specific stack.

### Step 3 — Generate Task Breakdown

Output two things:

**A) Summary table** — one row per task, ready to scan in sprint planning

**B) Full task cards** — one block per task with all fields ready to paste
   into Azure DevOps

Use the formats defined in `references/task-formats.md`.

### Step 4 — Generate Effort Estimate Summary

After the full task list, output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EFFORT ESTIMATE SUMMARY — ADO #[ID]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Layer          Tasks    Est. Hours
─────────────────────────────────────
Angular          [N]      [N]h
.NET             [N]      [N]h
Node.js          [N]      [N]h
Database         [N]      [N]h
QA               [N]      [N]h
Infra            [N]      [N]h
─────────────────────────────────────
TOTAL            [N]      [N]h  (~[N] days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Note: Estimates are rough order of magnitude.
Assign actual hours after dev review.
```

### Step 5 — Output ADO Story Description Block

Generate the full ADO work item description block (ready to paste into the
User Story Description field in Azure DevOps):

```
Title: As a [role], I want [capability] so that [benefit]

[Full ICEA paste block — Intent / Context / Examples / Acceptance Criteria]
```

See format in `references/task-formats.md`.

### Step 6 — Definition of Ready Checklist

End with:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF READY — ADO #[ID]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before moving this story to Active:
[ ] ICEA Status = Approved in ADO
[ ] ICEA Workshop completed
[ ] All open questions resolved or assigned
[ ] Developer has read and acknowledged the ICEA
[ ] QA has written draft test cases from Examples
[ ] API contracts (.NET / Node.js) defined or linked
[ ] Angular component tree / route identified
[ ] All tasks created and assigned in ADO
[ ] Tasks estimated (no unestimated tasks)
[ ] No undocumented scope added since Approval
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```


## Model routing

This skill is in the **generation tier** — it uses `ICEA_MODEL` (default: `claude-opus-4-6`).

To override for this project, set in `.claude/settings.json`:
```json
{ "env": { "ICEA_MODEL": "claude-opus-4-6" } }
```

See `../shared/model-routing-spec.md` for full routing documentation.

## Business context severity

This skill does not perform security or compliance reviews. If output from this
skill surfaces data that may trigger B1–B7 sensitivity (see
`../shared/business-context-severity.md`), flag it to the developer. Do not
silently process or display attorney-client privileged matter data, immigration
identifiers, or other B1–B7 categories without acknowledgement.

---

## Hard Rules

- NEVER generate tasks without an ICEA or ADO work item content — if no ICEA
  file is found, fetch from ADO using Step 1b before proceeding
- NEVER create a single generic "implement feature" task — every AC needs its own task
- ALWAYS include QA tasks — they are never optional
- ALWAYS include a test task for every implementation task
- If the ICEA has no Node.js context, do not generate Node.js tasks
- Estimates are rough ranges only — flag them as such
- ALWAYS use `--ssl-no-revoke -4` on every ADO curl call — see `references/ado-connection-guide.md`
- ALWAYS use Node.js for JSON parsing, not Python — Python may not be available on Windows
- NEVER log or display the PAT value; unset it immediately after building the auth header
- If no ICEA file exists, proceed from ADO work item but flag it with the
  `/icea-feature` prompt so the team knows to formalise before the next sprint
