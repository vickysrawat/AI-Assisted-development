#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Verifies scripts/graph-extract-edges.js reads each source/project file at
//                      most once, preserves graph merge semantics, and resolves supported
//                      dependency forms across JS/TS, Python, C#, Java, and .csproj.
// What it touches:     Writes a throwaway fixture tree under os.tmpdir()/gee-fixtures-* ; removed at end.
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
const fwd = p => p.split(path.sep).join('/');
function w(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'gee-fixtures-'));
const repo = path.join(BASE, 'repo');
const graphPath = path.join(repo, '.claude', 'graph', 'graph.json');
const countPath = path.join(BASE, 'read-counts.json');
const hookPath = path.join(BASE, 'read-count-hook.cjs');

const files = {
  web: path.join(repo, 'src', 'Web', 'app.ts'),
  uiIndex: path.join(repo, 'src', 'Ui', 'index.ts'),
  uiButton: path.join(repo, 'src', 'Ui', 'button.ts'),
  jsLib: path.join(repo, 'src', 'JsLib', 'legacy.js'),
  pyClient: path.join(repo, 'pyclient', 'pkg', 'client.py'),
  pyInit: path.join(repo, 'deep', '__init__.py'),
  pyTools: path.join(repo, 'deep', 'tools.py'),
  csAuth: path.join(repo, 'src', 'Auth', 'Auth.cs'),
  csCore: path.join(repo, 'src', 'Core', 'Core.cs'),
  csCoreUtils: path.join(repo, 'src', 'CoreUtils', 'Helper.cs'),
  csFeature: path.join(repo, 'src', 'Feature', 'Feature.cs'),
  javaShared: path.join(repo, 'src', 'JavaShared', 'Api.java'),
  javaDeep: path.join(repo, 'src', 'JavaDeep', 'Helper.java'),
  javaApp: path.join(repo, 'src', 'JavaApp', 'App.java'),
  projA: path.join(repo, 'src', 'ProjectA', 'ProjectA.csproj'),
  projB: path.join(repo, 'src', 'ProjectB', 'ProjectB.csproj'),
};

w(files.web, [
  "import { button } from '../Ui/button';",
  "export { button } from '../Ui';",
  "const legacy = require('../JsLib/legacy');",
  "import '../Missing';",
  '',
].join('\n'));
w(files.uiIndex, "export * from './button';\n");
w(files.uiButton, "export const button = 'ok';\n");
w(files.jsLib, "module.exports = { legacy: true };\n");
w(files.pyClient, [
  'from ...deep import tools',
  'import deep.tools',
  'import missingpkg',
  '',
].join('\n'));
w(files.pyInit, '__all__ = []\n');
w(files.pyTools, 'VALUE = 1\n');
w(files.csAuth, 'namespace Company.Auth;\nclass AuthService {}\n');
w(files.csCore, 'namespace Company.Core;\nclass CoreService {}\n');
w(files.csCoreUtils, 'namespace Company.Core.Utils;\nclass Helper {}\n');
w(files.csFeature, [
  'namespace Company.Feature;',
  'using Company.Auth;',
  'using static Company.Core.Utils.Helpers;',
  'using Missing.Namespace;',
  'class FeatureService {}',
  '',
].join('\n'));
w(files.javaShared, 'package org.example.shared;\nclass Api {}\n');
w(files.javaDeep, 'package org.example.shared.deep;\nclass Helper {}\n');
w(files.javaApp, [
  'package org.example.app;',
  'import org.example.shared.Api;',
  'import static org.example.shared.deep.tools.Helper;',
  'import org.missing.pkg.Helper;',
  'class App {}',
  '',
].join('\n'));
w(files.projA, [
  '<Project Sdk="Microsoft.NET.Sdk">',
  '  <ItemGroup>',
  '    <ProjectReference Include="../ProjectB/ProjectB.csproj" />',
  '    <ProjectReference Include="../../Nope/Nope.csproj" />',
  '  </ItemGroup>',
  '</Project>',
  '',
].join('\n'));
w(files.projB, '<Project Sdk="Microsoft.NET.Sdk"></Project>\n');

const nodes = [
  node('web', 'Web', 'web', ['src/Web/**']),
  node('ui', 'Ui', 'ui', ['src/Ui/**']),
  node('jslib', 'JsLib', 'jslib', ['src/JsLib/**']),
  node('pyclient', 'PyClient', 'python', ['pyclient/**']),
  node('pyshared', 'Deep', 'python', ['deep/**', '**/*.py']),
  node('auth', 'Auth', 'auth', ['src/Auth/**']),
  node('core', 'Core', 'core', ['src/Core/**']),
  node('coreutils', 'CoreUtils', 'core', ['src/CoreUtils/**']),
  node('feature', 'Feature', 'core', ['src/Feature/**']),
  node('javashared', 'JavaShared', 'java', ['src/JavaShared/**']),
  node('javadeep', 'JavaDeep', 'java', ['src/JavaDeep/**']),
  node('javaapp', 'JavaApp', 'java', ['src/JavaApp/**']),
  node('projecta', 'ProjectA', 'dotnet', ['src/ProjectA/**']),
  node('projectb', 'ProjectB', 'dotnet', ['src/ProjectB/**']),
  node('dynamic', 'Dynamic', 'misc', ['src/Dynamic/**']),
  node('unused', 'Unused', 'misc', ['src/Unused/**']),
];

