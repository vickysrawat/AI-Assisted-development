# Spec: Design Document Revision Protocol (Controller)

_A **controller spec** that defines the protocol for target design document authoring and revision.
It coordinates [`document-orchestrator.md`](document-orchestrator.md) (execution engine) and
[`document-feedback.md`](document-feedback.md) (feedback logic) — it does not execute work
itself. Applies to all migration-family skills (**Upgrade · Rewrite · Replatform**)._

---

## Responsibility boundary

| Piece | Responsibility |
|---|---|
| **This spec** | Protocol — what triggers each stage, what the required inputs/outputs are, how stages connect |
| [`document-orchestrator.md`](document-orchestrator.md) | Execution — wave scheduling, subagent spawning, shared state, output collection |
| [`document-feedback.md`](document-feedback.md) | Logic — dependency graph traversal, cascade, stale reference scan, convergence rules |

---

## Trigger

Invoked by the invoking skill after `APPROVE OPTIONS` (or after gap/risk analysis for Upgrade) and
before code/IaC generation. Runs until `APPROVE DESIGN` is granted or the process is explicitly
abandoned.

---

## Stage 1 — Initial authoring

**Trigger:** `APPROVE OPTIONS` received; design documents do not yet exist.

**Inputs to `document-orchestrator`:**
- Document set required for this skill (from `target-design-spec.md` per-skill binding)
- Integration Inventory (`integration-inventory.md`) — shared state for all agents
- Selected option (stack, compute, ORM, integration approaches)
- Source knowledge graph and relevant source analysis

**Output:** Draft document set; each document carries `Status: DRAFT`.

**Validation:** After authoring, invoke the four-layer validation defined in `document-feedback.md`.
A document that fails validation is repaired before being presented to the developer as a draft.

**Log entry:** `[FINDING]` per document — what the skill derived, what was uncertain, what was
assumed.

---

## Stage 2 — Developer review

**What the developer sees:**
- All drafted documents (or their delta if this is a revision cycle — see Stage 3)
- Any stale reference flags surfaced by the feedback skill
- A migration log summary of what was authored and key assumptions made

**Developer responses accepted:**
- `APPROVE DESIGN {MIGRATION_ID}` — all documents approved; proceed to Stage 4 (gate close)
- `APPROVE DESIGN {MIGRATION_ID} {document-name}` — single document approved
- Correction or addition to a specific section — feeds Stage 3
- Confirmation / update / deletion of a stale reference flag — feeds Stage 3 (deterministic apply)
- Option change declaration — classified by developer and routed to Stage 3b

---

## Stage 3b — Option change

**Trigger:** developer declares an option change during Stage 2 review.

Present the classification categories to the developer:
```
Is this a:
  [1] Bounded change — one dimension changed (compute, ORM, one integration);
      core architecture intact; safe to continue in design phase
  [2] Significant change — multiple dimensions changed; recommend returning to options
  [3] Fundamental change — stack or posture changed; must return to options
```

Route to [`option-change-spec.md`](option-change-spec.md) with:
- The developer's classification ([1] / [2] / [3])
- The description of what changed
- The current document set and archive path

`option-change-spec.md` owns all option-change handling — explanation, cascade (Scenario 1),
archive + return to APPROVE OPTIONS (Scenarios 2–3). The controller resumes from Stage 2 after
the option-change handler completes.

---

## Stage 3 — Revision cycle

**Trigger:** developer provides a correction, addition, or new information during Stage 2
(classified as a document revision, not an option change).

**Inputs to `document-feedback`:**
- The change event (what the developer stated)
- Current document set
- Iteration count for this revision cycle

**`document-feedback` returns:**
```
{
  affected_documents: [...],   // which documents need revision
  stale_flags: [...],          // stale references in untouched sections
  iteration_count: N,
  escalation_required: bool    // true when iteration_count >= 5
}
```

**Revision execution:** `document-orchestrator` runs a parallel revision wave over
`affected_documents`. Each revision agent performs:
- Pass 1: targeted re-authoring of affected sections only (from current document, not from scratch)
- Pass 2: stale reference scan on untouched sections

**Stale flag resolution — deterministic apply:**
When the developer provides a correction or deletion for a stale flag, the orchestrator applies it
as a **targeted text replacement** — no LLM, no reinterpretation. The developer's exact text is
used. This is not a revision event; it does not increment the iteration counter.

**Log entry:** `[REVISION]` — what changed, what triggered it, which documents cascaded, what stale
flags were found, what the developer did with each flag.

**Return to Stage 2** with the delta view (revised sections + resolved stale flags only).

---

## Stage 3a — Escalation (iteration limit)

**Trigger:** `iteration_count >= 5` on a single change thread.

**What the developer sees:**
- A consolidated summary of ALL changes made across all iterations in this thread:
  - What was changed per document per iteration
  - What decisions were made and reversed
  - Current state of each document
- A prompt: *"This design has gone through 5 revision cycles. To continue making changes, please
  provide your reasoning for the next change."*

**Developer response:**
- Provides argue + reasoning → the reasoning is recorded as a `[DECISION]` entry in the migration
  log before the next iteration proceeds. Iteration counter resets for the new change thread.
- Approves the current state → proceeds to Stage 4.

**Why this matters:** conflicting decisions across many iterations are a signal that the option
itself may be wrong. The escalation surfaces that signal before more code is committed.

---

## Stage 4 — Gate close

**Trigger:** all required documents for this skill have `Status: APPROVED` and no documents have
`Status: NEEDS-REVISION`.

**Action:** record `payload.{skill}.gate_verdicts.design_approved = true` in the migration ledger
via `checkpoint-ledger.cjs`. Proceed to code/IaC generation.

**Log entry:** `[DECISION]` — APPROVE DESIGN granted; list of approved documents + timestamp.

---

## New information routing

When the developer provides information during Stage 2 that was NOT in the source analysis (a newly
discovered integration, an external constraint, a compliance requirement):

1. Route through the appropriate verification spec FIRST:
   - New integration → `integration-verification-spec.md` (Tier 1 minimum; Tier 2 if source available)
   - New constraint → record in `migration-feasibility.md` as a new RED/YELLOW item
2. Once verified, add to the Integration Inventory or relevant document
3. Treat as a change event → Stage 3 revision cycle

Never allow unverified information to enter a design document directly.

---

## Hard rules

- NEVER proceed to code/IaC generation without `gate_verdicts.design_approved = true`.
- NEVER skip validation after authoring or revision — a document that looks complete but is
  truncated is worse than an obviously incomplete one.
- NEVER auto-patch developer-authored reasoning text — flag it, present it, let the developer decide.
- NEVER allow unverified new information to enter a document directly — route through the
  appropriate verification spec first.
- EVERY revision cycle writes a `[REVISION]` entry to the migration log.
- EVERY escalation requires explicit developer reasoning before proceeding — log as `[DECISION]`.
