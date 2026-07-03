---
description: Pre-commit quality gate — code-review, ICEA compliance, secrets scan, and open security/DAST findings check (Check D). Single pass against staged and modified files. Unified pass/fail result with pre-filled commit command. Check D gates on open Critical/High findings in all ledgers.
argument-hint: (no arguments needed — operates on staged and unstaged modified files)
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `skills/shared/model-routing-spec.md` for the full specification.

---

# /checkin — Pre-commit quality gate

Runs three checks in one pass against your changed files and produces a single
pass/fail verdict. Replaces the manual sequence of code-review + icea-review +
secrets check before every commit.

---

## Step 1 — Identify changed files

```bash
git diff --name-only          # unstaged
git diff --name-only --cached # staged
git symbolic-ref --short HEAD
git log -1 --format="%s" HEAD 2>/dev/null || echo "NO_COMMITS"
```

Extract the ADO item ID from the branch name (pattern: `ADO-[0-9]+`).

If 0 files changed (nothing staged or modified):
```
ℹ No changed files detected.
Stage your changes first: git add <files>
```
And stop.

Report scope immediately:
```
🔍 Checkin scope
  Branch : {branch}
  ADO    : #{ID}  (or: no ADO ID found in branch name)
  Files  : {N staged} staged · {M unstaged} unstaged
```

---

## Step 2 — Load shared context (once, shared across all three checks)

Load these once. Do not reload per check:

```bash
cat .claude/graph/graph-index.md 2>/dev/null
cat .claude/architecture/architecture.md 2>/dev/null | head -40
cat .claude/file-cache.json 2>/dev/null || echo "NO_CACHE"
```

Locate the ICEA file for the current ADO ID:

```bash
ls docs/icea/ADO-{ID}-*.md 2>/dev/null | head -1
```

If found, read it. If not found, note "No ICEA found — ICEA compliance check will be skipped".

---

## Step 3 — Announce scan intent, then Check A: Static analysis

Before reading any staged file, announce:

```
🔍 Checkin scan
  Will read: {N staged + M unstaged} modified files
  Why     : Checking staged changes for code quality defects, ICEA compliance,
            and secrets before commit. Reading only files returned by git diff.
  Token cost: ~{estimate}
Proceeding — type STOP to halt.
```

This is Category A consent. No confirmation needed.

Load `skills/code-review/SKILL.md` and apply its checker categories to the
changed files only. Do not re-read architecture files — use the shared context
loaded in Step 2. Use scope `--changed` for this check regardless of any outer flag.

For each changed file:
- Run applicable checker categories (TAINTED_*, NULL_RETURNS, RESOURCE_LEAK,
  CHECKED_RETURN, concurrency, code quality, MISSING_DECISION_COMMENT)
- Assign severity and fingerprint per code-review skill rules
- Track: count of Critical, High, Medium, Low findings

**Do NOT write a full CodeReviews/ report.** Output findings inline only.

Result:
- ✅ **PASS** — zero Critical or High findings
- ⚠️ **WARN** — Medium or Low findings only
- ❌ **FAIL** — one or more Critical or High findings

---

## Step 4 — Check B: ICEA compliance

Load `skills/icea-review/SKILL.md` checks (Seven Checks section) and apply
them to the diff. Use shared context from Step 2 — do not re-read architecture.

**Tier re-verification** (per `skills/shared/change-tier-spec.md`): if the ICEA
header says `Tier: T1`, verify the actual diff still satisfies T1 bounds
(≤1 file, ≤20 lines, no signature changes, no new dependencies, no T3 trigger).
If the diff has outgrown T1:
```
❌ BLOCKED — change classified T1 but diff exceeds T1 bounds
   ({N} files, {M} lines changed)
   The change grew beyond a micro change. Run /icea-feature to produce a full
   ICEA before committing. Tier re-classification only moves up, never down.
```

If an ICEA was found in Step 2:
- Read the git diff for the changed files: `git diff HEAD -- {files}`
- Check each Acceptance Criterion: is there corresponding code change evidence?
- Flag any AC with no corresponding change as **Missing**
- Flag any changed file with no corresponding AC as **Scope creep**

**Manifest delta** (per `skills/shared/change-manifest-spec.md` §3 — mechanical,
zero model judgment): if the ICEA contains a Change Manifest, compute:
```bash
# actual touched source/test files
git diff --name-status HEAD | awk '{print $2}'
```
matched = predicted ∩ actual · missed = actual − predicted · over = predicted − actual
precision = matched/predicted · recall = matched/actual

Append the result to the ICEA file:
```
Manifest accuracy: {m}/{p} predicted-and-touched · {x} unpredicted ({files}) ·
{o} over-predicted · Precision {P} · Recall {R}
```
For each missed file, write a `[MANIFEST-DEVIATION]` line to memory/MEMORY.md
(Dream harvests these): `[MANIFEST-DEVIATION] ADO-{id}: unpredicted {file} — {one-line reason if evident}`.
Instrumentation mode: the delta NEVER blocks the commit — it measures
predictability, not correctness.

**D-option drift**: if the ICEA has selected D decisions, verify the diff is
consistent with the chosen options (e.g. D1 chose "dedicated query service" —
does the diff show query logic in a controller instead?). Drift without a
recorded amendment → **WARN** with the amendment path stated (icea-decisions-spec §6).

Result:
- ✅ **PASS** — all ACs have evidence, no scope creep
- ⚠️ **WARN** — scope creep detected (extra changes not in ICEA)
- ❌ **FAIL** — one or more ACs missing implementation
- ℹ️ **SKIPPED** — no ICEA file found (note: run /icea-review separately after locating ICEA)

