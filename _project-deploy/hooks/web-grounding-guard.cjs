#!/usr/bin/env node
// hooks/web-grounding-guard.cjs — deterministic backstop for business-context regulatory grounding.
//
// The business-context grounding loop (skills/shared/business-context-grounding.md) spawns a
// context-isolated `bc-searcher` subagent that may call WebSearch/WebFetch to look up PUBLIC
// regulatory frameworks for a {domain, jurisdiction}. The hard guarantee — "no project/client
// data leaves the machine" — must not depend on the model honouring prose. This hook enforces it
// mechanically: project-level PreToolUse hooks fire for (and can block) subagent tool calls.
//
// Scope: only gates when in a GROUNDING context — either a grounding-session marker file is
// present (.claude/.bc-grounding-active) or the tool call comes from agent_type "bc-searcher".
// Outside a grounding context it does not interfere with general WebSearch/WebFetch use.
//
// In a grounding context it DENIES (exit 2) when:
//   1. the kill-switch is off (env BUSINESS_CONTEXT_GROUNDING ∈ off/0/false/seed-only), or
//   2. the query collides with a project identifier (entity/table/file/dir name from graph.json
//      / source tree), or
//   3. the query contains code/PII-shaped tokens (identifiers, long digit runs, emails, paths).
// Otherwise it allows (exit 0). Every decision is audit-logged best-effort.
//
// Modes:
//   --hook            Read a Claude Code PreToolUse JSON on stdin. Exit 2 to block, 0 to allow.
//   --check "<text>"  Manually evaluate a query string against the collision/shape rules
//                     (assumes a grounding context; for tests). Exit 2 on deny, 0 on allow.
//
// Wiring (in .claude/settings.json PreToolUse):
//   { "matcher": "WebSearch|WebFetch",
//     "hooks": [{ "type": "command", "command": "node .claude/hooks/web-grounding-guard.cjs --hook" }] }

'use strict';

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────────────
const MARKER = path.join('.claude', '.bc-grounding-active');
const GRAPH = path.join('.claude', 'graph', 'graph.json');

function killSwitchOff() {
  const v = String(process.env.BUSINESS_CONTEXT_GROUNDING || '').trim().toLowerCase();
  return v === 'off' || v === '0' || v === 'false' || v === 'seed-only' || v === 'seed';
}

function inGroundingContext(input) {
  if (String(input.agent_type || '') === 'bc-searcher') return true;
  try { return fs.existsSync(MARKER); } catch (e) { return false; }
}

// ── Project vocabulary (identifier-collision signal) ────────────────────────────────────
// Build a set of lowercase project-identifier tokens (len >= 4) from graph.json node names /
// ids / file basenames. This is the strong "project data in a query" signal.
function projectVocab() {
  const vocab = new Set();
  const add = (s) => {
    if (!s) return;
    // split camelCase / PascalCase / snake / kebab / path into word parts AND keep the whole
    String(s).split(/[\\/]/).forEach((seg) => {
      const base = seg.replace(/\.[A-Za-z0-9]+$/, ''); // strip extension
      if (base.length >= 4) vocab.add(base.toLowerCase());
      base.split(/(?<=[a-z0-9])(?=[A-Z])|[_\-\s]+/).forEach((w) => {
        if (w && w.length >= 4) vocab.add(w.toLowerCase());
      });
    });
  };
  try {
    const g = JSON.parse(fs.readFileSync(GRAPH, 'utf8'));
    const nodes = Array.isArray(g.nodes) ? g.nodes : (g.modules || []);
    for (const n of nodes) {
      add(n && (n.name || n.id || n.label));
      const files = (n && (n.files || n.keyFiles)) || [];
      if (Array.isArray(files)) files.forEach(add);
    }
  } catch (e) { /* no graph → collision check simply contributes nothing */ }
  // Drop tokens that are also common regulatory/English words to avoid false denials.
  const COMMON = new Set(['data','user','users','case','cases','client','clients','service',
    'services','model','models','order','orders','account','accounts','record','records',
    'payment','payments','health','patient','patients','domain','core','main','base','test',
    'tests','api','auth','name','date','status','type','types']);
  for (const c of COMMON) vocab.delete(c);
  return vocab;
}

