---
name: replatform
description: >
  Hosting/topology migration (on-prem → cloud) — the DIFFERENT-AXIS family member: it moves where an
  application runs, not what language it is written in. The LLM AUTHORS IaC + config + pipeline +
  human-executable runbooks; a HUMAN executes anything touching real infrastructure or data, in any
  environment. Classifies the 6R posture (rehost / replatform / refactor-for-cloud), captures an NFR
  spec as the primary intent, decomposes by cloud capability with the landing zone as Tier-0, and
  proves "done" via NFR assurance (measurability-ceilinged) + Well-Architected + behavioral regression.
  Runs standalone (pure rehost) or overlays Rewrite (refactor-for-cloud) via the shared ledger.
  Triggers on: "replatform", "move to cloud", "lift and shift", "on-prem to Azure/AWS".
---

# Skill: replatform — hosting/topology migration (LLM authors · human executes)

_Skill version: 1.0 · Last changed: 2026-09-08 · Plugin compatibility: ≥3.20.0 · Consent: A_

> Part of the three-skill migration family (Upgrade · Rewrite · Replatform). Design of record:
> `docs/plans/migrationSkill/replatform.md` (R1–R5) + README. ADO-9000 Story 3. Uses the shared
> substrate: `skills/shared/executor-seam.md`, `migration-ledger-schema.md`, `judge.md`, `model-routing-spec.md`.

> ⚠ **Feature Gate + Write Gate** (CLAUDE.md §0): no IaC/config/runbook is written until `APPROVE ADO-{ID}`;
> and NOTHING touching real infra/data is ever executed by the LLM — the human executes (executor seam).

## Guiding principle
> **Readiness IS the deliverable.** Where Rewrite's oracle is behavioral (BAL), Replatform's PRIMARY
> oracle is non-functional — an NFR spec graded against Well-Architected, with a measurability ceiling
> (an NFR you cannot measure caps the assurance it can claim). The LLM authors + rehearses; the human executes.

