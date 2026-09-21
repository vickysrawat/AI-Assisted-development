#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/checkpoint-ledger.cjs (the shared migration-family ledger) and
//                      asserts: init writes core + empty payload; validate fail-closes on missing,
//                      empty, malformed, invalid-shape, wrong-ADO, and wrong-skill files with
//                      structured remediation; two skills (upgrade + rewrite) write their own payload
//                      namespaces into ONE ledger without clobbering each other; set-gate records a
//                      stage gate; fail-closed mutations never auto-reinitialize; and the tolerant
//                      reader preserves an unknown newer core field across a write. Exit 0 = all pass.
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
  return { json, code: r.status, stdout: r.stdout, stderr: r.stderr };
}
function runHuman(args) {
  return spawnSync('node', [LEDGER, ...args, `--file=${FILE}`], { encoding: 'utf8' });
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

// validate (valid ledger)
const valid = run(['validate', '--skill=upgrade', '--ado=9000', '--now=2026-09-08']);
assert('VALIDATE passes on a valid ledger',
  valid.code === 0 && valid.json.status === 'ok' && valid.json.checkpoint?.ado_id === '9000',
  `code=${valid.code} json=${valid.stdout}`);

const wrongSkill = run(['validate', '--skill=rewrite', '--ado=9000']);
assert('VALIDATE rejects wrong skill before that skill has initialized the shared ledger',
  wrongSkill.code === 1
  && wrongSkill.json.reason === 'checkpoint-skill-mismatch'
  && Array.isArray(wrongSkill.json.next_steps) && wrongSkill.json.next_steps.length > 0,
  `code=${wrongSkill.code} json=${wrongSkill.stdout}`);

// upgrade writes its payload
run(['set-payload', '--skill=upgrade', '--ado=9000', '--payload-json={"hops":["7","8"],"baseline_tag":"pre-upgrade/dotnet-6"}', '--now=2026-09-08']);
const rewriteInit = run(['init', '--skill=rewrite', '--ado=9000', '--now=2026-09-08']);
assert('INIT seeds an additional skill namespace on an existing shared ledger',
  rewriteInit.code === 0 && rewriteInit.json.status === 'exists' && typeof rewriteInit.json.checkpoint?.payload?.rewrite === 'object',
  `code=${rewriteInit.code} json=${rewriteInit.stdout}`);
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

// validate mismatch cases on an otherwise valid ledger
const wrongAdo = run(['validate', '--skill=upgrade', '--ado=9001']);
assert('VALIDATE rejects wrong ADO with structured reason + next steps',
  wrongAdo.code === 1
  && wrongAdo.json.reason === 'checkpoint-ado-mismatch'
  && Array.isArray(wrongAdo.json.next_steps) && wrongAdo.json.next_steps.length > 0,
  `code=${wrongAdo.code} json=${wrongAdo.stdout}`);

// get on missing -> absent exit 7
reset();
const g = run(['get', '--skill=upgrade', '--ado=9000']);
assert('GET absent (exit 7)', g.code === 7 && g.json.status === 'absent', `code=${g.code} status=${g.json.status}`);

// validate missing -> explicit fail-closed reason + human-readable remediation
const missing = run(['validate', '--skill=upgrade', '--ado=9000']);
assert('VALIDATE rejects a missing file',
  missing.code === 1
  && missing.json.reason === 'checkpoint-missing'
  && missing.json.next_steps?.some(step => step.includes('UPGRADE ADO-9000')),
  `code=${missing.code} json=${missing.stdout}`);
const missingHuman = runHuman(['validate', '--skill=upgrade', '--ado=9000']);
assert('VALIDATE prints human-readable remediation without --json',
  missingHuman.status === 1
  && missingHuman.stderr.includes('❌ RESUME BLOCKED')
  && missingHuman.stderr.includes('Next step:')
  && missingHuman.stderr.includes('UPGRADE ADO-9000'),
  missingHuman.stderr || missingHuman.stdout);

// set-gate on missing -> fail closed, do not auto-init the ledger
const missingWrite = run(['set-gate', '--skill=upgrade', '--ado=9000', '--gate=report', '--verdict=PASS']);
assert('SET-GATE on missing ledger fails closed without creating a file',
  missingWrite.code === 1
  && missingWrite.json.reason === 'checkpoint-missing'
  && !fs.existsSync(FILE),
  `code=${missingWrite.code} exists=${fs.existsSync(FILE)} json=${missingWrite.stdout}`);

// empty file -> explicit reason
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(FILE, '');
const empty = run(['validate', '--skill=upgrade', '--ado=9000']);
assert('VALIDATE rejects an empty file',
  empty.code === 1
  && empty.json.reason === 'checkpoint-empty'
  && empty.json.next_steps?.length > 0,
  `code=${empty.code} json=${empty.stdout}`);

// malformed JSON -> explicit reason
fs.writeFileSync(FILE, '{"schema_version":');
const malformed = run(['validate', '--skill=upgrade', '--ado=9000']);
assert('VALIDATE rejects malformed JSON',
  malformed.code === 1
  && malformed.json.reason === 'checkpoint-malformed-json'
  && typeof malformed.json.parse_error === 'string',
  `code=${malformed.code} json=${malformed.stdout}`);

// invalid top-level shape -> explicit reason
fs.writeFileSync(FILE, JSON.stringify({ schema_version: '1.0', skill: 'upgrade', ado_id: '9000' }, null, 2));
const invalidShape = run(['validate', '--skill=upgrade', '--ado=9000']);
assert('VALIDATE rejects invalid top-level shape',
  invalidShape.code === 1
  && invalidShape.json.reason === 'checkpoint-invalid-shape'
  && invalidShape.json.details?.includes('source must be an object'),
  `code=${invalidShape.code} json=${invalidShape.stdout}`);

// set-payload on malformed/invalid ledger preserves the broken file (no silent re-init)
const broken = '{"schema_version":';
fs.writeFileSync(FILE, broken);
const malformedWrite = run(['set-payload', '--skill=upgrade', '--ado=9000', '--payload-json={"hops":["7"]}']);
assert('SET-PAYLOAD on malformed ledger fails closed and preserves file contents',
  malformedWrite.code === 1
  && malformedWrite.json.reason === 'checkpoint-malformed-json'
  && fs.readFileSync(FILE, 'utf8') === broken,
  `code=${malformedWrite.code} json=${malformedWrite.stdout}`);

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
