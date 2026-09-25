#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Runs scripts/upgrade-checkpoint.cjs and asserts: init creates a well-formed
//                      core+payload envelope; get returns it; set-gate records a stage-gate verdict
//                      and appends phase_history; set-payload merges the baseline tag + hops; and the
//                      MERGE-WRITE property — a field written directly into the checkpoint by another
//                      writer survives a later set-gate (never clobbered). Exit 0 = all pass.
// What it touches:     Writes JSON checkpoint files under a throwaway dir in the OS temp folder
//                      (removed at start + end). Spawns `node scripts/upgrade-checkpoint.cjs`.
// What it does NOT do: No network, no git, no mutation outside the temp dir.
// APIs / commands:     Node stdlib: os.tmpdir, fs, path, child_process.spawnSync('node', ...).
// How to verify:       node tests/upgrade-checkpoint.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CP       = path.join(__dirname, '..', 'scripts', 'upgrade-checkpoint.cjs');
const CLJ      = path.join(__dirname, '..', 'scripts', 'checkpoint-ledger.cjs');
const IV       = path.join(__dirname, '..', 'scripts', 'intake-verify.cjs');
const DIR      = path.join(os.tmpdir(), `upgrade-cp-test-${process.pid}`);
const FILE     = path.join(DIR, '.claude', 'migration', 'cp.json');
const MANIFEST = path.join(DIR, 'manifest.md');
let pass = 0, fail = 0;

function reset() { fs.rmSync(DIR, { recursive: true, force: true }); }
function run(args) {
  const r = spawnSync('node', [CP, ...args, `--file=${FILE}`, '--json'], { encoding: 'utf8' });
  let json = {};
  try { json = JSON.parse(r.stdout || '{}'); } catch (_) { /* leave empty → assertion fails */ }
  return { json, code: r.status };
}
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); }
}

reset();

// init — creates a well-formed envelope
const i = run(['init', '--ado=9000', '--stack=dotnet', '--from=6', '--to=8', '--now=2026-09-08']);
assert('INIT created (exit 0)', i.code === 0 && i.json.status === 'created', `code=${i.code} status=${i.json.status}`);
assert('INIT core fields present', i.json.checkpoint?.schema_version === '1.0' && i.json.checkpoint?.skill === 'upgrade' && i.json.checkpoint?.ado_id === '9000',
  JSON.stringify(i.json.checkpoint));
assert('INIT payload skeleton present', i.json.checkpoint?.payload?.upgrade && Array.isArray(i.json.checkpoint.payload.upgrade.hops),
  JSON.stringify(i.json.checkpoint?.payload));

// init again — idempotent (preserves existing)
assert('INIT idempotent (exists)', run(['init', '--ado=9000', '--now=2026-09-09']).json.status === 'exists', 're-init did not report exists');

// ATOMIC-WRITE — no .tmp residue after successful save (A21)
const tmpFiles = fs.readdirSync(path.dirname(FILE)).filter(f => f.includes('.tmp.'));
assert('ATOMIC-WRITE: no .tmp residue after save', tmpFiles.length === 0, `tmp files found: ${tmpFiles.join(', ')}`);

// set-payload — merges baseline tag + hops
const sp = run(['set-payload', '--ado=9000', '--baseline-tag=pre-upgrade/dotnet-6', '--hops=7,8', '--now=2026-09-08']);
assert('SET-PAYLOAD baseline tag merged', sp.json.payload?.baseline_tag === 'pre-upgrade/dotnet-6', JSON.stringify(sp.json.payload));
assert('SET-PAYLOAD hops merged', JSON.stringify(sp.json.payload?.hops) === JSON.stringify(['7', '8']), JSON.stringify(sp.json.payload?.hops));

