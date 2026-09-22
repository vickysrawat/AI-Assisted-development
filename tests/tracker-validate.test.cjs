#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { trackerRepoRoot } = require('../scripts/tracker-validate.cjs');

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

const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-validate-'));
const trackerDir = path.join(repo, 'docs', 'migrations', 'ADO-9000');
const tracker = path.join(trackerDir, 'migration-tracker.md');
const ledger = path.join(repo, '.claude', 'migration', '9000.checkpoint.json');
const log = path.join(trackerDir, 'migration-log.md');
const options = path.join(trackerDir, 'ADO-9000-options.md');

function reset() {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.mkdirSync(trackerDir, { recursive: true });
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
}

function writeLedger({ gates, history, skill = 'rewrite', ado = '9000' }) {
  write(ledger, JSON.stringify({
    schema_version: '1.0',
    skill,
    ado_id: ado,
    created_at: '2026-09-22',
    updated_at: '2026-09-22',
    source: { stack: 'nodejs', from: '18', to: '20' },
    stage_gates: gates || {},
    phase_history: history || [],
    decision_log: [],
    judge_verdicts: [],
    payload: {},
  }, null, 2));
}

function writeTracker({ phase, step, nextAction, optionStatus = '🔄 Awaiting approval', optionsPath = 'docs/migrations/ADO-9000/ADO-9000-options.md', eol = '\n' }) {
  write(log, '# Migration log\n');
  write(options, '# Options\n');
  write(tracker, [
    '# Migration Tracker — Example Rewrite (ADO-9000)',
    '',
    `_Last updated: 2026-09-22 · Phase: ${phase} · Step: ${step}_`,
    '',
    '> **Resume instruction:** open this file + `migration-log.md` + `ADO-9000-options.md` in VS Code.',
    '',
    '---',
    '',
    '## Phase and step status',
    '',
    '| Phase | Step | Status | Artifact(s) |',
    '|---|---|---|---|',
    '| 0 — Initialize | Log + tracker + ledger | ✅ Complete | migration-log.md · migration-tracker.md |',
    `| 2 — Options | Options file + APPROVE OPTIONS | ${optionStatus} | ADO-9000-options.md |`,
    '',
    '---',
    '',
    '## Committed artifacts',
    '',
    '| Artifact | Path | Status |',
    '|---|---|---|',
    '| Migration log | docs/migrations/ADO-9000/migration-log.md | ✅ Created |',
    `| Options file | ${optionsPath} | ✅ Created |`,
    '',
    '---',
    '',
    '## Next action',
    '',
    nextAction,
    '',
    'To resume in a new session: type `REWRITE RESUME ADO-9000`.',
  ].join(eol));
}

reset();

writeLedger({
  gates: { intake_context: 'PASS' },
  history: [{ phase: 'intake_context', verdict: 'PASS', at: '2026-09-22' }],
});
writeTracker({
  phase: '2 — Options',
  step: 'Options file written — awaiting APPROVE OPTIONS',
  nextAction: 'Reply `APPROVE OPTIONS ADO-9000 [A | B | C]` with answers to the three pre-design questions in ADO-9000-options.md to proceed to target design documents (Step 2.5).',
});
let ok = run([
  '--tracker=' + tracker,
  '--ledger=' + ledger,
  '--ado=9000',
  '--skill=rewrite',
  '--phase=2 — Options',
  '--next-action=Reply `APPROVE OPTIONS ADO-9000 [A | B | C]` with answers to the three pre-design questions in ADO-9000-options.md to proceed to target design documents (Step 2.5).',
  '--gate=2 — Options',
  '--gate-status=🔄 Awaiting approval',
]);
if (ok.code !== 0) {
  console.log('✗ valid tracker should pass');
  console.log(ok.stdout || ok.stderr);
  process.exit(1);
}
console.log('✓ valid markdown tracker passes');

let stale = run([
  '--tracker=' + tracker,
  '--ledger=' + ledger,
  '--ado=9000',
  '--skill=rewrite',
  '--next-action=Run Step 2.5 target design documents',
]);
if (stale.code !== 16) {
  console.log('✗ stale next action was not rejected');
  console.log(stale.stdout || stale.stderr);
  process.exit(1);
}
console.log('✓ stale next action is rejected');

