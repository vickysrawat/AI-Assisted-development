---
description: Targeted architecture doc refresh — re-reads only changed parts of the codebase and updates domain-map.md and architecture.md without a full re-scan. Uses the fingerprint to detect exactly which entry-point files changed. Much cheaper than re-running the full architect skill.
argument-hint: "[--deployment | path]  —  --deployment re-runs the deployment questionnaire; a path (e.g. src/services/matters/) refreshes that subtree; omit to auto-detect changed areas"
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `skills/shared/model-routing-spec.md` for the full specification.

---

# /update-arch — Targeted architecture doc refresh

Refreshes `.claude/architecture/domain-map.md` and the relevant sections of
`architecture.md` for areas that have changed since the last architect run.
Costs 5–10% of a full architect skill run for incremental changes.

Use this after:
- Adding a new service, controller, or Angular component
- Moving or renaming a module
- After the fingerprint check in `dream-status` shows ⚠️ Amber
- With `--deployment` to capture or re-capture the deployment questionnaire

For a complete re-scan of all architecture docs, use `dream-init` instead.

---

## Step 0 — Resolve and lock the mode

Parse the invocation arguments **first**, before any other step. Match the exact
argument string the user provided:

| User typed | MODE | Action |
|---|---|---|
| `--deployment` | `deployment` | Re-run only the deployment questionnaire (this Step 0), then STOP. Do not run Steps 1–7. |
| a file/folder path (e.g. `src/services/matters/`) | `subtree` | Refresh that subtree — skip to Step 1 with the path. |
| (nothing) | `auto` | Auto-detect changed areas — skip to Step 1. |
| anything starting with `--` that is not `--deployment` | `error` | Unknown flag — see below. |

```bash
# ARGS holds the raw invocation arguments
case "$ARGUMENTS" in
  --deployment) echo "MODE=deployment" ;;
  --*)          echo "MODE=error UNKNOWN_FLAG=$ARGUMENTS" ;;
  "")           echo "MODE=auto" ;;
  *)            echo "MODE=subtree PATH=$ARGUMENTS" ;;
esac
```

If `MODE=error`, output and stop:
```
⚠ Unknown flag: {UNKNOWN_FLAG}
   /update-arch supports:  --deployment   (re-run the deployment questionnaire)
                          <path>          (refresh a subtree)
                          (no args)       (auto-detect changed areas)
```

> Note: the command is `/update-arch` (not `/arch-update`). If a user reports a
> "command not found" style error, confirm they used `/update-arch`.

**Only if `MODE=deployment`, continue with the rest of this step. Otherwise go to Step 1.**

---

### Step 0 (deployment mode) — Re-run the deployment questionnaire

This is an explicit **re-capture** request, so it overrides the architect's normal
"already complete → skip" short-circuit. Run the questionnaire even if
`architecture-deployment.md` already exists and has zero unanswered markers —
showing the current values as defaults the developer can keep or change.

1. **Ensure the target file exists before collecting answers.** If
   `.claude/architecture/architecture-deployment.md` is missing, seed it from the
   detected stack's template so there is a real file to write into (this is what
   makes `--deployment` work standalone, without a prior full `dream-init`):

```
!node -e "
const fs=require('fs'); const path=require('path');
const dir='.claude/architecture';
const dest=path.join(dir,'architecture-deployment.md');
fs.mkdirSync(dir,{recursive:true});
if(fs.existsSync(dest)){ console.log('DEPLOY_FILE=exists'); process.exit(0); }
// find any architect deployment template shipped with the plugin to seed from
const roots=['skills/architect/templates'];
let seed=null;
for(const r of roots){ if(!fs.existsSync(r)) continue;
  for(const d of fs.readdirSync(r)){ const f=path.join(r,d,'architecture-deployment.md');
    if(fs.existsSync(f)){ seed=f; break; } } if(seed) break; }
if(seed){ fs.copyFileSync(seed,dest); console.log('DEPLOY_FILE=seeded from '+seed); }
else { fs.writeFileSync(dest,'<!-- TEMPLATE -->\n# Architecture — Deployment & Operations\n\n## Hosting Model\n> \u26a0 Not yet answered\n'); console.log('DEPLOY_FILE=created minimal'); }
"
```

2. Run the architect deployment questionnaire (detection + questions only):
```
Read skills/architect/SKILL.md and execute its Step 0.5 (the deployment
questionnaire) in FORCE mode — do not apply the "already complete → skip"
early-exit, since --deployment is an explicit re-capture. Run the CI/CD and auth
detection, then ask only the questions the filesystem cannot answer, pre-filling
any existing answers from the current architecture-deployment.md as defaults.
Do not run any other step of the architect skill.
```

3. Wait for **APPROVED**, then **write the file explicitly** (do not just describe
   the write — perform it):
```
Write the completed deployment content to
.claude/architecture/architecture-deployment.md, replacing its prior contents.
```

4. **Verify the write** before reporting success:
```
!node -e "
const fs=require('fs'); const F='.claude/architecture/architecture-deployment.md';
if(!fs.existsSync(F)){ console.log('VERIFY_FAIL: file does not exist'); process.exit(1); }
const t=fs.readFileSync(F,'utf8');
const open=(t.match(/Not yet answered/g)||[]).length;
console.log('VERIFY_OK: file written ('+open+' question(s) still marked unanswered)');
"
```

5. On `VERIFY_OK`, confirm:
```
✅ architecture-deployment.md updated
   Written: .claude/architecture/architecture-deployment.md
   Next: run /app-readiness to verify deployment context is complete.
```
On `VERIFY_FAIL`, do not claim success — report the failure and retry the write.

