# Session Log — Migration Skill Family (2026-09-11)

> Living document. Captures all decisions, rejections, open discussions, and pending items
> from this session. Updated as the session progresses. Feeds FOLLOW-UPS.md at session end.
>
> Session scope: de-coupling retired skill references from the migration knowledge tier +
> designing the target design document phase + integration verification.

---

## ▶ RESUME HERE — start of next session (anchor)

**State as of 2026-09-12 (session 2) pause:**
- All new specs built + wired into the 3 live skills. All 3 architecture explainers synced. Strategies
  execution profiles wired (D-19). All **5** test suites GREEN: `migration-retirement` 8/0 ·
  `migration-specs` 4/0 · `graph-derive-documents` 5/5 · `strategy-resolve` 8/0 ·
  `migration-validation/run-selftest` 18/18.
- Working tree NOT committed (verify with `git status` before starting).

**New specs/skills created earlier this session** (all in `skills/shared/migration-knowledge/refs/specs/`):
`target-design-spec.md` · `integration-verification-spec.md` · `design-revision-spec.md` ·
`document-orchestrator.md` · `document-feedback.md` · `document-graph-derive.md` ·
`option-change-spec.md` · `options-insight-spec.md` · `migration-log-spec.md`
plus rewritten `golden-master-spec.md`, `golden-master-runbook.md`, `asbuilt-reconciliation-spec.md`,
`feasibility-spec.md`. New script: `scripts/graph-derive-documents.cjs`. New tests:
`tests/migration-specs.test.cjs`, `tests/graph-derive-documents.test.cjs`.

**Done in session 2 (2026-09-12):**
- **Action 2 REJECTED** (D-18) — ledger-schema + executor-seam are governed substrate, stay at
  `skills/shared/` root. Not a file move.
- **Architecture explainers synced** — `rewrite-skill.md` (§§1–14), `replatform-skill.md` (§§1–15),
  `upgrade-skill.md` (§§1–13): faithful mirror of each wired SKILL.md (integration verification,
  target-design phase + APPROVE DESIGN, feedback loop, options-insight, option-change / route-to-Rewrite,
  migration log).
- **Item 13 — strategies/ profiles wired** (D-19): `scripts/strategy-resolve.cjs` +
  `tests/strategy-resolve.test.cjs` (8/0); Rewrite full, Replatform verify-subset, Upgrade untouched;
  both SKILL.md + both explainers updated. All 5 suites re-run green.

**Remaining work:**
1. **Commit** — nothing has been committed this session; do only when the user asks. (New files:
   `scripts/strategy-resolve.cjs`, `tests/strategy-resolve.test.cjs`, + earlier session-2 edits.)
2. No open build items — the migration-skill-family workstream is feature-complete for this pass.

**Discipline reminder for this workstream:** discuss-first on every item (explain → argue → build);
run the 4 test suites after each change; keep this log updated.

---

## Files written / changed this session

| File | Action | Status |
|---|---|---|
| `skills/shared/migration-knowledge/refs/specs/golden-master-spec.md` | Full rewrite | ✅ Done |
| `skills/shared/migration-knowledge/refs/specs/golden-master-runbook.md` | New file | ✅ Done |
| `skills/shared/migration-knowledge/refs/specs/asbuilt-reconciliation-spec.md` | Full rewrite | ✅ Done |
| `skills/shared/migration-knowledge/refs/specs/feasibility-spec.md` | Targeted edits (5) | ✅ Done — not discussed first |
| `skills/shared/migration-knowledge/refs/specs/target-design-spec.md` | New file | ✅ Done |
| `skills/shared/migration-knowledge/refs/specs/integration-verification-spec.md` | New file | ✅ Done |
| `skills/shared/migration-knowledge/refs/specs/target-design-spec.md` | Updated (integration link) | ✅ Done — not discussed first |

---

## Architectural decisions made

### D-1: Integration verification belongs BEFORE options (not after)

**Decision:** `integration-verification-spec.md` runs during source analysis, before the options presentation. The Integration Inventory is complete before the developer sees any options.

