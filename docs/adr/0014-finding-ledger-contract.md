# 0014 — Finding-producing skill contract
Status: Accepted · Date: 2026-05 (retroactive, 2026-06-11)

## Problem
Code-review had a ledger; security and dynamic-scan produced only HTML reports.
No audit trail, no cross-run tracking, no way to know on the next scan whether
an issue was actually closed. Downstream gates (checkin, pr-create, dream-status)
could only read one of three finding sources.

## Decision
Every skill that surfaces actionable defects MUST write a persistent ledger with
FP-fingerprint IDs. Same schema, same section structure (Open, Fixed, Dismissed,
Baseline, Regressions), same /fix and /dismiss integration. Findings without a
source-level fix get manual-fix-required status. The shared specs (findings-gate,
dismissed-findings-reconciliation) operate across all ledgers uniformly.

## Revisit when
A fifth finding-producing skill (SCA) arrives — the contract should extend
cleanly; if it doesn't, the schema needs refactoring, not an exception.
