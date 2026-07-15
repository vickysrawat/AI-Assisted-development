# Dismissed Findings Reconciliation — Shared Spec
_Spec version: 1.0 · Last changed: 2026-06-10 · Governed by: skills/shared/_

This spec defines the canonical rules for how scan skills handle dismissed findings
during ledger reconciliation. Any skill that writes a finding ledger and reconciles
on re-scan **must** delegate to this spec rather than implementing its own logic.

**Callers:** `code-review`, `security`, `dynamic-scan`

---

## The reconciliation rule

When a re-scan finds a finding that already exists in `## Dismissed Findings` of the
ledger, the skill **must** apply the following logic:

### Rule 5 — Dismissed finding reappears in current scan

```
IF finding fingerprint is in ## Dismissed Findings:
  Check whether the source file has been modified since the dismissal date:

  git log --since="{dismissed-date}" --oneline -- "{file}"

  IF no commits returned (file unchanged since dismissal):
    → Keep Dismissed
    → Update "last-seen" date silently
    → Do NOT re-report as New
    → Do NOT re-open as Open

  IF commits returned (file has changed since dismissal):
    → Set verify-flag: code-changed on the dismissed entry
    → Re-open as Open
    → Preserve the original dismissal reason, justification, dismissed-by, and dismissed-date as a note
    → Add note: "Previously dismissed on {dismissed-date} by {dismissed-by} ({reason}: {justification}) — re-opened because the file changed; re-review required."
    → Report as New in the scan output with the above note visible
```

**Rationale:** A dismissal is a statement about specific code at a specific location.
If the code changes, the justification may no longer hold. The developer must
re-evaluate — but the audit trail of the original decision is preserved.

---

## Ledger section structure

Every ledger that implements this spec must include a `## Dismissed Findings` section
after `## Fixed Findings`. The section header must be present even if empty.

### Dismissed finding block format

```markdown
### [FP-xxxxxxxx] <VULN-TYPE or CHECKER> — <Severity>
- **File**: <file>
- **Location**: <function or line>
- **First detected**: <date>
- **Last seen**: <date>
- **Status**: Dismissed
- **Dismissed date**: <YYYY-MM-DD>
- **Dismissed by**: <git user name or email>
- **Reason**: <false-positive | wont-fix | accepted-risk | by-design>
- **Justification**: <free-text — the auditable why>
- **Verify flag**: none | code-changed
```

### Reason categories

| Category | Meaning |
|---|---|
| `false-positive` | The tool flagged code that is not actually vulnerable or defective |
| `wont-fix` | Real finding, but fixing it is not planned (e.g. test code, deprecated path) |
| `accepted-risk` | Real finding, risk formally accepted for a documented business or operational reason |
| `by-design` | The behavior is intentional and the finding is expected |

A justification is **required** for all categories. An empty justification must be
refused by the `/dismiss` command.

---

## Summary line format

The ledger `## Summary` line must include the dismissed count:

```
Open: N · Fixed: N · Dismissed: N · Manual-fix-required: N
```

---

## Interaction with downstream gates

Dismissed findings are **excluded** from open finding counts in all downstream gates:

- `findings-gate.md` — dismissed findings are never counted toward `total_open`
- `checkin` — dismissed findings do not block commits
- `pr-create` — dismissed findings do not block PR creation
- `setup-status` — dismissed count is reported separately (informational)

**Exception — accepted-risk:** Dismissed findings with `Reason: accepted-risk` on
Critical or High severity are surfaced as **informational** (non-blocking) in:
- The `checkin` output
- The `pr-create` PR description body
- The `pr-create` draft artifact

This ensures reviewers are never unaware that a known risk was accepted. See
`skills/shared/findings-gate.md` for the `get_accepted_risk_dismissed()` function
that extracts these.

---

## Reference from a skill

Skills reference this spec in their `## Reference Files` table and in the
reconciliation step. Use the following inline reference block:

```markdown
**Dismissed finding reconciliation** — delegate to `$PLUGIN_DIR/skills/shared/dismissed-findings-reconciliation.md`.
Rule 5 (dismissed finding reappears in scan): keep dismissed and update last-seen if
the file is unchanged; re-open as Open with a verify-flag note if the file has changed
since the dismissal date.
```

---

## Hard rules

- **NEVER** re-open a dismissed finding solely because it appears in a new scan
- **ALWAYS** check `git log --since="{dismissed-date}" -- "{file}"` before deciding
- **NEVER** suppress the verify-flag re-open silently — the developer must see the note
- **NEVER** count a dismissed finding toward open totals, regardless of severity
- **ALWAYS** preserve the original dismissal metadata when re-opening with a verify flag
