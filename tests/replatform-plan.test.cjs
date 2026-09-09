#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Self-contained tests for scripts/replatform-plan.cjs (AC-F7). Spawns the script
//                      per case, asserts JSON output + exit codes for: landing-zone Tier-0 plan (P-U1),
//                      intake cicd/iac passthrough, executor-seam denial with flag OFF (N-U1), author
//                      allowed, prod/regulated barred even with autonomy ON, and the reconciliation
//                      gate (N-U5).
// What it touches:     Spawns `node scripts/replatform-plan.cjs`. Reads only stdout/exit. Writes NOTHING.
// What it does NOT do: No network, no disk writes, no git.
// APIs / commands:     child_process.spawnSync, assert. Run: node tests/replatform-plan.test.cjs
// How to verify:       Prints "N passed · 0 failed"; exit 0 on all-pass.

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const assert = require('assert');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'replatform-plan.cjs');
let passed = 0, failed = 0;

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  // Windows transient access-violation (0xC0000005) — retry once (see MEMORY.md).
  if (r.status > 3221225000) return spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  return r;
}
function json(args) { return JSON.parse(run(args).stdout); }
function test(name, fn) { try { fn(); passed++; console.log(`  ok  - ${name}`); } catch (e) { failed++; console.log(`  FAIL- ${name}\n        ${e.message}`); } }

// P-U1 — plan puts the landing zone at Tier-0, index 0, with workloads depending on it
test('plan: landing-zone is Tier-0 index 0; workloads depend on it (P-U1)', () => {
  const out = json(['plan', '--target=azure', '--capabilities=compute,data', '--json']);
  assert.strictEqual(out.plan[0].tier, 0);
  assert.strictEqual(out.plan[0].capability, 'landing-zone');
  assert.deepStrictEqual(out.plan[0].depends_on, []);
  const workloads = out.plan.filter(p => p.tier > 0);
  assert.ok(workloads.length === 2, 'compute + data workloads present');
  workloads.forEach(w => assert.ok(w.depends_on.includes('landing-zone'), `${w.capability} depends on landing-zone`));
});

test('plan: authors all four runbooks, none executed, applied:false (P-U1)', () => {
  const out = json(['plan', '--json']);
  assert.deepStrictEqual(out.runbooks.map(r => r.name), ['migration', 'reconciliation', 'cutover', 'rollback']);
  assert.ok(out.runbooks.every(r => r.executed === false && r.executed_by === 'human'));
  assert.strictEqual(out.execution.applied, false);
});

test('plan: a landing-zone capability passed as input is folded into Tier-0', () => {
  const out = json(['plan', '--capabilities=identity,compute', '--json']);
  assert.ok(out.plan[0].folds.includes('identity'), 'identity folded into landing-zone');
  assert.ok(!out.plan.some(p => p.tier > 0 && p.capability === 'identity'), 'identity not a separate workload');
});

test('plan: records intake-captured cicd_platform + iac_flavor when provided', () => {
  const out = json(['plan', '--target=azure', '--cicd-platform=azure-devops', '--iac-flavor=bicep', '--json']);
  assert.strictEqual(out.cicd_platform, 'azure-devops');
  assert.strictEqual(out.iac_flavor, 'bicep');
});

test('plan: cicd_platform + iac_flavor default to unspecified until intake answers them', () => {
  const out = json(['plan', '--json']);
  assert.strictEqual(out.cicd_platform, 'unspecified');
  assert.strictEqual(out.iac_flavor, 'unspecified');
});

// N-U1 — real action denied with the flag OFF (default)
test('execute: apply denied with autonomy OFF by default, exit 14 (N-U1)', () => {
  const r = run(['execute', '--action=apply', '--json']);
  assert.strictEqual(r.status, 14);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.authorized, false);
  assert.strictEqual(out.applied, false);
});

test('execute: cutover denied with autonomy OFF, exit 14 (N-U1)', () => {
  const r = run(['execute', '--action=cutover', '--json']);
  assert.strictEqual(r.status, 14);
  assert.strictEqual(JSON.parse(r.stdout).authorized, false);
});

test('execute: author-time action authorized, exit 0', () => {
  const r = run(['execute', '--action=author', '--json']);
  assert.strictEqual(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.authorized, true);
  assert.strictEqual(out.applied, false);
});

// prod / regulated barred even with autonomy ON
test('execute: apply to prod denied even with autonomy ON, exit 14', () => {
  const r = run(['execute', '--action=apply', '--env=prod', '--autonomy=on', '--json']);
  assert.strictEqual(r.status, 14);
  assert.strictEqual(JSON.parse(r.stdout).authorized, false);
});

test('execute: regulated apply denied even with autonomy ON + non-prod, exit 14', () => {
  const r = run(['execute', '--action=apply', '--env=staging', '--autonomy=on', '--regulated=true', '--json']);
  assert.strictEqual(r.status, 14);
  assert.strictEqual(JSON.parse(r.stdout).authorized, false);
});

test('execute: apply authorized (decision-only) for non-prod non-regulated with autonomy ON; applied still false', () => {
  const r = run(['execute', '--action=apply', '--env=dev', '--autonomy=on', '--json']);
  assert.strictEqual(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.authorized, true);
  assert.strictEqual(out.applied, false);
});

// N-U5 — reconciliation gate blocks cutover on a failed step
test('reconcile-gate: a failing step blocks cutover, exit 15 (N-U5)', () => {
  const r = run(['reconcile-gate', '--steps-total=10', '--steps-passing=9', '--json']);
  assert.strictEqual(r.status, 15);
  assert.strictEqual(JSON.parse(r.stdout).status, 'blocked');
});

test('reconcile-gate: named failed step blocks cutover, exit 15 (N-U5)', () => {
  const r = run(['reconcile-gate', '--steps-total=5', '--steps-passing=5', '--failed-step=orders.balance-invariant', '--json']);
  assert.strictEqual(r.status, 15);
  assert.ok(JSON.parse(r.stdout).failed_step.includes('orders.balance-invariant'));
});

test('reconcile-gate: all steps pass, exit 0', () => {
  const r = run(['reconcile-gate', '--steps-total=8', '--steps-passing=8', '--json']);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(JSON.parse(r.stdout).status, 'pass');
});

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
