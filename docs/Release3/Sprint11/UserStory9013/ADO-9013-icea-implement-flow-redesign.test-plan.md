<!-- test-plan-state
version: 1
ado: 9013
source: icea
generated_at: 2026-10-05
refreshed_at: 2026-10-05
suites:
  - id: Suite-1
    name: Stop-Point Rationalization
    story: Story-1
    status: generated
  - id: Suite-2
    name: Fix Loop
    story: Story-1
    status: generated
  - id: Suite-3
    name: Epic Auto-Flow
    story: Story-1
    status: generated
  - id: Suite-4
    name: Test Plan Auto-Generate
    story: Story-1
    status: generated
  - id: Suite-5
    name: Non-Functional
    story: Story-1
    status: generated
-->

# Test Plan — icea-implement Flow Redesign
ADO #9013 · Release 3 · Sprint 11
Document type: QA Test Plan
Source: ICEA + Tech Spec
Prepared: 2026-10-05

---

## Overview

This plan verifies that `skills/icea-implement/SKILL.md` contains the correct instruction text for all 20 ACs. Since this is a SKILL.md-only story (no compiled code), all TCs are manual scenario verification: read the relevant section of the SKILL.md and confirm the specified text or behaviour is present. TCs referencing `grep` commands provide a fast mechanised check; TCs referencing "read and verify" require human review of the section text.

## Environment Requirements

| Item | Requirement |
|---|---|
| File under test | `skills/icea-implement/SKILL.md` (repo root) |
| Tool | Any text editor or `grep` via terminal |
| CLAUDE.md | Repo root `CLAUDE.md` (for AC-NF4 conflict check) |
| No runtime execution required | SKILL.md is a Markdown instruction file; it is read by Claude at invocation time |

## Test Suites

| Suite | Title | ACs | TCs | Effort |
|---|---|---|---|---|
| Suite 1 | Stop-Point Rationalization | AC-F1, F2, F3, F4, NF3 | 5 | ~20 min |
| Suite 2 | Fix Loop | AC-F5, F6, F7, F8, F9, F10, F11, NF2 | 7 | ~35 min |
| Suite 3 | Epic Auto-Flow | AC-F12, F13, F14, F15 | 4 | ~20 min |
| Suite 4 | Test Plan Auto-Generate | AC-F16 | 2 | ~10 min |
| Suite 5 | Non-Functional | AC-NF1, AC-NF4 | 2 | ~10 min |

**Estimated total effort: ~95 minutes for a full pass.**

---

## Suite 1 — Stop-Point Rationalization

> Verifies that the non-blocking stop points identified in the pre-story audit have been eliminated or converted to correct hard blocks. Each TC reads a specific section of SKILL.md and checks for the presence or absence of specific text patterns.

### TC-SPR-01 — BUDGET_OK auto-proceeds without CONTINUE prompt
**Priority:** Critical
**Type:** Manual text verification
**AC:** AC-F1

**Steps:**
1. Open `skills/icea-implement/SKILL.md`.
2. Navigate to the Step 3d section (search for `Step 3d — Context budget guard`).
3. Locate the `BUDGET_OK` / `BUDGET_SKIPPED` handling block.
4. Verify the text states that on `BUDGET_OK` or `BUDGET_SKIPPED` the skill proceeds **directly to Step 4** with no developer reply required.
5. Verify there is **no** "Reply `CONTINUE`" instruction attached to the BUDGET_OK path.
6. Run: `grep -c "Reply.*CONTINUE.*to generate code" skills/icea-implement/SKILL.md`
7. Verify the result is `0`.

**Expected:**
- BUDGET_OK path text confirms auto-proceed to Step 4.
- Grep for "Reply `CONTINUE` to generate code" returns `0`.
- No "Do not proceed past this prompt without a reply" text exists on the BUDGET_OK path.

**Fail condition:** Any result other than 0 for the grep, or the BUDGET_OK block still contains a developer reply requirement.

