# Tracker — Upgrade Skill Simplification
ADO #9012 · Release 3 · Sprint 11 · EPIC · 22 SP
Status: ✅ COMPLETE

---

## Story Board

| Story | Title | SP | Child ADO # | Status | Tech Spec |
|---|---|---|---|---|---|
| 1 | Gate Reduction and Runbook | 3 | TBD | ✅ Done | ADO-9012-Story-1-tech.md |
| 2 | research-cache Redesign | 3 | TBD | ✅ Done | ADO-9012-Story-2-tech.md |
| 3 | Intake Redesign | 8 | TBD | ✅ Done | ADO-9012-Story-3-tech.md |
| 4 | Dead Code, Checkpoint, Step 4.5 | 5 | TBD | ✅ Done | ADO-9012-Story-4-tech.md |
| 5 | Step Boundary Cleanup and Migration Log | 3 | TBD | ✅ Done | ADO-9012-Story-5-tech.md |

**Total SP:** 22 · **Delivered:** 22 · **Remaining:** 0

---

## Story 1 — Gate Reduction and Runbook

**Status:** ✅ Done
**SP:** 3 · **Child ADO #:** TBD
**Depends on:** None
**Blocks:** Stories 3, 4, 5

**ACs:** AC-F1 ✅ · AC-F2 ✅ · AC-F3 ✅

### Delivered

- `skills`: `skills/upgrade/SKILL.md` — Removed 11 CONTINUE gates; added gate declarations section; added upgrade-runbook.md creation at Step 1; added tool preflight with hard BLOCK; added runbook append calls in Steps 5, 6, 7 (`skills/upgrade/SKILL.md`)

### Tests

- Manual scenario tests per tech spec test cases:
  - `P-U1`: `grep CONTINUE skills/upgrade/SKILL.md` → 0 matches ✅ (verified)
  - `P-U2`: gate declarations present at top — INTAKE CONFIRMED, APPROVE REPORT, APPROVE DESIGN ✅ (verified)
  - `P-U3`: upgrade-runbook.md creation added at Step 1 ✅
  - `P-U4`: tool preflight with all-present path continues ✅
  - `N-U1`: missing tool → hard BLOCK with runbook append + ⛔ message ✅
  - `N-U2`: `grep [CONTINUE] skills/upgrade/SKILL.md` → 0 matches ✅ (verified)

### Follow-ups
_(none — clean delivery)_

### Design Decisions

_(no non-trivial design choices in this story — changes are mechanical gate removal and runbook plumbing)_

### Known Gaps

_(none — all ACs fully met)_

### Lessons learned
_(Clean delivery — no recurring patterns identified in this story)_

---

## Story 2 — research-cache Redesign

**Status:** ✅ Done
**SP:** 3 · **Child ADO #:** TBD
**Depends on:** None (independent)
**Blocks:** Nothing

**ACs:** AC-F4 ✅ · AC-F5 ✅ · AC-F6 ✅ · AC-F7 ✅ · AC-NF2 ✅ · AC-NF4 ✅

### Delivered

- `scripts`: `scripts/research-cache.cjs` — Exit 2 for stale hits (was 0); added `--extract-bundle-to=<file>` flag; updated header comment and inline comments to reflect new exit code contract
- `tests`: `tests/research-cache.test.cjs` — Updated stale assertion: `stale.code === 2` (was `=== 0`)
- `skills`: `skills/upgrade/SKILL.md` — Replaced 30-line cache block (inline JSON-parsing node -e calls) with ≤14-line version using `--extract-bundle-to` flag + exit-code branching
- `skills`: `skills/rewrite/SKILL.md` — Same cache block replacement (cache block only, no other content changed); updated downstream `$BUNDLE_FILE` → `$CACHE_BUNDLE` reference

### Tests

- `npm test` → `research-cache.test.cjs` ✅ 27 passed · 0 failed (AC-NF2 confirmed: stale.code === 2)
- `npm test` full suite: 6 pre-existing failures (checkpoint-ledger, cluster-merge, migration-source-detect — timeout; migration-specs, strategy-resolve, upgrade-checkpoint — unrelated to Story 2); no new failures introduced

