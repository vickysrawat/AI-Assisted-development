#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/upgrade-orchestrate.cjs against fixed inputs and asserts the
//                      execution-plan invariants (baseline tag is the FIRST step; exactly one commit
//                      per hop) and the verify evaluator (all-pass -> verified/merge-allowed exit 0;
//                      any fail -> blocked, first failing hop pinned, no merge, exit 9). Exit 0 = all
//                      pass, 1 = any fail.
// What it touches:     Nothing on disk. Spawns `node scripts/upgrade-orchestrate.cjs` with args only.
// What it does NOT do: No network, no git, no temp files, no mutation of plugin/project state.
// APIs / commands:     Node stdlib path; child_process.spawnSync('node', ...).
// How to verify:       node tests/upgrade-orchestrate.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const ORCH = path.join(__dirname, '..', 'scripts', 'upgrade-orchestrate.cjs');
let pass = 0, fail = 0;

function run(args) {
  const r = spawnSync('node', [ORCH, ...args, '--json'], { encoding: 'utf8' });
  let json = {};
  try { json = JSON.parse(r.stdout || '{}'); } catch (_) { /* leave empty → assertion fails */ }
  return { json, code: r.status };
}

function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); }
}

// P-U5 — a 2-hop plan: baseline tag created FIRST, exactly 2 commits (one per hop)
const p = run(['plan', '--stack=dotnet', '--from=6', '--to=8', '--hops=7,8', '--tool=dotnet upgrade-assistant', '--ado=9000']);
assert('P-U5 plan exit 0', p.code === 0, `exit ${p.code}`);
assert('P-U5 baseline tag is the FIRST step (before any edit)',
  p.json.steps?.[0]?.op === 'tag', `steps[0].op=${p.json.steps?.[0]?.op}`);
assert('P-U5 branch is the second step',
  p.json.steps?.[1]?.op === 'branch', `steps[1].op=${p.json.steps?.[1]?.op}`);
assert('P-U5 exactly one commit per hop (2 hops -> 2 commits)',
  p.json.commit_plan?.length === 2, `commit_plan.length=${p.json.commit_plan?.length}`);
assert('P-U5 no commit step precedes the tag',
  p.json.steps?.findIndex(s => s.op === 'commit') > 0 && p.json.steps[0].op === 'tag',
  'a commit appeared before the baseline tag');

// One-commit-per-hop holds for a 3-hop LTS ladder too
const p3 = run(['plan', '--stack=java', '--from=8', '--to=21', '--hops=11,17,21']);
assert('PLAN 3-hop -> 3 commits', p3.json.commit_plan?.length === 3, `commit_plan.length=${p3.json.commit_plan?.length}`);

// verify all-pass -> verified, merge allowed, exit 0
const v = run(['verify', '--hops=7,8', '--hop-results=pass,pass']);
assert('VERIFY all pass -> verified (exit 0)', v.code === 0 && v.json.status === 'verified' && v.json.merge_allowed === true,
  `code=${v.code} status=${v.json.status} merge=${v.json.merge_allowed}`);

// N-U5 — a hop fails verify -> blocked, first failing hop pinned, no merge, exit 9 + options
const n = run(['verify', '--hops=7,8', '--hop-results=pass,fail']);
assert('N-U5 hop fail -> blocked (exit 9)', n.code === 9 && n.json.status === 'blocked', `code=${n.code} status=${n.json.status}`);
assert('N-U5 failing hop pinned', n.json.failing_hop === '8', `failing_hop=${n.json.failing_hop}`);
assert('N-U5 merge not allowed', n.json.merge_allowed === false, `merge=${n.json.merge_allowed}`);
assert('N-U5 resolution options returned', Array.isArray(n.json.resolution_options) && n.json.resolution_options.length > 0,
  `options=${JSON.stringify(n.json.resolution_options)}`);

console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
