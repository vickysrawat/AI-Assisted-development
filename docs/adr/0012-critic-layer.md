# 0012 — Critic layer: second-pass review between generation and disk
Status: Accepted · Date: 2026-01 (retroactive, 2026-06-11)

## Problem
The ICEA gate reviewed the spec; code-review/PR gate reviewed the diff. Nothing
checked code in the moment it was produced — and by then the spec had dropped
out of context. Code-review can tell you the code is correct; it cannot easily
tell you it does exactly what the AC asked and nothing more.

## Decision
The critic runs while both the ICEA and freshly generated code are in context
simultaneously. ICEA mode: completeness, testability, B1–B7, scope, decisions
anti-strawman audit. Code mode: ICEA traceability, D-option fidelity, simplicity,
rules, hidden assumptions. Clean → files save. REVISE → regenerate up to 2×,
then surface to the developer with accept/guide/halt. A skill, not a command,
because it must fire automatically inside the generation flow. Ephemeral — no
ledger, no fingerprints; persistent tracking belongs to code-review/security.

## Revisit when
Critic retry rates in the scorecard consistently exceed 1.0 per artifact — the
cost may outweigh the catch rate, or the ICEA quality is the root cause.
