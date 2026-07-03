# Skill: dream-sync

## Purpose
Re-provision an existing project after a plugin upgrade. Reads the provisioned
version from `.claude/dream-init-state.json` and the installed version from the
plugin's `plugin.json`, applies migration changes, re-copies hooks, redeploys
missing command stubs and rule files, then re-stamps the version.

Triggered by: `/dream-sync` or `/dream-init --upgrade`

---

## Step 1 — Resolve plugin path and read versions

```bash
# Resolve the installed plugin dir + version from the registry (installed_plugins.json).
# Fork-agnostic, prefers user scope, normalises \ -> /, falls back to the source glob.
# Canonical resolver: see skills/shared/plugin-path-resolution.md §1a.
IFS=$'\t' read -r PLUGIN_DIR INSTALLED_VERSION < <(node -e '
const fs=require("fs"),os=require("os"),path=require("path");
const base=path.join(os.homedir(),".claude","plugins");
const norm=p=>p?p.split(String.fromCharCode(92)).join("/"):"";
let dir="",ver="";
try{
  const reg=JSON.parse(fs.readFileSync(path.join(base,"installed_plugins.json"),"utf8"));
  const key=Object.keys(reg.plugins||{}).find(k=>k.startsWith("ai-assisted-development@"));
  if(key){const a=reg.plugins[key]||[];const e=a.find(x=>x.scope==="user")||a[0];
    if(e&&e.installPath&&fs.existsSync(e.installPath)){dir=e.installPath;ver=e.version||"";}}
}catch(e){}
if(!dir){try{for(const m of fs.readdirSync(base)){const p=path.join(base,m,"plugins","ai-assisted-development");if(fs.existsSync(p)){dir=p;break;}}}catch(e){}}
if(dir&&!ver){try{ver=JSON.parse(fs.readFileSync(path.join(dir,".claude-plugin","plugin.json"),"utf8")).version||"";}catch(e){}}
process.stdout.write(norm(dir)+"\t"+(ver||"unknown"));
')
PLUGIN_HOOKS="$PLUGIN_DIR/hooks"
PLUGIN_STUBS="$PLUGIN_DIR/skills/command-stubs"
PLUGIN_RULES="$PLUGIN_DIR/rules"

# Read provisioned version
PROVISIONED_VERSION=$(node -e "
  const fs = require('fs');
  try {
    const s = JSON.parse(fs.readFileSync('.claude/dream-init-state.json', 'utf8'));
    process.stdout.write(s.dream_init_plugin_version || 'unknown');
  } catch(e) { process.stdout.write('unknown'); }
")
```

Display:
```
🔄 dream-sync — v$PROVISIONED_VERSION → v$INSTALLED_VERSION
```

If `INSTALLED_VERSION` is `unknown`:
```
⚠ Cannot read installed plugin version.
  Ensure the plugin is installed: bash install.sh
```
Stop here.

---

## Step 2 — Re-copy hooks

Always re-copy all hook files — idempotent, safe to re-run.

```bash
if [ ! -d "$PLUGIN_HOOKS" ]; then
  echo "⚠ Plugin hooks directory not found at $PLUGIN_HOOKS"
  echo "  Hooks not updated — re-install the plugin first."
else
  mkdir -p .claude/hooks
  cp "$PLUGIN_HOOKS/icea-floor.sh" .claude/hooks/
  cp "$PLUGIN_HOOKS/findings-gate-precommit.sh" .claude/hooks/
  cp "$PLUGIN_HOOKS/validate-ledgers.py" .claude/hooks/
  cp "$PLUGIN_HOOKS/validate-pr-compliance.py" .claude/hooks/
  chmod +x .claude/hooks/*.sh .claude/hooks/*.py

  # Refresh hashes
  sha256sum .claude/hooks/* > .claude/hooks/.hashes 2>/dev/null

  echo "  ✓ Hooks re-copied and hashes refreshed"
fi
```

