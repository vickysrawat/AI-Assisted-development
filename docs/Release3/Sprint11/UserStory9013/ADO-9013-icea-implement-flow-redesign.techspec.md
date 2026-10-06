# Tech Spec — icea-implement Flow Redesign
ADO #9013 · Release 3 · Sprint 11
Status: DRAFT
Type: STORY · 8 SP

---

## AC Coverage Matrix

| AC | Description | File | Section |
|---|---|---|---|
| AC-F1 | BUDGET_OK auto-proceeds | `skills/icea-implement/SKILL.md` | Step 3d |
| AC-F2 | BUDGET_WARN: two-option stop, no FORCE | `skills/icea-implement/SKILL.md` | Step 3d |
| AC-F3 | BUDGET_STOP: two-option stop, no CONTINUE | `skills/icea-implement/SKILL.md` | Step 3d |
| AC-F4 | Pre-existing bug rows: hard block | `skills/icea-implement/SKILL.md` | Step 3 |
| AC-F5 | Fix loop: 3-cycle automated loop with audit | `skills/icea-implement/SKILL.md` | Step 7 |
| AC-F6 | Test command detection: hybrid order | `skills/icea-implement/SKILL.md` | Step 7 |
| AC-F7 | Gap signal at ceiling-hit (before diagnostic) | `skills/icea-implement/SKILL.md` | Step 7 |
| AC-F8 | Ceiling-hit diagnostic: 5-element format | `skills/icea-implement/SKILL.md` | Step 7 |
| AC-F9 | Option A guidance: full new 3-cycle loop | `skills/icea-implement/SKILL.md` | Step 7 |
| AC-F10 | REVISE from ceiling: set Revised status | `skills/icea-implement/SKILL.md` | Step 7 |
| AC-F11 | IMPLEMENT re-entry: Revised → reset ACs | `skills/icea-implement/SKILL.md` | Step 3 |
| AC-F12 | Epic auto-advance after Write Gate | `skills/icea-implement/SKILL.md` | Step 6 |
| AC-F13 | Epic start banner: count + APPROVE ALL + PAUSE | `skills/icea-implement/SKILL.md` | Step 3 |
| AC-F14 | PAUSE stops Epic auto-flow | `skills/icea-implement/SKILL.md` | Step 6 |
| AC-F15 | PAUSE reminder in each inter-story advance | `skills/icea-implement/SKILL.md` | Step 6 |
| AC-F16 | Test plan missing: auto-generate | `skills/icea-implement/SKILL.md` | Step 6a |
| AC-NF1 | Audit row format unchanged | `skills/icea-implement/SKILL.md` | Steps 4–7 |
| AC-NF2 | Gap signal exits 0 always | `skills/icea-implement/SKILL.md` | Step 7 |
| AC-NF3 | Revised status additive; no regression | `skills/icea-implement/SKILL.md` | Step 3 |
| AC-NF4 | PAUSE keyword: no CLAUDE.md §0a conflict | Static verification | Pre-impl |

---

## Files Changed

| File | Change type | Scope |
|---|---|---|
| `skills/icea-implement/SKILL.md` | Modify | Steps 3, 3d, 6, 6a, 7 — 8 targeted section replacements |

No new scripts. No new shared specs. All changes contained within the single SKILL.md.

---

## Pre-Implementation Verification

```bash
# AC-NF4: PAUSE conflict check — must be 0
grep -c "PAUSE" CLAUDE.md

# AC-NF3: Revised status not yet present — must be 0
grep -c "Revised" skills/icea-implement/SKILL.md
```

Both verified at spec time: 0 matches each.

---

## Change 1 — Step 3: Bug rows → hard block (AC-F4)

**Locate:** The open-bug check block in Step 3 (currently asks "Reply CONTINUE or STATUS").

