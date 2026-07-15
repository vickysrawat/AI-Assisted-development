---
description: Dismiss a finding from any ledger as a false positive, won't-fix, accepted risk, or by-design. Takes a fingerprint ID (FP-xxxxxxxx), a reason category, and a required justification. Dismissed findings are suppressed on future scans but re-flagged for review if the code at their location changes.
argument-hint: <FP-xxxxxxxx> <false-positive|wont-fix|accepted-risk|by-design> "<justification>" [--undo]
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

## Persona
Acts with a **[SEC] Security Engineer** lens — a dismissal must be genuinely justified, not
convenient; always asks "are we suppressing a real risk?" Lens only; never assume, never attribute in
output. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

# /dismiss — Dismiss a finding with justification

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

```bash
!node -e "
const fs = require('fs');
const today = new Date().toISOString().slice(0,10);
const sources = {
  'code-review':  'CodeReviews/code-review-ledger.md',
  'security':     'security/security-ledger.md',
  'dynamic-scan': 'dynamic-scan/dynamic-scan-ledger.md'
};
const ledgerPath = sources['{source}'];
const fp         = '{FP}';
const reason     = '{reason}';
const why        = '{justification}';
const dismissedBy = '{dismissed_by}';

let ledger = fs.readFileSync(ledgerPath, 'utf8');

// Ensure ## Dismissed Findings section exists
if (!ledger.includes('## Dismissed Findings')) {
  ledger = ledger.trimEnd() + '\n\n---\n\n## Dismissed Findings\n\n';
  fs.writeFileSync(ledgerPath, ledger, 'utf8');
  ledger = fs.readFileSync(ledgerPath, 'utf8');
}

const openHeader     = '## Open Findings';
const dismissedHeader = '## Dismissed Findings';
const openIdx        = ledger.indexOf(openHeader);
const dismissedIdx   = ledger.indexOf(dismissedHeader);
if (openIdx === -1) { console.error('No Open Findings section'); process.exit(1); }

// Determine end of Open Findings section
const nextSection = ledger.indexOf('\n## ', openIdx + openHeader.length);
const openEnd     = nextSection === -1 ? ledger.length : nextSection;
const openSection = ledger.slice(openIdx, openEnd);

// Extract the FP block
const fpStart = openSection.indexOf('### [' + fp + ']');
if (fpStart === -1) { console.error(fp + ' not found in Open Findings'); process.exit(1); }
const nextBlock = openSection.indexOf('\n### [FP-', fpStart + 1);
const blockEnd  = nextBlock === -1 ? openSection.length : nextBlock;
let block = openSection.slice(fpStart, blockEnd).trimEnd();

// Replace Status: Open with dismissal metadata
block = block.replace(
  /- \*\*Status\*\*: Open/,
  '- **Status**: Dismissed\n' +
  '- **Dismissed date**: ' + today + '\n' +
  '- **Dismissed by**: ' + dismissedBy + '\n' +
  '- **Reason**: ' + reason + '\n' +
  '- **Justification**: ' + why + '\n' +
  '- **Verify flag**: none'
);

// Remove from Open Findings
const newOpenSection = openSection.slice(0, fpStart) +
                       openSection.slice(blockEnd).replace(/^\n+/, '\n');
let updated = ledger.slice(0, openIdx) + newOpenSection + ledger.slice(openEnd);

// Insert after ## Dismissed Findings header
const dIdx     = updated.indexOf(dismissedHeader);
const afterHeader = updated.indexOf('\n', dIdx) + 1;
updated = updated.slice(0, afterHeader) + '\n' + block + '\n' + updated.slice(afterHeader);

// Update Summary counts
updated = updated.replace(/Open:\s*(\d+)/, (m, n) => 'Open: ' + Math.max(0, parseInt(n) - 1));
if (/Dismissed:\s*\d+/.test(updated)) {
  updated = updated.replace(/Dismissed:\s*(\d+)/, (m, n) => 'Dismissed: ' + (parseInt(n) + 1));
} else {
  updated = updated.replace(/(## Summary[\s\S]*?)(---|\n##)/, (m, summary, end) =>
    summary.trimEnd() + '\n- Dismissed: 1\n' + end
  );
}

fs.writeFileSync(ledgerPath, updated, 'utf8');
console.log('Ledger updated: ' + ledgerPath + ' — dismissed ' + fp + '.');
"
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

```bash
!node -e "
const fs = require('fs');
const sources = {
  'code-review':  'CodeReviews/code-review-ledger.md',
  'security':     'security/security-ledger.md',
  'dynamic-scan': 'dynamic-scan/dynamic-scan-ledger.md'
};
const ledgerPath = sources['{source}'];
const fp         = '{FP}';

let ledger = fs.readFileSync(ledgerPath, 'utf8');
const dismissedHeader = '## Dismissed Findings';
const openHeader      = '## Open Findings';
const dIdx = ledger.indexOf(dismissedHeader);
if (dIdx === -1) { console.error('No Dismissed Findings section'); process.exit(1); }

const nextSec = ledger.indexOf('\n## ', dIdx + dismissedHeader.length);
const dEnd    = nextSec === -1 ? ledger.length : nextSec;
const dismissedSection = ledger.slice(dIdx, dEnd);

const fpStart  = dismissedSection.indexOf('### [' + fp + ']');
if (fpStart === -1) { console.error(fp + ' not in Dismissed Findings'); process.exit(1); }
const nextBlock = dismissedSection.indexOf('\n### [FP-', fpStart + 1);
const blockEnd  = nextBlock === -1 ? dismissedSection.length : nextBlock;
let block = dismissedSection.slice(fpStart, blockEnd).trimEnd();

// Strip dismissal fields and restore Status: Open
block = block
  .replace(/\n- \*\*Dismissed date\*\*:.*/, '')
  .replace(/\n- \*\*Dismissed by\*\*:.*/, '')
  .replace(/\n- \*\*Reason\*\*:.*/, '')
  .replace(/\n- \*\*Justification\*\*:.*/, '')
  .replace(/\n- \*\*Verify flag\*\*:.*/, '')
  .replace(/- \*\*Status\*\*: Dismissed/, '- **Status**: Open');

// Remove from Dismissed Findings
const newDismissed = dismissedSection.slice(0, fpStart) +
                     dismissedSection.slice(blockEnd).replace(/^\n+/, '\n');
let updated = ledger.slice(0, dIdx) + newDismissed + ledger.slice(dEnd);

// Append to Open Findings section
const oIdx      = updated.indexOf(openHeader);
const oNext     = updated.indexOf('\n## ', oIdx + openHeader.length);
const openEnd   = oNext === -1 ? updated.length : oNext;
updated = updated.slice(0, openEnd) + '\n\n' + block + '\n' + updated.slice(openEnd);

// Update Summary counts
updated = updated.replace(/Open:\s*(\d+)/, (m, n) => 'Open: ' + (parseInt(n) + 1));
updated = updated.replace(/Dismissed:\s*(\d+)/, (m, n) =>
  'Dismissed: ' + Math.max(0, parseInt(n) - 1));

fs.writeFileSync(ledgerPath, updated, 'utf8');
console.log('Undone: ' + fp + ' moved back to Open Findings in ' + ledgerPath);
"
```

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
