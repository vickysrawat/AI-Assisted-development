#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EXTRACT_EDGES = path.join(ROOT, 'scripts', 'graph-extract-edges.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  - ${name}`); }
  catch (e) { failed++; console.log(`  FAIL- ${name}\n        ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function runExtract(repo, args = []) {
  const r = spawnSync(process.execPath, [EXTRACT_EDGES, ...args], { cwd: repo, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-extract-'));
const repo = path.join(BASE, 'repo');

write(path.join(repo, 'src', 'cs', 'Base', 'Base.cs'), 'namespace Company.App;\nclass Base {}\n');
write(path.join(repo, 'src', 'cs', 'Feature', 'Feature.cs'), 'namespace Company.App.Feature;\nclass Feature {}\n');
write(
  path.join(repo, 'src', 'cs', 'Consumer', 'Consumer.cs'),
  'namespace Company.App.Consumer;\nusing Company.App;\nusing Company.App.Feature.Services;\nusing Company.Missing;\nclass Consumer {}\n'
);

write(path.join(repo, 'src', 'java', 'Base', 'Base.java'), 'package com.example;\nclass Base {}\n');
write(path.join(repo, 'src', 'java', 'Feature', 'Feature.java'), 'package com.example.feature;\nclass Feature {}\n');
write(
  path.join(repo, 'src', 'java', 'Consumer', 'Consumer.java'),
  'package com.example.consumer;\nimport com.example.Util;\nimport com.example.feature.deep.Type;\nimport com.unknown.lib.Util;\nclass Consumer {}\n'
);

const nodes = [
  { id: 'cs-base', module: 'CsBase', domain: 'core', type: 'service', detailFile: 'graph/cs-base.md', entryPoint: 'src/cs/Base/Base.cs', paths: ['src/cs/Base/**'], fingerprint: 'cs-base', hub: false },
  { id: 'cs-feature', module: 'CsFeature', domain: 'core', type: 'service', detailFile: 'graph/cs-feature.md', entryPoint: 'src/cs/Feature/Feature.cs', paths: ['src/cs/Feature/**'], fingerprint: 'cs-feature', hub: false },
  { id: 'cs-consumer', module: 'CsConsumer', domain: 'core', type: 'service', detailFile: 'graph/cs-consumer.md', entryPoint: 'src/cs/Consumer/Consumer.cs', paths: ['src/cs/Consumer/**'], fingerprint: 'cs-consumer', hub: false },
  { id: 'java-base', module: 'JavaBase', domain: 'core', type: 'service', detailFile: 'graph/java-base.md', entryPoint: 'src/java/Base/Base.java', paths: ['src/java/Base/**'], fingerprint: 'java-base', hub: false },
  { id: 'java-feature', module: 'JavaFeature', domain: 'core', type: 'service', detailFile: 'graph/java-feature.md', entryPoint: 'src/java/Feature/Feature.java', paths: ['src/java/Feature/**'], fingerprint: 'java-feature', hub: false },
  { id: 'java-consumer', module: 'JavaConsumer', domain: 'core', type: 'service', detailFile: 'graph/java-consumer.md', entryPoint: 'src/java/Consumer/Consumer.java', paths: ['src/java/Consumer/**'], fingerprint: 'java-consumer', hub: false },
];

write(
  path.join(repo, '.claude', 'graph', 'graph.json'),
  JSON.stringify({
    meta: { schemaVersion: '1.0', generatedAt: '2026-09-19', generator: 'graph-create', structure: 'flat', moduleCount: nodes.length },
    nodes,
    edges: [{ from: 'java-base', to: 'java-feature', type: 'depends', confidence: 'INFERRED', reason: 'legacy inferred' }],
  }, null, 2) + '\n'
);

function extractedPairs(graph) {
  return graph.edges
    .filter(e => e.confidence === 'EXTRACTED')
    .map(e => `${e.from}->${e.to}`)
    .sort();
}

test('resolves exact and longest-prefix namespace/package imports while leaving unresolved imports without edges', () => {
  const { code, stderr } = runExtract(repo);
  assert(code === 0, `expected exit 0, got ${code} (${stderr})`);
  const graph = JSON.parse(fs.readFileSync(path.join(repo, '.claude', 'graph', 'graph.json'), 'utf8'));
  const pairs = extractedPairs(graph);
  assert(pairs.includes('cs-consumer->cs-base'), 'expected C# exact namespace edge to cs-base');
  assert(pairs.includes('cs-consumer->cs-feature'), 'expected C# longest-prefix namespace edge to cs-feature');
  assert(pairs.includes('java-consumer->java-base'), 'expected Java exact package edge to java-base');
  assert(pairs.includes('java-consumer->java-feature'), 'expected Java longest-prefix package edge to java-feature');
  assert(pairs.length === 4, `expected only resolved edges, got ${pairs.join(', ')}`);
});

test('keeps extracted edge output stable for fixture graph inputs', () => {
  runExtract(repo);
  const once = JSON.parse(fs.readFileSync(path.join(repo, '.claude', 'graph', 'graph.json'), 'utf8'));
  runExtract(repo);
  const twice = JSON.parse(fs.readFileSync(path.join(repo, '.claude', 'graph', 'graph.json'), 'utf8'));
  assert(JSON.stringify(extractedPairs(once)) === JSON.stringify(extractedPairs(twice)), 'EXTRACTED edges changed between identical fixture runs');
  assert(twice.edges.some(e => e.from === 'java-base' && e.to === 'java-feature' && e.confidence === 'INFERRED'), 'expected pre-existing INFERRED fixture edge to stay preserved');
});

test('does not rebuild/sort namespace and package key lists per lookup', () => {
  const src = fs.readFileSync(EXTRACT_EDGES, 'utf8');
  assert(/const nsKeys = Object\.keys\(nsToNode\)\.sort\(/.test(src), 'expected namespace keys to be precomputed once');
  assert(/const pkgKeys = Object\.keys\(pkgToNode\)\.sort\(/.test(src), 'expected package keys to be precomputed once');
  assert(/function resolveNs\(map, keys, ns\)/.test(src), 'expected resolver to accept precomputed keys');
  assert(!/function resolveNs\([\s\S]*Object\.keys\(map\)\.sort\(/.test(src), 'resolver still rebuilds/sorts keys per lookup');
});

fs.rmSync(BASE, { recursive: true, force: true });
console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
