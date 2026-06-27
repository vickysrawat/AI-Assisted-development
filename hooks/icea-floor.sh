#!/usr/bin/env bash
# hooks/icea-floor.sh — PreToolUse hook: mechanical ICEA floor
#
# Deterministic enforcement of the ICEA gate's minimum guarantee. Unlike the
# prompt-based gate (which is probabilistic), this hook runs on every Write/Edit
# tool call and BLOCKS source-file writes when no approved ICEA exists in the
# current working session.
#
# This is the FLOOR, not the gate: it cannot know which feature a write belongs
# to, so it checks the coarse predicate "an ICEA with Status: Approved (or
# Tier: T1) has been touched recently". The prompt-based gate provides the rich
# judgment; this hook guarantees code is never written with NO approval at all.
#
# Wiring (in .claude/settings.json):
# {
#   "hooks": {
#     "PreToolUse": [
#       {
#         "matcher": "Write|Edit",
#         "hooks": [{ "type": "command", "command": "bash .claude/hooks/icea-floor.sh" }]
#       }
#     ]
#   }
# }
#
# The hook receives the tool call as JSON on stdin. Exit 0 = allow, exit 2 = block
# (stderr is shown to the model so it can self-correct).

set -u

INPUT=$(cat)

# Extract the file path being written (jq if present, grep fallback)
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//;s/"$//')
fi

[ -z "$FILE_PATH" ] && exit 0   # Not a file write we understand — allow

# Only guard source files. Docs, ICEA files, ledgers, memory, config are exempt.
case "$FILE_PATH" in
  */docs/*|*.md|*.icea.md|*.techspec.md|*/memory/*|*/.claude/*|*.json|*.yaml|*.yml|*.gitignore|*/tests/*)
    exit 0 ;;
esac
case "$FILE_PATH" in
  *.cs|*.ts|*.tsx|*.js|*.jsx|*.py|*.java|*.html|*.css|*.scss|*.sql) : ;;  # guarded
  *) exit 0 ;;                                                            # everything else allowed
esac

# The floor predicate: an ICEA file marked Approved or Tier: T1 modified in the
# last 8 hours anywhere under docs/. Coarse by design.
# ICEA files are now named ADO-<id>-<feature>.icea.md under
# docs/Release{R}/Sprint{S}/UserStory{ID}/ (V1.30+).
# Legacy forms (ADO-*.md, icea-*.md) are also matched for backward compat.
RECENT_ICEA=$(find docs \( -name "*.icea.md" -o -name "ADO-*.md" -o -name "icea-*.md" \) -mmin -480 2>/dev/null | head -20)

if [ -n "$RECENT_ICEA" ]; then
  for f in $RECENT_ICEA; do
    if grep -qE "Status:.*Approved|Tier:[[:space:]]*T1" "$f" 2>/dev/null; then
      exit 0   # Floor satisfied
    fi
  done
fi

echo "ICEA FLOOR: blocked write to $FILE_PATH — no approved ICEA (or T1 auto-ICEA) found modified in the last 8h under docs/. Create and approve an ICEA first (/icea-feature), or if one exists, touch it to confirm it is current. This is the mechanical floor beneath the ICEA gate." >&2
exit 2
