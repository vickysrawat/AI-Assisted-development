---
description: Applies a specific finding fix directly to source. Takes a fingerprint ID (FP-xxxxxxxx), searches the code-review ledger, security ledger, and dynamic-scan ledger for the entry, applies the fix with str_replace, and marks the finding as Fixed. No re-analysis needed.
argument-hint: <FP-xxxxxxxx>  e.g.  FP-a1b2c3d4
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL` (default: `claude-sonnet-4-6`).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

# /fix

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/fix/SKILL.md` and execute it in full, passing the provided arguments.
