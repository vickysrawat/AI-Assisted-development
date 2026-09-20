#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Verifies graph-extract-edges handles deferred one-read resolution for
//                      Python absolute/relative imports and JS/TS React-style .tsx/.jsx imports.
// What it touches:     Writes a throwaway fixture tree under os.tmpdir()/geesr-fixtures-* ; removed at end.
// What it does NOT do: No network, no git, no LLM. Offline; Node stdlib only.
// APIs / commands:     fs, path, os, child_process.spawnSync. Run: node tests/graph-extract-edges-single-read.test.cjs
// How to verify:       Prints "N passed · 0 failed"; exit 0 on all-pass.

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EXTRACT_EDGES = path.join(ROOT, 'scripts', 'graph-extract-edges.js');

let passed = 0, failed = 0;
function test(n, fn) { try { fn(); passed++; console.log(`  ok  - ${n}`); } catch (e) { failed++; console.log(`  FAIL- ${n}\n        ${e.message}`); } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function w(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'geesr-fixtures-'));
const repo = path.join(BASE, 'repo');

function runNode(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function writeGraph(nodes) {
  w(path.join(repo, '.claude', 'graph', 'graph.json'),
    JSON.stringify({ meta: { schemaVersion: '1.0', generatedAt: '2026-09-20', generator: 'graph-create', structure: 'flat', moduleCount: nodes.length }, nodes, edges: [] }, null, 2) + '\n');
}
const node = (id, mod, p) => ({ id, module: mod, domain: mod.toLowerCase(), type: 'service', detailFile: `graph/${id}.md`, entryPoint: `${p}/entry`, paths: [p], fingerprint: id, hub: false });

test('graph-extract-edges resolves Python absolute and relative imports', () => {
  w(path.join(repo, 'src', 'client', 'main.py'), 'import deep.tools\nimport pkgmod\n');
  w(path.join(repo, 'src', 'relconsumer', 'main.py'), 'from .subpkg.helper import VALUE\n');
  w(path.join(repo, 'src', 'relconsumer', 'subpkg', 'helper.py'), 'VALUE = 1\n');
  w(path.join(repo, 'deep', 'tools.py'), 'X = 1\n');
  w(path.join(repo, 'pkgmod', '__init__.py'), 'Y = 1\n');

  writeGraph([
    node('pyclient', 'PyClient', 'src/client/**'),
    node('pyshared', 'PyShared', 'deep/**'),
    node('pypkg', 'PyPkg', 'pkgmod/**'),
    node('pyrelconsumer', 'PyRelConsumer', 'src/relconsumer/**'),
    node('pyreltarget', 'PyRelTarget', 'src/relconsumer/subpkg/**'),
  ]);

  const { code, stdout, stderr } = runNode(EXTRACT_EDGES, ['--dry-run'], repo);
  assert(code === 0, `expected exit 0, got ${code} (stderr: ${stderr})`);
  assert(/pyclient -> pyshared/.test(stdout), `absolute import edge pyclient->pyshared missing (stdout: ${stdout})`);
  assert(/pyclient -> pypkg/.test(stdout), `absolute package edge pyclient->pypkg missing (stdout: ${stdout})`);
  assert(/pyrelconsumer -> pyreltarget/.test(stdout), `relative import edge pyrelconsumer->pyreltarget missing (stdout: ${stdout})`);
});

test('graph-extract-edges resolves .tsx and .jsx relative imports', () => {
  w(path.join(repo, 'src', 'ui', 'app.tsx'), 'import { util } from "../shared/util";\nexport const App = () => util;\n');
  w(path.join(repo, 'src', 'web', 'view.jsx'), 'const util = require("../shared/util");\nexport default util;\n');
  w(path.join(repo, 'src', 'shared', 'util.js'), 'export const util = 1;\n');

  writeGraph([
    node('tsxmod', 'TsxMod', 'src/ui/**'),
    node('jsxmod', 'JsxMod', 'src/web/**'),
    node('sharedmod', 'SharedMod', 'src/shared/**'),
  ]);

  const { code, stdout, stderr } = runNode(EXTRACT_EDGES, ['--dry-run'], repo);
  assert(code === 0, `expected exit 0, got ${code} (stderr: ${stderr})`);
  assert(/tsxmod -> sharedmod/.test(stdout), `tsx edge tsxmod->sharedmod missing (stdout: ${stdout})`);
  assert(/jsxmod -> sharedmod/.test(stdout), `jsx edge jsxmod->sharedmod missing (stdout: ${stdout})`);
});

fs.rmSync(BASE, { recursive: true, force: true });

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
