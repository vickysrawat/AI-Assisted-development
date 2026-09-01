---
name: migration
description: >
  Migrate an application from one tech stack to another. Run this command FROM INSIDE the
  new TARGET project folder. Provide the SOURCE application path when prompted.
  Supports: .NET Framework → .NET 10, Java ↔ .NET, React+Express → Angular+.NET, Node.js → .NET.
  Uses the source project's knowledge graph to derive parallel migration clusters.
  Each cluster agent works on its own branch of the TARGET repository.
  Thin orchestrator: sequences the stages, owns the checkpoint, dispatches per-stage step files.
---

# Skill: migration — orchestrator

_Skill version: 2.0 · Last changed: 2026-08-28 · Plugin compatibility: ≥3.14.0 · Consent: A_

> **Related specs:** any risk/finding severity language in feasibility or verification output uses `skills/shared/business-context-severity.md`; source-read consent per `skills/shared/source-file-consent.md`.

> ⚠ **Feature Gate bypass**: This skill generates implementation code without a prior ICEA.
> The architecture documents produced in Stage 1 serve as the governance substitute.
> The Write Gate (§0) still applies — no source code written until `APPROVE MIGRATION ADO-{ID}`.

> 📌 **Run this skill FROM the target project folder**, not the source.
> `mkdir my-new-app && cd my-new-app && /migration`

## Responsibility (SRP)

This file is the **thin orchestrator**: its single responsibility is *sequence + stage-gates +
checkpoint*. It owns Step 0 (entry/resume), the stage order, the gate keywords, and the
`.claude/migration-checkpoint.json` checkpoint (the single source of truth). Each stage's actual
procedure — persona, model tier, reference loads, and steps — lives in its own step file under
`skills/migration/steps/`. The orchestrator reads the checkpoint's `phase`/`stage_gates` and
**dispatches** the right step file; it does not inline stage procedures.

## Execution model (hybrid — this is what delivers the context benefit)

- **Interactive** steps (Stage 0 questions, every stage-gate approval) run **inline** in the
  orchestrator's context — a subagent cannot do multi-turn user Q&A.
- **Heavy, non-interactive** steps (Stage 2 feasibility; Stage 4 cluster code-gen) are **dispatched
  as subagents** so their context is discarded on return — only the compact result flows back into
  the checkpoint. Stage 4 already dispatches per-cluster agents on worktree branches; this
  generalises that proven pattern to the stage level.
- The checkpoint (JSON) is the hand-off medium: the orchestrator is the **single writer**
  (`skills/shared/single-writer-assumption.md`); dispatched agents RETURN structured results, the
  orchestrator merges them.

## Persona map

| Stage | Persona (full detail in the step file) |
|---|---|
| 0 / 0.5 / 0.6 / 1 / 2 / 3 | **[SA] Rafael Mendes — Solution Architect** |
| 4 / 5 / 6 | **[SE] Elena Fischer — Senior Software Engineer** |

See `$PLUGIN_DIR/skills/shared/personas-spec.md`. Each step file re-states its own persona.

## Model routing

- Stage 0.5 / 0–1 / 3 / 4 (options, architecture, cluster planning, code-gen): `${ICEA_MODEL:-claude-opus-4-8}`
- Stage 2 (feasibility) + Verification incl. Stage 5.0 golden-master: `${REVIEW_MODEL:-claude-sonnet-4-6}`

