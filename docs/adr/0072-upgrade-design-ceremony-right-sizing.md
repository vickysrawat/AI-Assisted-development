# 0072 — Upgrade design ceremony right-sizing: decision log vs Rewrite ceremony
Status: Accepted · Date: 2026-10-06
Governs: `skills/upgrade/SKILL.md`
Relates to: [[0071-upgrade-intake-skill-generated-three-pass]], [[0061-migration-skill-family-split]], [[0028-write-gate]]

## Problem

The upgrade skill's Step 4.5 required the skill to author "non-empty delta documents" using
`target-design-spec.md`, run a feedback loop via `design-revision-spec.md`, and derive a
graph via `graph-derive-documents.cjs`. Only after this ceremony was `APPROVE DESIGN` shown.

These artefacts and the iteration loop were borrowed from the Rewrite skill, where they
serve a clear purpose: a Rewrite creates a new target architecture from scratch. The design
documents capture what the LLM is building, and the feedback loop ensures the design is
coherent before any code is generated.

For an upgrade, the architecture does not change. The in-place deterministic tool applies
the version bump — it does not redesign the application. The gap and risk report (Step 3)
already captures what will change and why. There is no target architecture to design because
the target is the same architecture at a higher version.

The ceremony added session length (authoring design documents for an architecture that
already exists) without adding decision support. It also added a script dependency
(`graph-derive-documents.cjs`) that is only meaningful when generating a new graph, not
when upgrading an existing one.

The `APPROVE DESIGN` gate itself is genuinely valuable: one explicit developer confirmation
before the skill touches git and creates the baseline tag. The gate stays. What the developer
is approving changes.

## Decision

**Replace the full design ceremony with a lightweight `ADO-{ID}-upgrade-decisions.md`.**

The decision log is generated from the gap/risk report produced in Step 3. It contains one
entry per RED or BLOCKER item that requires a migration pattern choice before execution.

Example entry:
```
## Package: EntityFrameworkCore
Status: MIGRATION REQUIRED
Breaking change: SaveChanges no longer accepts null entities (EF Core 9)
Options considered:
  A) Audit all SaveChanges call sites and add null checks — chosen
  B) Wrap in try/catch — rejected: hides bugs
Developer decision: Option A
```

If no RED/BLOCKER items are present, the log states: "No architectural decisions required —
all items are routine fixes." `APPROVE DESIGN` is still shown but the review is expected
to be fast.

**What APPROVE DESIGN now confirms:**
- Every RED/BLOCKER item has a documented decision.
- The developer has chosen the migration approach for each non-obvious fix.
- Nothing requires routing to Rewrite (the infeasibility escape hatch stays).

**Removed from Step 4.5:**
- `target-design-spec.md` (Rewrite artefact — not applicable to in-place upgrade)
- `design-revision-spec.md` (Rewrite feedback loop — not applicable)
- `graph-derive-documents.cjs` call (graph derivation for new targets — not applicable)

## Rationale

- **Upgrade vs Rewrite have different design contracts.** A Rewrite creates. An upgrade
  preserves. Applying Rewrite design ceremony to an upgrade asks the LLM to describe an
  architecture it did not change, producing documents that are accurate but valueless.
- **The APPROVE DESIGN gate is about commitment, not documentation volume.** The gate
  exists so the developer explicitly confirms before git operations begin. The quantity of
  documents behind the gate is irrelevant to that commitment — a single decision log with
  clear entries per RED/BLOCKER item is a better trigger for that confirmation than three
  Rewrite-style documents that describe the existing architecture.
- **Infeasibility path is unchanged.** If Step 4.5 reveals that a RED/BLOCKER item has no
  viable upgrade path (e.g., a third-party package with no replacement and no alternative),
  the skill routes to Rewrite. This escape hatch is independent of the design ceremony and
  is preserved.

## Alternatives rejected

- **Keep the design ceremony but make it optional (skip if no RED items).**
  Rejected — the ceremony is not conditionally useful. When there are RED items, a decision
  log is more focused than full design documents. When there are no RED items, neither is
  needed. There is no scenario where the Rewrite ceremony adds value in an upgrade context.
- **Remove Step 4.5 entirely (no document, straight to APPROVE DESIGN).**
  Rejected — APPROVE DESIGN must gate on something concrete. The decision log provides the
  artifact the developer reviews before confirming. Showing APPROVE DESIGN with no preceding
  document removes the gate's purpose.
- **Generate decisions inline in the gap/risk report (one document).**
  Rejected — the gap/risk report is an analysis artifact. The decision log is an action
  artifact. Mixing them produces a document that is neither a clean analysis nor a clean
  action plan. Keeping them separate preserves the role of each: APPROVE REPORT reviews
  findings; APPROVE DESIGN confirms choices.

## Consequences

- Step 4.5 is significantly shorter. For codebases with no RED/BLOCKER items, the step
  generates a one-line decision log and immediately shows APPROVE DESIGN.
- `graph-derive-documents.cjs` is no longer called in the upgrade skill. If this script has
  no other callers, it can be removed from the required scripts preflight.
- `target-design-spec.md` and `design-revision-spec.md` remain in the plugin for the Rewrite
  skill. They are not deleted — they are simply no longer referenced by the upgrade skill.
- The upgrade runbook (`ADO-{ID}-upgrade-runbook.md`) records developer actions, not design
  decisions. Decision rationale lives in `upgrade-decisions.md`. These are distinct artefacts
  with distinct audiences.

## Revisit when

- If complex upgrades (e.g., multi-hop with multiple BLOCKER items requiring coordinated
  design choices) reveal that the decision log is insufficient to capture the design rationale,
  consider adding a lightweight architecture impact section — but only for cases where
  RED/BLOCKER items interact in non-obvious ways.
