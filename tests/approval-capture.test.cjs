#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests _project-deploy/hooks/approval-capture.cjs by piping JSON payloads
//                      to the hook via stdin and asserting exit codes and additionalContext output.
//                      Covers: APPROVE OPTIONS (strict), PROCEED (lenient), APPROVE DESIGN,
//                      and all negative cases (missing files, UNVERIFIED rows, unacknowledged
//                      PARTIAL rows, plain APPROVE ADO pass-through).
// What it touches:     Creates and destroys temp directories under os.tmpdir() for each test.
//                      No changes to the repo. Reads the hook script from its source path.
// What it does NOT do: No network calls. No git operations. Does not write to .claude/
//                      in the repo — all fixture files go into isolated temp directories.
// APIs / commands:     Node stdlib: fs, os, path, child_process.spawnSync.
//                      Invokes: node _project-deploy/hooks/approval-capture.cjs (via spawnSync)
// How to verify:       node tests/approval-capture.test.cjs -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// Absolute path to the hook under test
const HOOK = path.join(__dirname, '..', '_project-deploy', 'hooks', 'approval-capture.cjs');

let passed = 0;
let failed = 0;

function assert(name, condition, extra) {
  if (condition) {
    process.stdout.write(`  ✓ ${name}\n`);
    passed++;
  } else {
    process.stdout.write(`  ✗ ${name}${extra ? ': ' + extra : ''}\n`);
    failed++;
  }
}

/**
 * Invokes the approval-capture hook with the given prompt string as stdin JSON.
 * cwd sets the working directory so file lookups resolve to the right fixtures.
 * Returns { code, additionalContext, noOutput }.
 */
function runHook(prompt, cwd) {
  const input = JSON.stringify({ prompt });
  const result = spawnSync('node', [HOOK], {
    input,
    encoding: 'utf8',
    cwd: cwd || process.cwd(),
  });

  let additionalContext = null;
  if (result.stdout && result.stdout.trim()) {
    try {
      const parsed = JSON.parse(result.stdout.trim());
      additionalContext = parsed.hookSpecificOutput && parsed.hookSpecificOutput.additionalContext;
    } catch (_) {}
  }

  return {
    code: result.status,
    additionalContext,
    noOutput: !result.stdout || !result.stdout.trim(),
  };
}

/** Creates an isolated temp directory for a single test case. */
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ac-test-'));
}

/** Creates a valid set of all 7 design documents in a migration directory. */
function writeAllDesignDocs(migDir) {
  const docs = [
    'target-component-architecture.md',
    'target-data-architecture.md',
    'target-security-architecture.md',
    'target-integration-architecture.md',
    'target-infrastructure-architecture.md',
    'target-deployment-architecture.md',
    'migration-feasibility.md',
  ];
  for (const doc of docs) fs.writeFileSync(path.join(migDir, doc), `# ${doc}\n`);
}

/** Writes a minimal checkpoint JSON with the given payload.rewrite fields. */
function writeCheckpoint(cpDir, ado, rewritePayload) {
  fs.mkdirSync(cpDir, { recursive: true });
  fs.writeFileSync(path.join(cpDir, `${ado}.checkpoint.json`), JSON.stringify({
    schema_version: '1.0', skill: 'rewrite', ado_id: ado,
    created_at: '2026-10-02', updated_at: '2026-10-02',
    stage_gates: {}, phase_history: [], decision_log: [], judge_verdicts: [],
    payload: { rewrite: rewritePayload },
  }, null, 2) + '\n');
}

process.stdout.write('approval-capture.cjs\n');

