#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Unit-tests scripts/graph-derive-documents.cjs — valid graph parse + wave
//                      schedule, cycle detection (exit 1), missing Dependencies block (exit 2),
//                      unknown document reference (exit 2), against inline fixture specs.
// What it touches:     Writes fixture .md files to tests/_gd-fixtures/ (created + removed each run).
// What it does NOT do: No network, no git, no LLM. Fixtures are the only writes; cleaned up at end.
// APIs / commands:     fs, path, child_process.spawnSync. Run: node tests/graph-derive-documents.test.cjs
// How to verify:       Prints "N passed · 0 failed"; exit 0 on all-pass.

'use strict';
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT    = path.join(__dirname, '..');
const SCRIPT  = path.join(ROOT, 'scripts', 'graph-derive-documents.cjs');
const FIXDIR  = path.join(__dirname, '_gd-fixtures');
const FENCE   = '```';

let passed = 0, failed = 0;
function test(n, fn) { try { fn(); passed++; console.log(`  ok  - ${n}`); } catch (e) { failed++; console.log(`  FAIL- ${n}\n        ${e.message}`); } }

// Build a fixture spec from {docName: [deps]} — matches the script's parse format.
function fixture(name, docs) {
  const parts = [];
  let n = 1;
  for (const [doc, deps] of Object.entries(docs)) {
    parts.push(`## Document ${n} — \`${doc}.md\``);
    parts.push('');
    parts.push('### Dependencies');
    parts.push(FENCE);
    parts.push(`depends_on: [${deps.join(', ')}]`);
    parts.push(FENCE);
    parts.push('');
    n++;
  }
  const file = path.join(FIXDIR, `${name}.md`);
  fs.writeFileSync(file, parts.join('\n'), 'utf8');
  return file;
}

// Write a raw fixture (for the missing-Dependencies-block case)
function rawFixture(name, content) {
  const file = path.join(FIXDIR, `${name}.md`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

function run(specPath) {
  const r = spawnSync(process.execPath, [SCRIPT, `--spec=${specPath}`, '--json'], { encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// ── setup ───────────────────────────────────────────────────────────────────
fs.mkdirSync(FIXDIR, { recursive: true });

// ── valid graph parses + correct waves ──────────────────────────────────────
test('valid acyclic graph → exit 0 with correct wave schedule', () => {
  const f = fixture('good', { 'doc-a': [], 'doc-b': ['doc-a'], 'doc-c': ['doc-a', 'doc-b'] });
  const { code, stdout } = run(f);
  if (code !== 0) throw new Error(`expected exit 0, got ${code}`);
  const out = JSON.parse(stdout);
  if (!out.dependency_graph || !out.waves) throw new Error('missing dependency_graph or waves');
  // Wave 1 = doc-a (no deps); Wave 2 = doc-b; Wave 3 = doc-c
  if (out.waves.length !== 3) throw new Error(`expected 3 waves, got ${out.waves.length}`);
  if (!out.waves[0].includes('doc-a')) throw new Error('wave 1 should contain doc-a');
  if (!out.waves[2].includes('doc-c')) throw new Error('wave 3 should contain doc-c');
});

// ── cycle detection ─────────────────────────────────────────────────────────
test('cyclic graph → exit 1 (cycle detected)', () => {
  const f = fixture('cycle', { 'doc-a': ['doc-b'], 'doc-b': ['doc-a'] });
  const { code, stdout } = run(f);
  if (code !== 1) throw new Error(`expected exit 1, got ${code}`);
  const out = JSON.parse(stdout);
  if (out.error !== 'cycle_detected') throw new Error(`expected cycle_detected, got ${out.error}`);
});

// ── missing Dependencies block ──────────────────────────────────────────────
test('missing ### Dependencies block → exit 2 (parse error)', () => {
  const content = [
    '## Document 1 — `doc-a.md`',
    '',
    'No dependencies block here.',
    '',
    '## Document 2 — `doc-b.md`',
    '',
    '### Dependencies',
    FENCE,
    'depends_on: []',
    FENCE,
    '',
  ].join('\n');
  const f = rawFixture('missing-deps', content);
  const { code } = run(f);
  if (code !== 2) throw new Error(`expected exit 2, got ${code}`);
});

// ── unknown document reference ──────────────────────────────────────────────
test('depends_on an unknown document → exit 2 (validation error)', () => {
  const f = fixture('unknown-ref', { 'doc-a': ['doc-z'] });  // doc-z is not defined
  const { code } = run(f);
  if (code !== 2) throw new Error(`expected exit 2, got ${code}`);
});

// ── the real spec derives cleanly ───────────────────────────────────────────
test('the live target-design-spec.md derives an acyclic 7-document graph', () => {
  const real = path.join(ROOT, 'skills', 'shared', 'migration-knowledge', 'refs', 'specs', 'target-design-spec.md');
  const { code, stdout } = run(real);
  if (code !== 0) throw new Error(`expected exit 0 on the live spec, got ${code}`);
  const out = JSON.parse(stdout);
  const docs = Object.keys(out.dependency_graph);
  if (docs.length !== 7) throw new Error(`expected 7 documents, got ${docs.length}: ${docs.join(', ')}`);
});

// ── teardown ────────────────────────────────────────────────────────────────
fs.rmSync(FIXDIR, { recursive: true, force: true });

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
