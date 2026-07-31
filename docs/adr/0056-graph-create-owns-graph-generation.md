# 0056 — graph-create skill owns initial graph generation
Status: Accepted · Date: 2026-07-31
Governs: `skills/graph-create/SKILL.md` · `scripts/module-derive.cjs` · `skills/architect/SKILL.md`

> **Relation to ADR 0038:** ADR 0038's core decision — "the knowledge graph is the single
> codebase-orientation layer" — is **unchanged**. Only the *ownership of initial graph
> generation* changes. ADR 0038 is retained unmodified (immutable historical record).

## Problem

Architect (Step 7) mixed two logically independent concerns: generating architecture
*documentation* (`.claude/architecture/*.md`) and generating the *knowledge graph*
(`.claude/graph/`). This coupling had three consequences:

1. **Triple module derivation.** Module structure was derived independently by architect
   (for docs headings), architect Step 7 (for graph nodes), and graph-sync Step 4 (for
   refresh). Three independent LLM passes on the same question risk disagreeing on module
   boundaries, causing spurious renames on the first `/graph-sync` after setup.

2. **Architect's blast radius.** A failure or skip of architect left the graph entirely
   absent — both documentation and orientation failed together.

3. **No shared input.** There was no canonical module-list artifact for downstream
   consumers to read, so any new skill that needed module structure had to re-derive it.

## Decision

Split graph generation out of architect into a dedicated `graph-create` skill, with a
shared deterministic input:

```
module-derive.cjs                 (new deterministic Node.js script)
   ↓ writes .module-skeleton.json (private, gitignored build artifact)
   ├── architect (docs)            reads skeleton for section headings
   └── graph-create (graph)       reads skeleton → schema-valid graph.json → graph-sync
```

Sequencing inside `/setup-init`:
1. `module-derive.cjs` — deterministic, fast, runs once
2. Architect — LLM, generates `.claude/architecture/` only; no longer writes graph files
3. graph-create — LLM, reads skeleton, generates `.claude/graph/`
4. graph-sync — LLM, incremental refresh (unchanged)

## Consequences

**Positive:**
- Single module derivation → architect and graph-create see identical module boundaries.
- graph-sync Step 4 uses the same bounded-context heuristic as `module-derive.cjs` →
  no spurious renames on first refresh.
- Architect and graph-create write to **disjoint directories** (`.claude/architecture/`
  vs `.claude/graph/`) — prerequisite for future parallelisation (see
  `docs/proposals/parallel-execution-primitive.md`).
- Architect failure no longer breaks graph orientation.

**Negative / trade-offs:**
- setup-init has one more sequential step (module-derive), adding a few seconds.
- `.module-skeleton.json` is a new gitignored artifact; developers must not commit it.
- graph-create is an internal helper skill — it has no command stub and cannot be invoked
  directly by users. `/graph-sync` remains the public graph-refresh command.

## Alternatives rejected

**A) Keep architect generating the graph** — rejected: preserves the triple-derivation
problem and the mixed-concern coupling. No path to future parallelisation.

**B) Move graph generation entirely to graph-sync** — rejected: graph-sync is an
*incremental* refresh tool. It guards Step 1 with "MISSING — run /setup-init" because
it was never designed for the initial build. Retraining users + changing the guard adds
more risk than a dedicated skill.

## Files affected

| File | Change |
|---|---|
| `scripts/module-derive.cjs` | New — deterministic module-skeleton writer |
| `skills/graph-create/SKILL.md` | New — extracted from architect Step 7 |
| `skills/architect/SKILL.md` | Step 7 replaced with delegation note; Step 1 reads `repo_type` from state if set by repo-detect |
| `commands/setup-init.md` | Steps 1.5 (module-derive) and 3c (graph-create) added |
| `scripts/setup-init-bootstrap.cjs` | `.module-skeleton.json` added to `GITIGNORE_BASE` |
| `skills/graph-sync/SKILL.md` | Step 4 note: module-derive uses same heuristic |
| `.claude-plugin/plugin.json` | `graph-create` registered as internal skill |
| `docs/adr/README.md` | This ADR indexed |
