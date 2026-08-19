# Critic Output — ICEA ADO-4000 (independent, ICEA mode)

_Run: 2026-08-13 · Mode: ICEA critique · Lens: [TL] Tech Lead · Independent subagent (not self-review)_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 🔎 CRITIC — ICEA critique — ADO #4000 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Verdict: PASS WITH NOTES

Concerns (9): [Internal consistency] Story Breakdown SP rows sum to 41, header stated ~44 — 3 SP unexplained gap. [Internal consistency] Skill count 32 (ICEA) vs 28 (source plan) — unreconciled against approved plan. [Testability] AC-F3 "creation-critical" undefined — no concrete rule anchor for QA. [Testability] AC-F8 bundles two independently-verifiable behaviours in one checkbox, no verification. [Completeness] AC-NF2 leaves the B6/B7 classification mechanism unspecified (dependency vs deliverable). [Scope] AC-F6 asserts neutral relocation as fixed, but D-2 leaves "keep .claude/*" open — AC prejudges D-block. [B1–B7 coverage] Strong overall (highlight); narrow note: eval fixtures will hold B7/secret data — assert synthetic. [Decisions] D-4 is a deferral not a real fork (no distinct options/steelman); rules-projection fork (plan §4) omitted. [Conformance] Structurally conformant to template v2.4.1. TEMPLATE-vs-CRITIC drift noted (critic SKILL.md references Business Impact / Open Questions / Constraint Context table / Given-When-Then-table not in v2.4.1) — reconcile in tooling, not a defect in this ICEA. ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Rationale
Structurally complete and conformant to v2.4.1; strongest dimension is B1–B7 privileged-data coverage (AC-NF2/NF3, Priya persona, pre-mortem) — exactly what a privileged-data governance epic needs. No scope contradiction against the approved plan and no missing safety trigger, so not REVISE. Blocking-tier issues were two AC ambiguities (AC-NF2 classification source; AC-F3 "creation-critical") that could each support two materially different implementations, plus a real numeric inconsistency (41 vs ~44 SP; 28 vs 32 skills). Localised wording/reconciliation fixes rather than structural/scope defects → PASS WITH NOTES.

## Resolution (applied to the saved ICEA, 2026-08-13)
Must-fix — all applied:
- SP reconciled ~44 → 41 (rows sum to 41; grows as Stories 2 & 6 sub-decompose).
- Skill count: added a verified Assumption (32 per `skills/` on 2026-08-13; plan's "28" was approximate).
- AC-F3: added test anchor (Dapper-only + no-hardcoded-secrets rules active at generation time on both harnesses).
- AC-NF2: classification scope clarified — B1–B7 taxonomy is an existing input; boundary-classification + egress gate (+ any classifier beyond the taxonomy) are Story-6 deliverables. **Flagged as a scope call to confirm at Tech-Spec.**

Nice-to-fix — all applied:
- AC-F8 split into AC-F8a (sync/user-edit protection) + AC-F8b (teardown scope), each with verification.
- AC-F6 softened to single-source + shared-read, explicitly contingent on D-2 (no longer prejudges location).
- D-4 reframed as two concrete options with steelman + recommendation; added D-5 (rules projection) tied to AC-F3.
- Added assumption: eval fixtures are synthetic (no real privileged/PII/secret material).

Tooling-side (not this ICEA): reconcile the critic SKILL.md ICEA-mode field list against icea-template.md v2.4.1.
