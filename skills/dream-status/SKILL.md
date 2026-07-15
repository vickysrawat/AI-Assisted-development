---
name: dream-status
description: >
  Reports the health of all Dream plugin infrastructure in the current project.
  Shows green/amber/red status for each generated file and initialisation state.
  Use when a developer wants to know if the project is properly set up, whether
  generated files are fresh, or before running dream-init on an existing project.
  Triggers on: "dream status", "plugin status", "check setup", "is dream configured",
  "is the plugin set up", "check plugin health", "what's missing",
  or any request to verify the Dream infrastructure state.
---

# Dream Status Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: C_
Performs a non-destructive health check on all Dream plugin infrastructure.
Reads file metadata only — never modifies anything.

---

## Step 1 — Check each infrastructure item

Run these checks. For each item, record: EXISTS | MISSING | STALE | EMPTY.

### 1a — CLAUDE.md

```bash
ls CLAUDE.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
grep -q "# Dream" CLAUDE.md 2>/dev/null && echo "HAS_DREAM" || echo "NO_DREAM_SECTION"
```

Status:
- `EXISTS + HAS_DREAM` → ✅ Green
- `EXISTS + NO_DREAM_SECTION` → ⚠️ Amber — run dream-init to append Dream section
- `MISSING` → ❌ Red — run dream-init

---

### 1b — memory/

```bash
ls memory/MEMORY.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
ls memory/dream-log.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

Status:
- Both exist → ✅ Green
- Either missing → ❌ Red — run dream-init

---

### 1c — .claude/rules/

`project-rules.md` is mandatory — it must always be present. Stack-specific rules
are checked against what the project's stack signals say should be there.

```bash
# project-rules.md is always required
ls .claude/rules/project-rules.md 2>/dev/null && echo "EXISTS project-rules.md" || echo "MISSING project-rules.md"

# Detect which stack rules SHOULD be present, then verify each one.
# Prefer the cached stack list dream-init wrote; fall back to a tree scan only if the
# state file is absent. Canonical stack->rule table: skills/shared/plugin-path-resolution.md §2
STACKS="$(node -e 'try{const s=JSON.parse(require("fs").readFileSync(".claude/dream-init-state.json","utf8"));process.stdout.write((s.detected_stacks||[]).join(" "));}catch(e){}' 2>/dev/null)"

if [ -n "$STACKS" ]; then
  case " $STACKS " in *" dotnet "*)          HAS_DOTNET=1;;           *) HAS_DOTNET=0;;           esac
  case " $STACKS " in *" dotnet_framework "*) HAS_DOTNET_FRAMEWORK=1;; *) HAS_DOTNET_FRAMEWORK=0;; esac
  case " $STACKS " in *" angular "*)          HAS_ANGULAR=1;;          *) HAS_ANGULAR=0;;          esac
  case " $STACKS " in *" nodejs "*)           HAS_NODEJS=1;;           *) HAS_NODEJS=0;;           esac
  case " $STACKS " in *" javascript "*)       HAS_JAVASCRIPT=1;;       *) HAS_JAVASCRIPT=0;;       esac
  case " $STACKS " in *" java "*)             HAS_JAVA=1;;             *) HAS_JAVA=0;;             esac
  case " $STACKS " in *" python "*)           HAS_PYTHON=1;;           *) HAS_PYTHON=0;;           esac
else
  # Fallback: no cached state — scan the tree. (Cannot distinguish dotnet_framework /
  # javascript here; the cache path above carries that detail.)
  HAS_DOTNET=$(find . -name "*.csproj" -o -name "*.sln" -maxdepth 4 2>/dev/null | head -1 | grep -q "." && echo 1 || echo 0)
  HAS_DOTNET_FRAMEWORK=0
  HAS_ANGULAR=$(ls angular.json 2>/dev/null && echo 1 || find . -name "angular.json" -maxdepth 3 2>/dev/null | head -1 | grep -q "." && echo 1 || echo 0)
  HAS_NODEJS=$(node -e "try{const p=require('./package.json');const d=Object.assign({},p.dependencies,p.devDependencies);if(!d['@angular/core'])console.log('1')}catch(e){}" 2>/dev/null || echo 0)
  HAS_JAVASCRIPT=0
  HAS_JAVA=$({ find . -name "pom.xml" -maxdepth 3 2>/dev/null | xargs grep -l "spring-boot" 2>/dev/null; find . -name "build.gradle*" -maxdepth 3 2>/dev/null | xargs grep -l "org.springframework.boot" 2>/dev/null; } | head -1 | grep -q "." && echo 1 || echo 0)
  HAS_PYTHON=$(find . \( -name "*.py" -o -name "requirements.txt" -o -name "pyproject.toml" \) -maxdepth 3 2>/dev/null | head -1 | grep -q "." && echo 1 || echo 0)
