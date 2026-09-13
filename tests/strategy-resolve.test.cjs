#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Unit-tests scripts/strategy-resolve.cjs — resolves live profiles (dotnet
//                      verified, python unverified), honest-refusal on a missing target (exit 4),
//                      not-implemented STATUS (exit 3), incomplete token contract (exit 2), and the
//                      caller-supplied subset mode (Replatform verify-only).
// What it touches:     Writes fixture .md files to tests/_sr-fixtures/ (created + removed each run).
// What it does NOT do: No network, no git, no LLM. Fixtures are the only writes; cleaned up at end.
// APIs / commands:     fs, path, child_process.spawnSync. Run: node tests/strategy-resolve.test.cjs
// How to verify:       Prints "N passed · 0 failed"; exit 0 on all-pass.

'use strict';
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT   = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'strategy-resolve.cjs');
const FIXDIR = path.join(__dirname, '_sr-fixtures');
const LIVEDIR = path.join(ROOT, 'skills', 'shared', 'migration-knowledge', 'refs', 'strategies');

const FULL_CONTRACT = [
  'STACK', 'SKELETON', 'STANDARDS_EXAMPLE', 'BUILD', 'TEST_CLUSTER', 'TEST_ALL',
  'TEST_FRAMEWORK', 'COVERAGE', 'LAYOUT', 'COMPOSITION', 'CONFIG', 'BUILD_UNIT',
  'RULES', 'PKG_ADD', 'SERVE', 'E2E', 'FITNESS',
];

let passed = 0, failed = 0;
function test(n, fn) { try { fn(); passed++; console.log(`  ok  - ${n}`); } catch (e) { failed++; console.log(`  FAIL- ${n}\n        ${e.message}`); } }

function run(target, extra) {
  const argv = [SCRIPT, `--target=${target}`, '--json', `--strategies-dir=${extra && extra.dir ? extra.dir : LIVEDIR}`];
  if (extra && extra.tokens) argv.push(`--tokens=${extra.tokens}`);
  const r = spawnSync(process.execPath, argv, { encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Build a fixture profile with a chosen STATUS and a chosen set of tokens present.
function fixtureProfile(name, { status, tokens = FULL_CONTRACT, maturity }) {
  const lines = [`# Target Execution Profile: ${name}`, ''];
  if (status !== null) lines.push(`STATUS: ${status}`);
  lines.push('ROLE: backend (single-track)');
  if (maturity) lines.push(`MATURITY: ${maturity}`);
  lines.push('');
  for (const tok of tokens) { lines.push(`## ${tok}`, `body for ${tok}`, ''); }
  fs.writeFileSync(path.join(FIXDIR, `${name}.md`), lines.join('\n'), 'utf8');
}

// ── setup ───────────────────────────────────────────────────────────────────
fs.mkdirSync(FIXDIR, { recursive: true });

// ── live profiles resolve ────────────────────────────────────────────────────
test('live dotnet profile → exit 0, resolved, verified (no ⚠ maturity)', () => {
  const { code, stdout } = run('dotnet');
  if (code !== 0) throw new Error(`expected exit 0, got ${code}`);
  const out = JSON.parse(stdout);
  if (!out.resolved) throw new Error('expected resolved=true');
  if (out.unverified !== false) throw new Error('dotnet should be verified (unverified=false)');
});

test('live python profile → exit 0, resolved, unverified (⚠ maturity surfaced)', () => {
  const { code, stdout } = run('python');
  if (code !== 0) throw new Error(`expected exit 0, got ${code}`);
  const out = JSON.parse(stdout);
  if (!out.resolved) throw new Error('expected resolved=true');
  if (out.unverified !== true) throw new Error('python should be unverified (unverified=true)');
});

// ── honest refusal: unknown target ───────────────────────────────────────────
test('unknown target → exit 4 (missing; no fallback)', () => {
  const { code, stdout } = run('cobol');
  if (code !== 4) throw new Error(`expected exit 4, got ${code}`);
  const out = JSON.parse(stdout);
  if (out.reason !== 'missing') throw new Error(`expected reason=missing, got ${out.reason}`);
});

// ── not-implemented STATUS ───────────────────────────────────────────────────
test('STATUS: not-implemented → exit 3', () => {
  fixtureProfile('stubby', { status: 'not-implemented' });
  const { code, stdout } = run('stubby', { dir: FIXDIR });
  if (code !== 3) throw new Error(`expected exit 3, got ${code}`);
  const out = JSON.parse(stdout);
  if (out.reason !== 'not-implemented') throw new Error(`expected reason=not-implemented, got ${out.reason}`);
});

test('absent STATUS line → exit 3 (not runnable)', () => {
  fixtureProfile('nostatus', { status: null });
  const { code } = run('nostatus', { dir: FIXDIR });
  if (code !== 3) throw new Error(`expected exit 3, got ${code}`);
});

// ── implemented but incomplete token contract ────────────────────────────────
test('implemented but missing a required token → exit 2 (malformed)', () => {
  const partial = FULL_CONTRACT.filter(t => t !== 'SERVE');  // drop SERVE
  fixtureProfile('partial', { status: 'implemented', tokens: partial });
  const { code, stdout } = run('partial', { dir: FIXDIR });
  if (code !== 2) throw new Error(`expected exit 2, got ${code}`);
  const out = JSON.parse(stdout);
  if (!out.missing_tokens.includes('SERVE')) throw new Error('expected SERVE in missing_tokens');
});

// ── subset mode (Replatform verify-only) ─────────────────────────────────────
test('subset --tokens verifies only the requested subset → exit 0', () => {
  // A profile with ONLY the verify subset present passes when only that subset is required.
  fixtureProfile('vonly', { status: 'implemented', tokens: ['BUILD', 'TEST_ALL', 'SERVE', 'E2E'] });
  const { code } = run('vonly', { dir: FIXDIR, tokens: 'BUILD,TEST_ALL,SERVE,E2E' });
  if (code !== 0) throw new Error(`expected exit 0 for subset, got ${code}`);
  // ...but fails the FULL contract (missing scaffold tokens).
  const full = run('vonly', { dir: FIXDIR });
  if (full.code !== 2) throw new Error(`expected exit 2 under full contract, got ${full.code}`);
});

test('live dotnet resolves under the Replatform verify subset → exit 0', () => {
  const { code } = run('dotnet', { tokens: 'BUILD,TEST_ALL,SERVE,E2E' });
  if (code !== 0) throw new Error(`expected exit 0, got ${code}`);
});

// ── teardown ──────────────────────────────────────────────────────────────────
fs.rmSync(FIXDIR, { recursive: true, force: true });

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
