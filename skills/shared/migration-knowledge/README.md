# Migration Knowledge — offline-fallback reference tier

_Shared substrate · migration family (Upgrade · Rewrite · Replatform) · ADO-9000 Story 3_

Relocated from the retired `migration` skill (`skills/migration/references/`). This is the family's
**offline-fallback knowledge tier** — authority **INFERRED** (lowest); it **never overrides
web-VERIFIED facts**. The skills web-ground concrete facts at runtime (→ VERIFIED) and consult these
only when web-grounding is unavailable (air-gapped / no-web-search environments).

## Layout
- `refs/mappings/` — stack→stack translation (Rewrite / Upgrade).
- `refs/stacks/` — per-stack idioms; also the target of dream's Framework-fact `STACK-PROMOTE` LEARNED block.
- `refs/strategies/` — per-stack migration strategy.
- `refs/shared/` — cross-cutting (ef6→efcore · clean-architecture · fullstack-integration).
- `refs/specs/` — curated methodology reused by the new skills: golden-master (behavioral regression),
  feasibility (GREEN/YELLOW/RED gating), asbuilt-reconciliation (data reconciliation). The 8 old
  stage-machine specs were archived (superseded by each new skill's own references; see git history).

## Freshness
`freshness-manifest.json` tracks `last_verified` + version anchors for version-sensitive refs. A future
`knowledge-freshness` skill validates them vs a TTL + latest-known versions and refreshes stale entries
via web search (re-tag + bump `last_verified`). Evergreen methodology is not version-tracked.
