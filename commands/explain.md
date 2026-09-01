---
description: Answers codebase questions primarily from architecture docs and the codebase knowledge graph. Will optionally read ONE source file with explicit consent (Category B) when structural docs don't contain the answer. Saves hundreds of tokens vs scanning src/. Tells you exactly which file to look at for deeper detail.
argument-hint: "<question about the codebase>"
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL` (default: `claude-sonnet-4-6`).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

# /explain

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/explain/SKILL.md` and execute it in full, passing the provided question.
