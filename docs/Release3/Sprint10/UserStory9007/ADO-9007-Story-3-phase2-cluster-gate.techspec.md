# Tech Spec — Phase 2: Cluster Write Gate
ADO #9007 · Story 3 of 4 · Release 3 · Sprint 10
Status: DRAFT

> Part of Epic: ADO-9007 Hook-Enforced Migration Gates
> See epic tech spec: temp/ADO-9007-tech.md

---

## Overview

Story 3 implements the cluster write gate — the mechanism that prevents the model from merging cluster worktree branches to main until the developer has explicitly reviewed and approved the cluster set with matching branch-head SHAs. Three components ship together: (1) `scripts/cluster-merge.cjs` with `prepare` and `merge` subcommands; (2) `APPROVE CLUSTERS` and `SKIP CLUSTER` handlers added to `approval-capture.cjs`; (3) `migration-gate.cjs` row 3 — gating Write/Edit to cluster worktree paths (the implementation path for this row depends on D-1 spike result from Story 1; if PreToolUse fires in subagents the gate is enforcement-at-write-time; if not, enforcement is merge-time only via `cluster-merge.cjs`). This story does not modify SKILL.md — SKILL.md alignment with the hook system is Story 4 scope.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F3 | Model cannot merge cluster branch until developer approves cluster set + SHA match | `scripts/cluster-merge.cjs`, `_project-deploy/hooks/approval-capture.cjs`, `_project-deploy/hooks/migration-gate.cjs` | Covered |
| AC-F8 | `cluster-merge.cjs merge` checks `cluster_N_approved` + SHA match + BAL gate before merging | `scripts/cluster-merge.cjs` | Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `scripts/cluster-merge.cjs` | AC-F3 (prepare + SHA recording); AC-F8 (merge gate checks) |
| `_project-deploy/hooks/approval-capture.cjs` | AC-F3 (APPROVE CLUSTERS handler records cluster_N_approved + SHA) |
| `_project-deploy/hooks/migration-gate.cjs` | AC-F3 (row 3 — cluster worktree write gate; D-1 path-dependent) |
| `tests/cluster-merge.test.cjs` | Validates AC-F8 scenarios |

**Coverage result:** AC-F3 and AC-F8 fully covered. ✅

---

## Files Changed

| File | Change Type | What changes |
|---|---|---|
| `scripts/cluster-merge.cjs` | new | Implements `prepare` (commit worktree branches, record SHAs, write pending-approval.json) and `merge` (check approval + SHA + BAL gate, execute merge, record result) subcommands |
| `_project-deploy/hooks/approval-capture.cjs` | modify | Add `APPROVE CLUSTERS ADO-NNN` and `SKIP CLUSTER ADO-NNN N` cases to the switch; read `pending-approval.json`, record `cluster_N_approved` + SHA per cluster |
| `_project-deploy/hooks/migration-gate.cjs` | modify | Add row 3: gate Write/Edit to `worktrees/cluster-N/**` paths until `cluster_N_approved` exists in approvals file (Option A only — skip row if D-1 = Option B) |
| `tests/cluster-merge.test.cjs` | new | Unit + integration tests for `prepare` and `merge` subcommands; covers SHA mismatch rejection, missing approval rejection, BAL gate check |

---

## Implementation Notes

### `cluster-merge.cjs` — overall structure

