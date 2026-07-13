# Change Tier Classification — Shared Spec
_Spec version: 1.1 · Last changed: 2026-07-10 · Governed by: skills/shared/_

Classifies a proposed change into a tier that determines how much ICEA ceremony
applies. **The system classifies, never the developer.** The classification is
mechanical, derived from the diff or the predicted scope, and is always recorded
in the audit trail. There is nothing for a developer to request and therefore
nothing to game.

**Callers:** `icea-feature`, `bug`, `checkin`, `pr-create`

---

## The tiers

| Tier | Name | Gate applied |
|---|---|---|
| T1 | Micro | Auto-ICEA: one-line spec generated, approval implied unless the critic objects. Critic still runs on output. |
| T2 | Standard | Full ICEA draft, explicit APPROVED required. Critic runs on the ICEA draft (icea-feature Step 5), the Tech Spec draft (Step 8), and the generated code (icea-implement Step 4a). |
| T3 | Elevated | Full ICEA + mandatory Examples for permission boundaries + pr-spec-review recommended before merge. |

## Classification rules

Evaluate in order; first match wins. Where the change is prospective (no diff yet),
classify from the predicted scope in the request and re-classify once the diff exists —
**re-classification can only move the tier up, never down.**

```
T3 if ANY of:
  - touches authentication, authorization, or session-handling files
    (paths matching the auth module in the knowledge graph)
  - adds or modifies a public API endpoint
  - adds a new external dependency (package manifest changes)
  - touches data-handling code flagged B1–B7 in business-context-severity.md
  - modifies database schema or migrations

T1 if ALL of:
  - ≤ 1 file changed (excluding tests for that file)
  - ≤ 20 lines changed (added + removed)
  - no public signature changes (method/endpoint/component interface)
  - no new dependencies
  - not matched by any T3 rule

T2 otherwise.
```

## Audit trail

Every classification is recorded in the ICEA file header:

```
Tier: T1 (auto-classified: 1 file, 14 lines, no signature change)
```

For T1, the one-line spec and the classification rationale together form the
audit record. A T1 change whose final diff violates the T1 bounds (e.g. the
"small" change grew to 4 files) is re-classified at `checkin` time — the commit
is blocked with a clear message and the developer is routed to a full ICEA.

## Hard rules

- NEVER allow a developer to request a tier — classification is mechanical only
- NEVER move a tier down on re-classification, only up
- ALWAYS record the tier and its rationale in the ICEA header
- ALWAYS re-verify T1 bounds at checkin against the actual diff
- The critic ALWAYS runs regardless of tier — T1 removes the approval interrupt,
  not the quality gate
