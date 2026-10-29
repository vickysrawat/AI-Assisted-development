# Finding Ledger Schema
_Spec version: 1.1 · Last changed: 2026-10-28 · Applies to: code-review, security, dynamic-scan · 1.1: Needs-Confirmation section, verified Fixed, verifier gate_

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
Open: N · Needs-confirmation: N · Fixed: N · Dismissed: N · Manual-fix-required: N · Baseline: N

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
- **External APIs**: <names from finding-verify `declared_external`> — only when the fix uses a library API
- **Verified**: <YYYY-MM-DD> (finding-verify) — set when the grounding gate passed this block
- **Fix kind**: dependency-upgrade — security SCA findings only (Vulnerable code = the manifest line; `/fix` shows the upgrade, it does not paste)

---

## Needs-Confirmation Findings

_Defects that hold only under an unconfirmed business intent or an unproven path. They NEVER gate
commits or PRs (gates match `**Status**: Open` only — `findings-gate.md`). The developer's answer
moves each one: confirmed defect → `## Open Findings`; intended behaviour → `/dismiss … by-design`._

### [FP-xxxxxxxx] <TYPE> — <Severity>
- **File**: <file path>
- **Location**: <function, route, or line>
- **Pass**: <1 | 2>
- **First detected**: <YYYY-MM-DD>
- **Status**: needs-confirmation
- **Description**: <one line — the suspected defect>
- **Question**: <the one question whose answer decides it>
- **Vulnerable code** / **Fix**: <as in Open Findings>

---

## Manual-Fix-Required Findings

### <TYPE> — <Severity>
- **File**: <file path>
- **Location**: <function, route, or line>
- **Finding**: <description>
- **Pass**: <1 | 2 | 3>
- **Recommendation**: <what to do>
- **Status**: manual-fix-required
- **Reason**: <config-level | infra-level | requires-design-decision | multi-file | fix-not-verifiable>
- **Former ID**: <FP-xxxxxxxx> — only when an existing finding was reclassified here

---

## Fixed Findings

### [FP-xxxxxxxx] <TYPE> — <Severity>
- **File**: <file path>
- **First detected**: <YYYY-MM-DD>
- **Fixed date**: <YYYY-MM-DD>
- **Fixed by**: [auto-fix via /fix] | [manual — <commit or developer confirmation>] | [code-removed — <commit>]
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

---

## Baseline

_Pre-existing findings recorded on the first Phase D run (**code-review only**, per phase-d-spec.md §4).
Baseline findings NEVER gate commits or PRs. A baseline finding moves to `## Open Findings` only when
its file is touched (boy-scout rule) or via `/code-review --baseline-review`._

### [FP-xxxxxxxx] <CODE> — <Severity>
- **File**: <file path>
- **Symbol**: <symbol>
- **Source**: deterministic (<tool> <version>)
- **Status**: Baseline
```

---

## New field: Pass

The `Pass` field records which pass of the three-pass architecture produced the
finding. This enables:
- Tracking whether a skill's rule-based checks (Pass 1) or expert analysis
  (Pass 2/3) are producing more value
- Filtering findings by analysis type in reports
- Understanding which pass needs tuning if false positive rates differ

Values: `1` (structured rules), `2` (persona pass), `3` (free-flow adversarial),
`pre-scan (IaC)` / `pre-scan (SCA)` (security sub-agent scans).

Every finding — whatever pass produced it — is a `### [FP-…]` block. Table rows are not findings:
the commit gate (`findings-gate.md`) reads blocks only.

---

## Reconciliation rules

When a re-scan runs, reconcile the current scan findings against the existing
ledger:

| Scenario | Rule | Action |
|---|---|---|
| Still Open | Finding in both scan AND ledger (status Open) | Keep Open, update `last-seen` |
| Newly Fixed | Finding in ledger as Open but NOT in scan | Mark Fixed, set `fixed-date` — **only if** the block has a `Verified` date (its snippet was proven verbatim when recorded) AND that code is now gone (`finding-verify.cjs audit-ledger` → `snippet.status` is `NOT_FOUND`/`FILE_MISSING`), or `/fix` applied it. Record what removed it (`Fixed by`). |
| Unverified legacy entry | Open block with no `Verified` field whose snippet is `NOT_FOUND` | NOT Fixed — the snippet may never have been verbatim. Keep Open, add `- **Provenance**: snippet-unverified — re-quote`, and re-quote it from the file on this scan |
| Still present, not re-reported | Finding in ledger as Open, absent from scan, but its vulnerable code is still in the file | Keep Open — the scan missing it is not evidence it is fixed |
| Dead code | Vulnerable code still present but no longer called | NOT Fixed. Keep Open (or Manual-Fix-Required "delete the unused code"); the developer may `/dismiss … wont-fix` with the reason |
| Needs-confirmation answered | Developer answered the `Question` | Confirmed defect → move to Open; intended → `/dismiss … by-design` with the answer as justification |
| New | Finding in scan but NOT in ledger | Add as new Open entry |
| Already Fixed | Finding in ledger as Fixed, absent from scan | Leave unchanged |
| Dismissed | Finding in ledger as Dismissed | Delegate to `dismissed-findings-reconciliation.md` |
| Baseline | Finding in `## Baseline` (code-review Phase D first run) | Never gates; move to Open only on file-touch (boy-scout) or `--baseline-review` |
| Capability-aware | Finding's `Source` names a tool THIS run lacked | Carry forward unchanged — never mark not-re-confirmed (`phase-d-spec.md §5`) |

### Reading the existing ledger

Always read the existing ledger before writing:
```bash
cat {ledger_path} 2>/dev/null || echo "NO_LEDGER_YET"
```

If `NO_LEDGER_YET`, all findings are new — write the full ledger from scratch.

---

## Hard rules

- **Always read before writing.** Reconcile, never overwrite.
- **Nothing enters the ledger unverified.** Every new or carried-forward finding passes through
  `scripts/finding-verify.cjs` first; its verdict picks the section (`fingerprint-spec.md` § What gets a
  fingerprint). Reviewer-subagent output is input to the verifier, never written directly.
- **Needs-confirmation never gates.** Like Baseline, it is excluded from every gate.
- **Never lose fixed or dismissed findings.** They are the audit trail.
- **Pass field is required** on all new findings from spec version 1.0 onward.
- **One ledger per skill.** Skills never write to another skill's ledger.
- **Ledger folders are gitignored.** Reports contain potentially sensitive
  finding details (file paths, code snippets, vulnerability descriptions).
- **Baseline never gates.** `## Baseline` findings are excluded from every gate — checkin and
  pr-create match `Status: Open` only (`findings-gate.md`). Baseline is code-review/Phase D only.
- **Block moves use the shared primitive.** This schema owns the *structure*; move findings between
  sections (Open↔Fixed↔Dismissed, Baseline→Open) via `ledger-block-mutation.md` — never re-implement
  the parse/move/re-count inline.