---

## Step 3 — Deploy missing command stubs

Copy any stubs that are missing from `.claude/commands/` — never overwrite existing ones.

```bash
mkdir -p .claude/commands
DEPLOYED=0
SKIPPED=0

for stub in dream.md dream-audit.md dream-health.md dream-init.md dream-rollback.md \
            dream-status.md dream-sync.md security-review.md code-review.md \
            token-analysis.md product-docs.md sprint-metrics.md session-start.md \
            bug.md checkin.md update-arch.md explain.md fix.md app-readiness.md \
            plugin-readiness.md dynamic-scan.md ado-tasks.md icea-feature.md \
            icea-approve.md icea-implement.md icea-revise.md icea-status.md \
            icea-review.md pr-create.md pr-describe.md pr-spec-review.md \
            critic.md gitignore-sync.md dismiss.md sync-dirs.md graph-sync.md; do
  if [ ! -f ".claude/commands/$stub" ]; then
    cp "$PLUGIN_STUBS/$stub" ".claude/commands/$stub" 2>/dev/null && \
      echo "  ✓ deployed .claude/commands/$stub" || \
      echo "  ⚠ could not deploy $stub — check plugin stubs directory"
    ((DEPLOYED++))
  else
    ((SKIPPED++))
  fi
done

echo "  Stubs: $DEPLOYED deployed, $SKIPPED already present"
```

---

## Step 4 — Deploy missing rule files

Deploy any rule files that are missing for the project's detected stacks.
Read detected stacks from `.claude/dream-init-state.json`.

```bash
DETECTED_STACKS=$(node -e "
  const fs = require('fs');
  try {
    const s = JSON.parse(fs.readFileSync('.claude/dream-init-state.json', 'utf8'));
    process.stdout.write((s.detected_stacks || []).join(' '));
  } catch(e) { process.stdout.write(''); }
")

mkdir -p .claude/rules

deploy_rule() {
  local file="$1"
  if [ ! -f ".claude/rules/$file" ] && [ -f "$PLUGIN_RULES/$file" ]; then
    cp "$PLUGIN_RULES/$file" ".claude/rules/$file"
    echo "  ✓ deployed .claude/rules/$file"
  fi
}

deploy_rule "project-rules.md"
echo "$DETECTED_STACKS" | grep -q "dotnet"            && deploy_rule "dotnet-rules.md"
echo "$DETECTED_STACKS" | grep -q "dotnet_framework"  && deploy_rule "dotnet-framework-rules.md"
echo "$DETECTED_STACKS" | grep -q "angular"           && deploy_rule "angular-rules.md"
echo "$DETECTED_STACKS" | grep -q "nodejs"            && deploy_rule "nodejs-rules.md"
echo "$DETECTED_STACKS" | grep -q "javascript"        && deploy_rule "javascript-rules.md"
echo "$DETECTED_STACKS" | grep -q "java"              && deploy_rule "java-rules.md"
echo "$DETECTED_STACKS" | grep -q "python"            && deploy_rule "python-rules.md"
```

---

## Step 5 — Apply migration files

Read all migration files in `$PLUGIN_DIR/docs/migrations/` for versions
between `PROVISIONED_VERSION` and `INSTALLED_VERSION` (exclusive of provisioned,
inclusive of installed). Display the migration notes so the developer can
review what changed. Do not auto-apply code changes — migrations are informational.

```bash
ls "$PLUGIN_DIR/docs/migrations/"*.md 2>/dev/null | sort
```

For each migration file in range, display its content with a header:
```
📋 Migration {version}:
{content}
```

---

## Step 5b — Resolve Shell & Git paths if placeholders remain

Check whether `./CLAUDE.md` still contains unresolved placeholders **or**
a previously failed `⚠ NOT DETECTED` value that should be retried:

