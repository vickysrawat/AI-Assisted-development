---
name: dismiss
description: >
  Dismiss a finding from any ledger as a false positive, won't-fix, accepted risk, or
  by-design. Takes a fingerprint ID, a reason category, and a required justification.
  Invoked by the /dismiss command.
---

# Dismiss Skill — Dismiss a finding with justification

_Skill version: 1.0 · Last changed: 2026-08-30 · Plugin compatibility: ≥1.14.0 · Consent: C_

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

> **Related specs:** Consent Category C — reads/writes finding ledgers only, never application source (`skills/shared/source-file-consent.md`). Severity vocabulary per `skills/shared/business-context-severity.md`.

## Persona
Acts with a **[SEC] Security Engineer** lens — a dismissal must be genuinely justified, not
convenient; always asks "are we suppressing a real risk?" Lens only; never assume, never attribute in
output. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

Searches all three ledgers for a fingerprint ID and moves the finding to the
`## Dismissed Findings` section with a reason category and a required free-text
justification. Future scans will not re-open a dismissed finding unless the code
at that location changes.

---

## Step 1 — Parse arguments

### Undo path

If the invocation includes `--undo`:
- Extract the fingerprint ID (pattern `FP-[a-f0-9]{8}`) — if missing or invalid,
  show the usage block below and stop.
- Skip to **Step 6 — Undo**.

### Normal dismiss path

Extract three required arguments:

1. **Fingerprint ID** — pattern `FP-[a-f0-9]{8}`
2. **Reason category** — one of: `false-positive` · `wont-fix` · `accepted-risk` · `by-design`
3. **Justification** — free-text string in double quotes; must be non-empty

If any argument is missing or invalid:

```
Usage:
  /dismiss FP-a1b2c3d4 false-positive "Reachability guard at line 40 means user input never reaches this sink"
  /dismiss FP-a1b2c3d4 wont-fix       "This is test-only scaffolding, never deployed to production"
  /dismiss FP-a1b2c3d4 accepted-risk  "Business requirement; mitigated by WAF rule WAF-2024-017"
  /dismiss FP-a1b2c3d4 by-design      "Intentional reflection for plugin loader — sandboxed execution context"
  /dismiss FP-a1b2c3d4 --undo         (move back to Open for re-triage)

Reason categories:
  false-positive  — the tool flagged code that is not actually vulnerable
  wont-fix        — real finding, but fixing it is not planned (e.g. test code)
  accepted-risk   — real finding, risk formally accepted (business or operational reason)
  by-design       — behaviour is intentional and the finding is expected

A justification is required — /dismiss refuses empty reasons.
To see all fingerprint IDs:
  grep "FP-" CodeReviews/code-review-ledger.md 2>/dev/null
  grep "FP-" security/security-ledger.md 2>/dev/null
  grep "FP-" dynamic-scan/dynamic-scan-ledger.md 2>/dev/null
```

Stop after showing the usage block.

---

## Step 2 — Locate the ledger entry

Search all three ledgers in order. Stop at the first match.

```bash
cat CodeReviews/code-review-ledger.md 2>/dev/null || echo "NO_CR_LEDGER"
cat security/security-ledger.md 2>/dev/null || echo "NO_SEC_LEDGER"
cat dynamic-scan/dynamic-scan-ledger.md 2>/dev/null || echo "NO_DS_LEDGER"
```

**Source determination:**
- Found in `CodeReviews/code-review-ledger.md` → source is **code-review**
- Found in `security/security-ledger.md` → source is **security**
- Found in `dynamic-scan/dynamic-scan-ledger.md` → source is **dynamic-scan**

If all three ledgers are missing:
```
⚠ No ledgers found. Run /code-review, /security-review, or /dynamic-scan first to generate findings.
```
Stop.

If the fingerprint is not in any ledger:
```
⚠ Fingerprint {FP-xxxxxxxx} not found in any ledger.

Search all available fingerprints:
  grep "FP-" CodeReviews/code-review-ledger.md 2>/dev/null
  grep "FP-" security/security-ledger.md 2>/dev/null
  grep "FP-" dynamic-scan/dynamic-scan-ledger.md 2>/dev/null
```
Stop.