// ── P-U1: APPROVE OPTIONS — happy path (options.md exists, no PARTIAL rows) ───────────────────
{
  const tmp = tmpDir();
  const ado = 'ADO-1234';
  const migDir = path.join(tmp, 'docs', 'migrations', ado);
  fs.mkdirSync(migDir, { recursive: true });
  // Options doc exists; integration inventory has only VERIFIED rows — no PARTIAL
  fs.writeFileSync(path.join(migDir, `${ado}-options.md`), '# Options\n');
  fs.writeFileSync(path.join(migDir, 'integration-inventory.md'),
    '| Service | Status |\n|---|---|\n| API | VERIFIED |\n');

  const r = runHook(`APPROVE OPTIONS ${ado} B`, tmp);
  assert('P-U1 exit 0', r.code === 0);
  assert('P-U1 additionalContext confirms options_approved', r.additionalContext && r.additionalContext.includes('options_approved'));

  const approvalsFile = path.join(tmp, '.claude', 'migration', `${ado}.approvals.json`);
  assert('P-U1 approvals.json created', fs.existsSync(approvalsFile));
  if (fs.existsSync(approvalsFile)) {
    const list = JSON.parse(fs.readFileSync(approvalsFile, 'utf8'));
    assert('P-U1 options_approved entry with option B', list.some(a => a.type === 'options_approved' && a.option === 'B'));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── P-U2: PROCEED — with PARTIAL row, acknowledges it ─────────────────────────────────────────
{
  const tmp = tmpDir();
  const ado = 'ADO-1235';
  const migDir = path.join(tmp, 'docs', 'migrations', ado);
  fs.mkdirSync(migDir, { recursive: true });
  fs.writeFileSync(path.join(migDir, `${ado}-options.md`), '# Options\n');
  // Inventory has a PARTIAL row — APPROVE OPTIONS would refuse, PROCEED should accept
  fs.writeFileSync(path.join(migDir, 'integration-inventory.md'),
    '| Service | Status |\n|---|---|\n| PaymentGateway | PARTIAL |\n');

  const r = runHook(`PROCEED ${ado} A`, tmp);
  assert('P-U2 exit 0', r.code === 0);

  const approvalsFile = path.join(tmp, '.claude', 'migration', `${ado}.approvals.json`);
  assert('P-U2 approvals.json created', fs.existsSync(approvalsFile));
  if (fs.existsSync(approvalsFile)) {
    const list = JSON.parse(fs.readFileSync(approvalsFile, 'utf8'));
    assert('P-U2 options_approved recorded', list.some(a => a.type === 'options_approved' && a.option === 'A'));
    assert('P-U2 partial_acknowledged recorded', list.some(a => a.type === 'partial_acknowledged' && Array.isArray(a.rows) && a.rows.length > 0));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── P-U3: APPROVE DESIGN — all prerequisites met ──────────────────────────────────────────────
{
  const tmp = tmpDir();
  const ado = 'ADO-1236';
  const migDir = path.join(tmp, 'docs', 'migrations', ado);
  fs.mkdirSync(migDir, { recursive: true });
  writeAllDesignDocs(migDir);
  // No integration inventory → zero PARTIAL/UNVERIFIED rows → APPROVE DESIGN should pass
  const cpDir = path.join(tmp, '.claude', 'migration');
  writeCheckpoint(cpDir, ado, { target_root: '/tmp/target-app' });

  const r = runHook(`APPROVE DESIGN ${ado}`, tmp);
  assert('P-U3 exit 0', r.code === 0);
  assert('P-U3 additionalContext confirms design_approved', r.additionalContext && r.additionalContext.includes('design_approved'));

  const approvalsFile = path.join(cpDir, `${ado}.approvals.json`);
  assert('P-U3 approvals.json created', fs.existsSync(approvalsFile));
  if (fs.existsSync(approvalsFile)) {
    const list = JSON.parse(fs.readFileSync(approvalsFile, 'utf8'));
    assert('P-U3 design_approved entry recorded', list.some(a => a.type === 'design_approved'));
    assert('P-U3 target_root stored in approval', list.some(a => a.type === 'design_approved' && a.target_root === '/tmp/target-app'));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── N-U1: APPROVE OPTIONS — options.md absent → refusal, exit 0, no approval written ──────────
{
  const tmp = tmpDir();
  const r = runHook('APPROVE OPTIONS ADO-9001 A', tmp);
  assert('N-U1 exit 0 (never blocks prompt)', r.code === 0);
  assert('N-U1 additionalContext contains refusal reason', r.additionalContext && r.additionalContext.includes('not found'));
  assert('N-U1 no approvals.json created', !fs.existsSync(path.join(tmp, '.claude', 'migration', 'ADO-9001.approvals.json')));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── N-U2: APPROVE DESIGN — UNVERIFIED integration row present ─────────────────────────────────
{
  const tmp = tmpDir();
  const ado = 'ADO-2001';
  const migDir = path.join(tmp, 'docs', 'migrations', ado);
  fs.mkdirSync(migDir, { recursive: true });
  writeAllDesignDocs(migDir);
  fs.writeFileSync(path.join(migDir, 'integration-inventory.md'), '| LegacyService | UNVERIFIED |\n');
  const cpDir = path.join(tmp, '.claude', 'migration');
  writeCheckpoint(cpDir, ado, { target_root: '/tmp/target' });

  const r = runHook(`APPROVE DESIGN ${ado}`, tmp);
  assert('N-U2 exit 0 (never blocks prompt)', r.code === 0);
  assert('N-U2 additionalContext lists UNVERIFIED rows', r.additionalContext && r.additionalContext.includes('UNVERIFIED'));
  assert('N-U2 no approvals.json created', !fs.existsSync(path.join(cpDir, `${ado}.approvals.json`)));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── N-U3: APPROVE DESIGN — PARTIAL row present but never acknowledged via PROCEED ─────────────
{
  const tmp = tmpDir();
  const ado = 'ADO-2002';
  const migDir = path.join(tmp, 'docs', 'migrations', ado);
  fs.mkdirSync(migDir, { recursive: true });
  writeAllDesignDocs(migDir);
  fs.writeFileSync(path.join(migDir, 'integration-inventory.md'), '| PaymentService | PARTIAL |\n');
  const cpDir = path.join(tmp, '.claude', 'migration');
  writeCheckpoint(cpDir, ado, { target_root: '/tmp/target' });
  // No prior PROCEED → no partial_acknowledged entries in approvals

  const r = runHook(`APPROVE DESIGN ${ado}`, tmp);
  assert('N-U3 exit 0 (never blocks prompt)', r.code === 0);
  assert('N-U3 additionalContext mentions PARTIAL', r.additionalContext && r.additionalContext.includes('PARTIAL'));
  assert('N-U3 no design_approved written', !fs.existsSync(path.join(cpDir, `${ado}.approvals.json`)));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── N-U4: plain APPROVE ADO-NNN (no qualifier) → pass-through, no approval recorded ──────────
{
  const tmp = tmpDir();
  const r = runHook('APPROVE ADO-1234', tmp);
  assert('N-U4 exit 0 (pass-through to icea-approve)', r.code === 0);
  // No additionalContext expected — hook does not intercept plain APPROVE
  assert('N-U4 no additionalContext', r.additionalContext === null);
  assert('N-U4 no approval recorded', !fs.existsSync(path.join(tmp, '.claude', 'migration', 'ADO-1234.approvals.json')));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── NF: non-JSON stdin → exit 0 (pass-through, not a hook invocation) ─────────────────────────
{
  const tmp = tmpDir();
  const result = spawnSync('node', [HOOK], { input: 'not valid json', encoding: 'utf8', cwd: tmp });
  assert('NF non-JSON stdin → exit 0 (pass-through)', result.status === 0);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── AC-F9: APPROVE OPTIONS with PARTIAL row → refused, instructs developer to use PROCEED ──────
{
  const tmp = tmpDir();
  const ado = 'ADO-3001';
  const migDir = path.join(tmp, 'docs', 'migrations', ado);
  fs.mkdirSync(migDir, { recursive: true });
  fs.writeFileSync(path.join(migDir, `${ado}-options.md`), '# Options\n');
  fs.writeFileSync(path.join(migDir, 'integration-inventory.md'), '| LegacyWorker | PARTIAL |\n');

  const r = runHook(`APPROVE OPTIONS ${ado} B`, tmp);
  assert('AC-F9 APPROVE OPTIONS with PARTIAL → exit 0', r.code === 0);
  assert('AC-F9 additionalContext instructs PROCEED', r.additionalContext && r.additionalContext.includes('PROCEED'));
  assert('AC-F9 no approval recorded', !fs.existsSync(path.join(tmp, '.claude', 'migration', `${ado}.approvals.json`)));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── APPROVE DESIGN — missing design docs → named list in refusal ───────────────────────────────
{
  const tmp = tmpDir();
  const ado = 'ADO-3002';
  const migDir = path.join(tmp, 'docs', 'migrations', ado);
  fs.mkdirSync(migDir, { recursive: true });
  // Only write 5 of 7 docs — 2 are missing
  const partialDocs = [
    'target-component-architecture.md',
    'target-data-architecture.md',
    'target-security-architecture.md',
    'target-integration-architecture.md',
    'target-infrastructure-architecture.md',
  ];
  for (const doc of partialDocs) fs.writeFileSync(path.join(migDir, doc), `# ${doc}\n`);
  const cpDir = path.join(tmp, '.claude', 'migration');
  writeCheckpoint(cpDir, ado, { target_root: '/tmp/target' });

  const r = runHook(`APPROVE DESIGN ${ado}`, tmp);
  assert('missing docs → exit 0', r.code === 0);
  assert('missing docs → additionalContext names docs', r.additionalContext && r.additionalContext.includes('missing'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── APPROVE DESIGN — target_root not set → refusal ────────────────────────────────────────────
{
  const tmp = tmpDir();
  const ado = 'ADO-3003';
  const migDir = path.join(tmp, 'docs', 'migrations', ado);
  fs.mkdirSync(migDir, { recursive: true });
  writeAllDesignDocs(migDir);
  const cpDir = path.join(tmp, '.claude', 'migration');
  writeCheckpoint(cpDir, ado, {}); // no target_root in payload

  const r = runHook(`APPROVE DESIGN ${ado}`, tmp);
  assert('no target_root → exit 0', r.code === 0);
  assert('no target_root → additionalContext explains cause', r.additionalContext && r.additionalContext.includes('target_root'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Summary
const total = passed + failed;
process.stdout.write(`\n${total} tests: ${passed} passed · ${failed} failed\n`);
if (failed > 0) process.exit(1);
