# 0021 — Behavioural eval suite
Status: Accepted · Date: 2026-06-10

## Problem
The validator proves the plugin is assembled correctly but cannot prove it
behaves correctly. Three production failures (ICEA trigger race, findings-gate
divergence, code-review dismiss gap) were behavioural regressions in hard
rules — invisible to structural checks.

## Decision
YAML-driven scenarios exercised via the Anthropic API directly (no Claude Code
session needed). Assert structure, not prose: contains/not_contains on
invariant markers. Non-determinism designed for: a flake on a hard rule means
the rule needs structural reinforcement, not the test. Three variance runs
before release. Scenarios cover gate enforcement, trigger precision, ledger
state transitions, and the Phase D disagreement protocol.

## Revisit when
Scenario count exceeds 100 — needs parallelized runner. Or when model-version
changes cause >10% flake rate — bulk-update assertions or tighten the prompts.
