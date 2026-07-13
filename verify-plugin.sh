#!/bin/bash
# verify-plugin.sh — runs all invariant checks before packaging
# Usage: bash verify-plugin.sh [plugin-dir]
# Exit 0 = all checks passed, Exit 1 = failures found

PLUGIN_DIR="${1:-/home/claude/plugin_v220}"
PASS=0
FAIL=0
WARN=0

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}  ✅ $1${NC}"; ((PASS++)); }
fail() { echo -e "${RED}  ❌ $1${NC}"; ((FAIL++)); }
warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; ((WARN++)); }
header() { echo ""; echo -e "${CYAN}── $1 ──${NC}"; }

# ── 1. Version stamps ──────────────────────────────────────────────────────────
header "Version stamps"

PLUGIN_VERSION=$(node -e "
  const fs = require('fs');
  try {
    const p = JSON.parse(fs.readFileSync('$PLUGIN_DIR/.claude-plugin/plugin.json', 'utf8'));
    process.stdout.write(p.version || 'unknown');
  } catch(e) { process.stdout.write('unknown'); }
")

echo "  Reference version from plugin.json: $PLUGIN_VERSION"

check_version() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  local found
  found=$(grep -o "$pattern" "$PLUGIN_DIR/$file" 2>/dev/null | head -1)
  if [ "$found" = "$PLUGIN_VERSION" ]; then
    pass "$label: $found"
  else
    fail "$label: expected $PLUGIN_VERSION, found '${found:-missing}' in $file"
  fi
}

check_version "CLAUDE.md"              "[0-9]*\.[0-9]*\.[0-9]*" "CLAUDE.md Plugin version"
check_version "README.md"              "[0-9]*\.[0-9]*\.[0-9]*" "README.md version"
check_version "user-guide.html"        "[0-9]*\.[0-9]*\.[0-9]*" "user-guide.html version"
check_version "plugin-guide.html"      "[0-9]*\.[0-9]*\.[0-9]*" "plugin-guide.html version"
check_version "CHANGELOG.md"           "[0-9]*\.[0-9]*\.[0-9]*" "CHANGELOG.md latest entry"

# Check marketplace.json version
MARKETPLACE_VERSION=$(grep -o "v[0-9]*\.[0-9]*\.[0-9]*" \
  "$PLUGIN_DIR/.claude-plugin/marketplace.json" 2>/dev/null | head -1 | tr -d 'v')
if [ "$MARKETPLACE_VERSION" = "$PLUGIN_VERSION" ]; then
  pass "marketplace.json version: $MARKETPLACE_VERSION"
else
  fail "marketplace.json version: expected $PLUGIN_VERSION, found '${MARKETPLACE_VERSION:-missing}'"
fi

# ── 2. Hardcoded version numbers ───────────────────────────────────────────────
header "Hardcoded version numbers"

OLD_VERSIONS=$(grep -rn "v1\.[0-9]*\.[0-9]*\|v2\.0\.0\|v1\.20\.8\|v1\.28\|v1\.29" \
  "$PLUGIN_DIR/install.sh" \
  "$PLUGIN_DIR/install.ps1" 2>/dev/null | grep -v "^Binary" | head -10)

if [ -z "$OLD_VERSIONS" ]; then
  pass "No old hardcoded versions in install scripts"
else
  fail "Old hardcoded versions found in install scripts:"
  echo "$OLD_VERSIONS" | while read -r line; do echo "    $line"; done
fi

# ── 3. Banned patterns in install scripts ─────────────────────────────────────
header "Banned patterns in install scripts"

for pattern in "patch_project_files" "Patch-ProjectFiles" "patch_claude_md" \
               "Patch-ClaudeMd" "patch_dream_init_state" "Patch-DreamInitState" \
               "Patching project files"; do
  found=$(grep -rn "$pattern" "$PLUGIN_DIR/install.sh" "$PLUGIN_DIR/install.ps1" 2>/dev/null)
  if [ -z "$found" ]; then
    pass "install scripts: no '$pattern'"
  else
    fail "install scripts contain banned pattern '$pattern':"
    echo "$found" | while read -r line; do echo "    $line"; done
  fi
done

# ── 4. {plugin} placeholders ──────────────────────────────────────────────────
header "Unresolved {plugin} placeholders"

PLACEHOLDERS=$(grep -rn "{plugin}" \
  "$PLUGIN_DIR/commands/" \
  "$PLUGIN_DIR/skills/" 2>/dev/null | grep -v ".git" | head -10)

if [ -z "$PLACEHOLDERS" ]; then
  pass "No {plugin} placeholders found"
else
  fail "Unresolved {plugin} placeholders found:"
  echo "$PLACEHOLDERS" | while read -r line; do echo "    $line"; done
fi

# ── 5. Hook paths use resolved $HOME path ─────────────────────────────────────
header "Hook deployment paths"

for file in "$PLUGIN_DIR/commands/dream-init.md" \
            "$PLUGIN_DIR/skills/dream-sync/SKILL.md"; do
  if grep -q "plugins/ai-assisted-development.*hooks\|PLUGIN_HOOKS" "$file" 2>/dev/null; then
    pass "$(basename $file): uses resolved hook path"
  else
    fail "$(basename $file): missing resolved hook path (glob-discovered plugin dir or PLUGIN_HOOKS)"
  fi
done

# ── 6. Command stub counts ─────────────────────────────────────────────────────
header "Command stub counts"

