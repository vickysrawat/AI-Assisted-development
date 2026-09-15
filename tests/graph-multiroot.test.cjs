#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Unit-tests the multi-root behaviour of scripts/module-derive.cjs and
//                      scripts/graph-extract-edges.js (ADO: additionalDirectories awareness):
//                      dependency modules get a sourceRoot, id collisions are disambiguated,
//                      cross-root C# `using` edges resolve, and single-root output is deterministic.
// What it touches:     Writes a throwaway fixture tree under os.tmpdir()/gmr-fixtures-* ; removed at end.
// What it does NOT do: No network, no git, no LLM. Offline; Node stdlib only.
// APIs / commands:     fs, path, os, child_process.spawnSync. Run: node tests/graph-multiroot.test.cjs
// How to verify:       Prints "N passed · 0 failed"; exit 0 on all-pass.

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MODULE_DERIVE = path.join(ROOT, 'scripts', 'module-derive.cjs');
const EXTRACT_EDGES = path.join(ROOT, 'scripts', 'graph-extract-edges.js');

let passed = 0, failed = 0;
function test(n, fn) { try { fn(); passed++; console.log(`  ok  - ${n}`); } catch (e) { failed++; console.log(`  FAIL- ${n}\n        ${e.message}`); } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const fwd = p => p.split(path.sep).join('/');
function w(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }

// ── Build a fixture: a repo + one dependency repo with a colliding module name ──
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'gmr-fixtures-'));
const repo = path.join(BASE, 'repo');
const dep = path.join(BASE, 'dep-lib');
// repo modules: Orders, Auth (>2 source files each so they survive the merge rule)
w(path.join(repo, 'src', 'Orders', 'OrderService.cs'), 'namespace App.Orders;\nusing App.Auth;\nusing DepLib.Core;\nclass OrderService {}\n');
w(path.join(repo, 'src', 'Orders', 'Order.cs'), 'namespace App.Orders;\nclass Order {}\n');
w(path.join(repo, 'src', 'Orders', 'OrderRepo.cs'), 'namespace App.Orders;\nclass OrderRepo {}\n');
w(path.join(repo, 'src', 'Auth', 'AuthService.cs'), 'namespace App.Auth;\nclass AuthService {}\n');
w(path.join(repo, 'src', 'Auth', 'User.cs'), 'namespace App.Auth;\nclass User {}\n');
w(path.join(repo, 'src', 'Auth', 'Token.cs'), 'namespace App.Auth;\nclass Token {}\n');
// dep modules: Core (new) + Orders (collision)
w(path.join(dep, 'src', 'Core', 'CoreService.cs'), 'namespace DepLib.Core;\nclass CoreService {}\n');
w(path.join(dep, 'src', 'Core', 'Util.cs'), 'namespace DepLib.Core;\nclass Util {}\n');
w(path.join(dep, 'src', 'Core', 'Log.cs'), 'namespace DepLib.Core;\nclass Log {}\n');
w(path.join(dep, 'src', 'Orders', 'DepOrder.cs'), 'namespace DepLib.Orders;\nclass DepOrder {}\n');
w(path.join(dep, 'src', 'Orders', 'DepOrder2.cs'), 'namespace DepLib.Orders;\nclass DepOrder2 {}\n');
w(path.join(dep, 'src', 'Orders', 'DepOrder3.cs'), 'namespace DepLib.Orders;\nclass DepOrder3 {}\n');
// settings.local.json in the repo points at the dependency repo
w(path.join(repo, '.claude', 'settings.local.json'), JSON.stringify({ additionalDirectories: [dep] }, null, 2));

function runNode(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function skeleton(stdout) { return JSON.parse(stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1)); }

// ── module-derive: dependency modules tagged + collision disambiguated ─────────
test('module-derive tags dependency modules with sourceRoot and disambiguates id collisions', () => {
  const { code, stdout } = runNode(MODULE_DERIVE, ['--dry-run', '--force'], repo);
  assert(code === 0, `expected exit 0, got ${code}`);
  const sk = skeleton(stdout);
  const byId = Object.fromEntries(sk.modules.map(m => [m.id, m]));
  assert(byId['orders'] && !byId['orders'].sourceRoot, 'repo orders present without sourceRoot');
  assert(byId['auth'] && !byId['auth'].sourceRoot, 'repo auth present without sourceRoot');
  assert(byId['core'] && fwd(byId['core'].sourceRoot) === fwd(dep), `dep core tagged with sourceRoot (got ${byId['core'] && byId['core'].sourceRoot})`);
  const depOrders = sk.modules.find(m => m.sourceRoot && m.module === 'Orders');
  assert(depOrders && depOrders.id !== 'orders', `colliding dep Orders disambiguated (got id ${depOrders && depOrders.id})`);
});

test('module-derive --no-deps stays repo-only (existing behaviour)', () => {
  const { code, stdout } = runNode(MODULE_DERIVE, ['--dry-run', '--force', '--no-deps'], repo);
  assert(code === 0, `expected exit 0, got ${code}`);
  const sk = skeleton(stdout);
  assert(sk.modules.every(m => !m.sourceRoot), 'no sourceRoot when --no-deps');
  assert(sk.modules.length === 2, `expected 2 repo modules, got ${sk.modules.length}`);
});

// ── graph-extract-edges: cross-root using resolves ────────────────────────────
function writeGraph(nodes) {
  w(path.join(repo, '.claude', 'graph', 'graph.json'),
    JSON.stringify({ meta: { schemaVersion: '1.0', generatedAt: '2026-09-14', generator: 'graph-create', structure: 'flat', moduleCount: nodes.length }, nodes, edges: [] }, null, 2) + '\n');
}
const node = (id, mod, dom, p, extra = {}) => ({ id, module: mod, domain: dom, type: 'service', detailFile: `graph/${id}.md`, entryPoint: `${p}/x.cs`, paths: [`${p}/**`], fingerprint: id, hub: false, ...extra });

test('graph-extract-edges resolves a cross-root C# using dependency edge', () => {
  writeGraph([
    node('auth', 'Auth', 'auth', 'src/Auth'),
    node('core', 'Core', 'core', 'src/Core', { sourceRoot: fwd(dep) }),
    node('orders', 'Orders', 'orders', 'src/Orders'),
  ]);
  const { code, stdout } = runNode(EXTRACT_EDGES, ['--dry-run'], repo);
  assert(code === 0, `expected exit 0, got ${code}`);
  assert(/orders -> auth/.test(stdout), 'in-repo edge orders->auth present');
  assert(/orders -> core/.test(stdout), `cross-root edge orders->core present (stdout: ${stdout})`);
});

test('graph-extract-edges is deterministic for a single-root graph', () => {
  writeGraph([
    node('auth', 'Auth', 'auth', 'src/Auth'),
    node('orders', 'Orders', 'orders', 'src/Orders'),
  ]);
  runNode(EXTRACT_EDGES, [], repo);
  const a = fs.readFileSync(path.join(repo, '.claude', 'graph', 'graph.json'), 'utf8');
  runNode(EXTRACT_EDGES, [], repo);
  const b = fs.readFileSync(path.join(repo, '.claude', 'graph', 'graph.json'), 'utf8');
  assert(a === b, 'two runs produce byte-identical graph.json');
  assert(!/sourceRoot/.test(a), 'repo-only graph has no sourceRoot key');
});

// ── teardown ──────────────────────────────────────────────────────────────────
fs.rmSync(BASE, { recursive: true, force: true });

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
