# Findings Gate — Shared Specification
_Spec version: 1.0 · Last changed: 2026-06-10 · Applies to: pr-create, checkin_

Single source of truth for open Critical/High findings detection across all three
ledgers. Both skills delegate to this spec rather than implementing their own
ledger-walking logic.

---

## Ledgers

| Ledger | Path |
|---|---|
| Code review | `CodeReviews/code-review-ledger.md` |
| Security | `security/security-ledger.md` |
| Dynamic scan | `dynamic-scan/dynamic-scan-ledger.md` |

---

## Canonical bash functions

Copy these verbatim into any skill that needs findings detection.
Do not write local variants — changes to this spec must propagate to both callers.

```bash
# Returns FP IDs for open Critical or High findings in a ledger.
# A finding is open only if its section contains "**Status**: Open".
# Dismissed findings (any reason) are excluded.
get_open_critical_high() {
  local ledger="$1"
  [ -f "$ledger" ] || return
  grep "^### \[FP-" "$ledger" | grep -iE "Critical|High" | \
    grep -oE "FP-[0-9a-f]{8}" | while read fp; do
      awk "/^### \[$fp\]/,/^### \[FP-/" "$ledger" | \
        grep -q "\*\*Status\*\*: Open" && echo "$fp"
    done
}

# Returns FP IDs for accepted-risk dismissed Critical or High findings.
# Used to populate the informational note in PR descriptions and commit messages.
get_accepted_risk_dismissed() {
  local ledger="$1"
  [ -f "$ledger" ] || return
  grep "^### \[FP-" "$ledger" | grep -iE "Critical|High" | \
    grep -oE "FP-[0-9a-f]{8}" | while read fp; do
      section=$(awk "/^### \[$fp\]/,/^### \[FP-/" "$ledger" 2>/dev/null)
      echo "$section" | grep -q "\*\*Status\*\*: Dismissed" && \
      echo "$section" | grep -q "\*\*Reason\*\*: accepted-risk" && echo "$fp"
    done
}
```

---

## How to invoke

Run against all three ledgers:

```bash
cr_open=$(get_open_critical_high CodeReviews/code-review-ledger.md)
sec_open=$(get_open_critical_high security/security-ledger.md)
ds_open=$(get_open_critical_high dynamic-scan/dynamic-scan-ledger.md)

cr_count=$(echo "$cr_open" | grep -c "FP-" || echo 0)
sec_count=$(echo "$sec_open" | grep -c "FP-" || echo 0)
ds_count=$(echo "$ds_open" | grep -c "FP-" || echo 0)

total_open=$((cr_count + sec_count + ds_count))

cr_dismissed=$(get_accepted_risk_dismissed CodeReviews/code-review-ledger.md)
sec_dismissed=$(get_accepted_risk_dismissed security/security-ledger.md)
ds_dismissed=$(get_accepted_risk_dismissed dynamic-scan/dynamic-scan-ledger.md)
```

---

## Result structure

After running the above, callers have:

| Variable | Type | Meaning |
|---|---|---|
| `cr_open` | newline-separated FP IDs | Open Critical/High in code-review ledger |
| `sec_open` | newline-separated FP IDs | Open Critical/High in security ledger |
| `ds_open` | newline-separated FP IDs | Open Critical/High in dynamic-scan ledger |
| `total_open` | integer | Sum across all three ledgers |
| `cr_dismissed` / `sec_dismissed` / `ds_dismissed` | newline-separated FP IDs | Accepted-risk dismissals per ledger |

---

## Output blocks by caller

Each caller formats the result differently. Use the result structure above;
do not re-implement the bash logic.

### `pr-create` — soft gate (developer decides)

If `total_open > 0`, include in the Step 6 ADO connection prompt:

```
⚠️ Open Critical/High findings detected (N total):

  Code review  : N open  — run /fix FP-xxx or /code-review to view
  Security     : N open  — run /fix FP-xxx or /security-review to view
  Dynamic scan : N open  — run /fix FP-xxx or /dynamic-scan to view

  Proceeding creates a PR with known Critical/High issues unresolved.
  Proceed anyway? (yes / fix-first / no)
```

- `fix-first` → stop, list specific FP IDs
- `yes` → proceed, append `⚠️ N open Critical/High findings acknowledged` to PR description
- `no` → cancel

If `accepted-risk` dismissed findings exist, append to the PR description body:

```
⚠️ Accepted-risk dismissals (Critical/High):
  [FP-xxxxxxxx] {VULN-TYPE} — {severity} — dismissed by {user} on {date}
  Reason: {justification}
```

### `checkin` — hard gate (blocked unless overridden)

If `total_open > 0`:

```
❌ BLOCKED — open Critical/High findings detected

  Code review  : N open Critical/High findings
  Security     : N open Critical/High findings
  Dynamic scan : N open Critical/High findings

  Open findings:
    [FP-xxxxxxxx] <VULN-TYPE> — Critical — <file>
    [FP-xxxxxxxx] <VULN-TYPE> — High    — <file>

  Fix open findings first:
    /fix FP-xxxxxxxx

  To override (risk acceptance, not recommended):
    Re-run with --skip-security-gate and provide a written justification.
    The override will be noted in the commit message.
```

On `--skip-security-gate`: proceed, prepend to the suggested commit message:
```
⚠ Security gate bypassed: {developer-provided justification}
```

If `accepted-risk` dismissed findings exist, include as informational note (non-blocking):
```
ℹ️ Accepted-risk dismissals noted: [FP-xxxxxxxx], [FP-xxxxxxxx]
```

---

## Rules

- NEVER count dismissed findings toward `total_open` — only `Status: Open` findings gate
- NEVER re-implement the bash functions inline — reference this spec and copy verbatim
- ALWAYS run against all three ledgers — a finding in any ledger applies regardless of which files are staged or changed
- If a ledger file is missing, treat it as zero findings for that ledger — do not error
- `accepted-risk` dismissed findings are informational only — they never block either caller
