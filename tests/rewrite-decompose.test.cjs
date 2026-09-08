#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/rewrite-decompose.cjs and asserts: posture resolves to `port`
//                      only for same-lang+same-fw (P-U2), refuses port + forces re-architecture on a
//                      language change (N-U2), and drops to rewrite-from-spec with no runnable oracle;
//                      and that decompose produces target-space clusters + an ACYCLIC dependency DAG
//                      with correct topological waves (P-U1), while a cyclic input is reported (exit
//                      11), not silently emitted. Exit 0 = all pass.
// What it touches:     Nothing on disk. Spawns `node scripts/rewrite-decompose.cjs` with args only.
// What it does NOT do: No network, no git, no temp files, no mutation.
// APIs / commands:     Node stdlib path; child_process.spawnSync('node', ...).
// How to verify:       node tests/rewrite-decompose.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const DEC = path.join(__dirname, '..', 'scripts', 'rewrite-decompose.cjs');
let pass = 0, fail = 0;

function run(args) {
  const r = spawnSync('node', [DEC, ...args, '--json'], { encoding: 'utf8' });
  let json = {}; try { json = JSON.parse(r.stdout || '{}'); } catch (_) {}
  return { json, code: r.status };
}
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); }
}

// P-U2 — same language + same framework -> port offered
const p2 = run(['posture', '--source-lang=csharp', '--source-fw=aspnet', '--target-lang=csharp', '--target-fw=aspnet']);
assert('P-U2 same-lang+same-fw -> port', p2.json.posture === 'port' && p2.json.port_offered === true, JSON.stringify(p2.json));

// N-U2 — different language -> port refused, re-architecture forced with keep-vs-redesign questions
const n2 = run(['posture', '--source-lang=java', '--source-fw=spring', '--target-lang=csharp', '--target-fw=aspnet']);
assert('N-U2 different language -> re-architecture (port refused)',
  n2.json.posture === 're-architecture' && n2.json.port_offered === false, JSON.stringify(n2.json));
assert('N-U2 surfaces keep-vs-redesign questions', (n2.json.questions || []).some(q => /keep|redesign/i.test(q)), JSON.stringify(n2.json.questions));

// framework change alone (same language) -> still re-architecture, not port
const fw = run(['posture', '--source-lang=js', '--source-fw=express', '--target-lang=js', '--target-fw=nest']);
assert('framework change -> re-architecture (not port)', fw.json.posture === 're-architecture' && fw.json.port_offered === false, JSON.stringify(fw.json));

// no runnable oracle -> rewrite-from-spec
const rf = run(['posture', '--source-lang=cobol', '--target-lang=java', '--oracle=none']);
assert('no oracle -> rewrite-from-spec', rf.json.posture === 'rewrite-from-spec', JSON.stringify(rf.json));

// P-U1 — decompose a module graph -> clusters + acyclic DAG + correct waves
const p1 = run(['decompose', '--modules=auth,orders,shared', '--edges=auth>shared,orders>shared,orders>auth']);
assert('P-U1 decompose exit 0 (acyclic)', p1.code === 0 && p1.json.acyclic === true, `code=${p1.code} acyclic=${p1.json.acyclic}`);
assert('P-U1 one cluster per module', p1.json.clusters?.length === 3, JSON.stringify(p1.json.clusters));
assert('P-U1 shared is wave 1 (no deps)', JSON.stringify(p1.json.waves?.[0]) === JSON.stringify(['shared']), JSON.stringify(p1.json.waves));
assert('P-U1 orders is last (depends on auth+shared)', p1.json.order?.[p1.json.order.length - 1] === 'orders', JSON.stringify(p1.json.order));

// cycle detection -> exit 11, cycle reported, not silently ordered
const cyc = run(['decompose', '--modules=a,b', '--edges=a>b,b>a']);
assert('CYCLE detected -> exit 11 + acyclic=false', cyc.code === 11 && cyc.json.acyclic === false, `code=${cyc.code} acyclic=${cyc.json.acyclic}`);
assert('CYCLE names the members', (cyc.json.cycles || []).includes('a') && cyc.json.cycles.includes('b'), JSON.stringify(cyc.json.cycles));

console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
