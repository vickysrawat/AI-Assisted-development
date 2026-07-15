---
name: icea-feature
description: >
  Creates a complete ICEA document (Intent, Context, Examples, Acceptance) before
  any feature code is written. Use when a developer describes a new feature, asks
  to build something, mentions a user story, or references an ADO work item.
  Triggers on: "build", "implement", "add feature", "create", "I need", "work on",
  "start on", "ADO #", "user story", or any description of new functionality.
  Blocks code generation until ICEA is explicitly approved.
---

# ICEA Feature Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: C_
## Purpose
Intercept any feature request and produce a complete ICEA document before
writing a single line of implementation code. The developer must explicitly
approve the ICEA before code generation proceeds.

## Stack Context

Stack context is read from `.claude/architecture/architecture.md` during the
Codebase Orientation step above. If that file is missing, fall back to the
project defaults below.

**Default stack (K&E project — update architecture.md to override):**
- Backend: .NET 8 / C# — Clean Architecture
- Frontend: Angular 17+ — Standalone components, OnPush
- Middleware: Node.js / Express / TypeScript
- Auth: Azure AD Bearer tokens
- Tracking: Azure DevOps (ADO) work items

## Business context severity

ICEA acceptance criteria carry B1–B7 sensitivity flags where relevant (immigration IDs,
privileged matter data, vulnerable-client data). See `$PLUGIN_DIR/skills/shared/business-context-severity.md`.

## Invocation

This skill is invoked explicitly by the developer via `/ai-assisted-development:icea-feature`
or by `session-start` pre-loading the feature gate rule into active context.

It does **not** self-trigger. Trigger classification has been moved to `session-start`
(pre-loaded each session) and documented as a team convention in `CLAUDE.md`.
This ensures the gate fires before any processing begins, not after.

See `CLAUDE.md` § Feature Gate for the output-gated constraint that prevents
implementation code from being written without an approved ICEA on disk.

Do NOT trigger for:
- Bug fixes on existing behaviour (use `/bug` instead)
- Refactoring requests with no new behaviour
- Questions, explanations, or code reviews
- Requests explicitly prefixed with `/skip-icea` (emergency override — warns once)

---


## Codebase Orientation (run before Step 1)

> Schema: `$PLUGIN_DIR/skills/shared/graph-index-schema.md` · `$PLUGIN_DIR/skills/shared/graph-module-schema.md`

Before intercepting the feature request, orient yourself to the project without
reading raw source files:

1. **Read `.claude/architecture/architecture.md`** if it exists — this gives the
   system overview, layer responsibilities, and key patterns.
2. **Use `.claude/graph/graph-index.md`** — it is auto-loaded via `paths: always`
   and already in context. Its **Module Summaries** section lists every module's
   bounded context and key files inline. Match the feature request to the closest
   module entry and use its summary directly — **no detail file read needed** for
   basic orientation. Only read the module's detail file (the `Detail File` column
   path) if you additionally need patterns or the full dependency list.
3. **Read `.claude/architecture/architecture-deployment.md`** if it exists — this gives the
   hosting model (IIS / container / App Service), auth strategy (Entra ID / JWT / API key),
   environment list, and CI/CD pipeline. Reference this when drafting ACs for API endpoints,
   auth flows, route configuration, or environment-specific behaviour. If the file is missing,
   note in the ICEA Context section: "⚠ Deployment context not captured — run `/update-arch
   --deployment` for hosting/auth details."

   Additionally, when `architecture-deployment.md` is absent, insert this visible advisory
   banner at the top of the generated ICEA document (before the Intent section):

   ```
   ┌─────────────────────────────────────────────────────────────────┐
   │ ⚠ DEPLOYMENT CONTEXT NOT CAPTURED                               │
   │ Acceptance criteria for authentication, routing, and            │
   │ environment-specific behaviour are using GENERIC LANGUAGE.      │
   │ Run /update-arch --deployment to capture the deployment         │
   │ questionnaire, then re-run this ICEA for precise ACs.           │
   │ Affected ACs are marked with ⚠ below.                          │
   └─────────────────────────────────────────────────────────────────┘
   ```

   Mark individual ACs that reference auth, environment config, hosting, or routing
   with `⚠ [deployment context missing]` inline so reviewers know which ACs are
   generic placeholders versus verified architecture decisions.
3a. **Read the domain/security/NFR docs if present** (still architecture-doc only, no source):
   - `.claude/architecture/architecture-data.md` — entities, relationships, and data ownership
     for the area the feature touches; use it to write precise data-related ACs.
   - `.claude/architecture/architecture-integrations.md` — external dependencies the feature
     may call; reference failure/timeout behavior when drafting resilience ACs.
   - `.claude/architecture/architecture-security.md` — the authorization model; when the feature
     adds or changes an action, draft an explicit authz AC (which role/policy gates it).
   - **NFR seeding:** read the `Non-Functional Requirements & Constraints` section of
     `architecture-deployment.md`; seed `AC-NF*` criteria (performance/availability/compliance)
     from the documented targets. If that section is unpopulated, mark seeded NF ACs with
     `⚠ [NFR target not captured]` and note it in Context (mirror the deployment advisory).
   - If `architecture-security.md` or `architecture-data.md` is absent, note in Context:
     "⚠ Security/data model not captured — run `/update-arch --security` / `--data`."
4. If none of the above exist, prompt the developer:
   ```
   ⚠ No architecture docs found.
   Run /setup-init to generate them — this makes ICEA significantly more accurate.
   Continuing without codebase context…
   ```
5. Do NOT scan `src/`, read controller files, or open any source file.
   This skill is Category C under `$PLUGIN_DIR/skills/shared/source-file-consent.md` —
   it operates on architecture docs and the knowledge graph only. The graph
   was built from source; use it instead of re-reading source files.

6. **Staleness check** — if `.claude/graph/.stale` exists (set by the post-merge
   git hook when tracked entry-point files change), the graph may be behind the
   working tree:
   ```
   ⚠ .claude/graph may be stale — run /graph-sync to refresh it for accurate orientation.
   Continuing with current graph…
   ```
   Then proceed — do not block execution.
7. From the graph, identify which module the request touches. Note the module's
   entry-point and key files — reference them in the ICEA's Context section
   without opening them.

## Execution Steps

### Step 1 — Intercept, Classify, and Collect Identifiers

> **Acting as:** [PO] Priya Nair — Product Owner (through Step 6). Weigh [TL] feasibility concerns.
> See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

> **Required first output — orientation declaration:**
> Before collecting identifiers or drafting anything, output this line:
> `ORIENTATION: <module> (domain: <domain>) — <bounded context from Module Summaries in graph-index.md>`
> This line must be the first output of this skill. An ICEA response that omits it is incomplete.

**Collect three identifiers.** If any are missing, ask in a single prompt:

```
Before I plan and document this feature, I need a few details:

  ADO #:       [e.g. ADO #1847]          ← the work item ID
  Release #:   [e.g. Release 3 / R3]     ← the release this ships in
  Sprint #:    [e.g. Sprint 12 / S12]    ← the sprint it is planned for
