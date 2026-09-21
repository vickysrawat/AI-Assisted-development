# ADR-0067: LLM cost governance via configurable cost-governance.json

**Status:** Accepted · 2026-09-20
**Related:** ADR-0064 (governance report)

## Context

Without cost visibility, teams cannot allocate LLM spend, set budgets, or understand whether
expensive operations (high revision cycles, large ICEA drafts) are disproportionately costly.
Anthropic's pricing changes over time, and teams have different budget constraints.
Model routing (ICEA_MODEL, REVIEW_MODEL, INFRA_MODEL) also drifts if tiers are not explicitly
configured — a plugin upgrade that changes defaults silently changes costs.

Three related concerns:
1. Cost visibility — what are we spending on each skill?
2. Budget tracking — are we approaching a monthly limit?
3. Model tier discipline — are teams intentionally choosing their models?

## Decision

`.claude/cost-governance.json` — a committed per-project config file seeded by `setup-init`:
```json
{
  "_pricing_updated": "2026-09-20",
  "currency": "USD",
  "monthly_token_budget": null,
  "alert_at_percent": 80,
  "pricing": {
    "claude-opus-4-8":           { "input_per_mtok": 15.0, "output_per_mtok": 75.0 },
    "claude-sonnet-4-6":         { "input_per_mtok": 3.0,  "output_per_mtok": 15.0 },
    "claude-haiku-4-5-20251001": { "input_per_mtok": 0.80, "output_per_mtok": 4.0  }
  }
}
```

Cost estimates are computed by `scripts/governance-report.cjs` using token counts from
`token-graph.json` × configured rates. A skill→model-tier heuristic is used until
per-invocation model tracking (ADR-0060 Item 15) provides exact data.

`setup-status` check 1x validates:
- `cost-governance.json` present (amber if missing)
- All three model tier env vars explicitly set in `settings.json` (amber if any unset)

## Rationale

**Configurable rates over hardcoded:** Anthropic's pricing changes. Hardcoded rates go stale
silently. A committed config file that teams update when rates change is honest about its
maintenance requirement and visible in git history.

**Per-project committed file over machine-level:** cost budget is a team/project concern,
not an individual developer concern. A committed file means all developers see the same
budget threshold and pricing assumptions.

**Amber-only (no hard blocking) on budget exceeded:** blocking development because an LLM
cost estimate exceeded a threshold would be too disruptive. Visibility and alerts are the
right control; enforcement is a team process decision.

**Model tier discipline check in setup-status:** teams that don't explicitly set model tiers
are silently using plugin defaults that change on upgrade. Making this visible (amber in
setup-status) encourages intentional model selection without forcing it.

## Alternatives Rejected

| Alternative | Reason rejected |
|---|---|
| Hardcoded pricing in governance-report.cjs | Goes stale silently; no team-visible update mechanism |
| Machine-level pricing config | Budget is a team concern; machine-level is invisible to other developers |
| Hard blocking on budget exceeded | Too disruptive to development flow; cost estimates are approximate |

## Consequences

- `cost-governance.json` must be updated when Anthropic changes pricing
- `GOVERNANCE REPORT` shows estimated cost + budget status + model tier compliance
- `setup-status` check 1x shows amber when model tiers are not explicitly configured
- Item 15 (per-invocation model tracking) will improve cost accuracy over time
