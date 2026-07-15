---
description: Re-scans project manifests (.sln, pom.xml, settings.gradle, angular.json, package.json, pyproject.toml) and updates .claude/settings.local.json additionalDirectories. Run after adding or removing a project reference outside the solution root.
argument-hint: (no arguments needed)
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

---

# /sync-dirs — Sync external project directories

Re-scans all project manifest files and updates `.claude/settings.local.json`
with any external directory references found. Safe to run at any time — fully
idempotent.

Run this after:
- Adding a new project reference to a `.sln`, `pom.xml`, `angular.json`, or other manifest
- Cloning a repo where `settings.local.json` does not yet exist
- Moving an external project to a different path on disk

---

## Execution

Read `.claude/plugin-path.txt` to get `PLUGIN_DIR` (if absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`), then:

Read `$PLUGIN_DIR/skills/external-dir-map/SKILL.md` and execute it in full.

The skill will:
1. Detect the project stack from manifest files present in the working directory
2. Scan each manifest for project/module references outside the solution root
3. Read `.claude/settings.local.json` if it exists, or create it if not
4. Merge any new external paths into `additionalDirectories` (no duplicates, no removals)
5. Save a manifest snapshot to `.claude/dream-init-state.json` for staleness detection
6. Print a summary of what was found and written

---

---

## External stack detection (runs after every sync-dirs)

After `additionalDirectories` is updated, refresh `external_detected_stacks` so
icea-feature overlay selection stays accurate. `$PLUGIN_DIR` was already resolved above.

```bash
node "$PLUGIN_DIR/scripts/external-stack-detection.cjs"
```

Tell the developer: `"✅ external_detected_stacks updated: [result or 'none detected']"`

Note: `external_stacks_prompted` is preserved by the script — this call never resets it.

---

## Hard rules

- NEVER remove paths already listed in `additionalDirectories`
- NEVER touch any other key in `settings.local.json`
- NEVER commit `settings.local.json` — it is machine-specific