```bash
grep -qE "\{GIT_PATH\}|\{BASH_PATH\}|NOT DETECTED.*where\.exe" ./CLAUDE.md 2>/dev/null
```

If placeholders or NOT DETECTED values found, resolve them:

```bash
# Strip any existing NOT DETECTED values back to placeholders so detection can overwrite them
sed -i 's|⚠ NOT DETECTED — run where\.exe git and update manually|{GIT_PATH}|g' ./CLAUDE.md
sed -i 's|⚠ NOT DETECTED — run where\.exe bash and update manually|{BASH_PATH}|g' ./CLAUDE.md

# Git path — try where.exe, then which, then known locations
GIT_PATH=$(where.exe git 2>/dev/null | head -1 | tr -d '\r\n')
[ -z "$GIT_PATH" ] && GIT_PATH=$(which git 2>/dev/null | tr -d '\r\n')
[ -z "$GIT_PATH" ] && GIT_PATH=$(ls "/mingw64/bin/git.exe" "/usr/bin/git" "C:/Program Files/Git/bin/git.exe" "C:/Program Files/Git/mingw64/bin/git.exe" 2>/dev/null | head -1)

# Bash path — try where.exe, then which, then known locations
BASH_PATH=$(where.exe bash 2>/dev/null | head -1 | tr -d '\r\n')
[ -z "$BASH_PATH" ] && BASH_PATH=$(which bash 2>/dev/null | tr -d '\r\n')
[ -z "$BASH_PATH" ] && BASH_PATH=$(ls "/usr/bin/bash" "/bin/bash" "C:/Program Files/Git/bin/bash.exe" "C:/Program Files/Git/usr/bin/bash.exe" 2>/dev/null | head -1)

if [ -n "$GIT_PATH" ]; then
  sed -i "s|{GIT_PATH}|$GIT_PATH|g" ./CLAUDE.md
  echo "  ✅ Git path resolved: $GIT_PATH"
else
  sed -i 's|{GIT_PATH}|⚠ NOT DETECTED — run where.exe git and update manually|g' ./CLAUDE.md
  echo "  ⚠ Git path not detected — placeholder left in CLAUDE.md"
fi

if [ -n "$BASH_PATH" ]; then
  sed -i "s|{BASH_PATH}|$BASH_PATH|g" ./CLAUDE.md
  echo "  ✅ Bash path resolved: $BASH_PATH"
else
  sed -i 's|{BASH_PATH}|⚠ NOT DETECTED — run where.exe bash and update manually|g' ./CLAUDE.md
  echo "  ⚠ Bash path not detected — placeholder left in CLAUDE.md"
fi
```

echo "  ✓ Shell & Git paths resolved in ./CLAUDE.md"

Also check whether `## 0b. Shell & Git Configuration` section is missing
entirely (projects provisioned before v2.2.0). If missing, add it from
the installed plugin's `CLAUDE.md` before resolving placeholders.

---

## Step 6 — Re-run gitignore-sync

```
Run /ai-assisted-development:gitignore-sync
```

---

## Step 7 — Stamp new version

```bash
node -e "
  const fs = require('fs');
  const statePath = '.claude/dream-init-state.json';
  let state = {};
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch(e) {}
  state.dream_init_plugin_version = '$INSTALLED_VERSION';
  state.dream_sync_last_run = new Date().toISOString().slice(0, 10);
  fs.mkdirSync('.claude', { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log('  ✓ dream_init_plugin_version stamped: $INSTALLED_VERSION');
"
```

---

## Step 8 — Confirm

```
✅ dream-sync complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Plugin version: v$PROVISIONED_VERSION → v$INSTALLED_VERSION
  Hooks:          re-copied + hashes refreshed
  Stubs:          {N} deployed, {N} already present
  Rules:          {N} deployed, {N} already present
  Migrations:     {list of versions applied}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run /dream-status to verify all checks are green.
Knowledge graph may be stale after an upgrade — run /graph-sync to refresh.
```
