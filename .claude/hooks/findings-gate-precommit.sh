#!/usr/bin/env bash
# hooks/findings-gate-precommit.sh — git pre-commit hook: mechanical findings gate
#
# Deterministic version of the findings gate from skills/shared/findings-gate.md.
# The /checkin command applies the same logic via model instructions; this hook
# guarantees the floor even when a developer commits directly with `git commit`,
# bypassing /checkin entirely.
#
# Install:  cp .claude/hooks/findings-gate-precommit.sh .git/hooks/pre-commit
#           chmod +x .git/hooks/pre-commit
# (setup-init offers this automatically; see CHANGELOG 1.23.0)
#
# Override: SKIP_FINDINGS_GATE=1 git commit ...   (logged to stderr, visible in CI)

set -u

if [ "${SKIP_FINDINGS_GATE:-0}" = "1" ]; then
  echo "⚠️  findings-gate: SKIPPED via SKIP_FINDINGS_GATE=1 — record your justification in the commit message" >&2
  exit 0
fi

# ── Secret guard for the shared .claude/settings.json ──────────────────────────────
# settings.json is committed and team-shared; secrets belong ONLY in the gitignored
# settings.local.json (or an OS env var). Block a commit that would slip a secret into
# the shared file. Self-contained: calls the deployed Node detector when Node is present.
if command -v node >/dev/null 2>&1 && [ -f .claude/hooks/check-settings-secrets.cjs ]; then
  if ! node .claude/hooks/check-settings-secrets.cjs --staged; then
    echo "" >&2
    echo "Commit blocked by settings-secret-guard. Override (with a written justification" >&2
    echo "in the commit message) via: SKIP_FINDINGS_GATE=1 git commit ..." >&2
    exit 1
  fi
fi

LEDGERS="CodeReviews/code-review-ledger.md security/security-ledger.md dynamic-scan/dynamic-scan-ledger.md"
TOTAL=0
DETAIL=""

for ledger in $LEDGERS; do
  [ -f "$ledger" ] || continue
  # Count findings in ## Open Findings section with Critical or High severity
  # and Status: Open. Mirrors get_open_critical_high() in findings-gate.md.
  OPEN_SECTION=$(awk '/^## Open Findings/{flag=1;next}/^## /{flag=0}flag' "$ledger")
  COUNT=$(echo "$OPEN_SECTION" | grep -cE "^### \[FP-[a-f0-9]+[a-z]?\] .* (Critical|High)$" || true)
  if [ "$COUNT" -gt 0 ]; then
    TOTAL=$((TOTAL + COUNT))
    DETAIL="${DETAIL}\n  $ledger: $COUNT open Critical/High"
  fi
done

if [ "$TOTAL" -gt 0 ]; then
  echo "❌ findings-gate: commit blocked — $TOTAL open Critical/High finding(s):" >&2
  printf "%b\n" "$DETAIL" >&2
  echo "" >&2
  echo "Resolve with /fix FP-xxxxxxxx, dismiss with justification via /dismiss," >&2
  echo "or override with SKIP_FINDINGS_GATE=1 and a written justification in the commit message." >&2
  exit 1
fi

exit 0