```javascript
'use strict';
/**
 * cluster-merge.cjs — manage cluster worktree branch commits and merges.
 *
 * Two subcommands:
 *   prepare  --ado=ADO-NNN --clusters=1,2,3
 *            Commits each worktree branch (if dirty), records branch head SHAs,
 *            writes .claude/migration/ADO-NNN.pending-approval.json.
 *   merge    --ado=ADO-NNN --cluster=N
 *            Checks cluster_N_approved gate + SHA match + BAL merge gate,
 *            then merges the worktree branch to target branch.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { normalizeAdo } = require('./ado-normalize.cjs');

// DECISION: How to derive the repo root
// Options considered:
//   A) process.cwd() — rejected: depends on invocation directory; not stable
//   B) git rev-parse --show-toplevel — chosen: always correct regardless of CWD
const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

function migrationDir(ado) {
  return path.join(repoRoot, '.claude', 'migration');
}

function approvalsPath(ado) {
  return path.join(migrationDir(ado), `${ado}.approvals.json`);
}

function pendingApprovalPath(ado) {
  return path.join(migrationDir(ado), `${ado}.pending-approval.json`);
}

function readApprovals(ado) {
  const p = approvalsPath(ado);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function findApproval(entries, key) {
  // Approvals file is append-only; last matching entry wins.
  return [...entries].reverse().find(e => e.gate === key) || null;
}

// --- subcommand: prepare ---
function prepare(ado, clusters) {
  const pending = { ado, prepared_at: new Date().toISOString(), clusters: [] };
  for (const n of clusters) {
    const branch = `cluster/${ado}-${n}`;
    // Commit any dirty state in the worktree branch
    try {
      execSync(`git -C "${repoRoot}" checkout ${branch}`, { stdio: 'pipe' });
      const status = execSync(`git -C "${repoRoot}" status --porcelain`, { encoding: 'utf8' });
      if (status.trim()) {
        execSync(`git -C "${repoRoot}" add -A && git -C "${repoRoot}" commit -m "[${ado}] Cluster ${n} — prepare commit"`, { stdio: 'inherit' });
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
  const dir = migrationDir(ado);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(pendingApprovalPath(ado), JSON.stringify(pending, null, 2));
  process.stdout.write(`pending-approval.json written. Reply: APPROVE CLUSTERS ${ado}\n`);
}

// --- subcommand: merge ---
function merge(ado, clusterN, targetBranch) {
  const entries = readApprovals(ado);

  // Gate 1: cluster_N_approved must exist
  const approval = findApproval(entries, `cluster_${clusterN}_approved`);
  if (!approval) {
    process.stderr.write(`cluster-merge merge: cluster_${clusterN}_approved not found in approvals. Reply APPROVE CLUSTERS ${ado} first.\n`);
    process.exit(2);
  }

  // Gate 2: SHA must match the approved SHA
  const branch = `cluster/${ado}-${clusterN}`;
  const currentSha = execSync(`git -C "${repoRoot}" rev-parse ${branch}`, { encoding: 'utf8' }).trim();
  if (currentSha !== approval.sha) {
    process.stderr.write(`cluster-merge merge: SHA mismatch for cluster ${clusterN}. Approved: ${approval.sha}. Current: ${currentSha}. Re-run prepare and get new approval.\n`);
    process.exit(2);
  }

  // Gate 3: BAL merge gate — check no uncommitted changes on target branch
  // DECISION: BAL gate implementation
  // A) Full BAL script execution — rejected: BAL script not in scope for Story 3
  // B) Simple uncommitted-state check on target branch — chosen: sufficient for v1;
  //    full BAL integration deferred to follow-up
  execSync(`git -C "${repoRoot}" checkout ${targetBranch || 'main'}`, { stdio: 'pipe' });
  const targetStatus = execSync(`git -C "${repoRoot}" status --porcelain`, { encoding: 'utf8' });
  if (targetStatus.trim()) {
    process.stderr.write(`cluster-merge merge: target branch has uncommitted changes. Commit or stash before merging.\n`);
    process.exit(2);
  }

  // Record commit_started gate (idempotency marker — prevents double-merge if interrupted)
  const startedEntry = { gate: `cluster_${clusterN}_commit_started`, at: new Date().toISOString(), sha: currentSha };
  fs.appendFileSync(approvalsPath(ado), JSON.stringify(startedEntry) + '\n');

  // Execute merge
  execSync(`git -C "${repoRoot}" merge --no-ff ${branch} -m "[${ado}] Merge cluster ${clusterN}"`, { stdio: 'inherit' });

  const mergeSha = execSync(`git -C "${repoRoot}" rev-parse HEAD`, { encoding: 'utf8' }).trim();
  const mergedEntry = { gate: `cluster_${clusterN}_merged`, at: new Date().toISOString(), merge_sha: mergeSha, source_sha: currentSha };
  fs.appendFileSync(approvalsPath(ado), JSON.stringify(mergedEntry) + '\n');

  process.stdout.write(`cluster ${clusterN} merged. SHA: ${mergeSha}\n`);
}

// --- CLI dispatch ---
const [,, subcommand, ...rest] = process.argv;
const args = Object.fromEntries(rest.map(a => a.replace(/^--/, '').split('=')));
const ado = normalizeAdo(args.ado);
if (!ado) { process.stderr.write('--ado is required\n'); process.exit(1); }

if (subcommand === 'prepare') {
  const clusters = (args.clusters || '').split(',').map(Number).filter(Boolean);
  if (!clusters.length) { process.stderr.write('--clusters is required (comma-separated)\n'); process.exit(1); }
  prepare(ado, clusters);
} else if (subcommand === 'merge') {
  const clusterN = Number(args.cluster);
  if (!clusterN) { process.stderr.write('--cluster is required\n'); process.exit(1); }
  merge(ado, clusterN, args['target-branch']);
} else {
  process.stderr.write('Unknown subcommand. Use: prepare | merge\n');
  process.exit(1);
}
```

