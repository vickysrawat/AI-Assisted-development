---
name: graph-create
description: >
  Generates the initial codebase knowledge graph in .claude/graph/ during setup-init.
  Reads the module skeleton produced by module-derive.cjs, classifies each module (type,
  domain), computes fingerprints via the bash graph_module_fingerprint helper, runs
  graph-extract-edges.js for EXTRACTED edges, and projects the graph-index.md and
  per-module detail files. Called by setup-init after architect completes. For incremental
  graph refresh use /graph-sync instead.
  Internal helper — not user-invocable directly.
---

# Graph-Create Skill

_Skill version: 1.0 · Last changed: 2026-07-31 · Plugin compatibility: ≥3.14.0 · Consent: B_

> **Supersedes:** architect Step 7 (graph generation). Graph ownership moved here per
> ADR 0056. The orientation-layer decision in ADR 0038 is unchanged — the graph is
> still the single orientation layer; only *who generates it* changed.

> **Internal helper.** Invoked by `/setup-init` Step 3c after architect (Step 3a) completes.
> No command stub. Not user-invocable directly; use `/graph-sync` for incremental refreshes.

---

## Persona

Execute as **[SA] Rafael Mendes — Solution Architect** (16 yrs). Classifies module types,
infers non-parseable relationships, and names domains in terms of **this project's actual
stack** (per `detected_stacks` in `dream-init-state.json`). Persona sets *what to scrutinize*
— never licenses assumption. Classify from what code actually shows. Never name the persona
in any graph artifact. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## Resolve PLUGIN_DIR — do this first, before any step

Read `.claude/plugin-path.txt`. If absent, use the §1a resolver from
`$PLUGIN_DIR/skills/shared/plugin-path-resolution.md`.

---

## Shared helper — module-wide fingerprint

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
    done; } | sort -z | xargs -0 sha1sum 2>/dev/null | sha1sum | cut -d' ' -f1
}
```

---

## Step 1 — Read the module skeleton

```bash
node -e "
const fs = require('fs');
const p = '.claude/graph/.module-skeleton.json';
if (!fs.existsSync(p)) { console.error('SKELETON_MISSING'); process.exit(1); }
const s = JSON.parse(fs.readFileSync(p, 'utf8'));
console.log('MODULES=' + s.moduleCount);
console.log('STRUCTURE=' + s.structure);
"
```

If `SKELETON_MISSING`:
```
⚠ .claude/graph/.module-skeleton.json not found.
  Run: node {PLUGIN_DIR}/scripts/module-derive.cjs
  then re-run this skill.
```
Stop here.

Load the skeleton into memory. Note the `structure` field (`flat` or `domain`) and the
`modules[]` array — each entry has `id`, `module`, `domain`, `paths`, `entryPoint`.

```bash
mkdir -p .claude/graph
TODAY=$(date +%Y-%m-%d)
```

---

## Step 2 — Classify each module and build graph.json in memory

For each module in the skeleton, assemble a full graph.json node per
`$PLUGIN_DIR/skills/shared/graph-json-schema.md`. The skeleton provides structural fields;
this step adds LLM-judgment fields:

**Fields from skeleton (copy directly):** `id`, `module`, `domain` (may be refined),
`paths`, `entryPoint`, `detailFile` (derived: `graph/<module>.md` or
`graph/<domain>/<module>.md` for domain structure).

**Fields added by this skill (LLM judgment):**

- `type` — **required enum** ∈ `service` · `repository` · `ui` · `datastore` ·
  `external-api` · `shared-lib` · `domain`. Classify from the entry point, folder role,
  and what the code under `paths` actually does. When ambiguous, pick closest and note
  it so `/graph-sync` can refine. **Never leave `type` unset or as a non-enum value.**

- `fingerprint` — module-wide hash over ALL files under `paths`:
  ```bash
  # roots = paths[] with trailing /** stripped
  graph_module_fingerprint $roots
  ```

- `hub` — `true` when degree (in + out edges) ≥ `max(6, ceil(1.5 × median degree))`;
  compute after edges are assembled.

- `edges` — `INFERRED`/`AMBIGUOUS` only (edges a parser cannot see: DI, dynamic/config
  wiring, prose-only dependencies). **Never hand-write an `EXTRACTED` edge** — that is
  `graph-extract-edges.js`'s responsibility (Step 4).

**Domain grouping (domain structure only):** when structure is `domain`, group modules by
edge-density community. Update each node's `domain` field accordingly.

---

## Step 3 — Build directoryCatalog in memory (before writing graph.json)

```bash
# Static-serving — name-based
find . -not -path "./.git/*" -not -path "./node_modules/*" \
  -not -path "./dist/*" -not -path "./bin/*" -not -path "./obj/*" \
  -type d \( -name "public" -o -name "wwwroot" -o -name "assets" \
    -o -name "static" -o -name "StaticFiles" -o -name "Content" \) \
  | sed 's|^\./||' | sort

