#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests _project-deploy/hooks/migration-gate.cjs by piping tool-invocation
//                      JSON payloads to the hook via stdin and asserting exit codes.
//                      Covers: Write/Edit gate rows 1 and 2, Bash block patterns A/B/C,
//                      fault injection (invalid JSON → exit 2), active-task.json independence
//                      (AC-NF2), and the REQUIRED_SCRIPTS preflight (INT-2).
// What it touches:     Creates and destroys temp directories under os.tmpdir(). Reads
//                      skills/rewrite/SKILL.md to extract script references for INT-2.
//                      No changes to the repo; no writes outside temp directories.
// What it does NOT do: No network calls. No git operations. Does not modify repo files.
// APIs / commands:     Node stdlib: fs, os, path, child_process.spawnSync.
//                      Invokes: node _project-deploy/hooks/migration-gate.cjs (via spawnSync)
// How to verify:       node tests/migration-gate.test.cjs -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PLUGIN_DIR = path.join(__dirname, '..');
const HOOK       = path.join(PLUGIN_DIR, '_project-deploy', 'hooks', 'migration-gate.cjs');
const SKILL_MD   = path.join(PLUGIN_DIR, 'skills', 'rewrite', 'SKILL.md');

// All scripts referenced in skills/rewrite/SKILL.md via $PLUGIN_DIR/scripts/.
// cluster-merge.cjs is a Story 3 forward reference — tracked here per plan rule so it
// appears in the coverage list before the file is created.
const REQUIRED_SCRIPTS = new Set([
  'checkpoint-ledger.cjs',
  'coupling-boundary-validate.cjs',
  'coupling-resolution-validate.cjs',
  'graph-derive-documents.cjs',
  'intake-verify.cjs',
  'migration-source-detect.cjs',
  'research-cache.cjs',
  'resolve-migration-roots.cjs',
  'rewrite-bal.cjs',
  'rewrite-decompose.cjs',
  'strategy-resolve.cjs',
  'cluster-merge.cjs', // Story 3 — file created then; forward reference added here
]);

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

/**
 * Invokes the migration-gate hook with a synthetic tool-invocation JSON payload.
 * cwd sets the working directory so relative file lookups resolve to the right fixtures.
 */
function runGate(toolName, toolInput, cwd) {
  const input = JSON.stringify({ tool_name: toolName, tool_input: toolInput });
  const result = spawnSync('node', [HOOK], {
    input,
    encoding: 'utf8',
    cwd: cwd || process.cwd(),
  });
  return { code: result.status, stderr: result.stderr || '' };
}

/** Creates an isolated temp directory for a single test case. */
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mg-test-'));
}

/** Writes an approvals file with an options_approved entry for the given ADO. */
function writeOptionsApproved(cpDir, ado) {
  fs.mkdirSync(cpDir, { recursive: true });
  fs.writeFileSync(path.join(cpDir, `${ado}.approvals.json`), JSON.stringify([
    { type: 'options_approved', ado, option: 'B', at: '2026-10-02T12:00:00.000Z', by: 'developer' },
  ], null, 2) + '\n');
}

process.stdout.write('migration-gate.cjs\n');

// ── P-U4: Write to non-migration path → exit 0 ────────────────────────────────────────────────
{
  const r = runGate('Write', { file_path: 'docs/Release3/Sprint10/ADO-1234.icea.md' });
  assert('P-U4 Write to non-migration path → exit 0', r.code === 0);
}

