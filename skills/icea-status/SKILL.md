# Skill: icea-status

## Purpose
Show the current state of all ICEA files for an ADO ID and tell the developer
exactly what to do next. The perfect re-entry point after a session gap.

Triggered by:
- `/icea-status ADO-1847`
- `STATUS ADO-1847`

---

## Step 1 — Resolve ADO ID

Extract from command argument or keyword input.
Normalise: ADO-1847, ADO #1847, and 1847 all resolve the same.

If missing, ask:
```
Which ADO ID would you like to check?
  ADO #: [e.g. ADO #1847]
```

---

## Step 2 — Locate all files

```bash
find docs \( \
  -path "*${ADO_ID}*" -name "*.plan.md" -o \
  -path "*${ADO_ID}*" -name "*.icea.md" -o \
  -path "*${ADO_ID}*" -name "*.techspec.md" -o \
  -path "*${ADO_ID}*" -name "*.epic.md" -o \
  -path "*${ADO_ID}*" -name "*.tracker.md" \
\) 2>/dev/null
```

If no files found:
```
⚠ No files found for ADO #{ADO_ID}.
  To create an ICEA: /icea-feature ADO-{ADO_ID}
```
Stop here.

---

## Step 3 — Read and report state

Parse each file found:
- ICEA: read `Status:` line, count open ❓ blocks
- Tech Spec: count unresolved ❓ blocks in the `## Open Questions` table
- Tracker: count ACs by status symbol, count open bugs
- Epic doc: note presence only

Display:

```
📊 STATUS — ADO #{ADO_ID} · {Feature Name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type:    {STORY / EPIC / unknown until SAVE TECH}
Release: {R} · Sprint: {S}

Files on disk:
  Plan      {path or "not yet saved"}
  ICEA      {path or "not yet saved"}
            Status: {status line}
            Type: {STORY / EPIC / unknown}
  TechSpec  {path or "not yet saved"}
            Open questions: {count}
  Tracker   {path or "not yet saved"}
            Progress: {done}/{total} ACs or stories complete
  Epic doc  {path or "not applicable"}  ← Epic only

AC Progress:
  {AC-F1}: ✅ Done
  {AC-F2}: ✅ Done
  {AC-F3}: ⏳ Pending
  {AC-F4}: ⏳ Pending

Bugs:
  Open:   {count}
  Fixed:  {count}
  {🐛 description of any open bugs}

Next action:
  → {exactly what the developer should do next}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Next action logic — derive the correct directive from file state:**

| Files on disk | Status | Next action to show |
|---|---|---|
| No files at all | — | `/icea-feature ADO-{ID}` — start fresh |
| Plan only | — | `PLAN ADO-{ID}` — draft ICEA from saved plan |
| Plan + ICEA only | DRAFT | `TECH ADO-{ID}` — draft Tech Spec from saved ICEA |
| Plan + ICEA + Tech Spec | DRAFT | `APPROVE ADO-{ID}` — when reviewed by Tech Lead + Product |
| Plan + ICEA + Tech Spec | DRAFT (open questions > 0) | `REVISE ADO-{ID}` — {N} open questions need resolution |
| All docs | ✅ Approved (STORY) | `IMPLEMENT ADO-{ID}` — ready to implement |
| All docs | ✅ Approved (EPIC) | `IMPLEMENT ADO-{ID} Story-1` — implement first story |
| All docs | IN PROGRESS (STORY) | `IMPLEMENT ADO-{ID}` — resume, tracker checked for done ACs |
| All docs | IN PROGRESS (EPIC) | `IMPLEMENT ADO-{ID} Story-{N}` — next pending story |
| All docs | COMPLETE | Nothing — all done |

For Epics, show one progress block per story:

```
Epic Stories:
  Story 1 — {title} ({SP} SP): ✅ Complete
  Story 2 — {title} ({SP} SP): IN PROGRESS ({done}/{total} ACs)
  Story 3 — {title} ({SP} SP): ⏳ Pending
```
