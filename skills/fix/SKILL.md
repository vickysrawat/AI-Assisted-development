---
name: fix
description: >
  Applies a specific finding fix directly to source. Takes a fingerprint ID, searches the
  code-review / security / dynamic-scan ledgers for the entry, applies the fix with
  str_replace, and marks the finding as Fixed. Invoked by the /fix command.
---

# Fix Skill — Apply a finding fix

_Skill version: 1.0 · Last changed: 2026-08-30 · Plugin compatibility: ≥1.14.0 · Consent: A_

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

> **Related specs:** Consent Category A — reads only the one file named in the finding; announces scope before the str_replace (`skills/shared/source-file-consent.md`). Severity vocabulary per `skills/shared/business-context-severity.md`.

## Persona

Execute as **[SE] Elena Fischer — Senior Software Engineer** (9 yrs across all layers). Optimizes for
applying the ledger's fix correctly and cleanly in the file's actual idioms; always asks "does this
fix truly resolve the finding without breaking the surrounding code?" Expertise = this project's
actual stack per layer.

The persona sets *what to scrutinize* — it never licenses assumption. The ledger entry and the target
source are the only sources of truth; apply the recorded fix, do not redesign it or mark Fixed unless
the change actually applied (subordinate to CLAUDE.md §3 / decision transparency). Never name the
persona in the code or commit. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

Reads a finding from whichever ledger contains the fingerprint ID and applies
its fix directly to the source file. Checks the code-review ledger, the security
ledger, and the dynamic-scan ledger in order. No re-analysis, no re-reading the
full codebase.

---

## Step 1 — Parse arguments

Extract the fingerprint ID from the invocation: pattern `FP-[a-f0-9]{8}`.

If not provided or invalid format:
```
Provide a fingerprint ID from any finding ledger:
  /fix FP-a1b2c3d4

To find fingerprint IDs:
  grep "FP-" CodeReviews/code-review-ledger.md 2>/dev/null
  grep "FP-" security/security-ledger.md 2>/dev/null
  grep "FP-" dynamic-scan/dynamic-scan-ledger.md 2>/dev/null
  Or open the relevant HTML report in a browser.
```

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
And stop.

If none of the ledgers contain the fingerprint ID:
```
⚠ Fingerprint {FP-xxxxxxxx} not found in any ledger.

Search all available fingerprints:
  grep "FP-" CodeReviews/code-review-ledger.md 2>/dev/null
  grep "FP-" security/security-ledger.md 2>/dev/null
  grep "FP-" dynamic-scan/dynamic-scan-ledger.md 2>/dev/null
```
And stop.

If the finding has `manual-fix-required` status:
```
ℹ {FP-xxxxxxxx} is marked manual-fix-required — no automated fix is available.
  Reason: {reason from ledger}
  Recommendation: {recommendation from ledger}
```
And stop.

If the finding is in `## Dismissed Findings`:
```
ℹ {FP-xxxxxxxx} is dismissed — cannot apply a fix to a dismissed finding.
  Dismissed: {dismissed-date}  By: {dismissed-by}
  Reason   : {reason}
  Why      : {justification}

To re-open it first:  /dismiss {FP-xxxxxxxx} --undo
Then apply the fix:   /fix {FP-xxxxxxxx}
```
And stop.

If already marked as Fixed:
```
ℹ {FP-xxxxxxxx} is already marked as Fixed (fixed: {date}).
  Nothing to do. Re-run the relevant scan to verify.
```
And stop.

---

## Step 3 — Display the finding and confirm

Show the finding to the developer before making any change:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Fix: {FP-xxxxxxxx} — {checker} [{severity}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File     : {file}
Function : {function}
Issue    : {one-line description}

Vulnerable code:
{vulnerable code snippet from ledger}

Fix:
{fix code snippet from ledger}

Explanation: {one-line explanation from ledger}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apply this fix? (yes / no / edit)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Wait for explicit `yes`, `no`, or `edit`.

- `no` → abort: "Fix cancelled. Finding remains Open in the ledger."
- `edit` → ask: "Describe the change to the fix approach:"
  Accept the edit, show the updated fix, ask for confirmation again.

---

## Step 4 — Apply the fix

Only after `yes`:

1. Read the current file:
```bash
cat {file}
```

2. Verify the vulnerable code is still present (the file may have changed since the review).
   If not found:
   ```
   ⚠ The vulnerable code pattern is no longer present in {file}.
   The issue may have already been fixed manually.
   Mark as Fixed in the ledger anyway? (yes / no)
   ```

3. Apply the fix using str_replace — replace the vulnerable snippet with the fix snippet.

4. Verify the change looks correct by reading the modified lines back.

---

## Step 5 — Update the ledger

Update the ledger entry in whichever ledger contained the fingerprint (determined in Step 2).
This is not a simple status flip — the ledger has separate `## Open Findings` and
`## Fixed Findings` sections, and the entry must physically move from the former to the
latter. Just changing "Status: Open" to "Status: Fixed" while leaving the entry under
Open Findings creates an inconsistent state that breaks summary counts and the open-findings
gates in checkin and pr-create.

The transformation is:
1. Extract the full block for the matching FP ID from the `## Open Findings` section
2. Append it (with Fixed metadata added) to the `## Fixed Findings` section
3. Remove it from the `## Open Findings` section
4. Update the Summary count at the top: Open count -1, Fixed count +1

Apply the shared `moveBlock` primitive — load `$PLUGIN_DIR/skills/shared/ledger-block-mutation.md`
and run its canonical node script (do NOT re-implement the parse/move/re-count inline). Parameters:

- `ledgerPath`: the ledger for `{source}` — code-review → `CodeReviews/code-review-ledger.md`,
  security → `security/security-ledger.md`, dynamic-scan → `dynamic-scan/dynamic-scan-ledger.md`
- `fp`: `{FP}`
- `fromHeader`: `## Open Findings`  ·  `toHeader`: `## Fixed Findings`  (`ensureTo: true`)
- `statusFrom`: `- \*\*Status\*\*: Open`
- `statusTo`: `- **Fixed date**: {today}` + `- **Fixed by**: [auto-fix via /fix]` +
  `- **What was done**: Applied fix from ledger` + `- **Status**: Fixed`
- `summaryDec`: `Open`  ·  `summaryInc`: `Fixed`

---

## Step 6 — Confirm

```
✅ Fix applied — {FP-xxxxxxxx}

  File    : {file}
  Change  : {one-line description of what was changed}
  Ledger  : {source ledger} — marked Fixed as of {today}

Next steps:
  1. Run the test for this area to verify the fix
  2. Run /checkin before committing
```

---

## Hard Rules

- NEVER apply a fix without displaying it and getting explicit `yes`
- NEVER modify the fix code without the developer asking — apply it exactly as written
  in the ledger (or as edited by the developer in Step 3)
- NEVER mark as Fixed if the str_replace failed — the source did not change
- NEVER run a full code-review — read only the one file in Step 4
