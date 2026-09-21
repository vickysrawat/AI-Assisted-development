# ADR-0061: Role-based access via soft controls + ApprovalRoles.json

**Status:** Accepted · 2026-09-20
**Related:** ADR-0060 (audit trail), ADR-0062 (ApprovalRoles config)

## Context

High-risk governance actions — granting standing approval for all writes (`APPROVE ALL`),
approving CI/CD or IaC config changes, and dismissing Critical/High security findings —
should require elevated role. Without a real authentication system, enforcing "only Tech Leads
can do X" is impossible to guarantee cryptographically. The question is whether soft controls
with full visibility are worth building at all.

## Decision

**Soft enforcement** via `scripts/rbac-check.cjs`:
- Identity resolved from `git config user.email` at action time
- Role resolved from `.claude/ApprovalRoles.json` lookup
- Actors not listed in any role → default `developer`
- If actor lacks the required role → blocked with a named-actor message + `RBAC_BLOCK` audit event
- `ApprovalRoles.json` empty or missing → all checks pass silently (opt-out mode)

Three gated actions:

| Action | Required role |
|---|---|
| `APPROVE ALL ADO-{ID}` | `tech_lead` |
| `APPROVE CONFIG` (CI/CD, IaC tiers) | `tech_lead` |
| `/dismiss` Critical or High finding | `security_officer` |

All other actions are open to any developer (but audited).

## Rationale

**Soft controls over no controls:** soft controls add meaningful friction and make violations
visible, even if a determined developer can edit `ApprovalRoles.json`. The audit trail
(ADR-0060) makes every attempted bypass observable — which is the real governance goal for
regulated clients.

**Soft controls over hard cryptographic enforcement:** Claude Code is a single-session tool.
There is no way to force a second person into another developer's session. Hard blocking would
require a server-side auth system that doesn't exist and would add infrastructure overhead.

**Three gated actions only:** the gate covers the three highest-blast-radius actions. Gating
ordinary `APPROVE ADO-{ID}` would require complex ownership tracking (whose story is this?) and
create friction for the common case. The gated three are rare and high-consequence.

## Alternatives Rejected

| Alternative | Reason rejected |
|---|---|
| Hard cryptographic RBAC | Requires server-side auth; impractical for a local developer tool |
| Gate `APPROVE ADO-{ID}` by story ownership | Ownership tracking is complex; ownership isn't in the ICEA |
| No RBAC (audit only) | Makes Critical finding dismissals and standing approvals ungated for any developer |

## Consequences

- `scripts/rbac-check.cjs` must be called before each gated action in relevant skill files
- `RBAC_BLOCK` events are written to `.claude/audit/` (ADR-0060) for governance visibility
- Teams that want no enforcement leave `ApprovalRoles.json` empty — the opt-out is explicit
- `GOVERNANCE REPORT` surfaces RBAC blocks to the tech lead at sprint retrospective
