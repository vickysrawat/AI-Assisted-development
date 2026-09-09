#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs the substrate vendoring SEAM end to end against a throwaway source: vendor
//                      -> drift-check (clean, exit 0); edit the vendored copy -> drift-check (drift,
//                      exit 10); re-vendor then edit the CANONICAL -> drift-check (drift, exit 10).
//                      Also asserts the vendored copies are banner-marked GENERATED.
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

// vendor + banner
const v = vendor();
assert('VENDOR exit 0', v.status === 0, `exit ${v.status}`);
assert('VENDOR banner-marks copies GENERATED',
  fs.readFileSync(path.join(DEST, 'judge.md'), 'utf8').startsWith('<!-- GENERATED — DO NOT EDIT'),
  fs.readFileSync(path.join(DEST, 'judge.md'), 'utf8').slice(0, 40));

// P-U5 — vendored == canonical -> clean, exit 0
const clean = drift();
assert('P-U5 clean drift-check (exit 0)', clean.code === 0 && clean.json.status === 'clean', `code=${clean.code} status=${clean.json.status}`);

// N-U5 — vendored copy edited -> drift, exit 10
fs.appendFileSync(path.join(DEST, 'judge.md'), '\nhand-edited line\n');
const edited = drift();
assert('N-U5 vendored edit -> drift (exit 10)', edited.code === 10 && edited.json.status === 'drift', `code=${edited.code} status=${edited.json.status}`);
assert('N-U5 drift names the edited file', (edited.json.drift || []).some(d => d.file === 'judge.md' && d.reason === 'vendored copy edited'), JSON.stringify(edited.json.drift));

// canonical changed after vendoring -> drift, exit 10
reset(); seedSrc(); vendor();
fs.appendFileSync(path.join(SRC, 'model-routing-spec.md'), '\ncanonical changed\n');
const canon = drift();
assert('CANONICAL drift -> exit 10', canon.code === 10 && (canon.json.drift || []).some(d => d.reason === 'canonical changed since vendoring'),
  `code=${canon.code} drift=${JSON.stringify(canon.json.drift)}`);

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
