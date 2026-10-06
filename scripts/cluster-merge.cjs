#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Manages cluster worktree branch commits and merges for the rewrite skill.
//                      'prepare' subcommand: commits any uncommitted state in each cluster
//                      worktree branch, records branch head SHAs, and writes
//                      .claude/migration/ADO-NNN.pending-approval.json for developer review.
//                      'merge' subcommand: enforces three gates (approval present, SHA match,
//                      clean target branch), writes an idempotency marker before merging, then
//                      records the merge result.
// What it touches:     .claude/migration/ADO-NNN.approvals.json (appends entries via JSON array
//                      read-modify-write — never NDJSON)
//                      .claude/migration/ADO-NNN.pending-approval.json (written by prepare;
//                      deleted by APPROVE CLUSTERS handler in approval-capture.cjs)
//                      Git repository: checkout, add, commit, merge operations via git CLI.
// What it does NOT do: No network calls. Does not modify docs/migrations/ directly.
//                      Does not read active-task.json. Does not delete cluster branches.
// APIs / commands:     Node stdlib: fs, path, child_process.execSync.
//                      Git CLI via execSync: git rev-parse --show-toplevel, git -C <root>
//                      checkout / status / add / commit / merge.
// How to verify:       node tests/cluster-merge.test.cjs -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { normalizeAdo } = require('./ado-normalize.cjs');

// DECISION: How to derive the repo root
// Options considered:
//   A) process.cwd() — rejected: depends on invocation directory; not stable across contexts
//   B) git rev-parse --show-toplevel — chosen: always resolves to the git root regardless of CWD;
//      used for both the git -C argument and fs path construction
const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

/** Returns the .claude/migration/ directory path for this repo. */
function migrationDir() {
  return path.join(repoRoot, '.claude', 'migration');
}

/** Full path to the ADO's approvals JSON array file. */
function approvalsPath(ado) {
  return path.join(migrationDir(), `${ado}.approvals.json`);
}

/** Full path to the ADO's pending-approval file (written by prepare, consumed by APPROVE CLUSTERS). */
function pendingApprovalPath(ado) {
  return path.join(migrationDir(), `${ado}.pending-approval.json`);
}

/**
 * Reads all approval entries for the given ADO.
 * Returns an empty array if the file is absent or cannot be parsed.
 */
function readApprovals(ado) {
  const p = approvalsPath(ado);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (_) { return []; }
}

/**
 * Appends one entry to the ADO's approvals JSON array (read-modify-write).
 * Keeps the file as a valid JSON array, consistent with approval-capture.cjs.
 *
 * DECISION: How to append entries to the approvals file
 * Options considered:
 *   A) fs.appendFileSync with NDJSON lines — rejected: corrupts the file into mixed NDJSON;
 *      approval-capture.cjs and migration-gate.cjs both parse it as a JSON array, so all
 *      readers would fail on the second line onward
 *   B) Read-push-write (JSON array) — chosen: file stays valid JSON at all times; every
 *      consumer can parse it with a single JSON.parse call
 */
function appendEntry(ado, entry) {
  const file = approvalsPath(ado);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let list = [];
  if (fs.existsSync(file)) {
    try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  }
  list.push(entry);
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n');
}

/**
 * Finds the last matching approval entry for the given gate key.
 * Returns null if not found. The approvals array is append-only, so the last entry wins.
 */
function findApproval(entries, key) {
  return [...entries].reverse().find(e => e.gate === key) || null;
}

/**
 * Subcommand: prepare
 * Commits any uncommitted changes in each cluster worktree branch, records branch head SHAs,
 * and writes pending-approval.json so the developer can review the set before replying
 * APPROVE CLUSTERS.
 *
 * @param {string}   ado      — normalised ADO ID (e.g. 'ADO-1234')
 * @param {number[]} clusters — list of cluster numbers to prepare
 */
function prepare(ado, clusters) {
  const pending = { ado, prepared_at: new Date().toISOString(), clusters: [] };

  for (const n of clusters) {
    const branch = `cluster/${ado}-${n}`;

    // Commit any uncommitted state so the SHA is stable before approval
    try {
      execSync(`git -C "${repoRoot}" checkout ${branch}`, { stdio: 'pipe' });
      const status = execSync(`git -C "${repoRoot}" status --porcelain`, { encoding: 'utf8' });
      if (status.trim()) {
        execSync(`git -C "${repoRoot}" add -A`, { stdio: 'inherit' });
        execSync(
          `git -C "${repoRoot}" commit -m "[${ado}] Cluster ${n} — prepare commit"`,
          { stdio: 'inherit' }
        );
      }
    } catch (e) {
      process.stderr.write(`cluster-merge prepare: error on branch ${branch}: ${e.message}\n`);
      process.exit(1);
    }

    const sha = execSync(`git -C "${repoRoot}" rev-parse HEAD`, { encoding: 'utf8' }).trim();
    pending.clusters.push({ cluster: n, branch, sha });
    process.stdout.write(`  cluster ${n}: ${branch} @ ${sha}\n`);
  }

  // Write pending-approval.json (overwrite — prepare is idempotent)
  const dir = migrationDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(pendingApprovalPath(ado), JSON.stringify(pending, null, 2) + '\n');
  process.stdout.write(`pending-approval.json written. Reply: APPROVE CLUSTERS ${ado}\n`);
}

