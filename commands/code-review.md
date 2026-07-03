---
description: Run a Coverity-style code review with persistent tracking. Detects new defects, marks previously-found defects as fixed (with who/when/what from git), and writes HTML + Markdown reports plus a running ledger into the CodeReviews/ folder.
argument-hint: [--changed | --pr | --full | --ci | path]
---

# /code-review

Read `skills/code-review/SKILL.md` and execute it completely from Step 0 to the end.

---

## Step 0 — Resolve and lock scope flag

Parse the invocation arguments:

| User typed | Action |
|---|---|
| `--full` | SCOPE_FLAG = `--full` — skip cache, scan all files |
| `--ci` | SCOPE_FLAG = `--ci` — skip cache, warn if cache file found on disk |
| `--changed` | SCOPE_FLAG = `--changed` — git staged/unstaged files only |
| `--pr` | SCOPE_FLAG = `--pr` — branch diff vs base only |
| `--area backend` | SCOPE_FLAG = `--area backend` — .NET/C# files only |
| `--area frontend` | SCOPE_FLAG = `--area frontend` — TypeScript/HTML files only |
| `--area config` | SCOPE_FLAG = `--area config` — config/IaC/env files only |
| `--area <Name>` | SCOPE_FLAG = `--area <Name>` — knowledge-graph module files only |
| `--continue` | SCOPE_FLAG = `--continue` — resume from checkpoint |
| a file/folder path | SCOPE_FLAG = (default), restrict candidate list to that path |
| (nothing) | SCOPE_FLAG = (default) — cache-aware full scan with budget cap |

> ⚠ If SCOPE_FLAG is `--full` or `--ci`:
> The cache must NOT be consulted. Every file from the `find` command is scanned.
> No file is skipped. This overrides everything else.

Announce before proceeding:
```
📂 Code Review — scope: {SCOPE_FLAG or "default (cache-aware)"}
```

---

## Step 1 — Announce scan intent before reading any file

Before the skill reads a single source file, output this announcement:

```
🔍 Code Review — source file scan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Mode    : {SCOPE_FLAG or "default (cache-aware)"}
  Will read: {N} files ({M} skipped by cache)
  Why     : Coverity-style static analysis — checking for data flow defects,
            null safety, resource leaks, concurrency issues, and code quality
            findings. Results written to CodeReviews/ with persistent tracking.
  Token cost: ~{estimated tokens based on file count and average size}

Proceeding with scan. Type STOP at any time to halt.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

This is a Category A consent (implicit — developer invoked the command).
No confirmation prompt is needed. The announcement makes the scan transparent.

## Step 2 — Execute the code-review skill in full

Read `skills/code-review/SKILL.md` and follow every step exactly.

When you reach **Step 0b** in the skill, use SCOPE_FLAG from above.
When you reach **Step 0c** in the skill, run `find .` from the project root — not `src/`.
When you reach **Step 0d** in the skill:
- If SCOPE_FLAG is `--full` or `--ci` → skip the cache entirely, scan all files
- Otherwise → apply cache and scope logic as the skill defines

All output goes into a `CodeReviews/` folder in the project root:

```
CodeReviews/
├── code-review-ledger.md        ← running ledger across ALL runs (source of truth)
├── code-review-<date>.html      ← point-in-time HTML report for this run
└── code-review-<date>.md        ← point-in-time Markdown report for this run
```

**Write the files first. Output only the confirmation summary to the conversation.**

Detect languages and load the appropriate reference file:
- C# / ASP.NET / WCF / EF -> load `references/checkers-dotnet.md`
- TypeScript / Angular / Node.js -> load `references/checkers-typescript.md`
- Mixed -> load both

---

### Step 2 — Read the existing ledger

Check whether `CodeReviews/code-review-ledger.md` already exists:

```
!cat CodeReviews/code-review-ledger.md 2>/dev/null || echo "NO_LEDGER_YET"
```

If it exists, parse all previous findings and their status (Open / Fixed),
their fingerprint IDs, and their first-detected dates. You will reconcile
against these in Step 4.

If it returns `NO_LEDGER_YET`, this is the first run — every finding will be New.

---

### Step 3 — Run the analysis

#### Step 3a — Phase D: deterministic layer first

Delegate to `skills/shared/phase-d-spec.md` (spec v1.0). In brief:

1. Read the capability profile from `.claude/settings.local.json` → `phaseD`.
   If absent, run the architect-time probe now (Step 4a2 of the architect skill)
   and write it. Per-run verify: re-check only the claimed tool versions (~1s);
   self-heal the profile on mismatch.
2. **C# (build-warnings mode):** run the project's own build and capture the
   analyzer warning stream — match stable codes only (`CA\d+`, `SCS\d+`, `SA\d+`),
   never message text. Fingerprint: `code|file|symbol`.
3. **JS (eslint mode):** run the project-local eslint with the project's config;
   fingerprint: `rule-id|file|symbol`.
4. **web.config / app.config:** apply `references/webconfig-checks.md` (build-free,
   always available).
5. **Baseline rule (mandatory):** if the ledger has no `## Baseline` section,
   this is the FIRST Phase D run — write ALL findings to `## Baseline` (they
   never gate) and tell the developer:
   ```
   📊 Phase D baseline established: {N} pre-existing findings recorded.
      These do NOT gate commits. New findings and findings in files you touch
      will gate from now on. Review the baseline with /code-review --baseline-review.
   ```
   On subsequent runs: only findings new vs baseline, or baseline findings in
   touched files, enter `## Open Findings`.
