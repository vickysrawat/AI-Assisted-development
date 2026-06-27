#!/usr/bin/env bash
# scripts/bump-version.sh <new-version>
# Updates plugin.json, CLAUDE.md, and prepends a CHANGELOG entry stub.
# Then runs the validator to confirm consistency.
# Run from the plugin root directory.

set -e

NEW_VER="$1"
if [ -z "$NEW_VER" ]; then
  echo "Usage: ./scripts/bump-version.sh <new-version>"
  echo "Example: ./scripts/bump-version.sh 1.23.0"
  exit 1
fi

# Validate format
if ! echo "$NEW_VER" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "❌  Version must be in X.Y.Z format. Got: $NEW_VER"
  exit 1
fi

CURRENT=$(python3 -c "import json; print(json.load(open('.claude-plugin/plugin.json'))['version'])")
echo "🔧  Bumping $CURRENT → $NEW_VER"

# 1. plugin.json
python3 - << PYEOF
import json
with open('.claude-plugin/plugin.json') as f:
    p = json.load(f)
p['version'] = '$NEW_VER'
with open('.claude-plugin/plugin.json', 'w') as f:
    json.dump(p, f, indent=2)
print("  ✓ plugin.json updated")
PYEOF

# 2. CLAUDE.md
sed -i "s/# Plugin version: .*/# Plugin version: $NEW_VER (update this line after dream-init or plugin upgrade)/" CLAUDE.md
echo "  ✓ CLAUDE.md updated"

# 3. CHANGELOG.md — prepend stub entry
TODAY=$(date +%Y-%m-%d)
TMPFILE=$(mktemp)
cat > "$TMPFILE" << CLEOF
## [$NEW_VER] — $TODAY

### TODO: Add summary of changes

TODO: Describe what changed, which files were affected, and why.

---

CLEOF
cat CHANGELOG.md >> "$TMPFILE"
mv "$TMPFILE" CHANGELOG.md
echo "  ✓ CHANGELOG.md — stub entry prepended (fill in the TODO fields)"

# 3b. Re-sync deployed hooks so the floor never lags the plugin (ADR 0009)
if [ -d .claude/hooks ]; then
  cp hooks/*.sh hooks/*.py .claude/hooks/ 2>/dev/null
  chmod +x .claude/hooks/*.sh .claude/hooks/*.py 2>/dev/null
  sha256sum .claude/hooks/* 2>/dev/null | grep -v ".hashes" > .claude/hooks/.hashes
  [ -f .git/hooks/pre-commit ] && cp .claude/hooks/findings-gate-precommit.sh .git/hooks/pre-commit
  echo "  ✓ Hooks re-synced and hashes refreshed"
fi

# 4. Guide staleness reminder — the validator (check 29) will flag guides more
# than one minor behind as ERRORS. Surface this before the validator run so the
# author updates guides as part of the release, not as an afterthought.
echo ""
echo "📖  Guide check:"
for guide in user-guide.html plugin-guide-v9.html; do
  gv=$(grep -oE "documents-plugin-version: [0-9.]+" "$guide" 2>/dev/null | awk '{print $2}')
  if [ "$gv" != "$NEW_VER" ]; then
    echo "    ⚠️  $guide documents v${gv:-NONE} — update content AND its stamp to $NEW_VER"
  else
    echo "    ✓ $guide is current"
  fi
done

# 5. Run validator
echo ""
echo "🔍  Running validator..."
if python3 tests/validate.py; then
  echo ""
  echo "✅  Version bumped to $NEW_VER. Fill in the CHANGELOG entry before release."
else
  echo ""
  echo "⚠️   Validator found issues — fix them before committing."
  exit 1
fi
