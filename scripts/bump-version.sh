#!/usr/bin/env bash
# scripts/bump-version.sh <new-version>
# Full release pass. The version single-source-of-truth is .claude-plugin/plugin.json;
# the version writes + drift guard are done by scripts/bump-version.js (Node — no Python).
# This wrapper adds the git-hook re-sync and runs the Python validator when available.
# Run from the plugin root directory.

set -e

NEW_VER="$1"
if [ -z "$NEW_VER" ]; then
  echo "Usage: ./scripts/bump-version.sh <new-version>"
  echo "Example: ./scripts/bump-version.sh 3.4.0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1-4 + drift guard: version writes are all in Node (runs anywhere Node does).
node "$SCRIPT_DIR/bump-version.js" "$NEW_VER"

# 5. Re-sync deployed hooks so the floor never lags the plugin (ADR 0009).
if [ -d .claude/hooks ]; then
  cp _project-deploy/hooks/*.sh _project-deploy/hooks/*.py .claude/hooks/ 2>/dev/null || true
  chmod +x .claude/hooks/*.sh .claude/hooks/*.py 2>/dev/null || true
  sha256sum .claude/hooks/* 2>/dev/null | grep -v ".hashes" > .claude/hooks/.hashes || true
  [ -f .git/hooks/pre-commit ] && cp .claude/hooks/findings-gate-precommit.sh .git/hooks/pre-commit
  echo "  ✓ Hooks re-synced and hashes refreshed"
fi

# 6. Full validator — Python; skip cleanly if the interpreter is absent.
echo ""
if command -v python3 >/dev/null 2>&1; then
  echo "🔍  Running validator..."
  python3 tests/validate.py
else
  echo "⚠  python3 not found — skipped tests/validate.py (version + drift already checked by bump-version.js)."
fi

echo ""
echo "✅  Version set to $NEW_VER. Fill in the CHANGELOG entry before release."
