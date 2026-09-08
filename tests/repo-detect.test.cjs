#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Creates throwaway fixture dirs and runs scripts/repo-detect.cjs
//                      (--root=<fixture> --dry-run) against each, asserting REPO_TYPE + exit
//                      code for 5 cases: .slnx, nested .csproj, .fsproj, .cs-only fallback,
//                      and an empty dir (must stay UNKNOWN). Exit 0 = all pass, 1 = any fail.
// What it touches:     Creates + removes temp dirs under os.tmpdir() only. Writes nothing to
//                      the repo; --dry-run means repo-detect writes no dream-init-state.json.
// What it does NOT do: No network, no git, no writes outside the OS temp dir, no mutation of
//                      plugin or project state.
// APIs / commands:     Node stdlib fs, os, path; child_process.spawnSync('node', ...).
// How to verify:       node tests/repo-detect.test.cjs → exit 0 and "5 passed · 0 failed".

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DETECT = path.join(__dirname, '..', 'scripts', 'repo-detect.cjs');
let pass = 0, fail = 0;

function mk(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-detect-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function run(root) {
  const r = spawnSync('node', [DETECT, '--root=' + root, '--dry-run'], { encoding: 'utf8' });
  const m = /REPO_TYPE=(\S+)/.exec(r.stdout || '');
  return { type: m ? m[1] : null, code: r.status };
}

function check(name, files, expectType, expectCode) {
  const root = mk(files);
  try {
    const { type, code } = run(root);
    const ok = type === expectType && code === expectCode;
    console.log(`  ${ok ? '✓' : '✗'} ${name} → type=${type} code=${code}` +
      (ok ? '' : ` (expected type=${expectType} code=${expectCode})`));
    ok ? pass++ : fail++;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

console.log('▶ repo-detect regression (modern .NET formats)');
check('.slnx-only solution',     { 'MyApi.slnx': '<Solution/>' },                                    'DOTNET_API', 0);
check('nested .csproj',          { 'src/Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"/>' }, 'DOTNET_API', 0);
check('.fsproj project',         { 'App.fsproj': '<Project/>' },                                     'DOTNET_API', 0);
check('.cs-only fallback',       { 'src/Program.cs': 'class P{}' },                                  'DOTNET_API', 0);
check('empty dir stays UNKNOWN', { 'README.md': '# nothing' },                                       null,         3);

// ── Track-A default-seed (per_project_rules) — mergeState writes state (NOT --dry-run) ──
function runWrite(root, force) {
  spawnSync('node', [DETECT, '--root=' + root].concat(force ? ['--force'] : []), { encoding: 'utf8' });
  try { return JSON.parse(fs.readFileSync(path.join(root, '.claude', 'dream-init-state.json'), 'utf8')); }
  catch (e) { return {}; }
}
// (a) fresh .NET detect → per_project_rules seeded false
let root = mk({ 'src/Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>' });
let st = runWrite(root, false);
(st.per_project_rules === false) ? (pass++, console.log('  ✓ default-seed: per_project_rules === false on fresh detect'))
  : (fail++, console.log('  ✗ default-seed: expected per_project_rules false, got ' + JSON.stringify(st.per_project_rules)));
fs.rmSync(root, { recursive: true, force: true });

// (b) existing state with per_project_rules:true → NOT clobbered by a --force re-detect
root = mk({ 'src/Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>' });
fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
fs.writeFileSync(path.join(root, '.claude', 'dream-init-state.json'), JSON.stringify({ per_project_rules: true }));
st = runWrite(root, true);
(st.per_project_rules === true) ? (pass++, console.log('  ✓ default-seed: existing per_project_rules:true survives re-detect'))
  : (fail++, console.log('  ✗ default-seed: developer true was clobbered → ' + JSON.stringify(st.per_project_rules)));
fs.rmSync(root, { recursive: true, force: true });

console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
