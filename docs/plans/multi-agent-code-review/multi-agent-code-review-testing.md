# Multi-Agent Code Review — Testing Strategy

**Status:** Testing spec — aligned with implementation plan after 6 critic rounds  
**Prerequisite:** Architecture spec (`multi-agent-code-review-with-graph.md`) approved  
**Date:** 2026-07-17

---

## Overview

Why this document exists:
- The multi-agent system has two categories of code: (1) deterministic logic inline in `code-review.workflow.js` (dedup, schema, ledger merge, skip-logic), (2) LLM-driven agents (module agent, tracer, personas, adversarial)
- These require fundamentally different testing approaches
- Neither structural validation alone, nor evals alone, provide sufficient coverage

**Implementation note:** The plugin has no npm/Jest setup — it is pure Markdown + Node.js CJS scripts
with no build step. The `shared/` directory contains Markdown specification docs, NOT runtime JS modules.
All deterministic logic is inline in `skills/code-review/runners/workflow/code-review.workflow.js`.
Unit tests run as plain Node.js scripts; the primary gate is `node tests/validate.js` (259 checks, offline).

What this document covers:
- Layer 1: Structural + unit tests for deterministic logic in the workflow script
- Layer 2: Integration tests with fixture-based LLM calls
- Layer 3: Evaluation framework (recall, precision, calibration)
- Layer 4: A/B test methodology for model/prompt changes
- CI integration and scheduling
- Tooling and framework choices

---

## Layer 1 — Structural + Unit Tests

**Framework:** Plain Node.js scripts (no Jest — plugin has no npm/build step)  
**Primary gate:** `node tests/validate.js` (259 structural checks, offline, no API key)  
**Secondary:** `bash scripts/validate-bash.sh` (bash-only fallback)  
**Syntax check:** `node --check skills/code-review/runners/workflow/code-review.workflow.js`  
**Run:** Every commit, target < 30s total  
**Files:** `skills/code-review/test/unit/*.js` (plain Node.js assert scripts)

### 1.1 dedup.test.js

```
fingerprint()
  ✅ same file + function + line + checker → identical hash
  ✅ different file, same everything else → different hash
  ✅ different checker, same location → different hash
  ✅ hash is stable across Node.js restarts (SHA1, not Math.random())

mergeRuleA() — Pass 1 agent merge (same finding, different callers)
  ✅ callers[] → union of both lists, deduplicated
  ✅ confidence → keeps HIGHEST (0.95 vs 0.30 → 0.95)
  ✅ severity → keeps HIGHEST (High vs Medium → High)
  ✅ evidence same → no dedup-candidate tag
  ✅ evidence differs → tags "dedup-candidate", keeps both evidence versions
  ✅ does NOT modify confidence downward (merge never reduces)

mergeRuleB() — RETIRED (verify it is dead code)
  ✅ mergeRuleB is defined in the workflow script
  ✅ mergeRuleB is NEVER called anywhere in the orchestration body
  (mergeRuleB assumed suspects were pre-populated in allFindings[] — they are not)

deduplicateBySinkLocation() — Secondary dedup by (file:line:checker)
  ✅ two findings with same file:line:checker but different fingerprints → merged
  ✅ Pass 1 finding (_source not 'tracer') + tracer finding (_source:'tracer') at same location
     → Pass 1 fingerprint wins as anchor (sink-side, stable)
  ✅ two tracer findings at same location → higher confidence wins as anchor
  ✅ confidence → Math.max(ex.confidence, f.confidence) regardless of anchor
  ✅ callers[] → union of both lists
  ✅ dataFlow → anchor's dataFlow used if it has steps[]; otherwise falls back to other's
  ✅ finding with no file or line=0 → passed through unchanged (Candidate entries)

detectDedupCollision()
  ✅ same fingerprint, different evidence snippets → returns collision object with both
  ✅ same fingerprint, same evidence → no collision
  ✅ different fingerprint → no collision (not same finding)
```

### 1.2 report.test.js

