#!/usr/bin/env node
// hooks/approval-capture.cjs — UserPromptSubmit hook: captures developer migration approvals
//
// Recognises the rewrite skill's approval grammar in developer prompts and records
// each approval to .claude/migration/ADO-NNN.approvals.json (append-only).
// Also mirrors gate verdicts to the checkpoint ledger and appends [DECISION] entries
// to migration-log.md. Returns additionalContext so Claude can acknowledge the approval.
//
// Exit contract:
//   exits 0 in ALL paths including refusals (never blocks the prompt)
//   exits 2 only on unexpected/uncaught JS errors (fail-closed per AC-NF1)
//
// Approval grammar handled here:
//   APPROVE OPTIONS ADO-NNN {A|B|C}  — strict: refused if any PARTIAL inventory rows exist
//   PROCEED ADO-NNN {A|B|C}          — lenient: acknowledges PARTIAL rows + records options_approved
//   APPROVE DESIGN ADO-NNN           — validates 7 design docs + target_root + inventory cleanliness
//   APPROVE CLUSTERS ADO-NNN         — reads pending-approval.json, records cluster_N_approved + SHA per cluster
//   SKIP CLUSTER ADO-NNN N           — records cluster_N_skipped for the given cluster
//   APPROVE ADO-NNN (plain)          — NOT captured here; routes to icea-approve

'use strict';
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { normalizeAdo } = require('../../scripts/ado-normalize.cjs');

// Path to the plugin root — two levels up from _project-deploy/hooks/
const PLUGIN_DIR    = path.join(__dirname, '../..');
const LEDGER_SCRIPT = path.join(PLUGIN_DIR, 'scripts', 'checkpoint-ledger.cjs');

// The 7 design documents that must all exist before APPROVE DESIGN is accepted
const DESIGN_DOCS = [
  'target-component-architecture.md',
  'target-data-architecture.md',
  'target-security-architecture.md',
  'target-integration-architecture.md',
  'target-infrastructure-architecture.md',
  'target-deployment-architecture.md',
  'migration-feasibility.md',
];

// Read the full stdin payload, then route to the matching handler
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(Buffer.concat(chunks).toString()); }
  catch (e) { process.exit(0); } // non-JSON stdin — not a hook invocation, pass through

  const prompt = (payload.prompt || '').trim();
  try {
    handlePrompt(prompt);
  } catch (e) {
    // Unexpected JS errors are fail-closed — never silently swallow a crash
    process.stderr.write('approval-capture: unexpected error: ' + e.message + '\n');
    process.exit(2);
  }
});

/**
 * Routes the developer's prompt to the correct approval handler.
 * Unrecognised prompts (including plain APPROVE ADO-NNN) pass through to icea-approve.
 *
 * DECISION: closed switch on recognised prefixes — each branch is independently testable
 * and easy to extend (Story 3 adds APPROVE CLUSTERS / SKIP CLUSTER here).
 */
function handlePrompt(prompt) {
  if (/^APPROVE OPTIONS /i.test(prompt))      { handleApproveOptions(prompt);   return; }
  if (/^PROCEED /i.test(prompt))              { handleProceed(prompt);          return; }
  if (/^APPROVE DESIGN /i.test(prompt))       { handleApproveDesign(prompt);    return; }
  if (/^APPROVE\s+CLUSTERS\s+/i.test(prompt)) { handleApproveClusters(prompt);  return; }
  if (/^SKIP\s+CLUSTER\s+/i.test(prompt))     { handleSkipCluster(prompt);      return; }
  // Plain APPROVE ADO-NNN (no qualifier) passes through to icea-approve — not captured here
  process.exit(0);
}

/**
 * Writes an additionalContext JSON message to stdout so Claude can relay it to the developer,
 * then exits 0. This never blocks the prompt — it only informs Claude of the outcome.
 */
function respond(message) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: message },
  }) + '\n');
  process.exit(0);
}

/**
 * Parses the option letter and ADO from "APPROVE OPTIONS ADO-NNN B" or "PROCEED ADO-NNN B".
 * Returns { ado, letter } on success, or null if the format is invalid.
 */
function parseOptionsPrompt(prompt) {
  const m = prompt.match(/^(?:APPROVE OPTIONS|PROCEED)\s+(\S+)\s+([A-Za-z])/i);
  if (!m) return null;
  const ado = normalizeAdo(m[1]);
  if (!ado) return null;
  return { ado, letter: m[2].toUpperCase() };
}

