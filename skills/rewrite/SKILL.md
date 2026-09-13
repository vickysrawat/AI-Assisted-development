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
  → Resolve POSTURE                   (stack distance: port | re-architecture | rewrite-from-spec)
  → Integration verification          (integration-verification-spec.md — before options)
     + Oracle mode detection          (golden-master-spec.md Step 1 — feeds assurance ceiling)
  → Present OPTIONS (assurance × effort × TCO, INCLUDING DAG per option)
     each option: clusters · wave schedule · effort · TCO · assurance ceiling
     APPROVE OPTIONS → selected option's DAG committed
  → Author target design documents    (design-revision-spec.md → document-orchestrator.md)
     feedback loop available          (document-feedback.md · option-change-spec.md)
     APPROVE DESIGN
  → Resolve target execution profile  (strategies/{target}.md via strategy-resolve.cjs; STOP if missing)
  → for each cluster (worktree, DAG-scheduled): generate → design-quality gate
  → per-cluster BAL (weakest-link) + ERL (app-readiness, Tier-0 backbone)
  → MERGE GATE (provisional BAL ≠ D)
  → COMPLETION GATE (final BAL; B-series hard-block below floor)
  → every gate: shared LLM-as-judge verdict; checkpoint to the SHARED ledger
  → migration log: follow migration-log-spec.md at each phase
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

## Step 1.5 — Integration verification + oracle mode detection (new)

Run before options are presented. Produces two outputs that feed the options presentation.

**1. Integration verification** — per `$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/integration-verification-spec.md`:
- Tier 1: client-side (config, WSDL, proxy classes, assembly references)
- Tier 2: server-side via `additionalDirectories` if the service source is available
- Produces the **Integration Inventory** (`docs/.../integration-inventory.md`)
- Classification per service: data-access-only | business-logic | mixed | unknown
- Options derived per service: inline as project | NuGet package | keep external
- Write `[INTEGRATION]` migration log entries per `migration-log-spec.md`

**PARTIAL rows during options:** advisory — highlighted and flagged in the options table but
not a hard block at `APPROVE OPTIONS`. PARTIAL rows become a **hard block at `APPROVE DESIGN`** —
`target-security-architecture.md` and `target-integration-architecture.md` cannot be accurately
authored with unverified auth schemes. The developer must resolve them before the design gate closes.

**2. Oracle mode detection** — per `$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/golden-master-spec.md` Step 1:
- Determine the oracle mode for this migration: `self-run` | `provided-url` | `deferred-capture` | `skipped`
- Record in `decision_log.golden_master`
- The oracle mode determines the **assurance ceiling** shown per option (no oracle → BAL caps at C/D)

Record both outputs in the checkpoint before proceeding to Step 2.

---

## Step 2 — Options (assurance × effort × TCO, including DAG per option) (updated)

Present 2–3 target options with pros/cons across **assurance ceiling × effort × TCO** (onboarding +
**web-grounded, dated** recurring run-cost) — see `references/options-and-tco.md`. The developer may
instead supply a **BYO design** (image / design doc); it is held to the **same critic scrutiny** as
generated options (`references/byo-design.md`) — never silently accepted.

**Each option now includes DAG characterisation** — run `rewrite-decompose.cjs decompose` for each
candidate option before presenting. Show per option:
- Cluster count and wave schedule (parallelizable vs sequential)
- Estimated effort derived from cluster structure
- Integration approach per service (from the Integration Inventory)
- Assurance ceiling (from oracle mode detected in Step 1.5)

**Present per `options-insight-spec.md`** (`$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/options-insight-spec.md`):
- Every attribute carries a **basis** from the fixed vocabulary (`computed` | `web-grounded:{date}` |
  `published-spec` | `estimate:{source}` | `requires:{who}`) — never a confidence tier.
- Each decision-critical attribute (cluster count, effort, TCO, assurance ceiling) is paired with a
  **comparative insight** explaining the delta between options.
- Volatile facts (TCO pricing, framework/runtime capabilities) are **web-grounded** through the cache
  (VERIFIED/INFERRED, dated); suggest the web search before running it; offline → `refs/` INFERRED tier.