## Skill shape
- **Locality:** same code (mostly) moved to a new host; NOT a new target folder (that's Rewrite).
- **LLM role:** AUTHOR of IaC + config + pipeline + runbooks. Never an executor of real infra/data.
- **Oracle:** NFR tests + Well-Architected assessment (primary); behavioral regression (secondary).
- **Decomposition unit:** cloud capability (compute · data · identity · messaging · secrets ·
  observability · network), landing zone = Tier-0. **Isolation unit:** IaC state/module (not git worktree).

## Posture (6R) — resolved at intake
| posture | meaning | who owns the code |
|---|---|---|
| `rehost` | IaaS VM, truly minimal change (rare) | Replatform alone (standalone) |
| `replatform` | managed services + identity/config adaptation (common) | Replatform owns the adaptation delta |
| `refactor-for-cloud` | containerize / serverless / split services | **Rewrite** does the code; Replatform **OVERLAYS** the host via the shared ledger |

## Persona
[SA] Rafael Mendes (intake · posture · decomposition · NFR spec) → [SE] Elena Fischer (IaC + runbook
authoring) → [QA] Sam Okonkwo (NFR assurance + reconciliation gates). Never name the persona in output.
See `skills/shared/personas-spec.md`.

## Model routing
- IaC / config / pipeline authoring: `${INFRA_MODEL:-claude-sonnet-4-6}` (per R5).
- Options / NFR spec / decomposition: `${ICEA_MODEL:-claude-opus-4-8}`.
- Every gate: shared judge ladder — `${CRITIC_MODEL:-claude-sonnet-4-6}` → `${CRITIC_MODEL_MAX:-claude-opus-4-8}`
  for high-risk / B-series → different-family panel for top-risk. See `skills/shared/judge.md`.

## Resolve PLUGIN_DIR — before any step
```
Read .claude/plugin-path.txt → PLUGIN_DIR
(if absent: §1a resolver from $PLUGIN_DIR/skills/shared/plugin-path-resolution.md)
```

## Stage flow
```
Detect source runtime topology
  → R1 Intake: 6R posture + integration verification + oracle mode + TCO options + NFR spec + feasibility
     options presented per options-insight-spec.md (basis · comparative insight · web-grounded · triggered judge)
     APPROVE OPTIONS
  → R1.5 Target design documents (design-revision-spec.md → document-orchestrator.md)
     feedback loop (document-feedback.md · option-change-spec.md) → APPROVE DESIGN
  → R2 Decompose by cloud capability (landing zone = Tier-0 first; reads target-infrastructure-architecture)
  → R3 Author IaC + config + pipeline + runbooks (design-quality + judge + security scan; author-only)
     pre-Write-Gate review may cascade: revise in R3 · back to R1.5 (design update) · option change
  → R4 HUMAN executes runbooks: migration → reconciliation gate → cutover → rollback (LLM monitors)
  → R5 NFR assurance (measurability-ceilinged) + Well-Architected + behavioral regression (golden-master-spec.md)
  → every gate: shared judge verdict; checkpoint to the SHARED ledger (payload.replatform)
  → migration log: follow migration-log-spec.md at each phase
```

## Step R1 — Intake, posture, integration verification, NFR spec, options (implemented — AC-F7; extended)
1. Detect the source runtime topology (do NOT re-implement detection):
   ```bash
   node "$PLUGIN_DIR/scripts/migration-source-detect.cjs" --roots=<source> --json
   ```
2. Classify the **6R posture** (table above). `refactor-for-cloud` → **OVERLAY**: Rewrite generates the
   code, Replatform provisions the host; hand off via the shared ledger (`payload.rewrite` ↔
   `payload.replatform`). Pure rehost → standalone.
3. **Integration verification** — per `integration-verification-spec.md`. The source app's on-prem
   integrations change materially in a cloud move (NTLM → managed identity, on-prem SQL → Azure SQL
   private endpoint, WCF → REST/CoreWCF). Produce the **Integration Inventory** before options — it
   feeds the infrastructure/security design documents and the TCO estimate (integration rework is a
   significant cost driver). Tier 2 via `additionalDirectories` where the service source is available.
   Write `[INTEGRATION]` migration log entries.
4. **Oracle mode detection** — per `golden-master-spec.md` Step 1. The source is a running on-prem app,
   so `provided-url` is the natural default. Record in `decision_log.golden_master` — feeds R5 behavioral
   regression (the intent record persists in the ledger through to R5).
4b. **Source-context intake gate** — per `$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/source-context-intake-spec.md`.
   Author the **Source Context Manifest** (`docs/migrations/{ADO}/source-context-manifest.md`) from the
   source's docs + code (cross-cutting scan = infra-relevant; Tier-2 for integrations; **source coverage =
   full accounting** — every `graph.json` module `mapped`/`out-of-scope`), then verify:
   ```bash
   node "$PLUGIN_DIR/scripts/intake-verify.cjs" verify --manifest=docs/migrations/{ADO}/source-context-manifest.md \
     --skill=replatform --inventory=docs/.../integration-inventory.md --json
   ```
   Exit 0 → record `stage_gates.intake_context=PASS` + `core.source_context`. Exit 2–8 → **STOP** and
   resolve. Options must not be presented until this is PASS.
5. Ask the **intake questions** (NEVER assume — these differ per engagement):
   - target cloud (Azure / AWS / GCP)
   - target **CI/CD platform** for the AUTHORED deployment pipeline (Azure DevOps / GitHub Actions / GitLab)
   - **IaC flavor** (Bicep / Terraform / ARM / Pulumi)
   - environment progression (dev → staging → prod)
   - **regulated?** data-residency / PII / financial constraints (hard-block NFRs)
   Record them → they flow into `replatform-plan.cjs plan --cicd-platform=<> --iac-flavor=<>` and the ledger.