---

### TC-SPR-02 — BUDGET_WARN stops with two options, no FORCE
**Priority:** Critical
**Type:** Manual text verification
**AC:** AC-F2

**Steps:**
1. Open `skills/icea-implement/SKILL.md`.
2. Navigate to Step 3d (search for `BUDGET_WARN / BUDGET_STOP`).
3. Verify the BUDGET_WARN block contains the phrase **"truncated code"** (or "continuing will produce truncated code").
4. Verify exactly **two** recovery options are presented: one involving `/compact` and one involving a new session.
5. Run: `grep -c "FORCE" skills/icea-implement/SKILL.md` — note the count.
6. Verify the word "FORCE" does not appear on the BUDGET_WARN path.
7. Run: `grep -c "No FORCE" skills/icea-implement/SKILL.md` — should be ≥ 1.

**Expected:**
- BUDGET_WARN block contains "truncated code".
- Exactly two recovery paths: `/compact` + re-run, OR new session + re-run.
- No `FORCE` option listed in the BUDGET_WARN block.
- "No FORCE" or "no FORCE" appears in the section.

**Fail condition:** FORCE option present in the budget block, or fewer/more than two recovery paths, or "truncated code" phrase absent.

---

### TC-SPR-03 — BUDGET_STOP stops with same two options, no CONTINUE
**Priority:** Critical
**Type:** Manual text verification
**AC:** AC-F3

**Steps:**
1. Open `skills/icea-implement/SKILL.md`.
2. Navigate to the `BUDGET_WARN / BUDGET_STOP` block in Step 3d.
3. Confirm BUDGET_WARN and BUDGET_STOP are handled **identically** — the same two-option block covers both signals.
4. Verify the block explicitly states there is **no CONTINUE** override.
5. Run: `grep "CONTINUE" skills/icea-implement/SKILL.md | grep -v "CONTINUE option\|No.*CONTINUE"` — result should not reference CONTINUE as an actionable escape on the budget path.

**Expected:**
- BUDGET_WARN and BUDGET_STOP share the same stop block.
- No CONTINUE escape hatch present on the budget path.
- Text explicitly states there is no escape hatch (e.g. "No escape hatch" or "no CONTINUE option").

**Fail condition:** CONTINUE listed as a recoverable command in the budget block, or BUDGET_WARN and BUDGET_STOP handled differently.

---

### TC-SPR-04 — Pre-existing bug rows trigger hard block with tracker path and re-run command
**Priority:** Critical
**Type:** Manual text verification
**AC:** AC-F4

**Steps:**
1. Open `skills/icea-implement/SKILL.md`.
2. Navigate to Step 3 (search for `open.*Bug.*rows` or `bug.*hard.*block`).
3. Verify the bug check block contains: (a) `⛔` symbol, (b) reference to the tracker file path (`{TRACKER}`), (c) a copy-paste re-run command (`IMPLEMENT ADO-{ADO_ID}`).
4. Verify the block explicitly states **"Skill does not proceed to Step 4"** or equivalent hard-stop instruction.
5. Verify there is **no** "Reply CONTINUE" or "Reply STATUS" as a recoverable path.
6. Run: `grep -A5 "Bug.*rows.*HARD STOP\|open.*Bug.*tracker.*HARD" skills/icea-implement/SKILL.md`
7. Confirm the output shows the ⛔ stop block.

**Expected:**
- ⛔ symbol present in the bug check block.
- Tracker path variable (`{TRACKER}`) referenced.
- Copy-paste `IMPLEMENT ADO-{ADO_ID}` re-run command shown.
- Text confirms skill does not proceed to Step 4.
- No CONTINUE option in the bug block.

**Fail condition:** Bug block missing ⛔, tracker path, or re-run command; or CONTINUE still offered.

---

### TC-SPR-05 — Revised status additive; no regression to existing statuses
**Priority:** High
**Type:** Mechanised grep
**AC:** AC-NF3

