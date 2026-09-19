# Skill: icea-implement

_Skill version: 1.0 · Last changed: 2026-07-07 · Consent: B_

> **Business context severity:** implements ICEAs whose acceptance criteria carry B-series
> sensitivity flags — see `$PLUGIN_DIR/skills/shared/business-context-severity.md`.

## Purpose
Generate and write implementation code for an approved ICEA.
Works in any session — reads all state from disk.

Triggered by:
- `/icea-implement ADO-1847`
- `IMPLEMENT ADO-1847`
- `IMPLEMENT ADO-1847 Story-2`

---

## Persona

Execute as **[SE] Elena Fischer — Senior Software Engineer** (9 yrs across front-end, back-end, and
data layers). Optimizes for simple, correct, maintainable code that matches the codebase's existing
idioms per layer; always asks "what's the simplest change that's still correct at the edges, in this
layer's idioms?" Weigh [QA] Sam Okonkwo's test-coverage concerns. Expertise = this project's actual
stack per layer, never a fixed technology.

The persona sets *what to scrutinize* — it never licenses assumption. The approved ICEA, Tech Spec,
and the codebase's real patterns are the only sources of truth; a persona's "experience" is never
evidence, and ambiguity is resolved by reading the code or asking — never by guessing (subordinate to
CLAUDE.md §3 / decision transparency). Never name the persona in code or comments. See
`$PLUGIN_DIR/skills/shared/personas-spec.md`.

## Step 1 — Resolve ADO ID and Story

Extract from command argument or keyword input.
Normalise ADO ID: ADO-1847, ADO #1847, and 1847 all resolve the same.
For Epics, extract Story number if provided (e.g. Story-2).

If ADO ID missing, ask:
```
Which ICEA would you like to implement?
  ADO #: [e.g. ADO #1847]
```

For Epic stories, also ask for the child ADO number if not already in the
Story Breakdown:
```
What is the ADO # for Story {N}? (created in Azure DevOps)
e.g. ADO-1848
```

Record the child ADO number in the Story Breakdown table of the ICEA and
in the Epic tracker immediately. This is the only time the child ADO is
needed — subsequent `IMPLEMENT ADO-{ID} Story-{N}` calls use it automatically.

---

## Step 2 — Locate and validate files

```bash
find docs -name "ADO-${ADO_ID}-*.icea.md" 2>/dev/null
find docs -name "ADO-${ADO_ID}-*.techspec.md" 2>/dev/null
find docs -name "ADO-${ADO_ID}-*.tracker.md" 2>/dev/null
```

Read `Status:` line from ICEA file.

If Status is not `✅ Approved`:
```
⚠ ICEA for ADO #{ADO_ID} is not approved (Status: {current status}).
  Approve it first: APPROVE ADO-{ADO_ID}
```
Stop here.

For an Epic with a Story argument, locate the story-level ICEA:
```bash
find docs -path "*Epic${ADO_ID}*" -name "ADO-${STORY_ADO_ID}-*.icea.md"
```
Validate the story-level ICEA Status is also `✅ Approved`.

---

## Step 3 — Check tracker for progress

Read the tracker file. Determine tracker type:

**Story tracker** (Type: STORY) — rows are ACs:
- `✅ Done` — skip
- `⏳ Pending` — implement
- `🚫 Blocked` / `🐛 Bug` — flag before proceeding

**Epic tracker** (Type: EPIC) — rows are stories:
- Read the Story Breakdown from the ICEA to find the logical scope for Story {N}
- Check tracker row for Story {N}: `✅ Done` → skip, `⏳ Pending` → implement

Display:
```
📋 IMPLEMENTATION PLAN — ADO #{ADO_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type:         {STORY / EPIC}
{If EPIC:}
Story {N}:    {logical scope from Story Breakdown}
Child ADO:    ADO-{child_id}

Already done:  {list or "none"}
To implement:  {list of ACs / story scope}
Blocked:       {list or "none"}
Bugs open:     {list or "none"}
```

