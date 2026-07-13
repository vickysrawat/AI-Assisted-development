# Skill: icea-approve

_Skill version: 1.0 · Last changed: 2026-07-07 · Consent: C_

> **Business context severity:** approves ICEAs whose acceptance criteria carry B1–B7
> sensitivity flags — see `../shared/business-context-severity.md`.

## Purpose
Approve an ICEA and Tech Spec by ADO ID. Works in any session, including
after a session gap. State is read entirely from disk — no conversation
context required.

Triggered by:
- `/icea-approve ADO-1847`
- `APPROVE ADO-1847`
- `APPROVE ADO-1847 Story-2`

---

## Persona
Acts with a **[TL] Tech Lead** lens — confirm the ICEA/Tech Spec are genuinely ready before
approving; always asks "is this actually complete and sound?" Lens only; never assume, never
attribute in output. See `../shared/personas-spec.md`.

---

## Step 1 — Resolve ADO ID

Extract ADO ID from the command argument or keyword input.
Normalise: ADO-1847, ADO #1847, and 1847 all resolve to the same ID.

If missing, ask:
```
Which ICEA would you like to approve?
  ADO #: [e.g. ADO #1847]
```

---

## Step 2 — Locate files on disk

```bash
find docs -name "ADO-${ADO_ID}-*.icea.md" 2>/dev/null
find docs -name "ADO-${ADO_ID}-*.techspec.md" 2>/dev/null
```

If no files found:
```
⚠ No ICEA found for ADO #{ADO_ID}.
  To create one: /icea-feature ADO-{ADO_ID}
```
Stop here.

Extract RELEASE_ID, SPRINT_ID, EPIC vs STORY structure, and feature
slug from the path.

---

## Step 3 — Check current status

Read the `Status:` line from the ICEA file.

| Status found | Action |
|---|---|
| `Status: DRAFT` | Proceed to Step 4 |
| `Status: DRAFT — Revising` | Proceed to Step 4 |
| `Status: ✅ Approved` | Inform developer, ask if they want to implement |
| `Status: IN PROGRESS` | Inform developer, direct to `IMPLEMENT ADO-{ID}` |
| `Status: COMPLETE` | Inform developer this ICEA is complete, no action needed |

---

## Step 4 — Present lightweight summary for approval

The files already exist on disk and have been reviewed by the Tech Lead
and Product team. Do NOT re-display full ICEA content — show only what
is needed to confirm the right document is being approved:

```
📋 ICEA APPROVAL — ADO #{ADO_ID} · Release {R} · Sprint {S}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ICEA:     {path} — Status: {current Status line}
TechSpec: {path}

Intent:   {one line summary from ICEA Intent section}
Type:     {STORY / EPIC}
Total SP: {total from `## Sizing and Story Breakdown` section of Tech Spec}
Open questions remaining: {count — 0 if none}
  ❓ [{N}] {topic}  ← list only if count > 0

Reply APPROVE ADO-{ADO_ID} to approve.
If open questions remain, consider REVISE ADO-{ADO_ID} first.
```

---

## Step 5 — Write approval to disk

On receiving `APPROVE ADO-{ADO_ID}`:

1. Write `Status: ✅ Approved` to the ICEA file
2. Append revision log entry:
   ```
   {date} — Approved
   ```
3. Write immediately — no gate (ICEA is a collaboration artefact)
4. Output the ADO work item description block (ready to paste into ADO):
   See format in `skills/icea-feature/references/ado-description-template.md`
5. Confirm:

```
✅ ICEA Approved — ADO #{ADO_ID}
   Status written to: {icea path}

ADO description block above is ready to paste into your work item.

To start implementation:
  IMPLEMENT ADO-{ADO_ID}

For an Epic, implement story by story:
  IMPLEMENT ADO-{ADO_ID} Story-1

To check status at any time:
  STATUS ADO-{ADO_ID}
```

Do NOT generate any implementation code here. Implementation is a separate skill.
