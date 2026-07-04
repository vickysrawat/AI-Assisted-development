---
name: graph-sync
description: >
  Incremental refresh of the codebase knowledge graph in .claude/graph/.
  graph.json is the authoritative structure (typed nodes, typed edges with
  confidence, module-wide fingerprints); the markdown index and per-module detail
  files are its generated projection. Recomputes module-wide fingerprints, regenerates
  only stale modules, detects new/removed/renamed modules, derives typed dependency
  edges from source imports, flags hub (god) nodes, and restructures flat→domain past
  30 modules. Deletes the .stale flag on success.
  Triggered by /ai-assisted-development:graph-sync.
  Also triggers on: "refresh knowledge graph", "update graph", "graph is stale",
  "sync the graph", "knowledge graph stale".
---

# Graph Sync Skill

_Skill version: 2.0 · Last changed: 2026-07-03 · Plugin compatibility: ≥3.3.0 · Consent: B_

Effort tier: **low** (infrastructure, deterministic structure). Use `--effort medium`
only when module layout has significantly changed and boundaries are ambiguous.

**Consent (Category B):** graph-sync reads entry-point and source files to derive
module content and dependency edges. It is plugin infrastructure with no B1–B7
business sensitivity of its own (see `skills/shared/business-context-severity.md` for
the severity model it does not trigger), but it still announces the source read per
`skills/shared/source-file-consent.md` before reading beyond the graph files.

**Write-silent rule:** Write all graph files directly to disk. Confirm each with
`✓ Written: .claude/graph/<file> (~N tokens)`. Never echo file content to chat.

**Authoritative schemas** (single sources of truth — follow exactly):
- `skills/shared/graph-json-schema.md` — `.claude/graph/graph.json` (structure of record)
- `skills/shared/graph-index-schema.md` — `.claude/graph/graph-index.md` (breadth projection)
- `skills/shared/graph-module-schema.md` — `.claude/graph/<module>.md` (depth projection)

**Source-of-truth rule:** `graph.json` is authoritative for nodes, edges, types, and
fingerprints. The markdown files are a **projection** written *from* `graph.json` in
Step 8 — never hand-edited for structure. This prevents the dual-source drift that
[ADR 0038](../../docs/adr/0038-knowledge-graph-orientation.md) retired `domain-map.md`
to eliminate.

---

## Shared helper — module-wide fingerprint

Every fingerprint (here, in `architect`, and in `hooks/graph-stale-detect.sh`) is a
hash over **all source files under the module's `paths`**, not a single entry-point
file — a change to any file in the module marks it stale.

```bash
graph_module_fingerprint() {
  { for root in "$@"; do
      [ -e "$root" ] || continue
      find "$root" -type f \
        -not -path '*/.git/*'   -not -path '*/node_modules/*' \
        -not -path '*/bin/*'    -not -path '*/obj/*' \
        -not -path '*/dist/*'   -not -path '*/.angular/*' \
        -not -path '*/migrations/*' -not -path '*/__pycache__/*' \
        -print0 2>/dev/null
    done; } \
  | sort -z | xargs -0 sha1sum 2>/dev/null | sha1sum | cut -d' ' -f1
}
```
Extend the ignore globs from the detected stack (`.claude/dream-init-state.json`
`detected_stacks`; see `skills/shared/plugin-path-resolution.md`) rather than
hardcoding — e.g. add `*/target/*` for Java, `*/.venv/*` for Python.

---

## Step 1 — Guard: verify the graph exists

```bash
test -f .claude/graph/graph.json && test -f .claude/graph/graph-index.md \
  && echo OK || echo "NO_GRAPH"
```

If `NO_GRAPH`:
```
⚠ No knowledge graph found in .claude/graph/.
  The graph is created by dream-init — run /dream-init first.
```
Stop here. (A pre-3.2 project may have the markdown but no `graph.json`; in that case
build `graph.json` from the existing index + detail files as a one-time migration,
then continue.)

---

## Step 2 — Load state and check the .stale flag

Read `graph.json` (authoritative) into memory: `meta`, `nodes[]`, `edges[]`.
Cross-check the index row set matches `nodes` (report any mismatch as an orphan in
Step 5).

```bash
cat .claude/graph/.stale 2>/dev/null && echo "STALE_FLAG_PRESENT" || echo "NO_STALE_FLAG"
```
The flag (written by the git hook, listing drifted module ids) is a hint only —
Step 3 fingerprint comparison is always authoritative. It is deleted in Step 9.

