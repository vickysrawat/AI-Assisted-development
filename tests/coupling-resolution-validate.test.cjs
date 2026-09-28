#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/coupling-resolution-validate.cjs — no patterns (pass),
//                      all critical/major resolved (pass), critical missing resolution_approach
//                      (fail), facade missing external_dependencies (fail), facade missing
//                      system_name (fail), invalid migration_status (fail), missing decision_log
//                      entry (fail), minor coupling without approach (pass — not required),
//                      missing checkpoint file (fail), invalid JSON (fail).
// What it touches:     Writes temp JSON under os.tmpdir()/coupling-resolution-test-{pid}/.
// What it does NOT do: No network. No git. No mutations outside temp dir.
// How to verify:       node tests/coupling-resolution-validate.test.cjs -> "N passed · 0 failed"

'use strict';
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'coupling-resolution-validate.cjs');
const DIR    = path.join(os.tmpdir(), `coupling-resolution-test-${process.pid}`);
let pass = 0, fail = 0;

function reset() { fs.rmSync(DIR, { recursive: true, force: true }); }
function setup() { fs.mkdirSync(DIR, { recursive: true }); }
function write(name, content) {
  const p = path.join(DIR, name);
  fs.writeFileSync(p, JSON.stringify(content, null, 2));
  return p;
}
function run(checkpointPath) {
  const r = spawnSync('node', [SCRIPT, `--checkpoint=${checkpointPath}`, '--json'], { encoding: 'utf8' });
  let json = {}; try { json = JSON.parse(r.stdout || '{}'); } catch (_) {}
  return { json, code: r.status, stderr: r.stderr || '' };
}
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else       { fail++; console.log(`  ✗ ${name}\n      ${String(detail)}`); }
}

// ── helpers ──────────────────────────────────────────────────────────────────
function checkpoint(patterns, decLog = []) {
  return {
    schema_version: '1.0', skill: 'rewrite', ado_id: '9000',
    stage_gates: {}, phase_history: [],
    decision_log: decLog,
    payload: { rewrite: { coupling_patterns: patterns } },
  };
}
const COUPLING_DECLOG_ENTRY = { context: 'coupling-resolution', at: '2026-09-28', summary: 'CP-1 facade confirmed' };

reset();
setup();

// ── 1: no coupling patterns → exit 0 ─────────────────────────────────────────
const cp0 = write('cp0.json', checkpoint([]));
const r0 = run(cp0);
assert('no patterns exits 0',        r0.code === 0,              `code=${r0.code}`);
assert('no patterns status=ok',      r0.json.status === 'ok',    r0.json.status);
assert('no patterns checked=0',      r0.json.checked_count === 0, r0.json.checked_count);

// ── 2: all critical/major couplings have valid resolution → exit 0 ───────────
const cp1 = write('cp1.json', checkpoint([
  { id: 'CP-1', severity: 'critical', pattern_type: 'deployment', resolution_approach: 'replace' },
  { id: 'CP-2', severity: 'major',    pattern_type: 'technology', resolution_approach: 'retain'  },
  { id: 'CP-3', severity: 'minor',    pattern_type: 'domain'     /* no resolution_approach — OK for minor */ },
], [COUPLING_DECLOG_ENTRY]));
const r1 = run(cp1);
assert('all resolved exits 0',       r1.code === 0,              `code=${r1.code}`);
assert('all resolved status=ok',     r1.json.status === 'ok',    r1.json.status);
assert('all resolved checked=2',     r1.json.checked_count === 2, r1.json.checked_count);

// ── 3: critical coupling missing resolution_approach → exit 1 ────────────────
const cp2 = write('cp2.json', checkpoint([
  { id: 'CP-1', severity: 'critical', pattern_type: 'deployment' /* no resolution_approach */ },
], [COUPLING_DECLOG_ENTRY]));
const r2 = run(cp2);
assert('missing approach exits 1',      r2.code === 1,              `code=${r2.code}`);
assert('missing approach status=invalid', r2.json.status === 'invalid', r2.json.status);
assert('missing approach issue count=1', r2.json.issue_count === 1,    r2.json.issue_count);
assert('missing approach names field',
  r2.json.issues?.[0]?.field === 'resolution_approach', r2.json.issues?.[0]?.field);