6. Mark every Phase D finding `Source: deterministic ({tool} {version})`.
   Stacks with no available tool → `probabilistic-fallback`, recorded in the
   scope report's coverage block.

#### Step 3b — Phase P: probabilistic layer (judgment tier)

Receives Phase D's findings as a compact list. **Do not re-report what Phase D
found** — scope is: ICEA/AC traceability, cross-file logic reasoning, B1–B7
business-context severity escalation, intent-vs-implementation mismatches, and
security reasoning beyond pattern matching. The model may ANNOTATE a Phase D
finding (severity escalation, probable-FP note) but NEVER deletes or suppresses
one — suppression is /dismiss with a human justification.

Apply all checker categories from the code-review skill (TAINTED_*, NULL_RETURNS,
RESOURCE_LEAK, CHECKED_RETURN, control flow, UNINIT, concurrency, code quality).

For each current finding capture:
- checker name, impact, file, function
- event path (2-4 events with role labels)
- vulnerable code snippet
- fix snippet (copy-paste ready) with a one-line explanation
- `Source: probabilistic` (Phase P findings) — the Source field is mandatory on every entry

**Assign a stable fingerprint** to each finding so it can be matched across runs
even when line numbers change:

```
fingerprint = "FP-" + first 8 chars of a hash of: checker + "|" + file + "|" + function + "|" + short_defect_description
```

Compute the fingerprint with Node.js so it is deterministic:
```
!node -e "console.log('FP-' + require('crypto').createHash('sha1').update(process.argv[1]).digest('hex').slice(0,8))" "TAINTED_SQL|UserRepository.cs|Find()|user input concatenated into SQL"
```

**Collision check** — after computing each fingerprint, verify it does not already
exist in the ledger with different content (different checker, file, or description).
If a collision is detected, append a counter suffix to make it unique:
`FP-a1b2c3d4` → `FP-a1b2c3d4b` (append 'b', then 'c', etc.).
Collisions are rare but silent when undetected — always check.

---

### Step 4 — Reconcile against the ledger

Build the reconciled finding set:

1. **Still Open** — finding in BOTH current analysis AND ledger (status was Open):
   keep Open, update "last seen" to today, keep original "first detected" date.