```

Do not proceed until all three are confirmed. Store as ADO_ID, RELEASE_ID,
SPRINT_ID.

**All files use one consistent path — always UserStory folder:**
```
docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/
```

The folder name never changes regardless of whether the ICEA is a STORY or
EPIC — the type is determined by the Story Breakdown section inside the ICEA,
not by the folder name.

---

### Step 1.0 — Check for existing files

```bash
STORY_DIR="docs/Release${RELEASE_ID}/Sprint${SPRINT_ID}/UserStory${ADO_ID}"
find "$STORY_DIR" -name "ADO-${ADO_ID}-*.plan.md" 2>/dev/null
find "$STORY_DIR" -name "ADO-${ADO_ID}-*.icea.md" 2>/dev/null
```

Branch on what is found:

| Files found | Action |
|---|---|
| No files | Fresh flow — proceed to Step 2 |
| `*.plan.md` only | Plan saved but no ICEA yet — skip to Step 5 (draft ICEA from plan) |
| `*.icea.md` Status: DRAFT | Load existing ICEA — enter Step 6 (ICEA edit cycle) |
| `*.icea.md` Status: DRAFT — Revising | Same as DRAFT |
| `*.icea.md` Status: ✅ Approved | Redirect to icea-revise: `REVISE ADO-{ADO_ID}` |

**`PLAN ADO-{ADO_ID}` keyword** (cross-session recovery) triggers this same
Step 1.0 check — finds `*.plan.md`, skips directly to Step 5.

`--force` overwrites existing files at the same path — the explicit
"scrap and restart" escape hatch.

---

### Step 2 — Draft Plan

Draft the feature plan and present it inline. This is Claude's reasoning
made visible — every assumption stated explicitly before the ICEA is drafted.

```
📋 FEATURE PLAN — ADO #{ADO_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Problem Statement:
  {one paragraph: problem, who has it, cost of not solving, measurable success}

Story:
  As a {persona}, I want to {action}, so that {outcome}.

Personas:
  {name}: {role} · {context} · {goal} · {frustration} · {success measure}

Feature Priority (MoSCoW):
  Must Have:   {list with rationale — each justifies why it blocks release}
  Should Have: {list}
  Could Have:  {list}
  Won't Have:  {list with deferral reason — prevents relitigating later}

Release Plan:
  MVP: {user outcome unlocked} | Deferred: {list}
  V1:  {user outcome unlocked} | Deferred: {list}

Assumptions:
  [{N}] {assumption} — verified / unverified

Risks:
  [{N}] {risk} — Probability: H/M/L | Impact: H/M/L

Pre-mortem: "This shipped and failed. What went wrong?"
  {one paragraph — required for auth, payments, irreversible data changes}

Dependencies:
  [{N}] {dependency} — Owner: {owner} | Blocking: yes/no