**Steps:**
1. Run: `grep -c "✅ Done" skills/icea-implement/SKILL.md` — should be ≥ 1.
2. Run: `grep -c "⏳ Pending" skills/icea-implement/SKILL.md` — should be ≥ 1.
3. Run: `grep -c "🔄 In Progress" skills/icea-implement/SKILL.md` — should be ≥ 1.
4. Run: `grep -c "🚫 Blocked" skills/icea-implement/SKILL.md` — should be ≥ 1.
5. Run: `grep -c "🐛 Bug" skills/icea-implement/SKILL.md` — should be ≥ 1.
6. Run: `grep -c "🔄 Revised" skills/icea-implement/SKILL.md` — should be ≥ 1 (new status added).
7. Confirm none of the five original statuses have been removed from Step 3.

**Expected:** All six status values return a count ≥ 1. No regression — existing status handling untouched.

**Fail condition:** Any of the original five statuses return 0; or `🔄 Revised` returns 0.

---

## Suite 2 — Fix Loop

> Verifies the bounded 3-cycle fix loop in Step 7: test command detection order, gap signal at ceiling, 5-element diagnostic format, Option A guided loop, REVISE flow, and audit row format.

### TC-FLX-01 — Fix loop: clean pass on cycle 2 with audit rows
**Priority:** Critical
**Type:** Manual text verification
**AC:** AC-F5

**Steps:**
1. Open `skills/icea-implement/SKILL.md`, navigate to Step 7 (`Step 7 — Post-write gate: bounded fix loop`).
2. Verify Step 7.2 describes a loop of **up to 3 cycles** explicitly.
3. Verify each cycle includes: (a) run checkin, (b) run test suite, (c) if pass → exit loop and append `checkin-pass` audit row; (d) if fail → apply fix, re-stage, append `build-issue` audit row AND a tracker Follow-ups row, then continue.
4. Verify the `checkin-pass` audit row format is present (8-column format).
5. Verify the `build-issue` audit row format is present (8-column format).
6. Verify the tracker Follow-ups row format is present.
7. Confirm the per-cycle display line `🔁 Fix cycle {N}: ...` is specified.

**Expected:**
- Loop ceiling is explicitly 3 cycles.
- checkin-pass, build-issue audit rows specified in 8-column format.
- Follow-ups row format specified.
- `🔁 Fix cycle {N}:` display pattern present.

**Fail condition:** Loop ceiling not specified; audit rows missing; Follow-ups row absent; no per-cycle display line.

---

### TC-FLX-02 — Test command detection: package.json fallback
**Priority:** High
**Type:** Manual text verification
**AC:** AC-F6

**Steps:**
1. Navigate to Step 7.0 in SKILL.md (`Step 7.0 — Detect test command`).
2. Verify the detection order is: (1) `dream-init-state.json` → `test_command` field, (2) `package.json` → `scripts.test`, (3) graceful skip.
3. Verify the `package.json` fallback reads `p.scripts&&p.scripts.test` or equivalent.
4. Confirm the detection block is a `bash` code block executed **once before** the fix loop starts.

**Expected:**
- Three-step detection order is exactly: dream-init-state → package.json → graceful skip.
- package.json path reads `scripts.test`.
- Detection runs once, before the loop.

**Fail condition:** Detection order differs; package.json step absent; detection inside the loop rather than before it.

---

### TC-FLX-03 — Test command: graceful skip with correct message
**Priority:** High
**Type:** Manual text verification
**AC:** AC-F6

**Steps:**
1. Navigate to Step 7.0.
2. Verify the graceful skip case outputs exactly: `⚠ No test command found — fix loop runs checkin only.`
3. Verify no hard-stop is issued when test command is absent — the loop continues (checkin only).

**Expected:**
- Exact phrase "No test command found — fix loop runs checkin only" appears.
- No hard-stop instruction on the absent-test-command path.

**Fail condition:** Different phrase; or hard-stop issued when TEST_CMD is empty.