---

## Step 3 — Fingerprint check for all modules

For each node, recompute its module-wide fingerprint over `node.paths` and compare to
`node.fingerprint`:

```bash
# roots = node.paths with trailing /** stripped
current="$(graph_module_fingerprint $roots)"
[ "$current" = "$node_fingerprint" ] && echo "UNCHANGED $id" || echo "STALE $id $current"
```

Build:
- `UNCHANGED` — matches; skip regeneration
- `STALE` — differs; regenerate detail + re-derive edges (Step 7)
- `MISSING_ROOTS` — none of `node.paths` exist on disk (candidate removal/rename — Step 5)

---

## Step 4 — Detect new modules

Scan for top-level source directories not represented by any node's `paths`. Derive
ignore globs from the detected stack instead of a fixed list:

```bash
find . -mindepth 2 -maxdepth 3 -type d \
  -not -path "./.git/*" -not -path "./.claude/*" \
  -not -path "./node_modules/*" -not -path "./dist/*" \
  -not -path "./bin/*" -not -path "./obj/*" -not -path "./.angular/*" \
  | sort
```
Cross-reference with `.claude/architecture/architecture.md` when a new module's
purpose is unclear. Directories matched by no node become `NEW_MODULES` (Step 7b).

---

## Step 5 — Reconcile removed, renamed, and orphaned modules

- **Renamed** — a `MISSING_ROOTS` node *and* a `NEW_MODULES` candidate with high file
  overlap (same filenames / similar tree): treat as a rename. **Carry the curated
  bounded-context prose forward** to the new node instead of discarding it; update
  `id`, `module`, `domain`, `paths`, `detailFile`, and rewrite edge endpoints that
  referenced the old id. Do not double-count it as new.
- **Removed** — a `MISSING_ROOTS` node with no rename match: **propose removal**
  (relaxes the old "warn only" rule to confirm-then-remove):
  ```
  ⚠ Module '{id}' has no source on disk. Remove it from the graph? [confirm/skip]
  ```
  On confirm, drop the node, its detail file, and every edge that touches it.
- **Orphans** — an index row or detail file with no node, or a node with no detail
  file: repair so index rows == nodes == detail files.

---

## Step 6 — Structure and hub analysis

```
TOTAL = |UNCHANGED| + |STALE| + |NEW_MODULES| (after reconciliation)
```

| Condition | Action |
|---|---|
| `TOTAL ≤ 30`, structure `flat` | stay flat |
| `TOTAL > 30`, structure `flat` | restructure flat→domain (Step 8) |
| `TOTAL > 30`, structure `domain` | stay domain |
| `TOTAL ≤ 30`, structure `domain` | stay domain (never revert) |

**Community grouping (optional):** when restructuring, group modules by *edge-density
community* (which modules actually depend on each other) rather than folder layout
alone, when the coupling is clearer than the directory tree.

**Hub (god-node) flag:** compute each node's total degree (in + out edges). Set
`hub: true` when degree ≥ `max(6, ceil(1.5 × median degree))`. Hubs are excluded from
traversal-load neighborhood expansion so a `Core`/`Common` module never blows the
token budget.

Report the plan before writing:
```
🔄 graph-sync
  Unchanged : {N}   Stale : {N}   New : {N}   Removed : {N}   Renamed : {N}
  Structure : {flat|domain} {→ domain (restructure) if applicable}
  Hubs      : {list of hub module names, or "none"}
```

---

## Step 7 — Regenerate stale/new nodes (build structure, not files yet)

For each `STALE` and `NEW_MODULES` entry, update the in-memory node + its edges:

### 7a — Node fields
- `type` — classify from the entry point / folder role: `service`, `repository`,
  `ui`, `datastore`, `external-api`, `shared-lib`, or `domain`.
- `fingerprint` — the recomputed value from Step 3.
- `entryPoint`, `paths`, `module`, `domain`, `detailFile` — per the schema.

### 7b — Typed edges with confidence (deterministic EXTRACTED)
`EXTRACTED` edges (dependencies visible in source) are produced **deterministically by a
script — not hand-derived** (see Step 8a; ADR 0041). In this step build only what a parser
cannot see: `INFERRED` edges apparent from architecture prose, DI, or dynamic/config wiring,
and `AMBIGUOUS` where unsure. You may set a specific `type`
(`calls`/`reads`/`publishes`/`extends`) and a short `reason` on any edge; when source
confirms that pair the extractor upgrades it to `EXTRACTED` while keeping your `type`/`reason`.
**Never hand-write an `EXTRACTED` edge** — the extractor owns those, and drops stale/dangling.