```
updateLedger() — all 5 merge rules:

Rule 1 — New finding (fingerprint not in ledger)
  ✅ appended with status: "active", firstSeen = today, passHistory[0] set

Rule 2 — Existing finding (fingerprint matches, no status change)
  ✅ lastSeen updated, passHistory entry appended
  ✅ severity unchanged → no developer alert emitted
  ✅ severity changed → "severity-changed" alert in output

Rule 3 — Finding NOT in this run's output
  Case A: finding.moduleId NOT IN modulesScanScope
    ✅ status unchanged, no regression alert (out-of-scope — infrastructure, not code)
  Case B: finding.moduleId IN modulesScanScope
    ✅ status stays "active"
    ✅ "regression-risk" alert emitted with finding fingerprint

Rule 4 — Finding with status "fixed" found again
  ✅ status → "active"
  ✅ "regression" alert emitted

Rule 5 — Finding with status "false-positive" found again
  ✅ status stays "false-positive"
  ✅ "re-seen-fp" alert emitted
  ✅ does NOT auto-escalate to "active"

Confidence routing:
  ✅ confidence ≥ 0.50 → routed to confirmed sections (Critical/High/Medium)
  ✅ confidence < 0.50 → routed to Candidates section only
  ✅ confidence exactly 0.50 → confirmed (boundary test)

Coverage table:
  ✅ scanned modules listed with finding count
  ✅ failed modules listed with "null result" note (module agents do NOT retry — null = coverage gap)
  ✅ deferred suspects show count + "--continue" message
  ✅ only confirmed findings (confidence ≥ 0.50) appear in ledger; Candidates (< 0.50) in-report only
```

### 1.3 schema.test.js

```
Valid finding (all required fields, types correct) → passes validation
Missing "fingerprint" field → fails with field name in error
Missing "checker" field → fails
confidence = 1.1 (out of range) → fails
confidence = 0.0 → passes (boundary)
severity not in enum ["Critical","High","Medium","Low"] → fails
dataFlow present but steps[] empty → fails (cross-module finding must have steps)
dataFlow absent on intra-module finding → passes (optional for intra-module)
personaReviewStatus has invalid value → fails
```

### 1.4 skip-logic.test.js — Pass 3 Truth Table

All 7 conditions, full combinatorial coverage:

```
Condition matrix (skipPass3 starts true):

C1: mode=full AND securityCriticalList.isEmpty() → skipPass3=false (unconfigured: run conservatively)
C2: scopedModules contains a security-critical module → skipPass3=false
C3: graph neighbour of scoped module is security-critical → skipPass3=false
C4: mode=pr AND ICEA contains security keywords → skipPass3=false
C5: mode=pr AND no ICEA found → skipPass3=false (conservative)
C6: mode=pr AND changedModulesNotInGraph → skipPass3=false (conservative)
C7: forcePass3 flag set → skipPass3=false (always honoured)

Explicit test cases:
  full scan, tagged critical modules → runs (C2)
  full scan, no tags → runs (C1 guard)
  pr scan, touches auth module → runs (C2)
  pr scan, neighbour of auth module → runs (C3)
  pr scan, ICEA has "authentication" → runs (C4)
  pr scan, no ICEA file → runs (C5)
  pr scan, changed file not in graph → runs (C6)
  pr scan, clean ICEA, no security contact → SKIPS (the meaningful case)
  any mode, --force-pass3 → runs (C7)

ADO ID extraction:
  "feature/ADO-1847-user-search" → "1847"
  "feature/ADO-1847" → "1847"
  "ADO-1847-xyz" → "1847"
  "main" → null (no ADO ID)
  "ADO-#1847" → "1847" (hash prefix variant)

Security keyword extraction from ICEA text:
  Text contains "authentication" → true
  Text contains "JWT token" → true
  Text contains "user profile update" (no keywords) → false
  Text is empty → false
```

---

## Layer 2 — Integration Tests

**Framework:** Jest with real LLM calls (Haiku for speed)  
**Run:** Nightly, target < 10 min total  
**Environment:** Requires `ANTHROPIC_API_KEY`  
**Files:** `skills/code-review/test/integration/*.test.js`

### 2.1 Fixture Files