/**
 * Handles "APPROVE OPTIONS ADO-NNN {letter}".
 * Strict path: refuses if any PARTIAL rows exist in integration-inventory.md.
 * Developer must use PROCEED to acknowledge PARTIAL rows explicitly.
 */
function handleApproveOptions(prompt) {
  const parsed = parseOptionsPrompt(prompt);
  if (!parsed) {
    respond('❌ APPROVE OPTIONS: invalid format. Use: APPROVE OPTIONS ADO-NNN {A|B|C}');
    return;
  }
  const { ado, letter } = parsed;

  // Options document must exist before the approval can be recorded
  const optionsFile = path.join('docs', 'migrations', ado, `${ado}-options.md`);
  if (!fs.existsSync(optionsFile)) {
    respond(
      `❌ APPROVE OPTIONS refused for ${ado} — options.md not found at ${optionsFile}.\n` +
      `Complete Step 2 (options analysis) before approving options.`
    );
    return;
  }

  // Strict check: any PARTIAL integration row blocks this form — use PROCEED instead
  const partialRows = readInventoryRows(ado, /\|\s*PARTIAL\s*\|/);
  if (partialRows.length > 0) {
    respond(
      `❌ APPROVE OPTIONS refused for ${ado} — ${partialRows.length} PARTIAL integration row(s) need acknowledgement:\n` +
      `  ${partialRows.join('\n  ')}\n` +
      `Reply: PROCEED ADO-${ado} ${letter}   (acknowledges PARTIAL rows and records options_approved)`
    );
    return;
  }

  recordOptionsApproval(ado, letter, []);
  respond(
    `✅ options_approved recorded for ${ado} — option ${letter} selected.\n` +
    `Design documents (target-*.md, migration-feasibility.md) may now be authored.`
  );
}

/**
 * Handles "PROCEED ADO-NNN {letter}".
 * Lenient path: acknowledges all current PARTIAL rows and records options_approved in one step.
 * The acknowledged row texts are stored so APPROVE DESIGN can verify them later.
 */
function handleProceed(prompt) {
  const parsed = parseOptionsPrompt(prompt);
  if (!parsed) {
    respond('❌ PROCEED: invalid format. Use: PROCEED ADO-NNN {A|B|C}');
    return;
  }
  const { ado, letter } = parsed;

  const optionsFile = path.join('docs', 'migrations', ado, `${ado}-options.md`);
  if (!fs.existsSync(optionsFile)) {
    respond(
      `❌ PROCEED refused for ${ado} — options.md not found.\n` +
      `Complete Step 2 (options analysis) before approving options.`
    );
    return;
  }

  // Collect all current PARTIAL rows to record as acknowledged
  const partialRows = readInventoryRows(ado, /\|\s*PARTIAL\s*\|/);
  recordOptionsApproval(ado, letter, partialRows);

  const note = partialRows.length > 0
    ? ` (${partialRows.length} PARTIAL row(s) acknowledged)`
    : '';
  respond(
    `✅ options_approved recorded for ${ado} — option ${letter} selected${note}.\n` +
    `Design documents may now be authored.`
  );
}

/**
 * Handles "APPROVE DESIGN ADO-NNN".
 * Validates: all 7 design documents exist, target_root is set in checkpoint,
 * no UNVERIFIED rows, and all PARTIAL rows were acknowledged via prior PROCEED records.
 */
