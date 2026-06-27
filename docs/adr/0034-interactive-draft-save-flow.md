# 0034 — Interactive draft-then-save flow for ICEA and Tech Spec

**Status:** Accepted
**Date:** 2026-06-15

## Context

In earlier versions, icea-feature wrote ICEA and Tech Spec to disk immediately
after drafting. This meant files were written with open [?] gaps and ❓ blocks,
creating stale files every time the developer answered a gap or made an edit.
The developer had no natural moment to review and refine before files existed
on disk. EDIT requests after writing required re-writes and re-shares.

Additionally, Claude's reasoning (what it understood, what assumptions it made,
what it was uncertain about) was invisible to the developer — they saw only the
output, not the thinking behind it.

## Decision

### Plan first
Before drafting the ICEA, Claude presents a feature plan inline — its reasoning
made visible. The developer can correct wrong assumptions and fill in unknowns
before the ICEA is drafted from those confirmed facts.

### SAVE ICEA ADO-{ID}
- Developer reviews ICEA inline, answers gaps, makes edits conversationally
- When satisfied, SAVE ICEA ADO-{ID} writes Plan + ICEA to disk (Status: DRAFT)
- Tech Spec is immediately drafted inline from the saved ICEA

### SAVE TECH ADO-{ID}
- Developer reviews Tech Spec inline, answers ❓ blocks, makes edits
- If open questions remain, warn and require CONFIRM before writing
- SAVE TECH ADO-{ID} writes Tech Spec, Tracker, and Epic doc (if Epic)
- Share prompt shown — documents ready to share with Tech Lead and Product

### ICEA ADO-{ID}
- Cross-session recovery — generates ICEA from saved plan on disk
- Used when session closed after SAVE ICEA was received but before ICEA
  was generated (edge case)

### TECH ADO-{ID}
- Cross-session recovery — drafts Tech Spec from saved ICEA on disk
- Used when session closed between SAVE ICEA and SAVE TECH

### Sequencing constraint
- Tech Spec is never drafted before ICEA is saved
- Tracker and Epic doc are never written before Tech Spec is saved
- Each document is written once, clean, with gaps resolved to developer's satisfaction
- Nothing is written to disk before SAVE ICEA is received

### icea-revise status-aware reset
icea-revise only resets Status to `DRAFT — Revising` if the current Status
was `✅ Approved` or `IN PROGRESS`. If already `DRAFT` or `DRAFT — Revising`,
changes are applied and files re-written without a status change — no
unnecessary re-gate triggered.

### Tech Spec sync warning
When icea-revise changes the ICEA substantively, it warns that the Tech Spec
may be out of sync and directs the developer to `TECH ADO-{ID}` or
`REVISE ADO-{ID}`.

## Consequences

- Files are written once, clean — no stale intermediate versions
- Developer has full control over document content before sharing
- Open questions are resolved or explicitly acknowledged before saving
- Claude's reasoning is visible and correctable — ICEA quality improves
- Cross-session recovery is clean — TECH/ICEA ADO-{ID} resumes from saved files
- icea-revise is simpler — status reset only when actually needed
- No EDIT-after-write confusion — editing is always pre-write and in-conversation
