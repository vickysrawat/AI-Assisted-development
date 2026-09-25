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

# Best-effort governance-audit append — never blocks the commit. Values pass via env to avoid
# any shell/JSON escaping of the justification. Requires Node (always present on the node path).
audit_bypass() {
  command -v node >/dev/null 2>&1 || return 0
  node -e 'try{require(process.cwd()+"/.claude/hooks/audit-append.cjs").appendEvent({event:"gate.bypass",action:"SKIP_FINDINGS_GATE",result:"granted",source:"pre-commit",detail:process.env.FINDINGS_GATE_JUSTIFICATION||""})}catch(e){}' 2>/dev/null || true
}
audit_block() { # $1 = action, $2 = detail
  command -v node >/dev/null 2>&1 || return 0
  AUDIT_ACTION="$1" AUDIT_DETAIL="$2" node -e 'try{require(process.cwd()+"/.claude/hooks/audit-append.cjs").appendEvent({event:"gate.block",action:process.env.AUDIT_ACTION,result:"blocked",source:"pre-commit",detail:process.env.AUDIT_DETAIL||""})}catch(e){}' 2>/dev/null || true
}

if [ "${SKIP_FINDINGS_GATE:-0}" = "1" ]; then
  # A bypass must carry a justification — the error message IS the ask (a pre-commit hook
  # cannot prompt-and-wait interactively).
  if [ -z "${FINDINGS_GATE_JUSTIFICATION:-}" ]; then
    echo "" >&2
    echo "❌ SKIP_FINDINGS_GATE=1 requires a justification." >&2
    echo "   Set FINDINGS_GATE_JUSTIFICATION=\"reason\" to bypass, e.g.:" >&2
    echo "   SKIP_FINDINGS_GATE=1 FINDINGS_GATE_JUSTIFICATION=\"hotfix CVE waiver ADO-1234\" git commit ..." >&2
    echo "" >&2
    exit 1
  fi
  audit_bypass
  echo "⚠️  findings-gate: SKIPPED via SKIP_FINDINGS_GATE=1 (justification logged to the audit trail)" >&2
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
    audit_block "secrets-guard" "staged settings.json"
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
  echo "or override with SKIP_FINDINGS_GATE=1 and FINDINGS_GATE_JUSTIFICATION=\"reason\"." >&2
  audit_block "findings-gate" "$TOTAL open Critical/High"
  exit 1
fi

exit 0