---

## Step 8 — Write graph.json, then project the markdown

### 8a — Write `graph.json` (authoritative, deterministic)
Sort `nodes` by `id`, `edges` by `(from, to, type)`; keep key order per
`graph-json-schema.md`; 2-space indent; trailing newline. Recompute `meta`
(`generatedAt`, `generator: "graph-sync"`, `structure`, `moduleCount = nodes.length`).

```bash
node -e '
  const fs=require("fs"), p=".claude/graph/graph.json";
  const g=JSON.parse(fs.readFileSync(process.argv[1]||p,"utf8"));  // in-memory model handed in
  g.nodes.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  g.edges.sort((a,b)=>(a.from+a.to+a.type).localeCompare(b.from+b.to+b.type));
  g.meta.moduleCount=g.nodes.length;
  fs.writeFileSync(p, JSON.stringify(g,null,2)+"\n");
'
```
Then derive the source-visible `EXTRACTED` edges **deterministically** (offline, Node stdlib;
parses imports/usings/requires/ProjectReferences locally — raw source never enters context).
Resolve `$PLUGIN_DIR` (see `../shared/plugin-path-resolution.md` §1a) and run:
```bash
node "$PLUGIN_DIR/scripts/graph-extract-edges.js"
```
It rewrites **only** the `EXTRACTED` edges — merging: it preserves your `INFERRED`/`AMBIGUOUS`
edges (upgrading a matching pair to `EXTRACTED` when source confirms it) and drops stale/dangling
ones — never touches `nodes` or `fingerprint`s, and re-emits `graph.json` in the deterministic
format above. Confirm: `✓ Written: .claude/graph/graph.json (~N tokens)`.

### 8b — Project the detail files (only stale/new/renamed)
For each changed node, write `.claude/graph/<detailFile>` per
`graph-module-schema.md`: `paths:` frontmatter (first root), ambient-context comment,
`_Fingerprint: {node.fingerprint} | Updated: {TODAY}_`, the four sections, and — when
it fits under 400 tokens — a `**Depended on by:**` line listing the node's dependents
(edges where `to == id`; derived, not stored). Write silently.

### 8c — Project the index
Rewrite `graph-index.md` per `graph-index-schema.md` (one row per node, updated
`Generated`/`Modules`/`Structure`) whenever any node changed or structure changed.
On flat→domain restructure, move detail files into `<domain>/`, update each file's
`paths:` and the node `detailFile` values.

---

## Step 9 — Update state and clean up

```bash
node -e "
  const fs=require('fs'), sp='.claude/dream-init-state.json';
  let s={}; try{s=JSON.parse(fs.readFileSync(sp,'utf8'))}catch(e){}
  s.graphGeneratedAt=new Date().toISOString().slice(0,10);
  s.graphStructure='{flat|domain}';
  fs.writeFileSync(sp, JSON.stringify(s,null,2));
"
rm -f .claude/graph/.stale && echo "✓ .stale flag cleared"
```

---

## Step 10 — Report

```
✅ graph-sync complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ {N} unchanged
  ↺ {N} refreshed  {module names}
  + {N} added      {module names, or "none"}
  − {N} removed    {module names, or "none"}
  ⇄ {N} renamed    {old→new, or "none"}
  Structure: {flat|domain}   Hubs: {names or none}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
If dependency **cycles** were found, list them (warn — do not fail):
```
⚠ Dependency cycle(s) detected (not an error — bidirectional deps can be legitimate):
  orders → payments → orders
  Add to an allowlist if intended, or refactor.
```

---

## Hard rules

- `graph.json` is authoritative; markdown is projected from it — never the reverse
- NEVER echo file content to chat — write-silent rule applies to all graph writes
- NEVER regenerate unchanged modules — the module-wide fingerprint must differ first
- NEVER emit an `EXTRACTED` edge not found in source; guessed edges are `INFERRED`/`AMBIGUOUS`
- NEVER emit a dangling edge — drop edges whose endpoint is not a node
- NEVER revert domain structure back to flat — only ever promote flat→domain
- NEVER exceed 400 tokens in any detail file, or 350 in the index
- Removed modules are confirm-then-remove; renames carry curated prose forward
- Write `graph.json` deterministically (stable sort + key order) so diffs stay minimal
