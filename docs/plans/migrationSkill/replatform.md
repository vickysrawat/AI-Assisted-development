# Plan — Replatform Skill (hosting/topology axis: on-prem → cloud)

# Status - In design (R1–R5 all settled — Replatform fully designed)

> Run this in the **plugin repository** (ai-assisted-development). Part of the three-skill family — see
> [README.md](README.md). Sibling skills: Upgrade, Rewrite.
> The **different-axis** skill — hosting/topology, not code translation.

---

## RESUME POINT

- ✅ **R1** Intake / overlay-vs-standalone — settled
- ✅ **R2** Cloud-capability decomposition — settled
- ✅ **R3** NFR / Well-Architected oracle — settled
- ✅ **R4** Data migration & cutover — settled
- ✅ **R5** IaC output & execution safety — settled

**Replatform is fully designed.** Uniform family safety principle: **the LLM authors, the human executes**
anything that touches real infrastructure or data, in any environment.

---

## Context — the core inversion vs Rewrite

Replatform moves an application's **hosting/topology** (on-prem → cloud). Code often barely changes, so the
assurance model **inverts**:

| | Rewrite | Replatform |
|---|---|---|
| Primary axis | **BAL** (behavioral) | **NFR / Well-Architected** (readiness *is* the deliverable) |
| Secondary axis | ERL (readiness) | behavioral parity ("still works after the move") |
| Output | application source | **IaC + config + pipeline + networking** |
| Decomposition | source-derived clusters | **cloud capabilities** (compute · data · identity · messaging · secrets · observability · network) |
| Oracle | running source / inventory | **NFR tests + Well-Architected assessment** |
| Scariest part | inventory completeness | **live data migration + cutover** (no analog) |

ERL (Rewrite) was the warm-up: Well-Architected's pillars overlap ERL's 8 domains, reused here as the
**primary** axis.

---

## R1 — Intake / overlay-vs-standalone *(settled)*

**"Pure rehost" is usually a myth.** Almost every on-prem→cloud move drags a code delta: Windows-auth →
Entra ID, connection-strings/secrets → Key Vault, file-shares → Blob, MSMQ → Service Bus, Task Scheduler →
Timer Functions. So intake's #1 job is to **surface the real code-change surface + real cost** — the
replatform analog of Rewrite's false-upgrade guard (resist "just move it"; prevent mid-flight surprises).

**Classification — the cloud-nativeness / "6 Rs" spectrum:**

| Posture | Meaning | Who does the code |
|---|---|---|
| **Rehost** | IaaS VM, truly minimal change (rare) | Replatform alone |
| **Replatform** | managed services + identity/config adaptation (common) | **Replatform owns the adaptation delta** |
| **Refactor-for-cloud** | containerize / serverless / split services | **Rewrite** does the code; Replatform overlays the host |

**Boundary (D-R1b)** — mirrors the Upgrade↔Rewrite line:
- **Replatform owns infrastructure-coupled code** — connection strings, identity wiring, cloud-SDK swaps
  (file→Blob, MSMQ→Service Bus), config/secrets — inseparable from the host move, mostly mechanical, gated
  like Upgrade's residual.
- **Rewrite owns application redesign** — restructuring/splitting/cloud-native re-architecture. Under
  *refactor-for-cloud*, Replatform **overlays** via the shared-ledger hand-off (Rewrite generates code,
  Replatform provisions host + IaC). Pure-rehost-standalone is the rare case.

**Intake produces (reusing substrate):**
- **Cloud target = options analysis** (IaaS VM / App Service / AKS / Container Apps / Functions) with
  pros/cons + **TCO** (run-cost web-grounding) + NFR fit + effort — **cost is often the primary driver** —
  same options+BYO engine as Rewrite.
- **NFR/readiness spec as the *primary* "defined intent"** (axis-flip): SLAs, RTO/RPO, cost budget,
  compliance/data-residency.
- **Feasibility blockers** gated GREEN/YELLOW/RED (cloud-incompatible deps — dongles, on-prem-only licenses,
  legacy protocols; data-residency limits). Hard blocker → STOP or hybrid architecture.

---

## R2 — Cloud-capability decomposition *(settled)*

The infrastructure transpose of Rewrite's T3.
- **(D-R2a) Unit = cloud capability** (compute · data · identity · messaging · secrets · observability ·
  networking), derived from source **runtime topology** via an **infra-mapping reference** (IIS→compute,
  SQL Server→data, file shares→Blob, MSMQ→Service Bus, Windows-auth→Entra ID, Task Scheduler→Timer Fns),
  grounded through the migration-knowledge cache. Mapping is **option-driven, not 1:1** (decided in R1) and
  allows **consolidation**.
- **(D-R2b) Landing zone = infra SharedKernel / Tier-0** (subscription structure, networking/VNet, identity,
  policy/governance, security baseline, observability) — provisioned first, inherited by all capabilities.
- **(D-R2c)** reuse the **declared DAG + dependency-driven scheduling**; independent capabilities parallel
  after the landing zone; per-capability feasibility gating. **Isolation unit = IaC state/module** (Terraform
  state / workspaces), *not* git worktree.

## R3 — NFR / Well-Architected oracle *(settled)*

Replaces golden-master as the **primary** oracle. "Correct" = NFR targets met in the new env + a
Well-Architected posture. Three NFR verification kinds: **testable** (latency/throughput=load test;
availability/failover=chaos drill; RTO/RPO=DR drill), **auditable** (data-residency/compliance=config audit),
**projected-then-measured** (cost).

