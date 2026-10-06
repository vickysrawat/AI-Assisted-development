# Tech Spec — Phase 3: Skill + Rollout
ADO #9007 · Story 4 of 4 · Release 3 · Sprint 10
Status: DRAFT

> Part of Epic: ADO-9007 Hook-Enforced Migration Gates
> See epic tech spec: temp/ADO-9007-tech.md

---

## Overview

Story 4 closes the epic by aligning `skills/rewrite/SKILL.md` with the hook system and deploying the hooks to target projects via `setup-init-bootstrap.cjs`. Three changes ship: (1) SKILL.md Step 0 gains a hook preflight that stops the skill if either hook is not deployed and registered, and gains the approval grammar (APPROVE OPTIONS, APPROVE DESIGN) so the model instructs the developer correctly; (2) `scripts/setup-init-bootstrap.cjs` gains logic to copy `approval-capture.cjs` and `migration-gate.cjs` from `_project-deploy/hooks/` to the target project's `.claude/hooks/` and register them in `settings.json`; (3) AC-NF3 is verified by running a WCF to .NET 10 migration replay under the fully-deployed hook suite and recording the gate outcomes. This is the V1 completion story — all 15 ACs become verifiable after Story 4 ships.

---

## AC Coverage Matrix

### AC to File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F11 | SKILL.md Step 0 preflight stops skill if hooks not deployed + registered | `skills/rewrite/SKILL.md` | Covered |
| AC-F12 | `setup-init-bootstrap.cjs` deploys both hooks to target project + registers in settings.json | `scripts/setup-init-bootstrap.cjs` | Covered |
| AC-NF3 | WCF migration rerun completes with zero model-written human gates; design revision count recorded | `docs/plans/migrationSkill/rewrite-hook-gates-v1.md` (verification record) | Covered (verification) |

> Note: AC-F11 is referenced in Story 2's AC Coverage Matrix as "AC-F11 (settings.json entries shipped)" — that covers the plugin's own `.claude/settings.json`. Story 4's AC-F11 covers the target project side: SKILL.md preflight verifying that the target project has the hooks registered. These are complementary, not duplicate.

### File to AC mapping

| File | ACs satisfied |
|---|---|
| `skills/rewrite/SKILL.md` | AC-F11 (Step 0 hook preflight) |
| `scripts/setup-init-bootstrap.cjs` | AC-F12 (hook deployment + settings.json registration) |
| `docs/plans/migrationSkill/rewrite-hook-gates-v1.md` | AC-NF3 (WCF rerun verification record) |

**Coverage result:** AC-F11, AC-F12 fully covered. AC-NF3 verified by rerun record. ✅

---

## Files Changed

| File | Change Type | What changes |
|---|---|---|
| `skills/rewrite/SKILL.md` | modify | (a) Step 0: add hook preflight block — check both hooks deployed and registered; STOP if missing; (b) Step 1.5: update approval grammar; (c) Step 2.5: update approval grammar; (d) Step 3+ : add cluster approval grammar |
| `scripts/setup-init-bootstrap.cjs` | modify | Add `deployHooks()` function — copies both hooks to target `.claude/hooks/`; adds `UserPromptSubmit` and `PreToolUse` entries to target `settings.json` if not already present (idempotent) |
| `docs/plans/migrationSkill/rewrite-hook-gates-v1.md` | modify | Add Verification section with WCF rerun date, gate outcomes table, zero-self-approval confirmation, design revision count comparison |

---

## Implementation Notes

### SKILL.md Step 0 hook preflight block

Add immediately after the `target_root` payload write added in Story 1 (Step 0):

