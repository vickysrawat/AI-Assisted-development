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

// GAP1: set-gate on a missing checkpoint exits 5 and does not create the file
reset();
const sgMissing = run(['set-gate', '--skill=rewrite', '--ado=9000', '--gate=test_gate', '--verdict=PASS']);
assert('GAP1: set-gate missing checkpoint exits 5', sgMissing.code === 5, `code=${sgMissing.code}`);
assert('GAP1: set-gate missing checkpoint does not create file', !fs.existsSync(FILE), `file was created unexpectedly`);

// GAP1: set-payload on a missing checkpoint exits 5 and does not create the file
const spMissing = run(['set-payload', '--skill=rewrite', '--ado=9000', '--key=test_key', '--value=test_val']);
assert('GAP1: set-payload missing checkpoint exits 5', spMissing.code === 5, `code=${spMissing.code}`);
assert('GAP1: set-payload missing checkpoint does not create file', !fs.existsSync(FILE), `file was created unexpectedly`);

// ── GAP5: set-gate stores object when artifact metadata provided; check-gate reads both formats ──
reset();
fs.mkdirSync(DIR, { recursive: true });
run(['init', '--skill=rewrite', '--ado=9000', '--now=2026-09-08']);
const artFile = path.join(DIR, 'context-manifest.md');
fs.writeFileSync(artFile, '## Source Modules\n\nmodule-a\nmodule-b\n');
const sgArt = run(['set-gate', '--skill=rewrite', '--ado=9000', '--gate=intake_context', '--verdict=PASS',
  `--artifact-path=${artFile}`, '--sentinel=## ', '--min-bytes=10', '--now=2026-09-08']);
assert('GAP5: set-gate stores object when artifact-path provided',
  typeof sgArt.json.checkpoint?.stage_gates?.intake_context === 'object' &&
  sgArt.json.checkpoint?.stage_gates?.intake_context?.verdict === 'PASS' &&
  sgArt.json.checkpoint?.stage_gates?.intake_context?.artifact_path === artFile,
  JSON.stringify(sgArt.json.checkpoint?.stage_gates?.intake_context));
const cgArt = run(['check-gate', '--skill=rewrite', '--ado=9000', '--gate=intake_context']);
assert('GAP5: check-gate reads PASS from object-format gate', cgArt.code === 0 && cgArt.json.status === 'PASS',
  `code=${cgArt.code} status=${cgArt.json.status}`);

// GAP5: validate-artifacts — all artifacts present and structurally valid → exit 0
reset();
fs.mkdirSync(DIR, { recursive: true });
run(['init', '--skill=rewrite', '--ado=9000', '--now=2026-09-08']);
const vaFile = path.join(DIR, 'manifest.md');
fs.writeFileSync(vaFile, '## Source Modules\n\nmodule-a\nmodule-b\n');
run(['set-gate', '--skill=rewrite', '--ado=9000', '--gate=intake_context', '--verdict=PASS',
  `--artifact-path=${vaFile}`, '--sentinel=## ', '--min-bytes=10', '--now=2026-09-08']);
const vaOk = run(['validate-artifacts', '--skill=rewrite', '--ado=9000']);
assert('GAP5: validate-artifacts all ok exits 0', vaOk.code === 0, `code=${vaOk.code}`);
assert('GAP5: validate-artifacts all ok reports 1 checked', vaOk.json.checked_count === 1, `checked=${vaOk.json.checked_count}`);
assert('GAP5: validate-artifacts all ok reports 0 issues', vaOk.json.issue_count === 0, `issues=${vaOk.json.issue_count}`);

// GAP5: validate-artifacts — artifact file missing → exit 2, status=missing
reset();
fs.mkdirSync(DIR, { recursive: true });
run(['init', '--skill=rewrite', '--ado=9000', '--now=2026-09-08']);
run(['set-gate', '--skill=rewrite', '--ado=9000', '--gate=options_approved', '--verdict=PASS',
  '--artifact-path=/nonexistent/path/options.md', '--sentinel=## Option ', '--min-bytes=100', '--now=2026-09-08']);
