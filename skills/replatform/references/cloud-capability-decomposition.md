# Cloud-Capability Decomposition (AC-F7)
_Reference · skills/replatform · ADO-9000 Story 3_

The infrastructure transpose of Rewrite's target-space decomposition. Unit = cloud capability, derived
from the source's RUNTIME topology, **grounded** through the migration-knowledge cache.

## Unit = cloud capability
compute · data · identity · messaging · secrets · observability · network.

## Infra mapping (option-driven, NOT 1:1 — grounded)
| Source runtime element | Cloud capability | Example target (Azure — GROUND at runtime) |
|---|---|---|
| IIS / Windows service | compute | App Service · AKS · Container Apps · Functions |
| SQL Server / on-prem DB | data | Azure SQL · Postgres Flexible · Managed Instance |
| File share (SMB/NFS) | data (blob) | Blob Storage · Azure Files |
| MSMQ / on-prem queue | messaging | Service Bus · Event Hub · Storage Queue |
| Windows auth / AD | identity | Entra ID · Managed Identity |
| Config files / secrets | secrets | Key Vault · App Configuration |
| Task Scheduler / cron | compute | Timer Functions · Logic Apps |
| Event logs / APM | observability | App Insights · Log Analytics |

> **GROUNDING:** the table above is the **OFFLINE-FALLBACK seed** — tag it **INFERRED** (lowest
> authority). At runtime, web-ground the CONCRETE service pick + current names + TCO through the
> migration-knowledge cache → tag **VERIFIED**. Never present a specific service/price as fact without
> grounding it (or flagging it INFERRED when web-grounding is unavailable). This table is a candidate
> client of the future `knowledge-freshness` validator.

## Mapping is option-driven + consolidating
Not 1:1: one source element → several viable targets (chosen on NFR fit × TCO × effort). Multiple source
elements MAY consolidate into one capability (e.g. several services → one App Service plan).

## Landing zone = Tier-0 (infra SharedKernel)
Subscription structure · networking/VNet · identity · policy/governance · security baseline ·
observability. Provisioned FIRST, inherited by all capabilities. `replatform-plan.cjs plan` injects it
as Tier-0 index 0; every workload capability depends on it.

## Scheduling + isolation
Reuse the declared DAG + dependency-driven scheduling: independent capabilities parallelize AFTER the
landing zone; per-capability feasibility gating. **Isolation unit = IaC state/module** (Terraform state /
workspaces), NOT a git worktree (that is Rewrite's unit).