/**
 * Subcommand: merge
 * Four-gate check before merging a cluster worktree branch to the target branch:
 *   Gate 0 (idempotency): cluster_N_commit_started must NOT already be present
 *   Gate 1 (approval):    cluster_N_approved must exist in the approvals file
 *   Gate 2 (SHA match):   approved SHA must match the current branch head SHA
 *   Gate 3 (BAL):         target branch must have no uncommitted changes
 *
 * Writes cluster_N_commit_started BEFORE the git merge (idempotency marker).
 * Writes cluster_N_merged AFTER the git merge (completion record).
 *
 * @param {string} ado          — normalised ADO ID
 * @param {number} clusterN     — cluster number to merge
 * @param {string} targetBranch — target branch to merge into (default: 'main')
 */
function merge(ado, clusterN, targetBranch) {
  const entries = readApprovals(ado);

  // Gate 0: Idempotency check — FIRST, before any git operation.
  // If commit_started is already present, the merge was already initiated (or completed).
  // Re-running the command after an interruption must NOT produce a double-merge.
  const started = findApproval(entries, `cluster_${clusterN}_commit_started`);
  if (started) {
    process.stderr.write(
      `cluster-merge merge: cluster_${clusterN}_commit_started already present — ` +
      `cluster ${clusterN} is already merged or a merge is in progress.\n`
    );
    process.exit(2);
  }

  // Gate 1: cluster_N_approved must exist in the approvals file
  const approval = findApproval(entries, `cluster_${clusterN}_approved`);
  if (!approval) {
    process.stderr.write(
      `cluster-merge merge: cluster_${clusterN}_approved not found in approvals. ` +
      `Reply APPROVE CLUSTERS ${ado} first.\n`
    );
    process.exit(2);
  }

  // Gate 2: SHA match — prevents merging if the branch has advanced since approval
  const branch = `cluster/${ado}-${clusterN}`;
  let currentSha;
  try {
    currentSha = execSync(`git -C "${repoRoot}" rev-parse ${branch}`, { encoding: 'utf8' }).trim();
  } catch (e) {
    process.stderr.write(`cluster-merge merge: cannot resolve branch ${branch}: ${e.message}\n`);
    process.exit(2);
  }

  if (currentSha !== approval.sha) {
    process.stderr.write(
      `cluster-merge merge: SHA mismatch for cluster ${clusterN}. ` +
      `Approved: ${approval.sha}. Current: ${currentSha}. ` +
      `Re-run prepare and get a new APPROVE CLUSTERS.\n`
    );
    process.exit(2);
  }

  // Gate 3: BAL merge gate — target branch must have no uncommitted changes
  // DECISION: BAL gate implementation for Story 3
  // Options considered:
  //   A) Full rewrite-bal.cjs execution — rejected: BAL script requires per-cluster context
  //      not yet available here; full integration deferred to a follow-up story
  //   B) Uncommitted-state check on the target branch — chosen: prevents merging into a dirty
  //      branch; fast and dependency-free; sufficient for v1 safety gate
  const target = targetBranch || 'main';
  execSync(`git -C "${repoRoot}" checkout ${target}`, { stdio: 'pipe' });
  const targetStatus = execSync(`git -C "${repoRoot}" status --porcelain`, { encoding: 'utf8' });
  if (targetStatus.trim()) {
    process.stderr.write(
      `cluster-merge merge: target branch "${target}" has uncommitted changes. ` +
      `Commit or stash before merging cluster ${clusterN}.\n`
    );
    process.exit(2);
  }

  // Write the idempotency marker BEFORE git merge.
  // If the process crashes after this point, a re-run hits Gate 0 and exits 2 safely.
  appendEntry(ado, {
    gate: `cluster_${clusterN}_commit_started`,
    at: new Date().toISOString(),
    sha: currentSha,
  });

  // Execute the merge
  execSync(
    `git -C "${repoRoot}" merge --no-ff ${branch} -m "[${ado}] Merge cluster ${clusterN}"`,
    { stdio: 'inherit' }
  );

  // Record the completed merge result
  const mergeSha = execSync(`git -C "${repoRoot}" rev-parse HEAD`, { encoding: 'utf8' }).trim();
  appendEntry(ado, {
    gate: `cluster_${clusterN}_merged`,
    at: new Date().toISOString(),
    merge_sha: mergeSha,
    source_sha: currentSha,
  });

  process.stdout.write(`cluster ${clusterN} merged. SHA: ${mergeSha}\n`);
}

// --- CLI dispatch ---
// Parse --key=value arguments into a plain object
const [,, subcommand, ...rest] = process.argv;
const args = Object.fromEntries(rest.map(a => a.replace(/^--/, '').split('=')));

const ado = normalizeAdo(args.ado);
if (!ado) { process.stderr.write('--ado is required\n'); process.exit(1); }

if (subcommand === 'prepare') {
  const clusters = (args.clusters || '').split(',').map(Number).filter(Boolean);
  if (!clusters.length) {
    process.stderr.write('--clusters is required (comma-separated list of cluster numbers)\n');
    process.exit(1);
  }
  prepare(ado, clusters);
} else if (subcommand === 'merge') {
  const clusterN = Number(args.cluster);
  if (!clusterN) {
    process.stderr.write('--cluster is required (cluster number)\n');
    process.exit(1);
  }
  merge(ado, clusterN, args['target-branch']);
} else {
  process.stderr.write('Unknown subcommand. Use: prepare | merge\n');
  process.exit(1);
}