---

### TC-FLX-04 — Gap signal written before diagnostic at ceiling-hit
**Priority:** Critical
**Type:** Manual text verification
**AC:** AC-F7

**Steps:**
1. Navigate to Step 7.3 (`On ceiling-hit`).
2. Verify Step **7.3a** (gap signal write) appears **before** Step 7.3c (diagnostic display) in the file.
3. Verify the gap signal call uses `signal-write.cjs` with `--type gap`.
4. Verify the bash command ends with `2>/dev/null || true` (exits 0 always).
5. Verify the `--detail` field references "Fix loop ceiling".
6. Run: `grep -n "signal-write.cjs" skills/icea-implement/SKILL.md` and confirm the line number is lower than the `⛔ FIX LOOP CEILING` diagnostic block line number.

**Expected:**
- gap signal write (7.3a) line number < diagnostic display (7.3c) line number.
- `--type gap` present in the call.
- `2>/dev/null || true` present (best-effort, exits 0).
- `--detail "Fix loop ceiling"` or equivalent present.

**Fail condition:** Gap signal write appears after the diagnostic; `|| true` missing; `--type gap` absent.

---

### TC-FLX-05 — Ceiling-hit diagnostic contains all 5 required elements
**Priority:** Critical
**Type:** Manual text verification
**AC:** AC-F8

**Steps:**
1. Navigate to Step 7.3c (`Surface diagnostic`) in SKILL.md.
2. Verify element (a): a label/field for exact file path + line number (e.g. `File     : {exact/path/to/file.ext}:{line_number}`).
3. Verify element (b): a label for verbatim error text (e.g. `Error    : {verbatim error text — not paraphrased}`).
4. Verify element (c): a per-cycle log showing Cycle 1, Cycle 2, Cycle 3 each with what changed and the exact error after that change.
5. Verify element (d): a `ROOT CAUSE ASSESSMENT` heading/section.
6. Verify element (e): three options A, B, C each with a copy-paste command (`REVISE ADO-{ADO_ID}`, `HALT ADO-{ADO_ID}`, and a guidance example).

**Expected:** All 5 elements present in the diagnostic block. Copy-paste commands for B and C present.

**Fail condition:** Any element absent; options A/B/C missing copy-paste commands; per-cycle log missing exact error text instruction.

---

### TC-FLX-06 — Option A guidance starts a full new 3-cycle loop
**Priority:** High
**Type:** Manual text verification
**AC:** AC-F9

**Steps:**
1. Navigate to Step 7.4, Option A in SKILL.md.
2. Verify the text explicitly states a **new 3-cycle loop** starts (not 1 cycle, not "retry once").
3. Verify each guided cycle is displayed as `🔁 Guided cycle {N}: ...`.
4. Verify the second ceiling (guided loop also failing) shows a **GUIDANCE APPLIED** section with: developer's instruction text, where it was applied (file+line), errors from each guided cycle, updated root cause.
5. Verify Options A/B/C are repeated on the second ceiling.

**Expected:**
- "new 3-cycle loop" or "fresh ceiling, cycle count resets to 1" language present.
- `Guided cycle {N}` display pattern present.
- GUIDANCE APPLIED section with required sub-elements present on second ceiling.

**Fail condition:** Only 1 guided retry; GUIDANCE APPLIED section absent on second ceiling; guided cycles not labelled distinctly.

---

### TC-FLX-07 — REVISE from ceiling sets Revised status; IMPLEMENT re-entry resets ACs
**Priority:** High
**Type:** Manual text verification
**AC:** AC-F10, AC-F11

**Steps:**
1. Navigate to Step 7.4, Option B (REVISE) in SKILL.md.
2. Verify the option B block sets tracker Story status to `🔄 Revised` (find the text referencing `**Status:** 🔄 Revised`).
3. Verify `icea-revise` is called with the ceiling diagnostic as input context.
4. Verify a `fix-loop-revise` audit row is appended.
5. Navigate to Step 3 (Change 2 — Revised status detection).
6. Verify Step 3 detects `🔄 Revised` story status and resets all ACs: `✅ Done` → `⏳ Pending`.
7. Verify the display message `🔄 Story {story_n} marked Revised — resetting all ACs to ⏳ Pending` is present.

