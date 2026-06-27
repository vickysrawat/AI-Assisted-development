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

> Schema: `../shared/domain-map-spec.md`

Before intercepting the feature request, orient yourself to the project without
reading raw source files:

1. **Read `.claude/architecture/architecture.md`** if it exists — this gives the
   system overview, layer responsibilities, and key patterns.
2. **Read `.claude/architecture/domain-map.md`** if it exists — this gives the feature area map with
   entry-point files for each domain area.
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
4. If none of the above exist, prompt the developer:
   ```
   ⚠ No architecture docs found.
   Run /dream-init to generate them — this makes ICEA significantly more accurate.
   Continuing without codebase context…
   ```
5. Do NOT scan `src/`, read controller files, or open any source file.
   This skill is Category C under `../shared/source-file-consent.md` —
   it operates on architecture docs and domain-map only. The domain-map
   was built from source; use it instead of re-reading source files.

6. **Staleness check** — after reading domain-map.md, verify it is fresh:
   ```bash
   # Get domain-map.md modification date
   stat -c '%Y' .claude/architecture/domain-map.md 2>/dev/null || echo "0"
   # Get last structural git commit date (renames, new files, deletes)
   git log -1 --diff-filter=ARD --format="%ct" -- . 2>/dev/null || echo "0"
   ```
   If domain-map.md is more than 7 days older than the last structural change, warn:
   ```
   ⚠ .claude/architecture/domain-map.md may be stale (last updated: {date}, last structural change: {date}).
   Run the architect skill to refresh it for accurate orientation.
   Continuing with current map…
   ```
   Then proceed — do not block execution.
7. From the domain-map, identify which feature area the request touches. Note the
   entry-point file and key files for that area — reference them in the ICEA's
   Context section without opening them.

## Execution Steps

### Step 1 — Intercept, Classify, and Collect Identifiers

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

Write plan to disk — always to the UserStory folder regardless of type:
```
docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.plan.md
```

The Story vs Epic determination happens at Step 10 (Tech Spec sizing).
The folder name never changes — the ICEA type is recorded inside the file.

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
`skills/icea-feature/references/icea-template.md`.

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

Copy temp file to permanent location with `Status: DRAFT` — always to the UserStory folder:
```bash
DEST_DIR="docs/Release${RELEASE_ID}/Sprint${SPRINT_ID}/UserStory${ADO_ID}"
mkdir -p "$DEST_DIR"
cp temp/ADO-{ADO_ID}-icea.md \
   "$DEST_DIR/ADO-{ADO_ID}-{feature}.icea.md"
rm temp/ADO-{ADO_ID}-icea.md
```

Confirm and immediately proceed to Step 8:
```
✅ ICEA saved — ADO #{ADO_ID}
   Path: docs/Release{RELEASE_ID}/Sprint{SPRINT_ID}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.icea.md
   Temp file cleaned up.

Drafting Tech Spec now...
```

---

### Step 8 — Draft Tech Spec to temp file

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

Read the detected stack from `.claude/dream-init-state.json`:

```bash
node -e "
  const fs = require('fs');
  try {
    const s = JSON.parse(fs.readFileSync('.claude/dream-init-state.json', 'utf8'));
    const stacks = s.detected_stacks || [];
    process.stdout.write(stacks.join(' '));
  } catch(e) { process.stdout.write('unknown'); }
"
```

Select overlay based on detected stacks:

| detected_stacks contains | Overlay to use |
|---|---|
| `dotnet` or `dotnet-framework`, NO `angular` | `techspec-aspnet-mvc-jquery.md` |
| `dotnet` or `dotnet-framework` + `angular` | `techspec-aspnet-api-angular.md` *(future)* |
| `java` | `techspec-java-spring-angular.md` *(future)* |
| `python` | `techspec-python-fastapi.md` *(future)* |
| `unknown` or unrecognised | Use base template only — tell developer no overlay available for their stack |

Read both files:
```
skills/icea-feature/references/techspec-base.md
skills/icea-feature/references/techspec-{overlay}.md
```

The base template defines the skeleton. The overlay replaces the
framework-specific sections (Files Changed, Controller/Service/View
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

**Check for open questions first:**
If any ❓ blocks remain:
```
⚠ {N} open question(s) remain in the Tech Spec.
  Reply SAVE TECH ADO-{ADO_ID} CONFIRM to save with open questions,
  or answer them first.
```

On `SAVE TECH ADO-{ADO_ID}` (or `SAVE TECH ADO-{ADO_ID} CONFIRM`):

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

5. Clean up any remaining temp files for this ADO:
   ```bash
   rm -f temp/ADO-{ADO_ID}-icea.md temp/ADO-{ADO_ID}-tech.md
   ```

6. Confirm:
```
✅ Documents saved — ADO #{ADO_ID} · Release {RELEASE_ID} · Sprint {SPRINT_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Plan     → docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.plan.md
  ICEA     → ...ADO-{ADO_ID}-{feature}.icea.md  [Type: {STORY/EPIC} · {N} SP]
  TechSpec → ...ADO-{ADO_ID}-{feature}.techspec.md
  Tracker  → ...ADO-{ADO_ID}-{feature}.tracker.md
  Epic doc → ...ADO-{ADO_ID}-{feature}.epic.md  (Epic only)
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
See `../shared/model-routing-spec.md` for full routing documentation.

## Hard Rules

- NEVER write any file before SAVE PLAN ADO-{ID} is received
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
- ALWAYS use mkdir -p before cp when writing permanent files
- ALWAYS rewrite temp file after each iterative change so VS Code preview auto-refreshes
- ALWAYS confirm each change with one line in chat: `✅ Updated — {section}. Refresh preview.`
- ALWAYS update gap / open question list after each answer
- ALWAYS warn and require CONFIRM if open questions remain at SAVE PLAN or SAVE TECH time
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
