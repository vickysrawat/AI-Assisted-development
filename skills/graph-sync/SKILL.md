---
name: graph-sync
description: >
  Incremental refresh of the codebase knowledge graph in .claude/graph/.
  graph.json is the authoritative structure (typed nodes, typed edges with
  confidence, module-wide fingerprints); the markdown index and per-module detail
  files are its generated projection. Recomputes module-wide fingerprints, regenerates
  only stale modules, detects new/removed/renamed modules, derives typed dependency
  edges from source imports, flags hub (god) nodes, and restructures flat→domain past
  30 modules. Also syncs external dependency nodes (external-api, database, message-bus,
  shared-library, upstream-app, downstream-app, storage, identity-provider) from
  architecture-integrations.md, architecture-data.md, and architecture-deployment.md —
  enabling ICEA to skip those doc reads and use the graph instead (token saving).
  Deletes the .stale flag on success.
  Triggered by /ai-assisted-development:graph-sync.
  Also triggers on: "refresh knowledge graph", "update graph", "graph is stale",
  "sync the graph", "knowledge graph stale".
---

# Graph Sync Skill

_Skill version: 2.0 · Last changed: 2026-07-03 · Plugin compatibility: ≥3.3.0 · Consent: B_

Effort tier: **low** (infrastructure, deterministic structure). Use `--effort medium`
only when module layout has significantly changed and boundaries are ambiguous.

**No-flag prompt** (per `$PLUGIN_DIR/skills/shared/flag-prompt-spec.md`): if invoked with no
`--effort` flag **in an interactive session**, ask via `AskUserQuestion` — **low** (recommended)
or **medium** — before syncing; do not default silently. In CI / headless / gate-invoked runs
(e.g. `session-start`, `setup-*`), skip the prompt and use `--effort low`.

**Consent (Category B):** graph-sync reads entry-point and source files to derive
module content and dependency edges. It is plugin infrastructure with no B-series
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
ADR 0038 retired `domain-map.md`
to eliminate.

---

## Resolve PLUGIN_DIR — do this first, before any step

Read `.claude/plugin-path.txt` to get PLUGIN_DIR. If absent or empty, use the §1a resolver:

```bash
node -e "const fs=require('fs'),os=require('os'),path=require('path');const base=path.join(os.homedir(),'.claude','plugins');const norm=p=>p?p.split(String.fromCharCode(92)).join('/'):'' ;let dir='';try{const reg=JSON.parse(fs.readFileSync(path.join(base,'installed_plugins.json'),'utf8'));const key=Object.keys(reg.plugins||{}).find(k=>k.startsWith('ai-assisted-development@'));if(key){const a=reg.plugins[key]||[];const e=a.find(x=>x.scope==='user')||a[0];if(e&&e.installPath&&fs.existsSync(e.installPath))dir=e.installPath;}}catch(e){}if(!dir){try{for(const m of fs.readdirSync(base)){const p=path.join(base,m,'plugins','ai-assisted-development');if(fs.existsSync(p)){dir=p;break;}}}catch(e){}}process.stdout.write(norm(dir));"
```

If resolution produces an empty string, stop immediately:
```
⛔ Cannot resolve plugin directory — plugin-path.txt is missing or empty and the
   registry lookup failed. Run /setup-sync to repair, then retry.
```
Store as PLUGIN_DIR. All `$PLUGIN_DIR` references in this skill use this value.

---

## Persona

Execute as **[SA] Rafael Mendes — Solution Architect** (16 yrs). The judgment steps — classifying
node types, inferring `INFERRED`/`AMBIGUOUS` edges a parser cannot see (DI, dynamic/config wiring),
detecting renames, and grouping domains by edge-density — are architectural calls; optimize for a
coherent, operable picture and always ask "where are the seams and who owns each?" Weigh [TL]
"does this match how we build?" Reason in this project's actual stack per layer, never a fixed one.