**Symmetric to BAL — a measurability honesty ceiling:**

| NFR-assurance | Reached when |
|---|---|
| **Measured** | realistic load test + failover/DR drills executed |
| **Drilled-partial** | some drills, synthetic load only |
| **Projected** | modeled from design, not exercised |
| **Modeled-only** | no load profile available |

The **load profile** is the analog of the golden-master oracle (source's actual traffic if measurable, else
synthetic → assurance drops). Report is honest measured-vs-projected, weakest-link.

**"Done" (three gates):** NFR measured-met (or **projected + explicitly accepted** for unmeasurable) **+**
Well-Architected grade (**reuse ERL/app-readiness** — WAF pillars overlap the 8 domains) **+** behavioral
**regression** passes (**reuse golden-master** as a secondary pre-move→post-move smoke). Same two-gate +
hybrid + friction-proportional model; **compliance/regulated NFRs (data-residency, financial RTO) hard-block.**
Staged/shift-left: projected@design → measured@post-deploy → validated (can move → remediate/escalate).

**Reused patterns:** LLM **orchestrates** cloud assessment + load-test tools (Azure Advisor, cost APIs,
k6/JMeter) — measured, not eyeballed (Upgrade's tool-orchestration pattern). **Cost has a long tail**
(projected TCO → early-measured → steady-state) → flagged **provisional until steady-state**; FinOps
right-sizing post-deploy.

## R4 — Data migration & cutover *(settled)*

Highest-consequence work in the family (moves **live** prod data + switches live traffic).

**Hard line (D-R4a):** the LLM **plans, generates, rehearses (in non-prod), reconciles, and produces tested
runbooks** — the **production cutover is human-executed + human-approved** (LLM assists/monitors, never pulls
the trigger). Hands to the **go-live / operations** runbook surface. No blanket approval, ever.

**Deliverable = human-executable RUNBOOKS** (migration · reconciliation · cutover · rollback). Each step
carries the `project-rules.md` **5-point transparency** (what it does · touches · does NOT do · exact
commands · how to verify) **+ an explicit PASS/FAIL gate.** LLM authors + rehearses; human executes; LLM
monitors vs gates.

**Cutover strategy = options (D-R4b):**

| Strategy | Risk | Complexity | Rollback |
|---|---|---|---|
| Big-bang | high | low | restore source; loses new writes unless cut during freeze |
| Phased / incremental | medium | medium (dual-run) | reverse per-stage; needs reversible sync |
| Strangler / parallel-run | low | high (dual-write, conflict, drift) | shift traffic back; sync reversible |

Scored on downtime · volume · criticality · rollback-ability; developer decides.

**Data reconciliation = "BAL for data" (D-R4c)** — strategy **options**, **tiered per table**:

| Strategy | Catches | Best for |
|---|---|---|
| Row-count / aggregates | gross loss | first-pass, any table |
| Checksum / hash | value corruption | medium tables (value fidelity) |
| Full row-by-row | everything | small **critical** tables |
| Statistical sampling | probable corruption (confidence %) | huge, lower-criticality |
| Business-rule / invariant | semantic (balances sum, FK integrity, report totals) | financial/regulated |

Mandatory **pre-cutover gate**; regulated/PII/financial **hard-block**. **Gotcha:** cross-engine checksums
are treacherous (collation/type/encoding/float differences make identical data hash differently) → the
runbook must **normalize before hashing** or use **representation-independent business invariants**.

**Rehearsal lifecycle (D-R4d):** dry-run migration + cutover + **tested rollback** in non-prod with prod-like
data (**masked/synthetic for PII**), multiple times. **An untested rollback is not a rollback.** The real
prod cutover is the **Nth rehearsal**, human-executed, with the LLM monitoring reconciliation + behavioral
smoke (R3 secondary) + NFR measurement (R3).

## R5 — IaC output & execution safety *(settled)*

Two safety layers, because IaC is both generated code and a destructive action.

**Layer 1 — author-time quality (IaC is generated code):** Write Gate before write · Design-Quality ·
LLM-as-judge (separate model) · **security/policy scanning** (`tfsec`/`checkov` + policy-as-code:
Azure Policy / OPA / Sentinel, reuse `security-review`); routed via the existing **`INFRA_MODEL`** tier.

**Layer 2 — execution safety:** plan/what-if before apply showing **diff + cost delta** (Infracost-style,
ties R3 cost NFR + R1 TCO) · env progression dev→staging→prod · policy-as-code guardrails pre-apply ·
**state is critical infra** (remote backend, locking, backup) · rollback = re-apply previous git-versioned
known-good IaC · prod destroy guarded · post-apply **drift detection** → reconcile.

**The uniform family safety principle (D-R5c, developer-hardened):**
> **The LLM authors; the human executes** — anything that touches real infrastructure or data, in **any**
> environment (not even dev). The LLM produces IaC + gated pipeline + apply/rollback **runbooks**; humans
> execute. Apply-failure loop is **human-mediated** (fail → human feeds output back → LLM revises → human
> re-executes).

**Future-autonomy seam (feature flag, default OFF):** the *execute* step is abstracted behind an
**executor interface**. Default = **manual/human-handoff executor**. A feature flag can later swap in an
**autonomous executor** *without re-architecting*. When eventually enabled it is **not all-or-nothing** — it
**graduates by risk tier** (low-risk/non-prod first; prod + regulated stay human), and remains **off by
default, opt-in, per-environment + per-risk-tier**, with **cost caps, blast-radius limits, policy-as-code,
a kill-switch, and full audit**.