**Replace the current ask block with:**
```
If there are open bugs — HARD STOP:
⛔ {bug_count} open bug(s) must be resolved before Story {story_n} can start.
   Tracker: {TRACKER} — rows marked 🐛 Bug
   Fix each bug and mark ✅ Done, then re-run:
     IMPLEMENT ADO-{ADO_ID}{if Epic: ' Story-{story_n}'}
```
No CONTINUE option. Skill does not proceed to Step 4.

---

## Change 2 — Step 3: Detect Revised status + reset ACs (AC-F11, AC-NF3)

**Locate:** The tracker type detection block (after Story/Epic type branch, before implementation plan display).

**Add after existing status detection (Pending/Done/Blocked/Bug handling):**
```
If tracker Story status is `🔄 Revised`:
  → Reset all ACs for this story: change `✅ Done` → `⏳ Pending` in tracker before
    proceeding. Display:
    🔄 Story {story_n} marked Revised — resetting all ACs to Pending for re-implementation.
       Prior code on disk will be overwritten at the Write Gate.
  → Continue to Step 4 (code generation) — do not skip any AC.
```

---

## Change 3 — Step 3: Epic start banner (AC-F12, AC-F13)

**Locate:** Immediately after the `📋 IMPLEMENTATION PLAN` display block, when Type = EPIC and no Story-N argument was given.

**Add:**
```
If EPIC invoked without Story-N argument — store EPIC_AUTO_FLOW = true in context.
If EPIC invoked with explicit Story-N — store EPIC_AUTO_FLOW = false.

When EPIC_AUTO_FLOW = true, display after the implementation plan:

📋 EPIC MODE — {total_stories} stories to implement.
   Batch-approve all Write Gate diffs:  APPROVE ALL ADO-{ADO_ID}
   Stop after any story:  reply PAUSE
   Resume command:        IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}
   (PAUSE reminder shown again before each story advance.)
```

---

## Change 4 — Step 3d: Remove no-op CONTINUE checkpoint on BUDGET_OK (AC-F1)

**Locate:** The block beginning "On `BUDGET_OK` or `BUDGET_SKIPPED` or `IMPLEMENT ADO-{ADO_ID} CONTINUE` or `IMPLEMENT ADO-{ADO_ID} FORCE`".

**Replace entire block with:**
```
On BUDGET_OK or BUDGET_SKIPPED:
> 📊 STEP BOUNDARY — Step 4: Code generation
> active-task.json written — safe to resume here after /compact or a new session.
> Proceeding to code generation for: {pending_ac_ids}
```
Remove `IMPLEMENT ADO-{ADO_ID} CONTINUE` and `IMPLEMENT ADO-{ADO_ID} FORCE` from trigger list entirely. Remove the "Do not proceed past this prompt" instruction.

---

## Change 5 — Step 3d: BUDGET_WARN / BUDGET_STOP → two-option stop (AC-F2, AC-F3)

**Locate:** The block beginning "⛔ BUDGET_WARN / BUDGET_STOP — HARD STOP".

**Replace entire block with:**
```
⛔ BUDGET_WARN / BUDGET_STOP — HARD STOP. No override.

Continuing now will produce truncated code (partial ACs, missing layers, false critic pass).
There is no FORCE or CONTINUE option — the context window is a hard limit.

  Recover (context still warm — recommended):
    1. Run /compact
    2. Re-run: IMPLEMENT ADO-{ADO_ID}
       active-task.json is written — resumes at Step 4, skips Done ACs.

  Start fresh (cold context, maximum room):
    1. Open a new Claude Code session
    2. Run: IMPLEMENT ADO-{ADO_ID}
```
Do NOT proceed to Step 4 under any BUDGET_WARN or BUDGET_STOP condition. No escape hatch.

---

## Change 6 — Step 6: Epic auto-advance + PAUSE (AC-F12, AC-F14, AC-F15)

**Locate:** The Step 6 confirm block — the `{If Epic and more stories remain:}` section.

