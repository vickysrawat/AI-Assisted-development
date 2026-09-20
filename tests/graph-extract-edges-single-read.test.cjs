#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Verifies graph-extract-edges one-read parsing, multi-root Python resolution
//                      policy/ambiguity handling, merge semantics, and read-failure safety.
// What it touches:     Writes throwaway fixtures under os.tmpdir()/ge-hardening-* ; removed at end.
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
const fwd = p => p.split(path.sep).join('/');

function runNode(script, args, cwd, env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function node(id, mod, p, extra = {}) {
  const first = p.replace(/\/\*\*$/, '');
  return { id, module: mod, domain: mod.toLowerCase(), type: 'service', detailFile: `graph/${id}.md`, entryPoint: `${first}/entry`, paths: [p], fingerprint: id, hub: false, ...extra };
}

function edgeMap(graph) {
  return new Map(graph.edges.map(e => [`${e.from}\t${e.to}`, e]));
}

test('graph-extract-edges reads owned files once, honors Python multi-root policy, and keeps merge semantics', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ge-hardening-'));
  const repo = path.join(base, 'repo');
  const depA = path.join(base, 'depA');
  const depB = path.join(base, 'depB');
  const graphPath = path.join(repo, '.claude', 'graph', 'graph.json');
  const countPath = path.join(base, 'read-counts.json');
  const hookPath = path.join(base, 'read-hook.cjs');

  try {
    const files = {
      ts: path.join(repo, 'src', 'web', 'app.ts'),
      tsx: path.join(repo, 'src', 'web', 'widget.tsx'),
      js: path.join(repo, 'src', 'web', 'shared.js'),
      jsx: path.join(repo, 'src', 'web', 'legacy.jsx'),
      mjs: path.join(repo, 'src', 'web', 'esm.mjs'),
      cjs: path.join(repo, 'src', 'web', 'common.cjs'),
      pyRepoClient: path.join(repo, 'src', 'py', 'client', 'main.py'),
      pyRepoCommon: path.join(repo, 'src', 'py', 'common', 'tools.py'),
      pyRelConsumer: path.join(repo, 'src', 'py', 'rel', 'consumer', 'main.py'),
      pyRelTarget: path.join(repo, 'src', 'py', 'rel', 'sub', 'helper.py'),
      pyAmbigImporter: path.join(repo, 'src', 'py', 'ambig', 'main.py'),
      pyDepAClient: path.join(depA, 'src', 'py', 'client', 'main.py'),
      pyDepACommon: path.join(depA, 'src', 'py', 'common', 'tools.py'),
      pyDepAExt: path.join(depA, 'src', 'py', 'externalpkg', 'util.py'),
      pyDepBExt: path.join(depB, 'src', 'py', 'externalpkg', 'util.py'),
      csAuth: path.join(repo, 'src', 'auth', 'Auth.cs'),
      csCore: path.join(repo, 'src', 'core', 'Helper.cs'),
      csFeature: path.join(repo, 'src', 'feature', 'Feature.cs'),
      javaShared: path.join(repo, 'src', 'java', 'shared', 'Api.java'),
      javaApp: path.join(repo, 'src', 'java', 'app', 'App.java'),
      projA: path.join(repo, 'src', 'projA', 'ProjA.csproj'),
      projB: path.join(repo, 'src', 'projB', 'ProjB.csproj'),
    };

    w(files.ts, [
      "import { Widget } from './widget';",
      "import './legacy';",
      "import './esm.mjs';",
      "const common = require('./common');",
      '',
    ].join('\n'));
    w(files.tsx, "import { shared } from './shared';\nexport const Widget = () => shared;\n");
    w(files.js, "export const shared = 1;\n");
    w(files.jsx, "const s = require('./shared');\nexport default s;\n");
    w(files.mjs, "import './shared.js';\n");
    w(files.cjs, "module.exports = require('./shared');\n");

    w(files.pyRepoClient, 'import common.tools\n');
    w(files.pyRepoCommon, 'VALUE = 1\n');
    w(files.pyRelConsumer, 'from ..sub.helper import VALUE\n');
    w(files.pyRelTarget, 'VALUE = 2\n');
    w(files.pyAmbigImporter, 'import externalpkg.util\n');
    w(files.pyDepAClient, 'import common.tools\n');
    w(files.pyDepACommon, 'VALUE = 3\n');
    w(files.pyDepAExt, 'VALUE = 4\n');
    w(files.pyDepBExt, 'VALUE = 5\n');

    w(files.csAuth, 'namespace Company.Auth;\nclass AuthService {}\n');
    w(files.csCore, 'namespace Company.Core.Utils;\nclass Helper {}\n');
    w(files.csFeature, 'namespace Company.Feature;\nusing Company.Auth;\nusing static Company.Core.Utils.Helpers;\nclass FeatureService {}\n');

    w(files.javaShared, 'package org.example.shared;\nclass Api {}\n');
    w(files.javaApp, 'package org.example.app;\nimport org.example.shared.Api;\nclass App {}\n');

    w(files.projA, '<Project><ItemGroup><ProjectReference Include="../projB/ProjB.csproj" /></ItemGroup></Project>\n');
    w(files.projB, '<Project></Project>\n');

    const nodes = [
      node('web', 'Web', 'src/web/**'),
      node('pyrepo-client', 'PyRepoClient', 'client/**', { sourceRoot: 'src/py' }),
      node('pyrepo-common', 'PyRepoCommon', 'common/**', { sourceRoot: 'src/py' }),
      node('pyrepo-rel-consumer', 'PyRepoRelConsumer', 'rel/consumer/**', { sourceRoot: 'src/py' }),
      node('pyrepo-rel-target', 'PyRepoRelTarget', 'rel/sub/**', { sourceRoot: 'src/py' }),
      node('pyrepo-ambig', 'PyRepoAmbig', 'ambig/**', { sourceRoot: 'src/py' }),
      node('pydepa-client', 'PyDepAClient', 'client/**', { sourceRoot: fwd(path.join(depA, 'src', 'py')) }),
      node('pydepa-common', 'PyDepACommon', 'common/**', { sourceRoot: fwd(path.join(depA, 'src', 'py')) }),
      node('pydepa-ext', 'PyDepAExt', 'externalpkg/**', { sourceRoot: fwd(path.join(depA, 'src', 'py')) }),
      node('pydepb-ext', 'PyDepBExt', 'externalpkg/**', { sourceRoot: fwd(path.join(depB, 'src', 'py')) }),
      node('auth', 'Auth', 'src/auth/**'),
      node('core', 'Core', 'src/core/**'),
      node('feature', 'Feature', 'src/feature/**'),
      node('java-shared', 'JavaShared', 'src/java/shared/**'),
      node('java-app', 'JavaApp', 'src/java/app/**'),
      node('projA', 'ProjA', 'src/projA/**'),
      node('projB', 'ProjB', 'src/projB/**'),
      node('dynamic', 'Dynamic', 'src/dynamic/**'),
      node('unused', 'Unused', 'src/unused/**'),
    ];

    w(graphPath, JSON.stringify({
      meta: { schemaVersion: '1.0', generatedAt: '2026-09-20', generator: 'graph-create', structure: 'flat', moduleCount: nodes.length },
      nodes,
      edges: [
        { from: 'web', to: 'dynamic', type: 'uses', confidence: 'INFERRED', reason: 'dynamic runtime' },
        { from: 'pyrepo-client', to: 'dynamic', type: 'uses', confidence: 'AMBIGUOUS', reason: 'runtime plugin' },
        { from: 'web', to: 'unused', type: 'depends', confidence: 'EXTRACTED', reason: 'stale' },
        { from: 'pyrepo-ambig', to: 'pydepa-ext', type: 'depends', confidence: 'EXTRACTED', reason: 'stale-ambiguous' },
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

    const first = runNode(EXTRACT_EDGES, [], repo, {
      NODE_OPTIONS: `--require ${hookPath}`,
      READ_COUNT_OUT: countPath,
      READ_COUNT_ROOTS: JSON.stringify([fwd(repo), fwd(depA), fwd(depB)]),
    });
    assert(first.code === 0, `expected exit 0, got ${first.code} (stderr: ${first.stderr})`);

    const counts = JSON.parse(fs.readFileSync(countPath, 'utf8'));
    for (const file of Object.values(files)) {
      const n = counts[fwd(file)] || 0;
      assert(n === 1, `expected exactly one read for ${fwd(file)}, got ${n}`);
    }

    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    const edges = edgeMap(graph);

    assert(edges.get('web\tweb') === undefined, 'self-edge should not be emitted');
    assert(edges.get('pyrepo-client\tpyrepo-common') && edges.get('pyrepo-client\tpyrepo-common').confidence === 'EXTRACTED', 'repo-root absolute Python import resolved');
    assert(edges.get('pydepa-client\tpydepa-common') && edges.get('pydepa-client\tpydepa-common').confidence === 'EXTRACTED', 'importer sourceRoot Python import resolved first');
    assert(edges.get('pyrepo-rel-consumer\tpyrepo-rel-target') && edges.get('pyrepo-rel-consumer\tpyrepo-rel-target').confidence === 'EXTRACTED', 'relative Python import resolved');
    assert(!edges.has('pyrepo-ambig\tpydepa-ext') && !edges.has('pyrepo-ambig\tpydepb-ext'), 'ambiguous Python absolute import emits no EXTRACTED edge');

    assert(edges.get('feature\tauth') && edges.get('feature\tauth').confidence === 'EXTRACTED', 'C# namespace edge extracted');
    assert(edges.get('feature\tcore') && edges.get('feature\tcore').confidence === 'EXTRACTED', 'C# longest-prefix edge extracted');
    assert(edges.get('java-app\tjava-shared') && edges.get('java-app\tjava-shared').confidence === 'EXTRACTED', 'Java package edge extracted');
    assert(edges.get('projA\tprojB') && edges.get('projA\tprojB').confidence === 'EXTRACTED', '.csproj edge extracted');

    assert(edges.get('web\tdynamic') && edges.get('web\tdynamic').confidence === 'INFERRED', 'inferred edge preserved');
    assert(edges.get('pyrepo-client\tdynamic') && edges.get('pyrepo-client\tdynamic').confidence === 'AMBIGUOUS', 'ambiguous edge preserved');
    assert(!edges.has('web\tunused'), 'stale extracted edge removed when source read succeeds');

    const before = fs.readFileSync(graphPath, 'utf8');
    const second = runNode(EXTRACT_EDGES, [], repo);
    assert(second.code === 0, `second run expected exit 0, got ${second.code}`);
    const after = fs.readFileSync(graphPath, 'utf8');
    assert(before === after, 'repeated runs produce byte-identical graph.json');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('read failures preserve existing EXTRACTED edges for affected source modules and warn', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ge-hardening-readfail-'));
  const repo = path.join(base, 'repo');
  const graphPath = path.join(repo, '.claude', 'graph', 'graph.json');
  const hookPath = path.join(base, 'read-fail-hook.cjs');

  try {
    const failFile = path.join(repo, 'src', 'web', 'app.ts');
    const keepFile = path.join(repo, 'src', 'keep', 'keeper.ts');
    w(failFile, "import './missing';\n");
    w(keepFile, "import './missing';\n");

    const nodes = [
      node('web', 'Web', 'src/web/**'),
      node('keep', 'Keep', 'src/keep/**'),
      node('dep', 'Dep', 'src/dep/**'),
      node('gone', 'Gone', 'src/gone/**'),
    ];

    w(graphPath, JSON.stringify({
      meta: { schemaVersion: '1.0', generatedAt: '2026-09-20', generator: 'graph-create', structure: 'flat', moduleCount: nodes.length },
      nodes,
      edges: [
        { from: 'web', to: 'dep', type: 'depends', confidence: 'EXTRACTED', reason: 'existing' },
        { from: 'keep', to: 'gone', type: 'depends', confidence: 'EXTRACTED', reason: 'stale-healthy' },
      ],
    }, null, 2) + '\n');

    w(hookPath, [
      "'use strict';",
      "const fs = require('fs');",
      'const orig = fs.readFileSync;',
      "const fail = String(process.env.FAIL_READ_FILE || '').replace(/\\\\/g, '/');",
      "const norm = p => String(p).replace(/\\\\/g, '/');",
      'fs.readFileSync = function(file, ...args) {',
      '  const p = norm(file);',
      "  if (fail && p === fail) { const e = new Error('EACCES: simulated read failure'); e.code = 'EACCES'; throw e; }",
      '  return orig.call(this, file, ...args);',
      '};',
      '',
    ].join('\n'));

    const run = runNode(EXTRACT_EDGES, [], repo, {
      NODE_OPTIONS: `--require ${hookPath}`,
      FAIL_READ_FILE: fwd(failFile),
    });
    assert(run.code === 0, `expected exit 0, got ${run.code} (stderr: ${run.stderr})`);
    assert(/could not be read; preserved/.test(run.stderr), `expected read-failure warning, got stderr: ${run.stderr}`);

    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    const edges = edgeMap(graph);
    assert(edges.get('web\tdep') && edges.get('web\tdep').confidence === 'EXTRACTED', 'EXTRACTED edge from unreadable source module must be preserved');
    assert(!edges.has('keep\tgone'), 'stale EXTRACTED edge from successfully-read source module must be removed');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
