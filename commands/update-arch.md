---
description: Targeted architecture doc refresh — re-reads only changed parts of the codebase and updates the prose architecture docs (architecture.md) without a full re-scan. Also re-runs the deployment questionnaire via --deployment. For the codebase module graph, use /graph-sync (incremental, fingerprint-based). Much cheaper than re-running the full architect skill.
argument-hint: "[--deployment | --data | --integrations | --security | --decisions | path]  —  refresh one architecture doc, append a decision, re-run the deployment questionnaire, refresh a subtree (path), or omit to auto-detect changed areas"
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL` (default: `claude-sonnet-4-6`).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

# /update-arch

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/update-arch/SKILL.md` and execute it in full, passing the provided arguments.
