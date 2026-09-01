---
description: "Write/refresh the repo's ignore file with the plugin-required entries (managed block) and optionally detected build artifacts. Detects the VCS first — .gitignore on Git, .tfignore on TFVC — so protection actually takes effect (a .gitignore is inert on TFVC). Creates the file if missing, never touches your own lines; on TFVC also flags an already-tracked credential file. Use when the ignore file is missing or out of date. Args: none, or --with-artifacts to also scan for build/env files."
argument-hint: "[--with-artifacts]  —  omit for plugin entries only; --with-artifacts also offers detected bin/obj/dist/.env etc."
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL` (default: `claude-sonnet-4-6`).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

# /gitignore-sync

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/gitignore-sync/SKILL.md` and execute it in full, passing the provided arguments.
