# ICEA — icea-implement Flow Redesign
ADO #9013 · Release 3 · Sprint 11
Status: ✅ Complete
Type: STORY

---

## Intent

Redesign `skills/icea-implement/SKILL.md` to eliminate non-blocking stop points, enforce genuine blockers correctly, and enable fully autonomous Epic implementation. A developer who issues `IMPLEMENT ADO-{ID}` on an approved Epic should receive a complete, clean implementation summary with no false-green build states and no manual prompts between stories — except at Write Gates and genuinely blocking failures.

---

## Context

### Primary artifact

`skills/icea-implement/SKILL.md` — Layer 0 Skill instruction file read by Claude at runtime. No compilation. Changes take effect immediately on the next IMPLEMENT invocation.

### Stack

Node.js plugin (CommonJS). No database. No network calls within this skill. Skill orchestrates: `scripts/signal-write.cjs`, `scripts/intake-verify.cjs`, shared specs (`context-budget-check.md`, `goal-loop-spec.md`, `checkin/SKILL.md`).

### Current stop-point audit (6 non-blocking stops identified)

| Step | Condition | Current behaviour | Problem |
|---|---|---|---|
| Step 3 | Open `🐛 Bug` rows | Warn + ask CONTINUE | Should block — implementing on broken baseline creates false-green results |
| Step 3d | BUDGET_OK | Stops for CONTINUE reply | BUDGET_OK means no problem — stop is noise |
| Step 3d | BUDGET_WARN / BUDGET_STOP | Offers FORCE / CONTINUE | False safety valve — output WILL be truncated; offering override guarantees false PASS from critic |
| Step 6 (Epic) | Story N done | Waits for next IMPLEMENT command | Should auto-advance; developer already approved the ICEA end-to-end |
| Step 6a | Test plan missing (full mode) | HARD STOP | Lightweight mode already auto-generates — parity gap |

### New tracker status

`🔄 Revised` — added to the tracker status vocabulary. Signals: "code on disk from a prior implementation run; ICEA was revised after a ceiling-hit; re-implementation required." Without this status, IMPLEMENT sees `✅ Done` ACs and skips re-generation, leaving broken code on disk permanently.

### Dependency contracts verified

| Dependency | Exit contract | Notes |
|---|---|---|
| `signal-write.cjs` | Always exits 0 — never blocks | Gap signal taxonomy: 5 categories |
| `checkin/SKILL.md` | ✅ pass / ⚠ warn / ❌ fail | ❌ triggers fix cycle in Step 7 |
| `context-budget-check.md` | `BUDGET_OK` / `BUDGET_WARN` / `BUDGET_STOP` | Three output tokens — no other values |

### Test command detection order (agreed hybrid)

1. `dream-init-state.json` → `test_command` field (written by setup-init for known stacks)
2. `package.json` → `scripts.test`
3. Graceful skip — `⚠ No test command found — fix loop runs checkin only`

### Assumptions to verify in Tech Spec

| # | Assumption |
|---|---|
| 1 | `PAUSE` keyword does not conflict with any CLAUDE.md §0a keyword handler |
| 2 | Existing tracker status parsers use string matching — adding `🔄 Revised` is additive and does not break `✅ Done` / `⏳ Pending` detection |

---

## Examples

**Example 1 — BUDGET_OK: no prompt, proceeds directly**
- Input: `IMPLEMENT ADO-9013`, 4 pending ACs, budget check returns `BUDGET_OK`
- Expected: `active-task.json` written; skill proceeds directly to Step 4 code generation with no developer reply required. No "Reply CONTINUE" prompt displayed.

**Example 2 — BUDGET_WARN: hard stop, two named paths**
- Input: `IMPLEMENT ADO-9013`, 14 pending ACs, budget check returns `BUDGET_WARN`
- Expected: Skill stops. Message shows: "⛔ CONTEXT BUDGET — continuing will produce truncated code." Two options shown with copy-paste commands: (A) `/compact` then re-run IMPLEMENT, (B) new session then re-run IMPLEMENT. No FORCE option. No CONTINUE option.

**Example 3 — BUDGET_STOP: same two-option stop**
- Input: `IMPLEMENT ADO-9013`, budget check returns `BUDGET_STOP`
- Expected: Identical structure to Example 2. No FORCE. No CONTINUE.

