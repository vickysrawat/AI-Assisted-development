---
description: Quarterly memory quality audit — flags uncited facts, surfaces contradicted promotions, and feeds rollback history into confidence scoring. Closes Dream's feedback loop.
argument-hint: "[--days <N>] (citation window, default 90)"
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL` (default: `claude-sonnet-4-6`).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

# /dream-audit

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/dream-audit/SKILL.md` and execute it in full, passing any provided arguments.