```
skills/code-review/test/fixtures/

UserController.cs
  // Known vulnerability: MISSING_AUTH_CHECK at line 42
  // Planted: public IActionResult GetUserDetails(int userId) { ... }
  //          no [Authorize] attribute, no role check

UserService.cs
  // Known vulnerability: TAINTED_SQL at line 88
  // Planted: var query = $"SELECT * FROM Users WHERE name={name}";

UserRepository.cs
  // Known vulnerability: RESOURCE_LEAK at line 15
  // Planted: var conn = new SqlConnection(cs); conn.Open(); /* no using */

PaymentService.cs
  // Known vulnerability: HARDCODED_SECRET at line 7
  // Planted: private const string _apiKey = "sk-live-abc123xyz";

Clean.cs
  // No vulnerabilities — used for precision testing (should produce 0 findings)

graph-index-fixture.md
  // 3 modules: UserController, UserService, UserRepository
  // Edge: UserController → UserService → UserRepository

architecture-fixture.md
  // Minimal: untrusted inputs = HTTP query params
  // Security-critical-modules: UserController.cs
```

### 2.2 Test Cases

**pass1-agent.test.js**

```
Single module — UserService.cs with graph + arch fixture
Assert:
  ✅ findings[] contains at least 1 entry with checker: "TAINTED_SQL"
  ✅ finding.file === "UserService.cs"
  ✅ finding.line is within ±5 of line 88
  ✅ finding.confidence is a number between 0 and 1
  ✅ finding.fingerprint matches pattern "FP-[a-f0-9]+"
  ✅ findings[] schema validates (all required fields present)
Do NOT assert:
  ✗ exact description text (varies per run)
  ✗ exact evidence snippet (varies)

Single module — Clean.cs
Assert:
  ✅ findings[] is empty (precision — no false positive on clean code)
```

**tracer-agent.test.js**

```
Input: suspected_taint from UserController → UserService → UserRepository
Provide: full source of all 3 files
Assert:
  ✅ output.action === "upgrade" OR output.action === "ruled-out"
  ✅ output.fingerprint matches the input suspect's fingerprint
  ✅ if action=upgrade: output.confidence is between 0.70 and 1.0
  ✅ if action=upgrade: output.dataFlow.steps[] has ≥ 2 entries
  ✅ if action=ruled-out: no new finding created
```

**full-run.test.js**

```
3-module synthetic run: UserController + UserService + UserRepository
Assert:
  ✅ At least 3 findings total (one per planted vulnerability)
  ✅ MISSING_AUTH_CHECK found in UserController.cs
  ✅ TAINTED_SQL found in UserService.cs
  ✅ Each finding has confidence ≥ 0.50 OR is routed to Candidates
  ✅ Ledger is written to CodeReviews/code-review-ledger.md (Markdown, not JSON)
  ✅ partial.html exists and is non-empty after Phase 2 (.code-review/partial.html)
  ✅ Full schema validation on all findings in output
```

---

## Layer 3 — Evaluation Framework (Evals)

**Purpose:** Measure LLM quality (recall, precision, calibration) systematically  
**Run:** Weekly via cron + manually on any prompt/model change  
**Files:** `skills/code-review/test/evals/` (runner + dataset + results)

### 3.1 Ground Truth Dataset Format

```json
// skills/code-review/test/evals/dataset/entry-001.json
{
  "id": "eval-001",
  "description": "SQL injection via string concatenation in search endpoint",
  "checker": "TAINTED_SQL",
  "file": "UserService.cs",
  "function": "SearchByName",
  "line": 88,
  "severity": "High",
  "truePositive": true,
  "sourceCode": "... [full file contents] ...",
  "graphContext": "... [module detail file] ..."
}
```

**Minimum dataset:** 10 entries covering all 12 MVP checkers  
**Target:** 25 entries for stable metrics

**Checker coverage map:**

| Checker | Entries | Notes |
|---|---|---|
| TAINTED_SQL | 2 | string concat + format string |
| TAINTED_HTML | 1 | XSS via template |
| TAINTED_CMD | 1 | shell injection |
| PATH_TRAVERSAL | 1 | directory traversal |
| CSRF | 1 | state-changing op |
| HARDCODED_SECRET | 1 | API key in source |
| NULL_DEREF | 1 | null dereference |
| RESOURCE_LEAK | 1 | connection not closed |
| UNVALIDATED_REDIRECT | 1 | open redirect |
| MISSING_AUTH_CHECK | 1 | no auth guard |
| OVERLY_PERMISSIVE_CORS | 1 | CORS allow * |
| SENSITIVE_DATA_LOG | 1 | PII in logs |
| Clean code | 2 | precision baseline (0 findings) |

