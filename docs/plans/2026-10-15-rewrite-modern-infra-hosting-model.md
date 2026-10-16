# Plan — Rewrite Skill: Modern Infrastructure via Hosting Model

> **Status:** 📋 Approved approach — pending implementation (SKILL.md changes)
> **Scope:** `skills/rewrite/SKILL.md` — 4 targeted changes, no new scripts.
> **Author context:** AI-architect review session, 2026-10-15.

---

## Problem

The rewrite skill's Options phase presents choices based on code translation approach only
(posture, cluster count, BAL ceiling, effort, TCO). Infrastructure decisions for modern
cloud-native targets — Docker, Kubernetes, Service Bus, Liquibase, pipelines, networking —
are deferred entirely to design documents that currently describe on-premises infrastructure
(IIS config, app pool identity, Windows networking).

A developer selecting a rewrite option has no view of the infrastructure implications of
that option, and the design documents (`target-infrastructure-architecture.md`,
`target-deployment-architecture.md`) produce on-prem output even when the target is K8s.

---

## What was considered and rejected

### Approach A — Infrastructure Footprint table inside every option block (rejected)

Added a full cloud-native infra table (K8s workload types, Service Bus topology, Liquibase,
CI/CD pipeline) to each option in the Step 2 Options template.

**Why rejected:**
- Infrastructure topology does not vary by option — all K8s options use the same infra model.
  Repeating an identical table three times does not help the developer choose between options.
- Created a circular dependency: the pipeline section was identical across all options (critical bug C-3).
- Required `document-orchestrator.md` co-changes to wire `infra_signals` into doc 5/6 subagents.
- Added an LLM-only signal scan (no script) — inconsistent with the skill's mechanically-verify ethos.
- Architectural review found 4 critical + 8 major gaps — the design was fighting back.

**Root cause of the wrong approach:** Infrastructure is a *design decision*, not an *options
differentiator*. It belongs in design documents (Step 2.5), not in the options selection (Step 2).
The single decision that belongs in options is: what is the target hosting model?

---

## Correct approach — 4 changes

Infrastructure enters the skill at the right point: one mandatory question at options selection,
two hard-blocker flags at source scan, and expanded design-doc content specs that produce
cloud-native output when K8s or PaaS is selected.

### Change 1 — Step 1: Light blocker scan (Grep-based, 2 signals only)

**Why here:** Hard constraints that affect all options must be surfaced before the developer
reads the options, not discovered mid-design.

**What it does:** Two Grep calls on the source roots. Results stored as boolean checkpoint payload.
No LLM inference — mechanical pattern matching only.

| Signal | Grep patterns | Constraint when true |
|---|---|---|
| Windows Auth | `WindowsAuthentication`, `NTLMAuthentication`, `AuthenticationSchemes.Ntlm`, `UseWindowsAuthentication`, `Negotiate`, `IntegratedSecurity=true` | Cannot run in Linux container; all K8s/PaaS options must name a replacement auth scheme |
| Local file I/O | `File.WriteAllText`, `StreamWriter`, `FileStream`, `open(` with write mode, `fs.writeFileSync`, `fs.createWriteStream`, `Files.write` | Refactor candidate; cloud-native prefers object store (Azure Blob / S3) |

Checkpoint keys added: `windows_auth_detected` (bool), `file_io_detected` (bool).

If `windows_auth_detected=true`: write `[FINDING]` to migration-log.md immediately.

**What it does NOT do:** Does not scan for messaging, database, cache, or config signals
(those do not affect option selection; they feed the design documents via the data architecture
and integration architecture docs which already exist).

---

### Change 2 — Step 2 pre-design questions: explicit hosting model question

**Why here:** The options file already requires "keep-vs-redesign + hosting model" as minimum
pre-design questions (line 916–918) but the hosting model is vague — no defined choices, not
stored in the checkpoint, not available to design doc subagents.

**What it adds:**
- Q2 becomes explicit with three named choices: `K8s` | `PaaS` | `on-prem`
- Q3 is conditional: only appears when `windows_auth_detected=true`, requires a named
  replacement auth scheme before the design gate can proceed

**What it does NOT change:** The options table structure, the DAG, cluster count, BAL ceiling,
effort, TCO — none of these change. Hosting is a pre-design question, not an option row.

**Pre-design questions block (replacement for lines 916–918):**

```
These answers must accompany `APPROVE OPTIONS` — design documents cannot be authored without them.

**Q1 (mandatory) — Architecture posture:** retain the source application's architecture patterns,
or redesign idiomatically for the target stack? (keep-vs-redesign)

**Q2 (mandatory) — Target hosting model:**
- `K8s` — Azure Kubernetes Service: containerised workloads, Helm-deployed, cloud-native runtime
- `PaaS` — Azure App Service / Azure Functions / Azure Spring Apps: managed runtime, no container orchestration
- `on-prem` — Windows Server / IIS / bare-metal: traditional deployment

**Q3 (conditional — include only if `windows_auth_detected=true`):** What is the replacement
auth scheme? Must name a concrete scheme (MSAL / OIDC / Azure AD / custom identity) — "TBD"
is not accepted. Required before design documents can be authored for K8s or PaaS targets.

{Add any further questions surfaced by PARTIAL integration rows.}
```

---

### Change 3 — Step 2 APPROVE OPTIONS checkpoint flush: store hosting_model

**Why here:** `hosting_model` must be in the checkpoint so that doc 5 and doc 6 subagents
(spawned at Step 2.5) receive it without re-reading the options file.

