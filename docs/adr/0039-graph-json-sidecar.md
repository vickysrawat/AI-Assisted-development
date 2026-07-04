# 0039 — graph.json is the machine-readable structure of record; markdown is its projection
Status: Accepted · Date: 2026-07-03 · Extends: [0038](0038-knowledge-graph-orientation.md)
Governs: `.claude/graph/graph.json`, `skills/shared/graph-json-schema.md`

## Problem
The knowledge graph ([ADR 0038](0038-knowledge-graph-orientation.md)) was a solid
*orientation index* but not, in the data sense, a **graph**: relationships lived as
free-text prose in each detail file's `Dependencies:` line. Nothing was machine-readable,
so nothing could be queried, validated, or visualised; "what depends on X?" required
reading every file, and a named dependency was never checked to exist. Reviewed against
FAIR (Findable/Accessible/Interoperable/Reusable), the *Interoperable* leg was missing
entirely. Two correctness defects compounded it: (1) staleness detection hashed only a
single entry-point file per module, so edits to any other file in the module were missed;
(2) `hooks/graph-stale-detect.sh` was referenced by `dream-init` but did not exist on disk.

## Decision
Introduce **`.claude/graph/graph.json`** as the authoritative structure of the graph, and
make the markdown a projection of it.

- **`graph.json` is the source of truth** for nodes (with a required `type`), typed
  directed `edges` (`depends`/`calls`/`reads`/`publishes`/`extends`) each carrying an
  `EXTRACTED`/`INFERRED`/`AMBIGUOUS` **confidence** tag, module-wide fingerprints, and hub
  (god-node) flags. `graph-index.md` and the per-module detail files are **generated from
  it** and never hand-edited for structure. One source, one projection — this preserves
  ADR 0038's single-orientation-source guarantee rather than re-creating the dual-source
  drift that retired `domain-map.md`.
- **`graph.json` is never auto-loaded** — it carries no `paths:` frontmatter, so the
  always-loaded surface stays exactly as lean as before; skills read *slices* of it on
  demand. Rich structure lives out-of-band; the token budget is unchanged.
- **Module-wide fingerprints.** The fingerprint is a hash over *all* files under a module's
  `paths` (the `graph_module_fingerprint` helper), computed identically in `architect`,
  `/graph-sync`, and the now-created `hooks/graph-stale-detect.sh`. Single-file staleness
  blindness is fixed.
- **Edges are derived from source, not prose.** `/graph-sync` extracts edges from imports/
  usings/references and tags them `EXTRACTED`; only genuinely inferred edges are
  `INFERRED`/`AMBIGUOUS`. Impact analysis never treats a guess as fact.
- **`/graph-sync` reconciles.** Dead modules are confirm-then-remove (relaxing the old
  "warn only" rule), renames carry curated prose forward, and orphans are repaired.
- **Committed and PR-reviewed**, like the rest of the graph (ADR 0038). Writers emit
  deterministic, stably-ordered JSON so a single shared file stays merge-friendly.

## Rationale
- **FAIR Interoperable + Findable** — relationships become queryable, validatable data with
  typed nodes/edges and provenance, without adding RDF/SPARQL/triplestore weight that would
  hurt the token goal (the graph is for cheap LLM orientation, not open-data exchange).
- **Correctness first** — module-wide fingerprints and the created hook make the data
  trustworthy before richer structure is layered on it; typed findability on stale data
  would only make wrong orientation easy to find and load.
- **Confidence taxonomy and git-hook freshness** are borrowed from the mature peer tool
  Graphify (MIT); the plugin adopts the *techniques*, not the third-party dependency, per
  the no-external-connectivity constraint.

## Consequences
- New shared spec `skills/shared/graph-json-schema.md` (registered in `components.shared`).
- `architect` Step 7 builds `graph.json` first, then projects index + detail files.
- `validate.py` check 9 registers the schema, asserts generator/refresher wiring, and (when
  a `graph.json` exists) enforces no orphans / no dangling edges / unique ids / projection
  agreement, warning on cycles.
- Minor version bump to 3.3.0; `docs/adr/0038` "Revisit when" points here.

## Revisit when
Node/edge volume or query needs outgrow a flat JSON file (unlikely at module granularity),
or Claude Code gains a native code-index the plugin could project into instead of maintaining
`graph.json`.
