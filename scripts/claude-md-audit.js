#!/usr/bin/env node
// ai-assisted-development — CLAUDE.md size advisory (read-only)
//
// Measures a project CLAUDE.md, classifies each section as GOVERNANCE (always-active —
// must stay) or MOVABLE (reference/config/project prose that could live in a rule, doc, or
// skill), and prints an advisory ONLY when the file exceeds the budget AND there is
// meaningful movable content. Never edits the file. Used by setup-init and dream-health.
//
// Usage: node claude-md-audit.js [--file ./CLAUDE.md] [--budget 200]

const fs = require('fs');

function argVal(name, def) { const i = process.argv.indexOf(name); return (i >= 0 && i + 1 < process.argv.length) ? process.argv[i + 1] : def; }
const FILE   = argVal('--file', './CLAUDE.md');
// Default budget rationale (adherence, not context-window capacity):
// skills/shared/claude-md-budget-spec.md · ADR docs/adr/0040-claude-md-context-budget.md
const BUDGET = parseInt(argVal('--budget', '200'), 10);
const MIN_MOVABLE = 30; // stay quiet unless at least this many movable lines

let text;
try { text = fs.readFileSync(FILE, 'utf8'); } catch (e) { process.exit(0); } // no CLAUDE.md → nothing to advise
const lines = text.split('\n');
const total = lines.length;

// Governance sections must stay in CLAUDE.md (always-active; a paths-scoped rule would not fire).
const GOVERNANCE = [/^## 0\. WRITE GATE/, /^## 0a\. Keyword Handlers/, /^## 0b\. Shell/, /^## Feature Gate/, /^## Data Access Convention/];
// Neutral header/metadata lines — not movable, not governance.
const NEUTRAL = [/^# CLAUDE\.md/, /^# Stack/, /^# Last updated/, /^# Plugin version:/, /^#\s/];
// Suggested destination for known movable sections (else a generic hint).
function target(heading) {
  if (/DESIGN PHILOSOPHY/i.test(heading)) return 'rules/project-rules.md (loaded on every file edit)';
  if (/MODEL ROUTING/i.test(heading))     return 'skills/shared/model-routing-spec.md';
  if (/^# Dream/.test(heading))           return 'skills/shared/dream-reference.md';
  if (/PROJECT OVERVIEW/i.test(heading))  return 'trim to 2–3 lines or an onboarding doc';
  if (/AZURE DEVOPS/i.test(heading))      return 'keep the config fields; move guidance to a doc';
  return '.claude/rules/<stack>-rules.md (conventions), a topic doc, or a skill';
}

// Split into classified sections at ## headings and the # Dream heading.
function isSectionStart(l) { return /^## /.test(l) || /^# Dream/.test(l); }
const sections = [];
let cur = null;
for (const l of lines) {
  if (isSectionStart(l)) { cur = { heading: l, count: 1 }; sections.push(cur); }
  else if (cur) cur.count++;
}

let govLines = 0, movable = [];
for (const s of sections) {
  const gov = GOVERNANCE.some(re => re.test(s.heading));
  const neutral = NEUTRAL.some(re => re.test(s.heading)) && !/^# Dream/.test(s.heading);
  if (gov || neutral) { govLines += s.count; }
  else movable.push(s);
}
const movableLines = movable.reduce((n, s) => n + s.count, 0);

if (total <= BUDGET || movableLines < MIN_MOVABLE) {
  // Lean enough, or nothing meaningful to move — stay quiet.
  process.exit(0);
}

console.log('  ⚠ CLAUDE.md is ' + total + ' lines (budget ~' + BUDGET + '). It is loaded whole every');
console.log('    session, so trimming it lowers per-session token cost. Governance stays put;');
console.log('    consider moving these ' + movableLines + ' movable lines out (never the WRITE GATE,');
console.log('    Keyword Handlers, Shell/Git, or Feature Gate):');
for (const s of movable.sort((a, b) => b.count - a.count)) {
  const h = s.heading.replace(/^#+\s*/, '').slice(0, 40);
  console.log('      • ' + h + '  (' + s.count + ' lines) → ' + target(s.heading));
}