function handleApproveDesign(prompt) {
  const m = prompt.match(/^APPROVE DESIGN\s+(\S+)/i);
  if (!m) {
    respond('❌ APPROVE DESIGN: invalid format. Use: APPROVE DESIGN ADO-NNN');
    return;
  }
  const ado = normalizeAdo(m[1]);
  if (!ado) {
    respond(`❌ APPROVE DESIGN: invalid ADO ID "${m[1]}"`);
    return;
  }

  // All 7 design documents must exist by name (not just by count)
  const missingDocs = DESIGN_DOCS.filter(
    doc => !fs.existsSync(path.join('docs', 'migrations', ado, doc))
  );
  if (missingDocs.length > 0) {
    respond(
      `❌ APPROVE DESIGN refused for ${ado} — ${missingDocs.length} design document(s) missing:\n` +
      `  ${missingDocs.join('\n  ')}\n` +
      `Author all 7 design documents before approving design.`
    );
    return;
  }

  // target_root must have been set by SKILL.md Step 0 set-payload
  const targetRoot = getTargetRoot(ado);
  if (!targetRoot) {
    respond(
      `❌ APPROVE DESIGN refused for ${ado} — target_root not set in checkpoint.\n` +
      `Run: node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado=${ado} --key=target_root --value=<path>`
    );
    return;
  }

  // No UNVERIFIED or unknown rows allowed in the integration inventory
  const unverifiedRows = readInventoryRows(ado, /\|\s*(UNVERIFIED|unknown)\s*\|/i);
  if (unverifiedRows.length > 0) {
    respond(
      `❌ APPROVE DESIGN refused for ${ado} — ${unverifiedRows.length} UNVERIFIED integration row(s) must be resolved:\n` +
      `  ${unverifiedRows.join('\n  ')}`
    );
    return;
  }

  // Every PARTIAL row must appear in the acknowledged list from prior PROCEED records
  const partialRows = readInventoryRows(ado, /\|\s*PARTIAL\s*\|/);
  if (partialRows.length > 0) {
    const acknowledged = getAcknowledgedRows(ado);
    const unacknowledged = partialRows.filter(row => !acknowledged.has(row.trim()));
    if (unacknowledged.length > 0) {
      respond(
        `❌ APPROVE DESIGN refused for ${ado} — ${unacknowledged.length} PARTIAL row(s) not yet acknowledged:\n` +
        `  ${unacknowledged.join('\n  ')}\n` +
        `Reply PROCEED ADO-${ado} {letter} to acknowledge PARTIAL rows first.`
      );
      return;
    }
  }

  // All checks passed — record the design approval
  const now = new Date().toISOString();
  appendApproval(ado, { type: 'design_approved', ado, target_root: targetRoot, at: now, by: 'developer' });
  mirrorGateToLedger(ado, 'design_approved', 'PASS');
  appendMigrationLog(ado, `[DECISION] design_approved: all 7 documents approved, target_root=${targetRoot}`);
  respond(
    `✅ design_approved recorded for ${ado}\n` +
    `  target_root: ${targetRoot}\n` +
    `  All 7 design documents confirmed. Proceed to Step 3 (cluster generation).`
  );
}

// --- Shared data helpers ---

/**
 * Records options_approved + optional partial_acknowledged entries to the approvals file,
 * mirrors the gate to the checkpoint ledger, and appends a [DECISION] log entry.
 */
function recordOptionsApproval(ado, letter, partialRows) {
  const now = new Date().toISOString();
  appendApproval(ado, { type: 'options_approved', ado, option: letter, at: now, by: 'developer' });
  if (partialRows.length > 0) {
    // Store the full trimmed row text so APPROVE DESIGN can compare by content
    appendApproval(ado, {
      type: 'partial_acknowledged', ado,
      rows: partialRows.map(r => r.trim()),
      at: now, by: 'developer',
    });
  }
  mirrorGateToLedger(ado, 'options_approved', 'PASS');
  appendMigrationLog(
    ado,
    `[DECISION] options_approved: option ${letter}` +
    (partialRows.length > 0 ? ` (${partialRows.length} PARTIAL rows acknowledged)` : '')
  );
}

/**
 * Appends one approval entry to .claude/migration/ADO-NNN.approvals.json.
 * Creates the file and directory if they do not exist.
 * The file is a JSON array — each entry is an approval record.
 */
function appendApproval(ado, entry) {
  const file = path.join('.claude', 'migration', `${ado}.approvals.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let list = [];
  if (fs.existsSync(file)) {
    try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  }
  list.push(entry);
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n');
}

/**
 * Mirrors a gate verdict to the checkpoint ledger via checkpoint-ledger.cjs.
 * Advisory only — silently ignores failures such as missing checkpoint (exit 5).
 */
function mirrorGateToLedger(ado, gate, verdict) {
  spawnSync('node', [
    LEDGER_SCRIPT, 'set-gate',
    `--ado=${ado}`, '--skill=rewrite', `--gate=${gate}`, `--verdict=${verdict}`,
  ], { stdio: 'pipe' });
}

/**
 * Appends a [DECISION] line to docs/migrations/ADO-NNN/migration-log.md.
 * No-op if the log file does not yet exist — avoids creating it prematurely.
 */
function appendMigrationLog(ado, message) {
  const logFile = path.join('docs', 'migrations', ado, 'migration-log.md');
  if (!fs.existsSync(logFile)) return;
  const date = new Date().toISOString().slice(0, 10);
  fs.appendFileSync(logFile, `\n${message} — ${date}\n`);
}

/**
 * Reads lines from integration-inventory.md that match the given status pattern.
 * Returns only valid table rows (lines that start with the | character).
 */
function readInventoryRows(ado, pattern) {
  const file = path.join('docs', 'migrations', ado, 'integration-inventory.md');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => pattern.test(line) && line.trim().startsWith('|'));
}

/**
 * Returns the set of PARTIAL row texts that have been acknowledged via prior PROCEED records.
 * Used by handleApproveDesign to verify all PARTIAL rows are covered before approval.
 */
function getAcknowledgedRows(ado) {
  const file = path.join('.claude', 'migration', `${ado}.approvals.json`);
  if (!fs.existsSync(file)) return new Set();
  let list = [];
  try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return new Set(); }
  const acknowledged = new Set();
  for (const a of list) {
    if (a.type === 'partial_acknowledged' && Array.isArray(a.rows)) {
      for (const row of a.rows) acknowledged.add(row);
    }
  }
  return acknowledged;
}

/**
 * Reads target_root from the rewrite skill's payload namespace in the checkpoint file.
 * Returns null if the checkpoint is absent or target_root has not been set by Step 0.
 */
function getTargetRoot(ado) {
  const file = path.join('.claude', 'migration', `${ado}.checkpoint.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const cp = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (cp.payload && cp.payload.rewrite && cp.payload.rewrite.target_root) || null;
  } catch (_) { return null; }
}