// set up intake context so the A1 guard (report=PASS → intake-verify check-gate) can pass.
// The guard reads the SAME ledger FILE (fixed in A1 guard) and checks:
//   (a) stage_gates.intake_context === 'PASS'
//   (b) payload.upgrade.source_context.manifest_path exists and passes re-verify
//   (c) migrationRoots in settings.local.json (A17: single source of truth for roots)
// Create .claude/settings.local.json with migrationRoots — A1 guard derives settings path from FILE.
const SETTINGS_DIR = path.join(DIR, '.claude');
fs.mkdirSync(SETTINGS_DIR, { recursive: true });
fs.writeFileSync(path.join(SETTINGS_DIR, 'settings.local.json'), JSON.stringify({ migrationRoots: [DIR] }, null, 2));
// Extract dotted identifiers from CLAUDE.md using the same regex as intake-verify check 6
// and include them in the manifest so they are "justified" — future-proof against CLAUDE.md changes.
const dotted = new Set();
const claudeMd = path.join(__dirname, '..', 'CLAUDE.md');
if (fs.existsSync(claudeMd)) {
  let m; const re6 = /\b([A-Z][A-Za-z0-9]+(?:\.[A-Z][A-Za-z0-9]+)+)\b/g;
  while ((m = re6.exec(fs.readFileSync(claudeMd, 'utf8')))) dotted.add(m[1]);
}
// Manifest root coverage: migrationRoots=[DIR] → verifier looks for path.basename(DIR) as the segment.
const dirSeg = path.basename(DIR);
fs.writeFileSync(MANIFEST, [
  '# Source Context Manifest — Test',
  '', '## Migration roots',
  '| Root | Purpose | Covered | PROV |',
  '|---|---|---|---|',
  `| ${dirSeg} | Primary source | yes | - |`,
  '',
  '## Stack references (justified tokens from CLAUDE.md)',
  [...dotted].join(' ') || 'none', '',
  '## Module Accounting', '',
  '| Module | Disposition | Citations | Notes |',
  '|---|---|---|---|', '',
  '## Cross-cutting concern scan', '', 'none', '',
].join('\n'));
// Empty graph file — points opVerify at 0 modules so the module-accounting check passes trivially.
// Without this, opVerify defaults to CWD/.claude/graph/graph.json which (in the plugin dev dir)
// is the plugin's own knowledge graph, not a migration source graph.
const EMPTY_GRAPH = path.join(DIR, 'empty-graph.json');
fs.writeFileSync(EMPTY_GRAPH, JSON.stringify({ nodes: [] }, null, 2));
spawnSync('node', [CLJ, 'set-gate', '--ado=9000', `--file=${FILE}`, '--skill=upgrade',
  '--gate=intake_context', '--verdict=PASS'], { encoding: 'utf8' });
spawnSync('node', [CLJ, 'set-payload', '--ado=9000', `--file=${FILE}`, '--skill=upgrade',
  `--payload-json=${JSON.stringify({ source_context: { manifest_path: MANIFEST, graph_path: EMPTY_GRAPH, verified: true } })}`],
  { encoding: 'utf8' });

// set-gate — records verdict + appends phase_history
const sg = run(['set-gate', '--ado=9000', '--gate=report', '--verdict=PASS', '--now=2026-09-08']);
assert('SET-GATE verdict recorded', sg.json.checkpoint?.stage_gates?.report === 'PASS', JSON.stringify(sg.json.checkpoint?.stage_gates));
assert('SET-GATE phase_history appended', (sg.json.checkpoint?.phase_history || []).some(p => p.phase === 'report' && p.verdict === 'PASS'),
  JSON.stringify(sg.json.checkpoint?.phase_history));

// MERGE-WRITE — a foreign field injected by another writer must survive a later set-gate
const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
raw.foreign_writer_field = { rewrite: 'do-not-clobber' };
fs.writeFileSync(FILE, JSON.stringify(raw, null, 2));
run(['set-gate', '--ado=9000', '--gate=verify', '--verdict=PASS', '--now=2026-09-08']);
const after = JSON.parse(fs.readFileSync(FILE, 'utf8'));
assert('MERGE-WRITE preserves unowned field (tolerant reader / skew-safe)',
  after.foreign_writer_field?.rewrite === 'do-not-clobber', JSON.stringify(after.foreign_writer_field));
assert('MERGE-WRITE also kept the new gate', after.stage_gates?.verify === 'PASS' && after.stage_gates?.report === 'PASS',
  JSON.stringify(after.stage_gates));

// TOLERANT READER — a ledger created by ANOTHER skill (no upgrade substructures) must not crash
reset();
fs.mkdirSync(path.dirname(FILE), { recursive: true });
fs.writeFileSync(FILE, JSON.stringify({ schema_version: '1.0', skill: 'rewrite', foreign: { keep: 'me' } }, null, 2));
const tol = run(['set-payload', '--ado=9000', '--baseline-tag=pre-upgrade/x', '--now=2026-09-08']);
assert('TOLERANT set-payload on foreign checkpoint succeeds', tol.code === 0 && tol.json.payload?.baseline_tag === 'pre-upgrade/x',
  `code=${tol.code} payload=${JSON.stringify(tol.json.payload)}`);
const tolAfter = JSON.parse(fs.readFileSync(FILE, 'utf8'));
assert('TOLERANT foreign field preserved', tolAfter.foreign?.keep === 'me', JSON.stringify(tolAfter.foreign));

// get on a missing checkpoint -> absent, exit 7
reset();
const g = run(['get', '--ado=9000']);
assert('GET absent (exit 7)', g.code === 7 && g.json.status === 'absent', `code=${g.code} status=${g.json.status}`);

reset();
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
