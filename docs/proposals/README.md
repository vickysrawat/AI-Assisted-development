# Proposals (Roadmap RFCs)

Forward-looking design documents that are **not yet implemented**. These are
kept out of `skills/shared/` (which holds only *live* primitives that skills
actively include) and out of `plugin.json` `components.shared`, so the manifest
lists shipping components only. A proposal graduates to a shared spec when a
skill or command begins to consume it.

| Proposal | Status | Governing ADR | Summary |
|---|---|---|---|
| [async-checkpoint-queue.md](async-checkpoint-queue.md) | v0.9 — proposal, not implemented | [ADR 0024](../adr/0024-async-checkpoint-queue.md) | Evolves the plugin's human approval gates from synchronous interrupts into asynchronous checkpoints (a queue of reviewable, provisionally-executed artifacts) while preserving named-decider accountability. |
| [parallel-execution-primitive.md](parallel-execution-primitive.md) | v0.1 — proposal, not implemented | — | Reusable fan-out primitive for concurrent per-module LLM work, built on the module-derive decoupling; deterministic prep → disjoint-output consumers → orchestrator merge. |
