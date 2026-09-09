#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Self-contained tests for scripts/replatform-nfr-assess.cjs (AC-F8). Spawns the
//                      script per case, asserts JSON + exit codes for: measured NFR (P-U2), unmeasurable
//                      capped NFR + ceiling flag (N-U2), weakest-link behavior, and the "done" gate
//                      (regulated below floor → hard block; non-regulated → warn; meets floor → pass).
// What it touches:     Spawns `node scripts/replatform-nfr-assess.cjs`. Reads only stdout/exit. Writes NOTHING.
// What it does NOT do: No network, no disk writes, no git.
// APIs / commands:     child_process.spawnSync, assert. Run: node tests/replatform-nfr-assess.test.cjs
// How to verify:       Prints "N passed · 0 failed"; exit 0 on all-pass.

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const assert = require('assert');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'replatform-nfr-assess.cjs');
let passed = 0, failed = 0;

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  // Windows transient access-violation (0xC0000005) — retry once (see MEMORY.md).
  if (r.status > 3221225000) return spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  return r;
}
function json(args) { return JSON.parse(run(args).stdout); }
function test(name, fn) { try { fn(); passed++; console.log(`  ok  - ${name}`); } catch (e) { failed++; console.log(`  FAIL- ${name}\n        ${e.message}`); } }

// P-U2 — a measurable latency NFR with real data grades to the measured ceiling
test('assess: testable + measured evidence + real load → measured, ceiling not flagged (P-U2)', () => {
  const out = json(['assess', '--nfr=latency', '--measurability=testable', '--evidence=measured', '--load-profile=real', '--json']);
  assert.strictEqual(out.assurance, 'measured');
  assert.strictEqual(out.ceiling_flagged, false);
});

test('assess: auditable measurability can reach measured (config audit)', () => {
  const out = json(['assess', '--nfr=data-residency', '--measurability=auditable', '--evidence=measured', '--load-profile=real', '--json']);
  assert.strictEqual(out.dimensions.find(d => d.name === 'measurability-ceiling').grade, 'measured');
});

// N-U2 — an unmeasurable NFR is capped, and the ceiling is stated
test('assess: projected measurability caps assurance at projected + flags ceiling (N-U2)', () => {
  const out = json(['assess', '--nfr=cost', '--measurability=projected', '--evidence=measured', '--load-profile=real', '--json']);
  assert.strictEqual(out.assurance, 'projected');
  assert.strictEqual(out.ceiling_flagged, true);
  assert.ok(/ceiling/i.test(out.note));
});

test('assess: no load profile caps at modeled-only + flags ceiling (N-U2)', () => {
  const out = json(['assess', '--nfr=throughput', '--measurability=testable', '--evidence=measured', '--load-profile=none', '--json']);
  assert.strictEqual(out.assurance, 'modeled-only');
  assert.strictEqual(out.ceiling_flagged, true);
});

// weakest-link
test('assess: measured evidence but synthetic load → capped at drilled-partial (weakest-link)', () => {
  const out = json(['assess', '--nfr=latency', '--measurability=testable', '--evidence=measured', '--load-profile=synthetic', '--json']);
  assert.strictEqual(out.assurance, 'drilled-partial');
  assert.strictEqual(out.weakest, 'load-profile');
});

test('assess: weak evidence pulls assurance down even with testable tag + real load', () => {
  const out = json(['assess', '--nfr=availability', '--measurability=testable', '--evidence=projected', '--load-profile=real', '--json']);
  assert.strictEqual(out.assurance, 'projected');
  assert.strictEqual(out.weakest, 'evidence');
});

// gate — regulated below floor is a hard block
test('gate: regulated NFR below floor is a HARD BLOCK, exit 16', () => {
  const r = run(['gate', '--assurance=projected', '--floor=measured', '--regulated=true', '--json']);
  assert.strictEqual(r.status, 16);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.status, 'blocked');
  assert.strictEqual(out.requires_approver, true);
});

test('gate: non-regulated below floor → warn, exit 0', () => {
  const r = run(['gate', '--assurance=projected', '--floor=measured', '--json']);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(JSON.parse(r.stdout).status, 'warn');
});

test('gate: meets floor → pass, exit 0', () => {
  const r = run(['gate', '--assurance=measured', '--floor=drilled-partial', '--regulated=true', '--json']);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(JSON.parse(r.stdout).status, 'pass');
});

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
