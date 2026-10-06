# Tech Spec — Phase 1 Options + Design Gates
ADO #9007 · Story 2 of 4 · Release 3 · Sprint 10
Status: DRAFT

> Part of Epic: ADO-9007 Hook-Enforced Migration Gates
> See epic tech spec: temp/ADO-9007-tech.md
> Depends on: Story 1 (intake-verify.cjs Fix 1 + SKILL.md placeholder fix must land first)

---

## Overview

Story 2 is the MVP gate: it deploys `approval-capture.cjs` (UserPromptSubmit hook that records developer approvals) and `migration-gate.cjs` (PreToolUse hook that blocks gated writes until approvals exist), and registers both in the plugin's `.claude/settings.json` for plugin dev sessions. This story covers migration-gate rows 1 and 2 (options.md write gate; design-document write gate) and the full approval-capture grammar for APPROVE OPTIONS, PROCEED, and APPROVE DESIGN. The ADO normalization shared function is introduced here and shared with both hooks. The REQUIRED_SCRIPTS preflight test covers all scripts that SKILL.md invokes. On its own, Story 2 stops the WCF failure class: the model cannot write any design document without the developer first replying APPROVE OPTIONS.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F1 | options.md write blocked until intake + coupling re-validate | `_project-deploy/hooks/migration-gate.cjs` | ✅ Covered |
| AC-F2 | design docs blocked until options_approved in approvals file | `_project-deploy/hooks/migration-gate.cjs` | ✅ Covered |
| AC-F4 | model cannot write approval state via set-gate/Write/Edit/node -e | `_project-deploy/hooks/migration-gate.cjs` | ✅ Covered |
| AC-F5 | APPROVE OPTIONS refused when options.md absent or PARTIAL rows unacknowledged | `_project-deploy/hooks/approval-capture.cjs` | ✅ Covered |
| AC-F6 | APPROVE DESIGN refused when docs absent/target_root missing/UNVERIFIED rows | `_project-deploy/hooks/approval-capture.cjs` | ✅ Covered |
| AC-F7 | APPROVE DESIGN with PARTIAL rows: named-row acknowledgement via PROCEED | `_project-deploy/hooks/approval-capture.cjs` | ✅ Covered |
| AC-F9 | plain APPROVE ADO-NNN not captured by approval-capture.cjs | `_project-deploy/hooks/approval-capture.cjs` | ✅ Covered |
| AC-F11 | preflight test: REQUIRED_SCRIPTS covers all SKILL.md-invoked scripts | `tests/migration-gate.test.cjs` (preflight test section) | ✅ Covered |
| AC-NF1 | any hook error → exit 2, never 0 or 1 | `_project-deploy/hooks/approval-capture.cjs`, `_project-deploy/hooks/migration-gate.cjs` | ✅ Covered |
| AC-NF2 | enforcement does not depend on active-task.json | `_project-deploy/hooks/migration-gate.cjs` | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `_project-deploy/hooks/approval-capture.cjs` | AC-F5, AC-F6, AC-F7, AC-F9, AC-NF1 |
| `_project-deploy/hooks/migration-gate.cjs` | AC-F1, AC-F2, AC-F4, AC-F11, AC-NF1, AC-NF2 |
| `scripts/ado-normalize.cjs` (new shared utility) | Used by both hooks — no direct AC; prevents dual-ledger defect |
| `.claude/settings.json` (plugin) | Registers hooks for plugin dev sessions — prerequisite for all hook ACs |
| `tests/approval-capture.test.cjs` (new) | Validates AC-F5, AC-F6, AC-F7, AC-F9 |
| `tests/migration-gate.test.cjs` (new) | Validates AC-F1, AC-F2, AC-F4, AC-F11, AC-NF1, AC-NF2 |

**Coverage result:** All 10 ACs in Story 2 scope are covered. No orphaned files. ✅

---

## Files Changed

