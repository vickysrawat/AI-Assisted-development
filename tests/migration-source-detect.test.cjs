#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Creates throwaway fixture dirs and runs scripts/migration-source-detect.cjs
//                      (--roots=<fixture> --json) against each, asserting the stack-neutral source
//                      descriptor: primary.token/version, stacks[], dataLayer, auth, integrations,
//                      multi-root merge, external-only root, and exit-3 on an unrecognised source.
// What it touches:     Creates + removes temp dirs under os.tmpdir() only. Writes nothing to the
//                      repo or to any source (the detector is read-only; it never writes state).
// What it does NOT do: No network, no git, no writes outside the OS temp dir, no plugin/project
//                      state mutation. Resume/backward-compat (checkpoint 1.11) is an ORCHESTRATION
//                      concern (Stage 0 reads the checkpoint, not this script) — out of scope here.
// APIs / commands:     Node stdlib fs, os, path; child_process.spawnSync('node', ...).
// How to verify:       node tests/migration-source-detect.test.cjs → exit 0 and "N passed · 0 failed".

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DETECT = path.join(__dirname, '..', 'scripts', 'migration-source-detect.cjs');
let pass = 0, fail = 0;

function mk(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-src-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function run(roots) {
  const r = spawnSync('node', [DETECT, '--roots=' + roots.join(','), '--json'], { encoding: 'utf8' });
  let descriptor = null;
  try { descriptor = JSON.parse(r.stdout || ''); } catch (_) { /* leave null */ }
  return { descriptor, code: r.status };
}

function ok(name) { pass++; console.log('  ✓ ' + name); }
function bad(name, detail) { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }

function check(name, roots, assertFn) {
  const { descriptor, code } = run(roots);
  if (!descriptor) { bad(name, 'no JSON descriptor (exit ' + code + ')'); return; }
  try { assertFn(descriptor, code); ok(name); }
  catch (e) { bad(name, e.message); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── Fixtures (minimal, per stack) ───────────────────────────────────────────────
const dotnet = mk({
  'Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
  'Api/Data/AppDbContext.cs': 'public class AppDbContext {}',
  'Api/Web.config': '<configuration><system.serviceModel><client><endpoint address="http://svc/x" binding="basicHttpBinding" /></client></system.serviceModel><connectionStrings><add name="Db" connectionString="Server=." /></connectionStrings></configuration>',
});
const node = mk({
  'package.json': '{"name":"api","main":"index.js","dependencies":{"express":"^4","passport":"^0.6","prisma":"^5"}}',
  'src/server.js': 'const passport = require("passport"); app.get("/x", h);',
});
const java = mk({
  'pom.xml': '<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter</artifactId></dependency><dependency><artifactId>spring-data-jpa</artifactId></dependency></dependencies></project>',
  'src/main/java/App.java': 'class App {}',
});
const python = mk({
  'requirements.txt': 'fastapi==0.110\nuvicorn\n',
  'app/main.py': 'from fastapi import FastAPI',
});
const angular = mk({
  'angular.json': '{"projects":{}}',
  'package.json': '{"name":"web","dependencies":{"@angular/core":"^17"}}',
  'src/app/app.component.ts': 'export class AppComponent {}',
});
const empty = mk({ 'README.txt': 'nothing here' });

// ── Assertions ──────────────────────────────────────────────────────────────────
check('dotnet: primary token + version + EF data layer + WCF integration', [dotnet], d => {
  assert(d.primary.token === 'dotnet', 'primary.token=' + d.primary.token);
  assert(d.primary.version, 'expected a version, got ' + d.primary.version);
  assert(d.stacks.some(s => s.token === 'dotnet' && s.projectPath), 'expected a per-project dotnet stack row');
  assert(d.dataLayer.some(x => /EF/.test(x)), 'dataLayer=' + JSON.stringify(d.dataLayer));
  assert(d.integrations.some(i => i.kind === 'WCF-client'), 'integrations=' + JSON.stringify(d.integrations));
  assert(d.integrations.some(i => i.kind === 'direct-DB'), 'expected a direct-DB row from connectionStrings');
});

check('node: stack-neutral (no generations.dotnet) + passport auth', [node], d => {
  assert(d.primary.token === 'nodejs', 'primary.token=' + d.primary.token);
  assert(d.auth.some(a => /passport|JWT/i.test(a)), 'auth=' + JSON.stringify(d.auth));
  assert(!d.stacks.some(s => s.token === 'dotnet'), 'must not report a dotnet stack');
});

check('java: token=java', [java], d => {
  assert(d.primary.token === 'java', 'primary.token=' + d.primary.token);
});

check('python: token=python (equal citizen)', [python], d => {
  assert(d.primary.token === 'python', 'primary.token=' + d.primary.token);
});

check('angular: framework outranks generic nodejs for primary', [angular], d => {
  assert(d.primary.token === 'angular', 'primary.token=' + d.primary.token + ' (framework must win over nodejs)');
});

check('multi-root: two roots merge; both stacks present; roots length 2', [dotnet, node], d => {
  assert(d.roots.length === 2, 'roots=' + JSON.stringify(d.roots));
  assert(d.stacks.some(s => s.token === 'dotnet'), 'expected dotnet from root 1');
  assert(d.stacks.some(s => s.token === 'nodejs'), 'expected nodejs from root 2');
  assert(d.primary.token === 'dotnet', 'primary should be the higher-priority backend token');
});

check('external-source-only: an arbitrary path is scanned as the source root', [node], d => {
  // `node` fixture lives under os.tmpdir(), unrelated to cwd — proves roots are honored as given.
  assert(d.roots[0] === node, 'roots[0]=' + d.roots[0]);
  assert(d.primary.token === 'nodejs', 'primary.token=' + d.primary.token);
});

check('source_version is a plain comparable string when present (Q1b/Stage-2)', [dotnet], d => {
  assert(typeof d.primary.version === 'string' && d.primary.version.length > 0, 'version=' + JSON.stringify(d.primary.version));
});

// Unrecognised source → exit 3, primary.token null, never a crash.
{
  const { descriptor, code } = run([empty]);
  if (descriptor && descriptor.primary.token === null && code === 3) ok('empty/unrecognised source: primary.token null + exit 3');
  else bad('empty/unrecognised source: primary.token null + exit 3', 'token=' + (descriptor && descriptor.primary.token) + ' code=' + code);
}

// ── Cleanup + summary ────────────────────────────────────────────────────────────
for (const d of [dotnet, node, java, python, angular, empty]) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
}

console.log('\n' + pass + ' passed · ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
