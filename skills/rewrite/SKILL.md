---
name: rewrite
description: >
  Out-of-place, generative code translation — source app → a NEW target-folder application in a
  different stack. The LLM is a generative AUTHOR (unlike Upgrade's orchestrator role). Resolves the
  migration posture from stack distance (port only for same-language+same-framework; any change forces
  re-architecture), presents target OPTIONS across assurance × effort × TCO (or accepts a BYO design
  held to the same scrutiny), decomposes the work in TARGET space along a dependency DAG, and generates
  one cluster per git worktree — each gated by design-quality, a per-cluster Behavioral Assurance Level
  (BAL) and an Enterprise-Readiness Level (ERL), behind a merge gate and a completion gate.
  Triggers on: "rewrite", "port to", "translate to", "Java to .NET", "Express to Angular".
---

# Skill: rewrite — out-of-place generative migration

_Skill version: 1.0 · Last changed: 2026-09-08 · Plugin compatibility: ≥3.20.0 · Consent: A_

> Part of the three-skill migration family (Upgrade · Rewrite · Replatform). Design of record:
> `docs/plans/migrationSkill/rewrite.md` (T1–T4) + `docs/plans/migrationSkill/README.md`.
> ADO-9000 Story 2. Uses the shared substrate: `skills/shared/migration-ledger-schema.md`,
> `skills/shared/judge.md`, `skills/shared/model-routing-spec.md`.

> ⚠ **Feature Gate + Write Gate** (CLAUDE.md §0): no generated code is written to the target until
> `APPROVE ADO-{ID}`. Source files are read-only; the target is a NEW folder.

## Guiding principle

> **Greenfield with a defined intent.** The source is the intent oracle (runnable source / behavioral
> inventory), not a codebase to mutate. The LLM authors new target code, but every cluster's
> assurance is *measured* (BAL, weakest-link, mechanical denominators) and *gated* — never assumed.

## Skill shape

- **Locality:** out-of-place (a new target folder; source stays read-only).
- **LLM role:** generative author.
- **Oracle:** the running source / inventory-as-intent; per-cluster BAL is the assurance measure.

## Persona

Execute as **[SE] Elena Fischer — Senior Software Engineer**, weighing **[SA] Rafael Mendes**
(posture / options / architecture) at intake and **[QA] Sam Okonkwo** (BAL / test coverage) at the
gates. The persona sets *what to scrutinise* — never licenses assumption. See
`$PLUGIN_DIR/skills/shared/personas-spec.md`. Never name the persona in output.

## Model routing

- Generation (options, design, code): `${ICEA_MODEL:-claude-opus-4-8}`.
- Judge on every gate: the shared three-tier ladder — `${CRITIC_MODEL:-claude-sonnet-4-6}` →
  `${CRITIC_MODEL_MAX:-claude-opus-4-8}` (max effort) for high-risk / B-series → different-family
  panel for top-risk. See `$PLUGIN_DIR/skills/shared/judge.md` + `model-routing-spec.md`.

## Resolve PLUGIN_DIR — before any step

```
Read .claude/plugin-path.txt → PLUGIN_DIR
(if absent: §1a resolver from $PLUGIN_DIR/skills/shared/plugin-path-resolution.md)
```

## Stage flow

```
Detect source stack                  (shared detector — migration-source-detect.cjs)
  → Resolve POSTURE                   (stack distance: port | re-architecture | rewrite-from-spec)  ← implemented
  → Present OPTIONS (assurance × effort × TCO)  OR  accept BYO design (same scrutiny)               ← implemented
  → TARGET-space decompose → dependency DAG → worktree schedule                                     ← implemented
  → for each cluster (worktree, DAG-scheduled): generate → design-quality gate                      ← implemented
  → per-cluster BAL (weakest-link) + ERL (app-readiness, Tier-0 backbone)                           ← implemented
  → MERGE GATE (provisional BAL ≠ D)                                                                ← implemented
  → COMPLETION GATE (final BAL; B-series hard-block below floor)                                    ← implemented
  → every gate: shared LLM-as-judge verdict; checkpoint to the SHARED ledger                        ← implemented
```

## Step 1 — Intake & posture (implemented — AC-F4)

1. **Detect** the source stack (do NOT re-implement detection):
   ```bash
   node "$PLUGIN_DIR/scripts/migration-source-detect.cjs" --roots=<source> --json
   ```
2. **Resolve posture** from stack distance — see `references/posture.md`:
   ```bash
   node "$PLUGIN_DIR/scripts/rewrite-decompose.cjs" posture \
     --source-lang=<l> --source-fw=<fw> --target-lang=<l> --target-fw=<fw> [--oracle=none] --json
   ```
   | posture | when | consequence |
   |---|---|---|
   | `port` | same language **and** same framework | structure-preserving translation viable |
   | `re-architecture` | any language or framework change | port refused; ask keep-vs-redesign (architecture + platform) |
   | `rewrite-from-spec` | no runnable source oracle | intent comes from the inventory/spec (BAL ceiling applies) |

## Step 2 — Options (assurance × effort × TCO) or BYO design (implemented — AC-F4)

Present 2–3 target options with pros/cons across **assurance ceiling × effort × TCO** (onboarding +
**web-grounded, dated** recurring run-cost) — see `references/options-and-tco.md`. The developer may
instead supply a **BYO design** (image / design doc); it is held to the **same critic scrutiny** as
generated options (`references/byo-design.md`) — never silently accepted. The assurance ceiling
(e.g. no runnable oracle → BAL capped at C/D) is shown **before** the developer commits.

## Step 3 — Target-space decomposition + dependency DAG (implemented — AC-F4)

Decompose the work in **target space** (not source structure), emit an **acyclic** dependency DAG, and
a worktree schedule (parallelizable waves):
```bash
node "$PLUGIN_DIR/scripts/rewrite-decompose.cjs" decompose --graph=<source-graph.json> [--group-by-domain] --json
```
Exit `0` = acyclic (proceed); exit `11` = a cycle was found — **break it before scheduling** (never
generate against a cyclic plan). Each wave is a batch of clusters generatable in parallel worktrees.

## Step 4 — Generate per cluster (worktree, DAG-scheduled) + design-quality gate (implemented — AC-F6)

For each cluster, in DAG-wave order (from Step 3), generate the target code in its **own git worktree**
so parallel clusters cannot collide. Design-Quality is gated at **two** points, both verified by the
shared judge (`$PLUGIN_DIR/skills/shared/judge.md`) reading only the artifact + rubric + ground truth
— see `references/design-quality.md`:

1. **Design gate (before generation):** is the cluster's plan Simple / Readable / Maintainable /
   Testable (SRMT)? `REVISE` → refine + re-judge; never generate against a failing design.
2. **Implementation gate (on the generated diff):** did the code honor SRMT? Non-trivial choices carry
   a `// DECISION:` comment (project-rules.md). `REVISE` → regenerate flagged units; `BLOCK` → stop.

All generated code is written to the NEW target only after `APPROVE ADO-{ID}` (Write Gate). A cluster
must clear **both** its design-quality gate (this step) **and** its BAL gate (Step 5–6) to merge.

## Step 5 — Per-cluster BAL + ERL (implemented — AC-F5)

After a cluster is generated + its tests / golden-master run, compute its **Behavioral Assurance Level**
(weakest-link, mechanical denominators) — see `references/bal.md`. The skill runs the tests/oracle and
feeds the **counts** in; the script grades deterministically:

```bash
node "$PLUGIN_DIR/scripts/rewrite-bal.cjs" bal --cluster=<name> --oracle=<runnable|none> \
  --behaviors-total=<N> --behaviors-verified=<M> [--tests-total=<T> --tests-passing=<P>] --json
```

`BAL = min(oracle_ceiling, coverage, tests)`. **No runnable oracle caps the cluster at C** (ceiling
flagged). Assemble the whole-target **ERL** from the app-readiness 8 domains — designed-in at Tier 0,
not audited at the end (`references/erl.md`). Record both in the ledger (`payload.rewrite.BAL/ERL`).

## Step 6 — Two-gate model (implemented — AC-F5)

```bash
# Merge gate — provisional BAL must be ≠ D (exit 12 blocks)
node "$PLUGIN_DIR/scripts/rewrite-bal.cjs" merge-gate --bal=<provisional> --json
# Completion gate — B-series below floor is a HARD BLOCK (exit 13; named approver + reason)
node "$PLUGIN_DIR/scripts/rewrite-bal.cjs" completion-gate --bal=<final> --floor=<A|B|C> --b-series=<true|false> --json
```

- **Merge gate:** a cluster at provisional BAL D cannot merge — raise assurance or re-scope.
- **Completion gate:** a **B-series** cluster below the assurance floor is **hard-blocked** (no silent
  pass; named approver + written reason required). Non-B-series below floor is a warn.

Every gate records an independent **judge** verdict (`$PLUGIN_DIR/skills/shared/judge.md`, risk-scaled)
and is persisted to the shared ledger via `scripts/checkpoint-ledger.cjs` (`set-gate` / `set-payload`).

## Hard Rules

- NEVER offer `port` unless source and target share BOTH language and framework — else re-architecture.
- ALWAYS hold a BYO design to the same critic scrutiny as generated options — never silently accept it.
- ALWAYS show the assurance ceiling (e.g. no-oracle → BAL C/D) BEFORE the developer commits.
- NEVER schedule worktrees against a cyclic DAG — break the cycle first (decompose exits 11).
- BAL is **weakest-link** on **mechanical denominators** — NEVER average dimensions or grade by judgment.
- NEVER merge a cluster at provisional BAL D; NEVER let a B-series cluster below floor pass the
  completion gate silently — it is a hard block (named approver + written reason).
- SOURCE is read-only; the target is a NEW folder; no generated code to target before `APPROVE ADO-{ID}`.
- ALWAYS record posture, options decision, and the DAG in the shared ledger (`checkpoint-ledger.cjs`).
- ALWAYS invoke plugin scripts via the resolved `$PLUGIN_DIR` — never a bare relative path.
