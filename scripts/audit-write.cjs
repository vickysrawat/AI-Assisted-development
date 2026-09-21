#!/usr/bin/env node
// scripts/audit-write.cjs — write one governance audit event to .claude/audit/
//
// Called by Claude via Bash at governance action points (APPROVE_ADO, APPROVE_CONFIG,
// APPROVE_ALL, DISMISS, BYPASS_TEST_GATE, BYPASS_HOTFIX, RBAC_BLOCK).
// Each call writes a single per-event JSON file. Git history is the immutability
// mechanism — files in .claude/audit/ are committed, never gitignored.
//
// Usage (skills resolve $PLUGIN_DIR via .claude/plugin-path.txt):
//   node "$PLUGIN_DIR/scripts/audit-write.cjs" \
//     --event   APPROVE_ADO \
//     --ado-id  1234 \
//     --verdict approved \
//     --context "ICEA approved for ADO-1234"
//
// Optional args: --finding-id, --path  (pass literal "null" or omit to get null in output)
// Output file:   .claude/audit/{ms-timestamp}-{EVENT}.json
// Exit code:     always 0 — best-effort, never blocks governance flows.

'use strict';

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

// ── CLI args ──────────────────────────────────────────────────────────────────

function arg(name) {
  const idx = process.argv.indexOf('--' + name);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

const event     = arg('event');
const adoId     = arg('ado-id');
const findingId = arg('finding-id');
const filePath  = arg('path');
const verdict   = arg('verdict');
const context   = arg('context');
const model     = arg('model');    // e.g. claude-opus-4-8 — Pass B per-invocation tracking

if (!event) {
  process.stderr.write('audit-write: --event is required\n');
  process.exit(0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nullIf(v) {
  return !v || v === 'null' ? null : v;
}

function resolveActor() {
  for (const cmd of ['git config user.email', 'git config user.name']) {
    try {
      const v = execSync(cmd, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
      }).trim();
      if (v) return v;
    } catch (_) {}
  }
  return 'unknown';
}

function resolveRole(actor) {
  try {
    const rolesPath = path.join(process.cwd(), '.claude', 'ApprovalRoles.json');
    const roles = JSON.parse(fs.readFileSync(rolesPath, 'utf8'));
    if ((roles.tech_leads || []).includes(actor)) return 'tech_lead';
    if ((roles.security_officers || []).includes(actor)) return 'security_officer';
  } catch (_) {}
  return 'developer';
}

// ── Write event file ──────────────────────────────────────────────────────────

try {
  const actor = resolveActor();
  const entry = {
    timestamp:  new Date().toISOString(),
    actor,
    role:       resolveRole(actor),
    event,
    model:      nullIf(model),     // configured model for this skill's tier; null for hook-driven events
    ado_id:     nullIf(adoId),
    finding_id: nullIf(findingId),
    path:       nullIf(filePath),
    verdict:    nullIf(verdict),
    context:    nullIf(context),
  };

  const auditDir = path.join(process.cwd(), '.claude', 'audit');
  fs.mkdirSync(auditDir, { recursive: true });

  // Millisecond timestamp prefix guarantees uniqueness and chronological sort order.
  const filename = Date.now() + '-' + event + '.json';
  fs.writeFileSync(
    path.join(auditDir, filename),
    JSON.stringify(entry, null, 2) + '\n',
    'utf8'
  );
} catch (e) {
  process.stderr.write('audit-write: ' + e.message + '\n');
}

process.exit(0);
