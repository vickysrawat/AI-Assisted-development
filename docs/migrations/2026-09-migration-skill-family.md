# Deprecation Notice — the `migration` skill family split (2026-09)

_ADO-9000 · Migration Skill Family (Upgrade · Rewrite · Replatform)_

## What changed
The single `migration` skill (and `migration-status`) is **retired**, replaced by three focused,
directly-invoked skills carved on locality:

| You want to… | Use |
|---|---|
| Move to a higher version of the SAME stack (in-place) | `UPGRADE ADO-{ID}` |
| Translate the app into a DIFFERENT stack (new target folder) | `REWRITE ADO-{ID}` |
| Move the HOSTING/topology (on-prem → cloud), code mostly unchanged | `REPLATFORM ADO-{ID}` |

Each skill has its own resume + status: `… RESUME ADO-{ID}` and `… STATUS ADO-{ID}`. `… STATUS` is the
`icea-status`-style re-entry point after a session gap — it loads the ledger fresh and ends with the
single next action.

## Retired keywords (no auto-routing — you choose)
`MIGRATE`, `MIGRATE RESUME`, `MIGRATE STATUS`, `MIGRATE OPTIONS/INVENTORY/ARCH/FEAS/CLUSTERS`, and
`APPROVE OPTIONS/INVENTORY/ARCHITECTURE/FEASIBILITY/MIGRATION` are retired. Typing `MIGRATE …` now
returns a signpost listing the three skills — pick the one that matches (above). Nothing auto-routes;
the choice is yours (a classifier would be rigid and could misroute).

## Where the migration knowledge went
The legacy stack/mapping/strategy references moved to `skills/shared/migration-knowledge/refs/**` as
an **offline-fallback** knowledge tier (tagged INFERRED, lowest authority). At runtime the skills
web-ground the concrete facts (VERIFIED) and fall back to these only when web-grounding is
unavailable. Freshness is tracked in `skills/shared/migration-knowledge/freshness-manifest.json`
(a future `knowledge-freshness` skill will validate + refresh them).

## Rollback
Revert the feature-branch merge — restores `skills/migration/`, `skills/migration-status/`, and the
prior `MIGRATE*` handlers in both `CLAUDE.md` §0a and `.claude-plugin/plugin.json`.
