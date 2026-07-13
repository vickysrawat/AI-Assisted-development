# 0052 — Critic runs at both planning-time drafts, not only on generated code
Status: Accepted · Date: 2026-07-10
Governs: `skills/critic/SKILL.md`, `skills/icea-feature/SKILL.md`
Relates to: [[0012-critic-layer]], [[0034-draft-then-save-flow]], [[0006-change-tiers]],
[[0002-output-gated-enforcement]]

## Problem

ADR 0012 established the critic as a second-pass review between generation and disk. In
practice only one of its gates was ever wired: the CODE-mode gate inside `icea-implement`
(Step 4a), which runs *after* implementation code is generated. The critic's own SKILL.md
claimed it "fires automatically inside `icea-feature` at two gates," but `icea-feature`
contained **zero** critic invocations — a grep for "critic" returned nothing. The ICEA-draft
gate was documented but never invoked, and the dormant "Tech Spec conformance check (runs when
a Tech Spec is present)" table inside ICEA mode was unreachable.

The consequence: the earliest place an ICEA↔design divergence can be caught — when the Tech
Spec is drafted from the approved ICEA and both are in context — had no check at all. A gap
(an AC with no implementing file, a planned file beyond the ACs, a selected D-option the design
ignores) survived undetected until code generation at IMPLEMENT time, the latest and most
expensive place to discover it.

## Decision

Wire the critic into `icea-feature` at **two planning-time gates**, each firing on the
in-context draft *before* it is written to `temp/`, and make the critic a **three-mode** skill:

- **`icea` gate — Step 5**, on the ICEA draft alone (`mode = icea`).
- **`tech` gate — Step 8**, on the freshly drafted Tech Spec beside its on-disk ICEA
  (`mode = tech`, a new first-class mode).

Both gates run the **bounded auto-revise loop** previously scoped to CODE mode: on a `REVISE`
verdict the parent regenerates the draft in context and re-critiques, up to 2 automatic retries,
then surfaces to the developer (`ACCEPT AS-IS` / `GUIDE` / `HALT`). Nothing is written to `temp/`
while the verdict is `REVISE`.

The new `tech` mode owns the ICEA↔design checks — **traceability** (every AC has a planned file;
no planned file exceeds the ACs), **D-option fidelity**, and the coverage-matrix / test-derivation
/ structural-conformance checks moved out of ICEA mode. At Step 8 the ICEA is already saved and
**immutable**; the loop regenerates the Tech Spec only, and a genuine ICEA fault is surfaced with
a `REVISE ADO-{ID}` recommendation rather than being absorbed into the Tech Spec.

## Rationale

- **Catch divergence at the cheapest point.** The Tech Spec is the first artefact that maps the
  ICEA's *what* to a planned *how*, with both in context — the natural place to detect gaps before
  any code exists. Deferring to the CODE gate pays for the gap in generated code and rework.
- **The machinery already existed.** The bounded retry loop and the Tech Spec conformance table
  were both already written; this decision reaches them rather than inventing new mechanism.
- **Human stays in the loop.** The loop hardens the draft before the developer's interactive
  review (Steps 6 / 9); residual `PASS WITH NOTES` concerns fold into the gap / review list, so
  nothing is silently accepted or lost.

## Alternatives rejected

- **Reuse `icea` mode at Step 8 (no `tech` mode).** Rejected — the mode name would say "ICEA
  critique" while the revise target is the Tech Spec, and it would re-run ICEA dimensions against
  an already-saved, immutable ICEA. A dedicated `tech` mode gives an unambiguous revise target.
- **Fold Step-8 concerns into the review with no auto-revise (ICEA mode's old behaviour).**
  Rejected per the approved plan — a bounded auto-revise loop closes obvious gaps before the
  developer reads the draft, matching the CODE-gate model.
- **Leave it as documented-but-unwired and only fix the docs.** Rejected — the value is the gate,
  not the prose; the docs were fixed *and* the gate wired.

## Consequences

- Adds two `CRITIC_MODEL` passes per feature (each up to 2 regenerations). The existing
  diminishing-returns guard (surface immediately if a retry produces the same concerns) bounds the
  waste; `CRITIC_MODEL` is the review tier, not the generation tier.
- The critic REVISE loop is now defined for all three internal gates (`icea`/`tech`/`code`);
  standalone `icea` still has no loop. `change-tier-spec.md`, `source-file-consent.md`, `README.md`,
  and the `/critic` command note were corrected to describe the three gates accurately.
- Extends ADR 0012 (does not supersede it) — the critic layer is unchanged in principle; this ADR
  records *where* it fires.

## Revisit when

If planning-time critique proves redundant with the CODE gate in practice (the `tech` gate rarely
finds anything the CODE gate wouldn't), collapse back toward a single gate. Conversely, if the
2-retry ceiling too often surfaces unresolved, revisit the cap or the diminishing-returns guard.
