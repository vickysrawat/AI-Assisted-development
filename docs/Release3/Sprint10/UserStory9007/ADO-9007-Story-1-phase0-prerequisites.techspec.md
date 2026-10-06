# Tech Spec — Phase 0 Prerequisites
ADO #9007 · Story 1 of 4 · Release 3 · Sprint 10
Status: DRAFT

> Part of Epic: ADO-9007 Hook-Enforced Migration Gates
> See epic tech spec: temp/ADO-9007-tech.md

---

## Overview

Story 1 fixes the prerequisite defects that prevent the rewrite skill from reaching its own mandatory gates, and establishes the data that later hook stories depend on. The changes are: (1) `intake-verify.cjs check-gate` reads `stage_gates.intake_context` tolerantly — flat string or `{verdict, …}` object — and requires `--skill` with no fallback; (2) `skills/rewrite/SKILL.md` uses a single `ADO` placeholder throughout, records `target_root` in Step 0, writes the `design_judge` gate in Step 2.5, and fixes non-standard verdict strings; (3) `tests/intake-verify.test.cjs` is updated to cover both paths. The Phase 0 subagent hook spike is also in this story's scope — it determines whether PreToolUse fires in subagents and records the result for D-1 resolution before Story 3 is designed. This story ships no user-visible gate behavior by itself; it is a shippable prerequisite slice that unblocks Phase 1 (Story 2) from working correctly.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F10 | design_judge gate written after Step 2.5 judge pass | `skills/rewrite/SKILL.md` | ✅ Covered |
| Enables AC-F1 | intake-verify tolerant reader (unblocks migration-gate re-validation) | `scripts/intake-verify.cjs`, `tests/intake-verify.test.cjs` | ✅ Covered |
| Enables AC-F2 | `{ADO_ID}` → `{ADO}` placeholder (unblocks hook path matching) | `skills/rewrite/SKILL.md` | ✅ Covered |
| Enables AC-F3 | `target_root` recorded in Step 0 (unblocks design_approved path match) | `skills/rewrite/SKILL.md` | ✅ Covered |

> Note: Story 1 delivers enabling fixes. The full AC-F1, AC-F2, AC-F3 enforcement gates are implemented in Stories 2 and 3. Story 1's changes are prerequisites without which those gates cannot function. No AC-F-N is fully satisfied by Story 1 alone except AC-F10.

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `scripts/intake-verify.cjs` | Enables AC-F1 (tolerant reader + --skill required; migration-gate.cjs depends on exit codes) |
| `tests/intake-verify.test.cjs` | Validates enables-AC-F1 changes |
| `skills/rewrite/SKILL.md` | AC-F10 (design_judge write); enables AC-F2 (placeholder fix); enables AC-F3 (target_root) |

**Coverage result:** AC-F10 fully covered. All enabling fixes present. Full AC-F1/F2/F3 enforcement requires Stories 2 and 3. ✅

---

## Files Changed

| File | Change Type | What changes |
|---|---|---|
| `scripts/intake-verify.cjs` | modify | Add `gateVerdict(val)` helper (~line 35): if val is object, return `val.verdict`; else return val. Replace `(led.stage_gates || {}).intake_context !== 'PASS'` with `gateVerdict((led.stage_gates || {}).intake_context) !== 'PASS'`. Replace `const skill = led.skill \|\| 'upgrade'` with `const skill = arg('skill')` — no fallback; if absent, print reason `skill-required` and exit 10 |
| `tests/intake-verify.test.cjs` | modify | Add `--skill=rewrite` to all existing `check-gate` invocations (currently they rely on the fallback). Add two new test cases: (a) `check-gate` without `--skill` → exit 10 + reason includes `skill-required`; (b) ledger created via `checkpoint-ledger.cjs set-gate --artifact-path` (object-form gate) → `check-gate --skill=rewrite` exits 0 |
| `skills/rewrite/SKILL.md` | modify | (a) Replace all `{ADO_ID}` occurrences with `{ADO}` (known locations: lines 386, 388-392, 1104-1105, 1107-1109, 1396-1397, 1592, 1599-1600, 1845-1846, 1848, 1916-1918 — verify by grep); (b) After checkpoint init in Step 0: add `$PLUGIN_DIR/scripts/checkpoint-ledger.cjs set-payload --ado={ADO} --skill=rewrite --key=target_root --value="{developer-provided target folder}"`; (c) In Step 2.5, after judge subagent returns verdict: add `$PLUGIN_DIR/scripts/checkpoint-ledger.cjs set-gate --ado={ADO} --skill=rewrite --gate=design_judge --verdict={PASS\|REVISE\|BLOCK}`; (d) Replace `--verdict=ACKNOWLEDGED` with `--verdict=PASS` and `--verdict=BLOCK_OVERRIDE` with `--verdict=PASS` wherever they appear in Step 2.5 gate writes |