### 3.2 Metrics

```
Recall    = TP / (TP + FN)
           where TP = known vulnerability found by agent
                 FN = known vulnerability NOT found

Precision = TP / (TP + FP)
           where FP = finding flagged by agent that is NOT a real vulnerability
                      (graded by LLM judge)

F1        = 2 * (Precision * Recall) / (Precision + Recall)

Calibration: for each confidence bucket (0.90-1.0, 0.80-0.90, etc.)
  Measured accuracy = TP in bucket / total findings in bucket
  Should approximate the confidence midpoint (0.95 bucket → ~95% should be TP)
  Tolerance: ±15%

Cross-run stability:
  Run same eval dataset twice (separate API calls)
  Finding count per entry varies < 15% between runs
  (measures prompt stability, not recall)
```

### 3.3 LLM-as-Judge Grading

For each finding that is NOT in the ground truth (potential FP):

```
Judge prompt:
  "The following code finding was reported by a code review agent.
   Evaluate whether it is a genuine vulnerability or a false positive.
   
   Finding: {checker}, file: {file}, line: {line}
   Evidence: {evidence}
   Source code: {source}
   
   Respond with:
   { 'verdict': 'true-positive' | 'false-positive', 'confidence': 0.0-1.0, 'reason': '...' }"

Judge model: Claude Sonnet (stronger reasoning than Haiku)
Threshold: finding marked FP if judge.verdict === 'false-positive' AND judge.confidence ≥ 0.80
Human spot-check: 10% of judge verdicts reviewed by a human per eval run
```

### 3.4 Eval Output Format

```json
// .code-review/eval-results/eval-2026-07-16.json
{
  "date": "2026-07-16",
  "model": "claude-haiku-4-5",
  "promptVersion": "v1.2",
  "dataset": { "total": 25, "positives": 23, "negatives": 2 },
  "recall": 0.83,
  "precision": 0.79,
  "f1": 0.81,
  "calibration": {
    "0.90-1.00": { "measured": 0.92, "expected": 0.95, "pass": true },
    "0.80-0.90": { "measured": 0.74, "expected": 0.85, "pass": false }
  },
  "stability": { "runA": 42, "runB": 40, "delta": "4.8%", "pass": true },
  "byChecker": {
    "TAINTED_SQL": { "recall": 1.0, "precision": 1.0 },
    "CSRF": { "recall": 0.5, "precision": 1.0 }
  },
  "falseNegatives": ["eval-008 (CSRF missed)", "..."],
  "falsePositives": ["..."]
}
```

---

## Layer 4 — A/B Tests

**Purpose:** Validate that prompt/model changes improve quality before merging  
**Run:** Manually, triggered by changes to prompt builder functions in the workflow script, checker lists, or model routing  
**Framework:** Node.js script that runs eval twice with different configs and compares

### 4.1 Test Matrix

| Comparison | Metric to watch | Decision threshold |
|---|---|---|
| Haiku vs Sonnet (Pass 1) | Recall + cost/min | Sonnet wins recall by >5% → switch |
| Graph context on vs off | Cross-module recall | Off loses >10% → keep on |
| ICEA context on vs off (Pass 3) | Skip accuracy | Off causes false skip → keep on |
| buildPass1Prompt v1 vs v2 | Recall by checker | v2 wins ≥ 3/12 checkers → adopt |
| 12-checker list vs description | Overall recall | Winner by >5% on eval dataset → use |
| contentHash cache-buster on vs off | Stale result rate on --continue | On prevents stale hits → keep |

### 4.2 How to Run

```bash
# Run eval with config A (current)
CODE_REVIEW_MODEL=haiku node test/evals/eval-runner.js --config=current > eval-A.json

# Run eval with config B (candidate)
CODE_REVIEW_MODEL=sonnet node test/evals/eval-runner.js --config=candidate > eval-B.json

# Compare
node test/evals/compare.js eval-A.json eval-B.json
```

**Minimum runs:** 3 per configuration (reduces noise from LLM non-determinism)  
**Compare:** Average recall/precision across 3 runs, not single-run results

