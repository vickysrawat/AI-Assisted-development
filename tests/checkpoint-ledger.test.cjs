#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/checkpoint-ledger.cjs (the shared migration-family ledger) and
//                      asserts: init writes core + empty payload; two skills (upgrade + rewrite)
//                      write their own payload namespaces into ONE ledger without clobbering each
//                      other (merge-write); set-gate records a stage gate; and the tolerant reader
//                      preserves an unknown newer core field across a write. Exit 0 = all pass.
// What it touches:     Writes JSON ledger files under a throwaway OS-temp dir (removed at start/end).
// What it does NOT do: No network, no git, no mutation outside the temp dir.
// APIs / commands:     Node stdlib: os.tmpdir, fs, path, child_process.spawnSync('node', ...).
// How to verify:       node tests/checkpoint-ledger.test.cjs  -> exit 0 and "N passed · 0 failed".

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

// init (skill=upgrade) — core present, payload empty namespace map
const i = run(['init', '--skill=upgrade', '--ado=9000', '--stack=dotnet', '--from=6', '--to=8', '--now=2026-09-08']);
assert('INIT core additive fields', i.json.checkpoint?.schema_version === '1.0' && i.json.checkpoint?.skill === 'upgrade'
  && Array.isArray(i.json.checkpoint?.phase_history) && typeof i.json.checkpoint?.payload === 'object', JSON.stringify(i.json.checkpoint));

// upgrade writes its payload
run(['set-payload', '--skill=upgrade', '--ado=9000', '--payload-json={"hops":["7","8"],"baseline_tag":"pre-upgrade/dotnet-6"}', '--now=2026-09-08']);
// P-U4 — rewrite writes ALONGSIDE upgrade; both payloads preserved (merge-write across skills)
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

// N-U4 — tolerant reader: an unknown NEWER core field survives a subsequent write
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

// B9: set-payload --payload-file reads and merges correctly (no shell JSON string)
const payloadFile = path.join(DIR, 'cluster-payload.json');
fs.writeFileSync(payloadFile, JSON.stringify({ cluster_1_verdict: 'PASS', cluster_1_bal_grade: 'A' }, null, 2));
const pf = run(['set-payload', '--skill=rewrite', '--ado=9000', `--payload-file=${payloadFile}`]);
assert('B9: --payload-file merges payload from file', pf.code === 0 && pf.json.payload?.cluster_1_verdict === 'PASS' && pf.json.payload?.cluster_1_bal_grade === 'A', `code=${pf.code} payload=${JSON.stringify(pf.json.payload)}`);
assert('B9: --payload-file preserves existing payload keys', pf.json.checkpoint?.payload?.rewrite?.clusters === 3, `rewrite payload=${JSON.stringify(pf.json.checkpoint?.payload?.rewrite)}`);

// B9: --payload-file with nonexistent path exits 1 without mutating ledger
const before = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const pfMissing = run(['set-payload', '--skill=rewrite', '--ado=9000', '--payload-file=/nonexistent/path/payload.json']);
assert('B9: --payload-file missing file exits 1', pfMissing.code === 1, `code=${pfMissing.code}`);
const afterBad = JSON.parse(fs.readFileSync(FILE, 'utf8'));
assert('B9: --payload-file missing file does not mutate ledger', JSON.stringify(before) === JSON.stringify(afterBad), 'ledger was mutated on bad file');

// get on missing -> absent exit 7
reset();
const g = run(['get', '--skill=upgrade', '--ado=9000']);
assert('GET absent (exit 7)', g.code === 7 && g.json.status === 'absent', `code=${g.code} status=${g.json.status}`);

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
