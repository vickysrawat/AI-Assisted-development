# Rule Refresh Spec
_Spec version: 1.0 · Created: 2026-09-16_
_Consumed by: `REFRESH RULES` keyword handler_

Performs an on-demand, per-file three-way diff and refresh of deployed rule files
in `.claude/rules/`. The canonical source is the plugin's `_project-deploy/rules/`;
the snapshot at deploy time is the baseline; the current on-disk file may carry
developer edits.

---

## Artifacts written at deploy time (by `setup-init-bootstrap.cjs`)

| Artifact | Location | Purpose |
|---|---|---|
| Canonical snapshot | `.claude/rules/.snapshots/{file}` | **A** — what was deployed; basis for developer-edit detection |
| Deploy metadata | `.claude/rules/.deploy-meta.json` | Per-file `deployedAt` + `pluginVersion`; read by `setup-status` staleness check |
| Hash file | `.claude/rules/.hashes` | Tamper/edit detection (existing mechanism) |

`.snapshots/` is gitignored (regenerable, per-machine). `.deploy-meta.json` and `.hashes`
are committed — they are the durable staleness and integrity record.

---

## Invocation

```
REFRESH RULES              — refresh all deployed rule files, one at a time
REFRESH RULES {filename}   — refresh one specific file (e.g. REFRESH RULES angular-rules.md)
```

`{filename}` is the bare filename, not a path. The file must appear in
`.claude/rules/_deploy-manifest.json` → `deployed_rules`.

---

## Step 0 — Resolve scope

```bash
node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('.claude/rules/_deploy-manifest.json', 'utf8'));
  console.log((m.deployed_rules || []).join('\n'));
"
```

- If `REFRESH RULES {filename}`: verify the file is in `deployed_rules`; stop with an error
  if not (file may be developer-created, not plugin-managed — do not touch it).
- If `REFRESH RULES` (no argument): process all files in `deployed_rules`, one at a time.

---

## Step 1 — Load three-way inputs for each file

For each file being refreshed, load:

```bash
node -e "
  const fs   = require('fs');
  const path = require('path');
  const file = process.argv[1];

  const A_path = path.join('.claude', 'rules', '.snapshots', file);   // deployed snapshot
  const B_path = path.join('.claude', 'rules', file);                  // current on-disk
  const C_path = '<PLUGIN_DIR>/_project-deploy/rules/' + file;         // plugin canonical

  const A = fs.existsSync(A_path) ? fs.readFileSync(A_path, 'utf8') : null;
  const B = fs.existsSync(B_path) ? fs.readFileSync(B_path, 'utf8') : null;
  const C = fs.existsSync(C_path) ? fs.readFileSync(C_path, 'utf8') : null;

  const hashOf = t => t ? require('crypto').createHash('sha256').update(t).digest('hex') : null;
  console.log(JSON.stringify({
    hasSnapshot: !!A,
    hashA: hashOf(A), hashB: hashOf(B), hashC: hashOf(C),
    aEqualsB: A && B && hashOf(A) === hashOf(B),
    aEqualsC: A && C && hashOf(A) === hashOf(C),
    bEqualsC: B && C && hashOf(B) === hashOf(C),
  }));
" -- {file}
```

Classify the case:

| hashA==hashB | hashA==hashC | hashB==hashC | Case |
|:---:|:---:|:---:|---|
| ✓ | ✓ | ✓ | **Nothing changed** — skip (report as current) |
| ✓ | — | — | **Plugin updated only** — clean apply; no developer edits to preserve |
| — | ✓ | — | **Developer edited only** — show dev's edits; no plugin update to apply |
| — | — | — | **Both changed** — true three-way diff needed |
| (no snapshot) | — | — | **No baseline** — degrade to two-way B vs C diff with a warning |

---

## Step 2 — Compute and display the diff

### Case: Plugin updated only (A==B, A≠C)

```
── {file} ────────────────────────────────────────────────
Plugin update available — no developer edits to preserve.

+++ Plugin changes (deployed v{A_pluginVer} → current v{C_pluginVer}):
{unified diff A→C}
```

### Case: Developer edited only (A==C, A≠B)

```
── {file} ────────────────────────────────────────────────
No plugin update. Your customisations since deploy ({deployedAt}):

~~~ Your edits (vs deployed baseline):
{unified diff A→B}

Nothing to update from the plugin. Run REFRESH RULES to refresh the deploy
date, or SKIP to leave it unchanged.
```

### Case: Both changed — three-way diff

```
── {file} ────────────────────────────────────────────────
Both the plugin and your local copy have changed since deploy ({deployedAt}).

+++ Plugin changes (v{A_pluginVer} → v{C_pluginVer}):
{unified diff A→C, 3 lines context}

~~~ Your edits (vs deployed baseline):
{unified diff A→B, 3 lines context}

⚠ Conflicts (lines changed by both):
{list any line ranges that appear in both diffs}
```

### Case: No snapshot (degrade gracefully)

```
── {file} ────────────────────────────────────────────────
⚠ No deploy snapshot found — showing two-way diff only (developer edits
  cannot be isolated from plugin changes without the baseline).

Current file vs plugin canonical:
{unified diff B→C}
```

---

## Step 3 — Propose merged result

After showing the diff, propose the merged file content:

- **Plugin updated only**: proposed = C (the plugin's latest).
- **Developer edited only**: proposed = B (keep as-is; offer to update `deployedAt` stamp only).
- **Both changed / no conflict**: proposed = C with developer's non-conflicting edits re-applied.
- **Both changed / conflict**: mark conflict regions with `<<<<<<< YOUR EDIT / ======= / >>>>>>> PLUGIN` and stop — do not propose until conflicts are resolved. Ask the developer to resolve and re-run.

Show:
```
Proposed merged {file}:
─────────────────────────────────────────────
{full proposed content}
─────────────────────────────────────────────
📁 WRITE PENDING — reply APPROVED to write, or SKIP to leave unchanged.
   Path: .claude/rules/{file}
```

---

## Step 4 — Write on APPROVED, update artifacts

On `APPROVED`:
1. Write the merged content to `.claude/rules/{file}`.
2. Update `.claude/rules/.snapshots/{file}` — the new snapshot is C (the plugin canonical),
   so the next refresh correctly treats the new deployed version as the baseline.
3. Update `.claude/rules/.deploy-meta.json` — set `deployedAt` to today, `pluginVersion` to C's
   version, for this file.
4. Recompute `.claude/rules/.hashes` entry for this file.

On `SKIP`: leave all artifacts unchanged.

---

## Step 5 — Summary (after all files processed)

```
REFRESH RULES complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Updated  : {list of APPROVED files}
  Skipped  : {list of SKIP files}
  Current  : {list of files with no changes}
  Conflict : {list of files with unresolved conflicts — must resolve manually}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run /setup-status to verify all rule staleness checks are green.
```

---

## Hard rules

- **Never touch files not in `deployed_rules`** — developer-created rule files are off-limits.
- **Never auto-merge conflicts** — a line changed by both plugin and developer always surfaces for human resolution; APPROVED is never granted on a conflicted file.
- **Verbatim-locked presets** (currently none in rule files, but if a `<!-- LOCKED -->` marker exists on line 1 of a plugin rule): plugin changes apply; developer additions are preserved in an appended section; locked lines are never overwritten by developer edits.
- **SKIP does not reset the deploy date** — only APPROVED updates `.deploy-meta.json`.
