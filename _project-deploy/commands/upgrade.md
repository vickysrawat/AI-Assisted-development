---
name: upgrade
description: >
  In-place, same-stack version upgrade (e.g. .NET 6→8, Angular 15→17, Java 8→21). The LLM
  orchestrates a deterministic stack tool — it never hand-authors the bulk change to working code.
  Rejects false-upgrades (routes them to Rewrite), produces a decision-grade Gap + Risk report, and
  (if you proceed) drives the tool on an isolated branch off a baseline tag, verified against it.
  Usage: cd my-app && /upgrade ADO-<id>
---

Invoke skill at $PLUGIN_DIR/skills/upgrade/SKILL.md