**Replace with:**
```
If EPIC_AUTO_FLOW = true AND more stories remain:
  Display:
    ▶ Story {story_n} complete. Advancing to Story {next_story_n} of {total_stories}.
      Reply PAUSE to stop here. Resume: IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}

  If developer replies PAUSE:
    ⏸ Epic paused after Story {story_n}.
       Story {story_n}: ✅ Done
       Story {next_story_n}: ⏳ Pending
       Resume: IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}
    Stop. Do not start Story {next_story_n}.

  If no PAUSE reply:
    Proceed immediately to IMPLEMENT ADO-{ADO_ID} Story-{next_story_n} (Steps 3–7).

If EPIC_AUTO_FLOW = false (explicit Story-N targeted):
  Display:
    ✅ Story {story_n} complete.
       Next: IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}
  Stop. Do not auto-advance.
```

---

## Change 7 — Step 6a: Test plan missing → auto-generate (AC-F16)

**Locate:** The `SKIP_GATE = 0` hard-stop block in Step 6a (currently: "⛔ NO TEST PLAN").

**Replace with:**
```
If SKIP_GATE = 0 AND TEST_PLAN = NOT_FOUND:

  Display: ⚠ No test plan found for ADO #{ADO_ID} — generating now.

  Execute:
    Read $PLUGIN_DIR/skills/test-plan/SKILL.md and run:
      SAVE TEST ADO-{ADO_ID} --subagent

  On success:
    bash: rm -f ".claude/signals/test-plan-stale-ADO-{ADO_ID}.json"
    Display: ✅ Test plan generated — continuing.
    Continue to Step 7.

  On failure (non-zero exit or error from test-plan skill):
    ⛔ Test plan generation failed for ADO #{ADO_ID}.
       Run manually: SAVE TEST ADO-{ADO_ID}
       Then re-run: IMPLEMENT ADO-{ADO_ID} Story-{story_n}
    Append audit row and stop.
```

---

## Change 8 — Step 7: Replace advisory checkin with bounded fix loop (AC-F5 through AC-F10, AC-NF1, AC-NF2)

**Replace the entire Step 7 content with:**

```markdown
## Step 7 — Post-write gate: bounded fix loop

Ceiling: 3 cycles per loop invocation. Each invocation (initial or guided) gets a fresh 3-cycle budget.

**Step 7.0 — Detect test command (once, before loop):**
```bash
TEST_CMD=""
TEST_CMD=$(node -e "try{const s=JSON.parse(require('fs').readFileSync('.claude/dream-init-state.json','utf8'));process.stdout.write(s.test_command||'')}catch(e){}" 2>/dev/null)
if [ -z "$TEST_CMD" ]; then
  TEST_CMD=$(node -e "try{const p=JSON.parse(require('fs').readFileSync('package.json','utf8'));process.stdout.write(p.scripts&&p.scripts.test||'')}catch(e){}" 2>/dev/null)
fi
if [ -z "$TEST_CMD" ]; then
  echo "⚠ No test command found — fix loop runs checkin only."