const vaMissing = run(['validate-artifacts', '--skill=rewrite', '--ado=9000']);
assert('GAP5: validate-artifacts missing file exits 2', vaMissing.code === 2, `code=${vaMissing.code}`);
assert('GAP5: validate-artifacts missing file reports status=missing',
  vaMissing.json.issues?.some(i => i.gate === 'options_approved' && i.status === 'missing'),
  JSON.stringify(vaMissing.json.issues));

// GAP5: validate-artifacts — artifact file exists but is 0 bytes (min_bytes not met) → status=empty
reset();
fs.mkdirSync(DIR, { recursive: true });
run(['init', '--skill=rewrite', '--ado=9000', '--now=2026-09-08']);
const emptyFile = path.join(DIR, 'empty.md');
fs.writeFileSync(emptyFile, '');
run(['set-gate', '--skill=rewrite', '--ado=9000', '--gate=cluster_spec_written', '--verdict=PASS',
  `--artifact-path=${emptyFile}`, '--min-bytes=50', '--now=2026-09-08']);
const vaEmpty = run(['validate-artifacts', '--skill=rewrite', '--ado=9000']);
assert('GAP5: validate-artifacts empty file exits 2', vaEmpty.code === 2, `code=${vaEmpty.code}`);
assert('GAP5: validate-artifacts empty file reports status=empty',
  vaEmpty.json.issues?.some(i => i.gate === 'cluster_spec_written' && i.status === 'empty'),
  JSON.stringify(vaEmpty.json.issues));

// GAP5: validate-artifacts — file present and large enough but sentinel absent → status=truncated
reset();
fs.mkdirSync(DIR, { recursive: true });
run(['init', '--skill=rewrite', '--ado=9000', '--now=2026-09-08']);
const truncFile = path.join(DIR, 'truncated.md');
fs.writeFileSync(truncFile, 'some content without the expected heading'.repeat(5));
run(['set-gate', '--skill=rewrite', '--ado=9000', '--gate=migration_log_init', '--verdict=PASS',
  `--artifact-path=${truncFile}`, '--sentinel=# Migration Log', '--min-bytes=10', '--now=2026-09-08']);
const vaTrunc = run(['validate-artifacts', '--skill=rewrite', '--ado=9000']);
assert('GAP5: validate-artifacts missing sentinel exits 2', vaTrunc.code === 2, `code=${vaTrunc.code}`);
assert('GAP5: validate-artifacts missing sentinel reports status=truncated',
  vaTrunc.json.issues?.some(i => i.gate === 'migration_log_init' && i.status === 'truncated'),
  JSON.stringify(vaTrunc.json.issues));

// GAP5: validate-artifacts — flat-string gates and REVISE verdict gates are both skipped → exit 0, 0 checked
reset();
fs.mkdirSync(DIR, { recursive: true });
run(['init', '--skill=rewrite', '--ado=9000', '--now=2026-09-08']);
run(['set-gate', '--skill=rewrite', '--ado=9000', '--gate=decision_gate', '--verdict=PASS', '--now=2026-09-08']);
run(['set-gate', '--skill=rewrite', '--ado=9000', '--gate=revise_gate', '--verdict=REVISE',
  '--artifact-path=/nonexistent.md', '--sentinel=## ', '--min-bytes=10', '--now=2026-09-08']);
const vaSkip = run(['validate-artifacts', '--skill=rewrite', '--ado=9000']);
assert('GAP5: validate-artifacts skips flat-string and non-PASS gates exits 0', vaSkip.code === 0, `code=${vaSkip.code}`);
assert('GAP5: validate-artifacts skips flat-string and non-PASS gates checks 0 artifacts',
  vaSkip.json.checked_count === 0, `checked=${vaSkip.json.checked_count}`);