Then stop — do not continue to Step 1.

---

## Step 1 — Parse arguments

If a path argument was provided (e.g. `src/services/matters/`), use that as the
target subtree. Otherwise proceed to Step 2 to auto-detect changed areas.

---

## Step 2 — Read current domain-map and detect changed areas

```bash
cat .claude/architecture/domain-map.md 2>/dev/null || echo "NO_DOMAIN_MAP"
```

If `NO_DOMAIN_MAP`:
```
⚠ No domain-map.md found at .claude/architecture/domain-map.md.
Run /dream-init to generate it from scratch.
```
And stop.

Extract the current fingerprint:
```bash
grep "_Fingerprint:" .claude/architecture/domain-map.md | sed 's/.*_Fingerprint: \([a-f0-9]*\).*/\1/'
```

Extract all entry-point file paths from the domain-map:
```bash
grep "^\- \*\*Entry point\*\*:" .claude/architecture/domain-map.md \
  | sed 's/.*`\(.*\)`.*/\1/'
```

Compute the current fingerprint of those files:
```bash
# For each entry-point path found above:
sha1sum {entry-point-file} 2>/dev/null | awk '{print $1, $2}'
# Then hash all results together (sorted for stability):
echo "{all sha1sum outputs sorted}" | sha1sum | cut -d' ' -f1
```

---

## Step 3 — Identify which areas need refreshing

Compare current entry-point hashes against the stored fingerprint.

**If a path argument was given (Step 1):** refresh only the domain-map areas
whose entry-point files fall under that path.

**If no argument:** refresh only areas where the entry-point file hash has
changed since the stored fingerprint. If all hashes match, report:
```
✅ domain-map.md is current — no entry-point files have changed.
   Fingerprint verified. Nothing to update.
```
And stop.

Also check for new directories that don't appear in any existing area:
```bash
# Detect top-level source directories not mapped in domain-map
find . -mindepth 2 -maxdepth 3 -type d \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./.angular/*" \
  -not -path "./dist/*" \
  -not -path "./bin/*" \
  -not -path "./obj/*" \
  | sort
```

Report what will be refreshed:
```
🔄 Architecture refresh scope
  Changed areas : {list of AreaName from domain-map whose entry-points changed}
  New dirs found: {list of directories not yet in domain-map, if any}
  Unchanged     : {count} areas — skipping
```

---

## Step 4 — Source file consent gate, then read changed entry-point files

Before reading any source file, apply `skills/shared/source-file-consent.md`
(Category B). Present one consolidated gate for all files needed:

```
📂 Source file scan request

  Files   : {list entry-point files for changed areas}
  Why     : The domain-map fingerprint shows these entry-point files changed
            since the last architecture update. Reading them refreshes the
            domain-map entries for {list of area names}.
  Looking for: Class/component structure, public interface, key dependencies
  Token cost: ~{N files × estimate each}

Read these files to update the architecture? (yes / no / read fewer files)
```

If declined → preserve existing domain-map entries for those areas unchanged.
  Add a note: "Entry-point file not read — map entry may be stale."
If partial → read only the confirmed files; mark others as "not refreshed".

For each area confirmed:
1. Read only the entry-point file listed in the domain-map for that area
2. Read the key files listed under that area (max 3)
3. Do NOT read any other files — use directory names and file names for new areas

For the domain-map schema and fingerprint format, refer to:
`skills/shared/domain-map-spec.md` and `skills/architect/SKILL.md` Step 7.

---

## Step 5 — Update domain-map.md

For each changed area:
- Update the `### {AreaName}` block with accurate entry-point, key files, and notes
- For new directories: add a new `### {AreaName}` block

For unchanged areas: copy them verbatim — do not re-derive them.

Recompute the fingerprint over ALL entry-point files (changed and unchanged):
```bash
grep "^\- \*\*Entry point\*\*:" .claude/architecture/domain-map.md \
  | sed 's/.*`\(.*\)`.*/\1/' | sort | xargs sha1sum 2>/dev/null \
  | sha1sum | cut -d' ' -f1
```

Write the updated file:
```bash
!node -e "
const fs = require('fs');
const today = new Date().toISOString().slice(0,10);
const content = String.raw\`REPLACE_WITH_UPDATED_DOMAIN_MAP\`;
fs.writeFileSync('.claude/architecture/domain-map.md', content, 'utf8');
console.log('Written: .claude/architecture/domain-map.md');
"
```

The header must include updated `_Generated:` and `_Fingerprint:` lines.

---

## Step 6 — Update architecture.md (changed sections only)

Read `architecture.md`:
```bash
cat .claude/architecture/architecture.md 2>/dev/null
```

For each area refreshed in Step 4, update the corresponding section in
`architecture.md` if it references that area. Do not touch unrelated sections.

Write back using the same Node.js pattern as Step 5.

---

## Step 7 — Confirm

```
✅ Architecture docs updated

  Updated areas : {list}
  New areas     : {list, or "none"}
  Fingerprint   : {new fingerprint value}
  Generated     : {today's date}

  Files written:
    .claude/architecture/domain-map.md
    .claude/architecture/architecture.md  {(if changed) | (unchanged)}

Next: run /dream-status to confirm check 1f is ✅ Green.
```

---

## Hard Rules

- NEVER read source files for unchanged areas — use the existing domain-map entries
- NEVER overwrite the full domain-map with a blank re-scan — preserve unchanged areas verbatim
- NEVER remove an area from the map — only add or update
- If an entry-point file no longer exists, mark that area with a `⚠ Entry point not found` note
  rather than deleting the area silently
