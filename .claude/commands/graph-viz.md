---
description: "Render the knowledge graph as a self-contained offline HTML file at .claude/graph/graph.html. Nodes by type, edges by confidence, hubs and stale modules flagged. Reads graph.json only.  Example: /graph-viz"
argument-hint: "[--3d | --help]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/graph-viz — Render the knowledge graph as an offline HTML visualization.

Writes to .claude/graph/graph.html. Nodes are coloured by type; edges by type
and confidence; hub modules and stale modules are flagged. Hover for dependencies
and dependents. Reads graph.json only — run /graph-sync first if the graph is stale.

Arguments:
  (no flag)        Default 2D SVG offline view.
  --3d             WebGL 3D view (requires vendored lib at .claude/graph/vendor/).
  --help, ?help    Show this help.

Examples:
  /graph-viz
  /graph-viz --3d
```

<skill>ai-assisted-development:graph-viz</skill>
