#!/usr/bin/env node
// hooks/migration-gate.cjs — PreToolUse hook: enforces migration write gates
//
// Blocks Write, Edit, and Bash tool calls that would let the model bypass approval gates.
// The gate is fail-closed: any uncaught error exits 2 (blocks the tool call).
//
// Gate table (rows implemented in this story):
//   Row 1: docs/migrations/{ADO}/{ADO}-options.md
//          Requires: intake_context PASS  (intake-verify.cjs check-gate --skill=rewrite)
//                  + coupling_resolution_confirmed valid (coupling-resolution-validate.cjs)
//   Row 2: docs/migrations/{ADO}/target-*.md | migration-feasibility.md
//          Requires: options_approved in .claude/migration/{ADO}.approvals.json
//   Row 3: worktrees/cluster-N/... (cluster worktree write gate)
//          Requires: cluster_N_approved OR cluster_N_skipped in approvals file
//          D-1 note: enforcement-at-write-time (Option A confirmed: PreToolUse fires in subagents);
//          cluster-merge.cjs also enforces at merge time as defense-in-depth
//
// Bash block patterns:
//   A) Any command referencing .approvals.json
//   B) Any command containing --gate=<protected_gate>
//   C) Any non-read-only command referencing .checkpoint.json + a protected gate name
//
// DECISION: ADO is always derived from the file path pattern, never from active-task.json.
//   Options considered:
//     A) Read ADO from .claude/active-task.json — rejected: model-written file; model could
//        switch off the gate by writing a wrong ADO value (AC-NF2 violation)
//     B) Parse ADO from the file path segment — chosen: path is determined by the tool call
//        itself, which the model cannot forge without triggering the gate on the correct ADO

'use strict';
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { normalizeAdo } = require('../../scripts/ado-normalize.cjs');

// Plugin root — two levels up from _project-deploy/hooks/
const PLUGIN_DIR        = path.join(__dirname, '../..');
const INTAKE_VERIFY     = path.join(PLUGIN_DIR, 'scripts', 'intake-verify.cjs');
const COUPLING_VALIDATE = path.join(PLUGIN_DIR, 'scripts', 'coupling-resolution-validate.cjs');

// Gate names that the model must never write directly via Bash or checkpoint JSON
const PROTECTED_GATES = ['options_approved', 'design_approved', 'cluster_'];

// Read the stdin payload and route to the appropriate gate check
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  try {
    const payload  = JSON.parse(Buffer.concat(chunks).toString());
    const toolName = payload.tool_name  || '';
    const input    = payload.tool_input || {};

    if (toolName === 'Write' || toolName === 'Edit') {
      checkFilePath(input.file_path || '');
    } else if (toolName === 'Bash') {
      checkBashCommand(input.command || '');
    }
    process.exit(0); // path is not gated, or all gates passed
  } catch (e) {
    block('hook error: ' + e.message); // fail-closed per AC-NF1
  }
});

/**
 * Emits a blocking error message to stderr and exits 2.
 * Exit code 2 instructs Claude Code to block the tool call and surface the message.
 */
function block(msg) {
  process.stderr.write('migration-gate: ' + msg + '\n');
  process.exit(2);
}

/**
 * Checks a Write or Edit file path against all gated patterns.
 * Exits 2 (via block) if any gate condition is not satisfied; returns normally to allow.
 */
