---
paths: skills/icea-feature
---
<!-- auto-generated — edit graph.json then run /graph-sync -->
_Fingerprint: 3fe15c3d0ad9844caed828a488dafa165758e8ef | Updated: 2026-07-13_

## Bounded context
The ICEA drafting gate — drafts Intent/Context/Examples/Acceptance documents before any
feature code is written. The most upstream skill in the ICEA workflow.

## Key files
- `SKILL.md` — full instruction set; 10+ steps including critic gates at Step 5 (icea mode) and Step 8 (tech mode)

## Dependencies
- `skills/shared/write-gate-spec.md` — WRITE PENDING gate for all source/config writes
- `skills/shared/source-file-consent.md` — Category B consent before reading source files
- `skills/shared/business-context-severity.md` — B1–B7 sensitivity check
- `skills/critic/SKILL.md` — invoked at Step 5 (icea mode) and Step 8 (tech mode)
- ADO REST API — for fetching work item details

## Patterns
- Blocks implementation until ICEA receives `Status: ✅ Approved`
- Critic fires at two planning gates: ICEA draft (Step 5) and Tech Spec draft (Step 8)
- Bounded auto-revise loop (max 2 retries) at each critic gate
- Saves ICEA to `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-*.icea.md`

**Depended on by:** icea-implement (reads the saved ICEA), icea-review.
