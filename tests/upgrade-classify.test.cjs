#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/upgrade-classify.cjs against fixed input cases and asserts the
//                      classification, selected tool, multi-hop path, and exit code for: a .NET
//                      minor upgrade, a Java LTS-ladder jump, an Angular one-major step, a
//                      .NET Framework->Core false-upgrade, a Python 2->3 false-upgrade, an
//                      unsupported stack, and a downgrade. Exit 0 = all pass, 1 = any fail.
// What it touches:     Nothing on disk. Spawns `node scripts/upgrade-classify.cjs` with args only.
// What it does NOT do: No network, no git, no temp files, no mutation of plugin/project state.
// APIs / commands:     Node stdlib path; child_process.spawnSync('node', ...).
// How to verify:       node tests/upgrade-classify.test.cjs  -> exit 0 and "7 passed · 0 failed".

'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const CLASSIFY = path.join(__dirname, '..', 'scripts', 'upgrade-classify.cjs');
let pass = 0, fail = 0;

function run(args) {
  const r = spawnSync('node', [CLASSIFY, ...args, '--json'], { encoding: 'utf8' });
  let json = {};
  try { json = JSON.parse(r.stdout || '{}'); } catch (_) { /* leave empty → assertion fails */ }
  return { json, code: r.status };
}

function check(name, args, expect) {
  const { json, code } = run(args);
  const errs = [];
  if (expect.classification && json.classification !== expect.classification)
    errs.push(`classification ${json.classification} !== ${expect.classification}`);
  if (expect.code !== undefined && code !== expect.code) errs.push(`exit ${code} !== ${expect.code}`);
  if (expect.route && json.route !== expect.route) errs.push(`route ${json.route} !== ${expect.route}`);
  if (expect.tool && json.tool !== expect.tool) errs.push(`tool ${json.tool} !== ${expect.tool}`);
  if (expect.hops && JSON.stringify(json.hops) !== JSON.stringify(expect.hops))
    errs.push(`hops ${JSON.stringify(json.hops)} !== ${JSON.stringify(expect.hops)}`);

  if (errs.length === 0) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${errs.join('\n      ')}`); }
}

// Positive — real in-place upgrades
check('P-U1 .NET 6->8 -> upgrade, upgrade-assistant, hops [7,8]',
  ['--stack=dotnet', '--from=6', '--to=8'],
  { classification: 'upgrade', code: 0, tool: 'dotnet upgrade-assistant', hops: [7, 8] });
check('P-U2 Java 8->21 -> upgrade, OpenRewrite, LTS ladder [11,17,21]',
  ['--stack=java', '--from=8', '--to=21'],
  { classification: 'upgrade', code: 0, tool: 'OpenRewrite', hops: [11, 17, 21] });
check('P-U3 Angular 15->17 -> upgrade, ng update, one major at a time [16,17]',
  ['--stack=angular', '--from=15', '--to=17'],
  { classification: 'upgrade', code: 0, tool: 'ng update', hops: [16, 17] });

// Negative — false-upgrades (must route to Rewrite, exit 3)
check('N-U1 .NET Framework->.NET -> false-upgrade -> rewrite (exit 3)',
  ['--stack=dotnet_framework', '--to-stack=dotnet'],
  { classification: 'false-upgrade', code: 3, route: 'rewrite' });
check('N-U2 Python 2.7->3.11 -> false-upgrade -> rewrite (exit 3)',
  ['--stack=python', '--from=2.7', '--to=3.11'],
  { classification: 'false-upgrade', code: 3, route: 'rewrite' });

// Negative — unsupported + invalid
check('N-U3 unsupported stack (exit 4)',
  ['--stack=cobol', '--from=85', '--to=2014'],
  { classification: 'unsupported', code: 4 });
check('N-U4 downgrade .NET 8->6 -> invalid (exit 5)',
  ['--stack=dotnet', '--from=8', '--to=6'],
  { classification: 'invalid', code: 5 });

console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
