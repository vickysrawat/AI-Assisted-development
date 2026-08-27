# Graph / Knowledge System

> Consolidated from MEMORY.md auto-capture entries (2026-07-13 to 2026-07-31).
> Dream run: 2026-08-25. Confidence: 0.85 (avg).

---

## Pipeline Independence

The graph pipeline is architect-doc-INDEPENDENT. Module derivation happens from the directory tree, not from architect's prose. graph-sync Step 4 only cross-references architecture.md "when a module's purpose is unclear" (optional hint).

Right decomposition: ONE deterministic module-derive step (module list + path globs + fingerprints + EXTRACTED edges) consumed by architect (prose) AND graph-create (typing/INFERRED), writing to DISJOINT dirs (.claude/architecture vs .claude/graph).

## module-derive.cjs

Deterministic module-skeleton writer. SAME exclusion list as graph-sync Step 4 for compliance. Writes to `.claude/graph/.module-skeleton.json` (gitignored). Does NOT compute fingerprints (those are bash-helper-owned) or edges.

## graph-create Skill (ADR 0056)

Extracted from architect Step 7. Reads module skeleton, LLM classifies type (REQUIRED enum from graph-json-schema.md: service, repository, ui, datastore, external-api, shared-lib, domain), bash-helper fingerprints, graph-extract-edges.js for EXTRACTED edges, projects index + detail files.

**ADR 0038** is only PARTIALLY superseded (graph generation moved, core "graph = single orientation layer" still valid). New ADR = 0056; 0038 file NOT modified.

## Critical Schema Rules

- Node `type` is a REQUIRED enum — "unclassified" violates the schema
- Fingerprints MUST come from the bash `graph_module_fingerprint` helper (find|sort -z|xargs sha1sum). A Node re-hash would diverge and mark everything stale
- graph-extract-edges.js exits 2 if graph.json unreadable OR nodes empty
- graph.json is the authoritative structure; markdown index and per-module detail files are its generated projection

## Plugin Repo Graph

32 modules, domain structure, 14 INFERRED edges, 0 EXTRACTED (skills are markdown, no import statements). 4 hubs identified. Plugin repo type = js-library.
