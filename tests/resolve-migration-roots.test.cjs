#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/resolve-migration-roots.cjs — the shared deterministic
//                      BFS root resolution script used by all three migration skills.
//                      Covers: exit 5 (settings absent), exit 6 (missing dir), BFS depth
//                      bounding, cycle prevention, merge-write preserves existing keys,
//                      source-path absent (exit 1), unknown flag (exit 1), relative path
//                      resolution anchored to the settings-file owner (not CWD).
// What it touches:     Creates temp fixture directories; spawns resolve-migration-roots.cjs.
// What it does NOT do: No network, no git, no ledger writes outside the temp tree.
// How to verify:       node tests/resolve-migration-roots.test.cjs -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'resolve-migration-roots.cjs');
let pass = 0, fail = 0;

function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); }
}

// ── Fixture helpers ─────────────────────────────────────────────────────────
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'rmr-test-'));
function dir(...parts) { return path.join(ROOT, ...parts); }
function makeDir(...parts) { fs.mkdirSync(dir(...parts), { recursive: true }); return dir(...parts); }
function writeSettings(p, additionalDirectories) {
  const settingsDir = path.join(p, '.claude');
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(path.join(settingsDir, 'settings.local.json'),
    JSON.stringify({ additionalDirectories }, null, 2));
}

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args, '--json'], { encoding: 'utf8' });
  let json = {};
  try { json = JSON.parse(r.stdout || r.stderr || '{}'); } catch (_) {}
  return { json, code: r.status, stderr: r.stderr };
}

// ── Build fixture tree ───────────────────────────────────────────────────────
// source-app  ─ has settings with dep-a and dep-b
//   dep-a     ─ has settings with dep-a1
//     dep-a1  ─ has settings with dep-a1a (depth-3 node; children should NOT be followed)
//       dep-a1a ─ has settings (should NOT be followed at depth=3)
//   dep-b     ─ no settings (leaf)
// cycle-a     ─ has settings pointing to cycle-b
// cycle-b     ─ has settings pointing to cycle-a

const sourceApp = makeDir('source-app');
const depA      = makeDir('dep-a');
const depA1     = makeDir('dep-a1');
const depA1a    = makeDir('dep-a1a');
const depB      = makeDir('dep-b');
const cycleA    = makeDir('cycle-a');
const cycleB    = makeDir('cycle-b');
const missing   = dir('does-not-exist');   // never created

writeSettings(sourceApp, [depA, depB]);
writeSettings(depA, [depA1]);
writeSettings(depA1, [depA1a]);
writeSettings(depA1a, [dir('should-not-reach')]);   // beyond depth 3
writeSettings(cycleA, [cycleB]);
writeSettings(cycleB, [cycleA]);
// depB: no .claude directory (leaf)

// ── Test 1: exit 5 when source settings absent ───────────────────────────────
const noSettings = makeDir('no-settings');   // exists but has no .claude/settings.local.json
const t1 = run([`--source-path=${noSettings}`]);
assert('exit 5 when settings.local.json absent at source-path', t1.code === 5, `code=${t1.code} json=${JSON.stringify(t1.json)}`);
assert('exit 5 status field is settings-absent', t1.json.status === 'settings-absent', `status=${t1.json.status}`);

// ── Test 2: exit 1 when --source-path does not exist on disk ────────────────
const t2 = run([`--source-path=${dir('totally-absent')}`]);
assert('exit 1 when --source-path does not exist on disk', t2.code === 1, `code=${t2.code}`);
assert('exit 1 status is source-path-absent', t2.json.status === 'source-path-absent', `status=${t2.json.status}`);

// ── Test 3: exit 1 on unknown flag ──────────────────────────────────────────
const t3 = run([`--source-path=${sourceApp}`, '--unknown-flag']);
assert('exit 1 on unknown flag', t3.code === 1, `code=${t3.code}`);
assert('exit 1 unknown flag — stderr names the flag', (t3.stderr || '').includes('unknown flag --unknown-flag'), t3.stderr);

// ── Test 4: exit 0, BFS depth=3, correct roots ──────────────────────────────
const t4 = run([`--source-path=${sourceApp}`, '--depth=3']);
assert('exit 0 with valid source', t4.code === 0, `code=${t4.code} json=${JSON.stringify(t4.json)}`);
assert('status=ok', t4.json.status === 'ok', `status=${t4.json.status}`);

const norm = p => path.resolve(p).split('\\').join('/').replace(/\/+$/, '');
const r4 = (t4.json.roots || []).map(norm);
assert('source-app itself is in roots', r4.includes(norm(sourceApp)), `roots=${JSON.stringify(r4)}`);
assert('dep-a is in roots (depth 1)', r4.includes(norm(depA)), `roots=${JSON.stringify(r4)}`);
assert('dep-b is in roots (depth 1, no settings is fine)', r4.includes(norm(depB)), `roots=${JSON.stringify(r4)}`);
assert('dep-a1 is in roots (depth 2)', r4.includes(norm(depA1)), `roots=${JSON.stringify(r4)}`);
assert('dep-a1a is in roots (depth 3)', r4.includes(norm(depA1a)), `roots=${JSON.stringify(r4)}`);
assert('should-not-reach is NOT in roots (depth 4 > MAX_DEPTH=3)', !r4.includes(norm(dir('should-not-reach'))), `roots=${JSON.stringify(r4)}`);

