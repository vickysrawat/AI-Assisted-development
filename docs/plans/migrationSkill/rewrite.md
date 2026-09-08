# Plan — Rewrite Skill (out-of-place, generative, source → new target)

# Status - In design (T1–T4 all settled — Rewrite fully designed)

> Run this in the **plugin repository** (ai-assisted-development). Part of the three-skill family — see
> [README.md](README.md). Sibling skills: Upgrade, Replatform.
> **Flagship** of the family — where the LLM adds the most value *and* can most convincingly mislead,
> so the design is built around epistemic honesty.

---

## RESUME POINT

- ✅ **T1** Posture & options — settled
- ✅ **T2** Oracle & epistemic honesty — settled
- ✅ **T3** Cluster / parallel execution model — settled
- ✅ **T4** Intake boundary — settled

**Rewrite is fully designed.** Framing: *a greenfield application with defined intent, enterprise-grade* —
source is the **intent** source, not a structural template.

Still open at **family level** (next work): **shared-substrate governance** (vendored-copy+drift-check vs
shared dep) · whole **Replatform** skill.

Cross-cutting decisions made this session (apply to all three skills) → captured in [README.md](README.md) § Shared substrate.

---

## Context

Rewrite is out-of-place code translation: read-only source → newly generated target in a separate folder.
It **absorbs "code-port lift-shift"** as posture `port`. Its correctness is entirely a function of the
**oracle**, and its dominant failure mode is a *confident green report on an understated denominator* —
so the design makes oracle-strength and coverage impossible to overlook.

---

## T1 — Posture & options *(settled)*

**Posture auto-resolves from STACK DISTANCE — it is not a free knob.**

| Stack distance | Posture |
|---|---|
| same language + same framework (new repo/layout/lateral) | `port` available (faithful transliteration; preserve behavior + debt) |
| any framework change **or** any language change | forced **re-architecture** (developer chooses the flavor) |

- **Re-architecture opens a choice, never an open-ended question:** the skill presents **2–3 grounded
  design options with pros/cons + recommendation** (reuse/extend Stage 0.5 Target Options Analysis).
  "Keep existing architecture" → re-architecture; "new design" → rewrite-from-spec.
- **Options are scored on consistent axes:** behavioral risk · **one-time effort** · **run-cost/TCO** ·
  maintainability · platform/ops fit — *and* surface the **T2 assurance ceiling** each option implies.
- **Cost has two parts** (different owners): one-time migration **effort** (grounded bottom-up from scope
  × posture × feasibility-color × stack-distance; range + drivers, never a point number) and recurring
  **run cost** (web-grounded via *resource-shape-first → price each SKU*; cited+dated; volatile cache).
  Rolled into an N-year **TCO** per option. Honesty rails: ranges + confidence, relative-first,
  confidence-tier every estimate, show drivers.
- **BYO-design escape hatch:** *"None of these — I'll provide my own"* (image/diagram or doc). LLM flips
  from proposer to **critic**: multimodal-parse → confirm interpretation back (INFERRED until confirmed)
  → run the **same-rigor** scrutiny (feasibility, coverage-gap vs inventory, assurance consequence,
  effort+TCO). A BYO design replaces the target **structure**, NOT the behavioral **inventory** — T2
  correctness is unchanged. Developer may accept a flagged risk but can't make the skill hide it.

**Fidelity brake (port clusters):** structural-parity check (class/method shape mirrors source) — **strong
advisory at the merge gate**, whole-cluster (port is now same-lang+same-fw, so high-signal). The T2
behavioral oracle remains the hard correctness backstop. Granularity: keep-vs-redesign is a project-level
default with a **per-cluster override**. For a port cluster, an "improvement" is a **defect**.

---

## T2 — Oracle strength & epistemic honesty *(settled)*

**Two oracle regimes are categorically different:**
- **Running source → replay oracle** covers *negative space* (catches behavior nobody wrote down).
- **Non-running source → inventory-as-intent oracle** can only see what was captured → the inventory is
  an **invisible ceiling** (silent behavioral loss).