The persona sets *what to scrutinize* — it never licenses assumption. The source, imports, and
manifests are the only sources of truth; classify and infer from what the code actually shows, never
from what a persona would "expect" (subordinate to CLAUDE.md §3 / decision transparency). The
deterministic parts (fingerprints, `graph-extract-edges.js`) are unaffected. Never name the persona
in any graph artifact. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

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
  The graph is created by setup-init — run /setup-init first.
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

## Step 2x — Sync external dependency nodes from architecture docs

Parse the three architecture docs that record cross-system boundaries and upsert
external dependency nodes into the in-memory graph. This step runs after Step 2
(state loaded) and before Step 3 (fingerprint check) so external nodes participate
in the same stale/unchanged accounting.

**No source scanning.** External nodes are derived from architecture docs only —
never from source imports. The `graph-extract-edges.js` extractor (Step 8a) does
not touch external nodes or their edges.

### 2x-a — Parse `architecture-integrations.md` → external-api, upstream-app, downstream-app

```bash
cat .claude/architecture/architecture-integrations.md 2>/dev/null || echo "NOT_FOUND"
```

For each named external service / upstream / downstream found:
- Determine type: `external-api` (this app calls it) · `upstream-app` (it feeds data in) · `downstream-app` (this app feeds data out)
- Set `direction`: `outbound` for external-api/downstream-app · `inbound` for upstream-app
- Build a stable `id`: kebab-case of the service name (e.g. `payments-api`, `notifications-svc`)
- Fingerprint = `sha1(doc-entry-text)` — changes when the entry in the doc changes

**Locally-cloned dependency detection (merge-map).** Also parse the optional
`## Locally-Cloned Dependency Repos` table in the same file. For each row:

1. Resolve the `Local path` cell relative to the repo root to an absolute, forward-slashed path.
2. Check whether any root in `additionalDirectories` (`.claude/settings.local.json`) resolves to
   that same absolute path (compare normalised, case-insensitive on Windows).
3. **If matched** — add to the **in-memory `localPathMeta` map** (keyed by the normalised
   `additionalDirectories` absolute path). Entry shape:
   ```json
   { "direction": "<Direction cell>", "type": "<tier→type mapping below>", "label": "<Repo name cell>" }
   ```
   **Do not** create a stub external node for this row — the real node comes from source
   scanning in Step 4 / 7 (see Step 2x-d).
4. **If not matched** (path in doc but absent from `additionalDirectories`) — log:
   `⚠ architecture-integrations.md references Local path "{path}" but it is not in additionalDirectories — creating stub node`
   and create a stub node as normal.

Tier → `type` mapping applied when building the `localPathMeta` entry:

| Tier value | Node `type` |
|---|---|
| `service` | `service` |
| `ui` | `ui` |
| `repository` | `repository` |
| `shared-library` | `shared-library` |
| `datastore` | `datastore` |
| `domain` | `domain` |

`localPathMeta` is in-memory only for this graph-sync run — never written to disk.

### 2x-b — Parse `architecture-data.md` → database nodes

```bash
cat .claude/architecture/architecture-data.md 2>/dev/null || echo "NOT_FOUND"
```

For each named data store (SQL Server, Redis, CosmosDB, etc.):
- Type: `database`
- Direction: `bidirectional` (most databases are read+write; set `outbound` if read-only)
- `tech`: the database engine/protocol

### 2x-c — Parse `architecture-deployment.md` → message-bus, storage, identity-provider nodes

```bash
cat .claude/architecture/architecture-deployment.md 2>/dev/null || echo "NOT_FOUND"
```

For each named message bus / queue / topic, blob store, or identity provider:
- Type: `message-bus` · `storage` · `identity-provider`
- Direction: infer from context (publishes → outbound; subscribes → inbound; both → bidirectional)

### 2x-d — Upsert nodes and derive edges