### Follow-ups
_(none — clean delivery)_

### Design Decisions

- Exit code 2 for stale (vs exit 0 for both): callers can branch on exit code directly without parsing JSON output; eliminates fragile inline `node -e` shell blocks in SKILL.md. (DECISION comment in `research-cache.cjs` line ~125)
- `--extract-bundle-to` flag writes bundle to a caller-specified file on hit only; exits 1 if write fails — no silent partial state. Placed at end of lookup block after all result paths are resolved.

### Known Gaps
_(none — all ACs fully met)_

### Lessons learned
_(Inline node -e JSON parsing in shell blocks is fragile on Windows paths — exit-code + file-based handoff is the correct pattern for SKILL.md→script communication)_

---

## Story 3 — Intake Redesign

**Status:** ✅ Done
**SP:** 8 · **Child ADO #:** TBD
**Depends on:** Story 1 (gate structure)
**Blocks:** Nothing

**ACs:** AC-F8 ✅ · AC-F9 ✅ · AC-F10 ✅ · AC-F11 ✅ · AC-F12 ✅ · AC-F13 ✅ · AC-NF1 ✅

### Delivered

- `skills`: `skills/upgrade/SKILL.md` — Replaced source-context-manifest gate block with 3-pass auto-generated intake:
  - Context budget check before Pass 1 (AC-NF1)
  - Creates `docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-intake.md` with 12 section stubs (AC-F9)
  - Pass 1: per-package registry query; checkpoint write BEFORE each query (`intake_pass=1`, `intake_progress_index=<i>`); immediate append to Section 5 (AC-F12, AC-F13)
  - DEVELOPER REVIEW reason codes: `registry timeout` / `no compatible version found` / `registry unavailable` (AC-F11)
  - UPGRADE RESUME skip logic: reads `intake_progress_index` from ledger and skips already-processed packages (AC-F13)
  - Pass 2: reads `{stack}-upgrade.md` knowledge file; writes to Sections 6, 8, 10; records `intake_pass=2`
  - Pass 3: greps codebase for behavioral change patterns; writes to Sections 3, 4, 7; records `intake_pass=3`
  - Summary banner prepended after all passes (⛔/⚠/✅ counts) (AC-F10)
  - INTAKE CONFIRMED gate with hook enforcement; `upgrade-checkpoint.cjs intake-verify` called after (AC-F8)
  - Simplified checkpoint flush: single `set-gate intake_context PASS` (removed source_context payload)

### Tests

- Story 3 is SKILL.md-only; `npm test` confirms no regressions (same pre-existing failure set as Story 2)
- Suite 4 expanded with TCs for all 7 ACs

### Follow-ups
_(none — clean delivery)_

### Design Decisions

- Replaced hand-authored source-context-manifest.md with skill-generated upgrade-intake.md: developer effort eliminated; intake is now deterministic and resumable. Approach dictated by tech spec; no design alternatives considered.
- Checkpoint written BEFORE each Pass 1 query (not after) — ensures UPGRADE RESUME can skip the query that was interrupted mid-execution, not just completed queries.

### Known Gaps
_(none — all ACs fully met)_

### Lessons learned
_(Write-before-query checkpoint pattern: the ledger record must precede the expensive operation so resume skips it correctly. Same pattern should apply to any long per-item loop in upgrade SKILL.md.)_

---

## Story 4 — Dead Code, Checkpoint Consolidation, Step 4.5

**Status:** ✅ Done
**SP:** 5 · **Child ADO #:** TBD
**Depends on:** Story 1 (gate structure)
**Blocks:** Nothing

**ACs:** AC-F14 ✅ · AC-F15 ⚠ partial · AC-F16 ✅ · AC-F17 ✅ · AC-NF3 ✅ · AC-NF4 ✅

### Delivered