reset();
writeLedger({
  gates: { options: 'PASS' },
  history: [{ phase: '2 — Options', verdict: 'PASS', at: '2026-09-22' }],
});
writeTracker({
  phase: '1 — Source analysis',
  step: 'Stack detect + posture',
  nextAction: 'Run Step 1.5 integration verification.',
});
let staleMarkdownPhase = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (staleMarkdownPhase.code !== 15) {
  console.log('✗ stale markdown phase was not rejected');
  console.log(staleMarkdownPhase.stdout || staleMarkdownPhase.stderr);
  process.exit(1);
}
console.log('✓ stale markdown phase is rejected');

reset();
writeLedger({
  gates: { report: 'PASS' },
  history: [{ phase: 'report', verdict: 'PASS', at: '2026-09-22' }],
});
writeTracker({
  phase: '2 — Options',
  step: 'Options file written — awaiting APPROVE OPTIONS',
  nextAction: 'Run Step 2.5 target design documents.',
});
let staleMappedPhase = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (staleMappedPhase.code !== 15) {
  console.log('✗ machine-to-markdown phase drift was not rejected');
  console.log(staleMappedPhase.stdout || staleMappedPhase.stderr);
  process.exit(1);
}
console.log('✓ machine-to-markdown phase drift is rejected');

reset();
writeLedger({
  gates: { options: 'PASS' },
  history: [{ phase: '2 — Options', verdict: 'PASS', at: '2026-09-22' }],
});
writeTracker({
  phase: '3 — Generation',
  step: 'Per-cluster code + design-quality gate',
  nextAction: 'Run Step 3 generation for cluster 1.',
});
let aheadMarkdownPhase = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (aheadMarkdownPhase.code !== 15) {
  console.log('✗ ahead-of-ledger markdown phase was not rejected');
  console.log(aheadMarkdownPhase.stdout || aheadMarkdownPhase.stderr);
  process.exit(1);
}
console.log('✓ ahead-of-ledger markdown phase is rejected');

reset();
writeLedger({
  gates: { report: 'REVISE' },
  history: [{ phase: 'report', verdict: 'REVISE', at: '2026-09-22' }],
  skill: 'upgrade',
});
write(path.join(trackerDir, 'legacy-tracker.md'), [
  'Phase: report',
  'Next action: Review completed artifacts before continuing',
].join('\n'));
let reviewAction = run(['--tracker=' + path.join(trackerDir, 'legacy-tracker.md'), '--ledger=' + ledger]);
if (reviewAction.code !== 0) {
  console.log('✗ review/continue wording should not be treated as completion');
  console.log(reviewAction.stdout || reviewAction.stderr);
  process.exit(1);
}
console.log('✓ review/continue wording is not treated as completion');

reset();
writeLedger({
  gates: { intake_context: 'PASS' },
  history: [{ phase: 'intake_context', verdict: 'PASS', at: '2026-09-22' }],
});
writeTracker({
  phase: '2 — Options',
  step: 'Options file written — awaiting APPROVE OPTIONS',
  nextAction: 'Review docs/migrations/ADO-9000/does-not-exist.md before resuming.',
  optionsPath: 'docs/migrations/ADO-9000/does-not-exist.md',
});
let missingArtifact = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (missingArtifact.code !== 18) {
  console.log('✗ missing artifact was not rejected');
  console.log(missingArtifact.stdout || missingArtifact.stderr);
  process.exit(1);
}
console.log('✓ missing artifact is rejected');

reset();
writeTracker({
  phase: '2 — Options',
  step: 'Options file written — awaiting APPROVE OPTIONS',
  nextAction: 'Reply `APPROVE OPTIONS ADO-9000 [A | B | C]` to continue.',
});
let missingLedger = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (missingLedger.code !== 7) {
  console.log('✗ missing ledger was not rejected via shared validator');
  console.log(missingLedger.stdout || missingLedger.stderr);
  process.exit(1);
}
console.log('✓ missing ledger is rejected');

reset();
write(ledger, '{not json\n');
writeTracker({
  phase: '2 — Options',
  step: 'Options file written — awaiting APPROVE OPTIONS',
  nextAction: 'Reply `APPROVE OPTIONS ADO-9000 [A | B | C]` to continue.',
});
let invalidLedger = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (invalidLedger.code !== 9) {
  console.log('✗ malformed ledger was not rejected via shared validator');
  console.log(invalidLedger.stdout || invalidLedger.stderr);
  process.exit(1);
}
console.log('✓ malformed ledger is rejected');