- **Triggered judge pass** on the option-selection synthesis when options are a close call or the
  developer asks "why?".
- `requires:` on compliance / security / NFR-floor routes to a named human before `APPROVE OPTIONS`.

```bash
node "$PLUGIN_DIR/scripts/rewrite-decompose.cjs" decompose \
  --graph=<source-graph.json> --option=<A|B|C> [--group-by-domain] --json
```

After `APPROVE OPTIONS`: the selected option's DAG is **committed** — it feeds both Step 2.5
(design documents) and Step 3 (code generation). No separate decompose step needed.

Write `[OPTION]` and `[DECISION]` (APPROVE OPTIONS) migration log entries per `migration-log-spec.md`.

## Step 2.5 — Target design documents (new)

Runs after `APPROVE OPTIONS`, before any code generation. The selected option's DAG is already
committed — the component architecture document is built from it.

**1. Derive the dependency graph:**
```bash
node "$PLUGIN_DIR/scripts/graph-derive-documents.cjs" \
  --spec="$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/target-design-spec.md" --json
```
Exit 1 (cycle) or exit 2 (parse error) → fix the template before proceeding.

**2. Author all 7 design documents** via `document-orchestrator.md` (wave-scheduled, parallel
subagents). Each agent receives only the context it needs — never the full source codebase. The
Integration Inventory is shared state passed to all agents.

**3. Developer reviews and the feedback loop runs** via `design-revision-spec.md`:
- Corrections → `document-feedback.md` (revision cascade)
- Option changes → `option-change-spec.md` (bounded | significant | fundamental)
- New information → routed through the appropriate verification spec first

**4. APPROVE DESIGN** — all 7 documents must reach `Status: APPROVED` with no PARTIAL/UNVERIFIED
integration rows remaining. Records `payload.rewrite.gate_verdicts.design_approved = true`.

Write `[DECISION]` entries (per document + APPROVE DESIGN) and `[REVISION]` entries (per feedback
loop wave) per `migration-log-spec.md`.

## Step 3 — Resolve execution profile, then generate per cluster + design-quality gate (was Step 4)

**First, resolve the target execution profile** — the stack-specific commands/paths that keep this
skill's logic stack-agnostic (`$PLUGIN_DIR/skills/shared/migration-knowledge/refs/strategies/README.md`).
Run at the start of the generation phase, once per target track:

```bash
node "$PLUGIN_DIR/scripts/strategy-resolve.cjs" --target=<target-token> --json
# two-track (full-stack): resolve BOTH the backend and the frontend token
```

| Exit | Meaning | Action |
|---|---|---|
| 0 | resolved (`STATUS: implemented`, full token contract present) | proceed; if `unverified:true` (⚠ MATURITY) **warn the developer** before relying on it |
| 2 | implemented but a required token is missing (malformed profile) | **STOP** — fix the profile |
| 3 | `STATUS` not `implemented` (stub) | **STOP** — target not runnable |
| 4 | no profile file for the target token | **STOP** — never fall back to another stack's toolchain (same honest-refusal rule as an unmapped source) |

Use the resolved profile's tokens for every stack-specific command below — `SKELETON` + `LAYOUT` +
`RULES` + `STANDARDS_EXAMPLE` (scaffold), `BUILD` + `TEST_CLUSTER` + `BUILD_UNIT` + `PKG_ADD`
(per-cluster generation), and `TEST_ALL` + `COVERAGE` + `SERVE` + `E2E` + `CONFIG` + `FITNESS`
(verification, Step 4). Never hard-code `dotnet build` / `npm run build` from memory — read them from the
profile.

