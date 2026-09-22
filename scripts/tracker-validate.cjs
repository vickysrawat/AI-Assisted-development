#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const EXIT = {
  OK: 0,
  MISSING_TRACKER: 2,
  INVALID_TRACKER: 3,
  STALE_TRACKER: 4,
  MISSING_ARTIFACT: 5,
  INVALID_LEDGER: 6,
};

function arg(name) {
  const value = process.argv.find(a => a.startsWith(`--${name}=`));
  return value ? value.slice(`--${name}=`.length) : null;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function parseTracker(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { status: 'missing', file: filePath || null, phase: null, nextAction: null, refs: [] };
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const phase = text.match(/^(?:Phase|Current phase|State)\s*:\s*(.+)$/im)?.[1]?.trim() || null;
  const nextAction = text.match(/^(?:Next action|Next)\s*:\s*(.+)$/im)?.[1]?.trim() || null;
  const refs = [];
  for (const line of text.split(/\r?\n/)) {
    for (const match of line.matchAll(/(?:\.\.?\/|\/)?(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+/g)) {
      refs.push(match[0]);
    }
  }
  return { status: 'ok', file: filePath, phase, nextAction, refs, text };
}

function parseLedger(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { status: 'missing', file: filePath || null, stage_gates: {}, phase_history: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      status: 'ok', file: filePath,
      stage_gates: parsed.stage_gates || {},
      phase_history: Array.isArray(parsed.phase_history) ? parsed.phase_history : [],
    };
  } catch (error) {
    return { status: 'invalid', file: filePath, error: error.message };
  }
}

function getLatestLedgerPhase(ledger) {
  const history = Array.isArray(ledger.phase_history) ? ledger.phase_history : [];
  return history.length ? history[history.length - 1]?.phase || null : null;
}

function getUnresolvedGate(ledger) {
  for (const [name, verdict] of Object.entries(ledger.stage_gates || {})) {
    if (['REVISE', 'BLOCK', 'PENDING', 'NOT_STARTED'].includes(String(verdict))) return name;
  }
  return null;
}

function assertTrackerMatchesLedger(tracker, ledger) {
  if (tracker.status === 'missing') return { exit: EXIT.MISSING_TRACKER, ok: false, reason: 'Tracker file not found.' };
  if (!tracker.phase && !tracker.nextAction) return { exit: EXIT.INVALID_TRACKER, ok: false, reason: 'Tracker is missing required Phase or Next action fields.' };
  if (ledger.status === 'missing') return { exit: EXIT.INVALID_LEDGER, ok: false, reason: 'Ledger file is missing.' };
  if (ledger.status === 'invalid') return { exit: EXIT.INVALID_LEDGER, ok: false, reason: `Ledger parse failed: ${ledger.error}` };

  const unresolvedGate = getUnresolvedGate(ledger);
  const latestPhase = getLatestLedgerPhase(ledger);
  const phase = normalizeText(tracker.phase);
  const next = normalizeText(tracker.nextAction);

  if (unresolvedGate && /complete|done|finished|closed/.test(phase)) {
    return { exit: EXIT.STALE_TRACKER, ok: false, reason: `Tracker declares completion but ledger gate '${unresolvedGate}' is unresolved.` };
  }
  if (unresolvedGate && phase && !phase.includes(normalizeText(unresolvedGate)) && !/resolve|review|resume|continue/.test(phase)) {
    return { exit: EXIT.STALE_TRACKER, ok: false, reason: `Tracker phase '${tracker.phase}' does not reflect unresolved gate '${unresolvedGate}'.` };
  }
  if (unresolvedGate && next && !next.includes(normalizeText(unresolvedGate)) && !/resolve|review|resume|re run|continue/.test(next)) {
    return { exit: EXIT.STALE_TRACKER, ok: false, reason: `Tracker next action '${tracker.nextAction}' does not reflect unresolved gate '${unresolvedGate}'.` };
  }
  if (latestPhase && phase && !phase.includes(normalizeText(latestPhase)) && !/resume|next step|continue/.test(phase)) {
    return { exit: EXIT.STALE_TRACKER, ok: false, reason: `Tracker phase '${tracker.phase}' does not match latest ledger phase '${latestPhase}'.` };
  }

  for (const ref of tracker.refs) {
    if (/^https?:\/\//.test(ref)) continue;
    const target = path.resolve(path.dirname(tracker.file), ref);
    if ((ref.includes('/') || ref.includes('\\') || ref.startsWith('.')) && !fs.existsSync(target)) {
      return { exit: EXIT.MISSING_ARTIFACT, ok: false, reason: `Tracker references missing artifact '${ref}'.` };
    }
  }
  return { exit: EXIT.OK, ok: true, reason: 'Tracker is aligned with the ledger.' };
}

function main() {
  const trackerPath = arg('tracker');
  const ledgerPath = arg('ledger');
  const jsonOut = process.argv.includes('--json');
  if (!trackerPath || !ledgerPath) {
    const reason = 'usage: node scripts/tracker-validate.cjs --tracker=<path> --ledger=<path> [--json]';
    if (jsonOut) console.log(JSON.stringify({ ok: false, exit: 1, reason }, null, 2));
    else process.stderr.write(`${reason}\n`);
    process.exit(1);
  }
  const result = assertTrackerMatchesLedger(parseTracker(trackerPath), parseLedger(ledgerPath));
  if (jsonOut) console.log(JSON.stringify(result, null, 2));
  else console.log(`status: ${result.ok ? 'OK' : 'FAIL'}\nexit: ${result.exit}\nreason: ${result.reason}`);
  process.exit(result.exit);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    const result = { ok: false, exit: EXIT.INVALID_TRACKER, reason: error.message };
    if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else process.stderr.write(`error: ${error.message}\n`);
    process.exit(result.exit);
  }
}

module.exports = { EXIT, parseTracker, parseLedger, assertTrackerMatchesLedger, getUnresolvedGate, getLatestLedgerPhase, normalizeText };