**Why:** Options present assurance × effort × TCO. Those numbers are wrong if integrations are assumed rather than verified. A WCF service misidentified as REST produces the wrong effort estimate. A data-access-only WCF service that could be inlined never appears as an option at all.

**Rejected approach:** Run integration verification after option selection, as part of authoring the target design documents. Rejected because options would be presented on unverified data.

---

### D-2: Decomposition is part of option characterization, not a post-option step

**Decision:** The decomposition algorithm (DAG computation) runs as part of computing each candidate option, not as a separate step after option selection. The developer sees cluster count, parallelism, and schedule AS PART of the option, not after committing to one.

**Why:** The number of clusters, the parallelism, the schedule — these ARE the option. A developer choosing between options needs to see the decomposition to make an informed choice.

**Rejected approach:** Run decomposition as Step 3 (after APPROVE OPTIONS, before code generation). Rejected because the developer would commit to an option before seeing its decomposition shape.

**Impact on SKILL.md wiring:** The current `rewrite/SKILL.md` Step 3 (decompose) effectively moves into Step 2 (options). After APPROVE OPTIONS, the selected option's DAG is already committed and feeds directly into design document authoring.

---

### D-3: Target design documents come AFTER options, not before

**Decision:** The 7 target design documents are authored after APPROVE OPTIONS, before code/IaC generation. The component architecture document is written from the approved option's actual DAG — accurate from the start, not an estimate.