fi

[ "$HAS_DOTNET"           = "1" ] && { ls .claude/rules/dotnet-rules.md           2>/dev/null && echo "EXISTS dotnet-rules.md"           || echo "MISSING dotnet-rules.md"; }
[ "$HAS_DOTNET_FRAMEWORK" = "1" ] && { ls .claude/rules/dotnet-framework-rules.md 2>/dev/null && echo "EXISTS dotnet-framework-rules.md" || echo "MISSING dotnet-framework-rules.md"; }
[ "$HAS_ANGULAR"          = "1" ] && { ls .claude/rules/angular-rules.md          2>/dev/null && echo "EXISTS angular-rules.md"          || echo "MISSING angular-rules.md"; }
[ "$HAS_NODEJS"           = "1" ] && { ls .claude/rules/nodejs-rules.md           2>/dev/null && echo "EXISTS nodejs-rules.md"           || echo "MISSING nodejs-rules.md"; }
[ "$HAS_JAVASCRIPT"       = "1" ] && { ls .claude/rules/javascript-rules.md       2>/dev/null && echo "EXISTS javascript-rules.md"       || echo "MISSING javascript-rules.md"; }
[ "$HAS_JAVA"             = "1" ] && { ls .claude/rules/java-rules.md             2>/dev/null && echo "EXISTS java-rules.md"             || echo "MISSING java-rules.md"; }
[ "$HAS_PYTHON"           = "1" ] && { ls .claude/rules/python-rules.md           2>/dev/null && echo "EXISTS python-rules.md"           || echo "MISSING python-rules.md"; }
```

Status:
- `project-rules.md` present AND all expected stack rules present → ✅ Green
- `project-rules.md` present, some expected stack rules missing → ⚠️ Amber — run dream-init to deploy missing rules
- `project-rules.md` missing → ❌ Red — run dream-init

Include in output report line:
```
  .claude/rules/                     {✅ / ⚠️ / ❌}   project-rules + {N stack rules} ({list of deployed files})
```

---

### 1d — .claude/commands/ (stubs)

```bash
for f in dream.md dream-audit.md dream-health.md dream-init.md dream-rollback.md dream-status.md dream-sync.md security-review.md code-review.md token-analysis.md product-docs.md sprint-metrics.md session-start.md bug.md checkin.md update-arch.md explain.md fix.md app-readiness.md plugin-readiness.md dynamic-scan.md ado-tasks.md icea-feature.md icea-approve.md icea-implement.md icea-revise.md icea-status.md icea-review.md pr-create.md pr-describe.md pr-spec-review.md critic.md gitignore-sync.md dismiss.md sync-dirs.md graph-sync.md graph-viz.md; do
  ls .claude/commands/$f 2>/dev/null && echo "EXISTS $f" || echo "MISSING $f"
