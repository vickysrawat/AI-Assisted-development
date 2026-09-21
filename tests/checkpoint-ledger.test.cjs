#!/usr/bin/env node
'use strict';
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LEDGER = path.join(__dirname, '..', 'scripts', 'checkpoint-ledger.cjs');
const DIR    = path.join(os.tmpdir(), `ledger-test-${process.pid}`);
const FILE   = path.join(DIR, 'l.json');
let pass = 0, fail = 0;

function reset() { fs.rmSync(DIR, { recursive: true, force: true }); }
function run(args) {
  const r = spawnSync('node', [LEDGER, ...args, `--file=${FILE}`, '--json'], { encoding: 'utf8' });
  let json = {}; try { json = JSON.parse(r.stdout || '{}'); } catch (_) {}
  return { json, code: r.status };
}
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); }
}

reset();

// init (skill=upgrade)
const i = run(['init', '--skill=upgrade', '--ado=9000', '--stack=dotnet', '--from=6', '--to=8', '--now=2026-09-08']);
assert('INIT core additive fields', i.json.checkpoint?.schema_version === '1.0' && i.json.checkpoint?.skill === 'upgrade'
  && Array.isArray(i.json.checkpoint?.phase_history) && typeof i.json.checkpoint?.payload === 'object', JSON.stringify(i.json.checkpoint));

// upgrade writes its payload
run(['set-payload', '--skill=upgrade', '--ado=9000', '--payload-json={"hops":["7","8"],"baseline_tag":"pre-upgrade/dotnet-6"}', '--now=2026-09-08']);
// rewrite writes ALONGSIDE upgrade; both payloads preserved
const rw = run(['set-payload', '--skill=rewrite', '--ado=9000', '--payload-json={"clusters":3,"posture":"port"}', '--now=2026-09-08']);
assert('P-U4 rewrite payload written', rw.json.payload?.clusters === 3 && rw.json.payload?.posture === 'port', JSON.stringify(rw.json.payload));
assert('P-U4 upgrade payload preserved alongside rewrite',
  rw.json.checkpoint?.payload?.upgrade?.baseline_tag === 'pre-upgrade/dotnet-6'
  && JSON.stringify(rw.json.checkpoint?.payload?.upgrade?.hops) === JSON.stringify(['7', '8']),
  JSON.stringify(rw.json.checkpoint?.payload));

// set-gate records a stage gate + phase_history
const sg = run(['set-gate', '--skill=rewrite', '--ado=9000', '--gate=merge', '--verdict=PASS', '--now=2026-09-08']);
assert('SET-GATE recorded', sg.json.checkpoint?.stage_gates?.merge === 'PASS'
  && (sg.json.checkpoint?.phase_history || []).some(p => p.phase === 'merge'), JSON.stringify(sg.json.checkpoint?.stage_gates));

// validation cases
const valid = run(['validate', '--skill=rewrite', '--ado=9000']);
assert('VALID ledger passes validation', valid.code === 0 && valid.json.ok === true, JSON.stringify(valid.json));

reset();
const missing = run(['validate', '--skill=rewrite', '--ado=9000']);
assert('MISSING ledger fails validation', missing.code === 7 && missing.json.status === 'absent', JSON.stringify(missing.json));

reset();
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(FILE, '');
const empty = run(['validate', '--skill=rewrite', '--ado=9000']);
assert('EMPTY ledger fails validation', empty.code === 8 && empty.json.status === 'empty', JSON.stringify(empty.json));

reset();
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(FILE, '{bad json');
const malformed = run(['validate', '--skill=rewrite', '--ado=9000']);
assert('MALFORMED JSON fails validation', malformed.code === 9 && malformed.json.status === 'malformed-json', JSON.stringify(malformed.json));

reset();
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(FILE, JSON.stringify({ schema_version: '1.0', skill: 'rewrite', ado_id: '9001', source: { stack: 'dotnet', from: '6', to: '8' }, stage_gates: {}, phase_history: [], decision_log: [], judge_verdicts: [], payload: {} }));
const adoMismatch = run(['validate', '--skill=rewrite', '--ado=9000']);
assert('WRONG ADO fails validation', adoMismatch.code === 11 && adoMismatch.json.status === 'ado-mismatch', JSON.stringify(adoMismatch.json));

reset();
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(FILE, JSON.stringify({ schema_version: '1.0', skill: 'upgrade', ado_id: '9000', source: { stack: 'dotnet', from: '6', to: '8' }, stage_gates: {}, phase_history: [], decision_log: [], judge_verdicts: [], payload: {} }));
const skillMismatch = run(['validate', '--skill=rewrite', '--ado=9000']);
assert('WRONG skill fails validation', skillMismatch.code === 12 && skillMismatch.json.status === 'skill-mismatch', JSON.stringify(skillMismatch.json));

// N-U4 — tolerant reader: unknown NEWER core field survives a subsequent write
reset();
const init2 = run(['init', '--skill=upgrade', '--ado=9000', '--stack=dotnet', '--from=6', '--to=8', '--now=2026-09-08']);
assert('INIT second ledger passes', init2.code === 0, JSON.stringify(init2.json));
run(['set-payload', '--skill=upgrade', '--ado=9000', '--payload-json={"hops":["7","8"],"baseline_tag":"pre-upgrade/dotnet-6"}', '--now=2026-09-08']);
run(['set-payload', '--skill=rewrite', '--ado=9000', '--payload-json={"clusters":3,"posture":"port"}', '--now=2026-09-08']);
const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
raw.future_core_field = { added_by: 'newer-schema' };
fs.writeFileSync(FILE, JSON.stringify(raw, null, 2));
run(['set-gate', '--skill=upgrade', '--ado=9000', '--gate=verify', '--verdict=PASS', '--now=2026-09-08']);
const after = JSON.parse(fs.readFileSync(FILE, 'utf8'));
assert('N-U4 tolerant reader preserves unknown newer core field',
  after.future_core_field?.added_by === 'newer-schema', JSON.stringify(after.future_core_field));
assert('N-U4 both skill payloads still intact after tolerant write',
  after.payload?.upgrade?.baseline_tag === 'pre-upgrade/dotnet-6' && after.payload?.rewrite?.clusters === 3,
  JSON.stringify(after.payload));

// get on missing -> absent exit 7
reset();
const g = run(['get', '--skill=upgrade', '--ado=9000']);
assert('GET absent (exit 7)', g.code === 7 && g.json.status === 'absent', `code=${g.code} status=${g.json.status}`);

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
