#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/upgrade-knowledge-cache.cjs against fixed inputs and asserts the
//                      source-verification tier (VERIFIED/INFERRED), lowered-confidence rule, dated
//                      cache entry, stable-layer immutability/idempotency, volatile-layer TTL
//                      staleness (hit/stale/miss), the `tag` op, and every exit code. Exit 0 = all
//                      pass, 1 = any fail.
// What it touches:     Writes JSON cache files under a throwaway dir in the OS temp folder (removed
//                      at start + end). Spawns `node scripts/upgrade-knowledge-cache.cjs`.
// What it does NOT do: No network, no git, no mutation of plugin/project source, no writes outside
//                      the temp cache dir.
// APIs / commands:     Node stdlib: os.tmpdir, fs, path, child_process.spawnSync('node', ...).
// How to verify:       node tests/upgrade-knowledge-cache.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CACHE = path.join(__dirname, '..', 'scripts', 'upgrade-knowledge-cache.cjs');
const DIR   = path.join(os.tmpdir(), `upgrade-kb-test-${process.pid}`);
let pass = 0, fail = 0;

function reset() { fs.rmSync(DIR, { recursive: true, force: true }); }

function run(args) {
  const r = spawnSync('node', [CACHE, ...args, `--cache-dir=${DIR}`, '--json'], { encoding: 'utf8' });
  let json = {};
  try { json = JSON.parse(r.stdout || '{}'); } catch (_) { /* leave empty → assertion fails */ }
  return { json, code: r.status };
}

// Fact-level fields live under `record` on a `put` (and directly on a `tag`); everything else
// (status, duplicate, op) is top-level. Route each expected key to where it actually lives.
const RECORD_KEYS = new Set(['tier', 'authoritative', 'confidence', 'source', 'cached_at']);
function check(name, { json, code }, expect) {
  const errs = [];
  const factView = json.record ?? json;   // put -> json.record; tag -> json
  for (const [k, v] of Object.entries(expect)) {
    if (k === 'code') { if (code !== v) errs.push(`exit ${code} !== ${v}`); continue; }
    if (k === 'confidenceMax') { if (!(factView.confidence > 0) || factView.confidence > v) errs.push(`confidence ${factView.confidence} not <= ${v}`); continue; }
    if (k === 'datedCachedAt') { if (!factView.cached_at) errs.push('cached_at missing (fact not dated)'); continue; }
    const actual = RECORD_KEYS.has(k) ? factView[k] : json[k];
    if (actual !== v) errs.push(`${k} ${JSON.stringify(actual)} !== ${JSON.stringify(v)}`);
  }
  if (errs.length === 0) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${errs.join('\n      ')}`); }
}

reset();

// P-U4 — authoritative source → VERIFIED, dated, high confidence, stored
check('P-U4 dotnet 6->8 authoritative source -> VERIFIED + dated (exit 0)',
  run(['put', '--stack=dotnet', '--from=6', '--to=8',
       '--fact=ApiController activation changed', '--source=https://learn.microsoft.com/dotnet/core/compatibility',
       '--source-date=2024-11-12', '--now=2026-09-08']),
  { status: 'stored', tier: 'VERIFIED', authoritative: true, code: 0, datedCachedAt: true });

// N-U4 — no authoritative source → INFERRED, confidence lowered
check('N-U4 no authoritative source -> INFERRED + confidence lowered (<=0.5)',
  run(['put', '--stack=dotnet', '--from=6', '--to=8',
       '--fact=Some blog claims a config key was renamed', '--source=https://random-dev-blog.example.com/post',
       '--now=2026-09-08']),
  { status: 'stored', tier: 'INFERRED', authoritative: false, confidenceMax: 0.5, code: 0 });

// N-U4b — empty source → INFERRED (model-memory claim, never VERIFIED)
check('N-U4c empty source -> INFERRED (no fabrication as fact)',
  run(['tag', '--stack=dotnet', '--source=']),
  { op: 'tag', tier: 'INFERRED', authoritative: false, code: 0 });

// tag op — authoritative host classification is pure + correct
check('TAG angular.dev -> VERIFIED (authoritative)',
  run(['tag', '--stack=angular', '--source=https://angular.dev/update-guide']),
  { op: 'tag', tier: 'VERIFIED', authoritative: true, code: 0 });

// Immutability — identical re-put of a stable fact is idempotent (duplicate:true, still exit 0)
reset();
run(['put', '--stack=java', '--from=8', '--to=21', '--fact=javax became jakarta', '--source=https://openjdk.org/x', '--now=2026-09-08']);
check('IMMUT identical re-put of stable fact is idempotent (duplicate:true)',
  run(['put', '--stack=java', '--from=8', '--to=21', '--fact=javax became jakarta', '--source=https://openjdk.org/x', '--now=2026-09-08']),
  { status: 'stored', duplicate: true, code: 0 });

// get — miss before any put, hit after
reset();
check('GET miss on empty cache (exit 7)',
  run(['get', '--stack=python', '--from=3.9', '--to=3.12']),
  { op: 'get', status: 'miss', code: 7 });
run(['put', '--stack=python', '--from=3.9', '--to=3.12', '--fact=distutils removed', '--source=https://docs.python.org/3/whatsnew', '--now=2026-09-08']);
check('GET hit after put (exit 0)',
  run(['get', '--stack=python', '--from=3.9', '--to=3.12', '--now=2026-09-08']),
  { op: 'get', status: 'hit', code: 0 });

// Volatile TTL — fresh within TTL is hit, past TTL is stale
reset();
run(['put', '--stack=nodejs', '--layer=volatile', '--fact=ncu supports flat config', '--source=https://github.com/raineorshine/npm-check-updates', '--ttl-days=14', '--now=2026-01-01']);
check('TTL volatile within TTL -> hit (exit 0)',
  run(['get', '--stack=nodejs', '--layer=volatile', '--now=2026-01-10']),
  { op: 'get', status: 'hit', code: 0 });
check('TTL volatile past TTL -> stale (exit 6)',
  run(['get', '--stack=nodejs', '--layer=volatile', '--now=2026-01-20']),
  { op: 'get', status: 'stale', code: 6 });

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
