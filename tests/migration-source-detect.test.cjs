#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Creates throwaway fixture dirs and runs scripts/migration-source-detect.cjs
//                      (--roots=<fixture> --json) against each, asserting the stack-neutral source
//                      descriptor plus conservative graph-fast-path fallback and nested signal-file
//                      coverage.
// What it touches:     Creates + removes temp dirs under os.tmpdir() only. Writes nothing to the
//                      repo or to any source outside throwaway fixtures.
// What it does NOT do: No network, no git, no writes outside the OS temp dir, no plugin/project
//                      state mutation.
// APIs / commands:     Node stdlib fs, os, path; child_process.spawnSync('node', ...).
// How to verify:       node tests/migration-source-detect.test.cjs → exit 0 and "N passed · 0 failed".

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DETECT = path.join(ROOT, 'scripts', 'migration-source-detect.cjs');
const REPO_DETECT = path.join(ROOT, 'scripts', 'repo-detect.cjs');
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

function run(roots, env = {}) {
  const r = spawnSync('node', [DETECT, '--roots=' + roots.join(','), '--json'], { encoding: 'utf8', env: { ...process.env, ...env } });
  let descriptor = null;
  try { descriptor = JSON.parse(r.stdout || ''); } catch (_) { /* leave null */ }
  return { descriptor, code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function detectMeta(root) {
  const r = spawnSync('node', [REPO_DETECT, '--root=' + root, '--json'], { encoding: 'utf8' });
  try { return JSON.parse(r.stdout || ''); } catch (_) { return { meta: {} }; }
}

function seedState(root, fingerprint) {
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude', 'dream-init-state.json'), JSON.stringify({ generations_meta: { buildfile_fingerprint: fingerprint } }, null, 2));
}

function writeGraph(root, nodes) {
  fs.mkdirSync(path.join(root, '.claude', 'graph'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude', 'graph', 'graph.json'), JSON.stringify({
    meta: { schemaVersion: '1.0', generatedAt: '2026-09-21', generator: 'graph-create', structure: 'flat', moduleCount: nodes.length },
    nodes,
    edges: [],
  }, null, 2) + '\n');
}

function node(id, p, extra = {}) {
  const first = p.replace(/\/\*\*$/, '');
  return { id, module: id, domain: id, type: 'service', detailFile: `graph/${id}.md`, entryPoint: `${first}/entry`, paths: [p], fingerprint: id, hub: false, ...extra };
}

function ok(name) { pass++; console.log('  ✓ ' + name); }
function bad(name, detail) { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
function check(name, roots, assertFn, env = {}) {
  const { descriptor, code, stderr } = run(roots, env);
  if (!descriptor) { bad(name, 'no JSON descriptor (exit ' + code + ') stderr=' + stderr); return; }
  try { assertFn(descriptor, code, stderr); ok(name); }
  catch (e) { bad(name, e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const dotnet = mk({
  'Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
  'Api/Data/AppDbContext.cs': 'public class AppDbContext {}',
  'Api/Web.config': '<configuration><system.serviceModel><client><endpoint address="http://svc/x" binding="basicHttpBinding" /></client></system.serviceModel><connectionStrings><add name="Db" connectionString="Server=." /></connectionStrings></configuration>',
});
const nodeOnly = mk({
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

check('dotnet: primary token + version + EF data layer + WCF integration', [dotnet], d => {
  assert(d.primary.token === 'dotnet', 'primary.token=' + d.primary.token);
  assert(d.primary.version, 'expected a version, got ' + d.primary.version);
  assert(d.stacks.some(s => s.token === 'dotnet' && s.projectPath), 'expected a per-project dotnet stack row');
  assert(d.dataLayer.some(x => /EF/.test(x)), 'dataLayer=' + JSON.stringify(d.dataLayer));
  assert(d.integrations.some(i => i.kind === 'WCF-client'), 'integrations=' + JSON.stringify(d.integrations));
  assert(d.integrations.some(i => i.kind === 'direct-DB'), 'expected a direct-DB row from connectionStrings');
});

check('node: stack-neutral (no generations.dotnet) + passport auth', [nodeOnly], d => {
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

check('multi-root: two roots merge; both stacks present; roots length 2', [dotnet, nodeOnly], d => {
  assert(d.roots.length === 2, 'roots=' + JSON.stringify(d.roots));
  assert(d.stacks.some(s => s.token === 'dotnet'), 'expected dotnet from root 1');
  assert(d.stacks.some(s => s.token === 'nodejs'), 'expected nodejs from root 2');
  assert(d.primary.token === 'dotnet', 'primary should be the higher-priority backend token');
});

check('external-source-only: an arbitrary path is scanned as the source root', [nodeOnly], d => {
  assert(d.roots[0] === nodeOnly, 'roots[0]=' + d.roots[0]);
  assert(d.primary.token === 'nodejs', 'primary.token=' + d.primary.token);
});

check('source_version is a plain comparable string when present (Q1b/Stage-2)', [dotnet], d => {
  assert(typeof d.primary.version === 'string' && d.primary.version.length > 0, 'version=' + JSON.stringify(d.primary.version));
});

{
  const { descriptor, code } = run([empty]);
  if (descriptor && descriptor.primary.token === null && code === 3) ok('empty/unrecognised source: primary.token null + exit 3');
  else bad('empty/unrecognised source: primary.token null + exit 3', 'token=' + (descriptor && descriptor.primary.token) + ' code=' + code);
}

const nested = mk({
  'Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
  'Api/Controllers/HomeController.cs': 'class HomeController { void X() { AddAuthentication(); } }',
  'apps/web/package.json': '{"name":"web","dependencies":{"prisma":"^5.0.0"}}',
  'services/java/pom.xml': '<project><dependencies><dependency><artifactId>spring-data-jpa</artifactId></dependency></dependencies></project>',
  'legacy/nested/Web.config': '<configuration><system.serviceModel><client><endpoint address="http://svc/x" binding="basicHttpBinding" /></client></system.serviceModel><connectionStrings><add name="Db" connectionString="Server=." /></connectionStrings></configuration>',
  'legacy/nested/extra.config': '<configuration><connectionStrings><add name="Other" connectionString="Server=." /></connectionStrings></configuration>',
});
const nestedMeta = detectMeta(nested);
seedState(nested, nestedMeta.meta.buildfile_fingerprint);
writeGraph(nested, [
  node('api', 'Api/**'),
  node('web', 'apps/web/**'),
  node('java', 'services/java/**'),
  node('legacy', 'legacy/**'),
]);
const nestedFallback = run([nested]);
fs.writeFileSync(path.join(nested, '.claude', 'graph', '.stale'), '1');
const nestedFallbackStale = run([nested]);
fs.rmSync(path.join(nested, '.claude', 'graph', '.stale'));
check('graph-backed scan matches fallback for nested manifests/config files', [nested], d => {
  assert(JSON.stringify(d) === JSON.stringify(nestedFallbackStale.descriptor), 'graph-backed descriptor differs from fallback');
  assert(d.dataLayer.includes('Node ORM (TypeORM/Sequelize/Prisma)'), 'nested package.json signal missing');
  assert(d.dataLayer.includes('JPA/Hibernate'), 'nested pom.xml signal missing');
  assert(d.integrations.some(i => i.kind === 'WCF-client'), 'nested Web.config integration missing');
  assert(d.integrations.filter(i => i.kind === 'direct-DB').length >= 2, 'expected both nested config files to contribute direct-DB signals');
  assert(d.auth.includes('ASP.NET AddAuthentication'), 'nested code auth signal missing');
});

const missingState = mk({
  'Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
  'Api/Controllers/HomeController.cs': 'class HomeController {}',
  'legacy/nested/Web.config': '<configuration><system.serviceModel><client><endpoint address="http://svc/x" binding="basicHttpBinding" /></client></system.serviceModel></configuration>',
});
writeGraph(missingState, [node('api', 'Api/**')]);
check('missing dream-init-state.json forces fallback instead of trusting graph', [missingState], d => {
  assert(d.integrations.some(i => i.kind === 'WCF-client'), 'fallback should detect nested Web.config when state is missing');
});

const missingStoredFingerprint = mk({
  'Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
  'Api/Controllers/HomeController.cs': 'class HomeController {}',
  'legacy/nested/Web.config': '<configuration><system.serviceModel><client><endpoint address="http://svc/x" binding="basicHttpBinding" /></client></system.serviceModel></configuration>',
});
fs.mkdirSync(path.join(missingStoredFingerprint, '.claude'), { recursive: true });
fs.writeFileSync(path.join(missingStoredFingerprint, '.claude', 'dream-init-state.json'), JSON.stringify({ generations_meta: {} }, null, 2));
writeGraph(missingStoredFingerprint, [node('api', 'Api/**')]);
check('missing stored buildfile fingerprint forces fallback', [missingStoredFingerprint], d => {
  assert(d.integrations.some(i => i.kind === 'WCF-client'), 'fallback should detect nested Web.config when stored fingerprint is missing');
});

const missingCurrentFingerprint = mk({
  'src/server.js': 'const passport = require("passport");',
  'apps/web/package.json': '{"name":"web","dependencies":{"prisma":"^5.0.0"}}',
});
seedState(missingCurrentFingerprint, 'stored-only');
writeGraph(missingCurrentFingerprint, [node('server', 'src/**')]);
check('missing current detector fingerprint forces fallback', [missingCurrentFingerprint], d => {
  assert(d.dataLayer.includes('Node ORM (TypeORM/Sequelize/Prisma)'), 'fallback should detect nested package.json when current fingerprint is missing');
});

const fingerprintMismatch = mk({
  'Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
  'legacy/nested/Web.config': '<configuration><system.serviceModel><client><endpoint address="http://svc/x" binding="basicHttpBinding" /></client></system.serviceModel></configuration>',
});
seedState(fingerprintMismatch, 'mismatch');
writeGraph(fingerprintMismatch, [node('api', 'Api/**')]);
check('fingerprint mismatch still forces fallback', [fingerprintMismatch], d => {
  assert(d.integrations.some(i => i.kind === 'WCF-client'), 'fallback should detect nested Web.config on fingerprint mismatch');
});

for (const d of [dotnet, nodeOnly, java, python, angular, empty, nested, missingState, missingStoredFingerprint, missingCurrentFingerprint, fingerprintMismatch]) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
}

console.log('\n' + pass + ' passed · ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
