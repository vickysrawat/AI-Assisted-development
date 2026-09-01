#!/usr/bin/env node
// hooks/audit-prompt.cjs — UserPromptSubmit hook: governance-verb audit + skip-icea justification
//
// Fires on every user message. Deterministically records the SANCTIONED governance verbs that
// are otherwise model-driven prose (APPROVE / APPROVE ALL / REVOKE ALL / SAVE … ACCEPT /
// migration-stage approvals / skip-icea) — the model cannot "forget" to log them. These are
// INTENT signals (result:"requested"): the same string may be a mention or an unhonored
// request, so they carry less evidentiary weight than deterministic gate.* events. Raw prompt
// text is never stored — only the matched action, the ADO id, and (for skip-icea) the supplied
// justification, all redacted + capped by audit-append.
//
// Also enforces the skip-icea justification ask: if /skip-icea arrives with no reason, inject
// context telling the model to ask for one before proceeding.
//
// Guard: only active when .claude/dream-init-state.json exists (same as the other
// UserPromptSubmit hooks). Non-blocking — always exit 0.

'use strict';
const fs   = require('fs');
const path = require('path');
if (!fs.existsSync('.claude/dream-init-state.json')) process.exit(0);

let append = () => false;
try { append = require(path.join(__dirname, 'audit-append.cjs')).appendEvent; }
catch (e) { /* logging degrades to no-op; the skip-icea ask below still runs */ }

// Ordered governance-verb rules. Each maps a prompt match to one audit event.
// The plain-APPROVE pattern needs no exclusion: "APPROVE ALL ADO" / "APPROVE OPTIONS ADO" do
// not contain the substring "APPROVE ADO", so they never collide with it.
const RULES = [
  { re: /\bAPPROVE\s+ALL\s+ADO-?(\w+)/i, event: 'gate.bypass',  action: 'APPROVE ALL' },
  { re: /\bREVOKE\s+ALL\s+ADO-?(\w+)/i,  event: 'gate.bypass',  action: 'REVOKE ALL' },
  { re: /\bAPPROVE\s+(OPTIONS|INVENTORY|ARCHITECTURE|FEASIBILITY|MIGRATION)\s+ADO-?(\w+)/i,
    event: 'gate.approve', action: m => 'APPROVE ' + m[1].toUpperCase(), adoIdx: 2 },
  { re: /\bSAVE\s+(ICEA|TECH)\s+ADO-?(\w+)[^\n]*\bACCEPT\b/i,
    event: 'gate.bypass',  action: m => 'SAVE ' + m[1].toUpperCase() + ' ACCEPT', adoIdx: 2 },
  { re: /\bAPPROVE\s+ADO-?(\w+)/i,       event: 'gate.approve', action: 'APPROVE' },
];

function readPrompt() {
  try {
    const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
    return payload.message ?? payload.prompt ?? '';
  } catch (e) { return ''; }
}

const prompt = readPrompt();
if (!prompt) process.exit(0);

for (const rule of RULES) {
  const m = prompt.match(rule.re);
  if (!m) continue;
  append({
    event:  rule.event,
    action: typeof rule.action === 'function' ? rule.action(m) : rule.action,
    ado:    m[rule.adoIdx || 1],
    result: 'requested',
    source: 'UserPromptSubmit',
  });
}

// skip-icea — Feature-Gate bypass. Log intent, and demand a justification when none is given.
const skip = prompt.match(/(?:^|\s)\/?skip-icea\b[:\s]*["']?([^"'\n]*)["']?/i);
if (skip) {
  const justification = (skip[1] || '').trim();
  append({
    event:  'gate.bypass',
    action: 'skip-icea',
    result: 'requested',
    source: 'UserPromptSubmit',
    detail: justification || '(no justification provided)',
  });
  if (!justification) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext:
          '⚠ /skip-icea requires a justification. Before honoring the Feature-Gate skip, ask the ' +
          'developer why the ICEA is being skipped and do NOT proceed until they answer. Once given, ' +
          'the skip is recorded in the audit trail (skills/icea-feature logs the outcome).',
      },
    }) + '\n');
  }
}

process.exit(0);
