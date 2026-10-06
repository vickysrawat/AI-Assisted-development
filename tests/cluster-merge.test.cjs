#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests cluster-merge.cjs (merge gate checks), approval-capture.cjs
//                      (APPROVE CLUSTERS + SKIP CLUSTER handlers), and migration-gate.cjs
//                      row 3 (cluster worktree write gate).
//                      Covers: N-U1 (no approval → exit 2), N-U2 (SHA mismatch → exit 2),
//                      N-U3 (double-merge idempotency → exit 2), P-U3 (APPROVE CLUSTERS happy),
//                      N-U4 (APPROVE CLUSTERS missing pending file → refusal), P-U4 (SKIP CLUSTER),
//                      N-U5 (row 3 blocks write before approval), row 3 allow cases.
// What it touches:     Creates and destroys temp directories under os.tmpdir(). For
//                      cluster-merge.cjs tests, initialises isolated temp git repositories.
//                      No changes to the repo; no writes outside temp directories.
// What it does NOT do: No network calls. Does not push to any remote. Does not modify repo files.
// APIs / commands:     Node stdlib: fs, os, path, child_process.spawnSync + execSync.
//                      Invokes: node scripts/cluster-merge.cjs (via spawnSync)
//                               node _project-deploy/hooks/approval-capture.cjs (via spawnSync)
//                               node _project-deploy/hooks/migration-gate.cjs (via spawnSync)
//                      Git CLI: git init / config / add / commit / checkout (via execSync, cwd option)
// How to verify:       node tests/cluster-merge.test.cjs -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

const PLUGIN_DIR    = path.join(__dirname, '..');
const CLUSTER_MERGE = path.join(PLUGIN_DIR, 'scripts', 'cluster-merge.cjs');
const AC_HOOK       = path.join(PLUGIN_DIR, '_project-deploy', 'hooks', 'approval-capture.cjs');
const GATE_HOOK     = path.join(PLUGIN_DIR, '_project-deploy', 'hooks', 'migration-gate.cjs');

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
 * Invokes the approval-capture hook with the given prompt string as JSON stdin.
 * cwd sets the working directory so file lookups resolve to the right fixtures.
 * Returns { code, additionalContext }.
 */
