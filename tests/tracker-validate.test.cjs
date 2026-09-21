#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'tracker-validate.cjs');

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, 'utf8');
}

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  return {
    code: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-validate-'));
const tracker = path.join(dir, 'migration-tracker.md');
const ledger = path.join(dir, '.claude', 'migration', '9000.checkpoint.json');

function reset() {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
}

reset();

// Happy path: tracker matches ledger
write(ledger, JSON.stringify({
  skill: 'upgrade',
  ado_id: '9000',
  stage_gates: { intake_context: 'PASS', report: 'PASS' },
  phase_history: [{ phase: 'report', verdict: 'PASS', at: '2026-09-08' }],
}, null, 2));
write(tracker, [
  'Phase: report',
  'Next action: Resume verification step',
].join('\n'));
let ok = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (ok.code !== 0) {
  console.log('✗ valid tracker should pass');
  console.log(ok.stdout || ok.stderr);
  process.exit(1);
}
console.log('✓ valid tracker passes');

// Stale tracker: unresolved gate ignored
reset();
write(ledger, JSON.stringify({
  skill: 'upgrade',
  ado_id: '9000',
  stage_gates: { intake_context: 'PASS', report: 'REVISE' },
  phase_history: [{ phase: 'report', verdict: 'REVISE', at: '2026-09-08' }],
}, null, 2));
write(tracker, [
  'Phase: intake_context',
  'Next action: Run source detection',
].join('\n'));
let stale = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (stale.code !== 4) {
  console.log('✗ stale tracker was not rejected');
  console.log(stale.stdout || stale.stderr);
  process.exit(1);
}
console.log('✓ stale tracker is rejected');

// Missing artifact reference in tracker is blocked
reset();
write(ledger, JSON.stringify({
  skill: 'rewrite',
  ado_id: '9000',
  stage_gates: { intake_context: 'PASS' },
  phase_history: [{ phase: 'intake_context', verdict: 'PASS', at: '2026-09-08' }],
}, null, 2));
write(tracker, [
  'Phase: intake_context',
  'Next action: Review docs/does-not-exist.md',
].join('\n'));
let missingArtifact = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (missingArtifact.code !== 5) {
  console.log('✗ missing artifact was not rejected');
  console.log(missingArtifact.stdout || missingArtifact.stderr);
  process.exit(1);
}
console.log('✓ missing artifact is rejected');

// Missing tracker file is blocked
reset();
write(ledger, JSON.stringify({
  skill: 'replatform',
  ado_id: '9000',
  stage_gates: { intake_context: 'PASS' },
  phase_history: [{ phase: 'intake_context', verdict: 'PASS', at: '2026-09-08' }],
}, null, 2));
let missingTracker = run(['--tracker=' + path.join(dir, 'missing-tracker.md'), '--ledger=' + ledger]);
if (missingTracker.code !== 2) {
  console.log('✗ missing tracker was not rejected');
  console.log(missingTracker.stdout || missingTracker.stderr);
  process.exit(1);
}
console.log('✓ missing tracker is rejected');

console.log('\nAll tracker validation tests passed.');
process.exit(0);
