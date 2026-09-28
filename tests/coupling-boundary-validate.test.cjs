#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/coupling-boundary-validate.cjs — no splits (pass),
//                      valid splits (concerns in different clusters), unmapped concern
//                      (concern not given its own cluster, i.e. the developer merged it
//                      into another cluster without correct naming), genuine violation
//                      (two concern names normalise to the same cluster — degenerate edge
//                      case), case-insensitive normalisation, missing files, invalid JSON.
//
// Semantics note: Under the naming convention (cluster name = concern name), the primary
// error mode is UNMAPPED — a required split concern has no matching cluster, meaning the
// developer placed two concerns in a single cluster without giving each its own name.
// VIOLATION occurs when two distinct concern strings normalise to the same cluster name
// (e.g. "Business Logic" vs "business_logic" both → "business-logic").
//
// What it touches:     Writes temp JSON under os.tmpdir()/coupling-validate-test-{pid}/.
// What it does NOT do: No network. No git. No mutations outside the temp dir.
// APIs / commands:     Node stdlib: os.tmpdir, fs, path, child_process.spawnSync.
// How to verify:       node tests/coupling-boundary-validate.test.cjs -> "N passed · 0 failed"

'use strict';
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'coupling-boundary-validate.cjs');
const DIR    = path.join(os.tmpdir(), `coupling-validate-test-${process.pid}`);
let pass = 0, fail = 0;

function reset() { fs.rmSync(DIR, { recursive: true, force: true }); }
function setup() { fs.mkdirSync(DIR, { recursive: true }); }
function write(name, content) {
  const p = path.join(DIR, name);
  fs.writeFileSync(p, JSON.stringify(content, null, 2));
  return p;
}
function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args, '--json'], { encoding: 'utf8' });
  let json = {}; try { json = JSON.parse(r.stdout || '{}'); } catch (_) {}
  return { json, code: r.status, stderr: r.stderr || '' };
}
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else       { fail++; console.log(`  ✗ ${name}\n      ${String(detail)}`); }
}

function checkpoint(splits) {
  return {
    schema_version: '1.0', skill: 'rewrite', ado_id: '9000',
    stage_gates: {}, phase_history: [], decision_log: [], judge_verdicts: [],
    payload: { rewrite: { required_cluster_splits: splits } },
  };
}
function clusterSpec(clusters) { return { clusters }; }

reset();
setup();

// ── 1: no required_cluster_splits → exit 0 ───────────────────────────────────
const cp0 = write('cp0.json', checkpoint([]));
const cs0 = write('cs0.json', clusterSpec([{ name: 'business-logic', modules: [] }]));
const r0  = run([`--checkpoint=${cp0}`, `--cluster-spec=${cs0}`]);
assert('no splits exits 0',          r0.code === 0,              `code=${r0.code}`);
assert('no splits status=ok',        r0.json.status === 'ok',    r0.json.status);
assert('no splits splits_checked=0', r0.json.splits_checked === 0, r0.json.splits_checked);

// ── 2: valid splits — concerns each have their own cluster → exit 0 ───────────
const cp1 = write('cp1.json', checkpoint([
  { concern_a: 'business-logic', concern_b: 'data-access', source: 'OrderService coupling' },
]));
const cs1 = write('cs1.json', clusterSpec([
  { name: 'business-logic', modules: ['Services/OrderService.cs'] },
  { name: 'data-access',    modules: ['DAL/OrderRepository.cs']   },
]));
const r1 = run([`--checkpoint=${cp1}`, `--cluster-spec=${cs1}`]);
assert('valid splits exits 0',           r1.code === 0,              `code=${r1.code}`);
assert('valid splits status=ok',         r1.json.status === 'ok',    r1.json.status);
assert('valid splits splits_checked=1',  r1.json.splits_checked === 1, r1.json.splits_checked);
assert('valid splits 0 violations',      r1.json.violations?.length === 0, JSON.stringify(r1.json.violations));
assert('valid splits 0 unmapped',        r1.json.unmapped?.length === 0,   JSON.stringify(r1.json.unmapped));

// ── 3: UNMAPPED — developer merged data-access into business-logic cluster ────
// Primary error mode: concern "data-access" has no matching cluster name.
// This is what happens when two concerns end up in one cluster without correct naming.
const cp2 = write('cp2.json', checkpoint([
  { concern_a: 'business-logic', concern_b: 'data-access', source: 'OrderService coupling' },
]));
const cs2 = write('cs2.json', clusterSpec([
  { name: 'business-logic', modules: ['Services/OrderService.cs', 'DAL/OrderRepository.cs'] },
  { name: 'auth',           modules: ['Auth/AuthService.cs'] },
  // No 'data-access' cluster → concern is UNMAPPED
]));
const r2 = run([`--checkpoint=${cp2}`, `--cluster-spec=${cs2}`]);
assert('merged concern exits 1',            r2.code === 1,              `code=${r2.code}`);
assert('merged concern status=invalid',     r2.json.status === 'invalid', r2.json.status);
assert('merged concern 0 violations',       r2.json.violations?.length === 0, r2.json.violations?.length);
assert('merged concern 1 unmapped',         r2.json.unmapped?.length === 1,   r2.json.unmapped?.length);
assert('merged concern names data-access',
  r2.json.unmapped?.[0]?.concern === 'data-access', r2.json.unmapped?.[0]?.concern);

