# 0019 — Code-review hybrid: deterministic + probabilistic (Phase D/P)
Status: Accepted · Date: 2026-06-11
Governs: `skills/shared/phase-d-spec.md`

## Problem
Code-review was 100% probabilistic: the model spent tokens re-finding what
linters find deterministically, non-reproducibly, diluting the judgment work
only the model can do. A finding that "disappears" on re-run may just not have
been re-found — undermining ledger reconciliation.

## Decision
Phase D runs first: machine-available analyzers (project-local preferred,
probed per machine, never committed). Phase P receives Phase D output, scoped
to judgment: traceability, B1–B7, cross-file reasoning, intent mismatches.
The disagreement protocol: the model may annotate but NEVER suppress a
deterministic finding. Capability-aware reconciliation: findings can only
transition based on absence when the run had the producing tool. Baseline
strategy: pre-existing findings never gate, to prevent warning-flood adoption
death on legacy codebases.

## Revisit when
Phase D coverage reaches all detected stacks on all team machines AND Phase P
re-reporting drops to zero (eval confirmed) — Phase P instructions can be
simplified. If Phase D baseline burns down to <10% of initial count, consider
removing the section.