If the finding is already in `## Dismissed Findings`:
```
ℹ {FP-xxxxxxxx} is already dismissed.
  Dismissed: {dismissed-date}  By: {dismissed-by}
  Reason   : {reason}
  Why      : {justification}

To re-open it for triage:
  /dismiss {FP-xxxxxxxx} --undo
```
Stop.

If the finding is in `## Fixed Findings`:
```
ℹ {FP-xxxxxxxx} is already marked Fixed — cannot dismiss a Fixed finding.
  If the fix is wrong and this is actually a false positive, re-run the relevant
  scan to re-open it, then dismiss it.
```
Stop.

---

## Step 2b — RBAC check for Critical and High severity

Read the severity from the finding block located in Step 2. If severity is **Critical** or **High**, run the RBAC check before displaying the finding:

```bash
PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
[ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/rbac-check.cjs" --action DISMISS_HIGH_SEVERITY
```

Read the JSON output:
- `allowed: false` → show the block message and stop:
  ```
  ⛔ BLOCKED — {result.message}

  Dismissing Critical/High findings requires a Security Officer.
  Ask one of the authorised approvers to run this command in their session:
    /dismiss {FP} {reason} "{justification}"

  To escalate or discuss:
    Annotate the finding in the ledger and raise in your next security review.
  ```
  Then write the RBAC_BLOCK audit event (best-effort):
  ```bash
  node "$PLUGIN_DIR/scripts/audit-write.cjs" --event RBAC_BLOCK --finding-id "${FP}" --verdict "blocked" --context "DISMISS_HIGH_SEVERITY: insufficient role" 2>/dev/null || true
  ```
  Stop — do not proceed to Step 3.

- `allowed: true` (or `reason: opt-out-mode`) → proceed to Step 3.

For **Medium and Low** severity findings, skip this check entirely — any developer may dismiss.

---

## Step 3 — Display the finding and confirm

