# Skill: icea-revise

_Skill version: 1.0 · Last changed: 2026-07-07 · Consent: C_

> **Business context severity:** revises ICEAs whose acceptance criteria carry B1–B7
> sensitivity flags — see `../shared/business-context-severity.md`.

## Purpose
Revise an existing ICEA and/or Tech Spec document in response to:
- Feedback from Tech Lead or Product team
- Resolved open questions (❓ blocks in the Tech Spec)
- New information or changed requirements
- Corrections to any section

This skill never starts from scratch — it always works from existing
documents on disk. For a new feature use /icea-feature instead.

Triggered by:
- `/icea-revise ADO-1847`
- `REVISE ADO-1847`

---

## Step 1 — Resolve ADO ID

Extract from command argument or keyword input.
Normalise: ADO-1847, ADO #1847, and 1847 all resolve the same.

If missing, ask:
```
Which ICEA would you like to revise?
  ADO #: [e.g. ADO #1847]
```

---

## Persona

Execute as **[PO] Priya Nair — Product Owner** (11 yrs B2B SaaS). Optimizes for user value + ruthless
scope discipline; always asks "what outcome does this change serve, and are we quietly expanding
scope?" Weigh [TL] Marcus Reid's feasibility concerns when a revision has technical impact.

The persona sets *what to scrutinize* — it never licenses assumption. The existing ICEA/Tech Spec and
the feedback provided are the only sources of truth; never invent a requirement or answer an open
question the developer hasn't resolved (subordinate to CLAUDE.md §3 / decision transparency). Never
name the persona in any artifact — distinct from the customer `Personas:` field, which describes the
product's end-users. See `../shared/personas-spec.md`.

---

## Step 2 — Locate existing files

```bash
find docs -name "ADO-${ADO_ID}-*.icea.md" 2>/dev/null
find docs -name "ADO-${ADO_ID}-*.techspec.md" 2>/dev/null
```

If no files found:
```
⚠ No existing ICEA found for ADO #{ADO_ID}.
  To create a new ICEA: /icea-feature ADO-{ADO_ID}
```
Stop here.

### Fix 3 — Path confirmation
After locating files, confirm the path with the developer before proceeding.
Do not assume the file is in the right location — it may have been moved:

```
📁 Found:
   ICEA     → {full path}
   TechSpec → {full path}

Is this the correct location? Reply YES to continue, or provide
the correct path if the files have been moved.
```

Proceed only after receiving YES or a corrected path.

### Fix 6 — Mid-implementation guard
Check for existing implementation files for this ADO ID:

```bash
find . -name "*.cs" -o -name "*.ts" -o -name "*.js" -o -name "*.py" \
  | xargs grep -l "ADO-${ADO_ID}\|ADO #${ADO_ID}" 2>/dev/null
```

Also read the tracker — if any ACs are `✅ Done` or `IN PROGRESS`:

```
⚠ Implementation files already exist for ADO #{ADO_ID}.
  Revising the ICEA will reset Status to DRAFT and re-gate
  code generation.

  Existing code files will NOT be deleted but may become
  inconsistent with the revised spec. Review them after
  re-approval.

  Reply CONFIRM to proceed with revision, or SKIP to cancel.
```

Proceed only after receiving CONFIRM (or if no implementation exists).

---

## Step 3 — Show current state

Display a summary of both documents:

```
📋 ICEA REVISION — ADO #{ADO_ID} · Release {R} · Sprint {S}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ICEA:     {path} — Status: {current Status line}
TechSpec: {path}
```

### Fix 2 — Open question source of truth
Read open questions from the **`## Open Questions` table** in the Tech Spec —
not by counting inline ❓ blocks, which may be out of sync if the
file was edited externally.

```
Open questions ({count} remaining):
  [{N}] {topic} — {one line summary}
  [{N}] {topic} — {one line summary}
```

---

## Step 4 — Ask what needs updating

```
What would you like to revise? You can:

  1. Answer one or more open questions
     e.g. "Q2 — use a stored procedure, not inline SQL"
  2. Update a specific ICEA section
     e.g. "update AC-F3 — the endpoint is POST not GET"
  3. Update a specific Tech Spec section
     e.g. "update the API Changes section"
  4. Incorporate new information
     describe it and I will place it in the right sections
  5. Multiple of the above — describe everything at once

Do not proceed until the developer has described the change.
Never assume what needs updating.
```

---

## Step 5 — Draft the revision

Apply the requested changes to both documents as needed. Rules:

- **Never remove existing content silently** — if a section is being
  replaced, show the old content and the new content side by side
- **Resolve ❓ blocks** by replacing the inline block with the confirmed
  answer and removing the ❓ marker. Update the `## Open Questions` table:
  remove resolved rows, keep unresolved ones
- **Cross-document consistency** — if a change to the ICEA affects the
  Tech Spec (or vice versa), update both and flag the impact explicitly
- **Never invent** class names, file paths, or technical details not
  present in the updated information or architecture docs — raise a new
  ❓ block instead
- **Append to revision log** in both documents:
  ```
  {date} — {brief description of what changed and why}
  ```
  If a revision log already exists, append — never replace