/**
 * Handles "APPROVE CLUSTERS ADO-NNN".
 * Reads pending-approval.json written by cluster-merge.cjs prepare, records
 * cluster_N_approved + SHA for every cluster in the set, then deletes the pending file
 * to prevent replay. Exits 0 in all paths (never blocks the prompt).
 */
function handleApproveClusters(prompt) {
  const m = prompt.match(/^APPROVE\s+CLUSTERS\s+(\S+)\s*$/i);
  if (!m) {
    respond('❌ APPROVE CLUSTERS: invalid format. Use: APPROVE CLUSTERS ADO-NNN');
    return;
  }
  const ado = normalizeAdo(m[1]);
  if (!ado) {
    respond(`❌ APPROVE CLUSTERS: invalid ADO ID "${m[1]}"`);
    return;
  }

  const pendingPath = path.join('.claude', 'migration', `${ado}.pending-approval.json`);
  if (!fs.existsSync(pendingPath)) {
    respond(
      `❌ APPROVE CLUSTERS refused for ${ado} — pending-approval.json not found.\n` +
      `Run first: node scripts/cluster-merge.cjs prepare --ado=${ado} --clusters=1,2,...`
    );
    return;
  }

  let pending;
  try { pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8')); }
  catch (_) {
    respond(`❌ APPROVE CLUSTERS refused for ${ado} — pending-approval.json is not valid JSON.`);
    return;
  }

  // Record cluster_N_approved + SHA for every cluster in the pending set
  const now = new Date().toISOString();
  for (const c of pending.clusters) {
    appendApproval(ado, {
      gate: `cluster_${c.cluster}_approved`,
      at: now,
      sha: c.sha,
      branch: c.branch,
    });
  }

  // Delete pending-approval.json — consumed; prevents approval replay
  fs.unlinkSync(pendingPath);

  mirrorGateToLedger(ado, 'clusters_approved', 'PASS');
  const summary = pending.clusters.map(c => `cluster ${c.cluster} @ ${c.sha.slice(0, 8)}`).join(', ');
  respond(
    `✅ APPROVE CLUSTERS recorded for ${ado}: ${summary}.\n` +
    `Run: node scripts/cluster-merge.cjs merge --ado=${ado} --cluster=N   for each cluster.`
  );
}

/**
 * Handles "SKIP CLUSTER ADO-NNN N".
 * Records cluster_N_skipped so cluster-merge.cjs merge will not be required for this cluster.
 * Exits 0 in all paths (never blocks the prompt).
 */
function handleSkipCluster(prompt) {
  const m = prompt.match(/^SKIP\s+CLUSTER\s+(\S+)\s+(\d+)\s*$/i);
  if (!m) {
    respond('❌ SKIP CLUSTER: invalid format. Use: SKIP CLUSTER ADO-NNN N');
    return;
  }
  const ado = normalizeAdo(m[1]);
  if (!ado) {
    respond(`❌ SKIP CLUSTER: invalid ADO ID "${m[1]}"`);
    return;
  }
  const clusterN = Number(m[2]);

  appendApproval(ado, { gate: `cluster_${clusterN}_skipped`, at: new Date().toISOString() });
  respond(`✅ cluster_${clusterN}_skipped recorded for ${ado}.`);
}