// ── Phase 3: dirty-stop — writes structured stop state; validates required fields ──
reset();
fs.mkdirSync(DIR, { recursive: true });
run(['init', '--skill=rewrite', '--ado=9000', '--now=2026-09-08']);
const dsData = {
  stopped_at: 'step3-wave1-B2',
  stopped_before: 'Write Gate presentation',
  at: '2026-09-27',
  wave_current: 1,
  clusters_completed: ['auth-service'],
  clusters_pending: ['frontend'],
  reason: 'context-near-limit',
};
const dsFile = path.join(DIR, 'dirty-stop-data.json');
fs.writeFileSync(dsFile, JSON.stringify(dsData, null, 2));
const ds = run(['dirty-stop', '--skill=rewrite', '--ado=9000', `--data-file=${dsFile}`, '--now=2026-09-08']);
assert('Phase3: dirty-stop exits 0', ds.code === 0, `code=${ds.code}`);
assert('Phase3: dirty-stop payload stored in checkpoint',
  ds.json.checkpoint?.payload?.rewrite?.dirty_stop?.stopped_at === 'step3-wave1-B2',
  JSON.stringify(ds.json.checkpoint?.payload?.rewrite?.dirty_stop));
assert('Phase3: dirty-stop preserves clusters_completed array',
  JSON.stringify(ds.json.checkpoint?.payload?.rewrite?.dirty_stop?.clusters_completed) === JSON.stringify(['auth-service']),
  JSON.stringify(ds.json.checkpoint?.payload?.rewrite?.dirty_stop?.clusters_completed));

// Phase3: dirty-stop with missing data file exits 1, does not mutate checkpoint
const beforeDs = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const dsMissing = run(['dirty-stop', '--skill=rewrite', '--ado=9000', '--data-file=/nonexistent/dirty.json']);
assert('Phase3: dirty-stop missing file exits 1', dsMissing.code === 1, `code=${dsMissing.code}`);
const afterDsMissing = JSON.parse(fs.readFileSync(FILE, 'utf8'));
assert('Phase3: dirty-stop missing file does not mutate checkpoint',
  JSON.stringify(beforeDs) === JSON.stringify(afterDsMissing), 'checkpoint was mutated');

// Phase3: dirty-stop with invalid JSON exits 1
const dsBadFile = path.join(DIR, 'bad-dirty.json');
fs.writeFileSync(dsBadFile, 'NOT JSON {{{');
const dsBad = run(['dirty-stop', '--skill=rewrite', '--ado=9000', `--data-file=${dsBadFile}`]);
assert('Phase3: dirty-stop invalid JSON exits 1', dsBad.code === 1, `code=${dsBad.code}`);

// Phase3: dirty-stop with missing required fields exits 1 without writing
const dsIncompleteFile = path.join(DIR, 'incomplete-dirty.json');
fs.writeFileSync(dsIncompleteFile, JSON.stringify({ stopped_at: 'step3' })); // missing stopped_before, at, reason
const beforeIncomplete = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const dsIncomplete = run(['dirty-stop', '--skill=rewrite', '--ado=9000', `--data-file=${dsIncompleteFile}`]);
assert('Phase3: dirty-stop missing required fields exits 1', dsIncomplete.code === 1, `code=${dsIncomplete.code}`);
const afterIncomplete = JSON.parse(fs.readFileSync(FILE, 'utf8'));
assert('Phase3: dirty-stop missing required fields does not mutate checkpoint',
  JSON.stringify(beforeIncomplete) === JSON.stringify(afterIncomplete), 'checkpoint was mutated');

// Phase3: dirty_stop cleared after wave completes (set-payload with null)
run(['set-payload', '--skill=rewrite', '--ado=9000', '--payload-json={"dirty_stop":null}', '--now=2026-09-08']);
const dsCleared = JSON.parse(fs.readFileSync(FILE, 'utf8'));
assert('Phase3: dirty_stop cleared to null after wave completion',
  dsCleared.payload?.rewrite?.dirty_stop === null,
  `dirty_stop=${JSON.stringify(dsCleared.payload?.rewrite?.dirty_stop)}`);

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
