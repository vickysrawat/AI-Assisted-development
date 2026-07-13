---
description: Render the knowledge graph as a self-contained offline HTML visualization at .claude/graph/graph.html — nodes by type, edges by type/confidence, hubs and stale modules flagged, hover shows dependencies and dependents. Reads graph.json only; --3d uses a locally vendored WebGL library.
argument-hint: "[--3d]  —  omit for the default offline 2D SVG view; --3d requires a vendored WebGL lib at .claude/graph/vendor/"
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`, effort: `low`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `skills/shared/model-routing-spec.md` for the full specification.

---

# /graph-viz — Knowledge graph visualization

Generates a self-contained, offline `.claude/graph/graph.html` from the authoritative
`.claude/graph/graph.json`. Open it in any browser — no network, no dependencies.

The view: nodes grouped and coloured by **type**, edges styled by **type** and
**confidence** (solid = extracted, dashed = inferred/ambiguous), **hub (god) nodes** and
**stale** modules highlighted, and hover on a node reveals its **dependencies** and
**dependents** (impact analysis at a glance).

This is a read-only consumer of the graph — it never writes `graph.json`, the index, or
detail files, and `graph.html` is gitignored — regenerate it on demand with `/graph-viz`
(cheap: a deterministic template fill from `graph.json`, no re-analysis). If there is no graph yet, run `/setup-init`;
if it is stale, run `/graph-sync` first.

---

<skill>graph-viz</skill>

Read `skills/graph-viz/SKILL.md` and follow its instructions exactly.

Output only the terse status summary — no preamble, no HTML echoed to chat.
