#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Regression tests for the runtime-generation resolvers in
//                      scripts/stack-signals.cjs (resolveAllGenerations). Builds throwaway
//                      manifest fixtures per language and asserts the resolved {name} bucket +
//                      that a missing manifest yields low confidence.
// What it touches:     Creates + removes temp dirs under os.tmpdir(). Writes nothing to the repo.
// What it does NOT do: No network, no git, no state writes, no source scanning.
// APIs / commands:     Node stdlib fs, os, path; require('../scripts/stack-signals.cjs').
// How to verify:       node tests/generation-resolve.test.cjs → exit 0 and "N passed · 0 failed".

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const S = require('../scripts/stack-signals.cjs');

let pass = 0, fail = 0;
function assert(name, cond) { cond ? (pass++, console.log('  ✓ ' + name)) : (fail++, console.log('  ✗ ' + name)); }
function gen(files, lang) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gr-'));
  for (const [rel, c] of Object.entries(files)) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); }
  const g = S.resolveAllGenerations(S.gatherProjectSignals(root));
  fs.rmSync(root, { recursive: true, force: true });
  return g[lang];
}

console.log('▶ runtime-generation resolvers');
assert('.NET modern (net10.0)', gen({ 'A.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>' }, 'dotnet').name === 'dotnet-modern');
assert('.NET framework (v4.7.2)', gen({ 'A.csproj': '<Project><PropertyGroup><TargetFrameworkVersion>v4.7.2</TargetFrameworkVersion></PropertyGroup></Project>' }, 'dotnet').name === 'dotnet-framework');
assert('Python 3 (requires-python)', gen({ 'pyproject.toml': '[project]\nrequires-python = ">=3.11"' }, 'python').name === 'python-3');
assert('Python 2 (python_requires <3)', gen({ 'pyproject.toml': 'python_requires=">=2.7,<3"' }, 'python').name === 'python-2');
assert('Java modern (release 17)', gen({ 'pom.xml': '<project><properties><maven.compiler.release>17</maven.compiler.release></properties></project>' }, 'java').name === 'java-modern');
assert('Java legacy (source 1.8)', gen({ 'pom.xml': '<project><properties><source>1.8</source></properties></project>' }, 'java').name === 'java-legacy');
assert('Node modern (engines >=20)', gen({ 'package.json': JSON.stringify({ engines: { node: '>=20' } }) }, 'node').name === 'node-modern');
assert('Go modules (go 1.22)', gen({ 'go.mod': 'module x\ngo 1.22\n' }, 'go').name === 'go-modules');
assert('Rust (edition 2021)', gen({ 'Cargo.toml': '[package]\nedition = "2021"' }, 'rust').name === 'rust');
assert('Ruby modern (3.x)', gen({ 'Gemfile': "ruby '3.2.0'\n" }, 'ruby').name === 'ruby-modern');
assert('PHP modern (^8.1)', gen({ 'composer.json': '{"require":{"php":"^8.1"}}' }, 'php').name === 'php-modern');
const noManifest = gen({ 'A.csproj': '<Project></Project>' }, 'dotnet');
assert('.NET no-TFM → low confidence', noManifest && noManifest.confidence < 0.6);

console.log('\n  ' + pass + ' passed · ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
