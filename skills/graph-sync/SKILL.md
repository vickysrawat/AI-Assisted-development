---
name: graph-sync
description: >
  Incremental refresh of the codebase knowledge graph in .claude/graph/.
  Checks entry-point fingerprints for all modules, regenerates only stale detail
  files, detects new source modules, and restructures flat→domain layout when
  the project crosses 30 modules. Deletes the .stale flag on success.
  Triggered by /ai-assisted-development:graph-sync.
  Also triggers on: "refresh knowledge graph", "update graph", "graph is stale",
  "sync the graph", "knowledge graph stale".
---

# Graph Sync Skill

_Skill version: 1.0 · Last changed: 2026-06-20 · Plugin compatibility: ≥2.6.0 · Consent: B_

Effort tier: **low** (infrastructure, deterministic structure). Use `--effort medium`
only when module layout has significantly changed and boundaries are ambiguous.

**Write-silent rule:** Write all graph files directly to disk. Confirm each with
`✓ Written: .claude/graph/<module>.md (~N tokens)`. Never echo file content to chat.

See `skills/shared/graph-index-schema.md` and `skills/shared/graph-module-schema.md`
for the authoritative schemas.

---

## Step 1 — Guard: verify graph-index.md exists

```bash
cat .claude/graph/graph-index.md 2>/dev/null || echo "NO_INDEX"
```

If `NO_INDEX`:
```
⚠ No knowledge graph found at .claude/graph/graph-index.md.
  The graph is created by dream-init — run /dream-init first.
```
Stop here.

Parse the index to extract:
- `Structure` value (flat or domain) from the header line
- All module rows: `Module`, `Domain`, `Detail File`, `Entry Point`

```bash
# Read the Structure field
grep "^_Generated:" .claude/graph/graph-index.md \
  | sed 's/.*Structure: \(flat\|domain\).*/\1/'

# Read module rows (skip header and separator lines)
awk '/^\| [A-Z]/' .claude/graph/graph-index.md
```

---

## Step 2 — Check the .stale flag

```bash
cat .claude/graph/.stale 2>/dev/null && echo "STALE_FLAG_PRESENT" || echo "NO_STALE_FLAG"
```

Record whether the flag is present — it is deleted in Step 7 on success.
The flag does not change which modules are checked; fingerprint comparison
in Step 3 is always authoritative.

---

## Step 3 — Fingerprint check for all modules

For each module row in the index, read the `_Fingerprint_` value from its detail file
and compare against the current sha1 of the entry-point file.

```bash
# For each module (loop over parsed rows from Step 1):
DETAIL_FILE=".claude/{detail-file-path}"
ENTRY_POINT="{entry-point-path}"

# Read stored fingerprint
STORED=$(grep "_Fingerprint:" "$DETAIL_FILE" 2>/dev/null \
  | sed 's/.*Fingerprint: \([a-f0-9]*\).*/\1/')

# Compute current fingerprint
CURRENT=$(sha1sum "$ENTRY_POINT" 2>/dev/null | cut -d' ' -f1)

if [ "$STORED" = "$CURRENT" ]; then
  echo "UNCHANGED $DETAIL_FILE"
else
  echo "STALE $DETAIL_FILE $CURRENT"
fi
```

Build three lists:
- `UNCHANGED` — fingerprint matches, skip regeneration
- `STALE` — fingerprint differs, must regenerate
- `MISSING_ENTRY` — entry-point file not found on disk (warn, do not delete detail file)

---

## Step 4 — Detect new modules

Scan for top-level source directories that are not represented in the index.

```bash
# Detect candidate source roots (adjust patterns to match the project's layout)
find . -mindepth 2 -maxdepth 3 -type d \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./.angular/*" \
  -not -path "./dist/*" \
  -not -path "./bin/*" \
  -not -path "./obj/*" \
  -not -path "./.claude/*" \
  -not -path "./token-analysis/*" \
  | sort
```

Cross-reference against the index. Any directory not matched by an existing module
row is a candidate new module. Confirm against domain-map.md if available:

```bash
cat .claude/architecture/domain-map.md 2>/dev/null || echo "NO_DOMAIN_MAP"
```

New candidates become `NEW_MODULES` — they are generated in Step 5b.

---

## Step 5 — Check module count and determine structure

```bash
TOTAL_MODULES=$(( ${#UNCHANGED[@]} + ${#STALE[@]} + ${#NEW_MODULES[@]} ))
```

