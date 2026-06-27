# Skill: icea-implement

## Purpose
Generate and write implementation code for an approved ICEA.
Works in any session — reads all state from disk.

Triggered by:
- `/icea-implement ADO-1847`
- `IMPLEMENT ADO-1847`
- `IMPLEMENT ADO-1847 Story-2`

---

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

**Determine active layers from architecture docs, not assumption.**
Read `.claude/architecture/architecture.md` for the stack. If absent,
fall back to the `# Stack:` line in `CLAUDE.md`. Generate only layers
the project actually has.

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
Read skills/critic/SKILL.md and execute it with mode = code, source = internal.
```

The critic evaluates for ICEA traceability, simplicity, rules compliance,
decision transparency, and hidden assumptions. This is Category C — no
source files are read, only the in-context generated code.

Gate the disk write on the verdict:

- **PASS** or **PASS WITH NOTES** → proceed to Step 5 (Write Gate).
  Carry any notes forward into the confirmation so they are visible.
- **REVISE** → do NOT write anything. Run the bounded regenerate-and-
  re-critique loop: up to 2 automatic retries, announcing each attempt
  (`🔁 Critic revision {N} of 2`), then surface to the developer with
  `ACCEPT AS-IS` / `GUIDE` / `HALT` if still failing after 2 retries.
  Only proceed to Step 5 on PASS / PASS WITH NOTES / explicit ACCEPT AS-IS.

Nothing reaches disk while verdict is REVISE.

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
```

Write only after receiving `APPROVE ADO-{ADO_ID}`.

---

## Step 6 — Update tracker

After writing, update the tracker immediately (no gate — tracking artefact):
- AC rows: `⏳ Pending` → `✅ Done`
- Update `Last Updated` date
- If all ACs are done, write `Status: COMPLETE` to the ICEA file

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