Write the revised ICEA to temp (TEMP_WRITE_EXEMPT — see below):
```bash
mkdir -p temp
# Write full revised ICEA content to:
temp/ADO-{ADO_ID}-icea.md
```

If Tech Spec is also revised, write it to temp too:
```bash
temp/ADO-{ADO_ID}-tech.md
```

Tell the developer:
```
📄 Revised draft written to temp/ADO-{ADO_ID}-icea.md
   Open in VS Code preview (Ctrl+Shift+V) to review.
   Make further changes here in chat — I will rewrite the temp file each time.
```

For subsequent changes in the same revision session: rewrite the temp file
in place after each change. Confirm in chat with one line:
`✅ Updated — {section name}. Refresh preview.`

---

## Step 6 — Write revised files

Present a diff-style summary:

```
📝 REVISION PREVIEW — ADO #{ADO_ID}

ICEA changes:
  ~ {Section}: {one line description of change}
  ~ Status: {see status-aware rule below}

TechSpec changes:
  ✓ ❓ [{N}] {topic} — resolved: {answer summary}
  ~ {Section heading}: {one line description of change}
  {count} open questions remaining

Writing now:
  ICEA     → {full path}
  TechSpec → {full path}
```

Copy from temp to permanent location and delete temp files:

```bash
cp temp/ADO-{ADO_ID}-icea.md {permanent ICEA path}
rm temp/ADO-{ADO_ID}-icea.md

# If Tech Spec was also revised:
cp temp/ADO-{ADO_ID}-tech.md {permanent TechSpec path}
rm temp/ADO-{ADO_ID}-tech.md
```

**Status-aware reset — only reset if was ✅ Approved or IN PROGRESS:**

| Current Status | Action |
|---|---|
| `DRAFT` | Apply changes, write files. Do NOT change Status line — gate is already active. |
| `DRAFT — Revising` | Apply changes, write files. Do NOT change Status line. |
| `✅ Approved` | Reset Status to `DRAFT — Revising (supersedes approval of {prior date})`. Re-gates code generation. |
| `IN PROGRESS` | Reset Status to `DRAFT — Revising (supersedes approval of {prior date})`. Warn about existing implementation files. |

The reset Status line MUST NOT contain the word `Approved` — the floor hook
checks for `✅ Approved` exactly. Any other form re-blocks the gate.

**Plan sync warning:**
If the ICEA Intent or Context was substantively changed, check whether a
plan file exists on disk:
```bash
find docs -path "*${ADO_ID}*" -name "*.plan.md" 2>/dev/null
```
If found, warn:
```
⚠ ICEA revised — plan may be out of sync.
  Path: {plan path}
  Update the plan manually to reflect the change, or run
  /icea-feature ADO-{ADO_ID} --force to re-draft from scratch.
```

**Tech Spec sync warning:**
If the ICEA was substantively changed (scope, AC, system context), check
whether a Tech Spec exists on disk. If yes, warn:

```
⚠ ICEA revised — Tech Spec may be out of sync.
  Run TECH ADO-{ADO_ID} to re-draft the Tech Spec from the updated ICEA,
  or REVISE ADO-{ADO_ID} to update specific Tech Spec sections manually.
```

---

## TEMP_WRITE_EXEMPT

This skill is permitted to write to `temp/ADO-{ID}-icea.md` and
`temp/ADO-{ID}-tech.md` without explicit user approval. These files are:
- **Rendering aids only** — not the source of truth
- **Never committed** — `temp/` is in `.gitignore` (managed by gitignore-sync)
- **Short-lived** — deleted when copied to permanent location in Step 6
- **Overwritten freely** — each iterative change in Step 5 rewrites in place

The global write gate (`## 0. WRITE GATE`) is NOT relaxed — this exemption
applies only to `temp/ADO-{ID}-*.md` files during an active icea-revise session.

---

## Step 7 — Re-gate code generation (only if status was reset)

Only display this block if the Status was reset (was ✅ Approved or IN PROGRESS):

```
⏸ CODE GENERATION RE-GATED — ADO #{ADO_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ICEA status reset to DRAFT — Revising. No implementation code
will be generated until the revised documents are reviewed and approved.

Share the updated documents with your Tech Lead and Product team:
  ICEA     → {path}
  TechSpec → {path}

When approved:
  APPROVE ADO-{ADO_ID}

To check status at any time:
  STATUS ADO-{ADO_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If the Status was already DRAFT, show a simpler confirmation:
```
✅ Revision complete — ADO #{ADO_ID}
   Files updated. Re-share with your Tech Lead if already sent.
   ICEA status remains DRAFT — no re-gate needed.
```

---

## Fix 5 — Dream auto-capture deduplication

On re-approval (when the revised ICEA is approved via APPROVE ADO-{ID}),
the icea-approve skill writes a single superseding memory entry:

```
### [auto] {date} — ADO #{ADO_ID} ICEA re-approved (supersedes prior entry)
Feature: {name}
Change: {one line summary of what was revised}
Trigger: revision re-approved
Source: auto-capture
```

This prevents duplicate or contradictory entries in MEMORY.md for the
same ADO ID.