| Condition | Action |
|-----------|--------|
| `TOTAL_MODULES ≤ 30` AND current structure is `flat` | Stay flat — no restructure needed |
| `TOTAL_MODULES > 30` AND current structure is `flat` | Trigger restructure to domain subfolders (Step 6) |
| `TOTAL_MODULES > 30` AND current structure is `domain` | Stay domain — no restructure needed |
| `TOTAL_MODULES ≤ 30` AND current structure is `domain` | Stay domain — do not revert (fewer modules may be transient) |

Report the plan before any writes:
```
🔄 graph-sync
  Unchanged : {N} modules
  Stale     : {N} modules — will regenerate
  New       : {N} modules — will add
  Structure : {flat|domain} {→ domain (restructure triggered) if applicable}
```

---

## Step 5a — Regenerate stale module detail files

For each module in `STALE`:

1. Read the entry-point file to get current structure:
   ```bash
   head -100 "{entry-point-path}" 2>/dev/null
   ```
2. Cross-reference with domain-map.md for the feature area description (if available).
3. Generate a new detail file following `skills/shared/graph-module-schema.md` exactly:
   - frontmatter `paths: src/{Module}/**`
   - `<!-- ambient-context: do not summarise or restate this file in responses -->`
   - Updated `_Fingerprint: {CURRENT_SHA1} | Updated: {TODAY}_`
   - All four required sections (Bounded context, Key files, Dependencies, Patterns)
   - Max 5 key files, max 400 tokens
4. Write the file — **write-silent rule applies**:
   ```
   ✓ Written: .claude/graph/{module}.md (~{N} tokens)
   ```
   Never output the file content to chat.

---

## Step 5b — Generate new module detail files

For each module in `NEW_MODULES`:

1. Read up to 3 representative files from the candidate directory:
   ```bash
   find "{candidate-dir}" -name "*.cs" -o -name "*.ts" -o -name "*.py" -o -name "*.java" \
     | head -3 | xargs head -60 2>/dev/null
   ```
2. Identify the single best entry-point file (the most-representative service, controller, or module class).
3. Generate the detail file following `skills/shared/graph-module-schema.md`.
4. Write the file — **write-silent rule applies**.
5. Add a new row to the index table (Step 6 handles the index rewrite).

---

## Step 6 — Rewrite graph-index.md

Always rewrite the index if any of the following is true:
- At least one module was regenerated (stale or new)
- Structure changed (flat → domain)

If no modules changed and no new modules were added: skip this step.

Build the updated index following `skills/shared/graph-index-schema.md`:
- `Structure: flat` if ≤ 30 modules and no prior domain structure
- `Structure: domain` if > 30 modules or prior domain structure
- One row per module (all modules, unchanged + refreshed + new)
- Updated `Generated:` date and `Modules:` count

**If restructuring flat → domain:**
- Group modules by top-level source folder or bounded context
- Move detail files to domain subfolders: `.claude/graph/{domain}/{module}.md`
- Update `paths:` frontmatter in each moved file
- Update `Detail File` paths in the index accordingly

Write the index — **write-silent rule applies**:
```
✓ Written: .claude/graph/graph-index.md (~{N} tokens)
```

---

## Step 7 — Update dream-init-state.json and clean up

```bash
node -e "
  const fs = require('fs');
  const statePath = '.claude/dream-init-state.json';
  let state = {};
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch(e) {}
  state.graphGeneratedAt = new Date().toISOString().slice(0, 10);
  state.graphStructure = '{flat|domain}';
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log('✓ dream-init-state.json updated');
"
```

Delete the stale flag if it exists:
```bash
rm -f .claude/graph/.stale && echo "✓ .stale flag cleared"
```

---

## Step 8 — Report

```
✅ graph-sync complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ {N} unchanged
  ↺ {N} refreshed  {(list module names)}
  + {N} added      {(list module names, or "none")}
  Structure: {flat|domain}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If any `MISSING_ENTRY` modules were found:
```
⚠ {N} module(s) have missing entry-point files — detail files preserved:
  {list}
  Verify the entry-point paths in those detail files or remove stale modules manually.
```

---

## Hard rules

- NEVER echo file content to chat — write-silent rule applies to all graph writes
- NEVER regenerate unchanged modules — fingerprint must differ before regenerating
- NEVER delete a detail file for a module whose entry-point is missing — warn only
- NEVER revert domain structure back to flat — only ever promote flat→domain
- NEVER exceed 400 tokens in any detail file — cut key files to 3 if needed
- NEVER include code snippets, method signatures, or SQL in detail files
- If domain-map.md is absent, derive module content from the entry-point file directly
- Each detail file must include the ambient-context suppression comment