If there are open bugs, ask:
```
⚠ {N} open bug(s) exist for this ADO ID.
  Reply CONTINUE to implement remaining ACs anyway, or
  STATUS ADO-{ADO_ID} to review bugs first.
```

---

## Step 4 — Generate code

Generate implementation code for each pending AC in order.
Follow the Tech Spec exactly — do not deviate or invent.

**Tracker and audit — mark story as in progress:**

Locate the tracker and audit files:
```bash
TRACKER=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.tracker.md" 2>/dev/null | head -1)
AUDIT_FILE=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.ai-audit.md" 2>/dev/null | head -1)
```

Update the tracker — change the story/implementation section `**Status:** ⏳ Pending` to `**Status:** 🔄 In Progress`:
- For STORY type: find `## Implementation — ADO #{ADO_ID}` section
- For EPIC type: find `## Story {N} — ` section matching the story being implemented

Append to the audit file:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | impl-started | {Story N \| ADO #{ADO_ID}} | - | Implementing: {AC-Fx, AC-Fy, … \| full story scope} |
```

Get the ISO 8601 timestamp and actor once — reuse for all audit rows in this story:
```bash
TS=$(date '+%Y-%m-%dT%H:%M:%S')
ACTOR=$(node -e "const i=require('.claude/hooks/audit-append.cjs').resolveIdentity();console.log(i.verified_actor||i.os_user||'UNRESOLVED')" 2>/dev/null || echo "UNRESOLVED")
```

Initialise counters in context (reset at Step 4 start for this story):
`critic_revise_count = 0` · `build_issue_count = 0` · `follow_up_count = 0`

**Determine active layers from architecture docs, not assumption.**
Read `.claude/architecture/architecture.md` for the stack. If absent,
fall back to the `# Stack:` line in `CLAUDE.md`. Generate only layers
the project actually has.

**Per-project .NET generation/version (authoritative — do NOT rely on the coarse `name`).**
For a .NET target file, read `.claude/dream-init-state.json` → `generations.dotnet.versions[]`
and match the project the file belongs to (by `path`). Key generation on **that project's**
`generation` (a `dotnet-framework` project → Framework idioms; `dotnet-modern` → modern), NOT the
repo-level `name` — a mixed solution has both. Cap generated C# to the project's `tfm` LangVersion
(**net8→C# 12 · net9→C# 13 · net10→C# 14**); for a **multi-target** project use the LOWEST tfm
(lowest-common-denominator so it compiles on all targets). If the file's project is absent from
`versions[]` or its csproj mtime is newer than `generations_meta.detected_at`, re-parse that one
csproj for a fresh TFM rather than trusting the snapshot (best-effort freshness).

Generate in dependency order:

- **Persistence / data layer** — Dapper repository + parameterised SQL (.NET)
  · JPA entity/repository (Spring Boot) · ORM model + migration (Python)
  · TypeORM/Prisma (Node.js)
  **NEVER use EF Core** — always Dapper with parameterised SQL for .NET
- **Service / business layer** — backend language per stack
- **API / controller layer** — .NET controller · Spring @RestController ·
  FastAPI router / Django view / Flask blueprint · Express route
- **UI layer** (if project has a frontend) — Angular component + service,
  or the framework actually present
- **Tests for every AC** — one test per positive scenario, one per negative
  scenario (from the `## Test Cases` section of the Tech Spec — positive
  unit tests, negative unit tests, integration tests), using the stack's
  test framework (xUnit · JUnit · pytest · Jest/Vitest)
- **PR description** — pre-filled with ICEA compliance checklist

Follow the active rule files for the languages in play
(`dotnet-rules` / `angular-rules` / `nodejs-rules` / `java-rules` / `python-rules`).

**Decision transparency** — for any complex or non-trivial design choice,
document the decision inline immediately before the relevant block:

```
// DECISION: <what is being decided>
// Options considered:
//   A) <option> — rejected: <reason>
//   B) <option> — rejected: <reason>
//   C) <chosen option> — chosen: <reason>
```

Apply when: selecting an algorithm, choosing a data structure, picking a
pattern, or making any architectural call not immediately obvious from the
surrounding code. Skip for trivial or self-evident choices.

If any Tech Spec section has a `[? — verify]` marker, stop and ask:
```
❓ Tech Spec `{section heading}` has an unresolved item: {item}
   Resolve this before implementation: REVISE ADO-{ADO_ID}
```

**Generate all code in context first — do not write anything to disk yet.**
The critic gate (Step 4a) runs before any disk write.

---

## Step 4a — Auto-critic (code gate)

After generating code in context but before any disk write, run the critic:

```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
Read $PLUGIN_DIR/skills/critic/SKILL.md and execute it with mode = code, source = internal.
```

The critic evaluates for ICEA + Tech Spec traceability, simplicity, rules
compliance, decision transparency, and hidden assumptions. Give it BOTH governing
specs located in Step 2 — the approved ICEA (intent) and the approved Tech Spec
(plan) — so it can check the three-way oracle ICEA → Tech Spec → code, not intent
alone. On an ICEA↔Tech-Spec conflict the ICEA wins and the critic routes to
`REVISE ADO-{ADO_ID}` (per critic CODE-mode precedence). This is Category C — the
ICEA and Tech Spec are docs/ artefacts, not source; no source files are read, only
the in-context generated code plus those two specs.

Gate the disk write on the verdict:

- **PASS** or **PASS WITH NOTES** → proceed to Step 5 (Write Gate).
  Carry any notes forward into the confirmation so they are visible.
- **REVISE** → do NOT write anything. Run the bounded regenerate-and-
  re-critique loop: up to 2 automatic retries, announcing each attempt
  (`🔁 Critic revision {N} of 2`), then surface to the developer with
  `ACCEPT AS-IS` / `GUIDE` / `HALT` if still failing after 2 retries.
  Only proceed to Step 5 on PASS / PASS WITH NOTES / explicit ACCEPT AS-IS.

Nothing reaches disk while verdict is REVISE.

**Audit logging and tracker follow-ups — code critic gate:**

For each REVISE verdict + fix attempt: increment `critic_revise_count`, then:
1. Append audit row:
   ```
   | {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | code-critic-revise | {Story N \| ADO #{ADO_ID}} | {critic_revise_count} | {one-line finding — e.g. "Missing null guard in GetById controller"} |
   ```
2. Increment `follow_up_count`. Append a Follow-ups row to the tracker under the correct story/implementation section:
   ```
   | {follow_up_count} | {issue — one line, root cause noted} | {fix applied — one line} | {file(s) changed} |
   ```

On PASS or PASS WITH NOTES, append audit row:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | code-critic-pass | {Story N \| ADO #{ADO_ID}} | {critic_revise_count} retries | Critic: {verdict} |
```

On ACCEPT AS-IS escalation (after ceiling), append audit row:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | code-critic-accept | {Story N \| ADO #{ADO_ID}} | {critic_revise_count} retries | Escalated after {critic_revise_count} retries — unmet ACs carried to Write Gate |
```

---

## Step 4b — AC self-scoring goal-loop (completeness gate)

Step 4a asks *is the code sound?* Step 4b asks *does the code satisfy every
Acceptance Criterion this story owns **and** realize every planned change in the
approved scope?* — the completeness counterpart to the critic's quality check. "Done"
depends on both **intent** (the ICEA ACs) and the **approved scope of change** (the
Tech Spec's planned deliverables); code that passes every AC but leaves a planned
file/change unbuilt is not done. It runs on the in-context code, still before any
disk write, and it **augments** 4a; it does not replace it.

Run the bounded goal-loop engine:

```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
Read $PLUGIN_DIR/skills/shared/goal-loop-spec.md and run the engine with:
  goal       = the ICEA Goal one-liner
  rubric     = the completion criteria for this story, each VERBATIM from its
               source, as one ordered list combining intent + approved scope:
                 • Intent — every pending AC from the ICEA Acceptance section /
                   tracker (id = AC-F*/AC-NF*, type = functional | non-functional)
                 • Approved scope of change — every planned deliverable in this
                   story's scope from the Tech Spec's AC Coverage Matrix (AC→File
                   table) + Files Changed section (id = the Tech Spec file/row ref,
                   type = structural). This makes "done" require every planned
                   change to be realized, not only that the ACs pass.
  artifact   = the in-context generated code from Step 4
  regenerate = re-run Step 4 code generation addressing each `remaining`,
               then re-run Step 4a (critic) on the result
  ceilings   = { maxIterations: 3 }
```

> **Precedence (ICEA authoritative).** The ICEA is the ratified intent; the Tech Spec is
> the approved plan. A structural criterion that is genuine scope creep vs the ICEA (a
> planned change no AC justifies) is not a completion target — the Step 4a critic, sharing
> this same iteration, flags it as a traceability REVISE and routes to `REVISE ADO-{ADO_ID}`.
> The goal-loop scores completion of the plan; it never forces building scope the ICEA never
> asked for.

- The engine and the Step 4a critic share **one** iteration budget — one iteration
  is `regenerate → critic (4a) → self-score`. This keeps the ceiling meaningful and
  avoids nesting two bounded loops (goal-loop-spec §"Composing with the critic").
- The self-score is **Category C** — it reads only the in-context code and the
  rubric, never source from disk, and writes nothing (`rubric-score-schema.md`).
- **Goal met** (`percentDone == 100`, no blocking ACs) → proceed to Step 5.
- **Escalation** (ceiling or no progress) surfaces `ACCEPT AS-IS / GUIDE / HALT`
  per the engine. On `ACCEPT AS-IS`, the unmet ACs are carried into the Step 5
  WRITE PENDING prompt so partial completion is explicit at approval. On `HALT`,
  write nothing.

The loop never writes and never issues `APPROVE` — it stops AT the Write Gate.
Nothing reaches disk until Step 5.

**Audit logging — goal-loop:**

After each goal-loop iteration, append:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | goal-loop-iter | {Story N \| ADO #{ADO_ID}} | iter {N} of {max} | {percentDone}% — {unmet AC count} ACs remaining: {AC ids} |
```

On goal met (100%), append:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | goal-loop-complete | {Story N \| ADO #{ADO_ID}} | - | All ACs met — proceeding to Write Gate |
```

On escalation (ceiling or no progress), do NOT append a completion row — the ACCEPT AS-IS / HALT outcome is captured by Step 4a's escalation row and carried into the Write Gate prompt.

---

## Step 5 — Write Gate (source code only)

Present all files to be written:

```
📁 WRITE PENDING — reply APPROVE ADO-{ADO_ID} to write all files, or SKIP to discard.

  Implementation files:
  [1] {path/to/file}  — {one line description}
  [2] {path/to/file}  — {one line description}
  ...

  Test files:
  [N] {path/to/test}  — {AC reference} positive + negative cases
  ...

  {If Step 4b exited via ACCEPT AS-IS, list carried-forward unmet ACs so partial
   completion is explicit at approval:}
  ⚠ Unmet ACs at {percentDone}%: {AC-id — what remains}, …
```

Write only after receiving `APPROVE ADO-{ADO_ID}`.

**Boundary-crossing writes.** If any target file resolves to an absolute path **outside the repo
root** — e.g. a dependency repo in `additionalDirectories` that the Tech Spec's file-change table
named (multi-root graph; see `$PLUGIN_DIR/skills/shared/multi-root-scan.md`) — that file requires
its **own** confirmation and is **NOT** covered by `APPROVE ALL ADO-{ID}`. Precede such a file's
entry with `⚠ WRITE CROSSES REPO BOUNDARY — {path} is outside this repo (dependency: {dep root}).`
and stop for an explicit `APPROVE ADO-{ADO_ID}` on it, per CLAUDE.md §0 and
`$PLUGIN_DIR/skills/shared/write-gate-spec.md` § Boundary-crossing writes.

---

## Step 6 — Update tracker

After writing, update the tracker immediately (no gate — tracking artefact):
- AC rows: `⏳ Pending` → `✅ Done`
- Update `Last Updated` date
- If all ACs are done, write `Status: COMPLETE` to the ICEA file

**Populate the tracker's implementation section (no gate — tracking artefact):**

Find the correct section in the tracker:
- STORY type → `## Implementation — ADO #{ADO_ID}`
- EPIC type → `## Story {N} — {title}`

Update each sub-section in place:

**1. Status:** `🔄 In Progress` → `✅ Done`

**2. Delivered** — replace the placeholder with a bullet per module/file cluster written. One bullet per layer. Be specific — name the component/class/file and its purpose:
```
- `{layer}`: `{ClassName}` — {one-line purpose} (`{primary/file/path}`)
- `{layer}`: `{ServiceName}` — {one-line purpose} (`{primary/file/path}`)
```

**3. Tests added** — replace the placeholder with one line per spec file:
```
- `{spec-file.spec.ts}` — {N} cases: {brief scope, e.g. "AC-F1 positive/negative, AC-F2 edge cases"}
```

**4. Design decisions** — extract each `// DECISION:` block from the written code and format as:
```
- **{decision topic}:** {chosen option} — {reason in one line}. Rejected: {alternatives}.
```
If no `// DECISION:` blocks were written: _(no non-trivial design choices in this story)_

**5. Known gaps** — list any deferred items, partially-met ACs, or ACCEPT AS-IS outcomes carried from Step 4b. If the story was fully met with no deferrals:
```
_(none — all ACs fully met)_
```

**6. Generate lessons learned section:**

Read the audit trail rows for this story (from `impl-started` to `story-complete`). Group revision rows by phase and count:

| Phase | Audit events to count |
|---|---|
| Plan | `plan-revised` |
| ICEA | `icea-revised` · `icea-critic-revise` |
| Tech Spec | `tech-revised` · `tech-critic-revise` |
| Code | `code-critic-revise` |
| Build | `build-issue` |

**Rule:** Only generate a lesson for a phase with ≥ 2 events OR ≥ 2 follow-up rows. A single event is noise.

For qualifying phases, read the Summary column of each revision row to extract what changed, group by theme, and generate a specific actionable "next time" item.

Append to the tracker story/implementation section:

```markdown
### Lessons learned

**Revision summary**
| Phase | Count | Dominant themes (from audit summaries) |
|---|---|---|
| {phase} | {N} | {theme × count · theme × count} |

**Root cause analysis**
{2–3 sentences synthesising what drove the revisions and follow-ups. Be specific —
name the gap (e.g. "Azure AD policy not identified before ICEA") not the category
(e.g. "auth issues"). Cross-reference Follow-ups table root causes.}

**What to do differently next time**
- [ ] {specific actionable item — e.g. "Ask for Azure AD policy name before drafting ICEA for any story touching auth"}
- [ ] {specific actionable item}
```

If all phases had ≤ 1 event and ≤ 1 follow-up:
```markdown
### Lessons learned
_(Clean delivery — no recurring patterns identified in this story)_
```

**Audit logging — story complete:**
```bash
AUDIT_FILE=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.ai-audit.md" 2>/dev/null | head -1)
```
Append:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | story-complete | {Story N \| ADO #{ADO_ID}} | {critic_revise_count} critic retries · {follow_up_count} follow-ups | ACs written: {AC-F1, AC-F2, …} |
```

Confirm:
```
✅ Implementation written — ADO #{ADO_ID}
   {list of ACs marked ✅ Done}

   Tracker updated: {tracker path}

   If bugs are found during testing, log them:
   BUG ADO-{ADO_ID} — {description}

   {If Epic and more stories remain:}
   Next story: IMPLEMENT ADO-{ADO_ID} Story-{N+1}

   {If all ACs done:}
   All ACs complete. ICEA marked COMPLETE.
```

Then run the pre-commit gate below (Step 7) before handing off.

---

## Step 7 — Post-write gate: stage written files, then checkin (advisory)

Run the pre-commit gate on the just-written code while context is fresh. This composes the
`checkin` skill — do not reimplement its checks.

1. **Stage the written set first (critical).** The files just written include NEW files,
   which are untracked and therefore invisible to checkin's `git diff` scope. Stage exactly
   the set from Step 5 (the Write-Gate file list) so every new + modified file is scanned:
   ```bash
   git add {file 1} {file 2} … {test files}   # the exact Write-Gate set — never `git add -A`
   ```
2. **Invoke checkin:**
   ```
   Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
   Read $PLUGIN_DIR/skills/checkin/SKILL.md and execute it in full against the staged set.
   ```
3. **Advisory only — NEVER auto-commit.** checkin only *suggests* a commit command;
   icea-implement must not run it (Write-Gate philosophy — the developer commits):
   - checkin ✅ / ⚠ → surface its verdict + the suggested commit command, then stop.
   - checkin ❌ FAIL → do NOT hard-block (there is no commit to block yet). Enter a
     generate→gate→fix loop: fix the flagged findings (re-enter Step 4 → 4a → 5 Write Gate
     for the fix), re-stage, re-run checkin. Report each pass.

Complementary to the pre-write gates: 4a (critic) checks intent-alignment and 4b
(goal-loop) checks AC completeness — both PRE-write; checkin checks defects / secrets /
findings POST-write. Keep all three.

**Audit logging and tracker follow-ups — build gate:**

```bash
AUDIT_FILE=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.ai-audit.md" 2>/dev/null | head -1)
TRACKER=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.tracker.md" 2>/dev/null | head -1)
```

On checkin ✅ or ⚠ (first pass or after all fixes):
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | build | checkin-pass | {Story N \| ADO #{ADO_ID}} | {build_issue_count} fixes applied | checkin: {verdict} |
```

For each checkin ❌ FAIL + fix cycle:
1. Increment `build_issue_count`. Append audit row:
   ```
   | {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | build | build-issue | {Story N \| ADO #{ADO_ID}} | {build_issue_count} | {finding category}: {one-line description} |
   ```
2. After fix is written and re-staged, increment `follow_up_count`. Append Follow-ups row to the tracker under the correct story/implementation section:
   ```
   | {follow_up_count} | {issue description — root cause in one line} | {fix applied — one line} | {file(s) changed} |
   ```
3. After re-checkin passes, append audit row:
   ```
   | {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | build | build-fixed | {Story N \| ADO #{ADO_ID}} | {build_issue_count} | Fix verified — checkin passed |
   ```

---

## Hard Rules

- ALWAYS update the tracker story/implementation section Status to `🔄 In Progress` at Step 4 start — before any code generation
- ALWAYS append the `impl-started` audit row at Step 4 start
- ALWAYS append `code-critic-revise` audit rows and tracker Follow-ups for every critic REVISE+fix cycle in Step 4a
- ALWAYS append `goal-loop-iter` audit rows for every goal-loop iteration in Step 4b
- ALWAYS populate tracker Delivered, Tests added, Design decisions, and Known gaps sections at Step 6 — never leave them as placeholders after implementation
- ALWAYS update the tracker story/implementation section Status to `✅ Done` at Step 6
- ALWAYS append the `story-complete` audit row at Step 6
- ALWAYS append `build-issue`, Follow-ups tracker row, and `build-fixed` audit rows for each checkin ❌ FAIL + fix cycle in Step 7
- ALWAYS append `checkin-pass` audit row when checkin ✅ / ⚠ in Step 7
- NEVER leave Follow-ups table empty after a REVISE cycle or build failure — every rework leaves a row
- NEVER populate Delivered or Tests sections before the Write Gate — only write them after APPROVE and the code is on disk