// ── Shape denylist (code/PII-shaped tokens) ─────────────────────────────────────────────
const SHAPE_RES = [
  { name: 'camelCase/PascalCase identifier', re: /\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[A-Z][a-z]+[A-Z][A-Za-z0-9]*\b/ },
  { name: 'snake_case identifier',           re: /\b[a-z0-9]+_[a-z0-9_]+\b/ },
  { name: 'path separator',                  re: /[\\/][A-Za-z0-9_.]+[\\/]/ },
  { name: 'file extension',                  re: /\.[a-z]{2,4}\b(?<!\.gov|\.org|\.com|\.edu|\.net|\.int)/i },
  { name: 'email',                           re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { name: 'long digit run',                  re: /\b\d{6,}\b/ },
  { name: 'code punctuation',                re: /[{}()<>;=]|::|=>/ },
];

function evaluate(queryText) {
  const hits = [];
  const q = String(queryText || '');
  const lower = q.toLowerCase();

  // (1) identifier collision
  const vocab = projectVocab();
  const words = new Set((lower.match(/[a-z0-9]{4,}/g) || []));
  for (const w of words) {
    if (vocab.has(w)) hits.push(`query contains project identifier "${w}"`);
  }

  // (2) shape denylist
  for (const { name, re } of SHAPE_RES) {
    if (re.test(q)) hits.push(`query contains ${name}`);
  }
  return [...new Set(hits)];
}

// ── Extract the outgoing text from a tool_input ─────────────────────────────────────────
function queryFromInput(toolName, ti) {
  const parts = [];
  if (ti && typeof ti.query === 'string') parts.push(ti.query);        // WebSearch
  if (ti && typeof ti.url === 'string') parts.push(ti.url);            // WebFetch
  if (ti && typeof ti.prompt === 'string') parts.push(ti.prompt);      // WebFetch prompt
  return parts.join(' ‖ ');
}

function audit(result, detail) {
  try {
    require('./audit-append.cjs').appendEvent({
      event: 'gate.web-grounding', action: 'web-grounding-guard',
      result, source: 'PreToolUse', detail,
    });
  } catch (e) { /* best-effort */ }
}

function deny(reasons) {
  console.error('❌ web-grounding-guard: blocked an outbound grounding query.');
  for (const r of reasons) console.error('   • ' + r);
  console.error('');
  console.error('   Regulatory grounding queries may contain ONLY public domain/jurisdiction');
  console.error('   terms (framework, jurisdiction, category, year). Project identifiers, code,');
  console.error('   and PII must never leave the machine. See business-context-grounding.md.');
  audit('blocked', reasons.join('; '));
  return 2;
}

// ── Modes ───────────────────────────────────────────────────────────────────────────────
function readStdin() { try { return fs.readFileSync(0, 'utf8'); } catch (e) { return ''; } }

function runHook() {
  let input;
  try { input = JSON.parse(readStdin()); } catch (e) { return 0; }   // unparseable → allow
  const toolName = String(input.tool_name || input.toolName || '');
  if (!/^(WebSearch|WebFetch)$/.test(toolName)) return 0;            // not our tool → allow
  if (!inGroundingContext(input)) return 0;                          // not a grounding call → don't interfere

  if (killSwitchOff()) {
    return deny(['grounding is disabled (BUSINESS_CONTEXT_GROUNDING is off) — use the seed/locked table']);
  }
  const q = queryFromInput(toolName, input.tool_input || {});
  const reasons = evaluate(q);
  if (reasons.length) return deny(reasons);
  audit('allowed', 'query=' + q.slice(0, 200));
  return 0;
}

function runCheck(text) {
  const reasons = evaluate(text);
  if (reasons.length) { for (const r of reasons) console.error('DENY: ' + r); return 2; }
  console.log('ALLOW');
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--hook')) return runHook();
  const ci = argv.indexOf('--check');
  if (ci !== -1) return runCheck(argv[ci + 1] || readStdin());
  console.error('usage: web-grounding-guard.cjs --hook | --check "<query>"');
  return 0;
}

process.exit(main());
