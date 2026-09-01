#!/usr/bin/env node
// hooks/context-budget-tech-write.cjs — PreToolUse Write hook
// Hard gate: blocks writes to ICEA/Tech Spec/architecture/graph files when content has
// too many unfilled template placeholders OR is too sparse (stub from context exhaustion).
// Exit 0 = allow, exit 2 = block (stderr shown to the model).

'use strict';
const fs   = require('fs');
const path = require('path');

// Best-effort governance-audit append — never blocks the gate.
function auditBlock(noun, filePath) {
  try { require('./audit-append.cjs').appendEvent({ event: 'gate.block', action: 'context-budget', path: filePath, result: 'blocked', source: 'PreToolUse', detail: noun }); } catch (e) { /* best-effort */ }
}

// DECISION: dispatch table — first match wins, enables per-type thresholds and force flags.
// Rejected: nested if/else — harder to extend, harder to test each rule independently.
const RULES = [
  {
    // Rule 1: temp tech spec (bug fix: old pattern ADO-\d+-.*-tech\.md had extra `-` preventing match)
    pattern:          /(?:^|\/)temp\/ADO-(\d+).*-tech\.md$/i,
    threshold:        15,
    minLines:         50,
    requiredSections: ['## Overview', '## AC Coverage Matrix', '## Files Changed', '## Test Cases'],
    label:            (id, _fp) => `temp/ADO-${id}-tech.md`,
    flagPath:  (id)      => `temp/ADO-${id}-tech-force.flag`,
    flagMode:  'single',
    recovery:  (id)      => `TECH ADO-${id}`,
    noun:      'Tech Spec draft',
  },
  {
    // Rule 2: permanent tech spec in docs/ (icea-revise writes here directly)
    pattern:          /(?:^|\/)docs\/Release[^/]*\/Sprint[^/]*\/UserStory[^/]*\/[^/]*\.techspec\.md$/i,
    threshold:        15,
    minLines:         50,
    requiredSections: ['## Overview', '## AC Coverage Matrix', '## Files Changed', '## Test Cases'],
    label:            (_id, fp) => path.basename(fp),
    flagPath:  (id)      => `temp/ADO-${id}-techspec-force.flag`,
    flagMode:  'single',
    recovery:  (id)      => `REVISE ADO-${id}`,
    noun:      'Tech Spec (docs)',
  },
  {
    // Rule 3: temp ICEA draft
    pattern:   /(?:^|\/)temp\/ADO-(\d+).*-icea\.md$/i,
    threshold: 10,
    minLines:  30,
    label:     (id, _fp) => `temp/ADO-${id}-icea.md`,
    flagPath:  (id)      => `temp/ADO-${id}-icea-force.flag`,
    flagMode:  'single',
    recovery:  (id)      => `ICEA ADO-${id}`,
    noun:      'ICEA draft',
  },
  {
    // Rule 4: permanent ICEA in docs/ (icea-revise writes here directly)
    pattern:   /(?:^|\/)docs\/Release[^/]*\/Sprint[^/]*\/UserStory[^/]*\/[^/]*\.icea\.md$/i,
    threshold: 10,
    minLines:  30,
    label:     (_id, fp) => path.basename(fp),
    flagPath:  (id)      => `temp/ADO-${id}-icea-docs-force.flag`,
    flagMode:  'single',
    recovery:  (id)      => `REVISE ADO-${id}`,
    noun:      'ICEA (docs)',
  },
  {
    // Rule 5: architecture files — architect writes up to 8 files in sequence.
    //         Time-bounded flag covers full batch; single-use would need 8 developer actions.
    pattern:   /(?:^|\/)\.claude\/architecture\/[^/]+\.md$/i,
    threshold: 10,
    minLines:  20,
    label:     (_id, fp) => path.basename(fp),
    flagPath:  ()        => 'temp/arch-force.flag',
    flagMode:  'timed',
    recovery:  ()        => 'IMPLEMENT ADO-{ID}  (architect step)',
    noun:      'Architecture file',
  },
  {
    // Rule 6: graph markdown files — graph-sync writes N module files in sequence.
    //         Time-bounded flag covers full batch.
    //         No minLines — auto-generated structured files can be legitimately short.
    pattern:   /(?:^|\/)\.claude\/graph\/[^/]+\.md$/i,
    threshold: 5,
    label:     (_id, fp) => path.basename(fp),
    flagPath:  ()        => 'temp/graph-force.flag',
    flagMode:  'timed',
    recovery:  ()        => 'IMPLEMENT ADO-{ID}  (graph-sync step)',
    noun:      'Graph file',
  },
];

const FORCE_FLAG_TTL_MS = 10 * 60 * 1000; // 10 minutes

function countPlaceholders(content) {
  let count = 0, inCodeBlock = false;
  for (const line of content.split('\n')) {
    if (line.startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;
    if (line.includes('❓')) continue;
    const matches = line.match(/\{[A-Za-z][^}\n]{1,60}\}/g);
    if (matches) count += matches.length;
  }
  return count;
}

function countNonEmptyLines(content) {
  return content.split('\n').filter(l => l.trim().length > 0).length;
}

function checkRequiredSections(content, requiredSections) {
  const lines = new Set(content.split('\n').map(l => l.trim()));
  return requiredSections.filter(s => !lines.has(s));
}