# Static-serving — config-based (.NET PhysicalFileProvider, Express.static, Nginx root)
grep -rn --include="*.cs" "UseStaticFiles" . 2>/dev/null \
  | grep -v "node_modules\|\.git\|bin\|obj" \
  | grep -oP '(?<=PhysicalFileProvider\()[^)]+' \
  | grep -oP '"[^"]*"' | tr -d '"' | sort -u
grep -rn --include="*.js" --include="*.ts" --include="*.mjs" \
  'express\.static(' . 2>/dev/null \
  | grep -v "node_modules\|\.git\|dist" \
  | grep -oP "express\.static\(\s*['\"]([^'\"]+)['\"]" \
  | grep -oP "['\"][^'\"]+['\"]" | tr -d "'\"" | sort -u
find . \( -name "*.conf" -o -name "*.nginx" \) 2>/dev/null \
  | grep -v "\.git\|node_modules" \
  | xargs grep -h "^\s*root " 2>/dev/null \
  | grep -oP "root\s+\K[^;]+" | grep -v '^/' | sort -u

# Config directories
find . -not -path "./.git/*" -not -path "./node_modules/*" \
  -maxdepth 3 -type d \( -name "environments" -o -name "env" \
    -o -name ".github" -o -name "infra" -o -name "terraform" \
    -o -name "k8s" -o -name "helm" \) \
  | sed 's|^\./||' | sort

# Test directories
find . -not -path "./.git/*" -not -path "./node_modules/*" \
  -not -path "./dist/*" -maxdepth 4 \
  -type d \( -name "test" -o -name "tests" -o -name "__tests__" \
    -o -name "spec" -o -name "e2e" -o -name "cypress" \) \
  | sed 's|^\./||' | sort
```

Add to the in-memory graph object:
```javascript
// reviewed defaults false — developer validates via security skill §0.5
g.directoryCatalog = { generatedAt: TODAY, reviewed: false,
  staticServing: [...], config: [...], test: [...] };
```

---

## Step 4 — Write graph.json then run graph-extract-edges.js

Write `graph.json` deterministically (nodes sorted by `id`, edges sorted by `(from, to,
type)`, stable key order per `graph-json-schema.md`, 2-space indent, trailing newline):

```bash
node -e '
  const fs=require("fs"), p=".claude/graph/graph.json";
  const g=JSON.parse(fs.readFileSync(process.argv[1]||p,"utf8"));
  g.nodes.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  g.edges.sort((a,b)=>(a.from+a.to+a.type).localeCompare(b.from+b.to+b.type));
  g.meta.moduleCount=g.nodes.length;
  fs.writeFileSync(p, JSON.stringify(g,null,2)+"\n");
'
```

Then derive EXTRACTED edges (ADR 0041 — deterministic, offline, never hand-written):

```bash
node "$PLUGIN_DIR/scripts/graph-extract-edges.js"
```

Confirm: `✓ Written: .claude/graph/graph.json (~N tokens)`.

---

## Step 5 — Project one detail file per module

For each node, write `.claude/graph/<detailFile>` per
`$PLUGIN_DIR/skills/shared/graph-module-schema.md`: `paths:` frontmatter (first root),
ambient-context comment, `_Fingerprint: {node.fingerprint} | Updated: {TODAY}_`, four
sections (Bounded context, Key files ≤5, Dependencies with types, Patterns), and —
when ≤ 400 tokens — a `**Depended on by:**` line. Write silently; confirm each with
`✓ Written: .claude/graph/<module>.md (~N tokens)`.

---

## Step 6 — Project graph-index.md

Build the index per `$PLUGIN_DIR/skills/shared/graph-index-schema.md` — `paths: always`
frontmatter, header line (`Generated | Modules: N | Structure`), one table row per node
(`Module | Domain | Detail File | Entry Point`). After the module table, append a **Module
Summaries** section: for each node, extract the first sentence of its "Bounded context"
section + its first key file.

---

## Step 7 — Confirm to developer

```
✓ .claude/graph/ written — <N> modules mapped (graph.json + index + detail files)
  Used by: icea-feature · icea-review · code-review · security · graph-viz
  Refresh incrementally with /graph-sync
```

---

## Hard Rules

- NEVER emit an `EXTRACTED` edge — the extractor owns those (ADR 0041)
- NEVER leave `type` unset or non-enum — schema requires it (`service`/`repository`/
  `ui`/`datastore`/`external-api`/`shared-lib`/`domain`)
- NEVER invent modules not in the skeleton — classify only what module-derive found
- NEVER exceed 400 tokens in any detail file
- Write `graph.json` deterministically (stable sort + key order) so diffs stay minimal
- `graph.json` is authoritative; markdown files are projected from it — never the reverse

---

## Model routing

Infrastructure tier — uses `INFRA_MODEL` (default: `claude-sonnet-4-6`).
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

---

## Business context severity

No security findings of its own. If source code surfaced in orientation triggers B1–B7
sensitivity, flag it before continuing. See
`$PLUGIN_DIR/skills/shared/business-context-severity.md`.