**Example 4 — Pre-existing bug blocks story**
- Input: `IMPLEMENT ADO-9013 Story-2`, tracker has 1 row marked `🐛 Bug`
- Expected: Skill stops. Message: "⛔ 1 open bug must be resolved before Story 2 can start. Tracker: docs/Release3/Sprint11/UserStory9013/ADO-9013-*.tracker.md — row marked 🐛 Bug. Fix and mark ✅ Done, then re-run: `IMPLEMENT ADO-9013 Story-2`"

**Example 5 — Fix loop: clean pass on cycle 2**
- Input: Story code written to disk; Step 7 checkin finds 1 finding (null guard missing at `Services/UserService.cs:47`)
- Expected: `🔁 Fix cycle 1: null guard missing → added at Services/UserService.cs:47`. Re-staged. Cycle 2: checkin pass. Audit row appended: `checkin-pass | 1 fix applied`. Tracker Follow-ups row: `null guard missing at :47 | added null guard | Services/UserService.cs`. Story summary printed. Epic auto-advance begins.

**Example 6 — Fix loop ceiling-hit**
- Input: Story code written to disk; Step 7 fix loop runs 3 cycles, still failing with `NullReferenceException at UserService.cs:62`
- Expected: Gap signal written via `signal-write.cjs --type gap --category dependency-contract-missing` (best-effort). Diagnostic surfaces: file+line (`UserService.cs:62`), verbatim error (`NullReferenceException: Object reference not set`), per-cycle log (Cycle 1: added null check → still `NullReferenceException at :62`; Cycle 2: moved check to constructor → still fails; Cycle 3: extracted interface → still fails), root cause (1–2 sentences), options A/B/C with copy-paste commands.

**Example 7 — Option A: developer guidance resets 3-cycle loop**
- Input: Developer replies "The mock for `IUserRepository.GetById` should return `UserDto { Id = 1, Name = 'test' }`"
- Expected: New 3-cycle loop starts with guidance applied. `🔁 Guided cycle 1: applied mock return → IUserRepository.GetById returns UserDto`. On clean pass: story summary printed, auto-advance. On second ceiling: new diagnostic with `GUIDANCE APPLIED` section: developer's instruction text, where applied (`UserServiceTests.cs:34`), exact error after each guided cycle, updated root cause assessment.

**Example 8 — Option B: REVISE from ceiling-hit**
- Input: Developer replies `REVISE ADO-9013` from ceiling diagnostic
- Expected: Gap signal already written (from ceiling-hit, not re-written). `icea-revise` runs with diagnostic as input context. Tracker Story status set to `🔄 Revised`. After REVISE + re-run `IMPLEMENT ADO-9013 Story-N`: skill detects `🔄 Revised` → resets all ACs to `⏳ Pending` → re-generates code → Write Gate shows diff.

**Example 9 — Epic auto-flow: 3 stories, no interruption**
- Input: `IMPLEMENT ADO-9013` (no Story argument), Epic with 3 stories, `APPROVE ALL ADO-9013` issued
- Expected: Epic start banner shows: "3 stories to implement. Batch approvals: `APPROVE ALL ADO-9013`. Stop anytime: reply `PAUSE` (resume: `IMPLEMENT ADO-9013 Story-{N+1}`)." Story 1 code generated → diff shown → approved → story summary → "Advancing to Story 2 of 3. Reply `PAUSE` to stop. Resume: `IMPLEMENT ADO-9013 Story-2`" → Story 2 ... → Story 3 complete → Epic summary.

**Example 10 — PAUSE interrupts Epic auto-flow**
- Input: After Story 1 Write Gate approved, developer replies `PAUSE`
- Expected: Skill stops after Story 1. Tracker: Story 1 `✅ Done`, Story 2 `⏳ Pending`. Message: "Epic paused after Story 1. Resume: `IMPLEMENT ADO-9013 Story-2`"

**Example 11 — Test plan missing (full mode): auto-generate**
- Input: Step 6a, `SKIP_GATE=0`, no test plan file found
- Expected: Message: "⚠ No test plan found for ADO #9013 — generating now." Runs `SAVE TEST ADO-9013 --subagent`. Confirms: "✅ Test plan generated." Continues to Step 7. Hard-stops only if generation itself fails.

---

## Acceptance Criteria

### Functional

