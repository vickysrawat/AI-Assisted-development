#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests the deployHooks() function exported from
//                      scripts/setup-init-bootstrap.cjs. Covers: P-U1 (clean target
//                      dir — both hooks copied + settings.json created with both
//                      entries), P-U2 (idempotency — no duplicate entries on second
//                      call), N-U4 (missing hook source file → exit 1), N-U5
//                      (malformed settings.json → exit 1).
//                      Also tests the SKILL.md Step 0 preflight bash script logic
//                      by running it via a shell with controlled fixture dirs:
//                      P-U3 (both hooks present + registered → passes),
//                      N-U1 (approval-capture.cjs absent → STOP),
//                      N-U2 (neither registered in settings.json → STOP ×2),
//                      N-U3 (migration-gate.cjs not in settings.json → STOP).
// What it touches:     Creates and destroys temp directories under os.tmpdir().
//                      No changes to the repo; no writes outside temp directories.
// What it does NOT do: No network calls. Does not push to any remote. Does not
//                      modify repo files. Does not run the full setup-init wizard.
// APIs / commands:     Node stdlib: fs, os, path, child_process.spawnSync + execSync.
//                      Imports: scripts/setup-init-bootstrap.cjs (require — only
//                      deployHooks() is used; main() is guarded by require.main).
//                      Shell: /bin/sh (for SKILL.md preflight tests, bash-compatible).
// How to verify:       node tests/setup-init-bootstrap.test.cjs -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PLUGIN_DIR    = path.join(__dirname, '..');
const HOOKS_SOURCE  = path.join(PLUGIN_DIR, '_project-deploy', 'hooks');

// Import deployHooks without triggering main() — require.main guard prevents it.
const { deployHooks } = require('../scripts/setup-init-bootstrap.cjs');

let passed = 0;
let failed = 0;

function assert(name, condition, extra) {
  if (condition) {
    process.stdout.write(`  ✓ ${name}\n`);
    passed++;
  } else {
    process.stdout.write(`  ✗ ${name}${extra ? ': ' + extra : ''}\n`);
    failed++;
  }
}

/** Creates an isolated temp directory for each test. */
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sib-test-'));
}

