#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/upgrade-checkpoint.cjs and asserts: init creates a well-formed
//                      core+payload envelope; get returns it; set-gate records a stage-gate verdict
//                      and appends phase_history; set-payload merges the baseline tag + hops; and the
//                      MERGE-WRITE property — a field written directly into the checkpoint by another
//                      writer survives a later set-gate (never clobbered). Exit 0 = all pass.
// What it touches:     Writes JSON checkpoint files under a throwaway dir in the OS temp folder
//                      (removed at start + end). Spawns `node scripts/upgrade-checkpoint.cjs`.
// What it does NOT do: No network, no git, no mutation outside the temp dir.
// APIs / commands:     Node stdlib: os.tmpdir, fs, path, child_process.spawnSync('node', ...).
// How to verify:       node tests/upgrade-checkpoint.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CP   = path.join(__dirname, '..', 'scripts', 'upgrade-checkpoint.cjs');
const DIR  = path.join(os.tmpdir(), `upgrade-cp-test-${process.pid}`);
const FILE = path.join(DIR, 'cp.json');
let pass = 0, fail = 0;

function reset() { fs.rmSync(DIR, { recursive: true, force: true }); }
function run(args) {
  fs.mkdirSync(DIR, { recursive: true });
  const r = spawnSync('node', [CP, ...args, `--file=${FILE}`, '--json'], { cwd: DIR, encoding: 'utf8' });
  let json = {};
  try { json = JSON.parse(r.stdout || '{}'); } catch (_) { /* leave empty → assertion fails */ }
  return { json, code: r.status };
}
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); }
}

reset();

// init — creates a well-formed envelope
const i = run(['init', '--ado=9000', '--stack=dotnet', '--from=6', '--to=8', '--now=2026-09-08']);
assert('INIT created (exit 0)', i.code === 0 && i.json.status === 'created', `code=${i.code} status=${i.json.status}`);
assert('INIT core fields present', i.json.checkpoint?.schema_version === '1.0' && i.json.checkpoint?.skill === 'upgrade' && i.json.checkpoint?.ado_id === '9000',
  JSON.stringify(i.json.checkpoint));
assert('INIT payload skeleton present', i.json.checkpoint?.payload?.upgrade && Array.isArray(i.json.checkpoint.payload.upgrade.hops),
  JSON.stringify(i.json.checkpoint?.payload));

// init again — idempotent (preserves existing)
assert('INIT idempotent (exists)', run(['init', '--ado=9000', '--now=2026-09-09']).json.status === 'exists', 're-init did not report exists');

// set-payload — merges baseline tag + hops
const sp = run(['set-payload', '--ado=9000', '--baseline-tag=pre-upgrade/dotnet-6', '--hops=7,8', '--now=2026-09-08']);
assert('SET-PAYLOAD baseline tag merged', sp.json.payload?.baseline_tag === 'pre-upgrade/dotnet-6', JSON.stringify(sp.json.payload));
assert('SET-PAYLOAD hops merged', JSON.stringify(sp.json.payload?.hops) === JSON.stringify(['7', '8']), JSON.stringify(sp.json.payload?.hops));

// report gate fail-closed: report=PASS before intake_context PASS must fail and not persist report gate
const sgBlocked = run(['set-gate', '--ado=9000', '--gate=report', '--verdict=PASS', '--now=2026-09-08']);
assert('SET-GATE report PASS blocked before intake verification (non-zero exit)', sgBlocked.code !== 0, `code=${sgBlocked.code}`);
const blockedState = JSON.parse(fs.readFileSync(FILE, 'utf8'));
assert('SET-GATE blocked attempt did not persist report=PASS',
  blockedState.stage_gates?.report !== 'PASS' && !(blockedState.phase_history || []).some(p => p.phase === 'report' && p.verdict === 'PASS'),
  JSON.stringify({ stage_gates: blockedState.stage_gates, phase_history: blockedState.phase_history }));

// build a minimal intake_context PASS fixture that satisfies current check-gate for upgrade
fs.mkdirSync(path.join(DIR, 'src'), { recursive: true });
fs.writeFileSync(path.join(DIR, 'src', 'app.js'), 'line1\nline2\n');
fs.writeFileSync(path.join(DIR, 'manifest-upgrade.md'), `# Source Context Manifest
Root: ${DIR}

## Source coverage
| Source module | Disposition | Reason | PROV |
| sample | mapped | representative citation | src/app.js#L1 |

## Cross-cutting concern scan
none — no delta for this upgrade.
`);
const seeded = JSON.parse(fs.readFileSync(FILE, 'utf8'));
seeded.stage_gates = { ...(seeded.stage_gates || {}), intake_context: 'PASS' };
seeded.source_context = {
  manifest_path: path.join(DIR, 'manifest-upgrade.md'),
  roots_expected: [DIR],
  modules_mapped: 0,
  modules_out_of_scope: 0,
  skill: 'upgrade',
};
fs.writeFileSync(FILE, JSON.stringify(seeded, null, 2));

// set-gate succeeds after valid intake_context setup and keeps phase_history behavior
const sg = run(['set-gate', '--ado=9000', '--gate=report', '--verdict=PASS', '--now=2026-09-08']);
assert('SET-GATE verdict recorded after intake PASS', sg.code === 0 && sg.json.checkpoint?.stage_gates?.report === 'PASS', `code=${sg.code} ${JSON.stringify(sg.json.checkpoint?.stage_gates)}`);
assert('SET-GATE phase_history appended after intake PASS', (sg.json.checkpoint?.phase_history || []).some(p => p.phase === 'report' && p.verdict === 'PASS'),
  JSON.stringify(sg.json.checkpoint?.phase_history));

// MERGE-WRITE — a foreign field injected by another writer must survive a later set-gate
const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
raw.foreign_writer_field = { rewrite: 'do-not-clobber' };
fs.writeFileSync(FILE, JSON.stringify(raw, null, 2));
run(['set-gate', '--ado=9000', '--gate=verify', '--verdict=PASS', '--now=2026-09-08']);
const after = JSON.parse(fs.readFileSync(FILE, 'utf8'));
assert('MERGE-WRITE preserves unowned field (tolerant reader / skew-safe)',
  after.foreign_writer_field?.rewrite === 'do-not-clobber', JSON.stringify(after.foreign_writer_field));
assert('MERGE-WRITE also kept the new gate', after.stage_gates?.verify === 'PASS' && after.stage_gates?.report === 'PASS',
  JSON.stringify(after.stage_gates));

// TOLERANT READER — a ledger created by ANOTHER skill (no upgrade substructures) must not crash
reset();
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(FILE, JSON.stringify({ schema_version: '1.0', skill: 'rewrite', foreign: { keep: 'me' } }, null, 2));
const tol = run(['set-payload', '--ado=9000', '--baseline-tag=pre-upgrade/x', '--now=2026-09-08']);
assert('TOLERANT set-payload on foreign checkpoint succeeds', tol.code === 0 && tol.json.payload?.baseline_tag === 'pre-upgrade/x',
  `code=${tol.code} payload=${JSON.stringify(tol.json.payload)}`);
const tolAfter = JSON.parse(fs.readFileSync(FILE, 'utf8'));
assert('TOLERANT foreign field preserved', tolAfter.foreign?.keep === 'me', JSON.stringify(tolAfter.foreign));

// get on a missing checkpoint -> absent, exit 7
reset();
const g = run(['get', '--ado=9000']);
assert('GET absent (exit 7)', g.code === 7 && g.json.status === 'absent', `code=${g.code} status=${g.json.status}`);

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