Adds two `set-payload` calls after the existing option/DAG/label writes:

```bash
# Store hosting model — design doc subagents read this to determine which sections to produce
node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado={ADO} --key=hosting_model --value={K8s|PaaS|on-prem}
# If windows_auth_detected=true, record the developer-provided replacement scheme
node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado={ADO} --key=replacement_auth_scheme --value="{scheme or none}"
```

---

### Change 4 — Step 2.5 design docs: per-hosting-model content spec blocks

**Why here:** This is the correct insertion point for infrastructure decisions. The design
documents are already organised by concern (component, data, security, integration,
infrastructure, deployment, feasibility). Docs 5 and 6 are the right owners.

**Table rows updated (content column only — sentinels unchanged):**

| # | File | Content |
|---|---|---|
| 5 | `target-infrastructure-architecture.md` | Hosting, networking, identity — sections vary by `hosting_model` (see spec block below table) |
| 6 | `target-deployment-architecture.md` | CI/CD pipeline, deployment units, environment config — sections vary by `hosting_model` (see spec block below table) |

**Doc 5 required sections per `hosting_model`:**

_When `hosting_model = K8s`:_
- `## Container Strategy` — Dockerfile per cluster (multi-stage build), base image per target stack,
  image naming convention `{registry}/{cluster}:{commit-sha}`
- `## Kubernetes Workloads` — one entry per cluster: workload type (Deployment = stateless API,
  StatefulSet = stateful data service, CronJob = background worker), replica count,
  resource requests/limits (initial estimates — flag for load-test validation before production)
- `## Networking` — Ingress controller (NGINX or Azure Application Gateway), NetworkPolicy per
  cluster, TLS termination, inter-service DNS (`{service}.{namespace}.svc.cluster.local`)
- `## Configuration & Secrets` — ConfigMap structure per environment, Kubernetes Secrets,
  Azure Key Vault CSI driver, no plaintext secrets in image or values files
- `## Identity` — Workload identity or pod-managed identity, RBAC assignments
- `## Service Bus Topology` *(include only if messaging coupling identified at Step 1.5)*
  — Namespace naming (`{app}-{env}`), one topic per domain event type, subscriptions per
  consumer cluster, dead-letter queue policy
- `## Database Migration` *(include only if database coupling or data architecture has migrations)*
  — Liquibase init-container in pod spec of the cluster owning schema changes, migration scripts
  at `db/migrations/`, changelog format matching detected SQL dialect (SQL for .NET/Node,
  YAML/XML for Java/Spring Boot)

_When `hosting_model = PaaS`:_
- `## App Service Configuration` — Plan tier, deployment slots, health probe path (`/health`)
- `## Configuration & Secrets` — App Settings per environment, Key Vault references (no hardcoded values)
- `## Identity` — Managed identity, RBAC assignments to downstream resources
- `## Networking` — VNet integration, private endpoints if internal-only services required

_When `hosting_model = on-prem`:_
- Retain original scope: IIS site configuration, app pool identity, Windows Auth (if
  `windows_auth_detected=true` and `hosting_model=on-prem`), network share mounts, certificate store

**Doc 6 required sections per `hosting_model`:**

_When `hosting_model = K8s`:_
- `## Pipeline Stages` — ordered stages: (1) build + unit test per cluster in parallel,
  (2) Docker build + push to Azure Container Registry per cluster image,
  (3) Trivy or Snyk container security scan,
  (4) Helm upgrade to dev namespace,
  (5) integration + E2E gate,
  (6) manual approval,
  (7) Helm upgrade to staging then prod
- `## Helm Chart Structure` — chart layout per cluster, `values.yaml` base +
  `values-{env}.yaml` overlay per environment, no secrets in values files
- `## Rollback Strategy` — `helm rollback {release}` per cluster; Liquibase rollback script
  if the cluster owns schema changes
- `## Environment Config Strategy` — ConfigMap overlay per environment, secret injection via
  Key Vault CSI, no environment-specific branches or image rebuilds per environment

_When `hosting_model = PaaS`:_
- `## Pipeline Stages` — build → publish artifact → deploy to deployment slot → smoke test → swap
- `## Environment Config` — App Settings per environment via pipeline variables, Key Vault references
- `## Rollback` — slot swap reversal; document the swap command

_When `hosting_model = on-prem`:_
- Retain original scope: CI/CD pipeline for IIS deployment, deployment units, environment config files

**What does NOT change:** Table sentinels (`## `) remain unchanged — no breaking impact on
in-flight migrations. The expanded content is a narrative block below the table, not inside the
table cell.

---

## Deferred items (not in this change)

| Item | Why deferred |
|---|---|
| Options judge check for Infrastructure Footprint quality | No infra table in options; judge is not needed for a single Q2 answer |
| `migration-feasibility.md` infra provisioning effort | Follow-up — add when K8s infra provisioning time is quantified |
| `document-orchestrator.md` explicit `hosting_model` pass | Implicit via checkpoint; subagent prompt already includes checkpoint payload; verify on first K8s rewrite run |
| `infra-signal-detect.cjs` script | Not needed; Liquibase/Service Bus decisions come from Step 1.5 coupling data, not a new scan |

---

## Files changed

| File | Change |
|---|---|
| `skills/rewrite/SKILL.md` | 4 targeted edits — Steps 1, 2 (pre-design questions), 2 (checkpoint flush), 2.5 (doc content spec blocks) |

No new scripts. No new specs. No sentinel changes. No document-orchestrator changes required.
