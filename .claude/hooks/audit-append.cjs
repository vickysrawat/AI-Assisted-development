#!/usr/bin/env node
// hooks/audit-append.cjs — shared governance-audit append helper (pure Node.js)
//
// Single choke point for the governance audit trail. Writes ONE JSON event per line to a
// per-day, per-process shard: .claude/audit/<YYYY-MM-DD>-<pid>.jsonl. Sharding avoids
// cross-branch git merge conflicts and concurrent-append corruption (several hooks may fire
// on one tool call). Best-effort and NON-BLOCKING: every failure is swallowed so auditing
// can never break a gate or a commit.
//
// Two entry points:
//   • module:  require('./audit-append').appendEvent({ event, action, ... })
//   • CLI:     node .claude/hooks/audit-append.cjs '<json-object>'
//              The .sh / .ps1 guard-hook variants cannot require() a Node module, so they
//              spawn this CLI form instead.
//
// Identity is recorded as ALL available signals plus an explicit actor_confidence, because no
// single signal is trustworthy everywhere: the OS login is a service account in containers/CI,
// git email is self-asserted, and the PAT-verified ADO identity is often absent. An auditor
// judges trust from actor_confidence rather than a single, falsely-certain "who".

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const AUDIT_DIR  = path.join('.claude', 'audit');
const DETAIL_MAX = 500;

// Value shapes that are almost certainly a live credential — kept byte-aligned with
// check-settings-secrets.cjs SECRET_VALUE_RES. `detail` is redacted against these so a
// justification or context string can never leak a credential into permanent git history.
const SECRET_VALUE_RES = [
  /\b[a-z2-7]{52}\b/,                                                 // Azure DevOps PAT
  /\bghp_[A-Za-z0-9]{36}\b/,                                          // GitHub PAT (classic)
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/,                                 // GitHub PAT (fine-grained)
  /\bAKIA[0-9A-Z]{16}\b/,                                             // AWS access key id
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,                                 // Slack token
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,  // JWT
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,           // private key block
];

// Usernames that are NOT a person — containers, CI agents, build/service accounts.
const NON_PERSON_USERS = new Set([
  'root', 'node', 'vscode', 'runner', 'vsts', 'ci', 'jenkins', 'builder', 'build',
  'azureuser', 'containeradministrator', 'administrator', 'system', 'ubuntu', 'devcontainer',
]);

function redact(s) {
  if (s == null) return '';
  let out = String(s).replace(/[\r\n]+/g, ' ');
  for (const re of SECRET_VALUE_RES) out = out.replace(new RegExp(re.source, 'g'), '[REDACTED]');
  if (out.length > DETAIL_MAX) out = out.slice(0, DETAIL_MAX) + '…';
  return out;
}

function readSessionContext() {
  try {
    const p = path.join('.claude', 'session-context.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { /* ignore — cache is optional */ }
  return {};
}

function osUser() {
  try {
    const name   = os.userInfo().username || process.env.USERNAME || process.env.USER || '';
    const domain = process.env.USERDOMAIN || '';
    return domain ? `${domain}\\${name}` : name;
  } catch (e) {
    return process.env.USERNAME || process.env.USER || '';
  }
}

function gitEmail(ctx) {
  if (ctx.git_email) return ctx.git_email;   // prefer the session cache — no subprocess per event
  try {
    return execFileSync('git', ['config', 'user.email'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) { return ''; }
}

function resolveIdentity() {
  const ctx            = readSessionContext();
  const os_user        = osUser();
  const git_email      = gitEmail(ctx);
  const verified_actor = ctx.verified_actor || ctx.principal_name || ctx.upn || '';

  // DECISION: how to express attribution trust
  // Options considered:
  //   A) a single "actor" field — rejected: implies a certainty we do not have (OS login is a
  //      service account in containers/CI; git email is self-asserted config).
  //   B) record every signal + an explicit confidence tier — chosen: the auditor judges trust
  //      from actor_confidence, and no signal is silently promoted to "the person".
  let actor_confidence;
  const bareUser = String(os_user).split('\\').pop().toLowerCase();
  if (verified_actor)                                    actor_confidence = 'verified';
  else if (os_user && !NON_PERSON_USERS.has(bareUser))  actor_confidence = 'os-workstation';
  else if (git_email)                                   actor_confidence = 'git-only';
  else                                                  actor_confidence = 'unresolved';

  return { os_user, git_email, verified_actor, actor_confidence };
}

// Append one governance event. `evt` may override any identity field (used by the ADO-PR
// reconcile, whose "who" is the real lead/product approver, not the local user).
function appendEvent(evt) {
  try {
    if (!evt || typeof evt !== 'object') return false;
    const ts    = new Date().toISOString();
    const shard = ts.slice(0, 10) + '-' + process.pid;
    const id    = resolveIdentity();

    const record = { ts, event: evt.event || 'unknown' };
    // Optional, only-if-present event fields (keeps lines lean and queryable).
    for (const k of ['action', 'ado', 'result', 'source', 'path', 'repo', 'vote']) {
      if (evt[k] != null) record[k] = String(evt[k]);
    }
    if (evt.pr_id    != null) record.pr_id    = evt.pr_id;
    if (evt.verified != null) record.verified = !!evt.verified;
    if (evt.detail   != null) record.detail   = redact(evt.detail);

    // Identity: caller-provided values win over auto-resolved (ADO-PR approver override).
    record.os_user          = evt.os_user          != null ? String(evt.os_user)          : id.os_user;
    record.git_email        = evt.git_email        != null ? String(evt.git_email)        : id.git_email;
    record.verified_actor   = evt.verified_actor   != null ? String(evt.verified_actor)   : id.verified_actor;
    record.actor_confidence = evt.actor_confidence != null ? String(evt.actor_confidence) : id.actor_confidence;
    record.shard            = shard;

    fs.mkdirSync(AUDIT_DIR, { recursive: true });
    fs.appendFileSync(path.join(AUDIT_DIR, shard + '.jsonl'), JSON.stringify(record) + '\n');
    return true;
  } catch (e) {
    return false;   // best-effort: auditing must never break a gate or a commit
  }
}

function mainCli() {
  const arg = process.argv[2];
  let evt = {};
  try {
    evt = JSON.parse(arg && arg !== '-' ? arg : (fs.readFileSync(0, 'utf8') || '{}'));
  } catch (e) { process.exit(0); }   // malformed input → no-op, never fail the caller
  appendEvent(evt);
  process.exit(0);
}

if (require.main === module) mainCli();
module.exports = { appendEvent, resolveIdentity, redact };
