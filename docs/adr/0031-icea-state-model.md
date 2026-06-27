# 0031 — ICEA state model: disk-based, session-independent

**Status:** Accepted
**Date:** 2026-06-15

## Context

All stateful actions in the ICEA flow (approve, revise, implement) assumed a
continuous session. If the developer closed the session and returned later —
or received approval from the Tech Lead via email or Teams — there was no way
to resume. Typing APPROVE did nothing because Claude had no context of what
was pending. The approval state lived in the conversation, not on disk.

## Decision

The ICEA `Status:` line is the single source of truth for workflow state.
All skills read state from disk at the start of every invocation. No skill
relies on conversation context for state.

### State machine

| Status line | Meaning | Set by |
|---|---|---|
| `Status: DRAFT` | Drafted, awaiting review | icea-feature (on write) |
| `Status: DRAFT — Revising` | Under revision, re-gated | icea-revise (on write) |
| `Status: ✅ Approved` | Approved, ready to implement | icea-approve (APPROVE ADO-{ID}) |
| `Status: IN PROGRESS` | Implementation underway | icea-implement (on first AC write) |
| `Status: COMPLETE` | All ACs implemented | icea-implement (on final AC write) |

The floor hook (`icea-floor.sh`) checks for `Status: ✅ Approved` — this
string is the gate signal and must be written exactly.

### BUG keyword
`BUG ADO-{ID} — {description}` logs a bug entry to the tracker immediately.
The tracker is a collaboration artefact — no APPROVE gate required.

## Consequences

- Developers can close and reopen sessions freely
- Approval received via email or Teams can be actioned with a single phrase
- All skills are resumable from any point in the workflow
- The floor hook is unchanged — it continues to check the Status line
- Session continuity is never required for any ICEA workflow action