---

## Implementation Notes

### `gateVerdict` helper in `intake-verify.cjs`

Add after the existing helper functions (approx. line 34):

```javascript
// Reads a gate value tolerantly — checkpoint-ledger.cjs set-gate writes a flat
// string 'PASS' when no --artifact-path is given, but an object
// { verdict: 'PASS', at: '...', artifact_path: '...' } when --artifact-path is
// supplied. Both forms must evaluate to the same result.
function gateVerdict(val) {
  if (!val) return null;
  if (typeof val === 'object') return val.verdict || null;
  return val;
}
```

Replace the existing string comparison (approx. line 256):
```javascript
// Before:
(led.stage_gates || {}).intake_context !== 'PASS'
// After:
gateVerdict((led.stage_gates || {}).intake_context) !== 'PASS'
```

Replace the skill fallback (approx. line 261):
```javascript
// Before:
const skill = led.skill || 'upgrade';
// After:
const skill = arg('skill');
if (!skill) {
  // DECISION: exit 10 (not exit 1) to distinguish "missing argument" from "gate check
  // failed" (exit 1). The hook that calls this script can act on the exit code specifically.
  printResult({ check: 'check-gate', verdict: 'ERROR', reason: 'skill-required',
    message: '--skill is required on check-gate; no fallback' });
  process.exit(10);
}
```

### SKILL.md `target_root` recording (Step 0)

Add after the `init` call block in Step 0 (after the checkpoint is initialized):

```bash
# Record the developer-provided target folder so the migration gate can validate cluster writes.
# The developer specifies the target folder at the start of the session.
$PLUGIN_DIR/scripts/checkpoint-ledger.cjs set-payload \
  --ado={ADO} --skill=rewrite \
  --key=target_root --value="{target_folder_path}"
```

### SKILL.md `design_judge` gate write (Step 2.5)

After the design judge subagent returns in Step 2.5, add before the existing `check-gate` call:

```bash
# Record the judge verdict so check-gate can evaluate it.
# Without this write, check-gate always returns "absent" and APPROVE DESIGN is unreachable.
JUDGE_VERDICT="PASS"  # set from subagent return: PASS | REVISE | BLOCK
$PLUGIN_DIR/scripts/checkpoint-ledger.cjs set-gate \
  --ado={ADO} --skill=rewrite \
  --gate=design_judge --verdict=$JUDGE_VERDICT
```

If the developer acknowledges a REVISE verdict, record:
```bash
$PLUGIN_DIR/scripts/checkpoint-ledger.cjs set-gate \
  --ado={ADO} --skill=rewrite \
  --gate=design_judge_acknowledged --verdict=PASS
```

### Phase 0 Subagent Hook Spike

Run before Story 2 is implemented. Steps:
1. Register a minimal PreToolUse hook in the plugin's `.claude/settings.json` that logs its invocation to a temp file
2. Invoke a subagent (Agent tool) that makes a Write or Edit tool call
3. Check whether the temp file received a log entry
4. Record result: "PreToolUse fires in subagents: YES/NO" in `docs/plans/migrationSkill/rewrite-hook-gates-v1.md` under the Verification items table
5. Update D-1 with the selected option before Story 3 starts

---

## Auth & Security

No auth changes. The `intake-verify.cjs` changes affect a local CLI tool only — no network calls, no secrets. The `--skill` requirement closes a bypass where a null-skill ledger could pass validation without naming a skill.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `check-gate` called without `--skill` | Exits 10; prints `reason: skill-required` with message "`--skill` is required on `check-gate`; no fallback" |
| `intake_context` gate is an object (from `set-gate --artifact-path`) | `gateVerdict()` extracts `verdict` field; exits 0 if `'PASS'`, exits 1 if anything else |
| `intake_context` gate is absent from ledger | `gateVerdict(undefined)` returns `null`; treated as non-PASS; exits 1 |
| `{ADO_ID}` placeholder missed in SKILL.md grep | Pre-commit test (Story 2 preflight test) catches it; fails CI if `{ADO_ID}` appears in SKILL.md |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| intake-verify.cjs Fix 1 (tolerant reader) | Add `gateVerdict()` helper, update one comparison | 1 |
| intake-verify.cjs `--skill` required (no fallback) | Replace fallback with exit 10, update all test calls | 1 |
| SKILL.md: placeholder fix + target_root + design_judge + verdict strings | Grep-and-replace + 3 targeted additions | 2 |
| Phase 0 spike: confirm PreToolUse fires in subagents | Manual spike run + result documented | 1 |
| **Total** | | **5** |

**Total SP: 5**
**Type: STORY** — single implementation scope; shippable as prerequisite slice.

---

## Definition of Done