See `$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

## Codebase Orientation — before Stage 0

```
Read .claude/plugin-path.txt → PLUGIN_DIR
(if absent: §1a resolver from $PLUGIN_DIR/skills/shared/plugin-path-resolution.md)
```
Current directory is the TARGET — a new empty folder. No architecture docs exist here yet.
SOURCE_PATH has not been collected. Do not read any source files here.

## Step 0 — Collect identifiers, SOURCE_PATH, and route

Load and execute `$PLUGIN_DIR/skills/migration/steps/stage-0.md` (interactive, inline). It collects
ADO_ID / Release / Sprint / SOURCE_PATH, verifies the TARGET git repo, registers SOURCE_PATH as an
additionalDirectory, and — if a checkpoint already exists for this ADO — offers resume by reading its
`phase`/`stage_gates` and routing per the dispatch table below.

**Resume detection (orchestrator-owned):**
```bash
node -e '
try{const c=JSON.parse(require("fs").readFileSync(".claude/migration-checkpoint.json","utf8"));
if(c.ado_id===process.argv[1])process.stdout.write(JSON.stringify({phase:c.phase,gates:c.stage_gates,schema:c.schema_version}));}catch(e){}
' -- "{ADO_ID}" 2>/dev/null
```
If found: offer the resume keyword for `phase` (dispatch table). `schema_version` absent or `< 1.6`
(legacy) → offer only `MIGRATE RESUME ADO-{ID}` (Stage 4) or `START OVER`. For status only, use
`/migration-status ADO-{ID}` (read-only).

## Stage dispatch table

Each `MIGRATE *` keyword resumes cross-session; the orchestrator loads the step file, resolves
`{profile …}` tokens where noted, and runs it inline or as a subagent per the execution model.

| Phase / keyword | Step file | Gate keyword | Exec |
|---|---|---|---|
| `MIGRATE ADO-{ID}` (start) | `steps/stage-0.md` | — | inline |
| Stage 0.5 · `MIGRATE OPTIONS` | `steps/stage-0.5-options.md` | `APPROVE OPTIONS ADO-{ID}` | inline |
| Stage 0.6 · `MIGRATE INVENTORY` | `steps/stage-0.6-inventory.md` | `APPROVE INVENTORY ADO-{ID}` | inline (large scope → per-cluster subagents) |
| Stage 1 · `MIGRATE ARCH` | `steps/stage-1-architecture.md` | `APPROVE ARCHITECTURE ADO-{ID}` | inline |
| Stage 2 · `MIGRATE FEAS` | `steps/stage-2-feasibility.md` | `APPROVE FEASIBILITY ADO-{ID}` | **subagent** (heavy) |
| Stage 3 · `MIGRATE CLUSTERS` | `steps/stage-3-clusters.md` | `APPROVE MIGRATION ADO-{ID}` (skeleton Write Gate) | inline |
| Stage 4 · `MIGRATE RESUME [BACKEND\|FRONTEND]` · `RETRY CLUSTER {name}` | `steps/stage-4-migration.md` | — | **subagents** (per cluster, worktree) |
| Stage 5 | `steps/stage-5-tests.md` | `APPROVE MIGRATION ADO-{ID}` (characterization tests) | inline |
| Stage 6 | `steps/stage-6-verification.md` | completion gate (Step 6.4) | inline |
| any · `MIGRATE STATUS ADO-{ID}` | → `/migration-status` (read-only projection) | — | inline |

Stage gates advance the checkpoint: on each `APPROVE …`, the step file merges the checkpoint
(`stage_gates.*_approved = true`, `phase = next`) — never clobbering `decision_log`/`clusters`.

## Checkpoint — the single source of truth

`.claude/migration-checkpoint.json` (**schema 1.9**) is written at Step 0.4 and merged at each gate.
It is the resume anchor for every `MIGRATE *` keyword, the Stage 1–3 context-budget checks, and the
parallel Stage-4 subagents. It is gitignored runtime state (`skills/shared/checkpoint-schema.md`
covers the never-commit rule). Human status is a **computed projection** — `/migration-status` (or
`MIGRATE STATUS ADO-{ID}`) renders it; there is no separate markdown tracker file.

Per-cluster status is authoritative in `clusters{}`:
```json
"clusters": { "{ClusterName}": { "status": "pending|in-progress|complete|failed",
  "tier": 0, "branch": "feature/migration-cluster-…", "date": "YYYY-MM-DD", "feature_ids": [] } }