ACTUAL_STUBS=$(ls "$PLUGIN_DIR/_project-deploy/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "  Actual stubs in plugin: $ACTUAL_STUBS"

# Count in dream-init loop
INIT_LOOP_COUNT=$(grep "for stub in" "$PLUGIN_DIR/commands/dream-init.md" 2>/dev/null \
  | tr ' ' '\n' | grep "\.md" | wc -l | tr -d ' ')

# Count in dream-status loop
STATUS_LOOP_COUNT=$(grep "for f in" "$PLUGIN_DIR/skills/dream-status/SKILL.md" 2>/dev/null \
  | head -1 | tr ' ' '\n' | grep "\.md" | wc -l | tr -d ' ')

# Expected count in dream-status text
STATUS_EXPECTED=$(grep "All [0-9]* exist" "$PLUGIN_DIR/skills/dream-status/SKILL.md" 2>/dev/null \
  | grep -o "[0-9]*" | head -1)

# Expected count in dream-status summary
STATUS_SUMMARY=$(grep "N/[0-9]* stubs" "$PLUGIN_DIR/skills/dream-status/SKILL.md" 2>/dev/null \
  | grep -o "[0-9]*" | head -1)

[ "$INIT_LOOP_COUNT" = "$ACTUAL_STUBS" ] && \
  pass "dream-init loop count matches actual: $INIT_LOOP_COUNT" || \
  fail "dream-init loop count $INIT_LOOP_COUNT ≠ actual $ACTUAL_STUBS"

[ "$STATUS_LOOP_COUNT" = "$ACTUAL_STUBS" ] && \
  pass "dream-status loop count matches actual: $STATUS_LOOP_COUNT" || \
  fail "dream-status loop count $STATUS_LOOP_COUNT ≠ actual $ACTUAL_STUBS"

[ "$STATUS_EXPECTED" = "$ACTUAL_STUBS" ] && \
  pass "dream-status 'All N exist' matches actual: $STATUS_EXPECTED" || \
  fail "dream-status 'All N exist' $STATUS_EXPECTED ≠ actual $ACTUAL_STUBS"

[ "$STATUS_SUMMARY" = "$ACTUAL_STUBS" ] && \
  pass "dream-status summary N/N matches actual: $STATUS_SUMMARY" || \
  fail "dream-status summary N/N $STATUS_SUMMARY ≠ actual $ACTUAL_STUBS"

# ── 7. New icea stubs present in all lists ─────────────────────────────────────
header "New ICEA command stubs"

for stub in icea-approve icea-implement icea-revise icea-status icea-review \
            pr-create pr-describe pr-spec-review; do
  # Check actual file
  [ -f "$PLUGIN_DIR/_project-deploy/commands/$stub.md" ] && \
    pass "$stub.md exists in _project-deploy/commands" || \
    fail "$stub.md MISSING from _project-deploy/commands"

  # Check command file
  [ -f "$PLUGIN_DIR/commands/$stub.md" ] && \
    pass "$stub.md exists in commands" || \
    fail "$stub.md MISSING from commands"

  # Check dream-init loop
  grep -q "$stub.md" "$PLUGIN_DIR/commands/dream-init.md" && \
    pass "$stub.md in dream-init loop" || \
    fail "$stub.md MISSING from dream-init loop"

  # Check dream-status loop
  grep -q "$stub.md" "$PLUGIN_DIR/skills/dream-status/SKILL.md" && \
    pass "$stub.md in dream-status loop" || \
    fail "$stub.md MISSING from dream-status loop"
done

# ── 8. Skills with SKILL.md ────────────────────────────────────────────────────
header "New skill SKILL.md files"

for skill in icea-approve icea-implement icea-revise icea-status icea-feature dream-sync; do
  [ -f "$PLUGIN_DIR/skills/$skill/SKILL.md" ] && \
    pass "$skill/SKILL.md exists" || \
    fail "$skill/SKILL.md MISSING"
done

# ── 9. ADRs present ────────────────────────────────────────────────────────────
header "ADR files"

for adr in 0028 0029 0030 0031 0032 0033 0034; do
  found=$(ls "$PLUGIN_DIR/docs/adr/$adr-"*.md 2>/dev/null | head -1)
  [ -n "$found" ] && \
    pass "ADR $adr: $(basename $found)" || \
    fail "ADR $adr: MISSING"
done

# Check ADR README has all rows
for adr in 0028 0029 0030 0031 0032 0033 0034; do
  grep -q "$adr" "$PLUGIN_DIR/docs/adr/README.md" && \
    pass "ADR README row $adr" || \
    fail "ADR README missing row $adr"
done

# ── 10. Migration files ────────────────────────────────────────────────────────
header "Migration files"

for migration in "003-2.0.0" "004-2.1.0" "005-2.1.1"; do
  [ -f "$PLUGIN_DIR/docs/migrations/$migration.md" ] && \
    pass "Migration $migration.md exists" || \
    fail "Migration $migration.md MISSING"
done

# ── 11. Developer guide HTML ───────────────────────────────────────────────────
header "Developer guide HTML"

[ -f "$PLUGIN_DIR/docs/workflow/developer-guide.html" ] && \
  pass "developer-guide.html exists" || \
  fail "developer-guide.html MISSING"

# ── 12. CLAUDE.md key sections ────────────────────────────────────────────────
header "CLAUDE.md key sections"

for section in "WRITE GATE" "Keyword Handlers" "SAVE ICEA" "SAVE TECH" \
               "APPROVE ADO" "IMPLEMENT ADO" "REVISE ADO" "STATUS ADO" \
               "Feature Gate" "Dapper" "Auto-Capture"; do
  grep -q "$section" "$PLUGIN_DIR/CLAUDE.md" && \
    pass "CLAUDE.md: '$section' present" || \
    fail "CLAUDE.md: '$section' MISSING"
done

# ── 13. csharp-dotnet-rules uses Dapper not EF Core ──────────────────────────
header "Dapper convention in csharp-dotnet-rules"

grep -q "Dapper" "$PLUGIN_DIR/_project-deploy/rules/csharp-dotnet-rules.md" && \
  pass "csharp-dotnet-rules.md: Dapper present" || \
  fail "csharp-dotnet-rules.md: Dapper MISSING"

# EF Core should only appear as a prohibition ("Never use EF Core"), not as a recommendation
EF_POSITIVE=$(grep "EF Core" "$PLUGIN_DIR/_project-deploy/rules/csharp-dotnet-rules.md" 2>/dev/null | \
  grep -v "Never use\|not.*EF Core\|avoid.*EF Core\|EF Core.*not\|no.*EF Core" | head -3)
if [ -z "$EF_POSITIVE" ]; then
  pass "csharp-dotnet-rules.md: EF Core only appears as prohibition"
else
  fail "csharp-dotnet-rules.md: EF Core referenced as recommendation:"
  echo "$EF_POSITIVE" | while read -r line; do echo "    $line"; done
fi

# ── 14. icea-feature skill key sections ───────────────────────────────────────
header "icea-feature SKILL.md structure"

for section in "Step 3" "Step 4" "Step 5" "Step 6" "Step 7" "Step 8" \
               "SAVE ICEA" "SAVE TECH" "NEVER generate implementation" \
               "NEVER draft Tech Spec before ICEA\|Step 8 mechanical gate"; do
  grep -q "$section" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
    pass "icea-feature: '$section' present" || \
    fail "icea-feature: '$section' MISSING"
done

# Check approval block is gone
grep -q "APPROVAL REQUIRED\|Reply with one of.*APPROVED\|No code will be generated until you reply APPROVED" \
  "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  fail "icea-feature: old approval block still present" || \
  pass "icea-feature: old approval block removed"

# ── 15. install scripts clean ─────────────────────────────────────────────────
header "install.sh structure"

for fn in "get_plugin_version" "write_marketplace_json" "select_source" \
          "resolve_local_path" "to_win_path" "process.argv"; do
  grep -q "$fn" "$PLUGIN_DIR/install.sh" && \
    pass "install.sh: $fn present" || \
    fail "install.sh: $fn MISSING"
done

grep -q "dream-sync" "$PLUGIN_DIR/install.sh" && \
  pass "install.sh: /dream-sync mentioned in next steps" || \
  fail "install.sh: /dream-sync missing from next steps"

# ── 16. v2.2.0 Plan phase checks ──────────────────────────────────────────────
header "v2.2.0 Plan phase"

for kw in "SAVE PLAN" "PLAN ADO" "SAVE PLAN.*CONFIRM"; do
  grep -q "$kw" "$PLUGIN_DIR/CLAUDE.md" && \
    pass "CLAUDE.md: '$kw' keyword present" || \
    fail "CLAUDE.md: '$kw' keyword MISSING"
done

for rule in "NEVER write any file before SAVE PLAN" \
            "NEVER draft ICEA before plan" \
            "NEVER break Epic.*logical completion" \
            "NEVER re-ask questions already answered" \
            "ALWAYS update Story Breakdown"; do
  grep -q "$rule" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
    pass "icea-feature Hard Rules: '$rule'" || \
    fail "icea-feature Hard Rules: '$rule' MISSING"
done

for section in "Step 2 — Draft Plan" "Step 4 — On SAVE PLAN" \
               "Step 5 — Draft ICEA to temp file" \
               "Story Breakdown" "Pre-mortem" \
               "UserStory.*folder\|UserStory{ADO_ID}\|always.*UserStory" \
               "Step 1.0 — Check for existing files" \
               "plan.md.*only.*Step 5\|plan.*no ICEA.*skip\|plan.md.*exists.*no.*icea"; do
  grep -q "$section" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
    pass "icea-feature: '$section' present" || \
    fail "icea-feature: '$section' MISSING"
done

grep -q "Sign-Off" "$PLUGIN_DIR/skills/icea-feature/references/icea-template.md" && \
  pass "icea-template: Sign-Off present" || \
  fail "icea-template: Sign-Off MISSING"

grep -q "Dapper" "$PLUGIN_DIR/skills/icea-implement/SKILL.md" && \
  pass "icea-implement: Dapper convention present" || \
  fail "icea-implement: Dapper MISSING"

grep -q "Dapper" "$PLUGIN_DIR/_project-deploy/rules/csharp-dotnet-rules.md" && \
  pass "csharp-dotnet-rules: Dapper present" || \
  fail "csharp-dotnet-rules: Dapper MISSING"

grep -q "Story Breakdown" "$PLUGIN_DIR/skills/icea-feature/references/icea-template.md" && \
  pass "icea-template: Story Breakdown section present" || \
  fail "icea-template: Story Breakdown MISSING"

grep -q "Pre-mortem" "$PLUGIN_DIR/skills/icea-feature/references/icea-template.md" && \
  pass "icea-template: Pre-mortem present" || \
  fail "icea-template: Pre-mortem MISSING"

grep -q "Sign-Off" "$PLUGIN_DIR/skills/icea-feature/references/icea-template.md" && \
  pass "icea-template: Sign-Off present" || \
  fail "icea-template: Sign-Off MISSING"

grep -q "plan.*sync\|Plan.*sync\|plan may be out of sync" \
  "$PLUGIN_DIR/skills/icea-revise/SKILL.md" && \
  pass "icea-revise: plan sync warning present" || \
  fail "icea-revise: plan sync warning MISSING"

grep -q "STORY.*EPIC\|Story tracker\|Epic tracker" \
  "$PLUGIN_DIR/skills/icea-implement/SKILL.md" && \
  pass "icea-implement: Story/Epic tracker handling present" || \
  fail "icea-implement: Story/Epic tracker handling MISSING"

grep -q "STORY.*EPIC\|Story-1\|Story-{N}" \
  "$PLUGIN_DIR/skills/icea-status/SKILL.md" && \
  pass "icea-status: STORY/EPIC next actions present" || \
  fail "icea-status: STORY/EPIC next actions MISSING"

[ -f "$PLUGIN_DIR/docs/adr/0035-plan-feeds-icea.md" ] && \
  pass "ADR 0035 present" || fail "ADR 0035 MISSING"

grep -q "0035" "$PLUGIN_DIR/docs/adr/README.md" && \
  pass "ADR README row 0035" || fail "ADR README missing row 0035"

[ -f "$PLUGIN_DIR/docs/migrations/006-2.2.0.md" ] && \
  pass "Migration 006-2.2.0.md present" || fail "Migration 006-2.2.0.md MISSING"

# ── 17. Shell & Git Configuration ─────────────────────────────────────────────
header "Shell & Git Configuration"

grep -q "0b\. Shell.*Git\|Shell.*Git Configuration" "$PLUGIN_DIR/CLAUDE.md" && \
  pass "CLAUDE.md: Section 0b Shell & Git Configuration present" || \
  fail "CLAUDE.md: Section 0b Shell & Git Configuration MISSING"

grep -q "{GIT_PATH}" "$PLUGIN_DIR/CLAUDE.md" && \
  pass "CLAUDE.md: {GIT_PATH} placeholder present" || \
  fail "CLAUDE.md: {GIT_PATH} placeholder MISSING"

grep -q "{BASH_PATH}" "$PLUGIN_DIR/CLAUDE.md" && \
  pass "CLAUDE.md: {BASH_PATH} placeholder present" || \
  fail "CLAUDE.md: {BASH_PATH} placeholder MISSING"

grep -q "where.exe" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init: where.exe path detection present" || \
  fail "dream-init: where.exe path detection MISSING"

grep -q "Step 2a" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init: Step 2a present" || \
  fail "dream-init: Step 2a MISSING"

grep -q "where.exe\|GIT_PATH\|BASH_PATH" "$PLUGIN_DIR/skills/dream-sync/SKILL.md" && \
  pass "dream-sync: path resolution present" || \
  fail "dream-sync: path resolution MISSING"

[ -f "$PLUGIN_DIR/docs/migrations/007-2.2.0-shell-config.md" ] && \
  pass "Migration 007-2.2.0-shell-config.md present" || \
  fail "Migration 007-2.2.0-shell-config.md MISSING"

# ── 17. v2.3.0 dream-init CLAUDE.md fix checks ────────────────────────────────
header "v2.3.0 dream-init CLAUDE.md fixes"

# Step 1 must use explicit [ -f "./CLAUDE.md" ] not !ls CLAUDE.md
grep -q '\[ -f "\./CLAUDE\.md" \]' "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 1: uses explicit ./CLAUDE.md check" || \
  fail "dream-init Step 1: still uses bare CLAUDE.md (path resolution bug)"

# Must NOT have the old !ls CLAUDE.md check
grep -q '!ls CLAUDE\.md' "$PLUGIN_DIR/commands/dream-init.md" && \
  fail "dream-init: still contains !ls CLAUDE.md (not fixed)" || \
  pass "dream-init: !ls CLAUDE.md removed"

# Step 5 must check all 7 required section markers
grep -q "Plugin version" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 5: marker 'Plugin version' checked" || \
  fail "dream-init Step 5: marker 'Plugin version' MISSING"
grep -q "WRITE GATE" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 5: marker 'WRITE GATE' checked" || \
  fail "dream-init Step 5: marker 'WRITE GATE' MISSING"
grep -q "Keyword Handlers" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 5: marker 'Keyword Handlers' checked" || \
  fail "dream-init Step 5: marker 'Keyword Handlers' MISSING"
grep -q "0b.*Shell" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 5: marker '0b. Shell & Git' checked" || \
  fail "dream-init Step 5: marker '0b. Shell & Git' MISSING"
grep -q "Data Access Convention" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 5: marker 'Data Access Convention' checked" || \
  fail "dream-init Step 5: marker 'Data Access Convention' MISSING"
grep -q "Feature Gate" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 5: marker 'Feature Gate' checked" || \
  fail "dream-init Step 5: marker 'Feature Gate' MISSING"
grep -q "# Dream" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 5: marker '# Dream' checked" || \
  fail "dream-init Step 5: marker '# Dream' MISSING"

# Step 5 must NOT hardcode Dream section content inline (old node -e with appendFileSync and inline content)
grep -q "Auto-Capture.*Write an entry" "$PLUGIN_DIR/commands/dream-init.md" && \
  fail "dream-init Step 5: still has hardcoded inline Dream content" || \
  pass "dream-init Step 5: no hardcoded inline section content"

# Step 5 must read from PLUGIN_CLAUDE path
grep -q 'PLUGIN_CLAUDE.*plugins/ai-assisted-development.*CLAUDE\.md' "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 5: reads sections from plugin CLAUDE.md" || \
  fail "dream-init Step 5: plugin CLAUDE.md source path MISSING"

# extractSection function must be present
grep -q "extractSection" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 5: extractSection function present" || \
  fail "dream-init Step 5: extractSection function MISSING"

# ── 18. v2.3.1 path detection fixes ──────────────────────────────────────────
header "v2.3.1 path detection fixes"

# dream-init Step 2a must NOT contain the old where.exe/sed block (it's now a no-op placeholder)
grep -q "sed -i.*GIT_PATH.*CLAUDE\.md\|sed -i.*BASH_PATH.*CLAUDE\.md" "$PLUGIN_DIR/commands/dream-init.md" | head -5 | grep -qv "\./CLAUDE" 2>/dev/null && \
  fail "dream-init Step 2a: still contains bare CLAUDE.md sed call" || \
  pass "dream-init Step 2a: no longer does early path resolution"

# Phase 3 must use fallback chain (which git)
grep -q "which git" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Phase 3: fallback chain includes 'which git'" || \
  fail "dream-init Phase 3: missing 'which git' fallback"

# Phase 3 must strip NOT DETECTED before re-substituting
grep -q "NOT DETECTED.*GIT_PATH\|GIT_PATH.*NOT DETECTED" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Phase 3: strips NOT DETECTED before detection" || \
  fail "dream-init Phase 3: missing NOT DETECTED strip step"

# Phase 3 must use ./CLAUDE.md not bare CLAUDE.md
grep -q 'sed.*\./CLAUDE\.md' "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Phase 3: uses ./CLAUDE.md in sed" || \
  fail "dream-init Phase 3: sed still uses bare CLAUDE.md"

# dream-sync must detect NOT DETECTED state in grep
grep -q "NOT DETECTED.*where" "$PLUGIN_DIR/skills/dream-sync/SKILL.md" && \
  pass "dream-sync Step 5b: grep detects NOT DETECTED state" || \
  fail "dream-sync Step 5b: grep only checks literal placeholder (misses NOT DETECTED state)"

# dream-sync must use fallback chain
grep -q "which git" "$PLUGIN_DIR/skills/dream-sync/SKILL.md" && \
  pass "dream-sync Step 5b: fallback chain includes 'which git'" || \
  fail "dream-sync Step 5b: missing 'which git' fallback"

# dream-sync must strip NOT DETECTED before re-substituting
grep -q "NOT DETECTED.*GIT_PATH\|GIT_PATH.*NOT DETECTED" "$PLUGIN_DIR/skills/dream-sync/SKILL.md" && \
  pass "dream-sync Step 5b: strips NOT DETECTED before detection" || \
  fail "dream-sync Step 5b: missing NOT DETECTED strip step"

# dream-sync must use ./CLAUDE.md
grep -q '\./CLAUDE\.md' "$PLUGIN_DIR/skills/dream-sync/SKILL.md" && \
  pass "dream-sync Step 5b: uses ./CLAUDE.md" || \
  fail "dream-sync Step 5b: still uses bare CLAUDE.md"

# ── 19. v2.4.0 temp/ rendering aid checks ────────────────────────────────────
header "v2.4.0 temp/ rendering aid"

# icea-feature must NOT dump ICEA inline (old "Present draft with gap list" pattern)
grep -q "Present draft with gap list\|Present it inline" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  fail "icea-feature: still presents ICEA inline in chat" || \
  pass "icea-feature: no inline ICEA dump"

# icea-feature must write to temp/
grep -q "temp/ADO-{ADO_ID}-icea.md" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature: writes ICEA to temp/" || \
  fail "icea-feature: temp/ADO-{ID}-icea.md write MISSING"

grep -q "temp/ADO-{ADO_ID}-tech.md" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature: writes Tech Spec to temp/" || \
  fail "icea-feature: temp/ADO-{ID}-tech.md write MISSING"

# icea-feature must copy from temp on SAVE and delete
grep -q "cp temp/ADO-{ADO_ID}-icea.md" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature: copies temp ICEA to permanent on SAVE" || \
  fail "icea-feature: missing cp from temp/ on SAVE ICEA"

grep -q "rm.*temp/ADO-{ADO_ID}" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature: deletes temp files after SAVE" || \
  fail "icea-feature: missing rm of temp files after SAVE"

# icea-feature must have TEMP_WRITE_EXEMPT block
grep -q "TEMP_WRITE_EXEMPT" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature: TEMP_WRITE_EXEMPT block present" || \
  fail "icea-feature: TEMP_WRITE_EXEMPT block MISSING"

# icea-revise must write to temp/
grep -q "temp/ADO-{ADO_ID}-icea.md" "$PLUGIN_DIR/skills/icea-revise/SKILL.md" && \
  pass "icea-revise: writes revision to temp/" || \
  fail "icea-revise: temp/ADO-{ID}-icea.md write MISSING"

# icea-revise must have TEMP_WRITE_EXEMPT block
grep -q "TEMP_WRITE_EXEMPT" "$PLUGIN_DIR/skills/icea-revise/SKILL.md" && \
  pass "icea-revise: TEMP_WRITE_EXEMPT block present" || \
  fail "icea-revise: TEMP_WRITE_EXEMPT block MISSING"

# gitignore-sync must include temp/
grep -q "'temp/'" "$PLUGIN_DIR/commands/gitignore-sync.md" && \
  pass "gitignore-sync: temp/ in managed BASE entries" || \
  fail "gitignore-sync: temp/ MISSING from managed entries"

# ADR 0036 must exist
[ -f "$PLUGIN_DIR/docs/adr/0036-temp-rendering-aid.md" ] && \
  pass "ADR 0036-temp-rendering-aid.md present" || \
  fail "ADR 0036-temp-rendering-aid.md MISSING"

# ── 20. v2.4.1 CLAUDE.md enforcement + doc currency checks ───────────────────
header "v2.4.1 CLAUDE.md enforcement + doc currency"

# CLAUDE.md write gate must NOT say "Immediately after draft"
grep -q "Immediately after draft" "$PLUGIN_DIR/CLAUDE.md" && \
  fail "CLAUDE.md write gate: stale 'Immediately after draft' row still present" || \
  pass "CLAUDE.md write gate: stale row removed"

# CLAUDE.md write gate must have temp/ rows
grep -q "temp/ADO-{ID}-icea.md" "$PLUGIN_DIR/CLAUDE.md" && \
  pass "CLAUDE.md write gate: temp/ADO-{ID}-icea.md row present" || \
  fail "CLAUDE.md write gate: temp/ADO-{ID}-icea.md row MISSING"

# CLAUDE.md write gate must have pre-plan gate rule
grep -q "Pre-plan gate\|ICEA drafting is BLOCKED" "$PLUGIN_DIR/CLAUDE.md" && \
  pass "CLAUDE.md: pre-plan gate rule present" || \
  fail "CLAUDE.md: pre-plan gate rule MISSING"

# CLAUDE.md keyword handler must NOT say "inline"
grep -q "draft ICEA inline\|draft Tech Spec inline" "$PLUGIN_DIR/CLAUDE.md" && \
  fail "CLAUDE.md keyword handlers: stale 'inline' references still present" || \
  pass "CLAUDE.md keyword handlers: no stale inline references"

# CLAUDE.md keyword handler must reference temp/
grep -q "temp/ADO-{ID}-icea.md" "$PLUGIN_DIR/CLAUDE.md" && \
  pass "CLAUDE.md keyword handlers: temp/ flow described" || \
  fail "CLAUDE.md keyword handlers: temp/ reference MISSING"

# README version blurb must not describe v1.16 language features
grep -q "java-rules.*python-rules\|language-coverage-matrix" "$PLUGIN_DIR/README.md" && \
  fail "README: version blurb still describes v1.16 language features" || \
  pass "README: version blurb updated"

# developer-guide.html must not show old version
grep -q "Version 2\.1\.0\|Version 2\.2\.0\|Version 2\.3\." "$PLUGIN_DIR/docs/workflow/developer-guide.html" && \
  fail "developer-guide.html: stale version in nav header" || \
  pass "developer-guide.html: version header current"

# developer-guide.html must describe temp/ flow
grep -q "temp/ADO-{ID}-icea.md\|Ctrl+Shift+V" "$PLUGIN_DIR/docs/workflow/developer-guide.html" && \
  pass "developer-guide.html: temp/ flow and VS Code preview documented" || \
  fail "developer-guide.html: temp/ flow MISSING"

# All three new migration files must exist
[ -f "$PLUGIN_DIR/docs/migrations/008-2.3.0.md" ] && \
  pass "Migration 008-2.3.0.md present" || \
  fail "Migration 008-2.3.0.md MISSING"
[ -f "$PLUGIN_DIR/docs/migrations/009-2.3.1.md" ] && \
  pass "Migration 009-2.3.1.md present" || \
  fail "Migration 009-2.3.1.md MISSING"
[ -f "$PLUGIN_DIR/docs/migrations/010-2.4.1.md" ] && \
  pass "Migration 010-2.4.1.md present" || \
  fail "Migration 010-2.4.1.md MISSING"

# ADR README must list 0036
grep -q "0036" "$PLUGIN_DIR/docs/adr/README.md" && \
  pass "ADR README: 0036 listed" || \
  fail "ADR README: 0036 MISSING"

# icea-template must be current version
grep -q "ICEA Template v2\.2\.0" "$PLUGIN_DIR/skills/icea-feature/references/icea-template.md" && \
  fail "icea-template: still shows v2.2.0 header" || \
  pass "icea-template: version header updated"

# ── 21. v2.4.2 plan gate enforcement checks ──────────────────────────────────
header "v2.4.2 plan gate enforcement"

# Step 2 must NOT say "inline" in the heading
grep -q "### Step 2 — Draft Plan inline" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  fail "icea-feature Step 2: still has 'inline' in heading" || \
  pass "icea-feature Step 2: 'inline' removed from heading"

# Step 2 must have STOP block
grep -q "STOP — plan gate\|⛔ STOP" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 2: hard STOP block present" || \
  fail "icea-feature Step 2: hard STOP block MISSING"

# Step 3 must have structural end-of-response prompt
grep -q "Review the plan. When ready: SAVE PLAN" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 3: structural end-of-response prompt present" || \
  fail "icea-feature Step 3: structural end-of-response prompt MISSING"

# Step 3 must prohibit proactive advancement
grep -q "Do not advance to Step 4\|Advancing is only permitted" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 3: proactive advancement prohibited" || \
  fail "icea-feature Step 3: proactive advancement prohibition MISSING"

# Step 5 must have mechanical gate bash check
grep -q "PLAN_GATE_BLOCKED\|PLAN_GATE_PASSED" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 5: mechanical plan gate check present" || \
  fail "icea-feature Step 5: mechanical plan gate check MISSING"

# Step 5 gate must check for plan file existence
grep -q 'find.*plan\.md\|ADO-.*plan\.md' "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 5: plan file existence check present" || \
  fail "icea-feature Step 5: plan file existence check MISSING"

# session-start must have correct ICEA path
grep -q "docs/Release.*Sprint.*UserStory.*icea.md" "$PLUGIN_DIR/commands/session-start.md" && \
  pass "session-start: Feature Gate has correct ICEA path" || \
  fail "session-start: Feature Gate still has stale ICEA path"

# session-start must NOT say "plan implementation"
grep -q "plan implementation" "$PLUGIN_DIR/commands/session-start.md" && \
  fail "session-start: still says 'plan implementation' (blocks plan drafting)" || \
  pass "session-start: 'plan implementation' wording removed"

# Hard Rules must reference mechanical gate
grep -q "Step 5 mechanical gate" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Hard Rules: mechanical gate referenced" || \
  fail "icea-feature Hard Rules: mechanical gate reference MISSING"

# ── 22. v2.4.3 flow gate completeness checks ─────────────────────────────────
header "v2.4.3 flow gate completeness"

# Step 1 must not say "create the ICEA"
grep -q "Before I create the ICEA" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  fail "icea-feature Step 1: still says 'create the ICEA' (framing bias)" || \
  pass "icea-feature Step 1: framing corrected"

# Step 5 must have STOP block after temp write
grep -q "STOP — ICEA review gate\|⛔ STOP.*ICEA" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 5: STOP block after temp ICEA write present" || \
  fail "icea-feature Step 5: STOP block after temp ICEA write MISSING"

# Step 6 must have structural save prompt
grep -q "Review the ICEA in VS Code preview. When ready: SAVE ICEA" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 6: structural save prompt present" || \
  fail "icea-feature Step 6: structural save prompt MISSING"

# Step 7 must have mkdir -p
grep -q "mkdir -p.*DEST_DIR\|mkdir -p.*UserStory" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 7: mkdir -p before cp present" || \
  fail "icea-feature Step 7: mkdir -p before cp MISSING (data loss risk)"

# Step 8 must have mechanical ICEA gate
grep -q "ICEA_GATE_BLOCKED\|ICEA_GATE_PASSED" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 8: mechanical ICEA gate present" || \
  fail "icea-feature Step 8: mechanical ICEA gate MISSING"

# Step 8 gate must check for icea file
grep -q 'find.*ADO-.*icea\.md\|ICEA_FILE.*find' "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 8: ICEA file existence check present" || \
  fail "icea-feature Step 8: ICEA file existence check MISSING"

# Step 9 must have structural save prompt
grep -q "Review the Tech Spec in VS Code preview. When ready: SAVE TECH" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 9: structural save prompt present" || \
  fail "icea-feature Step 9: structural save prompt MISSING"

# Step 10 must have mkdir -p
grep -c "mkdir -p" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" | grep -q "^[2-9]" && \
  pass "icea-feature Step 10: mkdir -p present (multiple occurrences)" || \
  fail "icea-feature Step 10: mkdir -p MISSING (data loss risk)"

# Hard Rules must cover all gates
grep -q "Step 8 mechanical gate" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Hard Rules: Step 8 gate referenced" || \
  fail "icea-feature Hard Rules: Step 8 gate reference MISSING"

grep -q "ALWAYS end every Step 6" "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Hard Rules: Step 6 structural prompt referenced" || \
  fail "icea-feature Hard Rules: Step 6 structural prompt reference MISSING"

# ── 23. v2.4.4 dream-init version tracking fixes ─────────────────────────────
header "v2.4.4 dream-init version tracking"

# Step 4 must NOT use the old wrong relative path
grep -q "require('\.claude-plugin/plugin\.json')\|require(\".claude-plugin/plugin\.json\")" \
  "$PLUGIN_DIR/commands/dream-init.md" && \
  fail "dream-init Step 4: still reads plugin.json from wrong relative path" || \
  pass "dream-init Step 4: wrong relative path removed"

# Step 4 must read from the plugin install dir
grep -q "plugins/ai-assisted-development.*plugin\.json\|plugins.*ai-assisted-development.*\.claude-plugin" \
  "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Step 4: reads plugin.json from correct install path" || \
  fail "dream-init Step 4: correct plugin.json path MISSING"

# Phase 2 must have stale-content replacement (Pass 1)
grep -q "Pass 1.*Stale-content\|Stale-content replacement" \
  "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Phase 2: Pass 1 stale-content replacement present" || \
  fail "dream-init Phase 2: Pass 1 stale-content replacement MISSING"

# Phase 2 must check for known stale strings
grep -q "Immediately after draft\|draft ICEA inline" \
  "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Phase 2: known-stale string detection present" || \
  fail "dream-init Phase 2: known-stale string detection MISSING"

# Phase 2 must have replaceSection function
grep -q "replaceSection" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Phase 2: replaceSection function present" || \
  fail "dream-init Phase 2: replaceSection function MISSING"

# Phase 2 must have version stamp pass (Pass 3)
grep -q "Pass 3.*Stamp\|Stamp version line" "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Phase 2: Pass 3 version stamp present" || \
  fail "dream-init Phase 2: Pass 3 version stamp MISSING"

# Phase 2 must stamp version after passes complete
grep -q "installedVersion.*Plugin version\|Plugin version.*installedVersion" \
  "$PLUGIN_DIR/commands/dream-init.md" && \
  pass "dream-init Phase 2: version stamp uses installedVersion" || \
  fail "dream-init Phase 2: version stamp does not use installedVersion"

# ── 24. v2.5.0 Tech Spec template + section heading fixes ────────────────────
header "v2.5.0 Tech Spec template + section heading refs"

# Four skills must not reference sections by number
grep -q "Tech Spec Section 9\|from Tech Spec Section" \
  "$PLUGIN_DIR/skills/icea-implement/SKILL.md" && \
  fail "icea-implement: still references Section 9 by number" || \
  pass "icea-implement: section number reference removed"

grep -q "Section 10 table\|Section 10\b" \
  "$PLUGIN_DIR/skills/icea-revise/SKILL.md" && \
  fail "icea-revise: still references Section 10 by number" || \
  pass "icea-revise: section number references removed"

grep -q "Section 11\b" "$PLUGIN_DIR/skills/icea-approve/SKILL.md" && \
  fail "icea-approve: still references Section 11 by number" || \
  pass "icea-approve: section number reference removed"

grep -q "Section 10 table\|Section 10\b" \
  "$PLUGIN_DIR/skills/icea-status/SKILL.md" && \
  fail "icea-status: still references Section 10 by number" || \
  pass "icea-status: section number reference removed"

# Skills must use heading-based references
grep -q "## Test Cases\|Test Cases.*section" \
  "$PLUGIN_DIR/skills/icea-implement/SKILL.md" && \
  pass "icea-implement: uses heading-based test cases reference" || \
  fail "icea-implement: heading-based test cases reference MISSING"

grep -q "## Open Questions\|Open Questions.*table" \
  "$PLUGIN_DIR/skills/icea-revise/SKILL.md" && \
  pass "icea-revise: uses heading-based open questions reference" || \
  fail "icea-revise: heading-based open questions reference MISSING"

grep -q "## Sizing and Story Breakdown\|Sizing and Story Breakdown" \
  "$PLUGIN_DIR/skills/icea-approve/SKILL.md" && \
  pass "icea-approve: uses heading-based sizing reference" || \
  fail "icea-approve: heading-based sizing reference MISSING"

grep -q "## Open Questions\|Open Questions.*table" \
  "$PLUGIN_DIR/skills/icea-status/SKILL.md" && \
  pass "icea-status: uses heading-based open questions reference" || \
  fail "icea-status: heading-based open questions reference MISSING"

# Template files must exist
[ -f "$PLUGIN_DIR/skills/icea-feature/references/techspec-base.md" ] && \
  pass "techspec-base.md present" || \
  fail "techspec-base.md MISSING"

[ -f "$PLUGIN_DIR/skills/icea-feature/references/techspec-aspnet-mvc-jquery.md" ] && \
  pass "techspec-aspnet-mvc-jquery.md present" || \
  fail "techspec-aspnet-mvc-jquery.md MISSING"

# Base template must have mandatory sections as headings
for heading in "## AC Coverage Matrix" "## Test Cases" "## Open Questions" \
               "## Sizing and Story Breakdown" "## Definition of Done" \
               "## Error Handling" "## Rollback" "## Handover"; do
  grep -q "$heading" "$PLUGIN_DIR/skills/icea-feature/references/techspec-base.md" && \
    pass "techspec-base.md: '$heading' present" || \
    fail "techspec-base.md: '$heading' MISSING"
done

# Overlay must have key ASP.NET MVC sections
for heading in "## Files Changed" "## Controller Layer" "## Service Interface" \
               "## Service Implementation" "## Auth \& Security"; do
  grep -q "$heading" "$PLUGIN_DIR/skills/icea-feature/references/techspec-aspnet-mvc-jquery.md" && \
    pass "techspec-aspnet-mvc-jquery.md: '$heading' present" || \
    fail "techspec-aspnet-mvc-jquery.md: '$heading' MISSING"
done

# Step 8 must read detected_stacks
grep -q "detected_stacks\|dream-init-state" \
  "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Step 8: reads detected_stacks for template selection" || \
  fail "icea-feature Step 8: detected_stacks read MISSING"

# Hard Rules must reference mandatory sections
grep -q "NEVER omit the AC Coverage Matrix" \
  "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Hard Rules: AC Coverage Matrix mandatory" || \
  fail "icea-feature Hard Rules: AC Coverage Matrix mandatory rule MISSING"

grep -q "NEVER omit the Test Cases" \
  "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Hard Rules: Test Cases mandatory" || \
  fail "icea-feature Hard Rules: Test Cases mandatory rule MISSING"

grep -q "NEVER use section numbers" \
  "$PLUGIN_DIR/skills/icea-feature/SKILL.md" && \
  pass "icea-feature Hard Rules: no section numbers rule present" || \
  fail "icea-feature Hard Rules: no section numbers rule MISSING"

# Critic must have Tech Spec conformance check
grep -q "AC Coverage Matrix present\|AC Coverage Matrix" \
  "$PLUGIN_DIR/skills/critic/SKILL.md" && \
  pass "critic: Tech Spec AC Coverage Matrix check present" || \
  fail "critic: Tech Spec conformance check MISSING"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  ${YELLOW}WARN: $WARN${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}  All checks passed — safe to package.${NC}"
  exit 0
else
  echo -e "${RED}  $FAIL check(s) failed — fix before packaging.${NC}"
  exit 1
fi