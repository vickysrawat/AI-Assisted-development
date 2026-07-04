# 0041 — EXTRACTED graph edges are derived deterministically by a script, not by the model
Status: Accepted · Date: 2026-07-04 · Extends: [0039](0039-graph-json-sidecar.md)
Governs: `scripts/graph-extract-edges.js`, `skills/graph-sync/SKILL.md` (Step 7b/8a), `skills/architect/SKILL.md` (Step 7-2)

## Problem
`graph.json` distinguishes edge provenance — `EXTRACTED` (found in source), `INFERRED`,
`AMBIGUOUS` ([ADR 0039](0039-graph-json-sidecar.md)). But `EXTRACTED` edges were derived **by
the model**: `graph-sync`/`architect` told Claude to `rg` imports, reason about which module
each maps to, and hand-tag confidence. That is non-deterministic (two syncs of an unchanged
repo can differ), token-costly, approximate, and pulls source into model context — for the one
part of the graph that is *mechanically knowable*. Imports/usings/requires/ProjectReferences
are exactly what a parser can resolve with certainty.

## Decision
Move the mechanical part into a deterministic script: **`scripts/graph-extract-edges.js`**
(Node stdlib only, offline) owns `EXTRACTED` edges; the model authors only what a parser
cannot see.

- The script parses imports per language (JS/TS relative specifiers; Python dotted/relative
  modules; C# `using` → namespace map + `.csproj` `<ProjectReference>`; Java `import` → package
  map), resolves each to the **owning module** via node `paths` globs, and emits
  `{from, to, type:"depends", confidence:"EXTRACTED"}` for cross-module dependencies.
- **Edges-only, node-safe:** it rewrites only `edges` and **never recomputes `fingerprint`s**
  (those come from the bash `graph_module_fingerprint` sha1 helper; a Node re-hash would
  diverge and cause false staleness) and never edits `nodes`.
- **Merge policy:** preserve model-authored `INFERRED`/`AMBIGUOUS` edges; when the parser
  confirms a pair, upgrade the existing edge to `EXTRACTED` keeping its curated `type`/`reason`
  (no redundant `depends`); drop stale `EXTRACTED` (import gone) and dangling edges.
- **Deterministic:** re-emits `graph.json` with the schema's canonical ordering/serialization,
  byte-identical across runs on an unchanged repo. Runs entirely locally — raw source never
  enters the model context (aligns with the client-internal / no-external-connectivity posture).

The model still owns `INFERRED`/`AMBIGUOUS` (DI, dynamic/config wiring, prose-only) and may set
a specific `type` (`calls`/`reads`/`publishes`/`extends`) + `reason`. **The model never
hand-writes an `EXTRACTED` edge.**

## Rationale
- **Correctness + determinism** on the knowable part; the model's judgment is reserved for the
  genuinely un-parseable relationships.
- **Cheaper:** no per-edge LLM reasoning; **more private:** source is parsed in Node, not read
  into context.
- **Not a full LSP/tree-sitter index:** import-resolution is dependency-free and offline, fits
  the plugin's zero-npm, stateless, no-connectivity constraints. Compiler-grade reference/call
  graphs remain the domain of the separate LSP plugins ([ADR 0039](0039-graph-json-sidecar.md)
  "Revisit when" — a native code-index).

## Consequences
- New `scripts/graph-extract-edges.js`; `graph-sync` Step 7b (model builds only INFERRED/
  AMBIGUOUS) + Step 8a (runs the extractor); `architect` Step 7-2 (runs it after node write).
  `skills/shared/graph-json-schema.md` notes the deterministic producer.
- Existing projects get parser-true `EXTRACTED` edges on the next `/graph-sync` (migration
  `013`… see the migrations index for 3.5.0). Minor version bump.
- `tests/validate.py` check 9 (no dangling, unique ids, projection agreement) continues to hold;
  the extractor never emits dangling edges.

## Revisit when
A native harness code-index (LSP/tree-sitter) makes even `EXTRACTED` extraction redundant —
then project from it instead of parsing imports (same trigger as [ADR 0039](0039-graph-json-sidecar.md)).