**Expected:**
- Option B sets `🔄 Revised` in tracker before calling REVISE.
- `fix-loop-revise` audit row specified.
- Step 3 Revised detection resets all ACs to ⏳ Pending.
- Display message confirms re-implementation.

**Fail condition:** Status not set to Revised before REVISE runs; ACs not reset on re-entry; audit row absent.

---

## Suite 3 — Epic Auto-Flow

> Verifies Epic start banner, auto-advance, PAUSE control, and inter-story PAUSE reminder.

### TC-EAF-01 — Epic start banner shows all three required elements
**Priority:** Critical
**Type:** Manual text verification
**AC:** AC-F13

**Steps:**
1. Open `skills/icea-implement/SKILL.md`, navigate to the Epic start banner block in Step 3.
2. Verify element (a): total story count is shown (e.g. `{total_stories} stories to implement`).
3. Verify element (b): `APPROVE ALL ADO-{ADO_ID}` is mentioned (batch approval tip).
4. Verify element (c): `PAUSE` keyword is shown with the exact resume command `IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}`.
5. Verify the banner is only shown when EPIC type AND no Story-N argument was given (`EPIC_AUTO_FLOW = true`).
6. Run: `grep -c "APPROVE ALL ADO" skills/icea-implement/SKILL.md` — should be ≥ 1.
7. Run: `grep -c "EPIC_AUTO_FLOW" skills/icea-implement/SKILL.md` — should be ≥ 2 (set to true + set to false).

**Expected:**
- All three elements present in the banner block.
- Banner conditional on no-Story-arg path only.
- `APPROVE ALL ADO` and `EPIC_AUTO_FLOW` grep results ≥ 1.

**Fail condition:** Any element absent; banner shown unconditionally; EPIC_AUTO_FLOW not referenced.

---

### TC-EAF-02 — Auto-advance proceeds to Story N+1 without IMPLEMENT command
**Priority:** Critical
**Type:** Manual text verification
**AC:** AC-F12

**Steps:**
1. Navigate to Step 6 confirm block in SKILL.md (search for `EPIC_AUTO_FLOW = true AND more stories remain`).
2. Verify the block states: if EPIC_AUTO_FLOW = true AND more stories remain AND no PAUSE reply → **"Proceed to IMPLEMENT ADO-{ADO_ID} Story-{next_story_n} (loop back to Step 3)"** or equivalent.
3. Verify no developer command is required between stories under EPIC_AUTO_FLOW = true.
4. Verify the advance message contains "Advancing to Story {next_story_n} of {total_stories}".

**Expected:**
- Auto-advance instruction present: "Proceed to IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}".
- No developer IMPLEMENT command required.
- Advance message shows story progress (N of total).

**Fail condition:** Developer command required; advance message absent; auto-proceed not specified.

---

### TC-EAF-03 — PAUSE stops flow; PAUSE reminder in advance message
**Priority:** High
**Type:** Manual text verification
**AC:** AC-F14, AC-F15

**Steps:**
1. Navigate to Step 6 confirm block.
2. Verify the PAUSE handling block: when developer replies PAUSE → display ⏸ paused message + resume command → **stop, do not start next story**.
3. Verify the inter-story advance message (the "Advancing to Story N+1" block) contains the PAUSE reminder **with the exact resume command** `IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}`.
4. Verify the PAUSE reminder appears in the advance message body (not only at the Epic start banner).
5. Run: `grep -c "Reply PAUSE" skills/icea-implement/SKILL.md` — should be ≥ 2 (banner + advance message).