2. **Newly Fixed** — finding in ledger as Open but NOT in current analysis:
   **Capability guard first** (per `skills/shared/phase-d-spec.md` §5): if the
   finding's `Source` names a deterministic tool that THIS run did not possess
   (check the current machine's capability profile), the absence proves nothing —
   carry the finding forward UNCHANGED, do not touch `last-seen`, do not mark
   Fixed. A finding may only transition based on absence when the run possessed
   the producing capability.
   Otherwise mark as **Fixed**. Determine who/when/what from git:
   ```
   !git log -1 --format="%an|%ad|%s" --date=short -- "<file>" 2>/dev/null || echo "unknown|unknown|no git history"
   ```
   Record: fixed date (commit date), fixed by (author), what was done (commit subject).
   If the file has multiple recent commits since first-detected, use:
   ```
   !git log --since="<first_detected_date>" --format="%an|%ad|%s" --date=short -- "<file>" 2>/dev/null
   ```
   and attribute to the most recent relevant commit.

3. **New** — finding in current analysis but NOT in ledger:
   add as **Open**, first detected = today, status New.

4. **Already Fixed** — finding in ledger already marked Fixed and still absent:
   keep as Fixed (do not re-open, do not re-attribute).
   If a previously-Fixed finding REAPPEARS in current analysis: mark as **Regression**,
   note the regression date, and set status back to Open.

5. **Dismissed** — delegate entirely to `skills/shared/dismissed-findings-reconciliation.md`
   (spec v1.0). Do not implement inline logic. The shared spec defines: keep dismissed
   if file unchanged since `dismissed-date`; set `verify-flag: code-changed` and re-open
   as Open (preserving original dismissal metadata as a note) if the file has commits
   since `dismissed-date`. Never count dismissed findings toward open totals.

---

### Step 5 — Create the CodeReviews folder

```
!mkdir -p CodeReviews
```

---

### Step 6 — Write the updated ledger

Write `CodeReviews/code-review-ledger.md` using Node.js. Structure:

```markdown
# Code Review Ledger

Auto-generated tracking file. Records every finding across all review runs.
Last updated: <date>

## Summary
- Open: N
- Fixed: N
- Regressions: N
- Dismissed: N
- Total tracked: N

---

## Open Findings

### [FP-xxxxxxxx] <CHECKER> — <Impact>
- **File**: <file>
- **Function**: <function>
- **First detected**: <date>
- **Last seen**: <date>
- **Status**: Open
- **Description**: <one line>

(repeat per open finding)

---

## Fixed Findings

### [FP-xxxxxxxx] <CHECKER> — <Impact>
- **File**: <file>
- **Function**: <function>
- **First detected**: <date>
- **Fixed date**: <commit date>
- **Fixed by**: <git author>
- **What was done**: <git commit subject>
- **Status**: Fixed

(repeat per fixed finding)

---

## Regressions

### [FP-xxxxxxxx] <CHECKER> — <Impact>
- **File**: <file>
- **Originally fixed**: <date> by <author>
- **Reappeared**: <date>
- **Status**: Open (regression)

(repeat per regression)

---

## Dismissed Findings

### [FP-xxxxxxxx] <CHECKER> — <Impact>
- **File**: <file>
- **Function**: <function>
- **First detected**: <date>
- **Status**: Dismissed
- **Dismissed date**: <date>
- **Dismissed by**: <git user>
- **Reason**: <false-positive | wont-fix | accepted-risk | by-design>
- **Justification**: <free-text explanation>
- **Verify flag**: <none | code-changed>

(repeat per dismissed finding)

---

## Baseline

_Pre-existing findings recorded on first Phase D run ({date}). These NEVER gate
commits or PRs. A baseline finding moves to Open Findings only when its file is
touched (boy-scout rule) or via /code-review --baseline-review. See
skills/shared/phase-d-spec.md §4._

### [FP-xxxxxxxx] <CODE> — <Impact>
- **File**: <file>
- **Symbol**: <symbol>
- **Source**: deterministic (<tool> <version>)
- **Status**: Baseline

(repeat per baseline finding)
```

Note: every entry in every section carries a `- **Source**:` line —
`deterministic (<tool> <version>)`, `probabilistic`, or `probabilistic-fallback`.

Write it with the Node.js file-write pattern:
```
!node -e "
const fs = require('fs');
const content = String.raw\`REPLACE_WITH_LEDGER_MARKDOWN\`;
fs.writeFileSync('CodeReviews/code-review-ledger.md', content, 'utf8');
console.log('Ledger updated');
"
```

---

### Step 7 — Write the point-in-time HTML report

Generate a complete self-contained HTML report for THIS run with:

1. **Header** — project name, review date, totals, defect density
2. **Run Delta banner** — "N new · N fixed since last run · N still open · N regressions"
3. **Health Bar** — Green / Amber / Red based on open Critical+High
4. **Summary Table** — sortable: Fingerprint | Checker | Impact | File:Line | Function | Status
   Status badges: New (blue), Open (grey), Fixed (green), Regression (red)
5. **Finding Detail Cards** — collapsible per finding:
   - fingerprint + checker + impact badge + status badge
   - file, function, first-detected date
   - event path (numbered, role-labelled)
   - **Vulnerable Code** block (red left border)
   - **Fix** block (green left border) + one-line explanation
   - for Fixed findings: a "Resolved" panel showing fixed date, fixed by, what was done
   - references (CWE/OWASP)
6. **Checker Breakdown** — pure-CSS bar chart
7. **Recommendations** — top 5 open fixes by impact

HTML requirements:
- Self-contained, inline CSS + vanilla JS only, no CDN
- Works on file:// protocol
- Impact colors: Critical=`#E24B4A` High=`#EF9F27` Medium=`#F5C842` Low=`#1D9E75`
- Status colors: New=`#3B82F6` Open=`#6B7280` Fixed=`#1D9E75` Regression=`#DC2626`
- Vulnerable code: red left border. Fix code: green left border.
- Collapsible cards, sortable table, `@media print`

Write with:
```
!node -e "
const fs = require('fs');
const date = new Date().toISOString().slice(0,10);
const html = String.raw\`REPLACE_WITH_FULL_HTML\`;
fs.writeFileSync('CodeReviews/code-review-' + date + '.html', html, 'utf8');
console.log('HTML report written');
"
```

---

### Step 8 — Write the point-in-time Markdown report

Write a Markdown version of this run's findings to
`CodeReviews/code-review-<date>.md` — same content as the HTML but in Markdown
(summary table + finding details with vulnerable/fix code blocks + run delta).

```
!node -e "
const fs = require('fs');
const date = new Date().toISOString().slice(0,10);
const md = String.raw\`REPLACE_WITH_REPORT_MARKDOWN\`;
fs.writeFileSync('CodeReviews/code-review-' + date + '.md', md, 'utf8');
console.log('Markdown report written');
"
```

---

### Step 9 — Confirm

Output this to the conversation:

```
Code review complete. Files written to CodeReviews/:
  - code-review-ledger.md     (running tracker)
  - code-review-<date>.html   (this run)
  - code-review-<date>.md      (this run)

Since last run:
  New:         N
  Fixed:       N
  Regressions: N
  Still open:  N

Current open defects:
  Critical: N    High: N    Medium: N    Low: N

Newly fixed this run:
  [FP-xxxxxxxx] <CHECKER> in <file> — fixed by <author> on <date>
  ...

Top open defects:
  [FP-xxxxxxxx] <CHECKER> | <file:line> — <description>
  ...
```
