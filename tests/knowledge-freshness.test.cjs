#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Self-contained test for knowledge-freshness.cjs. Exercises the pure classifier
//                      (classifyRef/anchorOf/normalizeVersion) directly and the `check` CLI via
//                      spawnSync against fixtures, asserting classifications + exit-code contract
//                      (0 none-stale · 9 some-stale · 1 error) + UNKNOWN-not-FRESH honesty.
// What it touches:     require()s scripts/knowledge-freshness.cjs + scripts/lib/source-classifier.cjs;
//                      spawns the check CLI reading fixtures under tests/fixtures/knowledge-freshness/.
//                      Writes nothing.
// What it does NOT do: NO network, NO git, NO disk writes, NO project-source mutation.
// APIs / commands:     child_process.spawnSync; retries once on the Windows 0xC0000005 transient
//                      loader crash (exit > 3221225000).
// How to verify:       node tests/knowledge-freshness.test.cjs   -> "N passed · 0 failed".

'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const kf = require('../scripts/knowledge-freshness.cjs');
const sc = require('../scripts/lib/source-classifier.cjs');

const SCRIPT = path.join('scripts', 'knowledge-freshness.cjs');
const FIX    = path.join('tests', 'fixtures', 'knowledge-freshness');

function checkCli(args) {
  let r = spawnSync('node', [SCRIPT, 'check', ...args], { encoding: 'utf8' });
  if (r.status !== null && r.status > 3221225000) r = spawnSync('node', [SCRIPT, 'check', ...args], { encoding: 'utf8' });
  return r;
}

// restamp writes the manifest — copy a fixture into an OS temp dir so committed fixtures stay pristine.
function mkTempManifest(fixtureName) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kf-'));
  const dest = path.join(dir, 'manifest.json');
  fs.copyFileSync(path.join(FIX, fixtureName), dest);
  return dest;
}
function cleanup(tmpFile) { try { fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true }); } catch (_) { /* best-effort */ } }
function restampCli(args) {
  let r = spawnSync('node', [SCRIPT, 'restamp', ...args], { encoding: 'utf8' });
  if (r.status !== null && r.status > 3221225000) r = spawnSync('node', [SCRIPT, 'restamp', ...args], { encoding: 'utf8' });
  return r;
}

const stacksRef  = { path: 'refs/stacks/dotnet.md', versions: '.NET 8', last_verified: '2026-09-01' };
const agedRef    = { path: 'refs/stacks/dotnet.md', versions: '.NET 8', last_verified: '2025-01-01' };
const mappingRef = { path: 'refs/mappings/dotnet-upgrade.md', source: '.NET 6/7', target: '.NET 8', last_verified: '2026-09-01' };

