#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/research-cache.cjs — lookup (hit/miss/stale/expired/corrupt),
//                      write (new entry, overwrite, missing bundle file, invalid JSON),
//                      and expire (removes old entries, keeps fresh ones).
//                      All cache writes go to a throwaway temp directory — never touches
//                      the real machine-level cache.
// What it touches:     Writes JSON files to os.tmpdir()/research-cache-test-{pid}/; removed at
//                      start and end of the run.
// What it does NOT do: No network. No git. No mutations outside the temp dir.
// APIs / commands:     Node stdlib: os.tmpdir, fs, path, child_process.spawnSync.
// How to verify:       node tests/research-cache.test.cjs  -> exit 0 and "N passed · 0 failed"

'use strict';
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { keyToFilename } = require('../scripts/research-cache.cjs');

const SCRIPT       = path.join(__dirname, '..', 'scripts', 'research-cache.cjs');
const CACHE_DIR    = path.join(os.tmpdir(), `research-cache-test-${process.pid}`);
const FIXTURES_DIR = path.join(os.tmpdir(), `research-cache-fixtures-${process.pid}`);
let pass = 0, fail = 0;

// Date helpers — relative to today so tests are not tied to a fixed date
const today = new Date();
function daysAgo(n) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function reset() {
  fs.rmSync(CACHE_DIR,    { recursive: true, force: true });
  fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
}
function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args, `--cache-dir=${CACHE_DIR}`, '--json'], { encoding: 'utf8' });
  let json = {}; try { json = JSON.parse(r.stdout || '{}'); } catch (_) {}
  return { json, code: r.status, stderr: r.stderr || '' };
}
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else       { fail++; console.log(`  ✗ ${name}\n      ${String(detail)}`); }
}

// Writes bundle input files to FIXTURES_DIR — separate from CACHE_DIR so expire never sweeps them
function writeBundleFile(name, content) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const f = path.join(FIXTURES_DIR, name);
  fs.writeFileSync(f, JSON.stringify(content));
  return f;
}

// Backdates the generated_at field in an existing cache file
function backdateEntry(cacheFile, dateStr) {
  const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  data.generated_at = dateStr;
  fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
}

reset();
fs.mkdirSync(CACHE_DIR,    { recursive: true });
fs.mkdirSync(FIXTURES_DIR, { recursive: true });

const KEY    = 'dotnet-6-to-dotnet-8';
const BUNDLE = { layers: [{ stack: 'dotnet', version: '8', eol_status: { status: 'active' } }] };

// ── LOOKUP: miss on empty cache
const miss = run(['lookup', `--key=${KEY}`]);
assert('lookup miss exits 1', miss.code === 1, `code=${miss.code}`);
assert('lookup miss status=miss', miss.json.status === 'miss', miss.json.status);
assert('lookup miss reason=not-found', miss.json.reason === 'not-found', miss.json.reason);

// ── WRITE: new entry
const bf = writeBundleFile('bundle.json', BUNDLE);
const wr = run(['write', `--key=${KEY}`, `--bundle-file=${bf}`,
  '--source-stack=dotnet', '--source-version=6',
  '--target-stack=dotnet', '--target-version=8']);
assert('write new entry exits 0', wr.code === 0, `code=${wr.code}`);
assert('write status=ok', wr.json.status === 'ok', wr.json.status);
assert('write entry has generated_at', typeof wr.json.entry?.generated_at === 'string', wr.json.entry?.generated_at);
assert('write entry has source_stack', wr.json.entry?.source_stack === 'dotnet', wr.json.entry?.source_stack);
assert('write entry has bundle', wr.json.entry?.bundle?.layers?.length === 1, JSON.stringify(wr.json.entry?.bundle));

// ── LOOKUP: fresh hit
const hit = run(['lookup', `--key=${KEY}`]);
assert('lookup fresh hit exits 0', hit.code === 0, `code=${hit.code}`);
assert('lookup fresh hit status=hit', hit.json.status === 'hit', hit.json.status);
assert('lookup fresh staleness=fresh', hit.json.staleness === 'fresh', hit.json.staleness);
assert('lookup fresh age_days <= 1', hit.json.age_days <= 1, `age=${hit.json.age_days}`);
assert('lookup fresh entry has bundle', hit.json.entry?.bundle?.layers?.length === 1, JSON.stringify(hit.json.entry?.bundle));

// ── LOOKUP: stale hit (31 days old — between WARN=30 and EXPIRE=90)
const cacheFile = wr.json.cache_file;
backdateEntry(cacheFile, daysAgo(31));
const stale = run(['lookup', `--key=${KEY}`]);
assert('lookup stale exits 0 (still usable)', stale.code === 0, `code=${stale.code}`);
assert('lookup stale status=hit', stale.json.status === 'hit', stale.json.status);
assert('lookup stale staleness=stale', stale.json.staleness === 'stale', stale.json.staleness);
assert('lookup stale age_days > 30', stale.json.age_days > 30, `age=${stale.json.age_days}`);
assert('lookup stale file still exists', fs.existsSync(cacheFile), 'file was deleted');