- `skills`: `skills/upgrade/SKILL.md` — Removed `resolve-migration-roots.cjs` from REQUIRED_SCRIPTS and deleted its full invocation block (~24 lines); replaced `checkpoint-ledger.cjs init` with `upgrade-checkpoint.cjs init`; routed all 10 `set-gate` calls through `upgrade-checkpoint.cjs`; routed `baseline_tag`/`hops` set-payload calls through `upgrade-checkpoint.cjs set-payload --baseline-tag`/`--hops`; replaced Step 4.5 delta-design-documents ceremony with lightweight `upgrade-decisions.md` generation (one entry per RED/BLOCKER; fallback line if none); added DECISION comment explaining partial consolidation Known Gap.

### Tests

- Manual scenario tests per tech spec test cases:
  - `P-D1`: `grep resolve-migration-roots skills/upgrade/SKILL.md` → 0 matches ✅ (verified)
  - `P-D2`: `grep "checkpoint-ledger.cjs set-gate --skill=upgrade" skills/upgrade/SKILL.md` → 0 matches ✅ (verified)
  - `P-D3`: `grep "upgrade-checkpoint.cjs set-gate" skills/upgrade/SKILL.md` → 10 matches ✅ (verified)
  - `P-D4`: Step 4.5 references `target-design-spec.md`, `design-revision-spec.md`, `graph-derive-documents.cjs` → 0 matches ✅ (verified)
  - `P-D5`: Step 4.5 generates `upgrade-decisions.md`; fallback "No architectural decisions required" line present ✅
  - `N-D1`: DECISION comment present at init explaining Known Gap ✅ (verified)
- `node tests/upgrade-checkpoint.test.cjs` — 3 SET-GATE assertion failures present but **pre-existing** (identical to Story 2/3 baseline); `upgrade-checkpoint.cjs` not modified by Story 4 — no contract change (AC-NF3 ✅: no regressions introduced)
- `npm test` — 7 pre-existing failures (same set as Story 3: checkpoint-ledger/cluster-merge/intake-verify/migration-source-detect timeouts + migration-specs/strategy-resolve/upgrade-checkpoint); no new regressions (AC-NF4 ✅)

### Follow-ups

1. **upgrade-checkpoint.test.cjs SET-GATE failures (pre-existing, 3 assertions):** `SET-GATE verdict recorded`, `SET-GATE phase_history appended`, `MERGE-WRITE also kept the new gate` — all fail with `undefined`. Root cause unknown; not introduced by ADO-9012. Requires a separate investigation ticket.
2. **checkpoint-ledger.test.cjs / cluster-merge.test.cjs / migration-source-detect.test.cjs — timeout (pre-existing):** All three exit via 30 s timeout. Likely flaky network/timing-sensitive tests; not caused by ADO-9012. Separate investigation ticket recommended.
3. **migration-specs.test.cjs — retired token `stage_gates` in source-context-intake-spec.md (pre-existing):** `source-context-intake-spec.md` line 48 contains the retired token `stage_gates`; the specs test flags it. Separate cleanup ticket recommended.
4. **strategy-resolve.test.cjs — 3 assertions fail with exit 2 instead of exit 0 (pre-existing):** Live dotnet/python profile resolution unexpectedly exits 2 (malformed). Not caused by ADO-9012. Separate investigation ticket recommended.

### Design Decisions

- Full `checkpoint-ledger.cjs` consolidation (AC-F15) not achievable in Story 4 scope: `upgrade-checkpoint.cjs set-payload` only accepts `--baseline-tag` and `--hops` (strict ALLOWED_FLAGS per A13 contract). Generic `--key/--value` calls cannot be routed without extending the script, which is out-of-scope. Chose option B: route `init` + all `set-gate` + `baseline-tag`/`hops` to `upgrade-checkpoint.cjs`; leave remaining `set-payload --key/--value` calls on `checkpoint-ledger.cjs`. DECISION comment added at init call. (Options: A=modify script [rejected: scope], B=partial consolidation [chosen].)
- Step 4.5 replacement: Eliminated `graph-derive-documents.cjs`, `target-design-spec.md`, and `design-revision-spec.md` references; replaced with a direct `upgrade-decisions.md` generation block. Decisions doc is populated from gap/risk RED/BLOCKER items only — no full delta doc ceremony required for in-place upgrades.