function runHook(prompt, cwd) {
  const input = JSON.stringify({ prompt });
  const result = spawnSync('node', [AC_HOOK], {
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
  return { code: result.status, additionalContext };
}

/**
 * Invokes the migration-gate hook with a synthetic tool-invocation JSON payload.
 * cwd sets the working directory so relative file lookups resolve to the right fixtures.
 */
function runGate(toolName, toolInput, cwd) {
  const input = JSON.stringify({ tool_name: toolName, tool_input: toolInput });
  const result = spawnSync('node', [GATE_HOOK], {
    input,
    encoding: 'utf8',
    cwd: cwd || process.cwd(),
  });
  return { code: result.status, stderr: result.stderr || '' };
}

/**
 * Creates an isolated temp directory for approval-capture and migration-gate tests.
 * No git repo needed — hooks use relative fs paths only.
 */
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cm-test-'));
}

/**
 * Creates an isolated temp git repository for cluster-merge.cjs tests.
 * cluster-merge.cjs runs 'git rev-parse --show-toplevel' at module load time,
 * so it must be invoked from within a valid git repo.
 */
function initTempGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-git-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"',            { cwd: dir, stdio: 'pipe' });
  // An initial commit is required so the repo has a valid HEAD and a default branch
  fs.writeFileSync(path.join(dir, 'init.txt'), 'init\n');
  execSync('git add -A',               { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "init"',     { cwd: dir, stdio: 'pipe' });
  return dir;
}

/** Writes a JSON array of approval entries to .claude/migration/ADO-NNN.approvals.json. */
function writeApprovals(gitDir, ado, entries) {
  const cpDir = path.join(gitDir, '.claude', 'migration');
  fs.mkdirSync(cpDir, { recursive: true });
  fs.writeFileSync(
    path.join(cpDir, `${ado}.approvals.json`),
    JSON.stringify(entries, null, 2) + '\n'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
process.stdout.write('cluster-merge.cjs — merge gate checks\n');

// N-U1: No cluster_1_approved in approvals → exits 2
{
  const tmp = initTempGitRepo();
  writeApprovals(tmp, 'ADO-0001', []);
  const r = spawnSync('node', [CLUSTER_MERGE, 'merge', '--ado=ADO-0001', '--cluster=1'], {
    encoding: 'utf8', cwd: tmp,
  });
  assert('N-U1 merge: no approval → exit 2', r.status === 2);
  assert('N-U1 stderr mentions cluster_1_approved', r.stderr.includes('cluster_1_approved'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// N-U2: cluster_1_approved present but SHA differs → exits 2
{
  const tmp = initTempGitRepo();
  const ado = 'ADO-0002';
  const branch = `cluster/${ado}-1`;
  execSync(`git checkout -b ${branch}`, { cwd: tmp, stdio: 'pipe' });
  fs.writeFileSync(path.join(tmp, 'cluster1.txt'), 'cluster1\n');
  execSync('git add -A',                          { cwd: tmp, stdio: 'pipe' });
  execSync('git commit -m "cluster1 work"',       { cwd: tmp, stdio: 'pipe' });
  // Write approvals with a deliberately WRONG SHA so mismatch is guaranteed
  writeApprovals(tmp, ado, [
    { gate: 'cluster_1_approved', at: '2026-10-02T12:00:00.000Z', sha: 'deadbeef0000000000000000000000000000000000', branch },
  ]);
  const r = spawnSync('node', [CLUSTER_MERGE, 'merge', `--ado=${ado}`, '--cluster=1'], {
    encoding: 'utf8', cwd: tmp,
  });
  assert('N-U2 SHA mismatch → exit 2', r.status === 2);
  assert('N-U2 stderr mentions mismatch', r.stderr.toLowerCase().includes('mismatch'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// N-U3: cluster_1_commit_started already in approvals → exits 2 (idempotency gate)
{
  const tmp = initTempGitRepo();
  writeApprovals(tmp, 'ADO-0003', [
    { gate: 'cluster_1_commit_started', at: '2026-10-02T12:00:00.000Z', sha: 'abc123' },
  ]);
  const r = spawnSync('node', [CLUSTER_MERGE, 'merge', '--ado=ADO-0003', '--cluster=1'], {
    encoding: 'utf8', cwd: tmp,
  });
  assert('N-U3 commit_started → exit 2 (idempotency)', r.status === 2);
  assert('N-U3 stderr mentions already merged / in progress',
    r.stderr.includes('already merged') || r.stderr.includes('in progress'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ─────────────────────────────────────────────────────────────────────────────
process.stdout.write('\napproval-capture.cjs — APPROVE CLUSTERS / SKIP CLUSTER\n');

// P-U3: APPROVE CLUSTERS — valid pending-approval.json → per-cluster approvals recorded
{
  const tmp = tmpDir();
  const ado = 'ADO-5001';
  const cpDir = path.join(tmp, '.claude', 'migration');
  fs.mkdirSync(cpDir, { recursive: true });
  const pending = {
    ado,
    prepared_at: '2026-10-02T12:00:00.000Z',
    clusters: [
      { cluster: 1, branch: `cluster/${ado}-1`, sha: 'abc123def456abc1' },
      { cluster: 2, branch: `cluster/${ado}-2`, sha: 'xyz789abc012xyz7' },
    ],
  };
  fs.writeFileSync(path.join(cpDir, `${ado}.pending-approval.json`), JSON.stringify(pending, null, 2));

  const r = runHook(`APPROVE CLUSTERS ${ado}`, tmp);
  assert('P-U3 exit 0', r.code === 0);
  assert('P-U3 additionalContext confirms approval', r.additionalContext && r.additionalContext.includes('recorded'));

  const approvalsFile = path.join(cpDir, `${ado}.approvals.json`);
  assert('P-U3 approvals.json created', fs.existsSync(approvalsFile));
  if (fs.existsSync(approvalsFile)) {
    const list = JSON.parse(fs.readFileSync(approvalsFile, 'utf8'));
    assert('P-U3 cluster_1_approved recorded', list.some(e => e.gate === 'cluster_1_approved'));
    assert('P-U3 cluster_2_approved recorded', list.some(e => e.gate === 'cluster_2_approved'));
    assert('P-U3 sha stored in cluster_1_approved',
      list.some(e => e.gate === 'cluster_1_approved' && e.sha === 'abc123def456abc1'));
  }
  assert('P-U3 pending-approval.json deleted (prevent replay)',
    !fs.existsSync(path.join(cpDir, `${ado}.pending-approval.json`)));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// N-U4: APPROVE CLUSTERS — pending-approval.json absent → refusal, no approvals written
{
  const tmp = tmpDir();
  const r = runHook('APPROVE CLUSTERS ADO-9001', tmp);
  assert('N-U4 exit 0 (never blocks prompt)', r.code === 0);
  assert('N-U4 additionalContext mentions prepare or not found',
    r.additionalContext && (r.additionalContext.includes('prepare') || r.additionalContext.includes('not found')));
  assert('N-U4 no approvals.json created',
    !fs.existsSync(path.join(tmp, '.claude', 'migration', 'ADO-9001.approvals.json')));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// P-U4: SKIP CLUSTER ADO-5002 1 → records cluster_1_skipped
{
  const tmp = tmpDir();
  const ado = 'ADO-5002';
  const r = runHook(`SKIP CLUSTER ${ado} 1`, tmp);
  assert('P-U4 exit 0', r.code === 0);
  assert('P-U4 additionalContext confirms skip',
    r.additionalContext && r.additionalContext.includes('cluster_1_skipped'));

  const cpDir = path.join(tmp, '.claude', 'migration');
  const approvalsFile = path.join(cpDir, `${ado}.approvals.json`);
  assert('P-U4 approvals.json created', fs.existsSync(approvalsFile));
  if (fs.existsSync(approvalsFile)) {
    const list = JSON.parse(fs.readFileSync(approvalsFile, 'utf8'));
    assert('P-U4 cluster_1_skipped recorded', list.some(e => e.gate === 'cluster_1_skipped'));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ─────────────────────────────────────────────────────────────────────────────
process.stdout.write('\nmigration-gate.cjs — row 3: cluster worktree write gate\n');

// N-U5: Write to worktrees/cluster-1/ADO-5030/... before cluster_1_approved → exit 2
{
  const tmp = tmpDir();
  const ado = 'ADO-5030';
  // No approvals file — cluster_1_approved not present
  const r = runGate('Write', { file_path: `worktrees/cluster-1/${ado}/foo.cs` }, tmp);
  assert('N-U5 row 3: no approval → exit 2', r.code === 2);
  assert('N-U5 stderr mentions APPROVE CLUSTERS', r.stderr.includes('APPROVE CLUSTERS'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Row 3 allow: Write to worktrees/cluster-1/... with cluster_1_approved → exit 0
{
  const tmp = tmpDir();
  const ado = 'ADO-5031';
  const cpDir = path.join(tmp, '.claude', 'migration');
  fs.mkdirSync(cpDir, { recursive: true });
  fs.writeFileSync(path.join(cpDir, `${ado}.approvals.json`), JSON.stringify([
    { gate: 'cluster_1_approved', at: '2026-10-02T12:00:00.000Z', sha: 'abc123', branch: `cluster/${ado}-1` },
  ], null, 2));
  const r = runGate('Write', { file_path: `worktrees/cluster-1/${ado}/foo.cs` }, tmp);
  assert('Row 3 allow: cluster_1_approved → exit 0', r.code === 0);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Row 3 allow: Write to worktrees/cluster-2/... with cluster_2_skipped → exit 0
{
  const tmp = tmpDir();
  const ado = 'ADO-5032';
  const cpDir = path.join(tmp, '.claude', 'migration');
  fs.mkdirSync(cpDir, { recursive: true });
  fs.writeFileSync(path.join(cpDir, `${ado}.approvals.json`), JSON.stringify([
    { gate: 'cluster_2_skipped', at: '2026-10-02T12:00:00.000Z' },
  ], null, 2));
  const r = runGate('Write', { file_path: `worktrees/cluster-2/${ado}/foo.cs` }, tmp);
  assert('Row 3 allow: cluster_2_skipped → exit 0', r.code === 0);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Row 3: Edit also gated — not just Write
{
  const tmp = tmpDir();
  const ado = 'ADO-5033';
  // No approvals → Edit should also be blocked
  const r = runGate('Edit', { file_path: `worktrees/cluster-3/${ado}/foo.cs` }, tmp);
  assert('Row 3 Edit gated: no approval → exit 2', r.code === 2);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Row 3: path without ADO → not gated (cannot identify owner)
{
  const r = runGate('Write', { file_path: 'worktrees/cluster-1/target-app/foo.cs' });
  assert('Row 3: no ADO in path → exit 0 (no gate)', r.code === 0);
}

// Summary
const total = passed + failed;
process.stdout.write(`\n${total} tests: ${passed} passed · ${failed} failed\n`);
if (failed > 0) process.exit(1);