w(graphPath, JSON.stringify({
  meta: { schemaVersion: '1.0', generatedAt: '2026-09-20', generator: 'graph-create', structure: 'flat', moduleCount: nodes.length },
  nodes,
  edges: [
    { from: 'web', to: 'dynamic', type: 'uses', confidence: 'INFERRED', reason: 'dynamic import' },
    { from: 'pyclient', to: 'dynamic', type: 'uses', confidence: 'AMBIGUOUS', reason: 'runtime plugin' },
    { from: 'web', to: 'unused', type: 'depends', confidence: 'EXTRACTED', reason: 'stale edge' },
  ],
}, null, 2) + '\n');

w(hookPath, [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  "const out = process.env.READ_COUNT_OUT;",
  "const roots = JSON.parse(process.env.READ_COUNT_ROOTS || '[]');",
  "const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.cs', '.java', '.csproj']);",
  'const counts = Object.create(null);',
  'const orig = fs.readFileSync;',
  "const norm = p => String(p).replace(/\\\\/g, '/');",
  'fs.readFileSync = function(file, ...args) {',
  '  const val = orig.call(this, file, ...args);',
  '  try {',
  "    if (typeof file === 'string' || Buffer.isBuffer(file)) {",
  '      const p = norm(file);',
  '      const ext = path.extname(p).toLowerCase();',
  "      if (exts.has(ext) && roots.some(r => p === r || p.startsWith(r + '/'))) counts[p] = (counts[p] || 0) + 1;",
  '    }',
  '  } catch (_) {}',
  '  return val;',
  '};',
  "process.on('exit', () => { if (out) fs.writeFileSync(out, JSON.stringify(counts, null, 2)); });",
  '',
].join('\n'));

function node(id, mod, dom, paths) {
  const first = paths[0].replace(/\/\*\*$/, '');
  return { id, module: mod, domain: dom, type: 'service', detailFile: `graph/${id}.md`, entryPoint: `${first}/entry`, paths, fingerprint: id, hub: false };
}

function runNode(script, args, cwd, env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function edgeMap(graph) {
  return new Map(graph.edges.map(e => [`${e.from}\t${e.to}`, e]));
}

test('graph-extract-edges reads each file once and preserves merge semantics across supported languages', () => {
  const first = runNode(EXTRACT_EDGES, [], repo, {
    NODE_OPTIONS: `--require ${hookPath}`,
    READ_COUNT_OUT: countPath,
    READ_COUNT_ROOTS: JSON.stringify([fwd(repo)]),
  });
  assert(first.code === 0, `expected exit 0, got ${first.code} (stderr: ${first.stderr})`);

  const counts = JSON.parse(fs.readFileSync(countPath, 'utf8'));
  for (const file of Object.values(files)) {
    const n = counts[fwd(file)] || 0;
    assert(n === 1, `expected exactly one read for ${fwd(file)}, got ${n}`);
  }

  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  const edges = edgeMap(graph);

  assert(edges.get('web\tui') && edges.get('web\tui').confidence === 'EXTRACTED', 'TS import/export edge web->ui extracted');
  assert(edges.get('web\tjslib') && edges.get('web\tjslib').confidence === 'EXTRACTED', 'JS require edge web->jslib extracted');
  assert(edges.get('pyclient\tpyshared') && edges.get('pyclient\tpyshared').confidence === 'EXTRACTED', 'Python import edge pyclient->pyshared extracted');
  assert(edges.get('feature\tauth') && edges.get('feature\tauth').confidence === 'EXTRACTED', 'C# exact namespace edge feature->auth extracted');
  assert(edges.get('feature\tcoreutils') && edges.get('feature\tcoreutils').confidence === 'EXTRACTED', 'C# longest-prefix namespace edge feature->coreutils extracted');
  assert(edges.get('javaapp\tjavashared') && edges.get('javaapp\tjavashared').confidence === 'EXTRACTED', 'Java exact package edge javaapp->javashared extracted');
  assert(edges.get('javaapp\tjavadeep') && edges.get('javaapp\tjavadeep').confidence === 'EXTRACTED', 'Java longest-prefix package edge javaapp->javadeep extracted');
  assert(edges.get('projecta\tprojectb') && edges.get('projecta\tprojectb').confidence === 'EXTRACTED', '.csproj ProjectReference edge projecta->projectb extracted');
  assert(edges.get('web\tdynamic') && edges.get('web\tdynamic').confidence === 'INFERRED', 'existing inferred edge preserved');
  assert(edges.get('pyclient\tdynamic') && edges.get('pyclient\tdynamic').confidence === 'AMBIGUOUS', 'existing ambiguous edge preserved');
  assert(!edges.has('web\tunused'), 'stale extracted edge removed');
  assert(graph.edges.length === 10, `expected exactly 10 merged edges, got ${graph.edges.length}`);

  const before = fs.readFileSync(graphPath, 'utf8');
  const second = runNode(EXTRACT_EDGES, [], repo);
  assert(second.code === 0, `second run exit 0 (got ${second.code})`);
  const after = fs.readFileSync(graphPath, 'utf8');
  assert(before === after, 'repeated runs produce byte-identical graph.json');
});

fs.rmSync(BASE, { recursive: true, force: true });

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