fi
```

**Step 7.1 — Stage the written set:**
```bash
git add {file_1} {file_2} ... {test_files}   # exact Write-Gate set — never git add -A
```

**Step 7.2 — Fix loop (up to 3 cycles):**

For each cycle N (1, 2, 3):

1. Run checkin:
   Read $PLUGIN_DIR/skills/checkin/SKILL.md and execute against staged set.

2. Run test suite (if TEST_CMD non-empty):
   bash: $TEST_CMD 2>&1 — capture exit code and output.

3. If checkin ✅/⚠ AND (test suite passes OR TEST_CMD empty):
   → Loop exits clean. Append audit row and proceed to story summary.
   ```
   | {next_n} | {TS} | {actor} | build | checkin-pass | Story {story_n} | ADO #{ADO_ID} | {fix_count} fixes applied | checkin: ✅ |
   ```

4. If any failure:
   Display: `🔁 Fix cycle {N}: {category} at {file}:{line} — fixing`
   Apply targeted fix. Re-stage fixed file: `git add {file}`
   Append audit row:
   ```
   | {next_n} | {TS} | {actor} | build | build-issue | Story {story_n} | ADO #{ADO_ID} | {N} | {category}: {description} at {file}:{line} |
   ```
   Append tracker Follow-ups row (under correct story section):
   ```
   | {follow_up_count} | {issue at file:line — root cause one line} | {fix applied one line} | {file} |
   ```
   Continue to next cycle.

**Step 7.3 — On ceiling-hit (3 cycles, still failing):**

7.3a — Write gap signal (best-effort, before diagnostic):
```bash
PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
[ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/signal-write.cjs" \
  --type gap \
  --category "{most-specific: dependency-contract-missing|return-shape-unspecified|edge-case-missing|test-data-unspecified|mock-contract-missing}" \
  --ado-id "${ADO_ID}" \
  --detail "Fix loop ceiling: {specific unresolvable contract/value} after 3 cycles" \
  2>/dev/null || true
```
Exits 0 always. Never blocks diagnostic display.

7.3b — Append audit row:
```
| {next_n} | {TS} | {actor} | build | fix-loop-ceiling | Story {story_n} | ADO #{ADO_ID} | 3 | {category} at {file}:{line} — ceiling hit; gap signal written |
```

7.3c — Surface diagnostic:
```
⛔ FIX LOOP CEILING — 3 cycles completed, issue not resolved.

FAILING FINDING
  Category : {e.g. null reference / assertion mismatch / missing return}
  File     : {exact/path/to/file.ext}:{line_number}
  Error    : {verbatim error text — not paraphrased}

WHAT WAS TRIED
  Cycle 1: Changed {what} at {file}:{line} → still failed: {exact error after change}
  Cycle 2: Changed {what} at {file}:{line} → still failed: {exact error after change}
  Cycle 3: Changed {what} at {file}:{line} → still failed: {exact error after change}

ROOT CAUSE ASSESSMENT
  {1–2 sentences on the underlying blocker the fix loop cannot resolve alone}

YOUR OPTIONS
  A) Provide guidance — reply with the correct fix, e.g.:
       "The mock for IFoo.Bar should return: new FooDto { Id = 1, Name = 'test' }"
       A new 3-cycle loop will run with your guidance applied.

  B) Revise the ICEA — the spec is missing information needed to fix this:
       REVISE ADO-{ADO_ID}

  C) Halt — stop this story. Prior stories in this Epic are unaffected:
       HALT ADO-{ADO_ID}
```

**Step 7.4 — On developer reply:**

**Option A — Guidance provided:**
Start a new 3-cycle loop (fresh ceiling, cycle count resets to 1):
- Apply guidance to the identified file+line
- Run Step 7.2 loop with guidance as directive for each cycle
- Each cycle: display `🔁 Guided cycle {N}: ...`; append build-issue + Follow-ups rows as normal
- On clean pass: story summary + auto-advance (if EPIC_AUTO_FLOW = true)
- On second ceiling: surface new diagnostic with GUIDANCE APPLIED section:
  ```
  GUIDANCE APPLIED
    Your instruction: "{developer_guidance_text}"
    Applied at: {file}:{line}

  WHAT HAPPENED UNDER GUIDANCE
    Guided cycle 1: {what changed} → still failed: {exact error}
    Guided cycle 2: {what changed} → still failed: {exact error}
    Guided cycle 3: {what changed} → still failed: {exact error}

  UPDATED ASSESSMENT
    {updated 1–2 sentence root cause incorporating what was tried under guidance}

  YOUR OPTIONS
    A) Refine guidance — {specific gap that still cannot be resolved without more info}
    B) REVISE ADO-{ADO_ID}
    C) HALT ADO-{ADO_ID}
  ```

**Option B — REVISE ADO-{ADO_ID}:**
1. Set tracker Story status to `🔄 Revised`:
   Find `## Story {story_n}` section → change `**Status:** ✅ Done` or `**Status:** 🔄 In Progress` → `**Status:** 🔄 Revised`