### `approval-capture.cjs` additions — APPROVE CLUSTERS and SKIP CLUSTER

Add two new cases to the main `handlePrompt` switch (after the `APPROVE DESIGN` case):

```javascript
// APPROVE CLUSTERS ADO-NNN
// Reads the pending-approval.json written by cluster-merge.cjs prepare,
// records cluster_N_approved + SHA for every cluster in the set.
case 'APPROVE_CLUSTERS': {
  const pendingPath = path.join(migrationDir(ado), `${ado}.pending-approval.json`);
  if (!fs.existsSync(pendingPath)) {
    return { verdict: 'REJECT',
      message: `No pending-approval.json found for ${ado}. Run cluster-merge.cjs prepare first.` };
  }
  const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  const now = new Date().toISOString();
  for (const c of pending.clusters) {
    appendApproval(ado, {
      gate: `cluster_${c.cluster}_approved`,
      at: now,
      sha: c.sha,
      branch: c.branch
    });
  }
  fs.unlinkSync(pendingPath); // consumed — prevents replay
  const summary = pending.clusters.map(c => `cluster ${c.cluster} @ ${c.sha.slice(0,8)}`).join(', ');
  return { verdict: 'OK',
    additionalContext: `APPROVE CLUSTERS recorded for ${ado}: ${summary}. Run cluster-merge.cjs merge for each cluster.` };
}

// SKIP CLUSTER ADO-NNN N
// Records cluster_N_skipped — cluster-merge.cjs merge will not be required for this cluster.
case 'SKIP_CLUSTER': {
  const clusterN = Number(matchGroups.clusterN);
  if (!clusterN) {
    return { verdict: 'REJECT', message: 'Cluster number required: SKIP CLUSTER ADO-NNN N' };
  }
  appendApproval(ado, { gate: `cluster_${clusterN}_skipped`, at: new Date().toISOString() });
  return { verdict: 'OK',
    additionalContext: `cluster_${clusterN}_skipped recorded for ${ado}.` };
}
```

Regex patterns to add in the prompt-parsing block (before the switch):

```javascript
// Match: APPROVE CLUSTERS ADO-NNN
const approveClustersMatch = prompt.match(/^APPROVE\s+CLUSTERS\s+(ADO-\d+|#?\d+)\s*$/i);
// Match: SKIP CLUSTER ADO-NNN N
const skipClusterMatch = prompt.match(/^SKIP\s+CLUSTER\s+(ADO-\d+|#?\d+)\s+(\d+)\s*$/i);
```

### `migration-gate.cjs` row 3 — D-1 conditional

Add after the design-document row (row 2) in the `checkBash`/`checkWriteEdit` path:

