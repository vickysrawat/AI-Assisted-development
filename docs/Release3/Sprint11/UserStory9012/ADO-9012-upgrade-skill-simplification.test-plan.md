<!-- test-plan-state
epic: ADO-9012
stories:
  - id: Story-1
    title: "Gate Reduction and Runbook"
    suite: "Suite 2"
    tech-spec: "ADO-9012-Story-1-gate-reduction-runbook.techspec.md"
    status: generated
  - id: Story-2
    title: "research-cache Redesign"
    suite: "Suite 3"
    tech-spec: "ADO-9012-Story-2-research-cache-redesign.techspec.md"
    status: generated
  - id: Story-3
    title: "Intake Redesign"
    suite: "Suite 4"
    tech-spec: "ADO-9012-Story-3-intake-redesign.techspec.md"
    status: generated
  - id: Story-4
    title: "Dead Code, Checkpoint, Step 4.5"
    suite: "Suite 5"
    tech-spec: "ADO-9012-Story-4-dead-code-checkpoint.techspec.md"
    status: generated
  - id: Story-5
    title: "Step Boundary Cleanup and Migration Log"
    suite: "Suite 6"
    tech-spec: "ADO-9012-Story-5-step-boundary-log.techspec.md"
    status: generated
cross-cutting-suites-status: generated
-->

# Test Plan — Upgrade Skill Simplification
ADO #9012 · Release 3 · Sprint 11
Document type: QA Test Plan · Type: EPIC SKELETON
Prepared: 2026-10-03
Source: icea (auto-generated via icea-feature Step 10b, subagent mode)

---

## Overview

This test plan covers the Upgrade Skill Simplification epic (22 SP, 5 stories). Each story
suite will be expanded when the story is implemented (`EXPAND TEST ADO-9012 Suite-N`).
Cross-cutting suites (Regression, Security, NFR) will be expanded when all story specs
are approved.