done
```

Status:
- All 36 exist → ✅ Green
- Any missing → ⚠️ Amber — run dream-init to redeploy

---

### 1e — .claude/architecture/

```bash
ls .claude/architecture/ 2>/dev/null || echo "MISSING"
for f in $(ls .claude/architecture/*.md 2>/dev/null); do
  head -1 "$f" | grep -q "TEMPLATE" && echo "TEMPLATE $f" || echo "POPULATED $f"
done
```

Status:
- All files exist and populated (no `<!-- TEMPLATE -->` marker) → ✅ Green
- Files exist but some still show `TEMPLATE` marker → ⚠️ Amber — run architect skill to populate
- Folder missing → ⚠️ Amber — run dream-init (architect will run as part of it)

---

### 1f — .claude/graph/graph-index.md (orientation graph)

```bash
ls .claude/graph/graph-index.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
# Get generated date from the index header if present
grep "_Generated:" .claude/graph/graph-index.md 2>/dev/null || echo "NO_DATE"
# Stale flag set by the post-merge/post-checkout git hook when any module source files change
ls .claude/graph/.stale 2>/dev/null && echo "STALE" || echo "FRESH"
```

Status:
- EXISTS and no `.stale` flag → ✅ Green
- EXISTS but `.stale` flag present → ⚠️ Amber — run /graph-sync
- MISSING → ❌ Red — run dream-init (the architect skill generates the graph; icea-feature and icea-review cannot orient without it)

> The former `domain-map.md` was retired in v3.0.0 — the knowledge graph is the single orientation layer ([ADR 0038](../../docs/adr/0038-knowledge-graph-orientation.md)).

---

### 1g — .claude/file-cache.json

```bash
ls .claude/file-cache.json 2>/dev/null && echo "EXISTS" || echo "MISSING"
# Count cached entries
python3 -c "import json; d=json.load(open('.claude/file-cache.json')); print(len(d.get('files',{})), 'entries')" 2>/dev/null || echo "EMPTY_OR_INVALID"
```

Status:
- EXISTS with ≥1 entry → ✅ Green
- EXISTS but 0 entries → ℹ️ Blue — empty cache (first run pending for code-review or security)
- MISSING → ❌ Red — run dream-init

---

### 1h — token-analysis/token-graph.json

```bash
ls token-analysis/token-graph.json 2>/dev/null && echo "EXISTS" || echo "MISSING"
python3 -c "import json; d=json.load(open('token-analysis/token-graph.json')); print(len(d.get('sessions',{})), 'sessions cached')" 2>/dev/null || echo "EMPTY_OR_INVALID"
```

Status:
- EXISTS with ≥1 session → ✅ Green
- EXISTS but 0 sessions → ℹ️ Blue — empty graph (run token-analysis to seed)
- MISSING → ⚠️ Amber — run dream-init

---

### 1i — ignore-file coverage

First detect which VCS this repo uses (see `skills/shared/vcs-detect-spec.md`) so the
check reads the file the repo actually honours — `.gitignore` for Git, `.tfignore`
for TFVC. Checking `.gitignore` on a TFVC repo would report a false ❌ Red even when
the repo is correctly protected via `.tfignore`.

```bash
# Resolve the authoritative ignore file for this repo
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  VCS=git;  IGN=.gitignore
elif { command -v tf >/dev/null 2>&1 && tf vc status . >/dev/null 2>&1; } || [ -d "$tf" ] || [ -d ".tf" ] || [ -f ".tfignore" ]; then
  VCS=tfvc; IGN=.tfignore
else
  VCS=none; IGN=.gitignore   # fallback; note detection failure in output
fi

for entry in "CodeReviews/" "security/" "dynamic-scan/" ".claude/file-cache.json" ".claude/dream-init-state.json" "token-analysis/" "memory/health.html" ".claude/settings.json" ".claude/settings.local.json" ".claude/security-checkpoint.json" ".claude/code-review-checkpoint.json" "prod-readiness/" ".claude/architecture/"; do
  # On TFVC the managed block stores backslash paths with no trailing slash, so
  # match on the entry's basename stem to stay syntax-agnostic across both files.
  stem="${entry%/}"; stem="${stem//\//[/\\\\]}"
  grep -Eq "$stem" "$IGN" 2>/dev/null && echo "COVERED $entry" || echo "MISSING $entry"
done
```

Also check for the highest-risk case — PAT file exists but not ignored:
```bash
[ -f ".claude/settings.json" ] && grep -Eq "settings[/\\]json|\.claude[/\\]settings\.json" "$IGN" 2>/dev/null || echo "PAT_RISK"
# On TFVC, .tfignore only blocks NEW adds — if the file is already tracked it stays
# exposed regardless of the ignore entry. Check tracked state too.
if [ "$VCS" = tfvc ] && [ -f ".claude/settings.json" ]; then
  tf vc status .claude/settings.json 2>/dev/null | grep -q . && echo "SETTINGS_TRACKED"
fi
```

Status:
- All 13 entries covered in the authoritative ignore file → ✅ Green
- `.claude/settings.json` exists AND not ignored, **or** (TFVC) `SETTINGS_TRACKED` → ❌ Red — **credential leak risk**. On Git: add to `.gitignore` immediately. On TFVC: `tf vc delete --keep-local .claude/settings.json` then check in, and prefer storing the PAT in a Windows User Environment Variable (Option A)
- Other entries missing → ⚠️ Amber — run `/gitignore-sync` (or re-run `/dream-init`) to populate the correct ignore file automatically
- `VCS=none` → ℹ️ Blue — could not detect Git or TFVC; verify the ignore file manually and confirm the repo's VCS

---

### 1j — Dream rollback log

Check whether a rollback has been run since the last consolidation:

```bash
# Find the most recent dream-log.md entries for rollback and dream runs
grep -E "^### (dream-rollback|dream) —" memory/dream-log.md 2>/dev/null | tail -5 || echo "NO_LOG"
```

Status:
- No rollback entry found, or last rollback is older than last dream run → ✅ Green — normal state
- Rollback entry is **newer** than the last dream run → ⚠️ Amber — a rollback occurred after the last consolidation:
  ```
  ⚠ A dream-rollback was run after the last consolidation ({rollback date} vs {dream date}).
    Memory state was manually reverted. Run /dream to re-consolidate from sessions
    if the rollback resolved the issue and current memory is stale.
  ```
- `memory/dream-log.md` missing → ❌ Red (same as 1b — run dream-init)

Include in output report line:
```
  dream-rollback    {✅ / ⚠️}  {no rollback since last consolidation | rollback on {date} — re-run /dream}
```

---

### 1k — Skill usage (from token-graph)

```bash
python3 -c "
import json, sys
try:
    g = json.load(open('token-analysis/token-graph.json'))
    usage = g.get('skillUsage', {})
    if usage:
        for skill, data in sorted(usage.items(), key=lambda x: -x[1].get('invocations',0)):
            print(f"{skill}: {data.get('invocations',0)} invocations, last: {data.get('lastSeen','never')}")
    else:
        print('NO_USAGE_DATA')
except: print('NO_GRAPH')
" 2>/dev/null || echo "NO_GRAPH"
```

Status:
- Graph exists with usage data → ℹ️ Blue — display top 3 most used and any never-used skills
- Graph exists but no usage data → ℹ️ Blue — run token-analysis to populate
- No graph → skip (report as not-applicable)

Include in output report line:
```
  skill usage       ℹ️              {top skill: N invocations | no data yet}
```

---

### 1l — Model version freshness

Read `recommended_models` from `.claude-plugin/plugin.json`. For the full model
routing specification and tier definitions, see `skills/shared/model-routing-spec.md`.

```bash
python3 -c "
import json, datetime
try:
    p = json.load(open('.claude-plugin/plugin.json'))
    rm = p.get('recommended_models', {})
    last = rm.get('last_reviewed', '')
    cadence = int(rm.get('review_cadence_days', 90))
    gen   = rm.get('generation', 'unknown')
    rev   = rm.get('review', 'unknown')
    infra = rm.get('infrastructure', 'unknown')
    if last:
        days_old = (datetime.date.today() - datetime.date.fromisoformat(last)).days
        print(f'LAST_REVIEWED={last} DAYS_OLD={days_old} CADENCE={cadence} GEN={gen} REV={rev} INFRA={infra}')
    else:
        print('NO_DATE')
except Exception as e:
    print(f'ERROR {e}')
"
```

Also check if `.claude/settings.json` overrides are in effect:
```bash
python3 -c "
import json
try:
    s = json.load(open('.claude/settings.json'))
    env = s.get('env', {})
    print('ICEA_MODEL='   + env.get('ICEA_MODEL','not set'))
    print('REVIEW_MODEL=' + env.get('REVIEW_MODEL','not set'))
    print('INFRA_MODEL='  + env.get('INFRA_MODEL','not set'))
except: print('NO_SETTINGS')
"
```

Status:
- `last_reviewed` within `review_cadence_days` → ✅ Green — show active models
- `last_reviewed` older than `review_cadence_days` → ⚠️ Amber — warn:
  ```
  ⚠ Model defaults were last reviewed {N} days ago (cadence: {cadence} days).
    Defaults: generation={gen}, review={rev}
    Check Anthropic's release notes and update recommended_models in plugin.json.
  ```
- `plugin.json` missing or no `recommended_models` block → ℹ️ Blue — not configured

Include in output report line:
```
  model versions    {✅ / ⚠️ / ℹ️}  {gen={gen}, review={rev}, infra={infra}, reviewed: {date} | overrides in settings.json}
```

### 1m — Production readiness reports

```bash
# Check for recent app-readiness and plugin-readiness reports
ls prod-readiness/app-readiness-*.html 2>/dev/null | sort -r | head -1
ls prod-readiness/plugin-readiness-*.html 2>/dev/null | sort -r | head -1
# Check age of most recent reports
python3 -c "
import os, datetime, glob
def age_days(pattern):
    files = sorted(glob.glob(pattern), reverse=True)
    if not files: return None
    mtime = os.path.getmtime(files[0])
    return (datetime.datetime.now() - datetime.datetime.fromtimestamp(mtime)).days
app_days = age_days('prod-readiness/app-readiness-*.html')
plugin_days = age_days('prod-readiness/plugin-readiness-*.html')
print(f'APP_READINESS_AGE={app_days}')
print(f'PLUGIN_READINESS_AGE={plugin_days}')
" 2>/dev/null
```

Status:
- Both reports present and < 30 days old → ✅ Green
- Reports present but 30–60 days old → ⚠️ Amber — re-run before next production deployment
- Reports present but > 60 days old → 🔴 Red — stale, re-run required
- Either report missing → ⚠️ Amber — run `/app-readiness` and `/plugin-readiness`
- Both missing and project is in production → 🔴 Red

Include in output report line:
```
  prod-readiness    {✅ / ⚠️ / 🔴}  {app: N days old, plugin: N days old | not yet run}
```

---

### 1n — Skipped gitignore entries (sensitive pattern check)

```bash
cat .claude/dream-init-state.json 2>/dev/null || echo "NO_STATE_FILE"
```

If the state file exists, read `gitignore_skipped_by_developer` and check each
skipped entry against this sensitive pattern list:
- `.env` or `*.env`
- `appsettings.*.json` (any variant)
- `*.pem`, `*.key`, `*.p12`
- Any file containing `secret`, `credential`, `password`, or `token` in the name

Status:
- State file absent or `gitignore_skipped_by_developer` is empty → ✅ Green (no skipped entries)
- Skipped entries present but none match sensitive patterns → ℹ️ Blue (non-sensitive skips logged)
- One or more skipped entries match sensitive patterns → ⚠️ Amber — credential/secret exposure risk

Include in output report line:
```
  gitignore skips   {✅ / ℹ️ / ⚠️}  {no sensitive skips | N non-sensitive | N sensitive patterns skipped: .env, appsettings.*.json}
```

If ⚠️ Amber, include in recommended actions:
```
  ⚠ Sensitive file patterns were declined during /dream-init gitignore setup:
    {list the specific patterns}
  These may expose credentials or secrets if committed.
  To add them now (Git): echo "{pattern}" >> .gitignore
  On TFVC: add "{pattern}" to .tfignore (use \ separators), and if the file is
  already tracked, tf vc delete --keep-local it first.
  Or re-run /dream-init to go through the selection again.
```

---

### 1o — Open findings across all ledgers

```bash
count_open_by_severity() {
  local ledger="$1"
  local sev="$2"
  [ -f "$ledger" ] || { echo "0"; return; }
  # Match heading lines with severity, then verify Status: Open in the same FP block
  grep "^### \[FP-" "$ledger" | grep -i "$sev" | grep -oE "FP-[0-9a-f]{8}" | while read fp; do
    awk "/^\\#\\#\\# \\[$fp\\]/,/^\\#\\#\\# \\[FP-/" "$ledger" 2>/dev/null | grep -q "\\*\\*Status\\*\\*: Open" && echo "$fp"
  done | wc -l
}

count_dismissed() {
  local ledger="$1"
  [ -f "$ledger" ] || { echo "0"; return; }
  grep -c "^\*\*Status\*\*: Dismissed" "$ledger" 2>/dev/null || echo 0
}

total_critical=0
total_high=0
total_medium=0
total_dismissed=0
for ledger in CodeReviews/code-review-ledger.md security/security-ledger.md dynamic-scan/dynamic-scan-ledger.md; do
  total_critical=$((total_critical + $(count_open_by_severity "$ledger" "Critical")))
  total_high=$((total_high + $(count_open_by_severity "$ledger" "High")))
  total_medium=$((total_medium + $(count_open_by_severity "$ledger" "Medium")))
  total_dismissed=$((total_dismissed + $(count_dismissed "$ledger")))
done
echo "OPEN: $total_critical Critical, $total_high High, $total_medium Medium"
echo "DISMISSED: $total_dismissed"
```

Status:
- 0 Critical AND 0 High open → ✅ Green
- 0 Critical AND ≥1 High open → ⚠️ Amber
- ≥1 Critical open → 🔴 Red

Include in output report line:
```
  open findings (all ledgers)        {✅ / ⚠️ / 🔴}  {N Critical, N High, N Medium across code-review/security/dynamic-scan}
  dismissed findings (all ledgers)   ℹ️              {N dismissed}  (use /dismiss FP-xxx --undo to re-open)
```

If 🔴 Red or ⚠️ Amber, include in recommended actions:
```
  ⚠ Open findings detected:
    {N} Critical, {M} High across the three ledgers.
  Run /fix FP-xxxxxxxx to apply remediations.
  Run /code-review --full, /security-review --full, or /dynamic-scan to refresh.
```

---

### 1p — Enforcement floor integrity (hooks)

The mechanical floor (ADR 0005/0009) only governs if the hooks are present,
executable, and current. Verify all three properties:

```bash
# Present + executable
for h in icea-floor.sh findings-gate-precommit.sh validate-ledgers.py validate-pr-compliance.py; do
  [ -x ".claude/hooks/$h" ] && echo "$h: OK" || echo "$h: MISSING_OR_NOT_EXECUTABLE"
done
# git pre-commit installed — only meaningful on Git. TFVC has no client-side
# commit hooks; the equivalent is a server-side check-in policy the plugin does
# not install, so report n/a rather than a false NOT_INSTALLED.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  [ -x .git/hooks/pre-commit ] && grep -q "findings-gate" .git/hooks/pre-commit && echo "pre-commit: OK" || echo "pre-commit: NOT_INSTALLED"
else
  echo "pre-commit: N/A_TFVC"
fi
# Content current vs recorded hashes
sha256sum -c .claude/hooks/.hashes --quiet 2>/dev/null && echo "hashes: CURRENT" || echo "hashes: STALE_OR_MODIFIED"
# PreToolUse wired
grep -q "icea-floor.sh" .claude/settings.json 2>/dev/null && echo "PreToolUse: WIRED" || echo "PreToolUse: NOT_WIRED"
```

- All OK → ✅ Green
- Hashes stale (plugin upgraded, hooks not re-synced) → ⚠️ Amber: "run bump-version or re-copy hooks"
- Any hook missing/not wired AND no `Enforcement floor: DECLINED` line in
  `architecture-deployment.md` → ❌ Red: "floor absent without recorded opt-out"
- Declined with recorded opt-out → ℹ️ Blue: "floor declined on {date} by {user}"

### 1q — Phase D coverage health

Read `.claude/plugin-path.txt` to get PLUGIN_DIR (if absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`). Per `$PLUGIN_DIR/skills/shared/phase-d-spec.md` §7. Read the machine-local profile:
```bash
grep -A20 '"phaseD"' .claude/settings.local.json 2>/dev/null || echo "NO_PROFILE"
```
- Every detected stack has a deterministic tool → ✅ Green (show tool+version per stack)
- Any stack on probabilistic-fallback → ⚠️ Amber: "{stack}: no deterministic scanner — model fallback in use"
- NO_PROFILE but stacks detected → ⚠️ Amber: "Phase D never probed — run /update-arch --reprobe"
- Profile probedAt older than 90 days → ℹ️ note: "stale probe — consider --reprobe"

### 1r — Plugin version drift (provisioned vs installed)

This is the check that catches the most common silent failure: the plugin files
on disk get upgraded, but the project was provisioned by an older version and was
never re-synced — so generated artifacts, hooks, shared specs, and the ignore-file
managed block can all be stale while everything *looks* fine. `dream-init` records
the version that provisioned the project in `.claude/dream-init-state.json`
(`dream_init_plugin_version`); the authoritative installed version is in
`.claude-plugin/plugin.json`. Compare them every status run rather than trusting
the project's self-report.

```bash
INSTALLED=$(python3 -c "import json; print(json.load(open('.claude-plugin/plugin.json'))['version'])" 2>/dev/null || echo "UNKNOWN")
PROVISIONED=$(python3 -c "import json; print(json.load(open('.claude/dream-init-state.json')).get('dream_init_plugin_version','UNKNOWN'))" 2>/dev/null || echo "NO_STATE")
echo "INSTALLED=$INSTALLED PROVISIONED=$PROVISIONED"
# Semantic comparison (X.Y.Z) so 1.10.0 > 1.9.0 sorts correctly, not lexically
python3 - "$INSTALLED" "$PROVISIONED" << 'PYEOF'
import sys
inst, prov = sys.argv[1], sys.argv[2]
def parse(v):
    try: return tuple(int(x) for x in v.split('.'))
    except Exception: return None
pi, pp = parse(inst), parse(prov)
if prov in ("NO_STATE","UNKNOWN") or pp is None: print("DRIFT_UNKNOWN")
elif pi is None: print("INSTALLED_UNKNOWN")
elif pi == pp: print("MATCH")
elif pi > pp:   print(f"STALE {prov}->{inst}")   # plugin upgraded, project not synced
else:           print(f"DOWNGRADE {prov}->{inst}")
PYEOF
```

Status:
- `MATCH` → ✅ Green — project provisioned by the installed version
- `STALE {old}->{new}` → ⚠️ Amber — **plugin upgraded since this project was set up.**
  Generated artifacts may not reflect the new version. Run `/dream-sync` (or
  `/dream-init --upgrade`) to re-provision the version-sensitive pieces. Cross-
  reference the upgrade manifest at `docs/migrations/` (see below) to show what a
  sync will touch — e.g. new shared specs, changed hooks (already flagged by 1p
  hash check), new managed ignore-block entries (1i), new state files:
  ```
  ⚠ Plugin upgraded {old} → {new} but the project was last provisioned at {old}.
    The version stamp is not self-updating — an upgraded install assumes the
    older setup is still correct. Run /dream-sync to bring artifacts current.
    Changes since {old}: {list from docs/migrations/ for each version in range}
  ```
- `DOWNGRADE {new}->{old}` → ℹ️ Blue — installed version is *older* than what
  provisioned the project (rolled back, or a stale install). Not corruption; note
  it so it isn't mistaken for one, and avoid auto-syncing downward.
- `DRIFT_UNKNOWN` (no state file or no version field) → ⚠️ Amber — same remediation
  as a missing state file: run `/dream-init`. A project provisioned before the
  version field existed (pre-v1.20.4) lands here.
- `INSTALLED_UNKNOWN` (`plugin.json` unreadable) → ❌ Red — the install itself is
  broken; the plugin cannot determine its own version.

Include in the output report line:
```
  plugin version    {✅ / ⚠️ / ℹ️ / ❌}  {provisioned {old} = installed {new} | UPGRADE PENDING {old}->{new} — run /dream-sync | downgrade | unknown — run /dream-init}
```

---

### 1s — Knowledge graph: graph-index.md

```bash
ls .claude/graph/graph-index.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
# Read module count and structure from the header line
grep "^_Generated:" .claude/graph/graph-index.md 2>/dev/null || echo "NO_HEADER"
```

Status:
- EXISTS with valid header → ✅ Green — show `Modules: N | Structure: flat|domain | Generated: date`
- MISSING → ❌ Red — run `/dream-init` to generate the knowledge graph

Include in output report line:
```
  .claude/graph/graph-index.md       {✅ / ❌}       {N modules, structure: flat|domain, generated: date | MISSING — run dream-init}
```

---

### 1t — Knowledge graph freshness (fingerprint check)

Only run if check 1s is ✅ Green (graph-index.md exists).

For each node in `graph.json`, recompute the **module-wide** fingerprint (hash over all
source files under the module's `paths`, not a single entry-point file — the same
`graph_module_fingerprint` used by `/graph-sync` and `hooks/graph-stale-detect.sh`; see
`skills/shared/graph-json-schema.md`) and compare it to the stored `fingerprint`:

```bash
graph_module_fingerprint() {
  { for root in "$@"; do
      [ -e "$root" ] || continue
      find "$root" -type f \
        -not -path '*/.git/*' -not -path '*/node_modules/*' \
        -not -path '*/bin/*'  -not -path '*/obj/*' \
        -not -path '*/dist/*' -not -path '*/.angular/*' \
        -not -path '*/migrations/*' -not -path '*/__pycache__/*' -print0 2>/dev/null
    done; } | sort -z | xargs -0 sha1sum 2>/dev/null | sha1sum | cut -d' ' -f1
}

node -e '
  const fs=require("fs");
  const g=JSON.parse(fs.readFileSync(".claude/graph/graph.json","utf8"));
  for (const n of (g.nodes||[])) {
    const roots=(n.paths||[]).map(p=>p.replace(/\/\*\*.*$/,"").replace(/\/\*$/,""));
    process.stdout.write(`${n.id}\t${n.fingerprint||""}\t${roots.join(" ")}\n`);
  }
' | while IFS=$'\t' read -r id stored roots; do
  [ -n "$id" ] || continue
  CURRENT=$(graph_module_fingerprint $roots)
  if [ -z "$stored" ]; then echo "MISSING_FINGERPRINT $id"
  elif [ "$stored" != "$CURRENT" ]; then echo "STALE $id"
  else echo "CURRENT $id"; fi
done
```

Count stale and current modules.

Status:
- All fingerprints match → ✅ Green — "N/N modules current"
- ≥1 stale → ⚠️ Amber — "N module(s) stale — run /graph-sync"

Include in output report line:
```
  knowledge graph freshness          {✅ / ⚠️}       {N/N modules current | N stale — run /graph-sync}
```

---

### 1u — Knowledge graph stale flag

```bash
ls .claude/graph/.stale 2>/dev/null && echo "STALE_FLAG" || echo "CLEAN"
```

Status:
- CLEAN → ✅ Green — no pending refresh
- STALE_FLAG → ⚠️ Amber — "stale flag set by post-merge hook — run /graph-sync"

Include in output report line:
```
  graph stale flag                   {✅ / ⚠️}       {no pending refresh | stale since last git pull — run /graph-sync}
```

---

## Step 2 — Compute overall health

| Count of ❌ Red | Count of ⚠️ Amber | Overall |
|---|---|---|
| 0 | 0 | ✅ Fully initialised |
| 0 | ≥1 | ⚠️ Partially configured |
| ≥1 | any | ❌ Needs initialisation |

---

## Step 3 — Output the status report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Dream Plugin Status — {project name or path}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  CLAUDE.md                          {✅ / ⚠️ / ❌}  {detail}
  memory/                            {✅ / ❌}       {detail}
  .claude/rules/                     {✅ / ⚠️}       {N/4 files present}
  .claude/commands/                  {✅ / ⚠️}       {N/37 stubs deployed}
  .claude/architecture/              {✅ / ⚠️}       {N files, N populated}
  .claude/graph/graph-index.md       {✅ / ⚠️ / ❌}  {N modules | STALE — run /graph-sync | MISSING — run dream-init}
  architecture-deployment.md        {✅ / ⚠️ / ❌}  {answered: 0 unanswered | MISSING — run /update-arch --deployment}
  .claude/file-cache.json            {✅ / ℹ️ / ❌}  {N entries cached}
  token-analysis/token-graph.json    {✅ / ℹ️ / ⚠️}  {N sessions cached}
  ignore-file coverage               {✅ / ⚠️ / ❌}  {.gitignore|.tfignore — N/13 entries present}
  ignore-file skips                  {✅ / ℹ️ / ⚠️}  {no sensitive skips | N sensitive patterns skipped}
  open findings (all ledgers)        {✅ / ⚠️ / 🔴}  {N Critical, N High, N Medium across code-review/security/dynamic-scan}
  dream-rollback                     {✅ / ⚠️}       {no rollback since last consolidation | rollback on {date}}
  skill usage                        {ℹ️}              {top skill: N invocations | run token-analysis to populate}
  model versions                     {✅ / ⚠️ / ℹ️}  {gen=..., review=..., infra=..., reviewed: {date}}
  plugin version                     {✅ / ⚠️ / ℹ️ / ❌}  {provisioned {old} = installed {new} | UPGRADE PENDING {old}->{new} — run /dream-sync}
  prod-readiness                     {✅ / ⚠️ / 🔴}  {app: N days old, plugin: N days old | not yet run}
  .claude/graph/graph-index.md       {✅ / ❌}       {N modules, structure: flat|domain | MISSING — run dream-init}
  knowledge graph freshness          {✅ / ⚠️}       {N/N modules current | N stale — run /graph-sync}
  graph stale flag                   {✅ / ⚠️}       {no pending refresh | stale since last git pull — run /graph-sync}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Overall: {✅ Fully initialised | ⚠️ Partially configured | ❌ Needs initialisation}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If any items are Amber or Red, append an action list:

```
Recommended actions:
  1. Run /dream-init   — fixes: {list the red/amber items it addresses}
                         Automatically creates/updates the repo's ignore file —
                         .gitignore on Git, .tfignore on TFVC (plugin entries +
                         repo walk for build artifacts)
  2. Run /architect    — fixes: architecture docs + the knowledge graph (.claude/graph/)
  6. Run /graph-sync   — fixes: knowledge graph freshness, stale flag, graph-index
  7. Run /dream-sync   — fixes: plugin version drift (provisioned < installed) —
                         re-provisions version-sensitive artifacts (hooks, shared
                         specs, ignore-file managed block, new state files) and
                         re-stamps dream_init_plugin_version. Idempotent; never
                         touches developer content
  4. Run /app-readiness   — fixes: prod-readiness/app-readiness missing or stale
  5. Run /plugin-readiness — fixes: prod-readiness/plugin-readiness missing or stale
  3. Manual ignore-file fix (if not re-running /dream-init) — add missing entries
     to .gitignore (Git, paths as below) or .tfignore (TFVC, use \ separators and
     drop trailing slashes):

     # Claude plugin — generated files, do not commit
     .claude/settings.json
     .claude/settings.local.json
     .claude/dream-init-state.json
     .claude/file-cache.json
     .claude/security-checkpoint.json
     .claude/code-review-checkpoint.json
     .claude/architecture/
     CodeReviews/
     security/
     dynamic-scan/
     token-analysis/
     prod-readiness/
     memory/health.html

     ⚠️ If .claude/settings.json is unprotected, add it FIRST — credential leak risk.
```

---

## Business context severity

This skill does not perform security or compliance reviews. If output from this
skill surfaces data that may trigger B1–B7 sensitivity (see
`$PLUGIN_DIR/skills/shared/business-context-severity.md`), flag it to the developer. Do not
silently process or display attorney-client privileged matter data, immigration
identifiers, or other B1–B7 categories without acknowledgement.

---

## Hard Rules

- NEVER modify any file — this skill is read-only
- NEVER prompt the developer for input — infer everything from filesystem state
- NEVER block on missing files — check and report all items even if early checks fail
- If a check command fails (e.g. not a git repo), mark that item as ℹ️ Blue with note "not a git repo"