**Expected:**
- PAUSE handler stops flow after current story.
- Advance message includes "Reply PAUSE to stop here. Resume: IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}".
- PAUSE reminder count ≥ 2 in the file.

**Fail condition:** PAUSE reminder only in banner (count < 2); advance message missing PAUSE reminder; PAUSE does not stop flow.

---

### TC-EAF-04 — Explicit Story-N invocation: no auto-advance
**Priority:** High
**Type:** Manual text verification
**AC:** AC-F12

**Steps:**
1. Navigate to Step 3 (EPIC_AUTO_FLOW detection block) in SKILL.md.
2. Verify: when Story-N argument is explicitly provided → `EPIC_AUTO_FLOW = false`.
3. Navigate to Step 6 confirm block.
4. Verify the `EPIC_AUTO_FLOW = false` path shows the manual next command and **does not auto-advance**.
5. Verify the text "Stop. Do not auto-advance." or equivalent is present for the explicit-Story path.

**Expected:**
- EPIC_AUTO_FLOW = false when Story-N argument given.
- Manual next command shown (no auto-advance).
- Explicit stop instruction on the false path.

**Fail condition:** Auto-advance proceeds even with explicit Story-N; EPIC_AUTO_FLOW = false path absent.

---

## Suite 4 — Test Plan Auto-Generate

> Verifies that the SKIP_GATE=0 path now auto-generates instead of hard-stopping (AC-F16).

### TC-TPG-01 — Auto-generate triggers when test plan missing (full mode)
**Priority:** Critical
**Type:** Manual text verification
**AC:** AC-F16

**Steps:**
1. Navigate to Step 6a in SKILL.md (search for `SKIP_GATE = 0`).
2. Verify the SKIP_GATE = 0 block now reads: "Auto-generate" (not "Hard gate").
3. Verify the block: (a) displays `⚠ No test plan found for ADO #{ADO_ID} — generating now.`, (b) calls `SAVE TEST ADO-{ADO_ID} --subagent`, (c) on success: removes stale signal file, displays `✅ Test plan generated — continuing.`, appends `test-plan-generated` audit row, continues to Step 7.
4. Run: `grep -c "generating now" skills/icea-implement/SKILL.md` — should be ≥ 1.
5. Run: `grep -c "SAVE TEST.*--subagent" skills/icea-implement/SKILL.md` — should be ≥ 2 (SKIP_GATE=0 path + lightweight mode path).

**Expected:**
- "generating now" phrase present.
- `SAVE TEST ADO-{ADO_ID} --subagent` called on the SKIP_GATE=0 path.
- On success: stale signal cleared, `✅ Test plan generated — continuing.` shown, `test-plan-generated` audit row appended, continues to Step 7.

**Fail condition:** SKIP_GATE=0 block still shows `⛔ NO TEST PLAN` hard stop; `--subagent` call absent; success path does not continue.

---

### TC-TPG-02 — Hard-stop only on generation failure
**Priority:** High
**Type:** Manual text verification
**AC:** AC-F16

**Steps:**
1. Navigate to the SKIP_GATE=0 auto-generate block in Step 6a.
2. Verify the **failure** path (non-zero exit or error from test-plan skill) shows: `⛔ Test plan generation failed for ADO #{ADO_ID}.` with a manual `SAVE TEST ADO-{ADO_ID}` run command and a re-run IMPLEMENT command.
3. Verify a `test-plan-gen-failed` audit row is appended on failure.
4. Verify the failure path stops — does NOT proceed to Step 7.

**Expected:**
- Failure shows ⛔ with manual run command.
- `test-plan-gen-failed` audit row specified.
- Skill stops on failure (does not fall through to Step 7).

**Fail condition:** Failure path falls through to Step 7; audit row absent; manual command missing.

---

## Suite 5 — Non-Functional

> Verifies audit row format unchanged and PAUSE keyword has no CLAUDE.md §0a conflict.

### TC-NFR-01 — PAUSE keyword: no conflict with CLAUDE.md §0a handlers
**Priority:** Critical
**Type:** Mechanised grep
**AC:** AC-NF4