**Skip merge-map entries first.** Before upserting any parsed external dependency, check if its
entry was added to `localPathMeta` in Step 2x-a. If so, skip the upsert and edge derivation
entirely — the real node with full source detail is built in Steps 4/7 and enriched from
`localPathMeta` in Step 7a. No stub node, no stub edges.

For each remaining (non-merge-map) external dependency:

1. **Find existing node** by `id`. If found and fingerprint matches → UNCHANGED (skip). If fingerprint differs → STALE (regenerate detail file in Step 8b). If not found → NEW external node.

2. **Write/update node fields** in memory:
   ```json
   {
     "id": "{kebab-id}",
     "module": "{DisplayName}",
     "domain": "external",
     "type": "{type}",
     "external": true,
     "tech": "{tech}",
     "direction": "{direction}",
     "source": "{source-doc-filename}",
     "detailFile": "graph/{kebab-id}.md",
     "entryPoint": "",
     "paths": [],
     "fingerprint": "{doc-entry-sha1}",
     "hub": false
   }
   ```

3. **Derive edges** (INFERRED confidence — architecture doc is authoritative but not source-extracted):
   - `external-api`, `upstream-app`, `downstream-app`: find internal module nodes whose detail file's Dependencies or Patterns sections mention this dependency → add typed edge. Edge type from direction: outbound external-api → `calls`; upstream-app (inbound) → `fed-by`; downstream-app (outbound) → `feeds`.
   - `database`: modules mentioning the DB in Dependencies → `reads` and/or `writes` edges (check detail file text for read-only vs read-write).
   - `message-bus`: modules mentioning the bus → `publishes` and/or `subscribes` (infer from "producer"/"consumer" language in the detail file).
   - `shared-library`: modules whose package manifest lists the library → `uses`.
   - `identity-provider`: modules whose detail file mentions auth/token → `calls`.

4. **Remove stale external nodes**: if a node has `external: true` and its `source` doc no longer mentions it → propose removal (same confirm/skip flow as Step 5).

Include external node counts in the Step 6 report line:
```
  External  : {N unchanged} unchanged, {N new} new, {N stale} stale, {N removed} removed
```

---

## Step 3 — Fingerprint check for all modules

For each node, recompute its module-wide fingerprint over `node.paths` and compare to
`node.fingerprint`:

```bash
# roots = node.paths with trailing /** stripped.
# For a dependency module (node.sourceRoot set), prefix each root with sourceRoot so the
# fingerprint resolves against the dependency repo, e.g.  roots="$sourceRoot/src/Core".
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
ignore globs from the detected stack instead of a fixed list. Scan the **repo root and
each dependency root** (`additionalDirectories`) — graph orientation is read-only, so it
includes dependency repos by default (see `$PLUGIN_DIR/skills/shared/multi-root-scan.md`):

```bash
# Repo root:
find . -mindepth 2 -maxdepth 3 -type d \
  -not -path "./.git/*" -not -path "./.claude/*" \
  -not -path "./node_modules/*" -not -path "./dist/*" \
  -not -path "./bin/*" -not -path "./obj/*" -not -path "./.angular/*" \
  | sort
# Each dependency root DEP from additionalDirectories (same exclusions), then tag any
# discovered module with sourceRoot=DEP so its paths stay relative to DEP:
#   find "$DEP" -mindepth 2 -maxdepth 3 -type d ... | sort
```

> **S6 / ADR 0056:** `scripts/module-derive.cjs` uses the same bounded-context heuristic
> and the same exclusion list as this `find` command to derive the initial module skeleton
> during setup-init (multi-root: repo + `additionalDirectories`). Keeping both in sync ensures
> the FIRST `/graph-sync` after setup does not detect spurious renames. If you update the
> exclusion list here, update `module-derive.cjs`'s `EXCLUDE_DIRS` set and vice versa.

Cross-reference with `.claude/architecture/architecture.md` when a new module's
purpose is unclear. Directories matched by no node become `NEW_MODULES` (Step 7b); a
dependency-root directory becomes a `NEW_MODULES` entry carrying `sourceRoot`.

**Unannotated dependency root warning.** For each `additionalDirectories` root processed
in this step, check whether `localPathMeta` (built in Step 2x-a) has an entry for it.
If not, emit this warning **once per root** in the Step 6 report (not as a hard stop):
```
⚠ {sourceRoot} is in additionalDirectories but has no direction/tier annotation
  in architecture-integrations.md § Locally-Cloned Dependency Repos.
  Run /update-arch --integrations to annotate it — using folder-based inference as fallback.