6. Capture the **NFR spec** as the PRIMARY intent — see `references/nfr-spec.md`.
7. Present cloud-target **OPTIONS** (IaaS VM / App Service / AKS / Container Apps / Functions) per
   **`options-insight-spec.md`**:
   - Each option carries a **capability summary** (count + list + estimated IaC/runbook effort) — compute
     choice materially changes provisioning complexity (App Service ~5 vs AKS ~9 capabilities).
   - Every attribute carries a **basis** (`computed` | `web-grounded:{date}` | `published-spec` |
     `estimate:{source}` | `requires:{who}`) — never a confidence tier.
   - **Comparative insight** per decision-critical attribute (capability delta, TCO, NFR fit) — the
     "why A and not B" reasoning. Volatile cloud facts web-grounded through the cache (VERIFIED/INFERRED,
     dated); suggest the web search before running it; offline → `refs/` INFERRED tier.
   - **Triggered judge pass** on the option synthesis when options are a close call or the developer asks.
   - `requires:` on compliance / NFR-floor / security → named human before `APPROVE OPTIONS`.
   - PARTIAL integration rows: advisory here, **hard block at APPROVE DESIGN** (R1.5).
   Feasibility gated GREEN/YELLOW/RED (`feasibility-spec.md`); hard blocker → STOP or hybrid.
   `APPROVE OPTIONS` → write `[OPTION]` + `[DECISION]` log entries.

## Step R1.5 — Target design documents (new)
Runs after `APPROVE OPTIONS`, before R2 capability decomposition (R2 reads the infrastructure
architecture document). The Replatform document mix: infrastructure + deployment are the **primary**
deliverables; component-arch is **delta only** (same code, minimal structural change).

1. **Derive the dependency graph:** `graph-derive-documents.cjs` (exit 1 cycle / exit 2 parse → fix first).
2. **Author the design documents** via `document-orchestrator.md` (wave-scheduled parallel subagents;
   Integration Inventory + NFR spec as shared state).
3. **Feedback loop** via `design-revision-spec.md`: corrections → `document-feedback.md`; option changes
   → `option-change-spec.md` (note the `refactor-for-cloud` posture-boundary case — crosses into Rewrite).
4. **APPROVE DESIGN** — all required documents `APPROVED`, no PARTIAL/UNVERIFIED integration rows remain.
   Records `payload.replatform.gate_verdicts.design_approved = true`. Write `[DECISION]` + `[REVISION]` logs.

## Step R2 — Cloud-capability decomposition (implemented — AC-F7)
Decompose by cloud capability with the **landing zone as Tier-0** — see
`references/cloud-capability-decomposition.md`. **Reads the approved `target-infrastructure-architecture.md`**
(from R1.5) as the source of truth for which capabilities exist — R2 organises them into a provisioning
order; it does not re-derive them. The mapping is **grounded** (static table = offline-fallback
INFERRED; concrete service pick web-grounded → VERIFIED).

**Intake gate precondition (fail-closed).** Before decomposing, confirm the intake gate is PASS —
`plan` must not run on unread source:
```bash
node "$PLUGIN_DIR/scripts/intake-verify.cjs" check-gate --ado={ADO} --json   # non-zero → STOP, finish R1
```
```bash
node "$PLUGIN_DIR/scripts/replatform-plan.cjs" plan --target=<cloud> \
  --capabilities=<compute,data,...> --cicd-platform=<> --iac-flavor=<> --json
```
The landing zone is provisioned first and inherited by every capability; independent capabilities
parallelize after it. Isolation unit = IaC state/module.

## Step R3 — Author IaC + config + pipeline + runbooks (implemented — AC-F7)
IaC is BOTH generated code AND a destructive action → two safety layers (R5 of the design):
1. **Author-time quality:** Write Gate before write · design-quality (SRMT) · shared judge (separate
   model) · security/policy scan (tfsec / checkov + policy-as-code) — reuse `security-review`. Via `INFRA_MODEL`.
