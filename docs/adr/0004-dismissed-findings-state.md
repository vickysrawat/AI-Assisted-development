# 0004 — Dismissed findings: fourth ledger state with audit trail
Status: Accepted · Date: 2026-06 

## Problem
A finding was either Open or Fixed. False positives stayed Open forever (noise)
or got fake "fixes" (lies). Re-scans re-surfaced every dismissed finding, and
reviewers couldn't distinguish "not triaged" from "deliberately accepted."

## Decision
A Dismissed state with mandatory justification, reason category
(false-positive | wont-fix | accepted-risk | by-design), who, and when.
Reconciliation keeps dismissals stable across re-scans UNLESS the code at that
location changed — then re-open with the history attached. Accepted-risk on
Critical/High surfaces in checkin and PR descriptions.

## Rationale
A dismissal is a claim about specific code; code changes invalidate the claim.
The re-open-on-change exception is what keeps dismissal honest. CI-side ledger
validation (ADR 0005) makes empty justifications mechanically impossible.

## Revisit when
Dismissal churn telemetry (dismiss → re-open → re-dismiss cycles) suggests the
verify-flag flow is generating busywork rather than catching real invalidations.