---

## Step 5 — Check C: Secrets and gitignore

Scan changed files for secrets patterns and check for sensitive files staged:

```bash
# Check if any sensitive files are staged
git diff --name-only --cached | grep -E \
  "\.env|settings\.json|\.pem|\.key|\.p12|secrets\." 2>/dev/null

# Check .claude/settings.json is not staged
git diff --name-only --cached | grep -q "settings.json" && echo "STAGED_SETTINGS"

# Quick secrets pattern scan on staged content
git diff --cached | grep -E \
  "(password|passwd|secret|api_key|apikey|token|bearer)\s*[:=]\s*['\"][^'\"]{8,}" \
  -i 2>/dev/null | head -5
```

Result:
- ✅ **PASS** — no sensitive files staged, no secret patterns detected
- ❌ **FAIL** — sensitive file staged or secret pattern found (always blocks commit)

---

## Step 5b — Business context severity review

Before computing the verdict, load `skills/shared/business-context-severity.md` and
apply all B1–B7 override triggers to every finding from Checks A, B, and C.

If any finding touches a B1–B7 trigger → escalate to Critical. State the trigger.
Any business-Critical finding is a ❌ FAIL that blocks the commit.
This check cannot be skipped.

---

## Step 5c — Open security and DAST findings gate

Load `skills/shared/findings-gate.md` and execute the canonical bash functions
defined there verbatim. Do not re-implement the ledger-walking logic inline.

This gate runs regardless of scope — a known open Critical/High finding blocks
the commit even if none of the staged files touch it.

Run against all three ledgers and collect the result structure defined in
`findings-gate.md`:

```bash
# Load canonical functions from findings-gate.md — do not inline
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

Format output using the **`checkin` output block** defined in `findings-gate.md`
(hard gate — blocked unless `--skip-security-gate` is present).

On `--skip-security-gate`: proceed, prepend to the suggested commit message:
```
⚠ Security gate bypassed: {developer-provided justification}
```

If `accepted-risk` dismissed findings exist, include as informational note (non-blocking):
```
ℹ️ Accepted-risk dismissals noted: [FP-xxxxxxxx], [FP-xxxxxxxx]
```

Result:
- ✅ **PASS** — no open Critical/High findings in either security ledger
- ⚠️ **WARN** — open Medium/Low findings only (non-blocking)
- ❌ **FAIL** — one or more open Critical/High findings (blocks commit unless overridden)
- ℹ️ **SKIPPED** — no security ledgers found (run /security-review to establish baseline)

If any `accepted-risk` dismissed Critical/High findings exist, append to the output
(non-blocking, informational only):
```
ℹ️  Accepted-risk dismissals (Critical/High):
    [FP-xxxxxxxx] {VULN-TYPE} — {severity} — dismissed by {user} on {date}
    Reason: {justification}
```

---

## Step 6 — Output the unified verdict

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Checkin — ADO #{ID} · {branch}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  A. Code quality    {✅ PASS | ⚠ WARN (N findings) | ❌ FAIL (N Critical/High)}
  B. ICEA compliance {✅ PASS | ⚠ WARN (scope creep) | ❌ FAIL (N ACs missing) | ℹ SKIPPED}
  C. Secrets         {✅ PASS | ❌ FAIL}
  D. Security gate   {✅ PASS | ⚠ WARN (N medium/low) | ❌ FAIL (N Critical/High open) | ℹ SKIPPED (no ledger)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Overall: {✅ READY TO COMMIT | ⚠ WARNINGS — review before committing | ❌ BLOCKED}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If overall is ✅ READY or ⚠ WARNINGS**, append a pre-filled commit command:

```
Suggested commit:
  git commit -m "[ADO-{ID}] {generated one-line summary of the changes}"

  (Edit the message before running if needed)
```

**If overall is ❌ BLOCKED**, list each blocking issue with its fix:

```
Blocking issues:
  ❌ Check A — {finding}: {file}:{line} — {fix in one line}
  ❌ Check C — {file} must not be committed — add to .gitignore first
```

Do NOT include the commit command when blocked.

---

## Step 7 — Inline findings detail (only for non-passing checks)

After the verdict block, list findings that need attention:

**Check A findings (if WARN or FAIL):**
```
Code quality findings:
  [{severity}] {checker} — {file}:{line}
  → {one-line fix description}
  (Full detail: run /code-review --changed)
```

**Check B findings (if WARN or FAIL):**
```
ICEA compliance:
  Missing: AC #{n} — "{acceptance criterion text}" — no matching change found
  Scope creep: {file} — not referenced in any AC
```

**Check C findings (if FAIL):**
```
Secrets / sensitive files:
  BLOCKED: {file} is staged and contains/is a sensitive pattern
  Fix: git reset HEAD {file} && echo "{file}" >> .gitignore

Data in static directory:
  CRITICAL: public/{file} contains real entity data — never commit data to static dirs
  Fix: git reset HEAD public/{file} && git rm public/{file}
  Note: if this file was in any previous commit, purge git history:
        git filter-repo --path public/{file} --invert-paths
```

---

## Hard Rules

- NEVER write to CodeReviews/ or any report file — checkin is conversation-only output
- NEVER block on WARN — warn and provide the commit command; let the developer decide
- ALWAYS block on: Critical/High code findings, ICEA AC missing, secrets detected, or open Critical/High security ledger findings
- NEVER re-read architecture files if already loaded in Step 2
- Secrets check always runs — it cannot be skipped with any flag
- Security gate always runs — it can only be overridden with `--skip-security-gate` and a written justification