**Steps:**
1. Run: `grep -c "PAUSE" CLAUDE.md`
2. Verify the result is `0`.

**Expected:** Result = 0. PAUSE does not appear as a keyword handler in CLAUDE.md §0a.

**Fail condition:** Result > 0 — PAUSE is handled in CLAUDE.md, creating a conflict with the Epic auto-flow PAUSE instruction.

---

### TC-NFR-02 — Audit row format unchanged (8-column)
**Priority:** High
**Type:** Manual text verification
**AC:** AC-NF1

**Steps:**
1. Open `skills/icea-implement/SKILL.md`. Review all audit row examples added by this story (search for `fix-loop-ceiling`, `fix-loop-revise`, `fix-loop-halt`, `fix-loop-revise`, `checkin-pass`, `build-issue`, `test-plan-generated`, `test-plan-gen-failed`).
2. For each audit row example, count the pipe-separated columns.
3. Verify each row has exactly **8 columns**: `# | Date | Actor | Category | Event | Artifact | Iter | Summary`.
4. Verify no new column is added beyond the 8th.

**Expected:** All new audit rows use the standard 8-column format. No new columns.

**Fail condition:** Any row has more or fewer than 8 columns.

---

## Test Execution Tracker

| TC ID | Suite | Priority | Tester | Date | Status | Notes |
|---|---|---|---|---|---|---|
| TC-SPR-01 | Suite 1 | Critical | | | ⬜ | |
| TC-SPR-02 | Suite 1 | Critical | | | ⬜ | |
| TC-SPR-03 | Suite 1 | Critical | | | ⬜ | |
| TC-SPR-04 | Suite 1 | Critical | | | ⬜ | |
| TC-SPR-05 | Suite 1 | High | | | ⬜ | |
| TC-FLX-01 | Suite 2 | Critical | | | ⬜ | |
| TC-FLX-02 | Suite 2 | High | | | ⬜ | |
| TC-FLX-03 | Suite 2 | High | | | ⬜ | |
| TC-FLX-04 | Suite 2 | Critical | | | ⬜ | |
| TC-FLX-05 | Suite 2 | Critical | | | ⬜ | |
| TC-FLX-06 | Suite 2 | High | | | ⬜ | |
| TC-FLX-07 | Suite 2 | High | | | ⬜ | |
| TC-EAF-01 | Suite 3 | Critical | | | ⬜ | |
| TC-EAF-02 | Suite 3 | Critical | | | ⬜ | |
| TC-EAF-03 | Suite 3 | High | | | ⬜ | |
| TC-EAF-04 | Suite 3 | High | | | ⬜ | |
| TC-TPG-01 | Suite 4 | Critical | | | ⬜ | |
| TC-TPG-02 | Suite 4 | High | | | ⬜ | |
| TC-NFR-01 | Suite 5 | Critical | | | ⬜ | |
| TC-NFR-02 | Suite 5 | High | | | ⬜ | |

**Legend:** ⬜ Not run · ✅ Pass · ❌ Fail · ⚠ Blocked · ➡ Deferred

---

## Exit Criteria

### Minimum for story to close
- [ ] All Critical TCs passed (TC-SPR-01, TC-SPR-02, TC-SPR-03, TC-SPR-04, TC-FLX-01, TC-FLX-04, TC-FLX-05, TC-EAF-01, TC-EAF-02, TC-TPG-01, TC-NFR-01)
- [ ] Zero open Critical defects
- [ ] `grep -c "PAUSE" CLAUDE.md` → 0 (TC-NFR-01 mechanised gate)
- [ ] `grep -c "🔄 Revised" skills/icea-implement/SKILL.md` → ≥ 1 (TC-SPR-05 additive check)
- [ ] All original tracker statuses (Done/Pending/In Progress/Blocked/Bug) still detected in Step 3 (TC-SPR-05)
