---
paths: skills/icea-approve
---
_Fingerprint: e5f826cbe007d23e10a8efc4a24be9225d413d0e | Updated: 2026-07-13_

## Bounded context
Approves an ICEA and Tech Spec for a given ADO ID. Sets `Status: ✅ Approved` in the ICEA file on disk. Works cross-session — reads state from disk.

## Key files
- `SKILL.md`

## Dependencies
- `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-*.icea.md` — reads and updates

## Patterns
- Triggered by keyword `APPROVE ADO-{ID}` (no slash command needed)
- After approval, icea-implement can proceed
