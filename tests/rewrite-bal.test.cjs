#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/rewrite-bal.cjs and asserts: a full runnable-oracle cluster with
//                      high coverage grades BAL A/B with mechanical denominators (P-U3); a cluster
//                      with no runnable oracle is capped at C/D with the ceiling flagged (N-U1); the
//                      merge gate blocks provisional BAL D (exit 12); and the completion gate
//                      HARD-BLOCKS a B-series cluster below the floor with a named-approver message
//                      (exit 13, N-U3) while passing one that meets the floor. Exit 0 = all pass.
// What it touches:     Nothing on disk. Spawns `node scripts/rewrite-bal.cjs` with args only.
// What it does NOT do: No network, no git, no temp files, no mutation.
// APIs / commands:     Node stdlib path; child_process.spawnSync('node', ...).
// How to verify:       node tests/rewrite-bal.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const BAL = path.join(__dirname, '..', 'scripts', 'rewrite-bal.cjs');
let pass = 0, fail = 0;

function run(args) {
  const r = spawnSync('node', [BAL, ...args, '--json'], { encoding: 'utf8' });
  let json = {}; try { json = JSON.parse(r.stdout || '{}'); } catch (_) {}
  return { json, code: r.status };
}
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); }
}

// P-U3 — full runnable oracle + high coverage -> BAL A, mechanical denominator surfaced
const a = run(['bal', '--cluster=auth', '--oracle=runnable', '--behaviors-total=10', '--behaviors-verified=10', '--tests-total=20', '--tests-passing=20']);
assert('P-U3 full oracle+coverage -> BAL A', a.json.bal === 'A', JSON.stringify(a.json));
assert('P-U3 mechanical denominator surfaced', (a.json.dimensions || []).some(d => d.name === 'coverage' && /10\/10/.test(d.detail)), JSON.stringify(a.json.dimensions));
// runnable oracle + 0.7 coverage -> B (weakest-link on coverage)
const b = run(['bal', '--cluster=orders', '--oracle=runnable', '--behaviors-total=10', '--behaviors-verified=7']);
assert('runnable + 0.70 coverage -> BAL B', b.json.bal === 'B', JSON.stringify(b.json));

// N-U1 — no runnable oracle -> capped at C/D, ceiling flagged (even with perfect coverage)
const n1 = run(['bal', '--cluster=legacy', '--oracle=none', '--behaviors-total=10', '--behaviors-verified=10']);
assert('N-U1 no oracle -> capped at C (not A)', n1.json.bal === 'C' && n1.json.ceiling_flagged === true, JSON.stringify(n1.json));
assert('N-U1 weakest link is the oracle', n1.json.weakest === 'oracle', JSON.stringify(n1.json));
const n1d = run(['bal', '--cluster=legacy2', '--oracle=none', '--behaviors-total=10', '--behaviors-verified=0']);
assert('N-U1 no oracle + no verification -> D', n1d.json.bal === 'D', JSON.stringify(n1d.json));

// merge gate — provisional BAL D blocks (exit 12); C passes
const mgD = run(['merge-gate', '--bal=D']);
assert('MERGE-GATE provisional D -> blocked (exit 12)', mgD.code === 12 && mgD.json.status === 'blocked', `code=${mgD.code} status=${mgD.json.status}`);
const mgC = run(['merge-gate', '--bal=C']);
assert('MERGE-GATE provisional C -> pass (exit 0)', mgC.code === 0 && mgC.json.status === 'pass', `code=${mgC.code} status=${mgC.json.status}`);

// N-U3 — completion gate hard-blocks B-series below floor with named-approver message (exit 13)
const cg = run(['completion-gate', '--bal=C', '--floor=B', '--b-series=true']);
assert('N-U3 B-series below floor -> hard-block (exit 13)', cg.code === 13 && cg.json.status === 'blocked', `code=${cg.code} status=${cg.json.status}`);
assert('N-U3 requires named approver + reason', cg.json.requires_approver === true && /named approver/i.test(cg.json.reason), JSON.stringify(cg.json));
// non-B-series below floor -> warn (allowed), not hard-block
const cgw = run(['completion-gate', '--bal=C', '--floor=B', '--b-series=false']);
assert('completion-gate non-B-series below floor -> warn (exit 0)', cgw.code === 0 && cgw.json.status === 'warn', `code=${cgw.code} status=${cgw.json.status}`);
// meets floor -> pass
const cgp = run(['completion-gate', '--bal=B', '--floor=B', '--b-series=true']);
assert('completion-gate meets floor -> pass', cgp.code === 0 && cgp.json.status === 'pass', `code=${cgp.code} status=${cgp.json.status}`);

console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