```bash
# Hook preflight — verify both hooks deployed + registered before proceeding.
# Without these hooks the skill cannot enforce human-gate requirements.

APPROVAL_HOOK=".claude/hooks/approval-capture.cjs"
GATE_HOOK=".claude/hooks/migration-gate.cjs"
SETTINGS=".claude/settings.json"
HOOK_OK=true

if [ ! -f "$APPROVAL_HOOK" ]; then
  echo "STOP: approval-capture.cjs not found. Run setup-init or setup-sync."
  HOOK_OK=false
fi
if [ ! -f "$GATE_HOOK" ]; then
  echo "STOP: migration-gate.cjs not found. Run setup-init or setup-sync."
  HOOK_OK=false
fi
if ! grep -q "approval-capture" "$SETTINGS" 2>/dev/null; then
  echo "STOP: approval-capture.cjs not registered in settings.json."
  HOOK_OK=false
fi
if ! grep -q "migration-gate" "$SETTINGS" 2>/dev/null; then
  echo "STOP: migration-gate.cjs not registered in settings.json."
  HOOK_OK=false
fi

if [ "$HOOK_OK" != "true" ]; then
  echo "Rewrite skill halted. Deploy and register both hooks before starting."
  exit 1
fi
echo "Hook preflight passed."
```

DECISION: Check both file existence AND settings.json registration
- File only: file could exist but not be registered (hook inactive)
- Settings only: entry could be registered but file deleted (hook crashes at runtime)
- Both: guarantees hooks are both deployable and active — chosen.

### SKILL.md approval grammar updates

Step 1.5 — replace existing selection prose:
```
Reply: APPROVE OPTIONS ADO-NNN A   (replace A with chosen option letter)
The session will not advance until APPROVE OPTIONS is received.
```

Step 2.5 — replace existing acknowledgement prose:
```
Reply: APPROVE DESIGN ADO-NNN
The session will not advance to Step 3 until APPROVE DESIGN is received.
```

Step 3+ — after cluster-merge.cjs prepare completes:
```
Reply: APPROVE CLUSTERS ADO-NNN   (approves all prepared clusters)
       SKIP CLUSTER ADO-NNN N     (skips cluster N)
```

### setup-init-bootstrap.cjs — deployHooks function

```javascript
/**
 * Deploys migration gate hooks to the target project.
 *
 * Actions in order:
 * 1. Creates targetDir/.claude/hooks/ if absent
 * 2. Copies approval-capture.cjs and migration-gate.cjs from pluginDir/_project-deploy/hooks/
 * 3. Reads (or creates) targetDir/.claude/settings.json
 * 4. Adds UserPromptSubmit entry for approval-capture.cjs if not already present
 * 5. Adds PreToolUse entry for migration-gate.cjs if not already present
 * 6. Writes settings.json back to disk
 *
 * Idempotent: running twice produces identical output.
 */
function deployHooks(targetDir, pluginDir) {
  const hooksSource = path.join(pluginDir, '_project-deploy', 'hooks');
  const hooksDest   = path.join(targetDir, '.claude', 'hooks');
  const settingsPath = path.join(targetDir, '.claude', 'settings.json');

  // Copy hook files
  const hookFiles = ['approval-capture.cjs', 'migration-gate.cjs'];
  if (!fs.existsSync(hooksDest)) fs.mkdirSync(hooksDest, { recursive: true });
  for (const file of hookFiles) {
    const src = path.join(hooksSource, file);
    if (!fs.existsSync(src)) {
      process.stderr.write(`setup-init: hook source not found: ${src}\n`);
      process.exit(1);
    }
    fs.copyFileSync(src, path.join(hooksDest, file));
    process.stdout.write(`  deployed: .claude/hooks/${file}\n`);
  }

  // Load settings.json — DECISION: JSON parse+merge (not string replacement) to avoid whitespace fragility
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
    catch (e) { process.stderr.write(`setup-init: cannot parse ${settingsPath}: ${e.message}\n`); process.exit(1); }
  }
  if (!settings.hooks) settings.hooks = {};

  // Register UserPromptSubmit
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
  if (!settings.hooks.UserPromptSubmit.some(e => e.command && e.command.includes('approval-capture.cjs'))) {
    settings.hooks.UserPromptSubmit.push({ matcher: '.*', command: 'node .claude/hooks/approval-capture.cjs' });
    process.stdout.write('  registered: approval-capture.cjs in UserPromptSubmit\n');
  } else {
    process.stdout.write('  already registered: approval-capture.cjs (skipped)\n');
  }

  // Register PreToolUse
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
  if (!settings.hooks.PreToolUse.some(e => e.command && e.command.includes('migration-gate.cjs'))) {
    settings.hooks.PreToolUse.push({ matcher: '.*', command: 'node .claude/hooks/migration-gate.cjs' });
    process.stdout.write('  registered: migration-gate.cjs in PreToolUse\n');
  } else {
    process.stdout.write('  already registered: migration-gate.cjs (skipped)\n');
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  process.stdout.write('  settings.json updated.\n');
}
```

