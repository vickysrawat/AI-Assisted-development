# Feature Plan — icea-implement Flow Redesign
ADO #9013 · Release 3 · Sprint 11
Status: ✅ Approved

---

## Problem Statement

`icea-implement` stops and waits for developer input at 6+ points that are not genuinely blocking. On a 5-story Epic, this produces 15+ manual interactions (CONTINUE prompts, IMPLEMENT commands, APPROVE per story) for code the developer already approved end-to-end. The fix loop in Step 7 is advisory only — it does not run tests, does not auto-fix, and abandons on first failure. Budget overrides (FORCE / CONTINUE on BUDGET_WARN / BUDGET_STOP) offer a false safety valve: the context window is a hard limit, not a preference — offering an override guarantees truncated output. Pre-existing bugs are warned-and-skipped when they should block: implementing new code on top of known broken behaviour creates a false-green baseline. The net effect: developers lose trust in the Epic flow and run stories manually, one at a time.

## Story

As a developer, I want icea-implement to run autonomously through all stories of an Epic without manual intervention except at Write Gates and genuine blockers, so that I approve once and receive a complete, clean implementation summary with no false-green build states.

## Personas

- **Developer (SE):** writes one IMPLEMENT command per Epic · expects to see diffs and approve them · does not want to babysit prompts between stories · needs actionable diagnostics when something genuinely fails.

## Feature Priority (MoSCoW)

### Must Have

1. **BUDGET_OK auto-proceeds** — no CONTINUE prompt. The no-op step-boundary checkpoint in Step 3d is removed for the BUDGET_OK / BUDGET_SKIPPED path. `active-task.json` is still written before code generation for recovery. No developer reply needed when budget is fine.

2. **BUDGET_WARN / BUDGET_STOP: remove FORCE / CONTINUE escape hatch** — both stop cleanly with exactly two named recovery paths: "compact+resume (warm context)" vs "new session (cold context, maximum room)". No override path. Offering FORCE / CONTINUE produces truncated code that passes the critic (false PASS) and surfaces as a bug in testing, not at generation time.

3. **Pre-existing `🐛 Bug` rows in tracker: hard block** — surface exact tracker path and copy-paste command to fix bugs first. Do not warn-and-proceed. Implementing on a broken baseline produces false-green test results that mask real failures.

4. **In-run fix loop (Step 7): automated, visible, bounded** — replace advisory checkin with: checkin → test suite (if test command resolvable) → failure → fix → re-stage → repeat; ceiling 3 cycles; every fix logged to audit trail (exact file + line) + tracker Follow-ups row. Fix loop is visible in chat: `🔁 Fix cycle {N}: {finding} → {fix applied at file:line}`.

5. **Ceiling-hit diagnostic** — when 3 cycles fail: exact file+line, verbatim error text, per-cycle log of what was tried and the exact error after each attempt, root cause assessment (1–2 sentences), 3 options: A (developer guidance → new 3-cycle loop), B (REVISE ADO-{ID}), C (HALT ADO-{ID}).

6. **Option A (developer guidance) resets a full new 3-cycle bounded loop** — not 1 cycle. Developer provides guidance once; skill exhausts 3 cycles with it. If those also ceiling, a new diagnostic report is surfaced that includes a GUIDANCE APPLIED section showing what was tried under the developer's direction and why it still failed.

7. **Gap signal at ceiling-hit** — write via `signal-write.cjs` (`--type gap`, taxonomy category) immediately at ceiling-hit, before surfacing diagnostic — regardless of developer's subsequent choice (HALT still records the gap for Dream pattern learning).

8. **REVISE flow from ceiling-hit: `🔄 Revised` tracker status (new)** — on REVISE ADO-{ID} from a ceiling-hit, reset tracker Story status to `🔄 Revised`. IMPLEMENT re-entry detects `🔄 Revised` → resets all ACs to `⏳ Pending` → re-generates code → Write Gate shows diff. Without this status, IMPLEMENT sees `✅ Done` ACs and skips regeneration — broken code stays on disk.