// ── 4: VIOLATION — two concern strings normalise to the same cluster ───────────
// Edge case: "Business Logic" and "business_logic" both normalise to "business-logic".
// Both found in the same cluster → VIOLATION.
const cp3 = write('cp3.json', checkpoint([
  { concern_a: 'Business Logic', concern_b: 'business_logic', source: 'degenerate normalisation test' },
]));
const cs3 = write('cs3.json', clusterSpec([
  { name: 'business-logic', modules: [] },  // both concerns normalise to this cluster
  { name: 'data-access',    modules: [] },
]));
const r3 = run([`--checkpoint=${cp3}`, `--cluster-spec=${cs3}`]);
assert('normalisation violation exits 1',       r3.code === 1,                r3.code);
assert('normalisation violation status=invalid', r3.json.status === 'invalid', r3.json.status);
assert('normalisation violation 1 violation',   r3.json.violations?.length === 1, r3.json.violations?.length);
assert('normalisation violation shared_cluster', r3.json.violations?.[0]?.shared_cluster === 'business-logic', r3.json.violations?.[0]?.shared_cluster);

// ── 5: purely unmapped concern (not in any cluster) → exit 1 ─────────────────
const cp4 = write('cp4.json', checkpoint([
  { concern_a: 'business-logic', concern_b: 'nonexistent', source: 'test' },
]));
const cs4 = write('cs4.json', clusterSpec([
  { name: 'business-logic', modules: [] },
  { name: 'data-access',    modules: [] },
]));
const r4 = run([`--checkpoint=${cp4}`, `--cluster-spec=${cs4}`]);
assert('unmapped exits 1',             r4.code === 1,                `code=${r4.code}`);
assert('unmapped status=invalid',      r4.json.status === 'invalid', r4.json.status);
assert('unmapped 1 unmapped entry',    r4.json.unmapped?.length === 1, r4.json.unmapped?.length);
assert('unmapped names the concern',
  r4.json.unmapped?.[0]?.concern === 'nonexistent', r4.json.unmapped?.[0]?.concern);

// ── 6: multiple splits — one valid, one unmapped → exit 1 ────────────────────
const cp5 = write('cp5.json', checkpoint([
  { concern_a: 'auth',           concern_b: 'core-api',       source: 'auth in API' },  // valid
  { concern_a: 'business-logic', concern_b: 'missing-concern', source: 'test' },         // unmapped
]));
const cs5 = write('cs5.json', clusterSpec([
  { name: 'auth',           modules: [] },
  { name: 'core-api',       modules: [] },
  { name: 'business-logic', modules: [] },
]));
const r5 = run([`--checkpoint=${cp5}`, `--cluster-spec=${cs5}`]);
assert('mixed exits 1',                r5.code === 1,               `code=${r5.code}`);
assert('mixed splits_checked=2',       r5.json.splits_checked === 2, r5.json.splits_checked);
assert('mixed 0 violations',           r5.json.violations?.length === 0, r5.json.violations?.length);
assert('mixed 1 unmapped',             r5.json.unmapped?.length === 1,   r5.json.unmapped?.length);
assert('mixed unmapped names concern',
  r5.json.unmapped?.[0]?.concern === 'missing-concern', r5.json.unmapped?.[0]?.concern);

// ── 7: case-insensitive + space→hyphen normalisation → exit 0 ────────────────
const cp6 = write('cp6.json', checkpoint([
  { concern_a: 'Business Logic', concern_b: 'Data Access', source: 'normalisation' },
]));
const cs6 = write('cs6.json', clusterSpec([
  { name: 'business-logic', modules: [] },  // matches "Business Logic" → "business-logic"
  { name: 'data-access',    modules: [] },  // matches "Data Access" → "data-access"
]));
const r6 = run([`--checkpoint=${cp6}`, `--cluster-spec=${cs6}`]);
assert('case normalisation exits 0',   r6.code === 0,           `code=${r6.code}`);
assert('case normalisation status=ok', r6.json.status === 'ok', r6.json.status);

// ── 8: missing --checkpoint file → exit 1 ────────────────────────────────────
const r7 = run([`--checkpoint=/nonexistent/path.json`, `--cluster-spec=${cs1}`]);
assert('missing checkpoint exits 1', r7.code === 1, `code=${r7.code}`);

// ── 9: missing --cluster-spec file → exit 1 ──────────────────────────────────
const r8 = run([`--checkpoint=${cp1}`, `--cluster-spec=/nonexistent/path.json`]);
assert('missing cluster-spec exits 1', r8.code === 1, `code=${r8.code}`);

// ── 10: invalid JSON in checkpoint → exit 1 ──────────────────────────────────
const badCp = path.join(DIR, 'bad-cp.json');
fs.writeFileSync(badCp, 'NOT JSON {{{');
const r9 = run([`--checkpoint=${badCp}`, `--cluster-spec=${cs1}`]);
assert('invalid checkpoint JSON exits 1', r9.code === 1, `code=${r9.code}`);

// ── 11: checkpoint with no rewrite payload → no splits → exit 0 ──────────────
const cpNoPl = write('cp-no-payload.json', { schema_version: '1.0', stage_gates: {}, payload: {} });
const r10 = run([`--checkpoint=${cpNoPl}`, `--cluster-spec=${cs1}`]);
assert('no rewrite payload exits 0',          r10.code === 0,              `code=${r10.code}`);
assert('no rewrite payload status=ok',        r10.json.status === 'ok',    r10.json.status);
assert('no rewrite payload splits_checked=0', r10.json.splits_checked === 0, r10.json.splits_checked);

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
