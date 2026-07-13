# 0044 — `directoryCatalog` in graph.json for pre-built directory type classification
Status: Accepted · Date: 2026-07-07 · Extends: [0039](0039-graph-json-sidecar.md)
Governs: `skills/shared/graph-json-schema.md`, `skills/graph-sync/SKILL.md` (Step 8d), `skills/security/SKILL.md` (§0.5)

## Problem
The security skill's §0.5 static asset audit runs a `find . -type d -name "public" ...`
command on every scan to locate directories that are served without authentication. This
check must run on every scan regardless of scope flag — a data file committed to `public/`
three sprints ago is a live exposure regardless of what changed in the current diff.

The runtime `find` is fast (< 100 ms) but represents a pattern: every skill that needs to
know *what kind of directory this is* must independently discover it. The graph already
captures module-level structure (`nodes`, `edges`, `fingerprints`) but has no directory
type information. A pre-built classification — "these are the static-serving directories in
this project" — would eliminate repeated runtime discovery and could serve future skills
(config-area scan, test-directory scoping) without additional `find` invocations.

An earlier version of this decision considered a separate `project-tree.json` artifact.
That was rejected (see Alternatives).

## Decision
Add an optional `directoryCatalog` top-level key to `graph.json` alongside `meta`,
`nodes`, `edges`.

```json
{
  "meta": { ... },
  "nodes": [ ... ],
  "edges": [ ... ],
  "directoryCatalog": {
    "generatedAt": "2026-07-07",
    "staticServing": ["src/app/public", "wwwroot"],
    "config": ["environments", ".github/workflows"],
    "test": ["test", "__tests__", "e2e"]
  }
}
```

**Generation — graph-sync Step 8d (pre-write, in-memory):**
The directory `find` commands run before Step 8a writes `graph.json`. Results populate
`g.directoryCatalog` in the in-memory graph object. Step 8a then writes the full graph
(including the catalog) in a single write. `graph-extract-edges.js`, which runs after
Step 8a and rewrites only `edges[]`, leaves `directoryCatalog` untouched. This avoids
a read-modify-write cycle and the risk of the script overwriting the catalog.

**Consumer contract (security skill §0.5, and future consumers):**
Trust `directoryCatalog.staticServing` ONLY when all three conditions hold:
1. `.claude/graph/graph.json` is readable
2. `.claude/graph/.stale` does not exist
3. Every path listed in `staticServing` exists on disk

If any condition fails → run the existing `find` command as fallback and announce
`"graph unavailable or stale — filesystem scan"`. The catalog is a fast-path
optimisation; the `find` is the safety net.

**The key is optional and additive.** `meta.schemaVersion` stays `"1.0"`. Existing
consumers that do not read `directoryCatalog` are unaffected.

## Rationale
- **Reuses existing infrastructure** — graph-sync already handles generation,
  staleness detection (`.stale` flag), and consumer access patterns. Adding a key to
  graph.json costs no new tooling.
- **Single write** (in-memory before Step 8a) avoids the race condition where
  `graph-extract-edges.js` could overwrite a separately-written catalog.
- **Three-condition trust check** addresses the staleness weakness: the `.stale` flag
  tracks *code* changes, not directory structure changes. A directory added or deleted
  without code changes would not set `.stale`. The path-existence check catches this
  case — if a cataloged path no longer exists, the fallback runs.
- **Alternatives rejected:**
  - *Separate `project-tree.json`* — another artifact to maintain, generate, and keep
    in sync. No shared generation infrastructure.
  - *Extend `file-cache.json`* — file-cache tracks per-file metadata; directory type is
    a different granularity. Mixing them would complicate the cache schema.
  - *Always runtime `find`* — acceptable latency but misses the broader opportunity to
    serve directory type information to multiple skills from one source.

## Consequences
- `graph-json-schema.md` updated with `directoryCatalog` section including consumer
  contract.
- `graph-sync` Step 8d added (pre-write `find` commands for static-serving, config,
  and test directories).
- Security skill §0.5 updated: graph catalog → path-existence check → `find` fallback.
- Projects that never run `/graph-sync` receive the `find` fallback permanently.
- Custom static-serving directories (configured via `app.UseStaticFiles("/custom")` or
  nginx config) are not detected by name-based `find` — same limitation as before, not
  a regression introduced by the catalog.
- The `architect` skill does not generate `directoryCatalog` — only `graph-sync` does.
  Projects using only `architect` for graph generation receive the `find` fallback until
  `/graph-sync` runs.

## Revisit when
Skills beyond `security-review` need directory type metadata — extend `directoryCatalog`
with additional category arrays (e.g. `generated`, `vendor`) rather than creating a new
artifact. Alternatively, if graph-sync gains a full filesystem tree walk, fold
`directoryCatalog` generation into that pass.