```javascript
// Row 3: Cluster worktree write gate (D-1 path: Option A — fires only if PreToolUse
// fires in subagents; if D-1 = Option B, this row is still present but its path
// pattern will not match non-subagent invocations — cluster-merge.cjs enforces at merge time).
//
// DECISION: Whether to include row 3 regardless of D-1 result
// Options considered:
//   A) Include always — chosen: merge-time enforcement (cluster-merge.cjs) still active;
//      write-time gating adds defense-in-depth if PreToolUse fires; costs nothing if it doesn't
//   B) Conditionally compile based on D-1 — rejected: adds build-time branching; spike result
//      determines runtime behavior, not which code ships
{
  // Gate: Write/Edit to worktrees/cluster-N paths before cluster_N_approved
  test: (tool, input) => {
    if (!['Write', 'Edit'].includes(tool)) return false;
    const filePath = input.file_path || input.path || '';
    const m = filePath.match(/worktrees[\\/]cluster-(\d+)[\\/]/);
    if (!m) return false;
    const clusterN = Number(m[1]);
    // Derive ADO from the path (worktrees/cluster-N lives under the migration session folder)
    const adoMatch = filePath.match(/ADO-(\d+)/i);
    if (!adoMatch) return false;
    const ado = 'ADO-' + adoMatch[1];
    const entries = readApprovals(ado);
    const approved = entries.some(e => e.gate === `cluster_${clusterN}_approved`);
    const skipped  = entries.some(e => e.gate === `cluster_${clusterN}_skipped`);
    return !approved && !skipped;
  },
  message: (tool, input) => {
    const filePath = input.file_path || input.path || '';
    const m = filePath.match(/worktrees[\\/]cluster-(\d+)[\\/]/);
    const clusterN = m ? m[1] : '?';
    return `Write blocked: cluster ${clusterN} worktree write requires APPROVE CLUSTERS. ` +
           `Run cluster-merge.cjs prepare then reply APPROVE CLUSTERS ADO-NNN.`;
  }
}
```

---

## Auth & Security

No auth changes. All operations are local filesystem reads/writes + git command spawns. `cluster-merge.cjs merge` exits 2 on SHA mismatch or missing approval — cannot be bypassed by retrying with a different cluster number. The `pending-approval.json` is deleted on `APPROVE CLUSTERS` consumption to prevent approval replay.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `prepare` called when worktree branch does not exist | `git checkout` fails; caught; exits 1 with message including branch name |
| `APPROVE CLUSTERS` called without prior `prepare` | `pending-approval.json` absent; returns `REJECT` with message |
| `merge` called without `cluster_N_approved` | Exits 2; message names the missing gate and the approval command |
| `merge` SHA mismatch (branch advanced since approval) | Exits 2; shows approved SHA vs current SHA; instructs to re-run prepare |
| `merge` called twice for same cluster | `cluster_N_commit_started` idempotency marker detected; exits 2 with "already merged or in progress" |
| `migration-gate.cjs` row 3 crash | Caught by top-level try/catch; exits 2 (fail-closed) |

---

## D-1 Dependency

Story 3's `migration-gate.cjs` row 3 ships in both D-1 paths. The difference is runtime behavior:

| D-1 Result | Effect |
|---|---|
| PreToolUse fires in subagents (Option A confirmed) | Row 3 blocks cluster worktree writes in subagents before `APPROVE CLUSTERS` |
| PreToolUse does NOT fire in subagents (Option B) | Row 3 is present but never triggered by subagent writes; `cluster-merge.cjs merge` gate is the sole enforcement point |

The Tech Lead records the D-1 decision in `docs/plans/migrationSkill/rewrite-hook-gates-v1.md` before Story 3 implementation starts (per Story 1 Phase 0 spike requirement).

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| `cluster-merge.cjs` prepare subcommand | Init, git ops, SHA recording, pending-approval.json write | 1 |
| `cluster-merge.cjs` merge subcommand | Approval check, SHA gate, BAL check, merge, record | 1 |
| `approval-capture.cjs` additions (APPROVE CLUSTERS + SKIP CLUSTER) | Two new switch cases + regex patterns | 0.5 |
| `migration-gate.cjs` row 3 | Path pattern + approval check + error message | 0.5 |
| `tests/cluster-merge.test.cjs` | Unit + integration test suite | 1 |
| **Total** | | **4 (rounded from 4 task items → fits 3 SP bucket; 1 complexity buffer)** |

**Total SP: 3**
**Type: STORY** — single scope; shippable gate independently of Story 4.

---

## Definition of Done