### 4.3 Decision Criteria

```
Adopt new config if:
  Average recall improves by > 5% AND precision doesn't drop by > 5%
  OR
  Average precision improves by > 5% AND recall doesn't drop by > 5%
  AND
  Cost/speed stays within ±20% of current baseline (for model changes)

Roll back if:
  Recall drops by > 5%
  OR
  Precision drops by > 10%
  (False positive rate increase is more harmful than false negative — finding rot)
```

---

## CI Integration

**Scheduling:**

| Event | Tests run | Target time |
|---|---|---|
| Every commit to feature branch | Layer 1 (unit) | < 30s |
| Every PR | Layer 1 + Layer 2 (integration) | < 10 min |
| Nightly | Layer 1 + Layer 2 | < 10 min |
| Weekly (Sunday 2am) | Layer 3 (evals) | < 30 min |
| Manual (on prompt change) | Layer 3 + Layer 4 (A/B) | < 1 hour |

**GitHub Actions stub:**

```yaml
# .github/workflows/code-review-tests.yml
on:
  push:
    paths: ['skills/code-review/**']
  schedule:
    - cron: '0 2 * * 0'   # weekly evals

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node tests/validate.js                          # 259 structural checks, no API key
      - run: node --check skills/code-review/runners/workflow/code-review.workflow.js
      - run: bash scripts/validate-bash.sh                  # bash fallback gate

  integration:
    if: github.event_name == 'pull_request' || github.event_name == 'schedule'
    needs: unit
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - run: node tests/runner.js --skill code-review        # fixture-based LLM integration tests

  evals:
    if: github.event_name == 'schedule'
    needs: integration
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - run: cd skills/code-review/test/evals && bash run-eval.sh
      - uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: .code-review/eval-results/
```

---

## Tooling

| Component | Tool | Notes |
|---|---|---|
| Structural gate | `node tests/validate.js` | 259 checks, offline, no API key — primary gate |
| Bash fallback gate | `bash scripts/validate-bash.sh` | Checks runner file exists, SKILL.md metadata, scenario YAML presence |
| Syntax check | `node --check <workflow.js>` | Catches JS syntax errors before any LLM call |
| Integration tests | `node tests/runner.js` | Live LLM calls, fixture-based, requires ANTHROPIC_API_KEY |
| Eval runner | Node.js script | `eval-runner.js`, uses Anthropic SDK, outputs JSON to `.code-review/eval-results/` |
| LLM judge | Claude Sonnet | Always Sonnet regardless of Pass 1 model under test |
| A/B compare | Node.js script | `compare.js`, reads two eval JSON files, outputs diff table to stdout |

---

## Verification Checklist

Before declaring testing infrastructure complete:

- [ ] `node tests/validate.js` passes (259+ checks) — primary structural gate
- [ ] `node --check skills/code-review/runners/workflow/code-review.workflow.js` — no syntax errors
- [ ] `bash scripts/validate-bash.sh` passes — bash fallback gate
- [ ] Unit tests exist for inline workflow logic: `dedup`, `deduplicateBySinkLocation`, `updateLedger`, `shouldSkipPass3`
- [ ] `mergeRuleB` is present in workflow script AND verified never called in orchestration body
- [ ] `deduplicateBySinkLocation` tested: Pass 1 anchor wins on tracer collision; confidence uses Math.max
- [ ] Pass 3 skip truth table covered (all 7 conditions, including `changed` mode treated as pr-like)
- [ ] Fixture files exist at `skills/code-review/test/fixtures/` with `// FINDING: <CHECKER>` markers at declared line ±2
- [ ] Fixture line validation added to `tests/validate.js` (fixtureExpectations block)
- [ ] Eval dataset exists with ≥ 10 ground truth samples covering all 12 MVP checkers
- [ ] LLM-as-judge prompt defined in full
- [ ] Eval runner outputs JSON with recall + precision + calibration + byChecker metrics
- [ ] A/B test baseline recorded for Haiku vs Sonnet on Pass 1 recall
- [ ] CI YAML uses `node tests/validate.js` (not npm test — no Jest/npm in plugin)
- [ ] Tooling: plain Node.js for all tests; Sonnet for LLM judge; no Jest dependency