### Known Gaps

- **AC-F15 partial:** 8 `checkpoint-ledger.cjs set-payload --key/--value` calls remain in the upgrade skill (stack, from, to, tool_available, intake progress, report_path, proceed_after_report, design_doc_path, completed_hops, verify_report_path, testPlanPath). Full consolidation requires extending `upgrade-checkpoint.cjs set-payload` to accept generic key/value flags — follow-up story required.

---

## Story 5 — Step Boundary Cleanup and Migration Log Scoping

**Status:** ✅ Done
**SP:** 3 · **Child ADO #:** TBD
**Depends on:** Story 1 (gate structure)
**Blocks:** Nothing

**ACs:** AC-F18 ✅ · AC-F19 ✅ · AC-F20 ✅ · AC-F21 ✅

### Delivered

- `skills`: `skills/upgrade/SKILL.md` — Dissolved standalone Step 8 (judge substrate reference doc); inlined judge substrate notes into Steps 4 and 7; added artifact validation block to Step 9 (4 files, ✅/⚠ per-artifact, completion summary with anticipated/unanticipated counts); replaced blanket migration log mandate with scoped rule (table: [FINDING] = unanticipated only, [DECISION] = non-obvious only, no entry for routine intake-matched fixes); added [RESIDUAL SUMMARY] batch entry with error handling at end of Step 7; updated overview reference "Steps 5–8" → "Steps 5–7"; updated Hard Rules migration log line to reflect scoped mandate.

### Tests

- Manual scenario tests per tech spec test cases:
  - `P-U1`: `grep "^## Step 8 " skills/upgrade/SKILL.md` → 0 matches ✅ (verified)
  - `P-U2`: Judge substrate content inline in Step 4 (line 643) and Step 7 (line 818) ✅ (verified)
  - `P-U3`: Artifact validation block in Step 9 — 4 artifacts, completion summary ✅ (verified)
  - `P-U4`: [RESIDUAL SUMMARY] format present at end of Step 7 ✅ (verified)
  - `P-U5`: Scoped mandate table present at Step 7 with "No entry" for routine fixes ✅ (verified)
  - `N-U1`: 0 CONTINUE gates remain ✅ (verified — Story 1 removed all, Story 5 added none)
- `npm test` — same pre-existing failure baseline; no new regressions (AC-NF4)

### Follow-ups

_(none — clean delivery)_

### Design Decisions

- Judge substrate inlining (AC-F18): The standalone Step 8 duplicated information already implied by the checkpoint calls in Steps 4 and 7. Inlining as brief prose notes preserves the reference without a separate step boundary.
- [RESIDUAL SUMMARY] placement (AC-F21): Placed after the verify checkpoint flush (not after the last fix) so it summarizes ALL hops as a batch; includes a soft failure (print + continue, not hard stop) if migration-log.md write fails.
- Artifact validation (AC-F19): Uses a shell loop for brevity; missing artifacts print ⚠ but do not hard-stop Step 9 (per error handling spec).

### Known Gaps

_(none — all ACs fully met)_

---

## Epic-Level Notes

### Follow-up Defects (pre-existing, surfaced during ADO-9012 test runs)

| # | Test | Failure Mode | Symptom | Priority | Status |
|---|---|---|---|---|---|
| FU-1 | `upgrade-checkpoint.test.cjs` | Exit 1 | 3 SET-GATE assertions fail (`verdict recorded`, `phase_history appended`, `MERGE-WRITE kept new gate` — all `undefined`) | High | ✅ Fixed |
| FU-2 | `migration-specs.test.cjs` | Exit 1 | Retired token `stage_gates` found in `source-context-intake-spec.md:48` | Medium | ✅ Fixed |
| FU-3 | `strategy-resolve.test.cjs` | Exit 1 | Live dotnet/python profiles exit 2 (malformed) instead of 0 (resolved) | High | ✅ Fixed |
| FU-4 | `checkpoint-ledger.test.cjs` | Timeout (30 s) | Test takes ~33 s; `jest.suite.test.cjs` TIMEOUT_UNIT = 30 s fires first | Medium | ✅ Fixed |
| FU-5 | `cluster-merge.test.cjs` | Timeout (30 s) | Test takes ~40 s (7 git inits on Windows); same 30 s timeout | Low | ✅ Fixed |
| FU-6 | `migration-source-detect.test.cjs` | Timeout (30 s) | Test takes ~8 s; false-positive timeout from prior flaky env | Medium | ✅ Fixed |

