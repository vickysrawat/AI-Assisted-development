# Human-Executable Runbooks (AC-F7)
_Reference · skills/replatform · ADO-9000 Story 3_

The highest-consequence work in the family (moves LIVE prod data + switches live traffic). The LLM plans,
generates, rehearses (non-prod), reconciles, and produces TESTED runbooks; the production cutover is
HUMAN-executed + human-approved. The LLM assists/monitors, never pulls the trigger.

> These are NEW, target-specific artifacts — **NOT the source app's runbooks**. Authored AFTER the target
> landing zone + IaC are designed and rehearsed in non-prod; BEFORE the real cutover. The runbook is how
> the human safely completes the move.

## The four runbooks
migration · reconciliation · cutover · rollback.

## Per-step format (every step)
Each step carries the `project-rules.md` **5-point transparency** + an explicit **PASS/FAIL gate**:
1. What it does 2. What it touches 3. What it does NOT do 4. Exact commands 5. How to verify (PASS/FAIL)
The LLM authors + rehearses; the human executes; the LLM monitors the result against the gate.

## Cutover strategy = OPTIONS (developer decides)
| Strategy | Risk | Complexity | Rollback |
|---|---|---|---|
| Big-bang | high | low | restore source; loses new writes unless cut during freeze |
| Phased / incremental | medium | medium (dual-run) | reverse per-stage; needs reversible sync |
| Strangler / parallel-run | low | high (dual-write, drift) | shift traffic back; sync reversible |
Scored on downtime · volume · criticality · rollback-ability.

## Data reconciliation = "BAL for data" — OPTIONS, tiered per table
| Strategy | Catches | Best for |
|---|---|---|
| Row-count / aggregates | gross loss | first-pass, any table |
| Checksum / hash | value corruption | medium tables (value fidelity) |
| Full row-by-row | everything | small CRITICAL tables |
| Statistical sampling | probable corruption (confidence %) | huge, lower-criticality |
| Business-rule / invariant | semantic (balances sum, FK integrity, report totals) | financial/regulated |
Mandatory pre-cutover gate (`replatform-plan.cjs reconcile-gate`); regulated/PII/financial **HARD-BLOCK**.
Reconciliation depth (strategies, per-table tiering, cross-engine gotchas):
`skills/shared/migration-knowledge/refs/specs/asbuilt-reconciliation-spec.md`.
**GOTCHA:** cross-engine checksums are treacherous (collation/type/encoding/float differences make
identical data hash differently) → **normalize before hashing** OR use representation-independent
business invariants.

## Rehearsal lifecycle
Dry-run migration + cutover + **TESTED rollback** in non-prod with prod-like data (masked/synthetic for
PII), multiple times. **An untested rollback is not a rollback.** The real prod cutover is the Nth rehearsal.
