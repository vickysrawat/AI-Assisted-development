# Parallel Execution Primitive — Proposal (RFC)
_Spec version: 0.1 (PROPOSAL — not implemented; refine before adopting) · Last changed: 2026-07-30_

A reusable fan-out primitive for running independent, per-module LLM work concurrently,
built on top of the decoupling shipped in the install/setup plan (deterministic
module-derive → independent consumers writing to disjoint paths).

> Depends on the decoupling described in
> `docs/plans/2026-07-30-install-setup-ease-permissions-graph-decoupling.md` (Part 3,
> Issue 2). That plan splits `module-derive` out as a deterministic step and extracts
> `graph-create` from architect — the prerequisite for anything here.

## Premise (verified)
The graph pipeline is architect-doc-independent: module derivation happens three times
today (architect docs, architect graph Step 7, graph-sync Step 4), each from the directory
tree, never from architect prose. The install/setup plan decouples this into one
deterministic `module-derive` step consumed by architect (docs) and graph-create (graph),
which write to disjoint directories. That decoupling is the prerequisite for safe parallelism.

## The reusable asset is the decomposition, not an executor
Pattern: `deterministic shared prep → N independent consumers writing to DISJOINT paths →
single orchestrator merges + owns the manifest`. Once work has this shape, parallel
execution (via the harness Task/Agent tool) is a thin, safe layer — agents cannot conflict
because their outputs are disjoint. You cannot safely parallelise what you have not first
decoupled.

## Realistic consumer set (a family, not "everything")
Per-module FAN-OUT work is the fit:
- code-review — `docs/plans/multi-agent-code-review/` already anticipates this (second consumer)
- security scan (per-module)
- graph-create (per-module typing/edges)
- architect docs (per-module prose)

NOT a fit — cross-module REASONING that needs the whole picture at once:
- icea-feature planning, data-flow analysis, whole-repo architecture synthesis

## Hard safety contract (no file locking exists in the plugin today)
1. Deterministic, canonical shared input (sorted, fingerprinted).
2. Each parallel agent writes ONLY to a distinct, pre-assigned output path.
3. A single orchestrator owns ALL manifest/state writes and performs the final merge.
4. Sub-agents return structured results; they never write shared coordination files.
5. Failure isolation: one agent failing drops only its unit; the orchestrator records
   partial completion and supports resume (aligns with the existing manifest model).

## Open questions to refine
- How to express the fan-out contract as a shared spec skills can include (a
  `skills/shared/fan-out-spec.md`?) vs. an orchestrator command.
- Whether the harness Task/Agent tool is available in headless/cron runs, and the
  fallback when it is not.
- Concurrency cap and token-budget accounting across parallel agents.
- Merge/consolidation format for per-module results into the authoritative artifact.
- Interaction with the single-writer assumption doc — does it need amending, or is
  "disjoint paths + single merger" already compatible?

## Governing relationship
Depends on the decoupling delivered by the install/setup plan (module-derive +
graph-create). Graduates to a `skills/shared/` spec only when a first consumer
(likely graph-create or code-review) begins to use it.
