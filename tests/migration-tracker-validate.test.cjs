#!/usr/bin/env node
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { validateTracker } = require('../scripts/migration-tracker-validate.cjs');

const dir = path.join(os.tmpdir(), `tracker-test-${process.pid}`);
const ledger = path.join(dir, 'checkpoint.json');
const tracker = path.join(dir, 'migration-tracker.md');
let pass = 0, fail = 0;
function reset() { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); }
function check(name, condition, detail) { if (condition) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); } }
function writeLedger() { fs.writeFileSync(ledger, JSON.stringify({ schema_version: '1.0', ado_id: '9000', skill: 'rewrite', stage_gates: { intake_context: 'PASS' }, phase_history: [], decision_log: [], judge_verdicts: [], payload: {}, source: {} }, null, 2)); }
function writeTracker(phase, next, status = '🔄') {
  fs.writeFileSync(tracker, `_Last updated: 2026-09-21 · Phase: ${phase} · Step: 1\n\n| Phase | Step | Status | Artifact(s) |\n|---|---|---|---|\n| ${phase} | 1 | ${status} In progress | — |\n\n## Next action\n\n${next}\n`);
}

reset();
writeLedger();
writeTracker('1.5 — Integration + oracle', 'Run Step 2 options analysis');
let result = validateTracker({ ledgerFile: ledger, trackerFile: tracker, ado: '9000', skill: 'rewrite', expectedPhase: '1.5 — Integration + oracle', expectedNextAction: 'Run Step 2 options analysis' });
check('matching tracker passes', result.code === 0 && result.ok, JSON.stringify(result));

result = validateTracker({ ledgerFile: ledger, trackerFile: tracker, ado: '9000', skill: 'rewrite', expectedPhase: '2 — Options', expectedNextAction: 'Run Step 2 options analysis' });
check('stale phase fails closed', result.code === 15 && result.status === 'tracker-phase-mismatch', JSON.stringify(result));

writeTracker('1.5 — Integration + oracle', 'Run Step 1.5 again');
result = validateTracker({ ledgerFile: ledger, trackerFile: tracker, ado: '9000', skill: 'rewrite', expectedPhase: '1.5 — Integration + oracle', expectedNextAction: 'Run Step 2 options analysis' });
check('stale next action fails closed', result.code === 16 && result.status === 'tracker-next-action-mismatch', JSON.stringify(result));

reset();
result = validateTracker({ ledgerFile: ledger, trackerFile: tracker, ado: '9000', skill: 'rewrite' });
check('missing ledger fails closed', result.code === 7, JSON.stringify(result));

reset();
writeLedger();
result = validateTracker({ ledgerFile: ledger, trackerFile: tracker, ado: '9000', skill: 'rewrite' });
check('missing tracker fails closed', result.code === 13, JSON.stringify(result));

reset();
writeLedger();
writeTracker('1.5 — Integration + oracle', 'Run Step 2 options analysis');
const beforeLedger = fs.readFileSync(ledger, 'utf8');
const beforeTracker = fs.readFileSync(tracker, 'utf8');
result = validateTracker({ ledgerFile: ledger, trackerFile: tracker, ado: '9000', skill: 'rewrite', expectedPhase: '2 — Options', expectedNextAction: 'Run Step 2 options analysis' });
check('failed validation does not mutate ledger', fs.readFileSync(ledger, 'utf8') === beforeLedger, JSON.stringify(result));
check('failed validation does not mutate tracker', fs.readFileSync(tracker, 'utf8') === beforeTracker, JSON.stringify(result));

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
