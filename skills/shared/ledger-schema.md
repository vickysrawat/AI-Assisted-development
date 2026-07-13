# Finding Ledger Schema
_Spec version: 1.0 · Last changed: 2026-07-06 · Applies to: code-review, security, dynamic-scan_

Shared by: `code-review`, `security`, `dynamic-scan`

Defines the canonical structure for finding ledgers. Each scan skill maintains
its own ledger file; the schema and reconciliation rules are shared.

---

## File locations

| Skill | Ledger path | Folder |
|---|---|---|
| code-review | `CodeReviews/code-review-ledger.md` | `CodeReviews/` |
| security | `security/security-ledger.md` | `security/` |
| dynamic-scan | `dynamic-scan/dynamic-scan-ledger.md` | `dynamic-scan/` |

Create the folder if it does not exist:
```bash
mkdir -p {folder}
```

Add the folder to `.gitignore` if not already present:
```bash
grep -q "^{folder}" .gitignore 2>/dev/null || echo "{folder}" >> .gitignore
```

---

## Ledger structure

```markdown
# {Skill Name} Ledger
_Last updated: YYYY-MM-DD · Managed by /{skill-command} · Do not edit manually_

## Summary
Open: N · Fixed: N · Dismissed: N · Manual-fix-required: N

---

## Open Findings

### [FP-xxxxxxxx] <TYPE> — <Severity>
- **File**: <file path>
- **Location**: <function, route, or line>
- **Pass**: <1 | 2 | 3>
- **First detected**: <YYYY-MM-DD>
- **Last seen**: <YYYY-MM-DD>
- **Status**: Open
- **Description**: <one line — what the issue is>
- **Severity**: <Critical | High | Medium | Low>
- **CVSS**: <score> (<vector>) — security/dynamic-scan only
- **CWE**: <CWE-ID> — security/dynamic-scan only
- **Checker**: <checker name> — code-review only
- **Vulnerable code**:
  ```
  <vulnerable snippet>
  ```
- **Fix**:
  ```
  <corrected snippet>
  ```
- **Fix explanation**: <one line — what changed and why>

---

## Manual-Fix-Required Findings

### <TYPE> — <Severity>
- **Finding**: <description>
- **Pass**: <1 | 2 | 3>
- **Recommendation**: <what to do>
- **Status**: manual-fix-required
- **Reason**: <config-level | infra-level | requires-design-decision>

---

## Fixed Findings

### [FP-xxxxxxxx] <TYPE> — <Severity>
- **File**: <file path>
- **First detected**: <YYYY-MM-DD>
- **Fixed date**: <YYYY-MM-DD>
- **Fixed by**: [auto-fix via /fix] | [manual]
- **Status**: Fixed

---

## Dismissed Findings

### [FP-xxxxxxxx] <TYPE> — <Severity>
- **File**: <file path>
- **Location**: <function or route>
- **First detected**: <YYYY-MM-DD>
- **Status**: Dismissed
- **Dismissed date**: <YYYY-MM-DD>
- **Dismissed by**: <git user>
- **Reason**: <false-positive | wont-fix | accepted-risk | by-design>
- **Justification**: <free-text explanation>
- **Verify flag**: <none | code-changed>
```

---

## New field: Pass

The `Pass` field records which pass of the three-pass architecture produced the
finding. This enables:
- Tracking whether a skill's rule-based checks (Pass 1) or expert analysis
  (Pass 2/3) are producing more value
- Filtering findings by analysis type in reports
- Understanding which pass needs tuning if false positive rates differ

Values: `1` (structured rules), `2` (persona pass), `3` (free-flow adversarial).

---

## Reconciliation rules

When a re-scan runs, reconcile the current scan findings against the existing
ledger:

| Scenario | Rule | Action |
|---|---|---|
| Still Open | Finding in both scan AND ledger (status Open) | Keep Open, update `last-seen` |
| Newly Fixed | Finding in ledger as Open but NOT in scan | Mark Fixed, set `fixed-date` |
| New | Finding in scan but NOT in ledger | Add as new Open entry |
| Already Fixed | Finding in ledger as Fixed, absent from scan | Leave unchanged |
| Dismissed | Finding in ledger as Dismissed | Delegate to `dismissed-findings-reconciliation.md` |

### Reading the existing ledger

Always read the existing ledger before writing:
```bash
cat {ledger_path} 2>/dev/null || echo "NO_LEDGER_YET"
```

If `NO_LEDGER_YET`, all findings are new — write the full ledger from scratch.

---

## Hard rules

- **Always read before writing.** Reconcile, never overwrite.
- **Never lose fixed or dismissed findings.** They are the audit trail.
- **Pass field is required** on all new findings from spec version 1.0 onward.
- **One ledger per skill.** Skills never write to another skill's ledger.
- **Ledger folders are gitignored.** Reports contain potentially sensitive
  finding details (file paths, code snippets, vulnerability descriptions).
