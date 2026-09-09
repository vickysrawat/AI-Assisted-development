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
  → R1 Intake: 6R posture + code-change surface + TCO options + NFR spec + feasibility (GREEN/YELLOW/RED)  ← implemented
  → R2 Decompose by cloud capability (landing zone = Tier-0 first)                                          ← implemented
  → R3 Author IaC + config + pipeline + runbooks (design-quality + judge + security scan; author-only)      ← implemented
  → R4 HUMAN executes runbooks: migration → reconciliation gate → cutover → rollback (LLM monitors)          ← implemented
  → R5 NFR assurance (measurability-ceilinged) + Well-Architected + behavioral regression                   ← Inc C
  → every gate: shared judge verdict; checkpoint to the SHARED ledger (payload.replatform)                   ← Inc C/E
```

## Step R1 — Intake, posture, NFR spec (implemented — AC-F7)
1. Detect the source runtime topology (do NOT re-implement detection):
   ```bash
   node "$PLUGIN_DIR/scripts/migration-source-detect.cjs" --roots=<source> --json
   ```
2. Classify the **6R posture** (table above). `refactor-for-cloud` → **OVERLAY**: Rewrite generates the
   code, Replatform provisions the host; hand off via the shared ledger (`payload.rewrite` ↔
   `payload.replatform`). Pure rehost → standalone.
3. Ask the **intake questions** (NEVER assume — these differ per engagement):
   - target cloud (Azure / AWS / GCP)
   - target **CI/CD platform** for the AUTHORED deployment pipeline (Azure DevOps / GitHub Actions / GitLab)
   - **IaC flavor** (Bicep / Terraform / ARM / Pulumi)
   - environment progression (dev → staging → prod)
   - **regulated?** data-residency / PII / financial constraints (hard-block NFRs)
   Record them → they flow into `replatform-plan.cjs plan --cicd-platform=<> --iac-flavor=<>` and the ledger.
4. Capture the **NFR spec** as the PRIMARY intent — see `references/nfr-spec.md`.
5. Present cloud-target **OPTIONS** (IaaS VM / App Service / AKS / Container Apps / Functions) with
   pros/cons + web-grounded, dated **TCO** + NFR fit + effort (cost is often the primary driver) — same
   options+BYO engine as Rewrite. Feasibility gated GREEN/YELLOW/RED (see
   `skills/shared/migration-knowledge/refs/specs/feasibility-spec.md`); hard blocker → STOP or hybrid.

## Step R2 — Cloud-capability decomposition (implemented — AC-F7)
Decompose by cloud capability with the **landing zone as Tier-0** — see
`references/cloud-capability-decomposition.md`. The mapping is **grounded** (static table = offline-fallback
INFERRED; concrete service pick web-grounded → VERIFIED).
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
The executor seam keeps this author-only:
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

## Step R5 — NFR assurance + Well-Architected + behavioral regression (Inc C)
Deferred to Inc C (AC-F8): NFR assurance (measurability ceiling, symmetric to BAL) + Well-Architected
grade (reuse app-readiness/ERL) + behavioral regression (reuse golden-master) → two-gate; regulated NFRs
hard-block.

## Hard Rules
- The LLM **AUTHORS**; the HUMAN **EXECUTES** — anything touching real infra/data, in ANY environment
  (even dev). The planner is decision-only (`applied:false`); the executor seam denies real actions with the flag OFF.
- **prod + regulated are PERMANENTLY human-executed**, even if the future-autonomy flag is ever ON.
- NEVER assume target cloud / CI-CD platform / IaC flavor — ask at intake; record them in the ledger.
- **Landing zone is Tier-0** — provisioned first, inherited by every capability; never parallelized ahead of it.
- Runbooks are NEW target-specific artifacts (never the source's), rehearsed with a **TESTED rollback**
  before the real cutover ("an untested rollback is not a rollback").
- Reconciliation is a mandatory pre-cutover gate; regulated/PII/financial require a full pass (hard-block).
- **Ground** the capability mapping (offline table = INFERRED fallback; concrete pick web-grounded → VERIFIED).
- `refactor-for-cloud` **OVERLAYS** Rewrite via the shared ledger — Replatform never redesigns application code.
- ALWAYS invoke plugin scripts via the resolved `$PLUGIN_DIR`; record posture/options/NFR/decomposition in the ledger.