// ── 4: invalid resolution_approach value → exit 1 ────────────────────────────
const cp3 = write('cp3.json', checkpoint([
  { id: 'CP-1', severity: 'critical', resolution_approach: 'replaced' /* typo */ },
], [COUPLING_DECLOG_ENTRY]));
const r3 = run(cp3);
assert('invalid approach value exits 1', r3.code === 1,               `code=${r3.code}`);
assert('invalid approach value issue',
  r3.json.issues?.[0]?.problem?.includes('invalid value'), r3.json.issues?.[0]?.problem);

// ── 5: facade missing external_dependencies → exit 1 ─────────────────────────
const cp4 = write('cp4.json', checkpoint([
  { id: 'CP-2', severity: 'major', pattern_type: 'technology', resolution_approach: 'facade'
    /* no external_dependencies */ },
], [COUPLING_DECLOG_ENTRY]));
const r4 = run(cp4);
assert('facade no deps exits 1',         r4.code === 1,              `code=${r4.code}`);
assert('facade no deps status=invalid',  r4.json.status === 'invalid', r4.json.status);
assert('facade no deps names field',
  r4.json.issues?.[0]?.field === 'external_dependencies', r4.json.issues?.[0]?.field);

// ── 6: facade with empty external_dependencies → exit 1 ──────────────────────
const cp5 = write('cp5.json', checkpoint([
  { id: 'CP-2', severity: 'major', resolution_approach: 'facade', external_dependencies: [] },
], [COUPLING_DECLOG_ENTRY]));
const r5 = run(cp5);
assert('facade empty deps exits 1', r5.code === 1, `code=${r5.code}`);

// ── 7: facade with valid external_dependencies → exit 0 ──────────────────────
const cp6 = write('cp6.json', checkpoint([
  {
    id: 'CP-2', severity: 'major', resolution_approach: 'facade',
    external_dependencies: [
      { system_name: 'System A', migration_status: 'out_of_scope' },
      { system_name: 'System B', migration_status: 'unknown' },
    ],
  },
], [COUPLING_DECLOG_ENTRY]));
const r6 = run(cp6);
assert('facade valid deps exits 0',   r6.code === 0,           `code=${r6.code}`);
assert('facade valid deps status=ok', r6.json.status === 'ok', r6.json.status);

// ── 8: facade with invalid migration_status → exit 1 ─────────────────────────
const cp7 = write('cp7.json', checkpoint([
  {
    id: 'CP-2', severity: 'major', resolution_approach: 'facade',
    external_dependencies: [{ system_name: 'System A', migration_status: 'not-migrating' }],
  },
], [COUPLING_DECLOG_ENTRY]));
const r7 = run(cp7);
assert('invalid migration_status exits 1', r7.code === 1, `code=${r7.code}`);
assert('invalid migration_status issue',
  r7.json.issues?.[0]?.field?.includes('migration_status'), r7.json.issues?.[0]?.field);

// ── 9: missing decision_log coupling entry → exit 1 ──────────────────────────
const cp8 = write('cp8.json', checkpoint([
  { id: 'CP-1', severity: 'critical', resolution_approach: 'replace' },
], [] /* empty decision_log */));
const r8 = run(cp8);
assert('no declog entry exits 1',         r8.code === 1,              `code=${r8.code}`);
assert('no declog entry names field',
  r8.json.issues?.some(i => i.field === 'decision_log'), JSON.stringify(r8.json.issues));

// ── 10: minor coupling without resolution_approach → exit 0 (not required) ───
const cp9 = write('cp9.json', checkpoint([
  { id: 'CP-1', severity: 'critical', resolution_approach: 'retain' },
  { id: 'CP-3', severity: 'minor' /* no approach — OK */ },
], [COUPLING_DECLOG_ENTRY]));
const r9 = run(cp9);
assert('minor no approach exits 0',   r9.code === 0,           `code=${r9.code}`);
assert('minor not counted in check',  r9.json.checked_count === 1, r9.json.checked_count);

// ── 11: missing checkpoint file → exit 1 ─────────────────────────────────────
const { code: c10 } = run('/nonexistent/path.json');
assert('missing file exits 1', c10 === 1, `code=${c10}`);

// ── 12: invalid JSON in checkpoint → exit 1 ──────────────────────────────────
const badCp = path.join(DIR, 'bad.json');
fs.writeFileSync(badCp, 'NOT JSON {{{');
const r11 = run(badCp);
assert('invalid JSON exits 1', r11.code === 1, `code=${r11.code}`);

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
