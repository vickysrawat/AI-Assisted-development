# 0011 — Trust calibration loop: declared plans, measured accuracy, earned autonomy
Status: Accepted · Date: 2026-06-11
Governs: `skills/shared/change-manifest-spec.md`, `skills/shared/icea-decisions-spec.md`

## Problem
"Trusted outputs" was aspirational — no mechanism existed to BUILD trust.
Implementation decisions (placement, schema, dependencies) were made
implicitly mid-generation with no artifact; the tech lead approving an ICEA
underwrote an approach they had never seen; and any future automation would
have rested on vibes rather than evidence.

## Decision
Three coupled mechanisms. (1) ICEA-D: fork-triggered decisions block with
steelmanned options, repo-evidence recommendations, selection-shaped approval
(OPTION A/B/EDIT/DIRECT — selecting IS the judgment), role-based approvals,
and amendment-only deviation. (2) Change manifest: complete file-level
prediction generated with the ICEA, displayed for transparency, measured
mechanically at checkin (precision AND recall — over-prediction is its own
error), never gating in instrumentation mode. (3) The loop: deviations become
[MANIFEST-DEVIATION] memory events that train future predictions; accuracy
trends per category in the scorecard become the evidence basis for graduated
autonomy — per-category, human-flipped, auto-reverting, floor-invariant,
T3 never.

## Rationale
Anti-strawman mechanics are load-bearing: an LLM asked for "three options and
a recommendation" reliably produces one real option and two decorations;
steelman-or-delete plus repo-evidence requirements plus critic audit prevent
manufactured rigor. Goodhart designed out: vague rows score as misses, padding
drops precision. File-level accuracy measures PREDICTABILITY, never
correctness — the critic remains the substance guard. What graduates is the
synchronous interrupt only; artifacts and the mechanical floor are constants.

## Revisit when
Three sprints of accuracy data exist: if decision-stage time rises without
REVISE-rate/rework falling on forked work, tighten the fork trigger; if
category accuracy plateaus below threshold, the manifest format (not the
codebase) is the likely fault.