**Per-cluster Behavioral Assurance Level (BAL):**

| BAL | Meaning |
|---|---|
| **A** Replay-verified | running-source golden-master passed for exercised paths + coverage ≥ floor |
| **B** Spec-verified | rewrite-from-spec; GM-verifiable inventory items verified; INFERRED dispositioned |
| **C** Test-verified only | characterization/unit tests pass, no external oracle |
| **D** Inferred/unverified | parity asserted, not proven |

**Rules:**
- BAL is **per-cluster**, aggregated **weakest-link** (never averaged).
- Report **leads** with the BAL table + **two coverage ratios** — *verified/inventoried* and
  *inventoried/discoverable-surface* — with **mechanically-derived denominators** (never LLM-estimated).
- **No silent truncation** — a disclosed gap is a decision; a hidden gap is a lie.
- **Hybrid gate:** hard-block `MIGRATION COMPLETE` for B-series/high-risk clusters below floor; loud-
  permanent advisory for the rest.
- **Friction proportional to risk:** high-risk/B-series D-items need a *named* approver + behavior-specific
  reason; accepted-unverified items persist into the report + as-built docs as standing debt.

---

## T4 — Intake boundary *(settled)*

Front door = a **deterministic-where-possible classifier**; asks the human only where genuinely ambiguous;
the routing decision is **explained + confirmed (never silent)** and **judged** (independent LLM-as-judge —
misrouting is the family's highest-risk failure).

```
Detect source stack + version (shared substrate: migration-source-detect.cjs)
  → LOCALITY?  in-place → UPGRADE   |   out-of-place → REWRITE
  → FALSE-UPGRADE guard: framework/language boundary crossing → force REWRITE
  → Source has a mapping ref to a valid target?  no → HARD STOP (no fabrication)
  → ORACLE-RUNNABILITY PROBE (A) — self-runs? reachable URL? neither? → sets each option's BAL ceiling
  → STACK DISTANCE → posture availability
  → Target Options Analysis (assurance × effort × TCO + recommendation + BYO hatch)  [BAL ceilings shown]
  → developer picks → decision_log → Stage 1
```

**Decisions (all Yes):**
- **A — oracle-runnability probed at INTAKE** (moved earlier from Stage 5) so every option shows its honest
  **BAL ceiling up front** — a non-runnable source visibly caps rewrite-from-spec clusters at C/D *before*
  the developer chooses.
- **B — multi-archetype = explicit route-and-hand-off**; each skill single-purpose. Intake names the
  hand-offs (*"Rewrite frontend here; run `/upgrade` for backend; Azure = Replatform overlay"*) — no
  one-session cross-skill orchestration (that rebuilds the mega-engine).
- **C — hard precondition gate** — blocks until source readable + registered (additionalDirectory), stack
  detected with a valid target mapping, target confirmed, graph-present-or-heuristic-fallback acknowledged.

---

## T3 — Cluster / parallel execution model *(settled)*

### Decomposition (D1) — always in TARGET space
The target architecture is the org chart; dependencies are always target→target. **Posture sets each
cluster's *internal* generation strategy, not the decomposition axis:** `port` → internals mirror a mapped
source module (source graph is an *input*); `rewrite` → internals designed fresh from the inventory. Pure
whole-app `port` collapses to source==target space (no regression). **Inventory feature-IDs** map every
target cluster back to the source behaviors it owes (survives source-module split/merge).

- **New requirement:** the design stage must emit a **declared, machine-readable target dependency DAG**
  (can't be read from non-existent target code) — `port` inherits source edges via the mapping; `rewrite`
  declares inter-context edges. The DAG is a hypothesis → **drift detection** on undeclared deps.
- **Port→rewrite seam (the hard one):** `rewrite→port` is easy; `port→rewrite` needs either a
  **compatibility interface** on the rewrite side **or** treating the port cluster's boundary calls as a
  **local re-architecture** (exempt from the fidelity brake at that seam). Every such seam is a
  human-gated decision + ADR (see governance).
- **SharedKernel posture propagates:** a `port` kernel carries its debt to *all* dependents → surface a
  warning; developer may still override per-cluster.

### Governance — interactive, tiered, ADR-generating (D1)
Migration is novel-per-project → high-stakes forks are **LLM-proposed, human-decided, ADR-recorded.**
- **Tiered by risk × novelty:** novel/high-blast (port→rewrite seam, cycle break, kernel posture, B-series
  contract) → **human gate + ADR**; routine/precedented → **auto-proceed + apply precedent + log** (judge
  backstop). **Batch** decisions at cluster gates with pre-computed recommendations. Headless/CI → **block,
  not guess** on high-risk.
- **ADRs become a decision-precedent library** — a 3rd content class of the shared migration-knowledge
  cache — that grounds future decisions and **shrinks human load over time.**
- Decision-point taxonomy: posture-at-seam · contract-adaptation · undeclared-dep · cycle-break ·
  debt-carry-vs-fix · BAL-acceptance. Approved decisions persist in checkpoint (never re-asked on resume).

### Parallelism & isolation (D2)
**Worktree-per-cluster + dependency-driven scheduling** (pipeline, not tier barriers). SharedKernel first
(real serial dep). **Disjoint target-path ownership per cluster** — doubles as **resume-safety**
(in-progress → discard → regenerate). Checkpoint persists DAG + per-cluster status + merged-set →
deterministic ready-set recompute. **Dynamic DAG repair:** discovered dep merged → proceed; unbuilt →
block + re-evaluate; new edge forms a cycle → escalate. Single-writer holds (cluster agents are pure
functions returning ClusterResult; orchestrator is the sole serial checkpoint writer). **Degrade to
sequential tiers below a cluster-count threshold.**

### Two assurance axes — both SHIFTED LEFT (D3)
Correctness has **two orthogonal, staged assurance axes**, both captured at intake, both design criteria in
the options, both built-in per cluster, both gated at completion — **neither waits for the end, so neither
surprises you:**

| Axis | Question | Grade |
|---|---|---|
| **Behavioral (BAL)** | Does it behave like the source/intent? | staged BAL lifecycle |
| **Enterprise-readiness (ERL)** | Is it production-grade? | staged ERL lifecycle (the 8 `app-readiness` domains) |

**Shift-left mapping (ERL is symmetric to BAL, not an end-only audit):**

| Stage | BAL | ERL |
|---|---|---|
| Intake | oracle probe → BAL *ceiling* | **capture NFR/readiness spec** (SLAs, availability, throughput, security/compliance, observability+ops) |
| Options (T1) | assurance ceiling per option | **each option scored on the 8 readiness domains** (pick knowing readiness posture) |
| Architecture (Stage 1) | inventory basis | **readiness embodied in the design** (observability/resilience/security/pipeline), gated |
| Cluster gen (Stage 4) | provisional BAL | **readiness built into each cluster** (tests, telemetry, health, error/retry) |
| Completion | final BAL | **`app-readiness` scan *confirms* designed-in readiness** (confirmation, not discovery) |

*"Done" = behavioral parity proven (BAL) **and** production-readiness met (ERL); shortfall on either is
explicitly accepted as standing debt.*

**ERL refinements:**
- **System-level + cluster-level.** Pipeline / observability-backbone / runbook belong to the *foundation*,
  not one cluster → ERL has **cluster rows + system rows** (mirrors BAL cluster + seam rows). The
  **readiness backbone is built in Tier 0 (SharedKernel)** so all dependents inherit it.
- **Requirements-driven, not gold-plated.** ERL floor is **domain-configurable** (CRUD tool < fintech API),
  seeded from business-context / B-series — keeps "simplicity first," avoids over-engineering.
- **Improves T1 estimates.** Readiness as a design criterion → options' effort + TCO *include*
  observability/pipeline/resilience work instead of it surfacing as unplanned end-cost.

Greenfield → each cluster generated **with** tests/observability/clean-arch from the start, not retrofitted.

### Design-Quality layer — leading enablers, gated design + implementation
Rather than bolt on quality pillars one at a time (itself un-maintainable), **one first-class Design-Quality
layer** covers the four `project-rules.md` pillars — **Simplicity · Readability · Maintainability ·
Testability** — each with concrete fitness signals, gated at **design AND implementation** time, *feeding*
the outcome axes (BAL, ERL) rather than duplicating them. (This is "simplicity first / DRY" applied to our
own architecture.)

**Two checkpoints (why implementation-time matters):** the design gate asks *"is this design
testable/maintainable?"*; the **implementation gate is where the independent judge verifies the generated
code actually embodies it** — real DI/seams, low complexity, no duplication — not merely *claims* it
(LLM-as-judge = output-vs-claim). Front-load hardest: retrofitting these into finished code is the worst
retrofit.

| Pillar | Concrete fitness signals | Notes |
|---|---|---|
| **Testability** | DI, seams/ports-and-adapters, pure domain, isolated I/O, injected time/random, no hidden statics; seam presence, test-to-code ratio, optional mutation score | *≠ test-coverage* (coverage is lagging, an ERL domain). **Upstream of BAL — untestable code caps a cluster's BAL ceiling.** |
| **Maintainability** | complexity (cyclomatic/cognitive), duplication (DRY %), coupling/cohesion, **change-locality** (a change touches few files), convention consistency, `// DECISION:` transparency, dead-code | vaguest pillar → must have measurable signals or don't gate; avoid double-counting coupling/cohesion with Testability |
| **Simplicity** | no over-engineering / YAGNI, complexity ceilings | `project-rules` "simplicity first" |
| **Readability** | naming, clarity, consistency | |

**Layer relationship (no double-count):** Design-Quality = **leading enablers, front-loaded**
(Testability → BAL ceiling; Maintainability/Simplicity → ERL supportability + long-term cost). BAL + ERL =
**lagging outcomes, gated at the end.** A rewrite is the one chance to fix the source's design-quality debt —
generate quality-by-construction; only `port` clusters carry source debt forward, by explicit flagged choice.

**BAL is a staged, evidence-driven lifecycle**, recomputed + re-validated at every stage gate:

| Stage | BAL state |
|---|---|
| Intake (oracle probe) | **Ceiling** (non-runnable source caps at C/D) |
| Inventory | **Basis** |
| Cluster merge | **Provisional** (isolation-checkable; interdependent caps at C) |
| Assembly / integration | **Measured** (integration golden-master) |
| Verification / as-built | **Validated / Confirmed** |

- **Not monotonic** — integration can *raise* or *lower* BAL → the report shows the **trajectory** (late
  drops = shaky migration = a trust signal).
- Each stage is a **validation gate with a feedback loop** (evidence insufficient → remediate more
  tests/recordings, or downgrade + escalate). **Convergence required at completion** (BAL still moving =
  not done).
- **Integration-seam behaviors** (saga/auth spanning clusters — where rewrites silently break) get their
  **own BAL rows**; weakest-link aggregation **includes seams.**
- **BAL rubric is domain-configurable** (fintech stricter than CRUD; seeded from business-context/B-series).
- Every BAL value carries **provenance** (evidence + timestamp + attesting judge).

**Two gate locations** (avoids the B-series deadlock):
- **Merge gate** (per cluster): build + tests + goal-loop + **judge PASS** + port-fidelity advisory +
  provisional BAL **≠ D**.
- **Completion gate** (end of run): **final** per-cluster + seam BAL floor (weakest-link, **hard-block for
  B-series**) **and** app-readiness grade. Unverifiable B-series → only a **named-approver +
  behavior-specific reason** unblocks (recorded as standing debt).

---

## Verification (to expand as T3/T4 close)
Fixture source apps across stack distances (same-lang+same-fw / same-lang+diff-fw / foreign) asserting:
correct intake routing + false-upgrade rejection; posture auto-resolution; options with honest BAL ceilings
+ effort/TCO; BYO-design same-rigor critique; per-cluster BAL computed with mechanical denominators;
hybrid gate + risk-proportional acceptance; LLM-as-judge (separate agent + separate model) verdicts.
