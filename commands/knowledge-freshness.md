---
description: Validate + refresh the migration family's offline knowledge tier (skills/shared/migration-knowledge). `check` classifies every ref FRESH / STALE-BY-AGE / STALE-BY-VERSION / UNKNOWN (deterministic, no-network); `refresh` (Story 2) web-grounds a stale ref, shows a diff, judges it, and updates it under the Write Gate. Plugin-maintainer tool — operates on the plugin's own bundled knowledge refs.
argument-hint: check | refresh <ref-path>   (run from inside the plugin repo)
---

## Model routing

`check` is deterministic and needs no model. The `refresh` judge (Story 2) uses the review tier —
`CRITIC_MODEL` (falls back to `REVIEW_MODEL`, default `claude-sonnet-4-6`).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

---

# /knowledge-freshness — offline knowledge-tier freshness

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js
> resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/knowledge-freshness/SKILL.md` and execute it in full.