**AC-F1** — BUDGET_OK path in Step 3d auto-proceeds without any developer reply. `active-task.json` is written before code generation. No "Reply CONTINUE" prompt is displayed when budget is fine.

**AC-F2** — BUDGET_WARN path in Step 3d stops cleanly. Message contains: (a) the phrase "continuing will produce truncated code", (b) exactly two named recovery options with copy-paste commands — compact+resume and new session. No FORCE option present. No CONTINUE option present.

**AC-F3** — BUDGET_STOP path in Step 3d stops cleanly with the same two-option message as AC-F2. No FORCE. No CONTINUE.

**AC-F4** — Pre-existing `🐛 Bug` rows in the tracker trigger a hard block before Step 4 code generation. Message includes: (a) exact tracker file path, (b) copy-paste re-run command. Skill does not proceed to Step 4.

**AC-F5** — Step 7 fix loop runs up to 3 cycles automatically: checkin → test suite (if test command resolvable per AC-F6) → fix → re-stage → repeat. Every cycle appends one audit row (exact file+line, what changed) and one tracker Follow-ups row.

**AC-F6** — Test command detection follows the hybrid order: (1) `dream-init-state.json` → `test_command`; (2) `package.json` → `scripts.test`; (3) graceful skip with `⚠ No test command found — fix loop runs checkin only`. No hard-stop if test command is absent.

**AC-F7** — Fix loop ceiling-hit (3 cycles, still failing) writes a gap signal via `signal-write.cjs` before surfacing the diagnostic. Signal uses the most specific gap category from the taxonomy. Signal write is best-effort — exits 0 and never blocks the diagnostic display.

**AC-F8** — Ceiling-hit diagnostic contains all five elements: (a) exact file path + line number, (b) verbatim error text (not paraphrased), (c) per-cycle log showing what changed and the exact error after each attempt, (d) root cause assessment (1–2 sentences), (e) three options A/B/C each with a copy-paste command.

**AC-F9** — Option A (developer guidance) starts a new full 3-cycle bounded loop — not 1 cycle. If the guided loop also ceilings, the new diagnostic includes a `GUIDANCE APPLIED` section: developer's instruction text, where it was applied (file+line), exact errors from each guided cycle, updated root cause assessment.

**AC-F10** — On `REVISE ADO-{ID}` from a ceiling-hit: tracker Story status is set to `🔄 Revised`. `icea-revise` receives the ceiling diagnostic as input context (specific gap identified).

**AC-F11** — IMPLEMENT re-entry with a `🔄 Revised` story: all ACs for that story reset to `⏳ Pending`; code re-generated; Write Gate shows diff. Skill does not skip ACs because they were previously marked `✅ Done`.

**AC-F12** — `IMPLEMENT ADO-{ID}` (no Story argument) on an Epic auto-advances from Story N to Story N+1 after each Write Gate approval without requiring another IMPLEMENT command.

**AC-F13** — Epic start banner shows all three elements: (a) total story count, (b) `APPROVE ALL ADO-{ID}` tip, (c) `PAUSE` keyword with exact resume command `IMPLEMENT ADO-{ID} Story-{N+1}`.

**AC-F14** — `PAUSE` keyword stops Epic auto-flow after the current story completes cleanly. Tracker reflects current state. Resume command shown in confirmation message.

**AC-F15** — PAUSE reminder (with exact resume command) is printed in each inter-story advance message — not only at the Epic start banner.

**AC-F16** — Test plan missing in full mode (Step 6a, `SKIP_GATE=0`): auto-generates via `SAVE TEST ADO-{ID} --subagent`. Proceeds after successful generation. Hard-stops only if generation itself fails.

### Non-Functional

**AC-NF1** — All audit rows written by this skill continue to use the existing `ai-audit.md` table format (8-column). No new columns or schema changes.

**AC-NF2** — Gap signal written at ceiling-hit exits 0 regardless of outcome — never blocks the diagnostic display or any subsequent developer action.

**AC-NF3** — No regressions to existing `✅ Done` / `⏳ Pending` / `🔄 In Progress` / `🚫 Blocked` / `🐛 Bug` tracker status detection. `🔄 Revised` is additive.

**AC-NF4** — `PAUSE` keyword does not conflict with any CLAUDE.md §0a keyword handler. (Verified in Tech Spec before implementation.)