---

## Auth & Security

No auth changes. `setup-init-bootstrap.cjs` reads hook source files from the plugin's own `_project-deploy/hooks/` and writes to the target project directory — both are local filesystem operations. The JSON parse + merge approach prevents settings.json corruption from string manipulation errors. Hook files are copied verbatim with no templating.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Hook source file not found in `_project-deploy/hooks/` | `setup-init-bootstrap.cjs` exits 1 with message naming the missing file |
| `settings.json` malformed JSON | `setup-init-bootstrap.cjs` exits 1 with parse error message |
| `settings.json` already has hook entries | Idempotent: skips adding duplicate; logs "already registered (skipped)" |
| SKILL.md Step 0 preflight: hook file absent | Prints STOP with file path + setup instruction; exits 1 |
| SKILL.md Step 0 preflight: hook present but not registered | Prints STOP with settings path + setup instruction; exits 1 |
| WCF rerun: model attempts self-approval phrase | migration-gate.cjs blocks with exit 2; recorded in rerun gate-outcomes log |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| SKILL.md Step 0 preflight (4-condition bash block) | File check + settings.json grep + STOP logic | 1 |
| SKILL.md approval grammar updates (3 steps) | Replace approval prose in Steps 1.5, 2.5, 3+ | 1 |
| setup-init-bootstrap.cjs deployHooks function | Copy + JSON merge + idempotency guards | 2 |
| AC-NF3 verification rerun | Manual WCF rerun + gate outcome recording | 1 |
| **Total** | | **5** |

**Total SP: 5**
**Type: STORY** — final V1 completion; WCF rerun verifies all 15 ACs.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `setup-init-bootstrap.cjs deployHooks` | Clean target dir (no hooks, no settings.json) | Both hook files copied; settings.json created with both hook entries; exits 0 | AC-F12 |
| P-U2 | `setup-init-bootstrap.cjs deployHooks` (idempotency) | Target already has hooks + settings.json entries | No duplicate entries added; exits 0; log shows "already registered (skipped)" | AC-F12 |
| P-U3 | SKILL.md Step 0 preflight | Both hooks present + registered in settings.json | Preflight passes; "Hook preflight passed." printed; skill continues | AC-F11 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | SKILL.md Step 0 preflight | `approval-capture.cjs` file absent | STOP message printed; skill exits 1 | AC-F11 |
| N-U2 | SKILL.md Step 0 preflight | Both files present but neither registered in settings.json | STOP for both missing registrations; exits 1 | AC-F11 |
| N-U3 | SKILL.md Step 0 preflight | `migration-gate.cjs` not in settings.json (capture registered, gate not) | STOP for migration-gate registration; exits 1 | AC-F11 |
| N-U4 | `setup-init-bootstrap.cjs deployHooks` | Hook source file missing from `_project-deploy/hooks/` | Exits 1; message names the missing source file | AC-F12 |
| N-U5 | `setup-init-bootstrap.cjs deployHooks` | settings.json contains malformed JSON | Exits 1; message includes parse error | AC-F12 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Full setup-init then rewrite skill | Run setup-init on test target; start rewrite skill Step 0 | Hook preflight passes; skill proceeds past Step 0 | AC-F11 + AC-F12 |
| INT-2 | AC-NF3 WCF rerun | Run full WCF migration under deployed hooks | Zero model-written self-approvals; gate blocks recorded; design revision count captured | AC-NF3 |

