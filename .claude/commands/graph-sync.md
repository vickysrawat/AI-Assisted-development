---
description: "Knowledge graph refresh — recomputes fingerprints, regenerates stale modules, reconciles renamed/orphaned modules, and updates graph.json. Deletes the .stale flag on success.  Example: /graph-sync"
argument-hint: "[--effort low|medium | --help]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/graph-sync — Knowledge graph refresh.

Recomputes module fingerprints, regenerates only stale modules, reconciles
removed/renamed/orphaned modules, derives typed dependency edges, and updates
graph.json. Restructures flat→domain layout past 30 modules.

Arguments:
  --effort low      Fast refresh — default. Use for routine updates.
  --effort medium   Deeper refresh. Use if module structure is unusual or recently restructured.
  --help, ?help     Show this help.

Examples:
  /graph-sync
  /graph-sync --effort medium
```

<skill>ai-assisted-development:graph-sync</skill>