// ── Test 5: cycle prevention (cycle-a ↔ cycle-b) ────────────────────────────
const t5 = run([`--source-path=${cycleA}`, '--depth=3']);
assert('exit 0 despite a→b→a cycle', t5.code === 0, `code=${t5.code} json=${JSON.stringify(t5.json)}`);
const r5 = (t5.json.roots || []).map(norm);
assert('cycle-a in roots', r5.includes(norm(cycleA)), `roots=${JSON.stringify(r5)}`);
assert('cycle-b in roots', r5.includes(norm(cycleB)), `roots=${JSON.stringify(r5)}`);
assert('exactly 2 roots (no infinite expansion)', r5.length === 2, `roots=${JSON.stringify(r5)}`);

// ── Test 6: exit 6 when a configured additional dir is missing ───────────────
writeSettings(makeDir('source-with-missing'), [missing]);
const t6 = run([`--source-path=${dir('source-with-missing')}`]);
assert('exit 6 when additionalDirectory does not exist', t6.code === 6, `code=${t6.code}`);
assert('exit 6 status=missing-dirs', t6.json.status === 'missing-dirs', `status=${t6.json.status}`);
assert('exit 6 reports the missing path', (t6.json.missing || []).some(m => norm(m.path) === norm(missing)), `missing=${JSON.stringify(t6.json.missing)}`);

// ── Test 7: merge-write — preserves all existing keys, sets only migrationRoots ─
const writeTarget = path.join(ROOT, 'write-target.json');
fs.writeFileSync(writeTarget, JSON.stringify({ additionalDirectories: ['/existing'], someOtherKey: 'preserve-me' }, null, 2));
const t7 = run([`--source-path=${sourceApp}`, `--write-to=${writeTarget}`, '--depth=1']);
assert('exit 0 with --write-to', t7.code === 0, `code=${t7.code}`);
const written = JSON.parse(fs.readFileSync(writeTarget, 'utf8'));
assert('merge-write preserves additionalDirectories', JSON.stringify(written.additionalDirectories) === JSON.stringify(['/existing']), `written=${JSON.stringify(written)}`);
assert('merge-write preserves other keys', written.someOtherKey === 'preserve-me', `written=${JSON.stringify(written)}`);
assert('merge-write sets migrationRoots', Array.isArray(written.migrationRoots) && written.migrationRoots.length > 0, `written=${JSON.stringify(written)}`);

// ── Test 8: depth=1 limits BFS to source and direct additionalDirs only ──────
const t8 = run([`--source-path=${sourceApp}`, '--depth=1']);
assert('exit 0 with depth=1', t8.code === 0, `code=${t8.code}`);
const r8 = (t8.json.roots || []).map(norm);
assert('depth=1: source-app in roots', r8.includes(norm(sourceApp)), `roots=${JSON.stringify(r8)}`);
assert('depth=1: dep-a in roots (direct child)', r8.includes(norm(depA)), `roots=${JSON.stringify(r8)}`);
assert('depth=1: dep-a1 NOT in roots (grandchild)', !r8.includes(norm(depA1)), `roots=${JSON.stringify(r8)}`);

// ── Test 9: corrupt --write-to exits 1, does not silently overwrite ──────────
const corruptTarget = path.join(ROOT, 'corrupt.json');
fs.writeFileSync(corruptTarget, 'not valid json {{{');
const t9 = run([`--source-path=${sourceApp}`, `--write-to=${corruptTarget}`]);
assert('exit 1 on corrupt --write-to (refuses to overwrite)', t9.code === 1, `code=${t9.code}`);
assert('corrupt file not modified (still invalid JSON)', (() => { try { JSON.parse(fs.readFileSync(corruptTarget, 'utf8')); return false; } catch (_) { return true; } })(), 'file was silently overwritten');

// ── Test 10: relative path in additionalDirectories resolved against owner dir, not CWD ─
// dep-rel has a settings.local.json with a relative additionalDirectory '../rel-sibling'
// which should resolve to ROOT/rel-sibling (sibling of dep-rel), not CWD/../rel-sibling
const depRel    = makeDir('dep-rel');
const relSibling = makeDir('rel-sibling');
writeSettings(depRel, ['../rel-sibling']);   // relative path
const t10source = makeDir('source-for-rel');
writeSettings(t10source, [depRel]);          // source → dep-rel (depth 1) → rel-sibling (depth 2, relative)
const t10 = run([`--source-path=${t10source}`, '--depth=3']);
assert('exit 0 with relative additionalDirectory', t10.code === 0, `code=${t10.code} json=${JSON.stringify(t10.json)}`);
const r10 = (t10.json.roots || []).map(norm);
assert('relative ../rel-sibling resolved against dep-rel owner, not CWD', r10.includes(norm(relSibling)), `roots=${JSON.stringify(r10)}\nexpected: ${norm(relSibling)}`);

// ── Cleanup + summary ────────────────────────────────────────────────────────
try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (_) {}
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
