# 0033 — Single responsibility boundary between icea-feature, icea-approve, and icea-implement

**Status:** Accepted
**Date:** 2026-06-15

## Context

After introducing icea-approve and icea-implement in V2.0.0, icea-feature
still contained Step 6 which owned: writing the ICEA file, writing the Tech
Spec, generating implementation code, running the code critic, and writing
implementation files to disk. This created a design conflict — two flows
existed simultaneously in the same skill, neither fully correct:

- Flow A (V2.0.0 design): icea-feature writes files in Step 4, then
  icea-approve and icea-implement own subsequent steps
- Flow B (original design, still in Step 6): icea-feature generates
  everything in context and writes all files after a single APPROVED reply

The two flows were architecturally incompatible. Patching individual lines
was not sufficient — the root cause was that icea-feature had no single
clear boundary of responsibility.

## Decision

Each skill owns exactly one phase of the ICEA workflow:

| Skill | Responsibility | Writes |
|---|---|---|
| `icea-feature` | Draft Plan, ICEA, Tech Spec, Tracker, Epic doc. Handle interactive EDIT cycles. Hand off. | `*.plan.md` `*.icea.md` `*.techspec.md` `*.tracker.md` `*.epic.md` on SAVE ICEA / SAVE TECH |
| `icea-approve` | Read Status from disk. Present lightweight summary. Write `Status: ✅ Approved`. Output ADO description block. | Status line in `*.icea.md` |
| `icea-implement` | Read approved ICEA + Tech Spec from disk. Generate code. Run critic (Step 4a). Gate writes behind `APPROVE ADO-{ID}`. Update tracker. | Source code, config files, tracker |
| `icea-revise` | Locate files. Confirm path. Check for mid-implementation files. Apply edits. Status-aware reset. Re-write collaboration artefacts. | `*.icea.md` `*.techspec.md` |
| `icea-status` | Read all files for an ADO ID. Report state. Direct to next action. | Nothing — read only |

### Hard boundaries

- `icea-feature` NEVER generates implementation code
- `icea-feature` NEVER writes `Status: ✅ Approved`
- `icea-feature` NEVER handles revision inline — redirects to `icea-revise`
- `icea-feature` NEVER writes any file before SAVE ICEA is received
- `icea-approve` NEVER generates implementation code
- `icea-implement` NEVER writes collaboration artefacts (ICEA, Tech Spec, Tracker header)
- `icea-status` NEVER writes anything

### Step 1.0 revision redirect

When icea-feature detects an approved ICEA in Step 1.0, it redirects to
icea-revise rather than handling revision inline. This eliminates the two
conflicting revision paths that existed in V1.x (ADR 0027 inline REVISE
branch vs ADR 0030 icea-revise).

## Consequences

- Each skill is independently testable and debuggable
- Session gaps cannot cause partial-skill execution confusion
- The approval flow cannot be short-circuited by staying in icea-feature
- icea-implement contains the complete code generation spec — no cross-skill
  reading of generation rules is needed
- ADO description block output moves to icea-approve (natural home —
  it is produced at approval time, not at draft time)