**Implementation**
- [ ] `gateVerdict()` helper added to `intake-verify.cjs`; all callers of `intake_context` gate use it
- [ ] `--skill` required on `check-gate`; exit 10 if absent; `led.skill || 'upgrade'` fallback removed
- [ ] All `{ADO_ID}` occurrences replaced with `{ADO}` in `skills/rewrite/SKILL.md` — verified by `grep -n '{ADO_ID}' skills/rewrite/SKILL.md` returning no output
- [ ] `set-payload --key=target_root` block added in SKILL.md Step 0 after checkpoint init
- [ ] `set-gate --gate=design_judge` block added in SKILL.md Step 2.5 after judge returns
- [ ] `--verdict=ACKNOWLEDGED` and `--verdict=BLOCK_OVERRIDE` replaced with `--verdict=PASS` in SKILL.md
- [ ] No hardcoded secrets or connection strings
- [ ] No `console.log` in `intake-verify.cjs` production paths

**Quality**
- [ ] `node tests/intake-verify.test.cjs` passes — all existing tests still pass with `--skill=rewrite` added
- [ ] New test: missing `--skill` → exit 10 passes
- [ ] New test: CLI-created object-form ledger → `check-gate --skill=rewrite` exits 0 passes
- [ ] Phase 0 spike result documented in `docs/plans/migrationSkill/rewrite-hook-gates-v1.md`

**Review readiness**
- [ ] PR title: `[ADO-9007] Story 1 — Phase 0 Prerequisites`
- [ ] PR description maps each changed file to its AC role

### Reviewer Checklist

- [ ] `gateVerdict()` handles null, undefined, string, and object correctly — check edge cases
- [ ] Exit 10 is distinct from exit 1 (gate failed) and exit 0 (pass) — verify exit code table in intake-verify.cjs header comment
- [ ] `set-payload --key=target_root` placement in SKILL.md is after `init` (checkpoint must exist before set-payload)
- [ ] `set-gate --gate=design_judge` placement is after the judge subagent returns its verdict, not before
- [ ] Phase 0 spike result is recorded (D-1 cannot remain open when Story 3 starts)

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| ❓[1] | Phase 0 spike: does PreToolUse fire in subagents? Result determines D-1 and Story 3 design. | Developer | Before Story 3 starts | Open |

---

## Rollback

Rollback Story 1: revert `intake-verify.cjs` (restore string comparison + `led.skill || 'upgrade'` fallback), revert SKILL.md changes, revert test additions. No approvals files, no settings.json entries in this story.

---

## Handover

### QA Team
Run `node tests/intake-verify.test.cjs` to verify. Manual test: call `check-gate` without `--skill` — confirm exit 10 and message. Call `check-gate` with a CLI-created object-form ledger — confirm exit 0.

### DevOps / Platform Team
No infrastructure changes. Local Node.js script changes only.

### Future Developer
`gateVerdict()` is the pattern for tolerant gate reading. Apply it to any other `stage_gates` comparisons found in F3 sweep (see `docs/plans/migrationSkill/rewrite-hook-gates-v1.md` §F3 "Strict stage_gates readers").

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `intake-verify.cjs check-gate --skill=rewrite` | Ledger with `intake_context: 'PASS'` (flat string) | Exit 0 | Enables AC-F1 |
| P-U2 | `intake-verify.cjs check-gate --skill=rewrite` | Ledger with `intake_context: { verdict: 'PASS', at: '...', artifact_path: '...' }` (object form, CLI-created) | Exit 0 | Enables AC-F1 |
| P-U3 | `skills/rewrite/SKILL.md` placeholder grep | `grep '{ADO_ID}' skills/rewrite/SKILL.md` | No output (exit 1 from grep = no match) | Enables AC-F2 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `intake-verify.cjs check-gate` (no `--skill`) | Any ledger | Exit 10; output contains `skill-required` | Enables AC-F1 |
| N-U2 | `intake-verify.cjs check-gate --skill=rewrite` | Ledger with `intake_context: { verdict: 'REVISE', ... }` | Exit 1 (gate failed) | Enables AC-F1 |
| N-U3 | `intake-verify.cjs check-gate --skill=rewrite` | Ledger with no `intake_context` key | Exit 1 (gate absent) | Enables AC-F1 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Full rewrite Step 1.5 → Step 2 sequence | Run `set-gate --artifact-path` in Step 1.5; then run `check-gate --skill=rewrite` in Step 2 entry | check-gate exits 0; Step 2 proceeds | AC-F10 (enables design_judge path) |

> AC-NF1/NF2/NF3 verification: NF1 (fault injection) and NF2 (active-task.json) are in Story 2. NF3 (WCF rerun) is in Story 4.

---

### Revision Log
2026-10-02 — Story 1 tech spec drafted (intake-verify Fix 1, --skill required, SKILL.md prerequisite fixes, Phase 0 spike)