| File | Change Type | What changes |
|---|---|---|
| `_project-deploy/hooks/approval-capture.cjs` | new | UserPromptSubmit hook; parses stdin JSON; matches APPROVE OPTIONS, PROCEED, APPROVE DESIGN; validates preconditions; appends to `.claude/migration/ADO-NNN.approvals.json`; mirrors gate to ledger; writes `[DECISION]` to migration-log.md; returns `additionalContext` JSON; exits 0 always (never blocks prompt); exits 2 on uncaught error |
| `_project-deploy/hooks/migration-gate.cjs` | new | PreToolUse hook; parses stdin JSON; extracts tool type and file path / bash command; matches gated paths; checks approvals file; re-validates machine gates; exits 2 on gate failure or error; exits 0 if path not gated or approvals present |
| `scripts/ado-normalize.cjs` | new | Exports `normalizeAdo(input)` — converts `1234`, `ADO-1234`, `ado-1234` all to `ADO-1234`; used by both hooks and (in Story 3) cluster-merge.cjs |
| `.claude/settings.json` (plugin) | modify | Add `hooks.UserPromptSubmit` array entry pointing at `"$CLAUDE_PROJECT_DIR/_project-deploy/hooks/approval-capture.cjs"` and `hooks.PreToolUse` entry pointing at `migration-gate.cjs` |
| `tests/approval-capture.test.cjs` | new | Tests for approval-capture.cjs; uses stdin pipe to simulate hook invocations |
| `tests/migration-gate.test.cjs` | new | Tests for migration-gate.cjs including preflight test (REQUIRED_SCRIPTS) |

---

## Implementation Notes

### `scripts/ado-normalize.cjs` — ADO normalization

```javascript
'use strict';
// Normalizes any ADO identifier form to the canonical ADO-<id> used throughout
// the rewrite skill's folder structure and checkpoint files.
// Input forms: '1234', 'ADO-1234', 'ado-1234', 'ADO1234' → output: 'ADO-1234'
function normalizeAdo(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/^(?:ADO-?)?(\d+)$/i);
  if (!m) return null;
  return 'ADO-' + m[1];
}
module.exports = { normalizeAdo };
```

### `_project-deploy/hooks/approval-capture.cjs` — structure

```javascript
'use strict';
const fs = require('fs');
const path = require('path');
const { normalizeAdo } = require('../../scripts/ado-normalize.cjs');

// Reads the approval grammar from developer's prompt text.
// DECISION: use a closed switch on recognized prefixes rather than a regex that
// tries to match all forms simultaneously — closed switch is easier to extend and
// easier to test each branch independently.

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(Buffer.concat(chunks).toString()); }
  catch (e) { exit0(); }   // not valid JSON — pass through (non-hook invocation)

  const prompt = (payload.prompt || '').trim();
  try {
    handlePrompt(prompt);
  } catch (e) {
    // Hook errors never block the prompt — they just log and exit 0
    process.stderr.write('approval-capture: unexpected error: ' + e.message + '\n');
    exit0();
  }
});

function handlePrompt(prompt) {
  // Grammar: APPROVE OPTIONS ADO-NNN {A|B|C}
  //          PROCEED ADO-NNN {A|B|C}
  //          APPROVE DESIGN ADO-NNN
  //          APPROVE CLUSTERS ADO-NNN  (Story 3)
  //          SKIP CLUSTER ADO-NNN {N}  (Story 3)
  // Note: "APPROVE ADO-NNN" (no qualifier) is NOT captured — route to icea-approve

  if (/^APPROVE OPTIONS /i.test(prompt)) { handleApproveOptions(prompt); return; }
  if (/^PROCEED /i.test(prompt))          { handleProceed(prompt); return; }
  if (/^APPROVE DESIGN /i.test(prompt))   { handleApproveDesign(prompt); return; }
  // APPROVE CLUSTERS / SKIP CLUSTER handled in Story 3
  exit0(); // unrecognized or plain APPROVE ADO-NNN — pass through
}
```

