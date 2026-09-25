#!/usr/bin/env node
// scripts/rbac-check.cjs — role-based access check for high-risk governance actions
//
// Reads .claude/ApprovalRoles.json and git config user.email to determine whether
// the current actor has the required role for the requested action.
//
// Usage (skills resolve $PLUGIN_DIR via .claude/plugin-path.txt):
//   node "$PLUGIN_DIR/scripts/rbac-check.cjs" --action APPROVE_ALL
//   node "$PLUGIN_DIR/scripts/rbac-check.cjs" --action APPROVE_CONFIG_HIGH_RISK
//   node "$PLUGIN_DIR/scripts/rbac-check.cjs" --action DISMISS_HIGH_SEVERITY
//
// Output: JSON to stdout
// Exit 0: allowed  (role check passed OR ApprovalRoles.json is empty = opt-out)
// Exit 1: blocked  (actor does not have the required role)

'use strict';

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

// ── CLI ───────────────────────────────────────────────────────────────────────

function arg(name) {
  const idx = process.argv.indexOf('--' + name);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

const action = arg('action');

if (!action) {
  process.stderr.write('rbac-check: --action is required\n');
  process.stdout.write(JSON.stringify({ allowed: true, reason: 'no-action' }) + '\n');
  process.exit(0);
}

// ── Action → required role ────────────────────────────────────────────────────

const ACTION_ROLES = {
  APPROVE_ALL:              'tech_lead',
  APPROVE_CONFIG_HIGH_RISK: 'tech_lead',
  DISMISS_HIGH_SEVERITY:    'security_officer',
};

const ROLE_FIELDS = {
  tech_lead:        'tech_leads',
  security_officer: 'security_officers',
};

const ROLE_LABELS = {
  tech_lead:        'Tech Lead',
  security_officer: 'Security Officer',
};

const requiredRole = ACTION_ROLES[action];
if (!requiredRole) {
  // Unknown action — pass through (future-proof; never block on unrecognised actions)
  process.stdout.write(JSON.stringify({ allowed: true, reason: 'action-not-gated' }) + '\n');
  process.exit(0);
}

// ── Identity resolution ───────────────────────────────────────────────────────

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

// ── Load roles ────────────────────────────────────────────────────────────────

function loadRoles() {
  try {
    const p = path.join(process.cwd(), '.claude', 'ApprovalRoles.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

// ── Evaluate ──────────────────────────────────────────────────────────────────

const actor = resolveActor();
const roles = loadRoles();

// Opt-out mode: file missing or both arrays empty → all checks pass silently.
// Teams that have not configured roles get no friction, just no enforcement.
if (!roles ||
    ((roles.tech_leads || []).length === 0 &&
     (roles.security_officers || []).length === 0)) {
  process.stdout.write(JSON.stringify({
    allowed: true,
    actor,
    role: 'developer',
    reason: 'opt-out-mode',
    message: '.claude/ApprovalRoles.json is empty — role checks pass silently (opt-out mode).',
  }) + '\n');
  process.exit(0);
}

// Resolve actor's own role
let actorRole = 'developer';
if ((roles.tech_leads || []).includes(actor))         actorRole = 'tech_lead';
else if ((roles.security_officers || []).includes(actor)) actorRole = 'security_officer';

const field            = ROLE_FIELDS[requiredRole];
const authorisedActors = roles[field] || [];
const allowed          = authorisedActors.includes(actor);
const roleLabel        = ROLE_LABELS[requiredRole];

const actorList = authorisedActors.length > 0
  ? authorisedActors.join(', ')
  : `(no ${roleLabel}s configured in .claude/ApprovalRoles.json)`;

const message = allowed
  ? `Access granted — ${actor} is a ${roleLabel}.`
  : `This action requires a ${roleLabel}. Authorised: ${actorList}. Ask one to run this command in their session.`;

process.stdout.write(JSON.stringify({
  allowed,
  actor,
  role:              actorRole,
  required_role:     requiredRole,
  action,
  authorised_actors: authorisedActors,
  message,
}) + '\n');

process.exit(allowed ? 0 : 1);
