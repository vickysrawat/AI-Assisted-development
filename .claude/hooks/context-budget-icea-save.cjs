#!/usr/bin/env node
// hooks/context-budget-icea-save.cjs — UserPromptSubmit hook
// Fires before Claude processes SAVE ICEA, SAVE TECH, or REVISE commands.
// Injects a context budget warning when session depth puts output quality at risk.
// Exit 0 always — this hook warns but never blocks (the Write gate enforces).

'use strict';
const fs   = require('fs');
const path = require('path');

if (!fs.existsSync('.claude/dream-init-state.json')) process.exit(0);

const LINE_THRESHOLD_MEDIUM = 150;
const LINE_THRESHOLD_HIGH   = 350;
const TECH_GATE_THRESHOLD   = 15; // must match context-budget-tech-write.cjs

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

function findIceaInDocs(adoId) {
  const docsDir = 'docs';
  if (!fs.existsSync(docsDir)) return null;
  function search(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        const found = search(full);
        if (found) return found;
      } else if (entry.isFile() && entry.name.includes(`ADO-${adoId}`) && entry.name.endsWith('.icea.md')) {
        return full;
      }
    }
    return null;
  }
  return search(docsDir);
}

function buildWarning({ command, risk, metricLabel, isHigh, afterNote, gateNote }) {
  return [
    `⚠ CONTEXT BUDGET — ${command}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Risk: ${risk} — ${metricLabel}`,
    ``,
    isHigh
      ? `Context is likely exhausted. The output may be a stub or structurally incorrect.`
      : `Context may be partially exhausted. The output may have gaps.`,
    ``,
    afterNote,
    ``,
    gateNote,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
}

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let userMessage = '';
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    userMessage = payload.message ?? payload.prompt ?? '';
  } catch (e) { process.exit(0); }

  let warning = null;

  // --- SAVE ICEA ---
  const saveIceaMatch = userMessage.match(/SAVE\s+ICEA\s+ADO-?(\d+)/i);
  if (saveIceaMatch) {
    const adoId    = saveIceaMatch[1];
    const tempIcea = `temp/ADO-${adoId}-icea.md`;
    if (!fs.existsSync(tempIcea)) process.exit(0);
    let lines = 0;
    try { lines = fs.readFileSync(tempIcea, 'utf8').split('\n').length; } catch (e) { process.exit(0); }
    if (lines < LINE_THRESHOLD_MEDIUM) process.exit(0);
    const isHigh = lines > LINE_THRESHOLD_HIGH;
    warning = buildWarning({
      command:     `SAVE ICEA ADO-${adoId}`,
      risk:        isHigh ? '🔴 High' : '🟡 Medium',
      metricLabel: `ICEA draft is ${lines} lines`,
      isHigh,
      afterNote:   `After SAVE ICEA completes, choose one of:\n` +
                   `  /compact  →  TECH ADO-${adoId}    (stay in this session — recommended)\n` +
                   `  New session  →  TECH ADO-${adoId}  (cleanest result)`,
      gateNote:    `Note: a hard Write gate will block the Tech Spec if it has more than ${TECH_GATE_THRESHOLD} unfilled sections.`,
    });
  }

  // --- SAVE TECH ---
  if (!warning) {
    const saveTechMatch = userMessage.match(/SAVE\s+TECH\s+ADO-?(\d+)/i);
    if (saveTechMatch) {
      const adoId    = saveTechMatch[1];
      const tempTech = `temp/ADO-${adoId}-tech.md`;
      if (!fs.existsSync(tempTech)) process.exit(0);
      let count = 0;
      try { count = countPlaceholders(fs.readFileSync(tempTech, 'utf8')); } catch (e) { process.exit(0); }
      if (count <= TECH_GATE_THRESHOLD) process.exit(0);
      warning = buildWarning({
        command:     `SAVE TECH ADO-${adoId}`,
        risk:        '🔴 High',
        metricLabel: `Tech Spec has ${count} unfilled template sections`,
        isHigh:      true,
        afterNote:   `SAVE TECH will be blocked by the hard Write gate (${count} > ${TECH_GATE_THRESHOLD} threshold).\n` +
                     `Options:\n` +
                     `  /compact  →  TECH ADO-${adoId}    (re-derive from saved ICEA — recommended)\n` +
                     `  New session  →  TECH ADO-${adoId}  (full context budget — cleanest result)`,
        gateNote:    `The Write gate will block the save. Run TECH ADO-${adoId} in a fresh context to fix.`,
      });
    }
  }

  // --- REVISE ---
  if (!warning) {
    const reviseMatch = userMessage.match(/REVISE\s+ADO-?(\d+)/i);
    if (reviseMatch) {
      const adoId    = reviseMatch[1];
      const iceaPath = findIceaInDocs(adoId);
      if (!iceaPath) process.exit(0);
      let lines = 0;
      try { lines = fs.readFileSync(iceaPath, 'utf8').split('\n').length; } catch (e) { process.exit(0); }
      if (lines < LINE_THRESHOLD_MEDIUM) process.exit(0);
      const isHigh = lines > LINE_THRESHOLD_HIGH;
      warning = buildWarning({
        command:     `REVISE ADO-${adoId}`,
        risk:        isHigh ? '🔴 High' : '🟡 Medium',
        metricLabel: `ICEA is ${lines} lines (${path.basename(iceaPath)})`,
        isHigh,
        afterNote:   `Revision rewrites the ICEA and re-derives the Tech Spec — both need full context.\n` +
                     `Recommended: /compact first, then reply REVISE ADO-${adoId}.`,
        gateNote:    `Note: the hard Write gate will block revised ICEA or Tech Spec saves with more than ${TECH_GATE_THRESHOLD} unfilled sections.`,
      });
    }
  }

  if (!warning) process.exit(0);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: warning }
  }) + '\n');
});