```

Full field list + the 6 checkpoint scripts live in the step files that own them (Step 0.4 seed;
Stage 1/2/3 gate merges; Step 3.2 contract-hash; Step 4.3a drift gate) — kept verbatim, unchanged.

## Reference files — always loaded (orchestrator)

```
$PLUGIN_DIR/skills/shared/plugin-path-resolution.md
$PLUGIN_DIR/skills/shared/write-gate-spec.md
$PLUGIN_DIR/skills/shared/context-budget-check.md
$PLUGIN_DIR/skills/shared/checkpoint-schema.md
$PLUGIN_DIR/skills/shared/source-file-consent.md
$PLUGIN_DIR/skills/shared/model-routing-spec.md
$PLUGIN_DIR/skills/shared/personas-spec.md
$PLUGIN_DIR/skills/shared/interactive-menu-spec.md
$PLUGIN_DIR/skills/shared/single-writer-assumption.md
$PLUGIN_DIR/skills/shared/goal-loop-spec.md
$PLUGIN_DIR/skills/shared/rubric-score-schema.md
```
Each step file loads its own stage-specific references (stacks/mappings/specs/strategies) — see the
per-step "Reference files" section. Stage-4 cluster agents load NO reference files — they execute
from `TARGET-ARCHITECTURE.md` only.

At Stage 4 the orchestrator runs the bounded goal-loop (`goal-loop-spec.md`) to score each cluster
against its completion rubric (per-cluster, Step 4.4a) and to compute an overall Stage-4 completion
percentage to show alongside the `APPROVE MIGRATION ADO-{ID}` stage-gate summary. The loop bounds
cluster auto-retries and never crosses the stage gate itself — it stops AT the gate for the human.

## Hard Rules (global — every stage step file inherits these)

NEVER write generated code to the current directory without `APPROVE MIGRATION ADO-{ID}` (Write Gate holds).
NEVER skip Stage 0.5 target-options analysis except for a pure `dotnet` version upgrade.
NEVER begin Stage 1 for a rewrite-from-spec posture without an APPROVED Stage 0.6 inventory.
NEVER present an INFERRED inventory item as a confirmed requirement; NEVER fabricate §10 "Cannot Be Derived" items.
NEVER drop or guess code you couldn't resolve statically — log it in the inventory Gaps Report (§11) with `file:line`.
NEVER skip Stage 1 architecture design — the architecture docs are the governance substitute for ICEA.
NEVER report MIGRATION COMPLETE with unexplained HIGH-risk golden-master drift; label parity INFERRED if the source can't run.
NEVER run a target's build/test/serve toolchain without loading its execution profile from `references/strategies/{target_token}.md`; missing / `STATUS: not-implemented` → STOP (no cross-stack fallback).
NEVER generate target code from a `MATURITY: ⚠ Unverified` profile without the developer's explicit go-ahead.
ALWAYS invoke plugin-shipped scripts via the resolved `$PLUGIN_DIR` — never a bare relative path (CWD is the TARGET).
ALWAYS deploy target guardrail rules to `.claude/rules/` at Step 3.3a — before Stage 4 — and have each cluster agent read them.
NEVER auto-proceed past any stage gate. NEVER offer a fallback for unsupported source stacks — STOP.
NEVER migrate + refactor + change behaviour in one step. NEVER assume when ambiguous — ask the specific question.
NEVER use EF Core if CLAUDE.md contains a "Dapper only" rule. NEVER skip Mermaid diagrams. NEVER write secrets — placeholders only.
NEVER read source files from `.` (TARGET) — always read from SOURCE_PATH.
A full-stack migration is TWO coordinated single-track runs — a `backend` run that PUBLISHES the contract, then a separate `frontend` run that CONSUMES it.
A `frontend` run calls the API only through the generated client and never edits the contract.
ALWAYS check the consumed integration-contract hash before every cluster in a `frontend` run (Step 4.3a).
ALWAYS run `/setup-init` and `/graph-sync` in the current directory at Stage 6 completion.
The checkpoint is the single source of truth — the orchestrator is its single writer; dispatched agents return results, they do not write it.
The Stage-4 goal-loop scores completeness only (never merges, never `APPROVE`s, never crosses the stage gate) and bounds cluster auto-retries at maxIterations 2 before falling back to `RETRY CLUSTER`.
