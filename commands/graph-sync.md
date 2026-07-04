---
description: Knowledge graph refresh — recomputes module-wide fingerprints, regenerates only stale modules, reconciles removed/renamed/orphaned modules, derives typed dependency edges, updates graph.json (authoritative) and its markdown projection, and restructures flat→domain past 30 modules. Deletes the .stale flag on success.
argument-hint: "[--effort low|medium]  —  omit to use default (low); set medium if module structure is unusual or newly restructured"
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`, effort: `low`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `skills/shared/model-routing-spec.md` for the full specification.

---

# /graph-sync — Knowledge graph refresh

Incrementally refreshes the codebase knowledge graph in `.claude/graph/`.
Only regenerates modules whose **module-wide fingerprint** has changed (a hash over all
files under the module, not one entry-point file) — unchanged modules are skipped
entirely. `graph.json` is the authoritative structure; the index and detail files are
projected from it. Typical run cost: 1–3 module scans.

Use this after:
- `git pull` when session-start warns "⚠ Knowledge graph is stale"
- Adding or renaming a module
- After dream-sync reports "run /graph-sync to refresh"

For first-time graph creation, use `/dream-init` instead.

---

<skill>graph-sync</skill>

Read `skills/graph-sync/SKILL.md` and follow its instructions exactly.

Output only the terse status table — no preamble, no file content echoed to chat.