**Why:** Documents authored before option selection would be speculative (we don't know which stack/host/approach yet). Documents after option selection are grounded in the actual decisions made.

---

### D-4: Infrastructure architecture document is required for Rewrite, not just Replatform

**Decision:** `target-infrastructure-architecture.md` and `target-deployment-architecture.md` are required for both Rewrite and Replatform. For Upgrade they are conditional (only when the option includes a hosting change).

**Why:** A code rewrite to a new stack almost always introduces new cloud dependencies. Assuming Rewrite is code-only ignores that the new app needs to run somewhere. Developer needs to review infrastructure decisions before code generation begins.

**Rejected assumption:** Infrastructure documents only apply when you're moving the host (Replatform). Rejected because Rewrite regularly introduces new cloud services (Key Vault, App Service, managed identity).

---

### D-5: 7 separate design documents (not one combined document)

**Decision:** Each dimension is a separate document: component, security, data, integration, infrastructure, deployment, feasibility.

**Why:** Separate documents keep each authoring pass focused and reviewable in isolation, avoid context issues from a single long document, and allow dimension-specific approval.

**Rejected approach:** One combined target design document. Rejected because of context window and review/approval granularity concerns.

---

### D-6: Integration Inventory is the single authoritative source for integrations

**Decision:** `target-integration-architecture.md` reads from the Integration Inventory (`integration-inventory.md`). It does NOT re-derive integrations independently. Only the "Target approach" column is authored here.

**Why:** If the design document re-derived independently it could contradict the inventory (which already fed the options). Two conflicting sources of truth for the same integrations.

**Open question (not yet resolved):** What happens when a new integration is discovered during design review that wasn't in the source analysis? Options: (A) strict — inventory is closed; (B) return loop — discovered integration triggers return to integration-verification-spec.md to verify, then added to inventory.

---

### D-7: Feedback loop for design document revisions

**Decision:** A feedback loop is needed for the design approval process. When a developer changes one document, the skill identifies which other documents are affected via the document dependency graph, flags them NEEDS-REVISION, and re-authors only the affected documents.

**Why:** Without it, changing "infrastructure from App Service to Container Apps" requires manually figuring out that deployment, security, and feasibility all need revising. The skill has the dependency graph — it should maintain consistency automatically.

**Not yet:** `design-revision-spec.md` — spec for the feedback loop and document dependency graph. Not discussed in depth yet; needs discuss-first before building.

---

### D-8: Migration log captures decisions, rejections, findings, revisions

**Decision:** A migration log (`migration-log.md`) is produced for every migration, capturing: FINDING, INTEGRATION, OPTION, DECISION, REVISION, RISK-ACCEPTED, LESSON events in a structured format inspired by the PRA Learning Log.

**Key structural choices:**
- Phase-based narrative (source analysis → options → design → generation → verification)
- Teaching voice in `[LESSON]` entries (they travel to future migrations); decision-record voice everywhere else
- Each event type has a defined format
- `[LESSON]` entries consolidated at the bottom for future migration reference
- Auto-populated by the skill at each decision point; developer adds context and reasoning

**Not yet:** `migration-log-spec.md` — spec for the log format. Discussed structure (agreed), not yet built; needs discuss-first before building.

---

### D-U1–D-U5: Upgrade-specific wiring decisions

- **D-U1:** Author only NON-EMPTY delta documents — the gap/risk analysis identifies which dimensions
  change; produce delta documents only for those. A clean upgrade = gap/risk report + maybe a component
  delta. No "No change" filler documents (dilutes attention from the real deliverable).
- **D-U2:** Integration verification runs INSIDE Step 3 (gap/risk analysis) — it's the integration
  dimension of that analysis, not a separate pre-options step. Integrations rarely affect the upgrade
  path decision; the ones that break are what the gap/risk report surfaces.
- **D-U3:** Feedback loop applies to the gap/risk report + non-empty deltas (reduced document set;
  `document-graph-derive.md` derives the graph from whatever documents are present).
- **D-U4:** Oracle is `self-run` almost by definition (the app builds/runs — it's what you're upgrading)
  + the baseline tag. Simpler than R1-style oracle detection; brief note at Step 5, degrade if unbuildable.
- **D-U5 (route-to-Rewrite escape hatch):** Step 1 catches false-upgrades up front (exit 3 → Rewrite).
  But infeasibility can be DISCOVERED LATER during gap/risk review or the feedback loop (accumulated
  RED/BLOCKER evidence). Upgrade's hard escalation routes to **Rewrite** (not "return to APPROVE OPTIONS"
  — upgrade's decision was classification, not option-selection). Added to `option-change-spec.md`
  alongside the Replatform refactor-for-cloud posture-boundary note.

### D-13: Options presentation — provenance/basis labels, NOT confidence scores

**Decision (LLM-as-judge critical review):** the options table uses **provenance + basis** labels
stated inline, NOT a confidence-score tier (✓/~/?).

**Why confidence scores were REJECTED:**
- The confidence score is itself an LLM inference — meta-uncertainty (confidence of the confidence).
- Non-deterministic → breaks the reproducible-testing discipline we committed to.
- Superficial consistency with VERIFIED/INFERRED — those are assigned DETERMINISTICALLY (source host,
  PROV presence); a confidence tier on "effort" has no deterministic basis.
- Conflates missing-data uncertainty (resolvable) with estimation uncertainty (inherent).
- False assurance risk on the highest-stakes attribute (compliance can't be LLM-verified).
- False-precision paradox just moves from the number to the tier boundary.

**What we use instead:** basis stated inline with a **fixed vocabulary** — `computed` |
`web-grounded:{date}` | `published-spec` | `estimate:{source}` | `requires:{who/what}`. The basis IS
the confidence signal, but it's a fact (where it came from), not a judgment (how much I trust it).
Deterministic, testable, self-describing. `requires:{who}` names the human who resolves it
(e.g. `requires: compliance sign-off`) rather than a tier the developer defers to.

### D-14: Options insight — comparative + web-grounded at the decision point

**Decision:** the options table is paired with a **comparative insight block** per decision-critical
attribute — explaining the DELTA between options (e.g. "why 5 capabilities and not 9"), not per-option
description. Three content kinds, each grounded differently:
- **Source-derived reasoning** (what the app needs) → deterministic, no web search
- **Volatile cloud facts** (service bundling, pricing, SLAs) → web-grounded via the EXISTING cache
  (`upgrade-knowledge-cache.cjs` pattern + `source-classifier.cjs`), tagged VERIFIED/INFERRED, dated
- **Synthesis** (the conclusion) → the skill's reasoning; NOT a fact

**Why:** the option decision is the highest-leverage, hardest-to-reverse point — a wrong option costs
the whole design + generation phase. Accuracy here has the highest ROI. Consistent with the Upgrade
skill already web-grounding lower-stakes breaking-change facts.

**Offline mode:** degrades to the `refs/mappings` + `refs/strategies` INFERRED tier, dated via the
freshness manifest, staleness shown — never a silent degradation.

### D-15: Option-selection reasoning — TRIGGERED judge pass

**Decision:** the comparative synthesis ("why 5 not 9") gets an independent judge pass (separate
model checks the conclusion follows from the cited facts) — **triggered, not mandatory**. Triggers:
options are within a threshold on the deciding attributes (a close call), OR the developer asks "why?".
A clear-cut option choice does not need the extra pass.

**Why:** verified facts can still yield a wrong conclusion — a confidently-wrong option choice on real
citations is the most dangerous output. But judging every obvious decision taxes the common case to
protect the rare close one.

### D-16: Web-search suggestion — awareness before the search

**Decision:** before triggering a web search for an insight, the skill tells the developer *this
specific comparison needs a web search to verify current cloud facts* — awareness of cost/latency +
consent, and a chance to choose the offline tier in a constrained environment. Follows the plugin's
"graceful pause" pattern (tool preflight).

### D-17: Options-insight decisions are FAMILY-WIDE (cross-cutting)

**Decision:** D-13 through D-16 apply to all three skills' options presentations, not just Replatform.
Consequence (a): warrants a shared spec rather than duplication across SKILL.md files.
Consequence (b): Rewrite Step 2 (already wired this session WITHOUT this layer) needs a retrofit.

### D-19: strategies/ execution profiles wired — Rewrite full, Replatform verify-subset, Upgrade untouched

**Decision (discuss-first 2026-09-12):** wire the orphaned `strategies/` execution-profile layer into the
live skills so build/test/serve/scaffold commands are **grounded in the profile**, not the model's memory.

**Scope (LLM-as-judge — the three skills are not equal consumers):**
- **Rewrite — full.** It authors a new target-stack app: scaffold (`SKELETON`/`LAYOUT`/`RULES`), generate
  (`BUILD`/`TEST_CLUSTER`/`BUILD_UNIT`/`PKG_ADD`), verify (`TEST_ALL`/`COVERAGE`/`SERVE`/`E2E`/`CONFIG`/
  `FITNESS`). Profile resolved at the start of Step 3; two-track resolves backend + frontend.
- **Replatform — verify subset only.** It moves the host, not the code → needs only
  `BUILD`/`TEST_ALL`/`SERVE`/`E2E` at R5 to smoke the app on the new host. Scaffold/cluster tokens belong
  to Rewrite (a `refactor-for-cloud` overlay lets Rewrite own generation). For pure rehost the target app
  token = source stack's token.
- **Upgrade — left as-is.** In-place, same stack, drives a deterministic tool already grounded by
  `tool-matrix.md` + `upgrade-orchestrate.cjs`. Wiring would be noise.

**Implementation:** `scripts/strategy-resolve.cjs` (deterministic, mirrors `upgrade-tool-preflight.cjs`):
exit 0 resolved (STATUS: implemented + full token contract; surfaces `unverified` from ⚠ MATURITY) ·
2 malformed (implemented but missing a required token) · 3 not-implemented (stub) · 4 missing file.
`--tokens=` overrides the required set for the Replatform subset. Honest-refusal: STOP on 2/3/4, NEVER
fall back to another stack. Test: `tests/strategy-resolve.test.cjs` (8/0). Both SKILL.md + both explainers
updated. **Rejected:** wiring all three uniformly (over-engineering — bolts a scaffold contract onto
skills that don't scaffold); inline-prose resolution (not deterministically testable).

---

### D-18: Action 2 REJECTED — migration-ledger-schema.md + executor-seam.md stay at `skills/shared/` root

**Decision (LLM-as-judge, discuss-first 2026-09-12):** do NOT move `migration-ledger-schema.md` or
`executor-seam.md` into `refs/specs/`. Action 2 is dropped.

**Why:** `refs/specs/` is the migration **knowledge tier** (reference material the LLM reads to reason —
golden-master, target-design, integration-verification, options-insight). Action 1 correctly moved
`document-orchestrator.md`/`document-feedback.md` there because they ARE reasoning protocols. But these
two files are **governed substrate**, a different tier:
- `README.md:187` names `migration-ledger-schema.md` a *governed member* alongside `judge.md` +
  `model-routing-spec.md` — additive-only, semver-governed (bump → re-vendor → drift-check → ADR).
- Backed by `scripts/checkpoint-ledger.cjs`; vendored into standalone bundles by `vendor-substrate.cjs`
  and drift-checked in CI by `substrate-drift-check.cjs`, both of which resolve the `skills/shared/` path.
- Moving would reclassify substrate as knowledge, separate them from their governed siblings + backing
  script, and touch ~25 references across 12 files (both CLAUDE.md, plugin.json manifest, README
  governance, all 3 SKILL.md) for **zero functional gain** and real risk of a missed → broken link.

**Consistency argument rejected:** "all migration specs in one folder" conflates two deliberately
separate tiers (knowledge vs governed substrate). The files are correctly placed.

---

### D-P0–D-P4: Replatform-specific wiring decisions

- **D-P0:** feedback loop + option change apply at R1.5; `option-change-spec.md` Scenario 3 needs a
  Replatform posture-boundary note — `refactor-for-cloud` crosses into Rewrite (skill coordination
  decision, not a simple archive-and-reselect).
- **D-P1:** capability decomposition moves INTO option characterization (lighter than Rewrite's full
  DAG — a capability summary + effort estimate per option), because compute choice materially changes
  provisioning complexity (App Service 5 vs AKS 9). Full R2 decompose runs post-option on the selected.
- **D-P2:** executor seam is a SEQUENCE, not a wall. Pre-Write-Gate review of authored IaC/runbooks can
  cascade: revise within R3 · back to R1.5 (design doc update via feedback loop) · option change. The
  executor seam applies only to EXECUTION (post-APPROVE), never to the review phase.
- **D-P3:** PARTIAL integrations — same rule as Rewrite (advisory at options, hard block at APPROVE DESIGN).
- **D-P4:** R5 reference updated to `golden-master-spec.md` (+ its Replatform binding row); keep Inc C marker.

---

### D-11: Stale reference scan information flow

**Decision:** Revision subagent runs Pass 1 (targeted section re-authoring) and Pass 2 (stale reference scan). Returns `{ revised_sections, stale_flags }` to the orchestrator. Orchestrator consolidates outputs from all revision subagents and presents a single review to the developer: delta + stale flags together. Developer corrections to stale content are applied **deterministically** by the orchestrator (targeted text replacement — no LLM, no reinterpretation).

**Why deterministic:** the developer wrote the replacement text. The skill applies it exactly. No risk of misinterpretation or context cost.

---

### D-12: design-revision-spec.md split into three pieces (SRP)

**Decision:** What was conceived as one spec is split into three by responsibility:
1. **`design-revision-spec.md`** — controller/protocol only. Thin. Defines triggers, inputs/outputs of each stage, how stages connect. Does not execute work.
2. **`document-orchestrator-skill`** — orchestration. Wave scheduling, subagent spawning, shared state (Integration Inventory), output collection. Reusable across initial authoring + revision waves + any future multi-document task.
3. **`document-feedback-skill`** — feedback loop logic. Dependency graph traversal, change detection, affected document identification, stale scan rules, convergence rules (depth limit + 5-iteration escalation). Uses the orchestrator for parallel revision waves.

**Why:** SRP — design-revision-spec.md was carrying protocol + orchestration + feedback logic + validation. Four responsibilities, one spec.

**Reusability benefit:** document-orchestrator-skill is reusable across initial authoring, revision, and future multi-document tasks. document-feedback-skill is reusable across any multi-step approval process.

---

### D-10: Feedback loop (design-revision-spec.md) is skill-agnostic — applies to ALL three skills

**Decision:** `design-revision-spec.md` is not specific to Rewrite/Replatform. It governs revision cascades for all three skills' design approval processes.

**Two modes:**
- **Full mode** (Rewrite/Replatform): all 7 documents with their full interdependencies
- **Delta mode** (Upgrade): gap/risk report + delta documents with their interdependencies

**Why:** Any design approval process — whether full documents or deltas — involves a developer who will push back, correct, or add information. Without the feedback loop, they manually chase every implication of their change. With it, they state the change and the skill propagates it. The mechanism is the same; only the dependency graph scope differs.

**Upgrade APPROVE DESIGN:** formal gate for Upgrade too — even delta documents require explicit approval. Single gate covers the full package (gap/risk report + delta documents) after the feedback loop has stabilised the document set.

---

### D-8b: target-design-spec.md does not own change/revision behaviour — the feedback loop does

**Decision:** `target-design-spec.md` defines what documents are authored and what they contain. It does NOT answer "what happens when something changes or new information arrives during design review." That is entirely the feedback loop's (`design-revision-spec.md`) responsibility.

**What this means concretely:**
- New integration discovered during design → feedback loop routes it through `integration-verification-spec.md` first, then cascades
- Developer changes inline decision → feedback loop updates component architecture, integration architecture, security, and feasibility
- Any diagram update → feedback loop owns it, not the initial spec

**What changes in `target-design-spec.md`:** one addition — a short "Revisions during design approval" section pointing to `design-revision-spec.md` as the revision mechanism.

**Why this matters architecturally:** clean single responsibility. target-design-spec.md = initial authoring. design-revision-spec.md = change management. Two specs, one job each.

---

### D-9: Discuss-first rule for every item in the unit of work

**Decision:** No file is built without a prior discuss-first: explain what it does, argue the approach, then build.

**Violations this session (retrospective discussion required):**
- Step 4: `target-design-spec.md` update — built without discussion
- Step 5: `feasibility-spec.md` — built without full discussion

---

## Items pending discussion (in order)

| # | Item | Status |
|---|---|---|
| 1 | Step 4 retrospective: `target-design-spec.md` update — two open points | 🔴 In progress |
| 2 | Step 5 retrospective: `feasibility-spec.md` — two open points | 🔴 Pending |
| 3a | `design-revision-spec.md` — controller/protocol only (split from original scope) | ✅ Discussed and built |
| 3b | `document-orchestrator.md` — D1: graph passed as input (Option C); D2: whole wave fails on any failure; D3: D2 applies to repair too; D4: controller writes log entries | ✅ Discussed and revised |
| 3c | `document-feedback.md` — D-F1: derives graph via document-graph-derive.md; D-F2: Layer 4 moves to orchestrator with sliced sections; D-F3: hard return to APPROVE OPTIONS at iter 10; D-F4: revision_scope/scan_scope; option change → separate item | ✅ Discussed and revised |
| 3d | `document-graph-derive.md` — D-G1: structured declarations (Option B); D-G2: deterministic script; D-G3: cycle detection; D-G4: full graph, orchestrator filters | ✅ Discussed — ready to build |
| — | Move `document-orchestrator.md` + `document-feedback.md` into specs folder (Action 1) | ✅ Done |
| — | Move `migration-ledger-schema.md` + `executor-seam.md` into specs folder (Action 2) | ❌ REJECTED (see D-18) — these are governed substrate, not knowledge tier; do not move |
| 4 | `migration-log-spec.md` — spec structure, event types, rules | 🔴 Not discussed |
| 5 | `rewrite/SKILL.md` — wiring agreed in discussion, not yet built | 🔴 Not built |
| 6 | `replatform/SKILL.md` — not discussed yet | 🔴 Not discussed |
| 7 | `upgrade/SKILL.md` — not discussed yet | 🔴 Not discussed |
| 8 | Tests for all new migration specs (integration-verification, target-design, feasibility, asbuilt-reconciliation, design-revision, migration-log) | 🔴 Not started |
| — | Option change handling design | ✅ Discussed — ready to build `option-change-spec.md` |
| 9 | Update `docs/architecture/rewrite-skill.md` — new design phase, integration verification, feedback loop | ✅ DONE (2026-09-12) — faithful sync to wired SKILL.md; §§1–14; integration-verif (§6), options+DAG+insight (§7), target design + APPROVE DESIGN + feedback (§8), scripts + hard rules refreshed |
| 10 | Update `docs/architecture/replatform-skill.md` — new design phase, integration verification, feedback loop | ✅ DONE (2026-09-12) — faithful sync; §§1–15; R1 integration-verif/oracle/options-insight (§6), R1.5 target design (§7), R2 reads infra doc (§8), executor-seam-is-a-sequence (§9), R5 golden-master (§11) |
| 11 | Update `docs/architecture/upgrade-skill.md` — new design phase, integration verification, feedback loop | ✅ DONE (2026-09-12) — faithful sync; §§1–13; integration-verif inside gap/risk + report IS Document 7 (§7), delta design + APPROVE DESIGN + route-to-Rewrite (§8), self-run oracle (§9) |
| 12 | **De-couple `stacks/` (3) + `strategies/` (6) refs from retired stages** — DISCOVERED by migration-specs.test.cjs | ✅ DONE — investigated role first (strategies ORPHANED-but-valuable; stacks UNDER-WIRED). De-coupled: strategies README + 5 profiles reframed skill-neutral; framework-attribute-tier re-pointed from dead source-inventory-spec.md → golden-master STATIC tier + asbuilt authz check. Test green. |
| 13 | **TRACKED FOLLOW-UP: wire strategies/ execution profiles into live skills** — the investigation found the live skills lack grounded per-stack BUILD/TEST/SERVE (rely on model memory). Wiring the profiles in is a capability addition — needs discuss-first + its own ICEA-style pass. | ✅ DONE (2026-09-12, D-19) — scope: Rewrite full + Replatform verify-subset; Upgrade left as-is (already grounded). Built `scripts/strategy-resolve.cjs` (exit 0/2/3/4) + `tests/strategy-resolve.test.cjs` (8/0). Wired both SKILL.md + explainers. All 5 suites green. |

---

## Open questions (not yet resolved)

| # | Question | Context | Status |
|---|---|---|---|
| OQ-1 | New integration discovered during design review: strict (inventory closed) or return loop? | D-6 | ✅ Resolved — feedback loop routes new information through integration-verification-spec.md first, then cascades |
| OQ-2 | Does Upgrade produce a separate `migration-feasibility.md` or does the gap/risk report apply the feasibility-spec format directly? | Step 5 retrospective | ✅ Resolved — gap/risk report IS the feasibility document for Upgrade. feasibility-spec.md governs its format. No separate artifact. |
| OQ-3 | Integration diagram: inline-as-project integrations invisible or visible with marker? | Step 4 retrospective | ✅ Resolved — show with a different visual marker (dashed border + label) for transparency. Every source integration must be visible with its outcome, not hidden. |
| OQ-4 | APPROVE DESIGN for Upgrade: separate gate or merged with proceed-after-report? | Step 5 retrospective | ✅ Resolved — APPROVE DESIGN is a separate formal gate for Upgrade too. Any change, even delta, requires explicit approval. Single gate covers the full package (gap/risk report + delta documents). |

---

## Rejected approaches (summary)

| Approach | Rejected because |
|---|---|
| Integration verification after options | Options would be presented on unverified data — wrong effort/risk |
| Decomposition as a post-option step | Developer commits to option before seeing its cluster/schedule shape |
| Design documents before options | Speculative — option not yet known |
| One combined target design document | Context window + approval granularity |
| Infrastructure documents for Replatform only | Rewrite introduces cloud dependencies too |
| Re-derive integrations in the design document | Creates two conflicting sources of truth |