2. **Author the four runbooks** — see `references/runbooks.md` — migration · reconciliation · cutover ·
   rollback. NEW target-specific artifacts (not the source's), rehearsed in non-prod, each step carrying
   the 5-point transparency + a PASS/FAIL gate.

**The executor seam is a sequence, not a wall.** The developer REVIEWS the authored IaC/runbooks
BEFORE the Write Gate. That review may cascade upstream — the seam applies only to *execution*
(post-APPROVE), never to the review phase:
- IaC detail doesn't fit → revise within R3
- IaC authoring reveals a design gap (e.g. needs a private endpoint not in the design) → return to
  **R1.5**, update `target-infrastructure-architecture.md` via the feedback loop, re-author the IaC
- IaC complexity reveals the option was wrong (e.g. App Service can't support required VNet integration)
  → **option change** (`option-change-spec.md`)

Only after `APPROVE` (Write Gate) does the executor seam apply — real actions denied while the flag is OFF:
```bash
node "$PLUGIN_DIR/scripts/replatform-plan.cjs" execute --action=apply --json   # denied (flag OFF) — executor-seam.md
```

## Step R4 — Human executes (implemented — AC-F7)
The LLM authors + rehearses; the HUMAN executes anything touching real infra/data, in ANY environment.
Sequence: migration → **reconciliation gate** → cutover → rollback. The gate is mandatory pre-cutover;
regulated/PII/financial require a FULL pass:
```bash
node "$PLUGIN_DIR/scripts/replatform-plan.cjs" reconcile-gate --steps-total=<N> --steps-passing=<M> --json
```
Cutover blocked (exit 15) on any failing step — the runbook shows the failing PASS/FAIL step; a human
decides. The real prod cutover is the Nth rehearsal, human-executed, LLM monitoring reconciliation + smoke + NFR.

## Step R5 — NFR assurance + Well-Architected + behavioral regression (implemented — AC-F8)
Runs **after R4** (the human-executed cutover — the target is now deployed). This is where "done" is
*proven, not asserted* — Replatform's PRIMARY oracle is non-functional. The LLM/human runs the drills;
the deterministic engines grade (the LLM never talks an assurance level up).

**1. NFR assurance (primary).** For each NFR in the R1 spec (`references/nfr-spec.md`), gather its
evidence — the measurability tag, what was actually done (evidence grade), and the load-profile
(`real` / `synthetic` / `none`, the oracle analog) — then grade + gate per `references/nfr-assurance.md`:
```bash
node "$PLUGIN_DIR/scripts/replatform-nfr-assess.cjs" assess --nfr=<name> \
  --measurability=<testable|auditable|projected> \
  --evidence=<measured|drilled-partial|projected|modeled-only> \
  --load-profile=<real|synthetic|none> --json
node "$PLUGIN_DIR/scripts/replatform-nfr-assess.cjs" gate --assurance=<from assess> \
  --floor=<measured|drilled-partial|projected> --regulated=<true|false> --json
```
Assurance is weakest-link (measurability ceiling · evidence · load-profile); when `ceiling_flagged`,
**state the ceiling** — never report a capped NFR as fully measured. `gate` exit **16** = a **regulated**
NFR below floor is a **HARD BLOCK** (named approver + written reason; no silent pass); non-regulated
below floor is a warn.

**2. Well-Architected (secondary).** Run the `app-readiness` skill against the TARGET and assemble the
WAF posture per `references/well-architected.md` — **reuse** its 8-domain ERL output + the NFR-measurable
pillars from step 1; never re-grade a pillar by hand, never double-count.

**3. Behavioral regression (secondary).** Reuse the golden-master as a pre-move → post-move smoke
("still works after the move") per `golden-master-spec.md` (Replatform binding row — oracle mode was
detected at R1). To build/smoke the (unchanged) app on the new host, resolve the execution profile for
the **verify subset only**:
```bash
node "$PLUGIN_DIR/scripts/strategy-resolve.cjs" --target=<app-stack-token> \
  --tokens=BUILD,TEST_ALL,SERVE,E2E --json
```
Replatform moves the host, not the code, so it needs `BUILD`/`TEST_ALL`/`SERVE`/`E2E`, never the
scaffold/cluster tokens (those belong to Rewrite; a `refactor-for-cloud` overlay lets Rewrite own
generation). For a pure rehost/replatform the target app token is the source stack's own token (the code
is the same). Exit 0 → use those for the post-cutover build + smoke + golden-master replay; exit 2/3/4 →
STOP (never fall back to another stack); `unverified:true` → warn the developer. Subset by design — do
NOT require the full contract here.

**4. Two-gate "done" + checkpoint.** "Done" = NFR measured-met (or projected + explicitly accepted for an
unmeasurable NFR) **+** a Well-Architected posture **+** behavioral regression passes; regulated NFRs
hard-block (step 1). Record the result to the shared ledger `payload.replatform.NFR` and each gate's
independent judge verdict (`$PLUGIN_DIR/skills/shared/judge.md`) via `checkpoint-ledger.cjs`
`set-gate` / `set-payload`. Write `[DECISION]` migration log entries per `migration-log-spec.md`.

## Hard Rules
- NEVER present options before the **source-context intake gate** is PASS (`intake-verify.cjs`) — `plan`
  (R2) calls `check-gate` and STOPs otherwise. The Source Context Manifest must fully account for every
  `graph.json` module (full accounting; "unchanged" is a cited disposition, never omission).
- NEVER accept `PARTIAL`/`unknown` when the resolving source is reachable in a configured root —
  resolve it at intake (exit 5), never defer.
- NEVER present options before the Integration Inventory is complete — integration rework is a major
  cloud-cost driver; options built on unverified integrations mislead the TCO decision.
- NEVER author IaC (R3) before `APPROVE DESIGN` (R1.5) — the design documents are the intent baseline.
- The executor seam applies to EXECUTION only — the pre-Write-Gate review may cascade to a design
  update (R1.5) or an option change; that is not an executor-seam violation.
- The LLM **AUTHORS**; the HUMAN **EXECUTES** — anything touching real infra/data, in ANY environment
  (even dev). The planner is decision-only (`applied:false`); the executor seam denies real actions with the flag OFF.
- **prod + regulated are PERMANENTLY human-executed**, even if the future-autonomy flag is ever ON.
- NEVER assume target cloud / CI-CD platform / IaC flavor — ask at intake; record them in the ledger.
- **Landing zone is Tier-0** — provisioned first, inherited by every capability; never parallelized ahead of it.
- Runbooks are NEW target-specific artifacts (never the source's), rehearsed with a **TESTED rollback**
  before the real cutover ("an untested rollback is not a rollback").
- Reconciliation is a mandatory pre-cutover gate; regulated/PII/financial require a full pass (hard-block).
- **Ground** the capability mapping (offline table = INFERRED fallback; concrete pick web-grounded → VERIFIED).
- To build/smoke the app on the new host (R5), resolve the execution profile for the **verify subset
  only** (`--tokens=BUILD,TEST_ALL,SERVE,E2E`) — NEVER require the scaffold/cluster tokens (those are
  Rewrite's). STOP on exit 2/3/4; never fall back to another stack; warn when `unverified:true`.
- R5 proves "done" with the DETERMINISTIC engines — `replatform-nfr-assess.cjs assess` + `gate` per NFR;
  a **regulated** NFR below floor is a **HARD BLOCK** (exit 16; named approver + written reason, no silent
  pass). NEVER report a `ceiling_flagged` NFR as fully measured. Well-Architected + behavioral regression
  REUSE existing outputs (`app-readiness` ERL, golden-master) — never re-grade a pillar by hand.
- `refactor-for-cloud` **OVERLAYS** Rewrite via the shared ledger — Replatform never redesigns application code.
- ALWAYS invoke plugin scripts via the resolved `$PLUGIN_DIR`; record posture/options/NFR/decomposition in the ledger.
