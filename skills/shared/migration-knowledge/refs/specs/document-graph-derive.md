# Shared Skill: Document Graph Derive

_Derives the document dependency graph at runtime by reading the structured `### Dependencies`
blocks in [`target-design-spec.md`](target-design-spec.md). Runs once at the start of the design
phase in each migration family skill. Output is passed to the orchestrator
([`document-orchestrator.md`](document-orchestrator.md)) for wave scheduling and to the feedback
skill ([`document-feedback.md`](document-feedback.md)) for cascade detection._

> **Why runtime derivation?** The templates in `target-design-spec.md` are the single source of
> truth for what each document needs. Deriving the graph from them ensures they can never drift
> apart — if a template's dependencies change, the graph automatically reflects it on the next
> migration run. No hand-authored graph to maintain.

---

## Invocation

```bash
node "$PLUGIN_DIR/scripts/graph-derive-documents.cjs" \
  --spec="$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/target-design-spec.md" \
  --json
```

| Exit | Meaning | Action |
|---|---|---|
| 0 | Success — dependency_graph + waves in stdout as JSON | Proceed |
| 1 | Cycle detected — cycle details in stderr | STOP — a template's `depends_on` declaration creates a circular dependency; fix the declaration before proceeding |
| 2 | Parse error — missing Dependencies block or unknown document reference | STOP — a template is missing its `### Dependencies` block or references a non-existent document |

---

## Output format

```json
{
  "dependency_graph": {
    "target-component-architecture":    [],
    "target-data-architecture":         [],
    "target-infrastructure-architecture": [],
    "target-deployment-architecture":   ["target-infrastructure-architecture"],
    "target-integration-architecture":  ["target-component-architecture"],
    "target-security-architecture":     ["target-component-architecture",
                                         "target-infrastructure-architecture"],
    "migration-feasibility":            ["target-component-architecture",
                                         "target-data-architecture",
                                         "target-infrastructure-architecture",
                                         "target-deployment-architecture",
                                         "target-security-architecture",
                                         "target-integration-architecture"]
  },
  "waves": [
    ["target-component-architecture", "target-data-architecture", "target-infrastructure-architecture"],
    ["target-deployment-architecture", "target-integration-architecture", "target-security-architecture"],
    ["migration-feasibility"]
  ]
}
```

`waves` is the pre-computed topological sort — the orchestrator uses it directly for wave
scheduling without needing to re-sort. The full graph is also returned so the feedback skill
can compute affected-document subsets for revision cascades.

---

## When to run

Run **once per migration** at the start of the design phase — before invoking the orchestrator
for initial document authoring. The output is passed as-is to both the orchestrator
(`dependency_graph` field) and the feedback skill. Do not cache across sessions — re-derive fresh
each time so template changes are always picked up.

---

## Hard rules

- NEVER hand-author or hard-code the dependency graph — always derive from the templates.
- If exit 1 (cycle): fix the `### Dependencies` declaration in the offending template first;
  do not proceed to document authoring with a cyclic graph.
- If exit 2 (parse error): every document template MUST have a `### Dependencies` block;
  add the missing block before proceeding.
- Pass the FULL graph to both orchestrator and feedback skill — the orchestrator filters to the
  relevant subset per `documents` list; the feedback skill computes cascade subsets from it.