Open Questions:
  [{N}] {question} — Owner: {owner} | Deadline: {date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Review above. Correct anything wrong, answer open questions, or:
  SAVE PLAN ADO-{ADO_ID}
```

> **Note — two senses of "persona":** the `Personas:` field above describes the product's
> **end-users** (customer personas — who the feature is for). This is distinct from the **Expert
> Persona** the model is *acting as* to do this planning ([PO], per `$PLUGIN_DIR/skills/shared/personas-spec.md`).
> Fill the field with end-users; never put the Expert Persona there.

**⛔ STOP — plan gate. Do not continue. Do not draft the ICEA. Do not write any file.**
Wait for the developer to reply. The only valid next actions are:
- Accept corrections or answers to open questions (enter Step 3)
- Receive `SAVE PLAN ADO-{ADO_ID}` (enter Step 4)

Advancing to ICEA before `SAVE PLAN ADO-{ADO_ID}` is received is a hard
violation of the plan gate — regardless of how complete the plan appears.

---

### Step 3 — Interactive Plan review

Accept freeform corrections — no special syntax required.
Re-output only the changed section after each edit.
Update open question list as answers are given.
Never write anything to disk during this phase.

**After every response during Step 3, end with this exact line — no exceptions:**
```
Review the plan. When ready: SAVE PLAN ADO-{ADO_ID}
```

Do not advance to Step 4 or any later step proactively — even if the plan
appears complete, even if no open questions remain. Advancing is only
permitted when `SAVE PLAN ADO-{ADO_ID}` is received from the developer.
If the developer asks for code, ICEA, or Tech Spec, respond with:
```
⛔ Plan gate — save the plan first: SAVE PLAN ADO-{ADO_ID}
```

---

### Step 4 — On SAVE PLAN ADO-{ID}

**Check for open questions first:**
If any open questions remain:
```
⚠ {N} open question(s) remain in the plan.
  Reply SAVE PLAN ADO-{ADO_ID} CONFIRM to save with open questions,
  or answer them first.
```

On `SAVE PLAN ADO-{ADO_ID}` (or `SAVE PLAN ADO-{ADO_ID} CONFIRM`):

⚠ **NEVER write the plan to `temp/`** — plans are written DIRECTLY to the
permanent UserStory folder. There is no temp staging for plans. Unlike the
ICEA and Tech Spec (which stage in temp/ before final save), the plan is
saved permanently in one step.

Write plan to disk — always to the UserStory folder regardless of type:
```
docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.plan.md
```

The Story vs Epic determination happens at Step 10 (Tech Spec sizing).
The folder name never changes — the ICEA type is recorded inside the file.

Create the AI audit trail file (derived — no gate):
```
docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.ai-audit.md
```

Initial content:
```markdown
# AI Audit Trail — {Feature Name}
ADO #{ADO_ID} · Release {RELEASE_ID} · Sprint {SPRINT_ID}

| # | Date | Event | Triggered by | Summary |
|---|---|---|---|---|
| 1 | {YYYY-MM-DD} | Plan generated | SAVE PLAN | {one-line summary of plan scope} |
```

Confirm and immediately proceed to Step 5:
```
✅ Plan saved — ADO #{ADO_ID}
   Path: docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.plan.md

Drafting ICEA now...
```

---

### Step 5 — Draft ICEA to temp file

**⛔ MECHANICAL GATE — run this check before any ICEA work begins:**

```bash
STORY_DIR="docs/Release${RELEASE_ID}/Sprint${SPRINT_ID}/UserStory${ADO_ID}"
PLAN_FILE=$(find "$STORY_DIR" -name "ADO-${ADO_ID}-*.plan.md" 2>/dev/null | head -1)

if [ -z "$PLAN_FILE" ]; then
  echo "PLAN_GATE_BLOCKED: No plan file found at $STORY_DIR"
  echo "Cannot draft ICEA — plan must be saved first via SAVE PLAN ADO-${ADO_ID}"
  exit 1
fi

echo "PLAN_GATE_PASSED: $PLAN_FILE"
```

If `PLAN_GATE_BLOCKED` — stop immediately. Tell the developer:
```
⛔ Plan gate — no plan file found for ADO #{ADO_ID}.
   Draft and save the plan first:
   1. Review the plan above (or re-run /icea-feature ADO-{ADO_ID} to draft it)
   2. SAVE PLAN ADO-{ADO_ID}
```
Do not draft ICEA content in any form until the gate passes.

Only proceed past this point when `PLAN_GATE_PASSED` is confirmed.

---

Draft the full ICEA using the template in
`$PLUGIN_DIR/skills/icea-feature/references/icea-template.md`.

Populate from the plan automatically — never re-ask answered questions:

| Plan section | → ICEA section |
|---|---|
| Problem Statement | Intent: Problem Statement |
| Story | Intent: Story |
| Success Metrics | Intent: Success Metrics |
| Personas | Context: Personas |
| Won't Have | Acceptance: Out of Scope (starting point — add story-specific items) |
| Assumptions | Acceptance: Assumptions |
| Risks + Pre-mortem | Acceptance: Risks & Pre-Mortem |
| Dependencies | Acceptance: Dependencies |

Remaining gaps ([?]) should only be system-context items not answerable
from the plan — change tier, specific components, auth policy, error messages.

**⛔ CRITIC GATE — run before writing the ICEA draft to temp:**

With the ICEA draft still in context (nothing written yet), run the critic:
```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
Read $PLUGIN_DIR/skills/critic/SKILL.md and execute it with mode = icea, source = internal.
```
The critic evaluates conformance, completeness, testability, B1–B7 coverage,
scope, and (when a D block exists) decision quality — Category C, no source files
read. On a `REVISE` verdict, follow the critic's bounded auto-revise loop
(regenerate the ICEA draft in context, re-critique, max 2 retries). Only on
`PASS` / `PASS WITH NOTES` proceed to write the temp file; fold any residual
notes into the `⚠ ICEA GAPS` list below so the developer sees them. If the loop
surfaces after 2 retries, honour the developer's `ACCEPT AS-IS` / `GUIDE` / `HALT`
choice before writing.

Write the draft to the temp folder (TEMP_WRITE_EXEMPT — see below):
```bash
mkdir -p temp
# Write full ICEA draft content to:
temp/ADO-{ADO_ID}-icea.md
```

Then tell the developer:
```
📄 ICEA draft written to temp/ADO-{ADO_ID}-icea.md
   Open it in VS Code preview for a clean read (Ctrl+Shift+V).

⚠ ICEA GAPS — review in the file before saving:
  [1] Context — Auth policy: which Azure AD policy applies?
  [2] Examples — Error state: what happens if the service times out?

Answer gaps or make changes here in chat. I will update the temp file
after each change so the preview stays current.

When satisfied: SAVE ICEA ADO-{ADO_ID}
```

If no gaps:
```
📄 ICEA draft written to temp/ADO-{ADO_ID}-icea.md
   Open it in VS Code preview (Ctrl+Shift+V).
   No gaps — ICEA is complete.

When satisfied: SAVE ICEA ADO-{ADO_ID}
```

**⛔ STOP — ICEA review gate. Do not proceed to Step 7. Do not save the ICEA.**
Wait for the developer to reply. The only valid next actions are:
- Accept corrections or gap answers (enter Step 6)
- Receive `SAVE ICEA ADO-{ADO_ID}` (enter Step 7)

Advancing to SAVE ICEA automatically is a hard violation — even if no gaps remain.

---

### Step 6 — Interactive ICEA review

Accept freeform corrections in chat. After each change:
1. Apply the change to the in-memory draft
2. Rewrite `temp/ADO-{ADO_ID}-icea.md` in place (VS Code preview auto-refreshes)
3. Confirm in chat with one line: `✅ Updated — {section name}. Refresh preview.`

Update gap list as answers are given.
Resolve D-blocks before SAVE ICEA.
Never write to the permanent docs/ location during this phase.

**After every response during Step 6, end with this exact line — no exceptions:**
```
Review the ICEA in VS Code preview. When ready: SAVE ICEA ADO-{ADO_ID}
```

---

### Step 7 — On SAVE ICEA ADO-{ID}

**⛔ CRITIC GATE — run before copying temp to permanent:**

Run the critic against `temp/ADO-{ADO_ID}-icea.md` (mode = icea, source = internal):
```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
Read $PLUGIN_DIR/skills/critic/SKILL.md and execute it with mode = icea, source = internal.
```

**If critic verdict is `PASS` or `PASS WITH NOTES`:**
- Show: `✅ Critic: {verdict} — proceeding to save.`
- Save critic output to:
  ```
  docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.icea-critic-{YYYY-MM-DD}.md
  ```
  Content:
  ```markdown
  # ICEA Critic — ADO #{ADO_ID}
  Date: {YYYY-MM-DD}
  Verdict: {PASS | PASS WITH NOTES}

  {Full critic output}
  ```
- Proceed to copy temp → permanent.

**If critic verdict is `REVISE`:**
- Show the findings.
- Do NOT copy temp → permanent.
- Prompt:
  ```
  ⛔ Critic found issues — ICEA not saved.
  Address the findings above and update the temp file, then reply:
    SAVE ICEA ADO-{ADO_ID}           ← to re-run critic and save
    SAVE ICEA ADO-{ADO_ID} ACCEPT    ← to override and save anyway (not recommended)
  ```
- If developer uses `SAVE ICEA ADO-{ADO_ID} ACCEPT`: save the critic output with verdict REVISE (override noted), then proceed to copy.

Copy temp file to permanent location with `Status: DRAFT` — always to the UserStory folder:
```bash
DEST_DIR="docs/Release${RELEASE_ID}/Sprint${SPRINT_ID}/UserStory${ADO_ID}"
mkdir -p "$DEST_DIR"
cp temp/ADO-{ADO_ID}-icea.md \
   "$DEST_DIR/ADO-{ADO_ID}-{feature}.icea.md"
rm temp/ADO-{ADO_ID}-icea.md
```

Append to the AI audit trail file:
```bash
AUDIT_FILE="docs/Release${RELEASE_ID}/Sprint${SPRINT_ID}/UserStory${ADO_ID}/ADO-${ADO_ID}-{feature}.ai-audit.md"
```
Append row:
```
| {next #} | {YYYY-MM-DD} | ICEA drafted | SAVE ICEA | Critic: {PASS/PASS WITH NOTES/REVISE+ACCEPT} |
```

Confirm and immediately proceed to Step 8:
```
✅ ICEA saved — ADO #{ADO_ID}
   Path: docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.icea.md
   Critic: docs/.../ADO-{ADO_ID}-{feature}.icea-critic-{YYYY-MM-DD}.md
   Temp file cleaned up.

Drafting Tech Spec now...
```

---

### Step 8 — Draft Tech Spec to temp file

> **Acting as:** [TL] Marcus Reid — Tech Lead (Steps 7–10, Tech Spec phase). Weigh [SE]
> implementation concerns. Expertise = this project's actual stack per layer. See
> `$PLUGIN_DIR/skills/shared/personas-spec.md`.

**⛔ MECHANICAL GATE — run this check before any Tech Spec work begins:**

```bash
STORY_DIR="docs/Release${RELEASE_ID}/Sprint${SPRINT_ID}/UserStory${ADO_ID}"
ICEA_FILE=$(find "$STORY_DIR" -name "ADO-${ADO_ID}-*.icea.md" 2>/dev/null | head -1)

if [ -z "$ICEA_FILE" ]; then
  echo "ICEA_GATE_BLOCKED: No ICEA file found at $STORY_DIR"
  echo "Cannot draft Tech Spec — ICEA must be saved first via SAVE ICEA ADO-${ADO_ID}"
  exit 1
fi

echo "ICEA_GATE_PASSED: $ICEA_FILE"
```

If `ICEA_GATE_BLOCKED` — stop immediately. Tell the developer:
```
⛔ ICEA gate — no ICEA file found for ADO #{ADO_ID}.
   Save the ICEA first: SAVE ICEA ADO-{ADO_ID}
```
Do not draft Tech Spec content in any form until the gate passes.

Only proceed past this point when `ICEA_GATE_PASSED` is confirmed.

---

Draft the full Tech Spec by composing the base template with the
appropriate framework overlay.

**Template selection:**

Read the combined stack from `.claude/dream-init-state.json` (primary ∪ external):

```bash
node -e "
  const fs = require('fs');
  try {
    const s = JSON.parse(fs.readFileSync('.claude/dream-init-state.json', 'utf8'));
    const all = [...new Set([...(s.detected_stacks||[]), ...(s.external_detected_stacks||[])])];
    process.stdout.write(all.join(' '));
  } catch(e) { process.stdout.write('unknown'); }
"
```

Select overlay based on all_stacks (primary ∪ external):

| all_stacks contains | Overlay to use |
|---|---|
| `dotnet` or `dotnet_framework`, no `angular`, no `nodejs` | `techspec-aspnet-mvc-jquery.md` |
| `dotnet` or `dotnet_framework` + `angular`, no `nodejs` | `techspec-aspnet-api-angular.md` |
| `angular` + `nodejs` (with or without `dotnet`/`dotnet_framework`) | `techspec-angular-nodejs.md` |
| `java` | base only — Java overlay not yet available |
| `python` | base only — Python overlay not yet available |
| `angular` only (no `nodejs`, no `dotnet`) | base only — known gap, no SPA-only overlay |
| `unknown` or unrecognised | base only — tell developer no overlay for their stack |

`dotnet` (modern .NET Core/5+/10) and `dotnet_framework` (legacy .NET Framework 4.x:
System.Web / WCF) are mutually exclusive — a project has one, not both.

If the selected overlay file is missing at `$PLUGIN_DIR` (verify with `ls` before
reading), fall back to base template only:
`"⚠ Overlay file not found — using base template. Check .claude/dream-init-state.json."`

For `techspec-angular-nodejs.md`: if `dotnet` OR `dotnet_framework` appears in
all_stacks → populate the .NET API layer sections (mark as PRESENT). If neither
appears → omit those sections entirely.

Read `.claude/plugin-path.txt` to get PLUGIN_DIR (if absent, use §1a resolver),
then read both files:
```
$PLUGIN_DIR/skills/icea-feature/references/techspec-base.md
$PLUGIN_DIR/skills/icea-feature/references/techspec-{overlay}.md
```

The base template defines the skeleton. The overlay replaces the
framework-specific sections (Files Changed, Controller/Service/View/Node.js
implementation, API Changes, Auth & Security, Reviewer Checklist).

**Key sections to populate from the ICEA:**

| ICEA section | → Tech Spec section |
|---|---|
| Acceptance Criteria (all ACs) | AC Coverage Matrix — one row per AC |
| System Context table | Files Changed — starting point for file list |
| Examples (Happy Path, Error States) | Test Cases — positive/negative rows |
| Dependencies | Open Questions — any unconfirmed dependencies |
| Success Metrics | Definition of Done — NF AC verification methods |

**AC Coverage Matrix — mandatory, never skip:**
- List every AC from the ICEA in the AC→File table
- For each AC, identify which file(s) implement it
- For each file, list all ACs it satisfies in the File→AC table
- Any AC with no file mapping = ⚠ gap — must be resolved before SAVE TECH
- Any file with no AC mapping = ⚠ orphan — must be justified or removed

**Test Cases — derived from AC list, never skip:**
- Every functional AC (AC-F*) gets one positive unit test row and one
  negative unit test row at minimum
- Integration tests cover the deployed end-to-end flows
- NF ACs (AC-NF*) get explicit verification method stated in a note
- Use AC IDs as the reference column so icea-implement can find them

**Section 11 — Sizing and Story Breakdown:**

Total SP across all ACs using scale: 1=4h · 2=8h · 3=16h · 5=24h

If total SP ≤ 5 → **STORY**:
```
Total SP: {N}
Type: STORY — single implementation ADO, no child ADOs needed.
```

If total SP > 5 → **EPIC**:
```
Total SP: {N}
Type: EPIC — break into stories by logical completion.

Story breakdown:
| Story | Logical scope | SP | Shippable alone? | Depends on |
|---|---|---|---|---|
| 1 | {what user can do after this ships} | {SP} | Yes | None |
| 2 | {what user can do after this ships} | {SP} | Yes | Story 1 live |

Each story is a shippable slice delivering user value independently.
Stories are NEVER broken by AC — broken by logical completion only.
Create one child ADO per story in Azure DevOps.
Child ADO numbers are recorded when you run IMPLEMENT ADO-{ID} Story-{N}.
```

The Story Breakdown table in the ICEA is also updated with this information.

**⛔ CRITIC GATE — run before writing the Tech Spec draft to temp:**

With the Tech Spec draft still in context and the approved ICEA at `$ICEA_FILE`
(resolved by the mechanical gate above) on disk, run the critic:
```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
Read $PLUGIN_DIR/skills/critic/SKILL.md and execute it with mode = tech, source = internal.
```
The critic evaluates ICEA↔design traceability (every AC has a planned file; no
planned file exceeds the ACs), D-option fidelity, AC-coverage-matrix
completeness, test derivation, and structural conformance — Category C, no source
files read. On a `REVISE` verdict, follow the critic's bounded auto-revise loop
regenerating **the Tech Spec only** (the ICEA is saved and immutable here); max 2
retries. If the critic reports the concern is an **ICEA fault** (a missing AC, a
contradictory Intent), do not rewrite the Tech Spec around it — surface it and
tell the developer to run `REVISE ADO-{ADO_ID}` then re-run `TECH ADO-{ADO_ID}`.
Only on `PASS` / `PASS WITH NOTES` proceed to write the temp file; carry residual
notes into the Step 9 review.

Write the draft to the temp folder (TEMP_WRITE_EXEMPT — see below):
```bash
mkdir -p temp
# Write full Tech Spec draft content to:
temp/ADO-{ADO_ID}-tech.md
```

Then tell the developer:
```
📄 Tech Spec draft written to temp/ADO-{ADO_ID}-tech.md
   Open it in VS Code preview (Ctrl+Shift+V).

Mark uncertainty as ❓ blocks — open questions listed below:
  [1] {topic} — {one line}

Answer questions or make changes here in chat. I will update the temp
file after each change so the preview stays current.

When satisfied: SAVE TECH ADO-{ADO_ID}
```

---

### Step 9 — Interactive Tech Spec review

Accept freeform corrections in chat. After each change:
1. Apply the change to the in-memory draft
2. Rewrite `temp/ADO-{ADO_ID}-tech.md` in place (VS Code preview auto-refreshes)
3. Confirm in chat with one line: `✅ Updated — {section name}. Refresh preview.`

Update open question list as answers are given.

If a Tech Spec change implies an ICEA change:
```
⚠ This affects the ICEA — update via REVISE ADO-{ID} then re-run TECH ADO-{ID}
```

**After every response during Step 9, end with this exact line — no exceptions:**
```
Review the Tech Spec in VS Code preview. When ready: SAVE TECH ADO-{ADO_ID}
```

---

### Step 10 — On SAVE TECH ADO-{ID}

**Check for open questions first — HARD BLOCK:**
If any ❓ blocks remain in the Tech Spec:
```
⛔ {N} open question(s) remain in the Tech Spec.
   You must answer all open questions before saving.
   Tech Spec CANNOT be saved with open questions.

Answer each question in chat — I will update the temp file after each answer.
```

Do NOT proceed until all ❓ blocks are resolved. There is no CONFIRM bypass.

**⛔ CRITIC GATE — run after open-questions pass, before writing permanent files:**

Run the critic against `temp/ADO-{ADO_ID}-tech.md` and the saved ICEA file at
`$ICEA_FILE` (mode = tech, source = internal):
```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
Read $PLUGIN_DIR/skills/critic/SKILL.md and execute it with mode = tech, source = internal.
```

**If critic verdict is `PASS` or `PASS WITH NOTES`:**
- Show: `✅ Critic: {verdict} — proceeding to save.`
- Save critic output to:
  ```
  docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.icea-tech-critic-{YYYY-MM-DD}.md
  ```
  Content:
  ```markdown
  # ICEA-Tech Critic — ADO #{ADO_ID}
  Date: {YYYY-MM-DD}
  Verdict: {PASS | PASS WITH NOTES}

  {Full critic output}
  ```
- Proceed to write all permanent files.

**If critic verdict is `REVISE`:**
- Show the findings.
- Do NOT write permanent files.
- If the fault is in the **Tech Spec**: update temp and reply `SAVE TECH ADO-{ID}` to re-run.
- If the fault is in the **ICEA**: direct to `REVISE ADO-{ID}` then re-run `TECH ADO-{ID}`.
- Override: `SAVE TECH ADO-{ADO_ID} ACCEPT` to save despite findings (adds REVISE+ACCEPT to audit trail).

All files written to the same UserStory folder — always:
```
docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/
```

1. Copy Tech Spec from temp to permanent and delete temp file:
   ```bash
   DEST_DIR="docs/Release${RELEASE_ID}/Sprint${SPRINT_ID}/UserStory${ADO_ID}"
   mkdir -p "$DEST_DIR"
   cp temp/ADO-{ADO_ID}-tech.md \
      "$DEST_DIR/ADO-{ADO_ID}-{feature}.techspec.md"
   rm temp/ADO-{ADO_ID}-tech.md
   ```

2. Update Story Breakdown in ICEA with sizing result (STORY or EPIC + table).
   Update Status line to: `Status: DRAFT · {STORY / EPIC} · {N} SP`

3. Write Tracker (derived — no interaction):

   **Story tracker** (Type: STORY, total SP ≤ 5) — tracks ACs:
   ```
   # Tracker — {Feature Name}
   ADO #{ADO_ID} · Type: STORY · {N} SP

   | AC | Description | SP | Status | Notes |
   |---|---|---|---|---|
   | AC-F1 | {desc} | {SP} | ⏳ Pending | |
   ```

   **Epic tracker** (Type: EPIC, total SP > 5) — tracks stories:
   ```
   # Tracker — {Feature Name}
   ADO #{ADO_ID} · Type: EPIC · {N} SP total

   | Story | Child ADO # | Logical scope | SP | Status | Notes |
   |---|---|---|---|---|---|
   | 1 | TBD | {scope} | {SP} | ⏳ Pending | |
   | 2 | TBD | {scope} | {SP} | ⏳ Pending | |
   ```
   Child ADO numbers filled when IMPLEMENT ADO-{ADO_ID} Story-{N} is run.

4. If EPIC: write Epic doc (QA/review guide — derived, no interaction):
   `ADO-{ADO_ID}-{feature}.epic.md` (same UserStory folder)

5. Append to AI audit trail:
   ```bash
   AUDIT_FILE="docs/Release${RELEASE_ID}/Sprint${SPRINT_ID}/UserStory${ADO_ID}/ADO-${ADO_ID}-{feature}.ai-audit.md"
   ```
   Append row:
   ```
   | {next #} | {YYYY-MM-DD} | Tech Spec drafted | SAVE TECH | Critic: {PASS/PASS WITH NOTES/REVISE+ACCEPT} |
   ```

6. Clean up any remaining temp files for this ADO:
   ```bash
   rm -f temp/ADO-{ADO_ID}-icea.md temp/ADO-{ADO_ID}-tech.md
   ```

7. Confirm:
```
✅ Documents saved — ADO #{ADO_ID} · Release {RELEASE_ID} · Sprint {SPRINT_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Plan          → docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.plan.md
  ICEA          → ...ADO-{ADO_ID}-{feature}.icea.md  [Type: {STORY/EPIC} · {N} SP]
  TechSpec      → ...ADO-{ADO_ID}-{feature}.techspec.md
  ICEA Critic   → ...ADO-{ADO_ID}-{feature}.icea-critic-{YYYY-MM-DD}.md
  Tech Critic   → ...ADO-{ADO_ID}-{feature}.icea-tech-critic-{YYYY-MM-DD}.md
  Tracker       → ...ADO-{ADO_ID}-{feature}.tracker.md
  AI Audit      → ...ADO-{ADO_ID}-{feature}.ai-audit.md
  Epic doc      → ...ADO-{ADO_ID}-{feature}.epic.md  (Epic only)
  Temp files cleaned up.

{If EPIC:}
  ⚠ Create child ADOs in Azure DevOps — one per story in the Story Breakdown.
  Child ADO numbers recorded automatically when you implement each story:
    IMPLEMENT ADO-{ADO_ID} Story-1

Share with your Tech Lead and Product team for review.
  APPROVE ADO-{ADO_ID}   ← when reviewed and approved
  STATUS ADO-{ADO_ID}    ← check state at any time
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Step 11 — Handoff

icea-feature's responsibility ends here.
Never generate implementation code from this skill.
Never write Status: ✅ Approved — that is icea-approve's responsibility.

If developer asks for code:
```
Implementation is generated after approval.
  APPROVE ADO-{ADO_ID} → IMPLEMENT ADO-{ADO_ID}        (Story)
  APPROVE ADO-{ADO_ID} → IMPLEMENT ADO-{ADO_ID} Story-1 (Epic)
```

---

## Model routing

This skill is in the **generation tier** — it uses `ICEA_MODEL`
(default: `claude-opus-4-6`).

To override: set `ICEA_MODEL` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for full routing documentation.

## Persona

This skill spans two expert phases (per-step markers appear in the Execution Steps):

- **Steps 1–6 (Plan + ICEA) — Acting as [PO] Priya Nair, Product Owner** (11 yrs B2B SaaS).
  Optimizes for user value + ruthless scope discipline; always asks "what user outcome does this
  unlock, and what are we deliberately NOT doing?" Weigh [TL] feasibility concerns.
- **Steps 7–10 (Tech Spec) — Acting as [TL] Marcus Reid, Tech Lead** (14 yrs across web, service,
  and data layers). Optimizes for buildability + consistency with the existing architecture; always
  asks "what breaks at 10×, and does this fit how we already build?" Weigh [SE] implementation concerns.

Technical expertise is **this project's actual stack** (per architecture.md / detected_stacks),
across every layer present — never a fixed technology. The persona sets *what to scrutinize* — it
never licenses assumption. The codebase, architecture docs, and the developer's answers are the only
sources of truth; a persona's "experience" is never evidence (subordinate to CLAUDE.md §3 / decision
transparency). Never name the persona in any artifact — note this is distinct from the customer
`Personas:` field in the plan/ICEA, which describes the product's end-users. See
`$PLUGIN_DIR/skills/shared/personas-spec.md`.

## Hard Rules

- NEVER write any file before SAVE PLAN ADO-{ID} is received
- NEVER write the plan file to temp/ — plans go directly to docs/Release{R}/Sprint{S}/UserStory{ID}/ in one step, no temp staging
- NEVER draft ICEA before plan is saved to disk — Step 5 mechanical gate enforces this
- NEVER advance from Step 2 or Step 3 to Step 5 proactively — wait for SAVE PLAN ADO-{ID}
- NEVER save ICEA before developer sends SAVE ICEA ADO-{ID} — Step 5 STOP block enforces this
- NEVER draft Tech Spec before ICEA is saved to disk — Step 8 mechanical gate enforces this
- NEVER advance from Step 6 to Step 7 proactively — wait for SAVE ICEA ADO-{ID}
- NEVER write Tracker or Epic doc before Tech Spec is saved
- NEVER dump ICEA or Tech Spec content inline in chat — always write to temp/ and direct developer to VS Code preview
- NEVER generate implementation code — that is icea-implement's responsibility
- NEVER write Status: ✅ Approved — that is icea-approve's responsibility
- NEVER handle revision inline — redirect to REVISE ADO-{ID}
- NEVER break Epic stories by AC — break by logical completion (≤5 SP shippable slice)
- NEVER mark a field complete if it contains [?]
- NEVER re-ask questions already answered in the plan
- NEVER omit the AC Coverage Matrix — every Tech Spec must have bidirectional AC↔File traceability
- NEVER omit the Test Cases section — every AC-F* must have at least one positive and one negative unit test row
- NEVER use section numbers to reference Tech Spec content — always use heading text (e.g. `## Open Questions`, `## Sizing and Story Breakdown`, `## Test Cases`)
- ALWAYS read techspec-base.md and the stack overlay before drafting the Tech Spec
- ALWAYS select the correct overlay from detected_stacks in dream-init-state.json
- ALWAYS end every Step 3 response with: `Review the plan. When ready: SAVE PLAN ADO-{ADO_ID}`
- ALWAYS end every Step 6 response with: `Review the ICEA in VS Code preview. When ready: SAVE ICEA ADO-{ADO_ID}`
- ALWAYS end every Step 9 response with: `Review the Tech Spec in VS Code preview. When ready: SAVE TECH ADO-{ADO_ID}`
- ALWAYS run the Step 5 mechanical gate check before drafting any ICEA content
- ALWAYS run the Step 8 mechanical gate check before drafting any Tech Spec content
- ALWAYS run the Step 5 critic gate (mode = icea) before writing the ICEA draft to temp — never write temp on a REVISE verdict
- ALWAYS run the Step 8 critic gate (mode = tech) before writing the Tech Spec draft to temp — regenerate the Tech Spec only; route ICEA faults to REVISE ADO-{ID}
- ALWAYS use mkdir -p before cp when writing permanent files
- ALWAYS rewrite temp file after each iterative change so VS Code preview auto-refreshes
- ALWAYS confirm each change with one line in chat: `✅ Updated — {section}. Refresh preview.`
- ALWAYS update gap / open question list after each answer
- ALWAYS warn and require CONFIRM if open questions remain at SAVE PLAN time
- NEVER allow SAVE TECH with open ❓ blocks — open questions are a hard block (no CONFIRM bypass); developer MUST answer them first
- ALWAYS populate ICEA from plan — carry forward all answered items automatically
- ALWAYS update Story Breakdown in ICEA when Tech Spec sizing is complete
- ALWAYS clean up temp files on SAVE TECH (rm -f temp/ADO-{ID}-icea.md temp/ADO-{ID}-tech.md)
- If developer uses /skip-icea, warn once then proceed:
  "⚠ Skipping ICEA gate. This is not recommended. Proceeding without ICEA."

---

## TEMP_WRITE_EXEMPT

This skill is permitted to write to `temp/ADO-{ID}-icea.md` and
`temp/ADO-{ID}-tech.md` without explicit user approval. These files are:
- **Rendering aids only** — not the source of truth
- **Never committed** — `temp/` is in `.gitignore` (managed by gitignore-sync)
- **Short-lived** — deleted on `SAVE TECH ADO-{ID}`
- **Overwritten freely** — each iterative change rewrites the file in place

The global write gate (`## 0. WRITE GATE`) is NOT relaxed — this exemption
applies only to `temp/ADO-{ID}-*.md` files during an active icea-feature session.
