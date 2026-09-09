#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Verifies scripts/upgrade-tool-preflight.cjs two ways: (1) unit-tests the pure
//                      evaluate() via require() for available/outdated/needs-install; (2) E2E-spawns
//                      the CLI to confirm a present tool (node, via --probe-bin) → available/exit 0,
//                      an absent tool → needs-install/exit 3 WITH printed install steps, and an
//                      unknown stack → exit 4. Exit 0 = all pass, 1 = any fail.
// What it touches:     Nothing on disk. Requires the module + spawns `node upgrade-tool-preflight.cjs`.
// What it does NOT do: No network, no installs, no git, no temp files, no project mutation.
// APIs / commands:     Node stdlib path; child_process.spawnSync('node', ...); require().
// How to verify:       node tests/upgrade-tool-preflight.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'upgrade-tool-preflight.cjs');
const { evaluate } = require(SCRIPT);
let pass = 0, fail = 0;

function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`); }
}

function runCli(args) {
  const r = spawnSync('node', [SCRIPT, ...args, '--json'], { encoding: 'utf8' });
  let json = {};
  try { json = JSON.parse(r.stdout || '{}'); } catch (_) { /* fail assertion below */ }
  return { json, code: r.status };
}

// (1) Pure evaluate() — deterministic, no environment dependency
assert('evaluate: found + version >= min → available',
  evaluate({ found: true, version: '8.0.1', min: 6 }) === 'available');
assert('evaluate: found + version < min → outdated',
  evaluate({ found: true, version: '5.0.0', min: 6 }) === 'outdated');
assert('evaluate: not found → needs-install',
  evaluate({ found: false, version: null, min: 6 }) === 'needs-install');

// (2) E2E — present tool: node stands in for the stack tool (guaranteed on PATH)
{
  const { json, code } = runCli(['--stack=nodejs', '--probe-bin=node', '--probe-args=--version', '--min=0']);
  assert('E2E present tool → status available, exit 0',
    json.status === 'available' && code === 0, `status=${json.status} code=${code}`);
  assert('E2E present tool → no install steps emitted', json.install === undefined);
}

// (2) E2E — absent tool: force a nonexistent probe binary
{
  const { json, code } = runCli(['--stack=dotnet', '--probe-bin=__ke_absent_binary__']);
  assert('E2E absent tool → status needs-install, exit 3',
    json.status === 'needs-install' && code === 3, `status=${json.status} code=${code}`);
  assert('E2E absent tool → prints install + verify steps',
    !!(json.install && json.install.command && json.install.verify), JSON.stringify(json.install));
  assert('E2E absent tool → author-only note present (LLM does not install)',
    /author-only/i.test(json.note || ''));
}

// (2) E2E — unknown stack → exit 4
{
  const { json, code } = runCli(['--stack=cobol']);
  assert('E2E unknown stack → status unknown-stack, exit 4',
    json.status === 'unknown-stack' && code === 4, `status=${json.status} code=${code}`);
}

console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