**`handleApproveOptions(prompt)`:**
1. Parse ADO and option letter from prompt
2. Normalize ADO via `normalizeAdo()`
3. Check `docs/migrations/ADO-NNN/ADO-NNN-options.md` exists (refuse if absent)
4. Load integration inventory; check for unacknowledged PARTIAL rows — if any, refuse with list
5. Append `{ type: 'options_approved', ado: 'ADO-NNN', option: 'B', at: ISO8601, by: 'developer' }` to `.claude/migration/ADO-NNN.approvals.json`
6. Run `checkpoint-ledger.cjs set-gate --ado=ADO-NNN --skill=rewrite --gate=options_approved --verdict=PASS`
7. Append `[DECISION] options_approved: option B` to `docs/migrations/ADO-NNN/migration-log.md`
8. Return `additionalContext` JSON: `{ approval_recorded: 'options_approved', ado: 'ADO-NNN', option: 'B' }`

**`handleApproveDesign(prompt)`:**
1. Parse ADO
2. Check all 7 design documents exist under `docs/migrations/ADO-NNN/`
3. Check `target_root` in payload (via `checkpoint-ledger.cjs get --key=target_root`)
4. Load integration inventory; check for `unknown`/`UNVERIFIED` rows (refuse if any)
5. Check each PARTIAL row is in the acknowledged list from prior PROCEED records
6. Append `{ type: 'design_approved', ado: 'ADO-NNN', target_root: '...', at: ISO8601, by: 'developer' }` to approvals file
7. Mirror gate + append to migration-log.md + return `additionalContext`

### `_project-deploy/hooks/migration-gate.cjs` — structure

```javascript
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { normalizeAdo } = require('../../scripts/ado-normalize.cjs');

// DECISION: parse ADO from file path pattern, never from active-task.json.
// active-task.json is model-written; trusting it for enforcement decisions
// lets the model switch off the gate by writing a wrong ADO.

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    const toolName = payload.tool_name || '';
    const input    = payload.tool_input || {};

    if (toolName === 'Write' || toolName === 'Edit') {
      checkFilePath(input.file_path || '');
    } else if (toolName === 'Bash') {
      checkBashCommand(input.command || '');
    }
    process.exit(0);  // not gated or gate passed
  } catch (e) {
    block('hook error: ' + e.message);  // fail closed
  }
});

function block(msg) {
  process.stderr.write('migration-gate: ' + msg + '\n');
  process.exit(2);  // exit 2 = block; exit 1 = non-blocking in Claude Code
}
```

**Write/Edit gate table (rows 1 and 2 in this story):**

| Path pattern | ADO extraction | Requires |
|---|---|---|
| `docs/migrations/{ADO}/{ADO}-options.md` | from path segment | `intake-verify.cjs check-gate --skill=rewrite` exits 0 AND `coupling-resolution-validate.cjs` exits 0 |
| `docs/migrations/{ADO}/target-*.md` or `migration-feasibility.md` | from path segment | `options_approved` in `.claude/migration/ADO-NNN.approvals.json` |

**Bash block patterns (approvals file + gate writes):**
- Command contains `.approvals.json` under `.claude/migration/` → block
- Command contains `--gate=` with protected gate name (`options_approved`, `design_approved`, `cluster_*`) → block
- Command contains `.checkpoint.json` AND a protected gate name → block (catches `node -e` JSON writes)
- Read-only commands (grep, cat, echo) that only mention a gate name in string context → allow

**NF2 test (active-task.json independence):**
Test: write a `.claude/active-task.json` with `{"ado": "ADO-WRONG"}`, then call the hook with a payload targeting `docs/migrations/ADO-1234/target-component-architecture.md` — confirm the hook enforces against ADO-1234 (from path), not ADO-WRONG (from active-task.json).