9. **Epic auto-flow with PAUSE control** — `IMPLEMENT ADO-{ID}` (no Story argument) auto-advances from Story N to Story N+1 after each Write Gate approval. Epic start banner shows: (a) total story count, (b) `APPROVE ALL ADO-{ID}` option for batching Write Gate diffs, (c) `PAUSE` keyword with exact resume command (`IMPLEMENT ADO-{ID} Story-{N+1}`). PAUSE is shown at the start AND repeated in each inter-story advance message so it is always visible when the decision to stop is relevant.

10. **Test plan missing (full mode): auto-generate** — replace the `SKIP_GATE=0` HARD STOP in Step 6a with `SAVE TEST ADO-{ID} --subagent` (matching existing lightweight mode behaviour). Only hard-stop if auto-generation itself fails.

### Should Have

- Ceiling diagnostic includes revision history when Option A guidance was applied in a prior guided loop (GUIDANCE APPLIED section: developer's instruction text, where it was applied, exact error after each guided cycle, updated root cause assessment).

### Won't Have

- **Automatic commit after checkin pass** — Write Gate philosophy: Claude writes files, developer commits. Every commit is a deliberate human signature. Auto-committing conflates the "write to disk" and "commit to branch" decisions; also creates noisy branch history with per-cycle partial commits.
- **Test execution for stacks requiring infrastructure** (integration tests, E2E) — fix loop runs unit tests only (fast, no external dependencies). Infrastructure-dependent tests fail for environment reasons indistinguishable from code bugs; the loop cannot distinguish them and will burn cycles attempting code fixes for missing Docker containers. Integration / E2E tests belong in the developer's manual test phase after story closure.

---

## Release Plan

- **MVP:** Epic auto-flow + stop-point rationalization (Must Have items 1–3, 9, 10)
- **V1 (this story):** Full fix loop redesign + ceiling diagnostic + gap signal + REVISE recovery flow (Must Have items 4–8 + Should Have)

---

## Assumptions

| # | Assumption | Status |
|---|---|---|
| 1 | Test command resolvable via: (1) `dream-init-state.json` → `test_command` field, (2) `package.json` → `scripts.test`, (3) graceful skip with `⚠ No test command found — fix loop runs checkin only` | Resolved (hybrid detection — agreed) |
| 2 | `🔄 Revised` is not a defined tracker status today; existing tracker parsers (icea-implement Step 3) use string matching on status values — adding a new status must not break existing `✅ Done` / `⏳ Pending` detection | Unverified — confirm in Tech Spec |
| 3 | `PAUSE` keyword does not conflict with any existing keyword handler in CLAUDE.md §0a | Unverified — confirm in Tech Spec |

---

## Risks

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Fix loop ceiling of 3 too low for complex type errors in compiled stacks (.NET / Java) | M | M | Hard-coded 3 for this story; make configurable in a follow-up |
| 2 | Auto-advancing Epic may exhaust context on large Epics (10+ stories) | L | H | BUDGET check runs before each story's code gen — stops and offers compact+resume if context shrinks mid-Epic |

---

## Pre-mortem

"This shipped and the Epic auto-flow kept running past a failed story." Risk: if a story's Write Gate is approved and the next story starts before the developer verifies the prior story's output, a bug in Story 2 could be compounded by Story 3 code that depends on Story 2. Mitigation: the inter-story summary (printed before auto-advance) must be explicit — all ACs, all gaps, all fix-loop cycles — so the developer has full visibility before the next story's code generation begins.

---

## Dependencies

| # | Dependency | Blocking | Owner |
|---|---|---|---|
| 1 | `signal-write.cjs` — exists; gap signal taxonomy defined; no script changes needed | No | Plugin team |
| 2 | `context-budget-check.md` (shared spec) — verify BUDGET_OK / BUDGET_WARN / BUDGET_STOP signal contract for new stop logic | Yes | Plugin team |
| 3 | `checkin/SKILL.md` — verify exit contract (pass / warn / fail) maps cleanly to fix loop branch conditions | Yes | Plugin team |

---

## Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Test command detection strategy for fix loop | ✅ Resolved — hybrid: dream-init-state.json → package.json → graceful skip |
