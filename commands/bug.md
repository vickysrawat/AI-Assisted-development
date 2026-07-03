---
description: Lightweight bug fix flow — produces a trimmed Root Cause / Fix / Regression Test spec and generates the fix after one approval. Bypasses the full ICEA gate for confirmed bugs. Use for defects on existing behaviour that do not require new design.
argument-hint: ADO-<id> "<one-line description>"  e.g.  ADO-2341 "Filter crashes when user has no roles"
---

# /bug — Lightweight bug fix flow

A streamlined alternative to the full ICEA gate for confirmed bugs.
One approval cycle, one spec page, then the fix.

**Use this for:** defects, null references, broken behaviour, UI glitches, API errors.
**Do NOT use this for:** new features, new endpoints, schema changes, or anything that
requires design decisions. Use `icea-feature` for those.

---

## Step 1 — Parse arguments

Extract from invocation:
- ADO item ID — pattern `ADO-[0-9]+` or bare `[0-9]+`
- Description — the quoted string after the ID

If either is missing, ask:
```
Provide the ADO bug ID and a one-line description:
  /bug ADO-2341 "Filter crashes when user has no roles"
```

---

## Step 2 — Gather context (read-only, no source scanning)

```bash
git symbolic-ref --short HEAD
git log -1 --format="%s" HEAD
cat .claude/graph/graph-index.md 2>/dev/null
cat .claude/architecture/architecture.md 2>/dev/null | head -40
```

From the graph index, identify which module the bug description mentions, then read
that module's `.claude/graph/<module>.md` detail file. Note the entry-point file for
that module — do not open it yet.

---

## Step 3 — Ask for the failing behaviour (if not already described)

If the description in Step 1 is fewer than 8 words and doesn't include a reproduction
scenario, ask exactly one question:

```
Describe what happens vs what should happen, and the steps to reproduce
(or paste the error/stack trace if you have it):
```

Accept a paste. Do not ask follow-up questions.

---

## Step 4 — Draft the Bug Spec

Generate a concise spec. Maximum one screen (30 lines). Every field is required.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐛 BUG SPEC — ADO #{ID} — {Title}
Status: DRAFT — Awaiting Approval
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Symptom:
  {Exactly what the user sees / what error is thrown}

Expected behaviour:
  {What should happen instead}

Root cause hypothesis:
  {Most likely cause based on description and knowledge-graph context.
   State it as a hypothesis — not a certainty — if the source hasn't been read.
   Reference the entry-point file from the module detail file if relevant.}

Files likely involved:
  {List 1–3 files from the module's graph detail or architecture docs. Do not open them yet.}

Fix approach:
  {Concise description of the change needed — null guard, missing condition,
   wrong variable, etc. One to three sentences.}

Regression test:
  {One specific test case: given / when / then.
   Name the test file and method if the pattern is already established.}

Out of scope:
  {Anything this fix deliberately does NOT change}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 APPROVAL REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reply:
  ✅ APPROVED    — spec is correct, apply the fix
  ✏  EDIT [field] — e.g. "EDIT Root cause — it's in the service not the controller"
  ❌ REJECT      — something is fundamentally wrong with the approach

No code will be written until you reply APPROVED.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 5 — Handle edits

If `EDIT [field]`:
- Apply the edit to that field only
- Re-output only the changed field + the approval block
- Continue until APPROVED

If `REJECT [reason]`:
- Ask: "What should change about the diagnosis?"
- Rebuild the spec from scratch

---

## Step 6 — Apply the fix

Once APPROVED, apply the source file consent gate from
`skills/shared/source-file-consent.md` (Category B — post-approval):

For **each** file listed under "Files likely involved", present the gate before reading:

```
📂 Source file access request

  File    : {path/to/file}
  Why     : Listed in the approved Bug Spec as likely involved in {fix area}.
            Need to locate {specific method/logic} to apply the fix.
  Looking for: {the specific null guard / condition / pattern named in Fix Approach}
  Token cost: ~{estimate}

Read this file? (yes / no)
```

Only read files the developer confirms. If a file is declined, note that the
fix for that area could not be verified and apply only the confirmed portions.

1. Open only the confirmed files — nothing else
2. Make the minimal change needed. Decision transparency applies:
   ```
   // DECISION: <what is being decided>
   // Options: A) <x> — rejected: <reason>  B) <chosen> — chosen: <reason>
   ```
   Use this only when there are genuinely multiple viable approaches.
3. Write or update the regression test in the file named in the spec
4. Save the spec to `docs/icea/ADO-{ID}-bug.md`
5. Confirm:

```
✅ Fix applied — ADO #{ID}
   Files changed : {list}
   Regression test: {test name}
   Spec saved    : docs/icea/ADO-{ID}-bug.md

Next: run /checkin to verify the fix passes all checks before committing.
```

---

## Hard Rules

- NEVER open source files before APPROVED
- NEVER generate fix code before APPROVED
- NEVER use this for work that requires a new API endpoint, new DB column, or new component
  — redirect to icea-feature for those
- NEVER skip the regression test step — a bug fix without a test is incomplete
- The spec must fit on one screen — if it needs more, the bug requires a full ICEA
- NEVER treat a request as a bug fix if it introduces new user-facing behaviour, a new
  code path that did not exist before, or a new design decision. When in doubt, redirect
  to icea-feature. The output-gate rule in CLAUDE.md applies: if the generated code
  would constitute a new feature rather than a correction of existing behaviour, stop
  and require an ICEA. This is the structural guard against using /bug to bypass the
  ICEA gate.