### `.claude/settings.json` additions

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/_project-deploy/hooks/approval-capture.cjs\""
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/_project-deploy/hooks/migration-gate.cjs\""
          }
        ]
      }
    ]
  }
}
```

---

## Auth & Security

No external auth. The hooks operate on local files only. Key security property: the approvals file is written only by `approval-capture.cjs` (from developer prompts); the migration gate blocks any other write to it.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `approval-capture.cjs` receives non-JSON stdin | Exits 0 (pass-through) — not a hook invocation |
| `approval-capture.cjs` cannot find checkpoint for the ADO | Returns `additionalContext` reason; exits 0 (never blocks prompt) |
| `migration-gate.cjs` encounters uncaught error | Exits 2 (fail-closed); error message surfaced in stderr |
| `migration-gate.cjs` checks approvals file that does not exist | Treats as "no approvals" — blocks write with message explaining required reply |
| APPROVE OPTIONS with unacknowledged PARTIAL rows | Refused; reason includes list of unacknowledged rows |
| APPROVE DESIGN with UNVERIFIED integration rows | Refused; reason includes list of UNVERIFIED rows |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| ADO normalization shared utility + approval-capture.cjs (3 approval forms) | New hook + utility | 2 |
| migration-gate.cjs (Write/Edit rows 1-2, Bash blocks, NF1/NF2) | New hook | 2 |
| settings.json entries + test files (approval-capture + migration-gate + preflight) | Config + 2 test files | 1 |
| **Total** | | **5** |

**Total SP: 5**
**Type: STORY** — MVP slice; shippable on its own (stops WCF failure class).

---

## Definition of Done

**Implementation**
- [ ] `_project-deploy/hooks/approval-capture.cjs` created; handles APPROVE OPTIONS, PROCEED, APPROVE DESIGN; never blocks prompt (exits 0 always except on uncaught error)
- [ ] `_project-deploy/hooks/migration-gate.cjs` created; handles Write/Edit rows 1-2 and Bash blocks; exits 2 on gate fail or error
- [ ] `scripts/ado-normalize.cjs` created; exports `normalizeAdo()`
- [ ] `.claude/settings.json` updated with UserPromptSubmit and PreToolUse hook entries
- [ ] No `console.log` in hooks; error messages via `process.stderr.write`
- [ ] No hardcoded ADO identifiers; always use `normalizeAdo()`

**Quality**
- [ ] `node tests/approval-capture.test.cjs` passes — all 5 approval forms + precondition failures
- [ ] `node tests/migration-gate.test.cjs` passes — all 3 gate rows + Bash patterns + fault injection + active-task.json test
- [ ] Preflight test passes: REQUIRED_SCRIPTS block covers `coupling-resolution-validate.cjs`, `research-cache.cjs`, `coupling-boundary-validate.cjs`, and `cluster-merge.cjs` (added in same change per plan rule)

**Review readiness**
- [ ] PR title: `[ADO-9007] Story 2 — Phase 1 Options + Design gates`
- [ ] PR description maps each changed file to its ACs

### Reviewer Checklist

- [ ] `approval-capture.cjs` exits 0 in ALL non-error paths — including when it refuses an approval (refusal = additionalContext reason, not exit 2)
- [ ] `migration-gate.cjs` exits 2 on hook crash (check try/catch in the `end` handler)
- [ ] Bash block pattern for `node -e` checkpoint write is narrow enough — does not block `grep options_approved skills/rewrite/SKILL.md`
- [ ] ADO normalization is called on every identifier parsed from prompts and paths — no inline parsing
- [ ] APPROVE DESIGN check validates all 7 design documents by name, not by count
- [ ] PARTIAL row acknowledgement is by row name, not by boolean

---

## Open Questions

None for Story 2. (D-1 spike is Story 1 scope.)

---

## Rollback

Rollback Story 2: remove `UserPromptSubmit` and `PreToolUse` entries from `.claude/settings.json`. Delete `_project-deploy/hooks/approval-capture.cjs`, `_project-deploy/hooks/migration-gate.cjs`, `scripts/ado-normalize.cjs`. Approvals files (`.claude/migration/*.approvals.json`) created during testing can be left or deleted manually.

---

## Handover

### QA Team
Run `node tests/approval-capture.test.cjs` and `node tests/migration-gate.test.cjs`. Manual smoke test: (1) attempt to write a design doc without approvals — confirm exit 2 and correct error message; (2) reply APPROVE OPTIONS with missing options.md — confirm refusal; (3) reply APPROVE OPTIONS with valid preconditions — confirm approval recorded in approvals file.

### DevOps / Platform Team
New `.claude/settings.json` entries for the plugin's own development sessions. No server-side changes.

### Future Developer
To add a new approval form: add a case to `handlePrompt()` switch in `approval-capture.cjs`. To add a new gated path: add a row to `checkFilePath()` in `migration-gate.cjs`. Both patterns follow the existing switch tables.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `approval-capture.cjs` APPROVE OPTIONS | Valid prompt; options.md exists; no PARTIAL rows | Approval appended to approvals.json; exits 0; additionalContext confirms | AC-F5 |
| P-U2 | `approval-capture.cjs` PROCEED with PARTIAL row | Valid prompt; options.md exists; acknowledged row name matches | options_approved + acknowledged rows appended; exits 0 | AC-F7 |
| P-U3 | `approval-capture.cjs` APPROVE DESIGN | All 7 docs exist; target_root set; no UNVERIFIED; all PARTIAL acknowledged | design_approved + target_root appended; exits 0 | AC-F6, AC-F7 |
| P-U4 | `migration-gate.cjs` Write to ungated path | Write to `docs/Release3/Sprint10/...` (non-migration) | Exit 0 | AC-F2 |
| P-U5 | `migration-gate.cjs` Write to design doc with options_approved | options_approved in approvals file; write to target-component-architecture.md | Exit 0 | AC-F2 |
| P-U6 | `migration-gate.cjs` Bash with unrelated command | `git status` | Exit 0 | AC-F4 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `approval-capture.cjs` APPROVE OPTIONS | options.md does not exist | Exits 0; additionalContext contains refusal reason | AC-F5 |
| N-U2 | `approval-capture.cjs` APPROVE DESIGN | UNVERIFIED integration row present | Exits 0; additionalContext lists UNVERIFIED rows | AC-F6 |
| N-U3 | `approval-capture.cjs` APPROVE DESIGN | PARTIAL row after PROCEED not re-acknowledged | Exits 0; additionalContext lists unacknowledged rows | AC-F7 |
| N-U4 | `approval-capture.cjs` plain `APPROVE ADO-1234` | Prompt is `APPROVE ADO-1234` (no qualifier) | Exits 0; no approval recorded; icea-approve receives it | AC-F9 |
| N-U5 | `migration-gate.cjs` Write design doc (no options_approved) | No options_approved in approvals file | Exits 2; error message contains required reply | AC-F2 |
| N-U6 | `migration-gate.cjs` Bash `set-gate --gate=options_approved` | Command contains `--gate=options_approved` | Exits 2; blocked | AC-F4 |
| N-U7 | `migration-gate.cjs` Bash `node -e "...options_approved..." .checkpoint.json` | Pattern matches checkpoint + gate name | Exits 2; blocked | AC-F4 |
| N-U8 | `migration-gate.cjs` Write `.approvals.json` | Write to `.claude/migration/ADO-1234.approvals.json` | Exits 2; blocked | AC-F4 |
| N-U9 | `migration-gate.cjs` uncaught error | Simulate exception in hook startup | Exits 2 (fail-closed) | AC-NF1 |
| N-U10 | `migration-gate.cjs` with active-task.json deleted | Delete `.claude/active-task.json`; trigger gate check | Hook behavior unchanged | AC-NF2 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | APPROVE OPTIONS → design doc write unblocked | (1) No approvals file; (2) Write design doc → blocked; (3) Reply APPROVE OPTIONS; (4) Write design doc again | Step 2 exits 2; Step 4 exits 0 | AC-F2 |
| INT-2 | Preflight REQUIRED_SCRIPTS | Scan SKILL.md for `$PLUGIN_DIR/scripts/*.cjs` invocations; compare to REQUIRED_SCRIPTS block | All invoked scripts listed in REQUIRED_SCRIPTS | AC-F11 |

---

### Revision Log
2026-10-02 — Story 2 tech spec drafted (approval-capture.cjs + migration-gate.cjs rows 1-2 + ADO normalization + preflight test)
