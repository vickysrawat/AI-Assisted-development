---
description: Targeted architecture doc refresh — re-reads only changed parts of the codebase and updates the prose architecture docs (architecture.md) without a full re-scan. Also re-runs the deployment questionnaire via --deployment. For the codebase module graph, use /graph-sync (incremental, fingerprint-based). Much cheaper than re-running the full architect skill.
argument-hint: "[--deployment | path]  —  --deployment re-runs the deployment questionnaire; a path (e.g. src/services/matters/) refreshes that subtree; omit to auto-detect changed areas"
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `skills/shared/model-routing-spec.md` for the full specification.

---

# /update-arch — Targeted architecture doc refresh

Refreshes the relevant sections of the prose `architecture.md` for areas that have
changed since the last architect run, and (via `--deployment`) re-runs the
deployment questionnaire. Costs 5–10% of a full architect skill run for incremental
changes.

> **Orientation graph:** the codebase module graph (`.claude/graph/`) is refreshed
> **separately** by `/graph-sync` — it is fingerprint-based and incremental
> ([ADR 0038](../docs/adr/0038-knowledge-graph-orientation.md)). `/update-arch`
> no longer touches orientation data (the former `domain-map.md` was retired in
> v3.0.0). Run `/graph-sync` after structural changes; run `/update-arch` to keep
> the prose docs current.

Use this after:
- A change that alters the system overview or layer responsibilities in `architecture.md`
- With `--deployment` to capture or re-capture the deployment questionnaire

For a complete re-scan of all architecture docs, use `dream-init` instead.
For module/orientation refresh, use `/graph-sync`.

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

> **Refresh `architecture-deployment.md` when any of these change** (it has no
> automated fingerprint — treat it as stale if any changed since its `_Generated:` date):
> CI/CD pipeline YAML (`azure-pipelines*.yml`, `.github/workflows/*`); IIS publish
> profiles (`*.pubxml`) or `web.config`; Docker/container config; the environment
> list or promotion order; the auth strategy (Entra ID tenant, API key scheme, JWT
> issuer). Consumed by `app-readiness` (blocks if missing), `icea-feature` (Context),
> and `plugin-readiness` (AI-1 scoring).

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

## Step 2 — Detect changed areas

Read the current prose docs and identify which source areas changed since the last refresh.

```bash
cat .claude/architecture/architecture.md 2>/dev/null || echo "NO_ARCH"
# Source areas touched by recent commits (rename/add/delete + modifications)
git log -1 --name-only --format="" 2>/dev/null | sed 's#/[^/]*$##' | sort -u
```

If `NO_ARCH`:
```
⚠ No architecture.md found at .claude/architecture/architecture.md.
Run /dream-init to generate the architecture docs from scratch.
```
And stop.

**If a path argument was given (Step 1):** scope detection to that subtree.
**If no argument:** use the changed source areas from the git listing above.

> The module orientation graph is **not** refreshed here — if `.claude/graph/.stale`
> is present, tell the developer to run `/graph-sync` (it refreshes only stale
> modules). `/update-arch` refreshes the prose `architecture.md` only.

If nothing relevant changed:
```
✅ architecture.md is current — no structural changes detected. Nothing to update.
   (For module orientation, run /graph-sync if the graph is stale.)
```
And stop.

---

## Step 3 — Report refresh scope

```
🔄 Architecture prose refresh scope
  Changed areas : {list of source areas whose files changed}
  Graph note    : {"graph is stale — run /graph-sync" | "graph current"}
  architecture.md sections to touch : {list}
```

---

## Step 4 — Source file consent gate, then read changed entry-point files

Before reading any source file, apply `skills/shared/source-file-consent.md`
(Category B). Present one consolidated gate for all files needed:

```
📂 Source file scan request

  Files   : {entry-point files for the changed areas}
  Why     : These areas changed since the last architecture update. Reading them
            refreshes the affected sections of architecture.md.
  Looking for: Class/component structure, public interface, key dependencies
  Token cost: ~{N files × estimate each}

Read these files to update architecture.md? (yes / no / read fewer files)
```

If declined → leave the affected `architecture.md` sections unchanged and note it.
If partial → read only the confirmed files; mark others as "not refreshed".

For each area confirmed, read only the representative entry-point file(s) — do NOT
read unrelated files.

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
✅ architecture.md updated

  Updated sections : {list}
  Generated        : {today's date}

  Files written:
    .claude/architecture/architecture.md

  Graph: {"⚠ stale — run /graph-sync" | "current"}

Next: run /dream-status to confirm the architecture checks are ✅ Green.
```

---

## Hard Rules

- NEVER read source files for unchanged areas
- NEVER touch the knowledge graph (`.claude/graph/`) — that is `/graph-sync`'s job
- Update only the `architecture.md` sections whose source areas changed — leave the rest verbatim
- If an entry-point file no longer exists, note it in the affected section rather than
  silently removing content
