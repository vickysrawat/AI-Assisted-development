#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs the substrate bundling SEAM end to end against a throwaway source: bundle
//                      -> drift-check (clean, exit 0); edit the bundled copy -> drift-check (drift,
//                      exit 10); re-bundle then edit the CANONICAL -> drift-check (drift, exit 10).
//                      Also asserts the bundled copies are banner-marked GENERATED. Plus a REAL case:
//                      bundle the actual skills/shared and assert file-count == disk + drift-check clean.
// What it touches:     Creates/removes a throwaway src + dest under the OS temp dir.
// What it does NOT do: No network, no git, no mutation of the real skills/shared or .vendor dirs.
// APIs / commands:     Node stdlib: os.tmpdir, fs, path, child_process.spawnSync('node', ...).
// How to verify:       node tests/substrate-drift.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const VENDOR = path.join(__dirname, '..', 'scripts', 'vendor-substrate.cjs');
const DRIFT  = path.join(__dirname, '..', 'scripts', 'substrate-drift-check.cjs');
const ROOT   = path.join(os.tmpdir(), `substrate-test-${process.pid}`);
const SRC    = path.join(ROOT, 'shared');
const DEST   = path.join(ROOT, 'vendor');
let pass = 0, fail = 0;

function reset() { fs.rmSync(ROOT, { recursive: true, force: true }); }
function seedSrc() {
  fs.mkdirSync(SRC, { recursive: true });
  fs.writeFileSync(path.join(SRC, 'judge.md'), '# Judge\nRubric content.\n');
  fs.writeFileSync(path.join(SRC, 'model-routing-spec.md'), '# Routing\nThree-tier ladder.\n');
}
function vendor() { return spawnSync('node', [VENDOR, `--src=${SRC}`, `--dest=${DEST}`, '--version=1.0', '--now=2026-09-08', '--json'], { encoding: 'utf8' }); }
function drift()  { const r = spawnSync('node', [DRIFT, `--src=${SRC}`, `--dest=${DEST}`, '--json'], { encoding: 'utf8' }); let j = {}; try { j = JSON.parse(r.stdout || '{}'); } catch (_) {} return { json: j, code: r.status }; }
function assert(name, cond, detail) { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); } }

reset(); seedSrc();

// bundle + banner
const v = vendor();
assert('BUNDLE exit 0', v.status === 0, `exit ${v.status}`);
assert('BUNDLE banner-marks copies GENERATED',
  fs.readFileSync(path.join(DEST, 'judge.md'), 'utf8').startsWith('<!-- GENERATED — DO NOT EDIT'),
  fs.readFileSync(path.join(DEST, 'judge.md'), 'utf8').slice(0, 40));

// P-U5 — bundled == canonical -> clean, exit 0
const clean = drift();
assert('P-U5 clean drift-check (exit 0)', clean.code === 0 && clean.json.status === 'clean', `code=${clean.code} status=${clean.json.status}`);

// N-U5 — bundled copy edited -> drift, exit 10
fs.appendFileSync(path.join(DEST, 'judge.md'), '\nhand-edited line\n');
const edited = drift();
assert('N-U5 bundled edit -> drift (exit 10)', edited.code === 10 && edited.json.status === 'drift', `code=${edited.code} status=${edited.json.status}`);
assert('N-U5 drift names the edited file', (edited.json.drift || []).some(d => d.file === 'judge.md' && d.reason === 'bundled copy edited'), JSON.stringify(edited.json.drift));

// canonical changed after bundling -> drift, exit 10
reset(); seedSrc(); vendor();
fs.appendFileSync(path.join(SRC, 'model-routing-spec.md'), '\ncanonical changed\n');
const canon = drift();
assert('CANONICAL drift -> exit 10', canon.code === 10 && (canon.json.drift || []).some(d => d.reason === 'canonical changed since bundling'),
  `code=${canon.code} drift=${JSON.stringify(canon.json.drift)}`);

// ADR 0063 — REAL substrate: vendor the actual skills/shared and assert it bundles cleanly + completely.
// The synthetic cases above prove the drift ALGORITHM; this proves the real ARTIFACT (catches a glob
// regression, an unreadable file, or a drift-check crash on real content).
const REAL_SRC  = path.join(__dirname, '..', 'skills', 'shared');
const REAL_DEST = path.join(os.tmpdir(), `substrate-real-${process.pid}`);
fs.rmSync(REAL_DEST, { recursive: true, force: true });
const rv = spawnSync('node', [VENDOR, `--src=${REAL_SRC}`, `--dest=${REAL_DEST}`, '--version=real', '--now=2026-09-15', '--json'], { encoding: 'utf8' });
assert('REAL bundle exit 0', rv.status === 0, `exit ${rv.status}`);
const diskCount = fs.readdirSync(REAL_SRC).filter(f => f.endsWith('.md')).length;
let rvj = {}; try { rvj = JSON.parse(rv.stdout || '{}'); } catch (_) {}
assert('REAL bundle captured every skills/shared/*.md', rvj.file_count === diskCount, `bundled ${rvj.file_count} vs ${diskCount} on disk`);
const rd = spawnSync('node', [DRIFT, `--src=${REAL_SRC}`, `--dest=${REAL_DEST}`, '--json'], { encoding: 'utf8' });
let rdj = {}; try { rdj = JSON.parse(rd.stdout || '{}'); } catch (_) {}
assert('REAL substrate drift-check clean (exit 0)', rd.status === 0 && rdj.status === 'clean', `code=${rd.status} status=${rdj.status} drift=${JSON.stringify(rdj.drift)}`);
fs.rmSync(REAL_DEST, { recursive: true, force: true });

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
