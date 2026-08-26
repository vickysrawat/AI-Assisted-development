#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs verify-inventory-trace.cjs against the _selftest GOOD fixture (asserts
//                      exit 0) and the BAD fixture + dangling-ref feasibility (asserts exit 1 and that
//                      each planted defect is named). ALSO runs golden-master-replay.cjs against the
//                      _selftest-gm fixtures (target-good asserts GATE PASS/exit 0; target-drift
//                      asserts HIGH-risk drift GATE FAIL/exit 1). Prints per-assertion PASS/FAIL.
// What it touches:     READ-ONLY. Spawns node on the verifier against committed fixtures under
//                      tests/migration-validation/fixtures/_selftest/. Creates/modifies nothing.
// What it does NOT do: No writes, no network, no git operations, no LLM calls.
// APIs / commands:     Node path, child_process.spawnSync(process.execPath, ...).
// How to verify:       node tests/migration-validation/run-selftest.cjs — exits 0 if all pass, else 1.

'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const VERIFIER = path.join(HERE, 'verify-inventory-trace.cjs');
const FIX = path.join(HERE, 'fixtures', '_selftest');
const SOURCE = path.join(FIX, 'source');
const GOOD = path.join(FIX, 'good', 'ADO-0001-source-inventory.md');
const BAD = path.join(FIX, 'bad', 'ADO-0001-source-inventory.md');
const BAD_FEAS = path.join(FIX, 'bad', 'ADO-0001-migration-feasibility.md');

const GM = path.join(HERE, 'golden-master-replay.cjs');
const GMFIX = path.join(HERE, 'fixtures', '_selftest-gm');
const GM_REC = path.join(GMFIX, 'recordings');
const GM_GOOD = path.join(GMFIX, 'target-good');
const GM_DRIFT = path.join(GMFIX, 'target-drift');

function runScript(script, args) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function run(args) { return runScript(VERIFIER, args); }

const results = [];
function assert(name, cond) { results.push({ name, ok: !!cond }); }

// GOOD fixture → PASS (exit 0)
const good = run(['--inventory', GOOD, '--source', SOURCE]);
assert('good fixture exits 0', good.status === 0);
assert('good fixture reports 100% coverage', /Coverage:\s*100%/.test(good.out));

// BAD fixture → FAIL (exit 1) with each planted defect named
const bad = run(['--inventory', BAD, '--source', SOURCE, '--feasibility', BAD_FEAS]);
assert('bad fixture exits 1', bad.status === 1);
assert('bad flags out-of-range line', /LINE OUT OF RANGE/.test(bad.out));
assert('bad flags missing file', /MISSING FILE/.test(bad.out));
assert('bad flags item without PROV', /ITEM WITHOUT PROV/.test(bad.out));
assert('bad flags dangling spine ref (F-99)', /DANGLING SPINE REF\s+F-99/.test(bad.out));

// GOLDEN-MASTER mechanics: good target → all match, gate passes, INFERRED matches promotable
const gmGood = runScript(GM, ['--recordings', GM_REC, '--target', GM_GOOD]);
assert('gm good exits 0', gmGood.status === 0);
assert('gm good gate passes', /GATE PASS/.test(gmGood.out));
assert('gm good promotes INFERRED matches', /2 promotable/.test(gmGood.out));

// GOLDEN-MASTER mechanics: drift target → HIGH-risk drift, gate fails
const gmDrift = runScript(GM, ['--recordings', GM_REC, '--target', GM_DRIFT]);
assert('gm drift exits 1', gmDrift.status === 1);
assert('gm drift gate fails on HIGH-risk drift', /GATE FAIL/.test(gmDrift.out));
assert('gm drift flags F-03 drift', /F-03 \[HIGH\] drift/.test(gmDrift.out));

// ---------- report ----------
let failed = 0;
console.log('\n  verify-inventory-trace — self-test');
console.log(`  ${'─'.repeat(52)}`);
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`);
  if (!r.ok) failed++;
}
console.log(`  ${'─'.repeat(52)}`);
console.log(`  ${failed === 0 ? '✓ ALL PASS' : `✗ ${failed} FAILED`}  (${results.length} assertions)\n`);
process.exit(failed === 0 ? 0 : 1);