Then, for each cluster, in DAG-wave order (from Step 2's committed DAG), generate the target code in its
**own git worktree** so parallel clusters cannot collide. Design-Quality is gated at **two** points,
both verified by the shared judge (`$PLUGIN_DIR/skills/shared/judge.md`) reading only the artifact +
rubric + ground truth — see `references/design-quality.md`:

1. **Design gate (before generation):** is the cluster's plan Simple / Readable / Maintainable /
   Testable (SRMT)? `REVISE` → refine + re-judge; never generate against a failing design.
2. **Implementation gate (on the generated diff):** did the code honor SRMT? Non-trivial choices carry
   a `// DECISION:` comment (project-rules.md). `REVISE` → regenerate flagged units; `BLOCK` → stop.

All generated code is written to the NEW target only after `APPROVE ADO-{ID}` (Write Gate). A cluster
must clear **both** its design-quality gate (this step) **and** its BAL gate (Step 5–6) to merge.

## Step 4 — Per-cluster BAL + ERL (was Step 5)

After a cluster is generated, run its tests via the resolved profile's **`TEST_CLUSTER`** (single
cluster) / **`TEST_ALL`** (full suite) and read line coverage via **`COVERAGE`**; drive behavioral
smoke / golden-master replay against a target started with **`SERVE`** + **`E2E`** (gated by the
profile's `CONFIG` pre-flight). Feed the resulting **counts** into the BAL grader — compute the
**Behavioral Assurance Level** (weakest-link, mechanical denominators), see `references/bal.md`. The
oracle mode was determined at Step 1.5 — pass it here directly; do not re-detect:

```bash
node "$PLUGIN_DIR/scripts/rewrite-bal.cjs" bal --cluster=<name> \
  --oracle=<self-run|provided-url|deferred-capture|skipped> \
  --behaviors-total=<N> --behaviors-verified=<M> [--tests-total=<T> --tests-passing=<P>] --json
```

`BAL = min(oracle_ceiling, coverage, tests)`. **No runnable oracle caps the cluster at C** (ceiling
flagged — surfaced to developer at Step 2 options; not a surprise here). Assemble the whole-target
**ERL** from the app-readiness 8 domains — designed-in at Tier 0, not audited at the end
(`references/erl.md`). Record both in the ledger (`payload.rewrite.BAL/ERL`).

Write `[DECISION]` migration log entries per BAL gate per `migration-log-spec.md`.

## Step 5 — Two-gate model (was Step 6)

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

- NEVER present options before the Integration Inventory is complete — PARTIAL rows are advisory
  during options but the oracle mode and integration approaches must be known.
- NEVER generate code before `APPROVE DESIGN` closes — all 7 design documents must be approved.
- ALWAYS resolve the target execution profile (`strategy-resolve.cjs`) at the start of generation and
  read every stack-specific command (build/test/serve/scaffold) from it — NEVER hard-code a toolchain
  from memory. STOP on exit 2/3/4 (malformed / stub / missing); WARN when `unverified:true`; NEVER fall
  back to another stack's profile. Two-track migrations resolve BOTH a backend and a frontend profile.
- NEVER re-detect the oracle mode at BAL time — it is determined at Step 1.5 and passed through.
- NEVER offer `port` unless source and target share BOTH language and framework — else re-architecture.
- ALWAYS hold a BYO design to the same critic scrutiny as generated options — never silently accept it.
- ALWAYS show the assurance ceiling (e.g. no-oracle → BAL C/D) BEFORE the developer commits — it
  is derived from the oracle mode detected at Step 1.5 and shown per option at Step 2.
- ALWAYS characterise the DAG (cluster count, wave schedule) per option candidate at Step 2 —
  never present options without their decomposition shape.
- NEVER schedule worktrees against a cyclic DAG — break the cycle first (decompose exits 11).
- BAL is **weakest-link** on **mechanical denominators** — NEVER average dimensions or grade by judgment.
- NEVER merge a cluster at provisional BAL D; NEVER let a B-series cluster below floor pass the
  completion gate silently — it is a hard block (named approver + written reason).
- SOURCE is read-only; the target is a NEW folder; no generated code to target before `APPROVE DESIGN`.
- ALWAYS record posture, options decision, integration inventory, and the DAG in the shared ledger.
- ALWAYS invoke plugin scripts via the resolved `$PLUGIN_DIR` — never a bare relative path.
- Write migration log entries per `migration-log-spec.md` at each phase — never defer logging.