```
This warning is informational; graph-sync continues and classifies the module by inference.

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

**Merge-map lookup (`sourceRoot` nodes only).** When the node being built has `sourceRoot` set,
look up `localPathMeta[node.sourceRoot]`:
- **Found** → set `node.direction`, `node.type`, and (if not already curated) `node.module`
  from the map entry. These fields are **not overwritten by inference below** — skip the
  folder-based type/direction steps for this node.
- **Not found** → apply normal inference (no behaviour change for unannotated repos).

- `type` — classify from the entry point / folder role: `service`, `repository`,
  `ui`, `datastore`, `external-api`, `shared-lib`, or `domain`.
- `fingerprint` — the recomputed value from Step 3.
- `entryPoint`, `paths`, `module`, `domain`, `detailFile` — per the schema.
- `sourceRoot` — for a dependency module, carry it forward (renames) or set it (new dep
  module) so `paths`/`entryPoint` resolve against the dependency repo. Repo-local modules
  omit it. Detail file gets a `<!-- sourceRoot: {node.sourceRoot} -->` comment (8b).

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

### 8d — Build directory catalog (in memory, before 8a writes)

Run these `find` commands from the project root and populate `directoryCatalog`
on the **in-memory graph object** before Step 8a writes `graph.json`. This way
the single 8a write includes the catalog, and `graph-extract-edges.js` (which
runs after 8a and touches only `edges[]`) leaves `directoryCatalog` untouched.

> Scope: the catalog describes **this** app's deployment topology, so it stays repo-only
> (the `find .` calls are intentional). Dependency modules are graph nodes, but a
> dependency's own static/config/test dirs are its concern — not this app's catalog.

```bash
# Requires GNU grep for -oP (Linux / Git Bash on Windows).
# On macOS: brew install grep and alias grep=ggrep, or use ggrep directly.

# Static-serving directories — Part 1: name-based discovery
STATIC_DIRS_NAMED=$(find . \
  -not -path "./.git/*" -not -path "./node_modules/*" \
  -not -path "./dist/*" -not -path "./bin/*" -not -path "./obj/*" \
  -type d \( -name "public" -o -name "wwwroot" -o -name "assets" \
    -o -name "static" -o -name "StaticFiles" -o -name "Content" \) \
  | sed 's|^\./||' | sort)

# Static-serving directories — Part 2: config-based discovery (custom source paths in code)
# Build output directories (Angular outputPath, Next.js distDir) are intentionally excluded —
# build output is out of scope by nature; the risk is source files committed and served directly.

# .NET: UseStaticFiles with a PhysicalFileProvider path
DOTNET_STATIC=$(grep -rn --include="*.cs" "UseStaticFiles" . 2>/dev/null \
  | grep -v "node_modules\|\.git\|bin\|obj" \
  | grep -oP '(?<=PhysicalFileProvider\()[^)]+' \
  | grep -oP '"[^"]*"' | tr -d '"' | sort -u)

# Node.js / Express: express.static('path')
NODE_STATIC=$(grep -rn --include="*.js" --include="*.ts" --include="*.mjs" \
  'express\.static(' . 2>/dev/null \
  | grep -v "node_modules\|\.git\|dist" \
  | grep -oP "express\.static\(\s*['\"]([^'\"]+)['\"]" \
  | grep -oP "['\"][^'\"]+['\"]" | tr -d "'\"" | sort -u)