Show the finding before making any change:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 Dismiss: {FP-xxxxxxxx} — {checker or vuln type} [{severity}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File     : {file}
Function : {function or location}
Issue    : {one-line description from ledger}
Reason   : {reason category}
Why      : {justification text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If the finding block contains a prior dismissal note** (i.e. it was previously
dismissed, re-opened by the reconciliation logic with `verify-flag: code-changed`,
and is now being dismissed again), surface a warning before the confirmation prompt:

```
⚠️  This finding was previously dismissed and re-opened because the code changed.
   Prior dismissal: {prior-dismissed-date} by {prior-dismissed-by}
   Prior reason   : {prior-reason} — "{prior-justification}"
   The code at this location has changed since that dismissal.
   Ensure your new justification accounts for the code change.
```

**For `accepted-risk` on Critical or High severity**, add this warning before the
confirmation prompt:

```
⚠️  This is a Critical/High finding. Accepted-risk dismissals are visible in
   the PR description and checkin output so reviewers can make an informed decision.
```

Prompt:
```
Dismiss this finding? (yes / no)
```

Wait for explicit `yes` or `no`.

- `no` → abort: "Dismissal cancelled. Finding remains Open in the ledger."

---

## Step 4 — Capture dismissal metadata

Before writing, resolve:

```bash
dismissed_by=$(git config user.name 2>/dev/null || git config user.email 2>/dev/null || echo "unknown")
dismissed_date=$(date +%Y-%m-%d)
```

Capture the `file` and `function` fields from the finding block — these are used
by the verify-on-change logic in future scans.

---

## Step 5 — Update the ledger

Move the finding block from `## Open Findings` to `## Dismissed Findings`.
Ensure a `## Dismissed Findings` section exists in the ledger (append it after
`## Fixed Findings` if absent). Add the dismissal fields to the block, update
the Summary line.

Apply the shared `moveBlock` primitive — load `$PLUGIN_DIR/skills/shared/ledger-block-mutation.md`
and run its canonical node script (do NOT re-implement the parse/move/re-count inline). Parameters:

- `ledgerPath`: the ledger for `{source}` — code-review → `CodeReviews/code-review-ledger.md`,
  security → `security/security-ledger.md`, dynamic-scan → `dynamic-scan/dynamic-scan-ledger.md`
- `fp`: `{FP}`
- `fromHeader`: `## Open Findings`  ·  `toHeader`: `## Dismissed Findings`  (`ensureTo: true`)
- `statusFrom`: `- \*\*Status\*\*: Open`
- `statusTo`: `- **Status**: Dismissed` followed by the dismissal fields — Dismissed date `{today}`,
  Dismissed by `{dismissed_by}`, Reason `{reason}`, Justification `{justification}`, Verify flag `none`
- `summaryDec`: `Open`  ·  `summaryInc`: `Dismissed`

After the ledger update completes, write the governance audit event (best-effort — never blocks):

```bash
AUDIT_MODEL=$(node -e "try{const e=(JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')).env||{});console.log(e.REVIEW_MODEL||'claude-sonnet-4-6');}catch(_){console.log('claude-sonnet-4-6');}" 2>/dev/null || echo "claude-sonnet-4-6")
node "$PLUGIN_DIR/scripts/audit-write.cjs" \
  --event DISMISS \
  --finding-id "${FP}" \
  --model "$AUDIT_MODEL" \
  --verdict "${REASON}" \
  --context "${JUSTIFICATION}" 2>/dev/null || true
```

---

## Step 6 — Undo

Activated when `--undo` is in the invocation.

Locate the fingerprint in `## Dismissed Findings` of each ledger. If not found there:

```
ℹ {FP-xxxxxxxx} is not in Dismissed Findings — nothing to undo.
  (It may already be Open, Fixed, or not present in any ledger.)
```
Stop.

Move the block back to `## Open Findings`, stripping the five dismissal fields
(`Dismissed date`, `Dismissed by`, `Reason`, `Justification`, `Verify flag`),
restoring `Status: Open`, and updating the Summary counts (Dismissed -1, Open +1).

Apply the shared `moveBlock` primitive (`$PLUGIN_DIR/skills/shared/ledger-block-mutation.md`) in
reverse — do NOT re-implement inline. Parameters:

- `ledgerPath`: the ledger containing `{FP}`  ·  `fp`: `{FP}`
- `fromHeader`: `## Dismissed Findings`  ·  `toHeader`: `## Open Findings`
- `statusFrom`: `- \*\*Status\*\*: Dismissed`  ·  `statusTo`: `- **Status**: Open`
- `stripFields`: `Dismissed date`, `Dismissed by`, `Reason`, `Justification`, `Verify flag`
- `summaryDec`: `Dismissed`  ·  `summaryInc`: `Open`

Confirm:
```
↩ Undone — {FP-xxxxxxxx} moved back to Open Findings
  Ledger : {source ledger}
  Next   : Re-triage with /fix FP-xxxxxxxx or dismiss again with a revised reason.
```

---

## Step 7 — Confirm (normal dismiss path)

```
✅ Dismissed — {FP-xxxxxxxx}

  Reason  : {reason category}
  Why     : {justification}
  By      : {dismissed_by}  on  {dismissed_date}
  Ledger  : {source ledger}

This finding will not be re-reported on future scans unless the code at its
location changes, in which case it will be re-opened with a verify flag.

To undo:  /dismiss {FP-xxxxxxxx} --undo
```

If the reason is `accepted-risk` and severity is Critical or High, append:
```
⚠️  Accepted risk recorded. This dismissal will appear in:
   - PR descriptions (so reviewers are informed)
   - Checkin output (non-blocking, but visible)
```

---

## Hard Rules

- NEVER dismiss a finding without displaying it and getting explicit `yes`
- NEVER dismiss with an empty justification — the whole point is an auditable why
- NEVER dismiss a finding already in Fixed Findings
- NEVER silently dismiss a Critical or High `accepted-risk` finding — always surface the warning
- NEVER re-open a dismissed finding just because it appears in a new scan, UNLESS the
  code at the file+function location changed since the dismissal date (verify-flag logic
  is enforced by the scan commands, not by /dismiss itself)