// ── P-U5: Write to design doc with options_approved → exit 0 ──────────────────────────────────
{
  const tmp = tmpDir();
  const ado = 'ADO-5001';
  writeOptionsApproved(path.join(tmp, '.claude', 'migration'), ado);

  const r = runGate('Write', { file_path: `docs/migrations/${ado}/target-component-architecture.md` }, tmp);
  assert('P-U5 Write design doc with options_approved → exit 0', r.code === 0);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── P-U5b: Edit to design doc with options_approved → exit 0 ─────────────────────────────────
{
  const tmp = tmpDir();
  const ado = 'ADO-5001';
  writeOptionsApproved(path.join(tmp, '.claude', 'migration'), ado);

  const r = runGate('Edit', { file_path: `docs/migrations/${ado}/target-data-architecture.md` }, tmp);
  assert('P-U5b Edit design doc with options_approved → exit 0', r.code === 0);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── P-U5c: Write migration-feasibility.md with options_approved → exit 0 ─────────────────────
{
  const tmp = tmpDir();
  const ado = 'ADO-5002';
  writeOptionsApproved(path.join(tmp, '.claude', 'migration'), ado);

  const r = runGate('Write', { file_path: `docs/migrations/${ado}/migration-feasibility.md` }, tmp);
  assert('P-U5c Write migration-feasibility.md with options_approved → exit 0', r.code === 0);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── P-U6: Bash with unrelated command → exit 0 ────────────────────────────────────────────────
{
  const r = runGate('Bash', { command: 'git status' });
  assert('P-U6 Bash git status → exit 0', r.code === 0);
}

// ── P-U6b: Read tool → not gated → exit 0 ────────────────────────────────────────────────────
{
  const r = runGate('Read', { file_path: 'docs/migrations/ADO-9999/target-component-architecture.md' });
  assert('P-U6b Read tool not gated → exit 0', r.code === 0);
}

// ── Bash allow: grep mentioning gate name (no file mutation) → exit 0 ────────────────────────
{
  const r = runGate('Bash', { command: 'grep options_approved skills/rewrite/SKILL.md' });
  assert('Bash allow: grep options_approved → exit 0', r.code === 0);
}

// ── Bash allow: cat .checkpoint.json (read-only) → exit 0 ────────────────────────────────────
{
  const r = runGate('Bash', { command: 'cat .claude/migration/ADO-1234.checkpoint.json | grep options_approved' });
  assert('Bash allow: cat checkpoint (read-only) → exit 0', r.code === 0);
}

// ── N-U5: Write design doc — no approvals file → exit 2 ───────────────────────────────────────
{
  const tmp = tmpDir();
  const r = runGate('Write', { file_path: 'docs/migrations/ADO-5010/target-component-architecture.md' }, tmp);
  assert('N-U5 Write design doc (no approvals) → exit 2', r.code === 2);
  assert('N-U5 stderr explains required reply', r.stderr.includes('APPROVE OPTIONS') || r.stderr.includes('options_approved'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── N-U5b: Write design doc — approvals file exists but options_approved absent → exit 2 ──────
{
  const tmp = tmpDir();
  const ado = 'ADO-5011';
  const cpDir = path.join(tmp, '.claude', 'migration');
  fs.mkdirSync(cpDir, { recursive: true });
  // Approvals file exists but has no options_approved entry
  fs.writeFileSync(path.join(cpDir, `${ado}.approvals.json`), JSON.stringify([
    { type: 'partial_acknowledged', ado, rows: [], at: '2026-10-02T00:00:00Z', by: 'developer' },
  ], null, 2) + '\n');

  const r = runGate('Write', { file_path: `docs/migrations/${ado}/target-data-architecture.md` }, tmp);
  assert('N-U5b Write design doc (no options_approved in file) → exit 2', r.code === 2);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── N-U6: Bash --gate=options_approved → exit 2 ───────────────────────────────────────────────
{
  const r = runGate('Bash', {
    command: 'node scripts/checkpoint-ledger.cjs set-gate --ado=ADO-1234 --skill=rewrite --gate=options_approved --verdict=PASS',
  });
  assert('N-U6 Bash --gate=options_approved → exit 2', r.code === 2);
}

// ── N-U6b: Bash --gate=design_approved → exit 2 ───────────────────────────────────────────────
{
  const r = runGate('Bash', {
    command: 'node scripts/checkpoint-ledger.cjs set-gate --ado=ADO-1234 --skill=rewrite --gate=design_approved --verdict=PASS',
  });
  assert('N-U6b Bash --gate=design_approved → exit 2', r.code === 2);
}

// ── N-U7: Bash node -e checkpoint write + protected gate name → exit 2 ───────────────────────
{
  const r = runGate('Bash', {
    command: 'node -e "const fs=require(\'fs\'); const d=JSON.parse(fs.readFileSync(\'.claude/migration/ADO-1234.checkpoint.json\')); d.stage_gates.options_approved=\'PASS\'; fs.writeFileSync(\'.claude/migration/ADO-1234.checkpoint.json\',JSON.stringify(d));"',
  });
  assert('N-U7 Bash node -e checkpoint write with options_approved → exit 2', r.code === 2);
}

// ── N-U8: Write .approvals.json directly → exit 2 ────────────────────────────────────────────
{
  const r = runGate('Write', { file_path: '.claude/migration/ADO-1234.approvals.json' });
  assert('N-U8 Write .approvals.json → exit 2', r.code === 2);
}

// ── N-U8b: Edit .approvals.json → exit 2 ─────────────────────────────────────────────────────
{
  const r = runGate('Edit', { file_path: '.claude/migration/ADO-5099.approvals.json' });
  assert('N-U8b Edit .approvals.json → exit 2', r.code === 2);
}

// ── N-U9: Fault injection — invalid JSON stdin → exit 2 (fail-closed) ────────────────────────
{
  const result = spawnSync('node', [HOOK], { input: 'not valid json at all }{', encoding: 'utf8' });
  assert('N-U9 invalid JSON stdin → exit 2 (fail-closed, AC-NF1)', result.status === 2);
}

// ── N-U10: active-task.json absent — gate still enforces from path (AC-NF2) ──────────────────
{
  const tmp = tmpDir();
  // Confirm active-task.json does NOT exist in this temp dir
  assert('N-U10 setup: active-task.json is absent', !fs.existsSync(path.join(tmp, '.claude', 'active-task.json')));

  // Gate should still block (reads ADO from path, not active-task.json)
  const r = runGate('Write', { file_path: 'docs/migrations/ADO-5020/target-data-architecture.md' }, tmp);
  assert('N-U10 gate enforces without active-task.json → exit 2', r.code === 2);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── INT-2: Preflight — all $PLUGIN_DIR/scripts/*.cjs refs in SKILL.md are in REQUIRED_SCRIPTS ─
process.stdout.write('\n  [INT-2] REQUIRED_SCRIPTS preflight\n');
{
  const skillContent = fs.readFileSync(SKILL_MD, 'utf8');
  const refMatches   = [...skillContent.matchAll(/\$PLUGIN_DIR\/scripts\/([\w-]+\.cjs)/g)];
  const uniqueRefs   = new Set(refMatches.map(m => m[1]));

  // Every script invoked in SKILL.md must be tracked in REQUIRED_SCRIPTS
  for (const ref of uniqueRefs) {
    assert(`INT-2 ${ref} tracked in REQUIRED_SCRIPTS`, REQUIRED_SCRIPTS.has(ref));
  }

  // The four scripts specifically called out in the Story 2 DoD must be present
  assert('INT-2 coupling-resolution-validate.cjs in set', REQUIRED_SCRIPTS.has('coupling-resolution-validate.cjs'));
  assert('INT-2 research-cache.cjs in set',               REQUIRED_SCRIPTS.has('research-cache.cjs'));
  assert('INT-2 coupling-boundary-validate.cjs in set',   REQUIRED_SCRIPTS.has('coupling-boundary-validate.cjs'));
  assert('INT-2 cluster-merge.cjs in set (Story 3 fwd)',  REQUIRED_SCRIPTS.has('cluster-merge.cjs'));
}

// Summary
const total = passed + failed;
process.stdout.write(`\n${total} tests: ${passed} passed · ${failed} failed\n`);
if (failed > 0) process.exit(1);