const cases = [
  // ── pure classifier (AC-F1/F2/F3/NF3) ──
  ['P-U1 within TTL, no latest -> UNKNOWN',            () => kf.classifyRef(stacksRef, null, '2026-09-10', 180) === 'UNKNOWN'],
  ['P-U2 anchor vs latest (case/space) -> FRESH',      () => kf.classifyRef(stacksRef, ' .NET   8 ', '2026-09-10', 180) === 'FRESH'],
  ['P-U3 200d old, ttl 180 -> STALE-BY-AGE',           () => kf.classifyRef(agedRef, null, '2026-09-10', 180) === 'STALE-BY-AGE'],
  ['P-U4 mapping target differs -> STALE-BY-VERSION',  () => kf.classifyRef(mappingRef, '.NET 10', '2026-09-10', 180) === 'STALE-BY-VERSION'],
  ['N-U4 present but absent from latest -> UNKNOWN',   () => kf.classifyRef(stacksRef, null, '2026-09-10', 180) === 'UNKNOWN'],
  ['anchorOf uses target for mappings',                () => kf.anchorOf(mappingRef) === '.NET 8'],
  ['normalizeVersion collapses case/space',            () => kf.normalizeVersion(' .NET   8 ') === '.net 8'],
  // ── source-classifier (AC-F5 reuse) ──
  ['classifySource authoritative -> VERIFIED',         () => sc.classifySource('dotnet', 'https://learn.microsoft.com/x').tier === 'VERIFIED'],
  ['classifySource unknown host -> INFERRED',          () => sc.classifySource('dotnet', 'https://random-blog.example/x').tier === 'INFERRED'],
  // ── check CLI exit-code contract (AC-F4) ──
  ['P-U5 all fresh, no latest -> exit 0',              () => checkCli([`--manifest=${path.join(FIX, 'manifest-fresh.json')}`, '--now=2026-09-10']).status === 0],
  ['N-U1 aged manifest -> exit 9',                     () => checkCli([`--manifest=${path.join(FIX, 'manifest-aged.json')}`, '--now=2026-09-10']).status === 9],
  ['version stale via --latest -> exit 9',             () => checkCli([`--manifest=${path.join(FIX, 'manifest-fresh.json')}`, `--latest=${path.join(FIX, 'latest-version-stale.json')}`, '--now=2026-09-10']).status === 9],
  ['fresh via normalized --latest -> exit 0',          () => checkCli([`--manifest=${path.join(FIX, 'manifest-fresh.json')}`, `--latest=${path.join(FIX, 'latest-fresh-normalized.json')}`, '--now=2026-09-10']).status === 0],
  ['N-U2 missing --latest file -> exit 1',             () => checkCli([`--manifest=${path.join(FIX, 'manifest-fresh.json')}`, `--latest=${path.join(FIX, 'does-not-exist.json')}`, '--now=2026-09-10']).status === 1],
  ['N-U3 corrupt manifest -> exit 1',                  () => checkCli([`--manifest=${path.join(FIX, 'manifest-corrupt.json')}`, '--now=2026-09-10']).status === 1],
  // ── restamp (AC-F9) ──
  ['R-P1 applyRestamp bumps target, leaves others', () => {
    const m = { refs: [{ path: 'a', last_verified: '2020-01-01' }, { path: 'b', last_verified: '2020-01-01' }] };
    const { found } = kf.applyRestamp(m, 'a', '2026-09-10');
    return found && m.refs[0].last_verified === '2026-09-10' && m.refs[1].last_verified === '2020-01-01';
  }],
  ['R-P2 restamp CLI stamps -> exit 0, others intact', () => {
    const tmp = mkTempManifest('manifest-fresh.json');
    const r = restampCli([`--manifest=${tmp}`, '--path=refs/stacks/dotnet.md', '--now=2026-09-10']);
    const after = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    const dotnet  = after.refs.find(x => x.path === 'refs/stacks/dotnet.md');
    const mapping = after.refs.find(x => x.path === 'refs/mappings/dotnet-upgrade.md');
    cleanup(tmp);
    return r.status === 0 && dotnet.last_verified === '2026-09-10' && mapping.last_verified === '2026-09-01';
  }],
  ['R-N1 restamp path not found -> exit 10, unchanged', () => {
    const tmp = mkTempManifest('manifest-fresh.json');
    const before = fs.readFileSync(tmp, 'utf8');
    const r = restampCli([`--manifest=${tmp}`, '--path=refs/nope.md', '--now=2026-09-10']);
    const after = fs.readFileSync(tmp, 'utf8');
    cleanup(tmp);
    return r.status === 10 && before === after;
  }],
  ['R-N2 restamp missing --path -> exit 1',            () => restampCli([`--manifest=${path.join(FIX, 'manifest-fresh.json')}`, '--now=2026-09-10']).status === 1],
  ['R-N3 restamp corrupt manifest -> exit 1', () => {
    const tmp = mkTempManifest('manifest-corrupt.json');
    const r = restampCli([`--manifest=${tmp}`, '--path=x', '--now=2026-09-10']);
    cleanup(tmp);
    return r.status === 1;
  }],
];

let passed = 0, failed = 0;
for (const [name, fn] of cases) {
  let ok = false;
  try { ok = fn(); } catch (e) { ok = false; }
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else    { failed++; console.log(`  ✗ ${name}`); }
}
console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