function checkFilePath(filePath) {
  // Normalise path separators to forward slashes for consistent matching on Windows and POSIX
  const norm = filePath.replace(/\\/g, '/');

  // Block direct writes to the approvals file — only approval-capture.cjs may write it
  if (norm.includes('.claude/migration/') && norm.endsWith('.approvals.json')) {
    block(
      'Write to .approvals.json blocked — the approvals file is written exclusively by the ' +
      'approval-capture hook (triggered by developer prompt APPROVE OPTIONS / PROCEED / ' +
      'APPROVE CLUSTERS). Do not write it directly.'
    );
    return;
  }

  // Row 3: cluster worktree write gate
  // Blocks Write/Edit to worktrees/cluster-N/ paths until cluster_N_approved or cluster_N_skipped.
  // ADO is always derived from the file path — never from active-task.json (AC-NF2).
  //
  // DECISION: Whether to include row 3 regardless of D-1 spike result
  // Options considered:
  //   A) Include always — chosen: merge-time enforcement (cluster-merge.cjs) remains active;
  //      write-time gating adds defense-in-depth when PreToolUse fires in subagents (Option A
  //      confirmed); costs nothing at runtime if it does not fire
  //   B) Conditionally compile based on D-1 — rejected: adds build-time branching; the spike
  //      result determines runtime behaviour, not which code ships
  const clusterMatch = norm.match(/worktrees\/cluster-(\d+)\//);
  if (clusterMatch) {
    const adoInPath = norm.match(/ADO-\d+/i);
    if (adoInPath) {
      const clusterAdo = normalizeAdo(adoInPath[0]);
      if (clusterAdo) {
        checkClusterWriteGate(clusterAdo, Number(clusterMatch[1]));
        return;
      }
    }
    // No ADO in path — cannot identify the owning migration session; allow
    return;
  }

  // Extract the ADO ID from the migration docs path: docs/migrations/ADO-NNNN/...
  const migMatch = norm.match(/docs\/migrations\/(ADO-\d+)\//i);
  if (!migMatch) return; // not a migration path — allow

  const ado = normalizeAdo(migMatch[1]);
  if (!ado) return;

  // Row 1: options.md — re-validates intake + coupling resolution gates at write time
  const optionsPattern = new RegExp(`${ado}-options\\.md$`, 'i');
  if (optionsPattern.test(norm)) {
    checkOptionsWriteGate(ado);
    return;
  }

  // Row 2: design docs (target-*.md or migration-feasibility.md) — requires options_approved
  if (/\/target-[^/]+\.md$/.test(norm) || norm.endsWith('/migration-feasibility.md')) {
    checkDesignWriteGate(ado);
    return;
  }
}

/**
 * Row 1 gate: re-validates intake_context (via intake-verify.cjs) and coupling resolution
 * (via coupling-resolution-validate.cjs) at the moment the model attempts to write options.md.
 * Both scripts must exit 0 before the write is allowed.
 */
function checkOptionsWriteGate(ado) {
  // Re-validate intake_context gate — exits 0 only when gate value is PASS
  const intakeResult = spawnSync(
    'node', [INTAKE_VERIFY, 'check-gate', `--ado=${ado}`, '--skill=rewrite'],
    { stdio: 'pipe' }
  );
  if (intakeResult.status !== 0) {
    block(
      `Write to ${ado}-options.md blocked — intake_context gate is not PASS.\n` +
      `Complete intake verification (Step 0) before authoring the options document.\n` +
      `Check: node scripts/intake-verify.cjs check-gate --ado=${ado} --skill=rewrite`
    );
    return;
  }

  // Re-validate coupling resolution — all critical/major couplings must have resolutions
  const checkpointFile = path.join('.claude', 'migration', `${ado}.checkpoint.json`);
  const couplingResult = spawnSync(
    'node', [COUPLING_VALIDATE, `--checkpoint=${checkpointFile}`],
    { stdio: 'pipe' }
  );
  if (couplingResult.status !== 0) {
    block(
      `Write to ${ado}-options.md blocked — coupling_resolution_confirmed is not valid.\n` +
      `Complete coupling resolution at Step 1.5 before authoring the options document.`
    );
    return;
  }
}

/**
 * Row 2 gate: verifies that options_approved exists in the approvals file
 * before allowing the model to write any design document for this ADO.
 */
function checkDesignWriteGate(ado) {
  const approvalsFile = path.join('.claude', 'migration', `${ado}.approvals.json`);

  if (!fs.existsSync(approvalsFile)) {
    block(
      `Write to design doc blocked for ${ado} — no approvals recorded.\n` +
      `Reply: APPROVE OPTIONS ADO-${ado} {A|B|C}   ` +
      `(or PROCEED ADO-${ado} {letter} if PARTIAL rows exist in integration inventory)`
    );
    return;
  }

  let approvals;
  try { approvals = JSON.parse(fs.readFileSync(approvalsFile, 'utf8')); }
  catch (_) {
    block(`Write to design doc blocked for ${ado} — approvals file is not valid JSON.`);
    return;
  }

  if (!Array.isArray(approvals) || !approvals.some(a => a.type === 'options_approved')) {
    block(
      `Write to design doc blocked for ${ado} — options_approved not found in approvals file.\n` +
      `Reply: APPROVE OPTIONS ADO-${ado} {A|B|C}`
    );
    return;
  }
}

/**
 * Row 3 gate: verifies that cluster_N_approved or cluster_N_skipped exists in the approvals
 * file before allowing the model to write to a cluster worktree path.
 * Exits 2 via block() if the cluster is neither approved nor skipped.
 */
function checkClusterWriteGate(ado, clusterN) {
  const approvalsFile = path.join('.claude', 'migration', `${ado}.approvals.json`);

  if (!fs.existsSync(approvalsFile)) {
    block(
      `Write to cluster ${clusterN} worktree blocked for ${ado} — cluster_${clusterN}_approved not found.\n` +
      `Run: node scripts/cluster-merge.cjs prepare --ado=${ado} --clusters=${clusterN}\n` +
      `Then reply: APPROVE CLUSTERS ${ado}`
    );
    return;
  }

  let approvals;
  try { approvals = JSON.parse(fs.readFileSync(approvalsFile, 'utf8')); }
  catch (_) {
    block(`Write to cluster ${clusterN} worktree blocked for ${ado} — approvals file is not valid JSON.`);
    return;
  }

  const approved = Array.isArray(approvals) && approvals.some(e => e.gate === `cluster_${clusterN}_approved`);
  const skipped  = Array.isArray(approvals) && approvals.some(e => e.gate === `cluster_${clusterN}_skipped`);

  if (!approved && !skipped) {
    block(
      `Write to cluster ${clusterN} worktree blocked for ${ado} — cluster_${clusterN}_approved not found.\n` +
      `Run: node scripts/cluster-merge.cjs prepare --ado=${ado} --clusters=${clusterN}\n` +
      `Then reply: APPROVE CLUSTERS ${ado}`
    );
  }
}

/**
 * Checks a Bash command against three patterns that would let the model bypass migration gates.
 *
 *   Pattern A: any reference to .approvals.json (only approval-capture may write it)
 *   Pattern B: --gate=<protected> flag (catches checkpoint-ledger set-gate calls)
 *   Pattern C: non-read-only command containing both .checkpoint.json and a protected gate name
 *              (catches node -e one-liners that write directly to the checkpoint JSON)
 *
 * Read-only commands (grep, cat, head, tail) that merely mention a gate name are allowed,
 * e.g. "grep options_approved skills/rewrite/SKILL.md" exits 0.
 */
function checkBashCommand(cmd) {
  // Pattern A: block any reference to the approvals file
  if (cmd.includes('.approvals.json')) {
    block(
      'Bash: reference to .approvals.json blocked — the approvals file must only be ' +
      'written by the approval-capture hook (developer APPROVE OPTIONS / PROCEED prompt).'
    );
    return;
  }

  // Pattern B: block --gate= with a protected gate name
  for (const gate of PROTECTED_GATES) {
    if (cmd.includes(`--gate=${gate}`)) {
      block(
        `Bash: --gate=${gate} blocked — gate writes for this gate name must come from ` +
        `the approval-capture hook, not a direct Bash command.`
      );
      return;
    }
  }

  // Pattern C: block non-read-only commands that reference both a checkpoint file and a protected gate
  // Read-only commands are grep, cat, head, tail — they do not mutate checkpoint state
  const isReadOnly = /^(grep|cat|head|tail)\s/.test(cmd.trim());
  if (!isReadOnly && cmd.includes('.checkpoint.json')) {
    for (const gate of PROTECTED_GATES) {
      if (cmd.includes(gate)) {
        block(
          `Bash: checkpoint file write referencing protected gate "${gate}" blocked. ` +
          `Use the approval-capture hook (developer prompt) to record this gate.`
        );
        return;
      }
    }
  }
}
