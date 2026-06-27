# 0003 — Shared primitives layer as single source of truth
Status: Accepted · Date: 2026-02 (retroactive record, 2026-06-11)

## Problem
Code review, security, and ICEA each had their own scan logic, assumptions, and
state. Three skills meant three copies of every bug; a fix in one never
propagated. Worst case: findings-gate logic diverged between pr-create and
checkin, producing false positives that blocked commits on fixed issues.

## Decision
A spec moves to skills/shared/ when two or more skills read/write the same
artifact. Once promoted, local copies are forbidden — callers delegate
verbatim. The validator enforces registration and delegation.

## Rationale
Define once, maintain once. Also makes new skills cheap: dynamic-scan reused
flags, model routing, consent, and severity overrides instead of reinventing.

## Revisit when
A shared spec accumulates caller-specific branches exceeding ~30% of its body —
the signal that it is two specs wearing one name.
