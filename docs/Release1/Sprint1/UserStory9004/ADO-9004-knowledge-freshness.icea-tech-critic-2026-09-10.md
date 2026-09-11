# ICEA-Tech Critic — ADO #9004
Date: 2026-09-10
Verdict: PASS WITH NOTES

Mode: tech · Source: internal · Lens: [TL] Tech Lead

Scope: epic-level spec + Story 1 (Detector) + Story 2 (Refresh).

Epic spec — PASS. All epic-level sections present (Overview, Story Breakdown, Auth & Security,
Overall Request Flow, Rollback, Handover, Definition of Done — Epic, Reviewer Checklist, Open
Questions, Revision Log). Scope boundaries stated.

Story 1 (Detector) — PASS WITH NOTES.
Story 2 (Refresh) — PASS WITH NOTES.

Checked (all clear):
- [Traceability] Every AC maps to ≥1 file (AC→File); every file maps to ≥1 AC (File→AC). No gaps,
  no orphans. Story 2's `azure-pipelines.yml` row is an explicit Could-have, flagged not-an-AC.
- [Coverage] Both matrices state an explicit "all N covered" result.
- [D-fidelity] No open D-blocks in the ICEA (decisions pre-resolved during planning) — N/A.
- [Structural] AC Coverage Matrix · Test Cases (positive/negative/integration) · Open Questions
  table · Sizing and Story Breakdown · Definition of Done — all present in both story specs.

Notes (non-blocking, by design):
- [Test derivation] Story 1 AC-F6 (skill+command registration) and Story 2 AC-F7/F8/F10 (WebSearch
  + LLM inline judge + Write Gate) are covered by INTEGRATION rows rather than positive/negative
  unit rows — they are not pure functions. The deterministic parts (classifyRef, restamp,
  classifySource) ARE unit-tested. The specs state this split explicitly rather than fabricating
  unit tests for LLM/gate behaviour.

Design additions surfaced to the developer and accepted:
- Deterministic `restamp` op added to knowledge-freshness.cjs so Story 2's manifest mutation is
  unit-testable (ref-content write remains skill + Write Gate).
- Exit-code contracts pinned: check 0/9/1; restamp 0/10/1 (chosen to avoid colliding with
  upgrade-knowledge-cache.cjs's 6/7/8).