reset();
writeLedger({
  gates: { intake_context: 'PASS' },
  history: [{ phase: 'intake_context', verdict: 'PASS', at: '2026-09-22' }],
});
writeTracker({
  phase: '2 — Options',
  step: 'Options file written — awaiting APPROVE OPTIONS',
  nextAction: 'Review ../../../../outside.md before resuming.',
  optionsPath: '../../../../outside.md',
});
let outsideRepo = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (outsideRepo.code !== 18) {
  console.log('✗ outside-repo artifact was not rejected');
  console.log(outsideRepo.stdout || outsideRepo.stderr);
  process.exit(1);
}
console.log('✓ outside-repo artifact is rejected');

reset();
writeLedger({
  gates: { intake_context: 'PASS' },
  history: [{ phase: 'intake_context', verdict: 'PASS', at: '2026-09-22' }],
});
writeTracker({
  phase: '2 — Options',
  step: 'Options file written — awaiting APPROVE OPTIONS',
  nextAction: 'Review docs\\migrations\\ADO-9000\\ADO-9000-options.md before resuming.',
  optionsPath: 'docs\\migrations\\ADO-9000\\ADO-9000-options.md',
  eol: '\r\n',
});
let windowsStyle = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (windowsStyle.code !== 0) {
  console.log('✗ CRLF tracker with Windows-style paths should pass');
  console.log(windowsStyle.stdout || windowsStyle.stderr);
  process.exit(1);
}
console.log('✓ CRLF tracker with Windows-style paths passes');

reset();
writeLedger({
  gates: { intake_context: 'PASS' },
  history: [{ phase: 'intake_context', verdict: 'PASS', at: '2026-09-22' }],
});
writeTracker({
  phase: '2 — Options',
  step: 'Options file written — awaiting APPROVE OPTIONS',
  nextAction: 'Review C:\\temp\\outside.md before resuming.',
  optionsPath: 'C:\\temp\\outside.md',
});
let windowsAbsolute = run(['--tracker=' + tracker, '--ledger=' + ledger]);
if (windowsAbsolute.code !== 18) {
  console.log('✗ Windows absolute artifact path was not rejected');
  console.log(windowsAbsolute.stdout || windowsAbsolute.stderr);
  process.exit(1);
}
console.log('✓ Windows absolute artifact path is rejected');

reset();
writeLedger({
  gates: { report: 'PASS' },
  history: [{ phase: 'report', verdict: 'PASS', at: '2026-09-22' }],
  skill: 'upgrade',
});
write(path.join(trackerDir, 'legacy-tracker.md'), [
  'Phase: intake_context',
  'Next action: Run source detection',
].join('\n'));
let legacy = run(['--tracker=' + path.join(trackerDir, 'legacy-tracker.md'), '--ledger=' + ledger]);
if (legacy.code !== 15) {
  console.log('✗ legacy tracker phase mismatch was not rejected');
  console.log(legacy.stdout || legacy.stderr);
  process.exit(1);
}
console.log('✓ legacy tracker mismatch is rejected');

const nonAnchoredTracker = path.join(repo, 'scratch', 'migration-tracker.md');
write(nonAnchoredTracker, ['Phase: report', 'Next action: Continue review'].join('\n'));
let nonAnchored = run(['--tracker=' + nonAnchoredTracker, '--ledger=' + ledger]);
if (nonAnchored.code !== 14) {
  console.log('✗ tracker outside docs/migrations should be rejected');
  console.log(nonAnchored.stdout || nonAnchored.stderr);
  process.exit(1);
}
console.log('✓ tracker outside docs/migrations is rejected');

const nestedTracker = path.join(repo, 'docs', 'migrations', 'ADO-9000', 'docs', 'migrations', 'migration-tracker.md');
if (trackerRepoRoot(nestedTracker) !== repo) {
  console.log('✗ tracker repo root should use the first docs/migrations segment');
  console.log(trackerRepoRoot(nestedTracker));
  process.exit(1);
}
console.log('✓ tracker repo root uses the first docs/migrations segment');

console.log('\nAll tracker validation tests passed.');
process.exit(0);