**Mandatory execution order:** Story 1 gates must be verified before testing Stories 3, 4, 5
(those stories depend on Story 1's gate structure). Story 2 is independent.

---

## Environment Requirements

| Item | Requirement |
|---|---|
| Node.js | 20+ (CommonJS; plugin dev environment) |
| Plugin version | 3.25.0 (or branch containing this ADO) |
| Test runner | `npm test` (Jest wrapper spawning each *.test.cjs) |
| Sample project | Any project with a package.json or .csproj for upgrade skill testing |
| Cache state | Clean research cache (no prior entries) for Story 2 tests |

---

## Test Suites

| Suite | Title | When to run | Effort |
|---|---|---|---|
| Suite 1 | Smoke — End-to-End Gate Count | After all 5 stories merge | ~30 min |
| Suite 2 | Story 1 — Gate Reduction and Runbook | After Story 1 merges | ~45 min |
| Suite 3 | Story 2 — research-cache Redesign | After Story 2 merges | ~30 min |
| Suite 4 | Story 3 — Intake Redesign | After Story 3 merges | ~60 min |
| Suite 5 | Story 4 — Dead Code, Checkpoint, Step 4.5 | After Story 4 merges | ~45 min |
| Suite 6 | Story 5 — Step Boundary and Migration Log | After Story 5 merges | ~30 min |
| Suite 7 | Regression — Rewrite Skill Cache Block | After Story 2 merges | ~20 min |
| Suite 8 | Security — Gate Self-Approval Prevention | After all stories merge | ~20 min |
| Suite 9 | NFR — npm test Full Suite | After each story merges | ~10 min |

**Estimated total effort: ~5.5 hours for a full pass across all suites.**

---

## Suite 1 — Smoke: End-to-End Gate Count

> Quickest verification that the core promise of ADO-9012 is met.

### TC-SMK-01 — Exactly 3 developer reply gates
**Priority:** Critical
**Type:** Manual
**AC:** AC-F1

**Steps:**
1. Run `UPGRADE ADO-<test-id>` on a sample project
2. Observe all prompts that appear throughout the full skill run
3. Count the number of times the skill requires a developer keyword reply
4. Verify the 3 keywords: INTAKE CONFIRMED · APPROVE REPORT · APPROVE DESIGN
5. Verify no `[CONTINUE]` or `[CONTINUE ADO-...]` prompt appears at any point

**Expected:** Exactly 3 developer reply prompts; zero CONTINUE prompts.

---

## Suite 2 — Story 1: Gate Reduction and Runbook

> When to run: after Story 1 merges.
> Verifies that CONTINUE gates are removed, 3 real gates remain, upgrade-runbook.md is
> created at Step 1, and the tool preflight hard BLOCK fires correctly on a missing tool.

**ACs covered:** AC-F1, AC-F2, AC-F3
**Estimated effort:** ~45 min

### TC-GRR-01 — Zero CONTINUE gates in SKILL.md
**Priority:** Critical
**Type:** Manual
**AC:** AC-F1

**Steps:**
1. Run: `grep -c "CONTINUE" skills/upgrade/SKILL.md`
2. Confirm the output is `0`

**Expected:** Zero occurrences of the word "CONTINUE" in SKILL.md.

---

### TC-GRR-02 — Three real gate declarations present
**Priority:** Critical
**Type:** Manual
**AC:** AC-F1

**Steps:**
1. Open `skills/upgrade/SKILL.md` and locate the `## Developer reply gates` section near the top
2. Confirm the declarations block contains all three:
   - `INTAKE CONFIRMED ADO-<ADO-ID>`
   - `APPROVE REPORT ADO-<ADO-ID>`
   - `APPROVE DESIGN ADO-<ADO-ID>`
3. Confirm no fourth gate keyword appears in the declarations block

**Expected:** Exactly 3 gate keywords listed in the declarations block; no others.

---

### TC-GRR-03 — upgrade-runbook.md created at Step 1
**Priority:** Critical
**Type:** Manual
**AC:** AC-F2

**Steps:**
1. Run `UPGRADE ADO-<test-id>` on a sample Node.js project (all tools present)
2. Observe Step 1 output (before any gate)
3. Check that `docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-runbook.md` exists

**Expected:** Runbook file created during Step 1; file contains at minimum sections: Step 1 — Tool Preflight, Step 5 — Baseline and Execution Plan, Step 6 — Hop Execution, Step 7 — Residual Fixes.

---

### TC-GRR-04 — Steps 5/6/7 append to upgrade-runbook.md
**Priority:** High
**Type:** Manual
**AC:** AC-F2

**Steps:**
1. Run a full upgrade on a sample project through Steps 5, 6, and 7
2. Open `docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-runbook.md`
3. Verify each step has appended its content:
   - Step 5: baseline tag + execution plan commands appear under the Step 5 section
   - Step 6: hop commands appear under the Step 6 section for each hop
   - Step 7: each residual fix appears under the Step 7 section

**Expected:** Runbook contains populated sections for Steps 5, 6, and 7 with the actual commands and fix summaries.

---

### TC-GRR-05 — Tool preflight passes when tool is present
**Priority:** High
**Type:** Manual
**AC:** AC-F3

**Steps:**
1. Ensure `dotnet` (or `node`/`mvn`/`python` per stack) is available in PATH
2. Run `UPGRADE ADO-<test-id>` on a sample project
3. Observe Step 1 output

**Expected:** No `⛔` message appears; Step 1 proceeds to the intake stage without interruption.

---

### TC-GRR-06 — Tool preflight hard BLOCK on missing tool
**Priority:** Critical
**Type:** Manual
**AC:** AC-F3

**Steps:**
1. Temporarily remove the required CLI tool from PATH (e.g. prepend a shadow directory that shadows the tool binary with a non-existent file, or rename it)
2. Run `UPGRADE ADO-<test-id>` on a sample project
3. Observe the output

**Expected:**
- Chat shows: `⛔ Required tool not found: <tool>. Install steps written to upgrade-runbook.md. Re-invoke after installing.`
- `docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-runbook.md` contains a `### Tool Preflight — BLOCKED` section
- Skill stops — no further steps execute after the BLOCK message

**Fail condition:** Skill proceeds past the BLOCK, or the runbook is not updated.

---

### TC-GRR-07 — Full upgrade run shows exactly 3 developer prompts
**Priority:** Critical
**Type:** Manual
**AC:** AC-F1, AC-F2

**Steps:**
1. Run `UPGRADE ADO-<test-id>` on a sample project (all tools present, clean state)
2. Observe all prompts throughout the entire skill run
3. Count the number of times a developer keyword reply is required

**Expected:** Exactly 3 developer reply prompts appear in order:
1. `INTAKE CONFIRMED ADO-<test-id>` (after Step 3 intake review)
2. `APPROVE REPORT ADO-<test-id>` (after Step 4 gap/risk report)
3. `APPROVE DESIGN ADO-<test-id>` (after Step 4.5 decisions doc)

No `CONTINUE` or `[CONTINUE ADO-...]` prompt appears at any point. `upgrade-runbook.md` exists after Step 1.

---

## Suite 3 — Story 2: research-cache Redesign

> When to run: after Story 2 merges.
> Verifies the new exit-code contract (0=fresh, 1=miss, 2=stale) and the
> --extract-bundle-to flag, plus the simplified SKILL.md cache blocks.

**ACs covered:** AC-F4, AC-F5, AC-F6, AC-F7, AC-NF2
**Estimated effort:** ~30 min

### TC-RCR-01 — Stale lookup exits 2 (not 0)
**Priority:** Critical
**Type:** Automated
**AC:** AC-F4

**Steps:**
1. Run `node tests/research-cache.test.cjs`
2. Confirm assertion `lookup stale exits 2 (stale)` passes
3. Confirm all 27 assertions pass with 0 failures

**Expected:** `27 passed · 0 failed`; no assertion for `stale.code === 0` remains.

---

### TC-RCR-02 — Fresh lookup still exits 0
**Priority:** Critical
**Type:** Automated
**AC:** AC-F4

**Steps:**
1. Run `node tests/research-cache.test.cjs`
2. Confirm assertion `lookup fresh hit exits 0` passes

**Expected:** Fresh hit exits 0; stale exits 2; miss exits 1 — three distinct codes.

---

### TC-RCR-03 — --extract-bundle-to writes bundle file on hit
**Priority:** Critical
**Type:** Manual
**AC:** AC-F5

**Steps:**
1. Write a fresh cache entry: `node scripts/research-cache.cjs write --key=test-key --bundle-file=<bundle.json> --source-stack=dotnet --source-version=6 --target-stack=dotnet --target-version=8`
2. Run: `node scripts/research-cache.cjs lookup --key=test-key --extract-bundle-to=out.json`
3. Verify exit code is 0
4. Verify `out.json` exists and contains valid JSON (the bundle content)

**Expected:** exit 0; `out.json` written; content matches the bundle stored at write time.

---

### TC-RCR-04 — --extract-bundle-to does nothing on miss (exit 1)
**Priority:** High
**Type:** Manual
**AC:** AC-F5

**Steps:**
1. Clear the cache (or use a key that does not exist)
2. Run: `node scripts/research-cache.cjs lookup --key=nonexistent-key --extract-bundle-to=out.json`
3. Verify exit code is 1
4. Verify `out.json` does NOT exist

**Expected:** exit 1 (miss); `out.json` not created.

---

### TC-RCR-05 — upgrade SKILL.md cache block is ≤14 lines
**Priority:** High
**Type:** Manual
**AC:** AC-F6

**Steps:**
1. Open `skills/upgrade/SKILL.md` and locate the cache block (search for `CACHE_KEY=`)
2. Count lines from `CACHE_KEY=` through the closing `node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs"` call
3. Confirm no `node -e` inline JSON-parsing one-liners appear in the block
4. Confirm `--extract-bundle-to` flag is used in the `lookup` call
5. Confirm `CACHE_EXIT=$?` + `if [ "$CACHE_EXIT" -eq 2 ]` branching is present

**Expected:** ≤14-line block; no `node -e` JSON parsing; exit-code branching on `CACHE_EXIT`.

---

### TC-RCR-06 — rewrite SKILL.md cache block same simplification
**Priority:** High
**Type:** Manual
**AC:** AC-F7

**Steps:**
1. Open `skills/rewrite/SKILL.md` and locate the cache block (search for `CACHE_KEY=`)
2. Confirm the same ≤14-line structure as the upgrade SKILL.md block
3. Confirm `$CACHE_BUNDLE` (not `$BUNDLE_FILE`) is used in the downstream coupling-replacements extraction block

**Expected:** Same simplified structure; `$BUNDLE_FILE` reference is gone; `$CACHE_BUNDLE` used throughout.

---

### TC-RCR-07 — rewrite skill cache block regression (no BUNDLE_FILE variable references)
**Priority:** Critical
**Type:** Manual
**AC:** AC-F7

**Steps:**
1. Run: `grep "BUNDLE_FILE" skills/rewrite/SKILL.md`
2. Confirm output is empty (zero matches)

**Expected:** Zero occurrences of `BUNDLE_FILE` in rewrite SKILL.md.

---

### TC-RCR-08 — npm test research-cache suite passes
**Priority:** Critical
**Type:** Automated
**AC:** AC-NF2

**Steps:**
1. Run `npm test` (full suite)
2. Confirm `research-cache.test.cjs` row shows `√` (pass)
3. Confirm no new failures introduced by Story 2 changes

**Expected:** `research-cache.test.cjs` green; overall failure count unchanged from pre-Story-2 baseline.

---

## Suite 4 — Story 3: Intake Redesign

> When to run: after Story 3 merges.
> Verifies the 3-pass auto-generated upgrade-intake.md, 12 sections, summary banner,
> DEVELOPER REVIEW reason codes, incremental write, checkpoint resumability, and context budget check.

**ACs covered:** AC-F8, AC-F9, AC-F10, AC-F11, AC-F12, AC-F13, AC-NF1
**Estimated effort:** ~60 min

### TC-IR-01 — upgrade-intake.md has exactly 12 section headings
**Priority:** Critical
**Type:** Manual
**AC:** AC-F9

**Steps:**
1. Run `UPGRADE ADO-<test-id>` on a sample project through Pass 3
2. Run: `grep -c "^## Section" docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-intake.md`
3. Confirm output is `12`

**Expected:** Exactly 12 section headings (0–11); no section silently skipped.

---

### TC-IR-02 — Every section renders with findings or not-applicable evidence
**Priority:** Critical
**Type:** Manual
**AC:** AC-F9

**Steps:**
1. Open `docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-intake.md`
2. For each of the 12 sections, confirm it contains either: a finding entry, or the text `Not applicable — evidence:`
3. Confirm no section body is empty (no section stubs remain after completion)

**Expected:** All 12 sections populated; no empty section bodies.

---

### TC-IR-03 — Summary banner present with correct format
**Priority:** Critical
**Type:** Manual
**AC:** AC-F10

**Steps:**
1. After all 3 passes complete, open the intake file
2. Confirm the file begins with `## Summary`
3. Confirm the banner contains: `⛔ N blockers`, `⚠ N migration required`, `⚠ N behavioral changes`, `✅ N compatible`, `N sections not applicable`
4. Confirm `Status: READY FOR REVIEW` is present in the banner

**Expected:** Summary banner at top of file; counts correct; status READY FOR REVIEW.

---

### TC-IR-04 — DEVELOPER REVIEW label includes reason code (registry timeout)
**Priority:** High
**Type:** Manual
**AC:** AC-F11

**Steps:**
1. Simulate a registry timeout (e.g. set a non-routable registry URL for one package)
2. Run the upgrade skill through Pass 1
3. Check Section 5 for the timed-out package

**Expected:** Entry reads `DEVELOPER REVIEW (registry timeout)` — reason code present.

---

### TC-IR-05 — DEVELOPER REVIEW label when all registry calls fail
**Priority:** High
**Type:** Manual
**AC:** AC-F11

**Steps:**
1. Set a non-routable registry URL (all calls fail)
2. Run the upgrade skill through Pass 1
3. Check Section 5 header note and individual package entries

**Expected:**
- Section 5 header: "Registry unreachable — compatibility check skipped. All packages labeled DEVELOPER REVIEW (registry unavailable). Passes 2 and 3 still run."
- All package entries: `DEVELOPER REVIEW (registry unavailable)`
- Passes 2 and 3 still execute (Sections 6, 8, 10 populated)

---

### TC-IR-06 — Each package appended immediately after its query
**Priority:** High
**Type:** Manual
**AC:** AC-F12

**Steps:**
1. Run the upgrade skill through Pass 1 on a project with ≥5 packages
2. After package 3 is processed (but before Pass 1 completes), open the intake file
3. Confirm packages 1–3 are present in Section 5; packages 4+ are not yet present

**Expected:** Results appear incrementally — intake file is not empty until Pass 1 completes.

---

### TC-IR-07 — Checkpoint written before each query (intake_progress_index)
**Priority:** Critical
**Type:** Manual
**AC:** AC-F13

**Steps:**
1. Run the upgrade skill and interrupt after package 5 is processed
2. Read the checkpoint ledger: `node scripts/checkpoint-ledger.cjs get-payload --skill=upgrade --ado=<ADO-ID>`
3. Confirm `intake_pass=1` and `intake_progress_index=5` (or the last processed index) are recorded

**Expected:** Ledger has `intake_pass=1` and `intake_progress_index` matching the last processed package.

---

### TC-IR-08 — UPGRADE RESUME skips already-processed packages
**Priority:** Critical
**Type:** Manual
**AC:** AC-F13

**Steps:**
1. Set `intake_progress_index=5` in the ledger manually (simulate interrupted session)
2. Run `UPGRADE RESUME ADO-<test-id>`
3. Observe which packages are queried in Pass 1

**Expected:** Packages 0–4 are skipped; processing starts from package 5.

---

### TC-IR-09 — Context budget check fires before Pass 1
**Priority:** High
**Type:** Manual
**AC:** AC-NF1

**Steps:**
1. Use a project with many packages (~50) to simulate near-capacity context
2. Run the upgrade skill and observe output before Pass 1 starts
3. Confirm the COMPACT path is offered with `UPGRADE RESUME ADO-<test-id>` recovery command

**Expected:** COMPACT path offered; Pass 1 does not start until developer confirms.

---

### TC-IR-10 — INTAKE CONFIRMED gate uses new prompt format
**Priority:** Critical
**Type:** Manual
**AC:** AC-F8

**Steps:**
1. Run a full upgrade through all 3 passes
2. Observe the gate prompt that appears after Pass 3 and the summary banner
3. Confirm prompt shows: intake file path, summary counts, confirming-means statement, and `INTAKE CONFIRMED ADO-<test-id>` keyword

**Expected:** New prompt format (not old `🛑 INTAKE GATE` format); keyword `INTAKE CONFIRMED ADO-<id>` present.

---

### TC-IR-11 — upgrade-checkpoint.cjs intake-verify called after INTAKE CONFIRMED
**Priority:** Critical
**Type:** Manual
**AC:** AC-F8

**Steps:**
1. Send `INTAKE CONFIRMED ADO-<test-id>` after the gate prompt
2. Observe subsequent output
3. Confirm `upgrade-checkpoint.cjs intake-verify` is invoked
4. Confirm skill proceeds to Step 4 only after intake-verify exits 0

**Expected:** intake-verify invoked; skill proceeds to Step 4 on exit 0; blocks on non-zero exit.

---

## Suite 5 — Story 4: Dead Code, Checkpoint, Step 4.5

> When to run: after Story 4 merges.

**ACs covered:** AC-F14, AC-F15 (partial), AC-F16, AC-F17, AC-NF3

---

### TC-DC-01 — resolve-migration-roots.cjs removed from required scripts preflight

**Priority:** Critical
**Type:** Manual
**AC:** AC-F14

**Steps:**
1. Open `skills/upgrade/SKILL.md`.
2. Search for `resolve-migration-roots` (case-sensitive).

**Expected:** Zero matches — script is not listed in REQUIRED_SCRIPTS and not invoked anywhere in the skill.

---

### TC-DC-02 — resolve-migration-roots invocation block deleted

**Priority:** Critical
**Type:** Manual
**AC:** AC-F14

**Steps:**
1. Open `skills/upgrade/SKILL.md`.
2. Search for the text "Resolve migration roots" and "set-source".

**Expected:** Zero matches — the invocation block and migrationRoots ledger call are absent.

---

### TC-DC-03 — checkpoint-ledger.cjs set-gate calls consolidated to upgrade-checkpoint.cjs

**Priority:** Critical
**Type:** Manual
**AC:** AC-F15

**Steps:**
1. Run: `grep "checkpoint-ledger.cjs set-gate --skill=upgrade" skills/upgrade/SKILL.md | wc -l`
2. Run: `grep "upgrade-checkpoint.cjs set-gate" skills/upgrade/SKILL.md | wc -l`

**Expected:** Step 1 → 0 matches. Step 2 → ≥8 matches (one per step boundary).

---

### TC-DC-04 — upgrade-checkpoint.cjs init replaces checkpoint-ledger.cjs init

**Priority:** Critical
**Type:** Manual
**AC:** AC-F15

**Steps:**
1. Run: `grep "checkpoint-ledger.cjs init" skills/upgrade/SKILL.md`
2. Run: `grep "upgrade-checkpoint.cjs init" skills/upgrade/SKILL.md`

**Expected:** Step 1 → 0 matches. Step 2 → 1 match (Step 1 boundary).

---

### TC-DC-05 — Step 4.5 generates upgrade-decisions.md

**Priority:** Critical
**Type:** Manual
**AC:** AC-F16

**Steps:**
1. Open `skills/upgrade/SKILL.md`, locate Step 4.5.
2. Verify the section describes generating `docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-decisions.md`.
3. Verify: one entry per RED or BLOCKER item is the format instruction.
4. Verify: fallback line "No architectural decisions required — all items are routine fixes." is present.

**Expected:** All three elements present. No reference to design delta documents or feedback loops via external spec files.

---

### TC-DC-06 — target-design-spec, design-revision-spec, graph-derive-documents removed from Step 4.5

**Priority:** Critical
**Type:** Manual
**AC:** AC-F17

**Steps:**
1. Run: `grep "target-design-spec\|design-revision-spec\|graph-derive-documents" skills/upgrade/SKILL.md`

**Expected:** Zero matches — all three references eliminated.

---

### TC-DC-07 — upgrade-checkpoint.cjs test suite passes unchanged

**Priority:** Critical
**Type:** Automated
**AC:** AC-NF3

**Steps:**
1. Run: `node tests/upgrade-checkpoint.test.cjs`

**Expected:** All assertions pass. No new failures. Exit 0.

---

## Suite 6 — Story 5: Step Boundary Cleanup and Migration Log

> When to run: after Story 5 merges.

**ACs covered:** AC-F18, AC-F19, AC-F20, AC-F21

---

### TC-SB-01 — Standalone Step 8 heading removed

**Priority:** Critical
**Type:** Manual
**AC:** AC-F18

**Steps:**
1. Run: `grep "^## Step 8 " skills/upgrade/SKILL.md | wc -l`

**Expected:** 0 matches — no standalone `## Step 8` heading exists.

---

### TC-SB-02 — Judge substrate inlined into Step 4

**Priority:** High
**Type:** Manual
**AC:** AC-F18

**Steps:**
1. Open `skills/upgrade/SKILL.md`, locate Step 4 (gap/risk report section).
2. Search for "Judge substrate (Step 4)".

**Expected:** Text present inline in Step 4 before the `set-gate report PASS` call.

---

### TC-SB-03 — Judge substrate inlined into Step 7

**Priority:** High
**Type:** Manual
**AC:** AC-F18

**Steps:**
1. Open `skills/upgrade/SKILL.md`, locate Step 7 (residual remediation).
2. Search for "Judge substrate (Step 7)".

**Expected:** Text present inline in Step 7 before [RESIDUAL SUMMARY] block.

---

### TC-SB-04 — Step 9 artifact validation present for all 4 files

**Priority:** Critical
**Type:** Manual
**AC:** AC-F19

**Steps:**
1. Open `skills/upgrade/SKILL.md`, locate Step 9.
2. Verify artifact validation block checks all 4 files:
   - upgrade-runbook.md
   - upgrade-intake.md
   - upgrade-decisions.md
   - migration-log.md
3. Verify completion summary (with paths and anticipated/unanticipated counts) is present.
4. Verify missing artifact message uses ⚠ and includes "Check runbook".

**Expected:** All 4 artifacts checked; completion summary present; ⚠ message for missing artifacts; Step 9 does not hard-stop on missing artifact.

---

### TC-SB-05 — Migration log scoping rule replaces blanket mandate

**Priority:** Critical
**Type:** Manual
**AC:** AC-F20

**Steps:**
1. Open `skills/upgrade/SKILL.md`, locate Step 7.
2. Search for "Migration log scoping — write entries only when required".
3. Verify the scoping table has 3 rows: [FINDING], [DECISION], No entry.
4. Verify "No entry" row explicitly calls out routine intake-matched fixes.
5. Search for "Write migration log entries for every residual fix" — must not exist.

**Expected:** Scoped mandate table present; blanket "for every fix" mandate absent.

---

### TC-SB-06 — [RESIDUAL SUMMARY] format present in Step 7

**Priority:** Critical
**Type:** Manual
**AC:** AC-F21

**Steps:**
1. Open `skills/upgrade/SKILL.md`, locate Step 7.
2. Search for `[RESIDUAL SUMMARY]`.
3. Verify fields present: Date, ADO, Anticipated fixes, Unanticipated fixes, Non-obvious decisions.
4. Verify soft-failure handler (print + continue on write failure).

**Expected:** [RESIDUAL SUMMARY] block present after verify flush; all 5 fields; error handling present (not a hard stop).

---

## Suite 7 — Regression: Rewrite Skill Cache Block

> When to run: after Story 2 merges (rewrite SKILL.md cache block is modified).
> Verifies the rewrite skill correctly handles all 3 cache exit codes after the
> cache block simplification (AC-F7), and has no residual BUNDLE_FILE references.

**ACs covered:** AC-F7
**Estimated effort:** ~20 min

### TC-RWC-01 — No BUNDLE_FILE references in rewrite SKILL.md
**Priority:** Critical
**Type:** Manual
**AC:** AC-F7

**Steps:**
1. Run: `grep "BUNDLE_FILE" skills/rewrite/SKILL.md`
2. Confirm output is empty

**Expected:** Zero occurrences of `BUNDLE_FILE` in rewrite SKILL.md — old variable name fully replaced by `CACHE_BUNDLE`.

---

### TC-RWC-02 — $CACHE_BUNDLE used in coupling-replacements extraction block
**Priority:** Critical
**Type:** Manual
**AC:** AC-F7

**Steps:**
1. Open `skills/rewrite/SKILL.md` and locate the coupling-replacements extraction block (search for `coupling_replacements`).
2. Verify the `readFileSync` call references `$CACHE_BUNDLE` (not `$BUNDLE_FILE`).

**Expected:** `$CACHE_BUNDLE` is the variable used in the downstream coupling-replacements extraction; no `$BUNDLE_FILE` reference.

---

### TC-RWC-03 — Stale hit (exit 2) shows ⚠ warning and continues
**Priority:** Critical
**Type:** Manual
**AC:** AC-F7

**Steps:**
1. Pre-seed a stale cache entry for a rewrite pair (set the cache write timestamp to >90 days ago by manually editing the cache file, or use `research-cache.cjs` with a backdated timestamp if the tool supports it).
2. Invoke the rewrite skill to the options step.
3. Observe output when the cache block executes.

**Expected:**
- `⚠ Research cache is stale (30-90 days). Using cached data — consider refreshing.` appears in chat.
- Skill continues using the stale bundle — does NOT invoke the research agent again.
- Options analysis proceeds using the cached bundle.

**Fail condition:** Skill re-invokes the research agent on stale exit or stops with an error.

---

### TC-RWC-04 — Cache miss (exit 1) invokes research agent
**Priority:** Critical
**Type:** Manual
**AC:** AC-F7

**Steps:**
1. Ensure no cache entry exists for the test rewrite pair (delete or use a unique key).
2. Invoke the rewrite skill to the options step.
3. Observe that the research agent is invoked (the agent prompt appears).

**Expected:**
- Cache lookup exits 1 (miss); no `$CACHE_BUNDLE` file is written by the lookup call.
- Research agent is invoked to populate facts.
- After agent returns, cache is written immediately (before options analysis begins).

**Fail condition:** Skill skips agent invocation on cache miss.

---

### TC-RWC-05 — Fresh hit (exit 0) skips agent invocation
**Priority:** High
**Type:** Manual
**AC:** AC-F7

**Steps:**
1. Pre-seed a fresh (non-stale) cache entry for the test rewrite pair.
2. Invoke the rewrite skill to the options step.
3. Observe that no research agent prompt appears.

**Expected:**
- Cache lookup exits 0; `$CACHE_BUNDLE` file is written with the bundle content.
- Research agent is NOT invoked.
- Options analysis uses the fresh cached bundle directly.

---

## Suite 8 — Security: Gate Self-Approval Prevention

> When to run: after all stories merge.
> Verifies that the approval-capture.cjs hook (ADO-9007) is registered for all 3
> upgrade skill gates, preventing the model from self-approving gate keywords.

**ACs covered:** Permission Boundary (ICEA Examples)
**Estimated effort:** ~20 min

### TC-SEC-01 — All 3 gate keywords registered in approval-capture hook
**Priority:** Critical
**Type:** Manual
**AC:** Permission Boundary

**Steps:**
1. Open `.claude/hooks/approval-capture.cjs` (or the settings file that registers monitored keywords).
2. Search for each gate keyword:
   - `INTAKE CONFIRMED`
   - `APPROVE REPORT`
   - `APPROVE DESIGN`

**Expected:** All 3 keywords are present in the hook's monitored keyword list.

---

### TC-SEC-02 — Model-generated INTAKE CONFIRMED is blocked
**Priority:** Critical
**Type:** Manual
**AC:** Permission Boundary

**Steps:**
1. During an upgrade skill run, observe the INTAKE CONFIRMED gate prompt.
2. Do NOT type anything — wait for the model to attempt to continue.
3. If the model produces output containing `INTAKE CONFIRMED ADO-<id>`, observe the hook response.

**Expected:** Hook intercepts the model-generated keyword and blocks progression. The developer must type `INTAKE CONFIRMED ADO-<id>` manually for the gate to pass. The model cannot bypass the gate by generating the keyword itself.

**Note:** This is a passive observation test — the hook firing is the expected behavior. If the model does not attempt self-approval, the gate is working correctly by design; mark as ✅.

---

### TC-SEC-03 — Model-generated APPROVE REPORT is blocked
**Priority:** Critical
**Type:** Manual
**AC:** Permission Boundary

**Steps:**
1. During an upgrade skill run, observe the APPROVE REPORT gate prompt.
2. If the model produces output containing `APPROVE REPORT ADO-<id>` before the developer types it, observe the hook response.

**Expected:** Same blocking behavior as TC-SEC-02. Developer input required for gate passage.

---

### TC-SEC-04 — Model-generated APPROVE DESIGN is blocked
**Priority:** Critical
**Type:** Manual
**AC:** Permission Boundary

**Steps:**
1. During an upgrade skill run, observe the APPROVE DESIGN gate prompt.
2. If the model produces output containing `APPROVE DESIGN ADO-<id>` before the developer types it, observe the hook response.

**Expected:** Same blocking behavior as TC-SEC-02. Developer input required for gate passage.

---

### TC-SEC-05 — Legitimate developer INTAKE CONFIRMED passes through
**Priority:** Critical
**Type:** Manual
**AC:** Permission Boundary

**Steps:**
1. At the INTAKE CONFIRMED gate prompt, type `INTAKE CONFIRMED ADO-<test-id>` manually.
2. Observe that the skill proceeds to Step 4.

**Expected:** Developer-typed gate keyword passes through without being blocked. Skill proceeds normally after the gate.

---

## Suite 9 — NFR: npm test Full Suite

> When to run: after each story merges (before PR merge gate).

### TC-NFR-01 — npm test passes after each story
**Priority:** Critical
**Type:** Automated
**AC:** AC-NF4

**Steps:**
1. After merging each story branch, run `npm test` in the plugin root
2. Confirm all test files pass with 0 failures

**Expected:** All tests green; no regressions.

### TC-NFR-02 — research-cache stale-hit exit code
**Priority:** Critical
**Type:** Automated
**AC:** AC-NF2

**Steps:**
1. After Story 2 merges, run `node tests/research-cache.test.cjs`
2. Check that the stale-hit assertion passes: `stale.code === 2`

**Expected:** All assertions pass; specifically stale.code is 2, not 0.

### TC-NFR-03 — upgrade-checkpoint test unchanged
**Priority:** High
**Type:** Automated
**AC:** AC-NF3

**Steps:**
1. After Story 4 merges, run `node tests/upgrade-checkpoint.test.cjs`
2. Verify no assertions fail

**Expected:** All assertions pass unchanged; no interface regressions.

---

## Test Execution Tracker

| TC ID | Suite | Priority | Tester | Date | Status | Notes |
|---|---|---|---|---|---|---|
| TC-SMK-01 | Suite 1 | Critical | | | ⬜ | |
| TC-GRR-01 | Suite 2 | Critical | | | ⬜ | After Story 1 merges |
| TC-GRR-02 | Suite 2 | Critical | | | ⬜ | After Story 1 merges |
| TC-GRR-03 | Suite 2 | Critical | | | ⬜ | After Story 1 merges |
| TC-GRR-04 | Suite 2 | High | | | ⬜ | After Story 1 merges |
| TC-GRR-05 | Suite 2 | High | | | ⬜ | After Story 1 merges |
| TC-GRR-06 | Suite 2 | Critical | | | ⬜ | After Story 1 merges |
| TC-GRR-07 | Suite 2 | Critical | | | ⬜ | After Story 1 merges |
| TC-IR-01 | Suite 4 | Critical | | | ⬜ | After Story 3 merges |
| TC-IR-02 | Suite 4 | Critical | | | ⬜ | After Story 3 merges |
| TC-IR-03 | Suite 4 | Critical | | | ⬜ | After Story 3 merges |
| TC-IR-04 | Suite 4 | High | | | ⬜ | After Story 3 merges |
| TC-IR-05 | Suite 4 | High | | | ⬜ | After Story 3 merges |
| TC-IR-06 | Suite 4 | High | | | ⬜ | After Story 3 merges |
| TC-IR-07 | Suite 4 | Critical | | | ⬜ | After Story 3 merges |
| TC-IR-08 | Suite 4 | Critical | | | ⬜ | After Story 3 merges |
| TC-IR-09 | Suite 4 | High | | | ⬜ | After Story 3 merges |
| TC-IR-10 | Suite 4 | Critical | | | ⬜ | After Story 3 merges |
| TC-IR-11 | Suite 4 | Critical | | | ⬜ | After Story 3 merges |
| TC-RCR-01 | Suite 3 | Critical | | | ⬜ | After Story 2 merges |
| TC-RCR-02 | Suite 3 | Critical | | | ⬜ | After Story 2 merges |
| TC-RCR-03 | Suite 3 | Critical | | | ⬜ | After Story 2 merges |
| TC-RCR-04 | Suite 3 | High | | | ⬜ | After Story 2 merges |
| TC-RCR-05 | Suite 3 | High | | | ⬜ | After Story 2 merges |
| TC-RCR-06 | Suite 3 | High | | | ⬜ | After Story 2 merges |
| TC-RCR-07 | Suite 3 | Critical | | | ⬜ | After Story 2 merges |
| TC-RCR-08 | Suite 3 | Critical | | | ⬜ | After Story 2 merges |
| TC-DC-01 | Suite 5 | Critical | | | ⬜ | After Story 4 merges |
| TC-DC-02 | Suite 5 | Critical | | | ⬜ | After Story 4 merges |
| TC-DC-03 | Suite 5 | Critical | | | ⬜ | After Story 4 merges |
| TC-DC-04 | Suite 5 | Critical | | | ⬜ | After Story 4 merges |
| TC-DC-05 | Suite 5 | Critical | | | ⬜ | After Story 4 merges |
| TC-DC-06 | Suite 5 | Critical | | | ⬜ | After Story 4 merges |
| TC-DC-07 | Suite 5 | Critical | | | ⬜ | After Story 4 merges |
| TC-SB-01 | Suite 6 | Critical | | | ⬜ | After Story 5 merges |
| TC-SB-02 | Suite 6 | High | | | ⬜ | After Story 5 merges |
| TC-SB-03 | Suite 6 | High | | | ⬜ | After Story 5 merges |
| TC-SB-04 | Suite 6 | Critical | | | ⬜ | After Story 5 merges |
| TC-SB-05 | Suite 6 | Critical | | | ⬜ | After Story 5 merges |
| TC-SB-06 | Suite 6 | Critical | | | ⬜ | After Story 5 merges |
| TC-NFR-01 | Suite 9 | Critical | | | ⬜ | Run after each story |
| TC-NFR-02 | Suite 9 | Critical | | | ⬜ | After Story 2 |
| TC-NFR-03 | Suite 9 | High | | | ⬜ | After Story 4 |
| TC-RWC-01 | Suite 7 | Critical | | | ⬜ | After Story 2 merges |
| TC-RWC-02 | Suite 7 | Critical | | | ⬜ | After Story 2 merges |
| TC-RWC-03 | Suite 7 | Critical | | | ⬜ | After Story 2 merges |
| TC-RWC-04 | Suite 7 | Critical | | | ⬜ | After Story 2 merges |
| TC-RWC-05 | Suite 7 | High | | | ⬜ | After Story 2 merges |
| TC-SEC-01 | Suite 8 | Critical | | | ⬜ | After all stories merge |
| TC-SEC-02 | Suite 8 | Critical | | | ⬜ | After all stories merge |
| TC-SEC-03 | Suite 8 | Critical | | | ⬜ | After all stories merge |
| TC-SEC-04 | Suite 8 | Critical | | | ⬜ | After all stories merge |
| TC-SEC-05 | Suite 8 | Critical | | | ⬜ | After all stories merge |

> Rows added as stub suites are expanded.

**Legend:** ⬜ Not run · ✅ Pass · ❌ Fail · ⚠ Blocked · ➡ Deferred

---

## Exit Criteria

### Minimum for epic to close
- [ ] TC-SMK-01 passed (exactly 3 gates, zero CONTINUE)
- [ ] All Critical TCs in expanded suites passed
- [ ] TC-NFR-01 passed after every story merge (npm test green)
- [ ] TC-NFR-02 passed after Story 2 (stale.code === 2)
- [ ] TC-NFR-03 passed after Story 4 (upgrade-checkpoint unchanged)
- [ ] TC-RWC-01 and TC-RWC-02 passed (no BUNDLE_FILE regression in rewrite SKILL.md)
- [ ] TC-SEC-01 through TC-SEC-05 passed (gate self-approval prevention confirmed for all 3 gates)
- [ ] Zero open Critical defects