// ── LOOKUP: expired (91 days old — beyond EXPIRE=90) — deletes file, returns miss
backdateEntry(cacheFile, daysAgo(91));
const expired = run(['lookup', `--key=${KEY}`]);
assert('lookup expired exits 1', expired.code === 1, `code=${expired.code}`);
assert('lookup expired reason=expired', expired.json.reason === 'expired', expired.json.reason);
assert('lookup expired age_days > 90', expired.json.age_days > 90, `age=${expired.json.age_days}`);
assert('lookup expired file deleted', !fs.existsSync(cacheFile), 'file still exists');

// ── WRITE: overwrite after expiry (fresh date)
const bf2 = writeBundleFile('bundle2.json', BUNDLE);
run(['write', `--key=${KEY}`, `--bundle-file=${bf2}`,
  '--source-stack=dotnet', '--source-version=6',
  '--target-stack=dotnet', '--target-version=8']);
const hitAfterExpiry = run(['lookup', `--key=${KEY}`]);
assert('lookup hit after re-write exits 0', hitAfterExpiry.code === 0, `code=${hitAfterExpiry.code}`);
assert('lookup hit after re-write staleness=fresh', hitAfterExpiry.json.staleness === 'fresh', hitAfterExpiry.json.staleness);

// ── WRITE: missing bundle file exits 1, no cache mutation
const beforeWrite = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json')).length;
const badWrite = run(['write', `--key=${KEY}`, '--bundle-file=/nonexistent/path.json',
  '--source-stack=dotnet', '--source-version=6',
  '--target-stack=dotnet', '--target-version=8']);
assert('write missing bundle-file exits 1', badWrite.code === 1, `code=${badWrite.code}`);
const afterWrite = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json')).length;
assert('write missing bundle-file does not mutate cache', beforeWrite === afterWrite, `before=${beforeWrite} after=${afterWrite}`);

// ── WRITE: invalid JSON bundle file exits 1
// Write raw corrupt bytes directly — writeBundleFile uses JSON.stringify which would make it valid
const badJsonFile = path.join(FIXTURES_DIR, 'bad-raw.json');
fs.writeFileSync(badJsonFile, 'NOT JSON {{{');
const badJson = run(['write', `--key=${KEY}`, `--bundle-file=${badJsonFile}`,
  '--source-stack=dotnet', '--source-version=6',
  '--target-stack=dotnet', '--target-version=8']);
assert('write invalid JSON bundle exits 1', badJson.code === 1, `code=${badJson.code}`);

// ── LOOKUP: corrupt cache file → treated as miss, file deleted
const corruptKey  = 'corrupt-test-key';
const corruptFile = path.join(CACHE_DIR, keyToFilename(corruptKey));
fs.writeFileSync(corruptFile, 'NOT JSON {{{');
const corrupt = run(['lookup', `--key=${corruptKey}`]);
assert('lookup corrupt exits 1', corrupt.code === 1, `code=${corrupt.code}`);
assert('lookup corrupt reason=corrupt-deleted', corrupt.json.reason === 'corrupt-deleted', corrupt.json.reason);
assert('lookup corrupt file deleted', !fs.existsSync(corruptFile), 'file still exists');

// ── EXPIRE: removes aged entries, keeps fresh ones
// Reset to a clean cache with exactly two entries so fixture files don't interfere
reset();
fs.mkdirSync(CACHE_DIR,    { recursive: true });
fs.mkdirSync(FIXTURES_DIR, { recursive: true });

// Fresh entry
const expBf1 = writeBundleFile('exp-bundle1.json', BUNDLE);
run(['write', `--key=${KEY}`, `--bundle-file=${expBf1}`,
  '--source-stack=dotnet', '--source-version=6',
  '--target-stack=dotnet', '--target-version=8']);

// Aged entry — write fresh then backdate
const KEY2 = 'java-8-to-java-21';
const expBf2 = writeBundleFile('exp-bundle2.json', { layers: [] });
run(['write', `--key=${KEY2}`, `--bundle-file=${expBf2}`,
  '--source-stack=java', '--source-version=8',
  '--target-stack=java', '--target-version=21']);
const f2 = path.join(CACHE_DIR, keyToFilename(KEY2));
backdateEntry(f2, daysAgo(100));  // 100 days old — beyond 90-day threshold

const exp = run(['expire', '--days=90']);
assert('expire exits 0', exp.code === 0, `code=${exp.code}`);
assert('expire removed 1 aged entry', exp.json.removed === 1, `removed=${exp.json.removed}`);
assert('expire kept fresh entry', exp.json.kept >= 1, `kept=${exp.json.kept}`);
assert('expire fresh KEY entry still exists',
  fs.existsSync(path.join(CACHE_DIR, keyToFilename(KEY))), 'fresh entry missing');
assert('expire aged KEY2 entry removed', !fs.existsSync(f2), 'aged entry still exists');

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