**Implementation**
- [ ] `cluster-merge.cjs prepare` commits dirty worktree branches, records SHAs, writes `pending-approval.json`
- [ ] `cluster-merge.cjs merge` gates on `cluster_N_approved` + SHA match + BAL check before merging
- [ ] `cluster-merge.cjs merge` writes `cluster_N_commit_started` before merge and `cluster_N_merged` after
- [ ] `APPROVE CLUSTERS ADO-NNN` handler in `approval-capture.cjs` reads `pending-approval.json`, records per-cluster approvals, deletes `pending-approval.json`
- [ ] `SKIP CLUSTER ADO-NNN N` handler records `cluster_N_skipped`
- [ ] `migration-gate.cjs` row 3 blocks Write/Edit to `worktrees/cluster-N/**` until `cluster_N_approved` or `cluster_N_skipped`
- [ ] All hooks exit 2 on crash (never exit 0 or 1 on error)
- [ ] `normalizeAdo()` from `scripts/ado-normalize.cjs` used everywhere — no inline normalization
- [ ] No `console.log` in production paths; `process.stderr.write` for errors

**Quality**
- [ ] `node tests/cluster-merge.test.cjs` passes — all scenarios below covered
- [ ] SHA mismatch → merge exits 2 ✅
- [ ] Missing approval → merge exits 2 ✅
- [ ] Double-merge protection via `cluster_N_commit_started` idempotency marker ✅
- [ ] `APPROVE CLUSTERS` with missing `pending-approval.json` → REJECT ✅
- [ ] D-1 spike result documented and D-1 decision recorded before implementation starts

**Review readiness**
- [ ] PR title: `[ADO-9007] Story 3 — Phase 2 Cluster Write Gate`
- [ ] PR description maps each changed file to its AC role

### Reviewer Checklist

- [ ] `cluster-merge.cjs merge` checks SHA **before** starting any git operation — no partial-merge risk
- [ ] `cluster_N_commit_started` written atomically before `git merge` — verify idempotency on re-run after crash
- [ ] `pending-approval.json` deleted on successful APPROVE CLUSTERS — verify no replay path
- [ ] `migration-gate.cjs` row 3 derives ADO from path only — confirm no `active-task.json` read
- [ ] All three subcommand exits verified: `prepare` exits 0 on success, `merge` exits 0 on success, both exit 1/2 on error (1 for user error, 2 for gate block)

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `cluster-merge.cjs prepare` | ADO-0001, clusters 1,2 with clean worktree branches | `pending-approval.json` written with SHAs; exits 0 | AC-F3 |
| P-U2 | `cluster-merge.cjs merge` | Approved cluster 1 with matching SHA, clean target | Merge executes; `cluster_1_merged` appended; exits 0 | AC-F8 |
| P-U3 | `approval-capture.cjs APPROVE CLUSTERS` | Valid `pending-approval.json` exists | `cluster_N_approved` entries written per cluster; `pending-approval.json` deleted; `additionalContext` returned | AC-F3 |
| P-U4 | `approval-capture.cjs SKIP CLUSTER` | `SKIP CLUSTER ADO-0001 2` | `cluster_2_skipped` appended; verdict OK | AC-F3 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `cluster-merge.cjs merge` | No `cluster_1_approved` in approvals | Exits 2; message includes "cluster_1_approved not found" | AC-F8 |
| N-U2 | `cluster-merge.cjs merge` | `cluster_1_approved` present but current SHA differs | Exits 2; message shows approved SHA vs current SHA | AC-F8 |
| N-U3 | `cluster-merge.cjs merge` | `cluster_1_commit_started` already in approvals | Exits 2; message indicates "already merged or in progress" | AC-F8 |
| N-U4 | `approval-capture.cjs APPROVE CLUSTERS` | `pending-approval.json` absent | Returns REJECT with "run prepare first" | AC-F3 |
| N-U5 | `migration-gate.cjs` row 3 | Write to `worktrees/cluster-1/foo.cs` before `cluster_1_approved` | Exits 2; message includes "APPROVE CLUSTERS" | AC-F3 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Full prepare → approve → merge flow | prepare clusters 1,2 → APPROVE CLUSTERS → merge cluster 1 → merge cluster 2 | Both clusters merged; `cluster_1_merged` + `cluster_2_merged` in approvals | AC-F3 + AC-F8 |
| INT-2 | Fault injection: crash after commit_started | Write `cluster_1_commit_started` manually, then run merge | Exits 2 on idempotency check; no double-merge | AC-F8 |

---

### Revision Log
2026-10-02 — Story 3 tech spec drafted (cluster-merge.cjs prepare+merge, approval-capture additions, migration-gate row 3, D-1 note)