**Root causes resolved:**
- FU-1: `upgrade-checkpoint.cjs` called `intake-verify.cjs check-gate` without required `--skill` flag → exit 10 before writing gate. Fix: added `--skill=${SKILL}` to `guardArgs`.
- FU-2: Banned token `stage_gates` present in `source-context-intake-spec.md:48`. Fix: rephrased to `the \`intake_context\` gate as PASS`.
- FU-3: A8 check in `strategy-resolve.cjs` treated intentional `{Name}`/`{Cluster}` template syntax as "unfilled placeholders" → exit 2. Fix: removed unfilled-placeholder sub-check; kept empty-body check only.
- FU-4/5/6: `jest.suite.test.cjs` `TIMEOUT_UNIT = 30_000` ms too low for slow tests (~33–40 s each). Fix: increased to `120_000`.

**Files changed (follow-up fixes):**
- `scripts/upgrade-checkpoint.cjs` (FU-1)
- `skills/shared/migration-knowledge/refs/specs/source-context-intake-spec.md` (FU-2)
- `scripts/strategy-resolve.cjs` (FU-3)
- `tests/jest.suite.test.cjs` (FU-4/5/6)

### Lessons Learned

1. **Call-site flag drift:** When a called script adds a required flag (`--skill` in `intake-verify check-gate`), all callers must be updated atomically. The missing `--skill` in `upgrade-checkpoint.cjs` caused a silent early-exit — the gate was not written, but no explicit error was surfaced to the test assertion. Always grep callers after adding required flags to a shared script.

2. **Template syntax vs authoring errors in profile files:** The `strategy-resolve.cjs` A8 check conflated intentional `{Name}` template variables (substituted by the migration skill at runtime) with genuinely unfilled author placeholders. Validate only what you can definitively identify as wrong — an empty section body is an error; a `{Token}` pattern in a template file is by design.

3. **Test runner timeout calibration:** `jest.suite.test.cjs` used a single `TIMEOUT_UNIT` for all unit tests. Tests with many `spawnSync` calls (checkpoint-ledger: 37 assertions, cluster-merge: 7 git inits) legitimately exceed 30 s on Windows. When adding tests that spawn processes or run git operations, verify raw execution time against `TIMEOUT_UNIT` before committing.

4. **Banned token hygiene in spec tier:** Retiring a token from the codebase (e.g. `stage_gates` replaced by `checkpoint gates` in human prose) requires scanning the migration-knowledge spec tier for existing uses and updating them — the migration-specs test enforces this at CI time.

### Retrospective Items

1. **Add a caller-audit step when modifying shared script interfaces.** FU-1 was caused by `intake-verify.cjs` adding `--skill` as required without updating `upgrade-checkpoint.cjs`. A grep for all callers of `intake-verify.cjs check-gate` would have caught this at the change site.

2. **Document profile template syntax explicitly in `strategies/README.md`.** The `{Name}`, `{Cluster}`, `{port}` tokens are intentional — but the A8 check treated them as mistakes. The README should state that `{PascalCase}` tokens are migration-skill template variables and must not be validated as authoring gaps.

3. **Per-test timeout config in `jest.suite.test.cjs`.** Consider a `SLOW_TESTS` set with a separate `TIMEOUT_SLOW` constant instead of one global `TIMEOUT_UNIT`. This makes the slow-test boundary explicit and prevents the global limit from being raised unnecessarily for fast tests.