2. Append audit row:
   ```
   | {next_n} | {TS} | {actor} | build | fix-loop-revise | Story {story_n} | ADO #{ADO_ID} | - | Tracker set to Revised; icea-revise initiated with diagnostic context |
   ```
3. Run REVISE ADO-{ADO_ID} — pass ceiling diagnostic (specific gap, what was tried) as input context.

**Option C — HALT ADO-{ADO_ID}:**
1. Append audit row:
   ```
   | {next_n} | {TS} | {actor} | build | fix-loop-halt | Story {story_n} | ADO #{ADO_ID} | - | Developer halted — Story {story_n} left on disk unresolved |
   ```
2. Display:
   ```
   Story {story_n} halted. Prior stories in this Epic are unaffected.
   To resume: IMPLEMENT ADO-{ADO_ID} Story-{story_n}
   ```
3. Stop. Do not auto-advance.

**Hard rules for Step 7:**
- NEVER skip the fix loop — not under APPROVE ALL, not under time pressure
- NEVER auto-commit — checkin suggests the git command; the developer runs it
- NEVER proceed to story summary while any failure remains (checkin ❌ or test suite ❌)
- ALWAYS write the gap signal before surfacing the diagnostic — never after
- ALWAYS show exact file+line in every fix cycle display and audit row
```

---

## Test Cases

All tests are manual scenario verification (SKILL.md-only story — no compiled test framework).

### Suite 1: Stop-Point Rationalization

**TC-SPR-01 (AC-F1)** — BUDGET_OK auto-proceeds
- Invoke IMPLEMENT on a story with ≤9 pending ACs; budget check returns BUDGET_OK
- Verify: No "Reply CONTINUE" in output; active-task.json present; code generation begins

**TC-SPR-02 (AC-F2)** — BUDGET_WARN: two-option stop, no FORCE
- Budget check returns BUDGET_WARN
- Verify: Output contains "truncated code"; contains "compact" option; contains "new session" option; does NOT contain "FORCE"; does NOT contain "CONTINUE"

**TC-SPR-03 (AC-F3)** — BUDGET_STOP: same two-option stop
- Budget check returns BUDGET_STOP
- Verify: Identical structure to TC-SPR-02; no FORCE; no CONTINUE

**TC-SPR-04 (AC-F4)** — Bug rows: hard block with path + command
- Tracker has 1 row marked `🐛 Bug`; invoke IMPLEMENT Story-N
- Verify: Output contains "⛔"; contains exact tracker file path; contains copy-paste re-run command; no code generation

**TC-SPR-05 (AC-NF3)** — Revised status additive
- `grep "✅ Done\|⏳ Pending\|🔄 In Progress\|🚫 Blocked\|🐛 Bug" skills/icea-implement/SKILL.md`
- Verify: All 5 statuses present in Step 3 detection; none removed

### Suite 2: Fix Loop

**TC-FLX-01 (AC-F5)** — Clean pass on cycle 2
- Step 7 with 1 checkin finding on cycle 1; cycle 2 passes
- Verify: `🔁 Fix cycle 1:` in output with file+line; `build-issue` audit row written; `checkin-pass | 1 fix applied` audit row written; tracker Follow-ups row written

**TC-FLX-02 (AC-F6)** — Test command: package.json fallback
- No `test_command` in dream-init-state.json; package.json has `scripts.test = "jest"`
- Verify: Fix loop uses `jest`; no error; no hard stop

**TC-FLX-03 (AC-F6)** — Test command: graceful skip
- Neither source has a test command
- Verify: Output contains "No test command found — fix loop runs checkin only"; loop proceeds

**TC-FLX-04 (AC-F7)** — Gap signal written before diagnostic
- Fix loop hits ceiling (3 cycles, still failing)
- Verify: `signal-write.cjs` call appears in SKILL.md BEFORE the diagnostic block; call includes `--type gap` and `--detail "Fix loop ceiling"`

**TC-FLX-05 (AC-F8)** — Ceiling diagnostic: all 5 elements
- Fix loop ceiling-hit
- Verify: Output contains all 5: (a) file+line, (b) verbatim error label, (c) per-cycle log with Cycle 1/2/3 headings, (d) ROOT CAUSE ASSESSMENT heading, (e) options A/B/C each with copy-paste command

**TC-FLX-06 (AC-F9)** — Option A: full 3-cycle guided loop
- Developer provides guidance after ceiling
- Verify: New loop runs up to 3 cycles (not 1); cycles labelled "Guided cycle N"; on second ceiling: GUIDANCE APPLIED heading present with developer's instruction text

**TC-FLX-07 (AC-F10, AC-F11)** — REVISE from ceiling: Revised status + re-entry
- Developer replies `REVISE ADO-9013` from ceiling; then re-runs IMPLEMENT Story-N
- Verify: Tracker Story status set to `🔄 Revised` before REVISE skill runs; on IMPLEMENT re-entry: all ACs reset to `⏳ Pending`; Write Gate shows diff

### Suite 3: Epic Auto-Flow

**TC-EAF-01 (AC-F13)** — Epic start banner: 3 required elements
- `IMPLEMENT ADO-9013` (no Story arg) on an Epic
- Verify: Banner shows story count; shows `APPROVE ALL ADO-9013`; shows PAUSE keyword with resume command

**TC-EAF-02 (AC-F12)** — Auto-advance: no IMPLEMENT command needed
- Story 1 Write Gate approved; no PAUSE reply
- Verify: Story 2 code generation begins automatically; "Advancing to Story 2" in output

**TC-EAF-03 (AC-F14, AC-F15)** — PAUSE stops auto-flow; reminder present in advance message
- Developer replies PAUSE after Story 1 Write Gate approval
- Verify: Story 2 not started; "Epic paused" in output; resume command shown; advance message contained PAUSE reminder (not just Epic start banner)

**TC-EAF-04 (AC-F12)** — Explicit Story-N: no auto-advance
- `IMPLEMENT ADO-9013 Story-1` (explicit story target)
- Verify: After Story 1 completes, no auto-advance; shows manual next command

### Suite 4: Test Plan Auto-Generate

**TC-TPG-01 (AC-F16)** — Auto-generate on missing test plan
- Step 6a; SKIP_GATE=0; no test plan file
- Verify: Output "generating now"; SAVE TEST --subagent invoked; on success: "generated — continuing"; no hard stop

**TC-TPG-02 (AC-F16)** — Hard-stop on generation failure
- SAVE TEST --subagent fails
- Verify: Hard stop; "generation failed" in output; manual run command shown

### Suite 5: Non-Functional

**TC-NFR-01 (AC-NF4)** — PAUSE keyword conflict check
- `grep -c "PAUSE" CLAUDE.md` → must return 0

**TC-NFR-02 (AC-NF1)** — Audit row format unchanged
- Review all new audit rows in implementation
- Verify: All rows use 8-column format; no new columns

---

## Definition of Done

- [ ] All 16 functional ACs and 4 non-functional ACs implemented in `skills/icea-implement/SKILL.md`
- [ ] All 19 test cases pass (manual scenario verification)
- [ ] `grep -c "PAUSE" CLAUDE.md` → 0
- [ ] `grep -c "Revised" skills/icea-implement/SKILL.md` before → 0; after → ≥1
- [ ] No regressions: existing Done/Pending/In-Progress/Blocked/Bug status handling verified
- [ ] Audit trail updated in `docs/Release3/Sprint11/UserStory9013/ADO-9013-icea-implement-flow-redesign.ai-audit.md`

---

## Note — Gate Bypass

This Tech Spec was saved with `TECH ADO-9013 FORCE` due to a false positive from
`context-budget-tech-write.cjs`. The hook detected `{ADO_ID}`, `{TS}`, `{actor}` etc.
as unfilled placeholders. These are intentional SKILL.md runtime tokens (variable
substitution syntax used by Claude at execution time) — not authoring gaps.
Follow-up: hook should skip tokens inside markdown code blocks.
Audit entry written in ai-audit.md.