---

## Definition of Done

**Implementation**
- [ ] SKILL.md Step 0: preflight block checks both hooks (file existence + settings.json registration); STOP on any missing
- [ ] SKILL.md Steps 1.5, 2.5, 3+: approval grammar updated to named APPROVE forms
- [ ] `setup-init-bootstrap.cjs` copies both hooks to target `.claude/hooks/` and registers in settings.json
- [ ] `deployHooks()` is idempotent — no duplicate entries on re-run
- [ ] No hardcoded paths in `deployHooks()` — all resolved from `pluginDir` parameter
- [ ] No `console.log` in production paths

**Quality**
- [ ] `setup-init-bootstrap.cjs` idempotency verified: run twice → settings.json unchanged on second run
- [ ] SKILL.md Step 0 preflight verified manually: delete `.claude/hooks/approval-capture.cjs` on test target → STOP fires
- [ ] AC-NF3: WCF rerun results recorded in rewrite-hook-gates-v1.md (zero self-approvals confirmed)
- [ ] Epic DoD satisfied: all 4 story PRs merged, `npm test` passes, WCF rerun recorded

**Review readiness**
- [ ] PR title: `[ADO-9007] Story 4 — Phase 3 Skill + Rollout`
- [ ] PR description maps each changed file to its AC role

### Reviewer Checklist

- [ ] SKILL.md preflight checks both file existence AND settings.json registration — not just one condition
- [ ] SKILL.md preflight placed after `target_root` payload write (Story 1) — checkpoint must exist before preflight
- [ ] `deployHooks()` uses JSON parse + merge (not string replacement) for settings.json — verify no raw string manipulation
- [ ] Hook deployment idempotency: `hasCaptureEntry` and `hasGateEntry` guards prevent duplicate entries
- [ ] AC-NF3 rerun is a genuine rerun (not a replayed log) — verify rerun date is after Story 4 merge date
- [ ] Epic Definition of Done verified: all 15 ACs traceable through the four AC Coverage Matrix tables

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| Q-1 | D-1 result from Phase 0 spike (Story 1) must be recorded before Story 3 implementation starts. Story 4 is not blocked but the WCF rerun (AC-NF3) should run after D-1 is resolved so both enforcement paths are active during rerun. | Developer | Before AC-NF3 rerun | Depends on Story 1 |

---

## Rollback

Rollback Story 4:
1. Revert SKILL.md: remove Step 0 preflight block; restore pre-Story-4 approval prose in Steps 1.5, 2.5, 3+
2. Revert `setup-init-bootstrap.cjs`: remove `deployHooks()` function and call site
3. On already-deployed target projects: remove both hooks from `.claude/hooks/`; remove the two hook entries from `.claude/settings.json`

Hook source files in `_project-deploy/hooks/` (from Stories 2–3) are unaffected by Story 4 rollback.

---

## Handover

### QA Team
Run `setup-init` on a clean test target project → verify `.claude/hooks/approval-capture.cjs` and `migration-gate.cjs` appear and appear in `settings.json` under both hook types. Run `setup-init` a second time → confirm no duplicate hook entries are added.

### DevOps / Platform Team
`setup-init-bootstrap.cjs` now writes two additional files to `targetDir/.claude/hooks/`. No infrastructure impact — all changes are local filesystem only.

### Future Developer
To add a new hook to the deployment suite: (1) add source to `_project-deploy/hooks/`; (2) add filename to the `hookFiles` array in `deployHooks()`; (3) add registration entry to `settings.hooks.UserPromptSubmit` or `settings.hooks.PreToolUse`; (4) add a SKILL.md Step 0 preflight check for the new hook.

---

### Revision Log
2026-10-02 — Story 4 tech spec drafted (SKILL.md hook preflight, approval grammar, setup-init-bootstrap.cjs deployHooks, AC-NF3 verification procedure)