/** Creates a minimal plugin-dir stub with the two migration hook files. */
function stubPluginDir(baseDir, opts = {}) {
  const hooksDir = path.join(baseDir, '_project-deploy', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  if (!opts.skipApproval) {
    fs.writeFileSync(path.join(hooksDir, 'approval-capture.cjs'), '// stub\n');
  }
  if (!opts.skipGate) {
    fs.writeFileSync(path.join(hooksDir, 'migration-gate.cjs'), '// stub\n');
  }
  return baseDir;
}

// ─────────────────────────────────────────────────────────────────────────────
process.stdout.write('setup-init-bootstrap.cjs — deployHooks()\n');

// P-U1: Clean target dir — both hooks copied + settings.json created with both entries
{
  const targetDir = tmpDir();
  const pluginStub = stubPluginDir(tmpDir());

  // Capture stdout to verify the "deployed" and "registered" messages
  const origWrite = process.stdout.write.bind(process.stdout);
  const lines = [];
  process.stdout.write = (s) => { lines.push(s); return true; };

  deployHooks(targetDir, pluginStub);

  process.stdout.write = origWrite;

  const approvalDest = path.join(targetDir, '.claude', 'hooks', 'approval-capture.cjs');
  const gateDest     = path.join(targetDir, '.claude', 'hooks', 'migration-gate.cjs');
  assert('P-U1 approval-capture.cjs copied', fs.existsSync(approvalDest));
  assert('P-U1 migration-gate.cjs copied', fs.existsSync(gateDest));

  const settingsPath = path.join(targetDir, '.claude', 'settings.json');
  assert('P-U1 settings.json created', fs.existsSync(settingsPath));

  if (fs.existsSync(settingsPath)) {
    const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert('P-U1 UserPromptSubmit entry for approval-capture.cjs',
      Array.isArray(s.hooks && s.hooks.UserPromptSubmit) &&
      s.hooks.UserPromptSubmit.some(e => e.command && e.command.includes('approval-capture.cjs')));
    assert('P-U1 PreToolUse entry for migration-gate.cjs',
      Array.isArray(s.hooks && s.hooks.PreToolUse) &&
      s.hooks.PreToolUse.some(e => e.command && e.command.includes('migration-gate.cjs')));
  }

  const outputText = lines.join('');
  assert('P-U1 stdout mentions "deployed"', outputText.includes('deployed'));
  assert('P-U1 stdout mentions "registered"', outputText.includes('registered'));

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.rmSync(pluginStub, { recursive: true, force: true });
}

// P-U2: Idempotency — second call adds no duplicate entries; logs "already registered"
{
  const targetDir  = tmpDir();
  const pluginStub = stubPluginDir(tmpDir());

  // First call — populates settings.json
  const firstLines = [];
  const origWrite1 = process.stdout.write.bind(process.stdout);
  process.stdout.write = (s) => { firstLines.push(s); return true; };
  deployHooks(targetDir, pluginStub);
  process.stdout.write = origWrite1;

  // Second call — must be idempotent
  const secondLines = [];
  const origWrite2 = process.stdout.write.bind(process.stdout);
  process.stdout.write = (s) => { secondLines.push(s); return true; };
  deployHooks(targetDir, pluginStub);
  process.stdout.write = origWrite2;

  const settingsPath = path.join(targetDir, '.claude', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const upsCount = (s.hooks && s.hooks.UserPromptSubmit || []).filter(
      e => e.command && e.command.includes('approval-capture.cjs')).length;
    const ptuCount = (s.hooks && s.hooks.PreToolUse || []).filter(
      e => e.command && e.command.includes('migration-gate.cjs')).length;
    assert('P-U2 no duplicate UserPromptSubmit entries', upsCount === 1);
    assert('P-U2 no duplicate PreToolUse entries', ptuCount === 1);
  }

  const secondOutput = secondLines.join('');
  assert('P-U2 second call logs "already registered" for approval-capture',
    secondOutput.includes('already registered'));

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.rmSync(pluginStub, { recursive: true, force: true });
}

// N-U4: Hook source file missing in _project-deploy/hooks/ → process.exit(1) + stderr
{
  const targetDir  = tmpDir();
  // Plugin stub with approval-capture.cjs missing
  const pluginStub = stubPluginDir(tmpDir(), { skipApproval: true });

  const r = spawnSync('node', [
    '-e',
    `const { deployHooks } = require(${JSON.stringify(path.join(PLUGIN_DIR, 'scripts', 'setup-init-bootstrap.cjs'))});
     deployHooks(${JSON.stringify(targetDir)}, ${JSON.stringify(pluginStub)});`,
  ], { encoding: 'utf8' });

  assert('N-U4 missing hook source → exit 1', r.status === 1);
  assert('N-U4 stderr names the missing file', r.stderr.includes('approval-capture.cjs'));

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.rmSync(pluginStub, { recursive: true, force: true });
}

// N-U5: Malformed settings.json → process.exit(1) + stderr
{
  const targetDir  = tmpDir();
  const pluginStub = stubPluginDir(tmpDir());

  // Write malformed JSON to settings.json in the target
  const claudeDir = path.join(targetDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{ not valid json }');

  const r = spawnSync('node', [
    '-e',
    `const { deployHooks } = require(${JSON.stringify(path.join(PLUGIN_DIR, 'scripts', 'setup-init-bootstrap.cjs'))});
     deployHooks(${JSON.stringify(targetDir)}, ${JSON.stringify(pluginStub)});`,
  ], { encoding: 'utf8' });

  assert('N-U5 malformed settings.json → exit 1', r.status === 1);
  assert('N-U5 stderr includes parse error context',
    r.stderr.includes('parse') || r.stderr.includes('settings.json'));

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.rmSync(pluginStub, { recursive: true, force: true });
}

// ─────────────────────────────────────────────────────────────────────────────
process.stdout.write('\nSKILL.md Step 0 preflight — bash script logic\n');

// Build the preflight script as a standalone bash one-liner so tests don't need
// to parse SKILL.md — the logic mirrors the spec verbatim.
const PREFLIGHT_SH = `
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
`;

// Helper to run the preflight bash script in a controlled temp directory
function runPreflight(cwd) {
  const sh = process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\usr\\bin\\bash.exe'
    : '/bin/sh';
  return spawnSync(sh, ['-c', PREFLIGHT_SH], { encoding: 'utf8', cwd });
}

// Helper to create a temp dir with hook files + settings.json fixtures
function buildPreflightFixture(opts = {}) {
  const tmp = tmpDir();
  const claudeDir   = path.join(tmp, '.claude');
  const hooksDir    = path.join(claudeDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  if (opts.approvalFile !== false) {
    fs.writeFileSync(path.join(hooksDir, 'approval-capture.cjs'), '// stub\n');
  }
  if (opts.gateFile !== false) {
    fs.writeFileSync(path.join(hooksDir, 'migration-gate.cjs'), '// stub\n');
  }

  const settingsContent = JSON.stringify({
    hooks: {
      UserPromptSubmit: opts.approvalRegistered === false ? [] :
        [{ matcher: '.*', command: 'node .claude/hooks/approval-capture.cjs' }],
      PreToolUse: opts.gateRegistered === false ? [] :
        [{ matcher: '.*', command: 'node .claude/hooks/migration-gate.cjs' }],
    },
  }, null, 2);
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), settingsContent);

  return tmp;
}

// P-U3: Both hooks present + registered → preflight passes (exit 0)
{
  const tmp = buildPreflightFixture();
  const r = runPreflight(tmp);
  assert('P-U3 preflight passes: exit 0', r.status === 0);
  assert('P-U3 preflight passes: "Hook preflight passed." printed',
    r.stdout.includes('Hook preflight passed.'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// N-U1: approval-capture.cjs file absent → STOP + exit 1
{
  const tmp = buildPreflightFixture({ approvalFile: false });
  const r = runPreflight(tmp);
  assert('N-U1 missing approval-capture.cjs → exit 1', r.status === 1);
  assert('N-U1 STOP message mentions approval-capture.cjs',
    r.stdout.includes('STOP') && r.stdout.includes('approval-capture.cjs'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// N-U2: Both files present but neither registered in settings.json → STOP ×2 + exit 1
{
  const tmp = buildPreflightFixture({ approvalRegistered: false, gateRegistered: false });
  const r = runPreflight(tmp);
  assert('N-U2 neither registered → exit 1', r.status === 1);
  assert('N-U2 STOP for approval-capture registration',
    r.stdout.includes('approval-capture.cjs not registered'));
  assert('N-U2 STOP for migration-gate registration',
    r.stdout.includes('migration-gate.cjs not registered'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// N-U3: migration-gate.cjs not in settings.json (capture registered, gate not) → STOP + exit 1
{
  const tmp = buildPreflightFixture({ gateRegistered: false });
  const r = runPreflight(tmp);
  assert('N-U3 gate not registered → exit 1', r.status === 1);
  assert('N-U3 STOP mentions migration-gate.cjs',
    r.stdout.includes('migration-gate.cjs not registered'));
  // Approval hook is registered — should NOT produce a STOP for approval-capture
  assert('N-U3 no false STOP for approval-capture (it is registered)',
    !r.stdout.includes('approval-capture.cjs not registered'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ─────────────────────────────────────────────────────────────────────────────
const total = passed + failed;
process.stdout.write(`\n${total} tests: ${passed} passed · ${failed} failed\n`);
if (failed > 0) process.exit(1);