# Nginx: root directive — relative paths only (absolute paths are deployment-time, not repo paths)
NGINX_STATIC=$(find . \( -name "*.conf" -o -name "*.nginx" \) 2>/dev/null \
  | grep -v "\.git\|node_modules" \
  | xargs grep -h "^\s*root " 2>/dev/null \
  | grep -oP "root\s+\K[^;]+" \
  | grep -v '^/' \
  | sort -u)

# Merge name-based and config-based, deduplicate
NEWLY_DISCOVERED=$(printf '%s\n' $STATIC_DIRS_NAMED $DOTNET_STATIC $NODE_STATIC \
  $NGINX_STATIC \
  | grep -v '^$' | sort -u)

# Config / infrastructure directories
CONFIG_DIRS=$(find . \
  -not -path "./.git/*" -not -path "./node_modules/*" \
  -maxdepth 3 -type d \( -name "environments" -o -name "env" \
    -o -name ".github" -o -name "infra" -o -name "terraform" \
    -o -name "k8s" -o -name "helm" \) \
  | sed 's|^\./||' | sort)

# Test directories
TEST_DIRS=$(find . \
  -not -path "./.git/*" -not -path "./node_modules/*" \
  -not -path "./dist/*" -maxdepth 4 \
  -type d \( -name "test" -o -name "tests" -o -name "__tests__" \
    -o -name "spec" -o -name "e2e" -o -name "cypress" \) \
  | sed 's|^\./||' | sort)
```

Add the results to the in-memory graph as:
```javascript
const existingCatalog  = g.directoryCatalog || {};
const existingStatic   = existingCatalog.staticServing || [];

// Fix 1 — preserve manually-added paths: when reviewed:true, the developer may have added
// paths that no automated scan can detect. Merge so those survive a re-sync.
const mergedStatic = existingCatalog.reviewed === true
  ? [...new Set([...NEWLY_DISCOVERED, ...existingStatic])]
  : NEWLY_DISCOVERED;

// Fix 2 — reset reviewed when new paths are discovered: if the automated scan found
// paths that weren't in the previous catalog, the developer needs to re-validate.
// (Paths that drop out of the scan but were already in the list are retained via
// the merge above and caught by the path-existence check in the security skill.)
const newPathsDiscovered = NEWLY_DISCOVERED.some(p => !existingStatic.includes(p));
const preserveReviewed   = existingCatalog.reviewed === true && !newPathsDiscovered;

g.directoryCatalog = {
  generatedAt:  TODAY,
  reviewed:     preserveReviewed,
  staticServing: mergedStatic,
  config:       CONFIG_DIRS,
  test:         TEST_DIRS,
};
```

Empty arrays are valid (project has no matching directories). Announce:
```
📂 Directory catalog: {N} static-serving ({X} by name, {Y} from config) · {M} config · {K} test directories
```

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
Resolve `$PLUGIN_DIR` (see `$PLUGIN_DIR/skills/shared/plugin-path-resolution.md` §1a) and run:
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
a `<!-- sourceRoot: {node.sourceRoot} -->` comment when the node is a dependency module,
`_Fingerprint: {node.fingerprint} | Updated: {TODAY}_`, the four sections, and — when
it fits under 400 tokens — a `**Depended on by:**` line listing the node's dependents
(edges where `to == id`; derived, not stored). Write silently.

### 8c — Project the index
Rewrite `graph-index.md` per `graph-index-schema.md` (one row per node, updated
`Generated`/`Modules`/`Structure`) whenever any node changed or structure changed.
On flat→domain restructure, move detail files into `<domain>/`, update each file's
`paths:` and the node `detailFile` values.

After the module table, append a **Module Summaries** section (per schema § Module
Summaries section): for each node in table order, extract the first sentence of
the "Bounded context" section from its detail file, plus the first key file listed
(and a second if it materially clarifies scope). Write this section on every
graph-index.md rewrite — not only when nodes change.

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
