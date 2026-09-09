# Executor Seam — future-autonomy flag (default OFF)

_Shared substrate · migration family (Replatform primary consumer) · ADO-9000 Story 3 (AC-F7)_

> **The uniform family safety principle:** *the LLM authors; the human executes* — anything that
> touches real infrastructure or data, in **any** environment (not even dev). This file is the single
> contract that governs where execution could ever be gated. Keep prod + regulated permanently barred.

## Why a seam

IaC/config/cutover are both *generated artifacts* (author-time quality gates apply) and *destructive
actions* (execution safety applies). To let the family evolve without re-architecting, the **execute**
step is abstracted behind an **executor interface**. The shipped executor is the
**manual / human-handoff** executor. A feature flag can later swap in an autonomous executor — but it
is **not** all-or-nothing and never removes the hard bars below.

## The flag

| Property | Value |
|---|---|
| Name | `REPLATFORM_AUTONOMY` (env) or `--autonomy=<off\|on>` (CLI) |
| Default | **OFF** (ships OFF; opt-in only) |
| Scope when ON | per-environment **and** per-risk-tier — never global |
| Always barred (even ON) | **production** environments **and** regulated/PII/financial actions |
| Guardrails required before ON | cost caps · blast-radius limits · policy-as-code · kill-switch · full audit |
| Graduation | low-risk / non-prod first; prod + regulated stay human, permanently |

## Authorization decision (what `replatform-plan.cjs execute` enforces)

| action | autonomy | env | regulated | decision |
|---|---|---|---|---|
| `author` / `rehearse` | any | any | any | **authorized** (author-time / non-prod rehearsal; no real infra) |
| `apply` / `cutover` / `destroy` | **off** (default) | any | any | **denied** — LLM authors; human executes |
| `apply` / `cutover` / `destroy` | on | **prod** | any | **denied** — prod always human |
| `apply` / `cutover` / `destroy` | on | non-prod | **true** | **denied** — regulated always human |
| `apply` / `cutover` / `destroy` | on | non-prod | false | decision-only *authorized*; still routed through the configured executor (shipped = manual-handoff). **The planner itself never applies.** |

> Even an "authorized" real action returns `applied: false` from the planner — this script is
> **decision-only**. Actual execution is always the human-executed runbook (or, in a future opt-in,
> the autonomous executor wired behind this seam), never this process.

## Invariants (enforced by tests)

- Flag **defaults OFF** — absence of the flag = manual/human-handoff.
- A real action (`apply`/`cutover`/`destroy`) with the flag OFF is **denied** (exit 14).
- `prod` and `regulated=true` are **denied even when the flag is ON**.
- The planner **never** performs a real apply (`applied: false` on every path).

## Follow-on work (out of scope for ADO-9000)

Enabling the autonomous executor is a separate ICEA-gated work item: it must add cost caps,
blast-radius limits, policy-as-code, a kill-switch, and audit, and graduate by risk tier (non-prod
first). Prod + regulated remain barred here regardless.