function checkForceFlag(flagPath, flagMode) {
  if (!fs.existsSync(flagPath)) return false;
  if (flagMode === 'single') {
    try { fs.unlinkSync(flagPath); } catch (_) { /* best-effort */ }
    return true;
  }
  // timed: flag stays on disk; validate age against TTL
  try {
    const stat = fs.statSync(flagPath);
    if (Date.now() - stat.mtimeMs <= FORCE_FLAG_TTL_MS) return true;
    try { fs.unlinkSync(flagPath); } catch (_) { /* best-effort */ }
    return false;
  } catch (_) { return false; }
}

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let filePath = '';
  let content  = '';
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    filePath = (payload.tool_input?.file_path ?? '').replace(/\\/g, '/');
    content  = payload.tool_input?.content ?? '';
  } catch (e) { process.exit(0); }

  let matched = null;
  let adoId   = 'unknown';
  for (const rule of RULES) {
    const m = filePath.match(rule.pattern);
    if (m) {
      matched = rule;
      adoId   = m[1] ?? 'unknown';
      break;
    }
  }
  if (!matched) process.exit(0);

  // Rules 2/4 (docs paths): ADO ID is in the filename, not a capture group in the pattern
  if (adoId === 'unknown') {
    const idMatch = filePath.match(/ADO-(\d+)/i);
    if (idMatch) adoId = idMatch[1];
  }

  const flagPath = matched.flagPath(adoId);
  if (checkForceFlag(flagPath, matched.flagMode)) process.exit(0);

  const placeholderCount = countPlaceholders(content);
  const label    = matched.label(adoId, filePath);
  const recovery = matched.recovery(adoId);
  const noun     = matched.noun;
  const flagNote = matched.flagMode === 'timed'
    ? `Write ${flagPath} to set a 10-minute bypass window.`
    : `Write ${flagPath} to bypass this gate once.`;

  // Gate 1: too many unfilled template placeholders
  if (placeholderCount > matched.threshold) {
    process.stderr.write(
      `⛔ CONTEXT GATE — ${noun} write blocked (${placeholderCount} unfilled sections)\n` +
      `\n` +
      `${label} has ${placeholderCount} unfilled template placeholders — it is a scaffold,\n` +
      `not a derived document. Context was exhausted before the source could be fully derived.\n` +
      `\n` +
      `Options:\n` +
      `  Option A — /compact  (recommended — stay in this session)\n` +
      `             1. Run /compact in Claude Code\n` +
      `             2. Reply: ${recovery}\n` +
      `             Compresses earlier turns. Document re-derived from the saved source.\n` +
      `\n` +
      `  Option B — New session  (best quality)\n` +
      `             Source is safe on disk. Open a new session and run:\n` +
      `             ${recovery}\n` +
      `\n` +
      `  Option C — ${recovery} FORCE  (not recommended)\n` +
      `             ${flagNote}\n` +
      `             The document will be saved as-is with placeholder gaps.\n`
    );
    auditBlock(noun, filePath);
    process.exit(2);
  }

  // Gate 2: too sparse — context exhausted before the template was written at all
  if (matched.minLines) {
    const lineCount = countNonEmptyLines(content);
    if (lineCount < matched.minLines) {
      process.stderr.write(
        `⛔ CONTEXT GATE — ${noun} write blocked (content too sparse: ${lineCount} lines)\n` +
        `\n` +
        `${label} has only ${lineCount} non-empty lines — it is a stub, not a derived document.\n` +
        `Context was exhausted before the template could be populated.\n` +
        `\n` +
        `Options:\n` +
        `  Option A — /compact  (recommended — stay in this session)\n` +
        `             1. Run /compact in Claude Code\n` +
        `             2. Reply: ${recovery}\n` +
        `             Compresses earlier turns. Document re-derived from the saved source.\n` +
        `\n` +
        `  Option B — New session  (best quality)\n` +
        `             Source is safe on disk. Open a new session and run:\n` +
        `             ${recovery}\n` +
        `\n` +
        `  Option C — ${recovery} FORCE  (not recommended)\n` +
        `             ${flagNote}\n` +
        `             The document will be saved as-is with incomplete content.\n`
      );
      auditBlock(noun, filePath);
      process.exit(2);
    }
  }

  // Gate 3: missing required template sections
  if (matched.requiredSections) {
    const missing = checkRequiredSections(content, matched.requiredSections);
    if (missing.length > 0) {
      process.stderr.write(
        `⛔ CONTEXT GATE — ${noun} write blocked (missing ${missing.length} required section(s))\n` +
        `\n` +
        `${label} is missing required sections — context was exhausted before the full\n` +
        `template could be derived:\n` +
        missing.map(s => `  • ${s}`).join('\n') + '\n' +
        `\n` +
        `Options:\n` +
        `  Option A — /compact  (recommended — stay in this session)\n` +
        `             1. Run /compact in Claude Code\n` +
        `             2. Reply: ${recovery}\n` +
        `             Compresses earlier turns. Document re-derived from the saved source.\n` +
        `\n` +
        `  Option B — New session  (best quality)\n` +
        `             Source is safe on disk. Open a new session and run:\n` +
        `             ${recovery}\n` +
        `\n` +
        `  Option C — ${recovery} FORCE  (not recommended)\n` +
        `             ${flagNote}\n` +
        `             The document will be saved with missing sections.\n`
      );
      auditBlock(noun, filePath);
      process.exit(2);
    }
  }

  process.exit(0);
});