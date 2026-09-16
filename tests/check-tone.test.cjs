#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/check-tone.cjs against temp fixtures and asserts the tone-scan
//                      contract: a dirty doc → risk "high" with tier1/weasel/negation/tailing
//                      findings carrying line numbers; a 3-bullet doc → bold_bullet_list; em-dash and
//                      transition-heavy docs → their density findings; a plain doc → risk "clean" with
//                      zero findings; and no-path / missing-path invocations exit non-zero.
// What it touches:     Creates a throwaway fixture tree under os.tmpdir(); spawns node against it and
//                      reads the --json report it writes there. Never touches the repo working tree.
// What it does NOT do: No network, no git, no plugin state, no npm deps.
// APIs / commands:     Node fs, os, path; child_process.spawnSync.
// How to verify:       node tests/check-tone.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'check-tone.cjs');
let pass = 0, fail = 0;
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${detail || ''}`); }
}

// --- build a fixture root -------------------------------------------------------
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'check-tone-test-'));
process.on('exit', () => { try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (_) {} });
const W = (rel, body) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
};

// A document dense with strong-signal tells: stock vocabulary, phantom attribution,
// the not-just-X-it's-Y negation, and a dangling "-ing" significance clause.
W('dirty.md', [
  '# Overview',
  '',
  'Let us delve into the architecture and leverage a seamless, robust pipeline.',
  'Experts agree this is the right call, and studies show adoption is rising.',
  "This is not just a database, it's a platform for everything the team builds.",
  'The standard saw broad adoption, highlighting the need for interoperability.',
  '',
].join('\n'));

// Three consecutive bold-lead-in bullets — the ChatGPT list signature.
W('bold.md', [
  'Notes:',
  '',
  '- **Speed**: the pipeline runs fast.',
  '- **Scale**: it handles many records.',
  '- **Safety**: it validates each row.',
  '',
].join('\n'));

// Em-dash overuse in a short doc (crosses EM_DASH_DENSITY_THRESHOLD).
W('emdash.md', 'The plan -- as written -- moves data from A to B and back again.\n');

// Transition-word pile-up in a short doc (crosses TRANSITION_DENSITY_THRESHOLD).
W('transitions.md', [
  'However, the system works well.',
  'Moreover, it scales nicely.',
  'Furthermore, it runs quickly.',
  'Additionally, it stays cheap.',
  '',
].join('\n'));

// A plain, specific, varied-rhythm doc that trips none of the checks.
W('clean.md', [
  'The order service reads records from the queue and writes them to the ledger.',
  'Each batch runs on a fixed schedule.',
  'When a record fails validation, the worker logs it and moves on.',
  'The team reviews the log every morning.',
  '',
].join('\n'));

let jsonSeq = 0;
function scan(relFiles, extra = []) {
  const out = path.join(ROOT, `report-${jsonSeq++}.json`);
  const args = [SCRIPT, ...relFiles.map((f) => path.join(ROOT, f)), '--json', out, ...extra];
  const r = spawnSync('node', args, { encoding: 'utf8' });
  let report = {};
  try { report = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (_) {}
  const result = Object.values(report)[0] || {};
  return { code: r.status, report, result, stdout: r.stdout, stderr: r.stderr };
}
const tiersOf = (res) => new Set((res.findings || []).map((f) => f.tier));

// --- dirty.md: strong-signal patterns, risk "high" ------------------------------
{
  const { result } = scan(['dirty.md']);
  const t = tiersOf(result);
  assert('dirty.md → risk high', result.risk === 'high', `got ${result.risk}`);
  assert('dirty.md flags tier1 vocabulary', t.has('tier1'), [...t].join(','));
  assert('dirty.md flags weasel attribution', t.has('weasel'), [...t].join(','));
  assert('dirty.md flags negation construction', t.has('negation_construction'), [...t].join(','));
  assert('dirty.md flags tailing "-ing" clause', t.has('tailing_clause'), [...t].join(','));
  const located = (result.findings || []).filter((f) => f.tier === 'tier1' || f.tier === 'weasel');
  assert('located findings carry integer line numbers',
    located.length > 0 && located.every((f) => Number.isInteger(f.line) && f.line >= 1),
    JSON.stringify(located.map((f) => f.line)));
}

// --- bold.md: 3 consecutive bold-lead-in bullets --------------------------------
{
  const { result } = scan(['bold.md']);
  assert('bold.md → bold_bullet_list', tiersOf(result).has('bold_bullet_list'),
    [...tiersOf(result)].join(','));
}

// --- emdash.md: em-dash density -------------------------------------------------
{
  const { result } = scan(['emdash.md']);
  assert('emdash.md → em_dash_density', tiersOf(result).has('em_dash_density'),
    [...tiersOf(result)].join(','));
}

// --- transitions.md: transition density -----------------------------------------
{
  const { result } = scan(['transitions.md']);
  assert('transitions.md → transition_density', tiersOf(result).has('transition_density'),
    [...tiersOf(result)].join(','));
}

// --- clean.md: nothing flagged --------------------------------------------------
{
  const { result } = scan(['clean.md']);
  assert('clean.md → risk clean', result.risk === 'clean', `got ${result.risk}`);
  assert('clean.md → zero findings', (result.findings || []).length === 0,
    JSON.stringify(result.findings));
}

// --- exit contract: no path → non-zero ------------------------------------------
{
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
  assert('no path → non-zero exit', r.status !== 0, `exit ${r.status}`);
}

// --- exit contract: missing path → non-zero -------------------------------------
{
  const r = spawnSync('node', [SCRIPT, path.join(ROOT, 'does-not-exist.md')], { encoding: 'utf8' });
  assert('missing path → non-zero exit', r.status !== 0, `exit ${r.status}`);
}

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
