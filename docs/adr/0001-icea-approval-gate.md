# 0001 — ICEA approval gate before code generation
Status: Accepted · Date: 2025-12 (retroactive record, 2026-06-11)

## Problem
Developers used the AI inconsistently: some scaffolded clean layered code,
others dumped implementation into controllers. Rework was the dominant cost —
a blocked PR traced back to a thin or absent spec.

## Decision
No implementation code is generated until an Intent-Context-Examples-Acceptance
document exists on disk and the developer has replied with the literal word
APPROVED. The ICEA is a contract, not documentation: AC drives tests, Context
seeds the PR description, Intent maps to the ADO item.

## Rationale
One well-written spec prevents roughly three PRs that would have bounced
(estimate; see ADR 0008's measurement mandate). The gate changes behaviour by
incentive: a bad ICEA blocks your own PR.

## Revisit when
Gate-time telemetry (sprint-metrics net-value scorecard) shows median
time-in-gate exceeding the rework time it prevents, or override rates climb
above 10% per sprint.
