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
  return process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function readTracker(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { status: 'missing', file: filePath || null, phase: null, nextAction: null, refs: [] };
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);

  const phase = (() => {
    for (const line of lines) {
      const m = line.match(/^(?:Phase|Current phase|Current Phase|State|Status)\s*:\s*(.+)$/i);
      if (m) return m[1].trim();
    }
    return null;
  })();

  const nextAction = (() => {
    for (const line of lines) {
      const m = line.match(/^(?:Next action|Next Action|▶ Next|Next)\s*:\s*(.+)$/i);
      if (m) return m[1].trim();
    }
    return null;
  })();

  const refs = [];
  for (const line of lines) {
    const found = [...line.matchAll(/(?:\b(?:\.\.?\/|\/)?[A-Za-z0-9_./\\-]+\.[A-Za-z0-9_./\\-]+|\.\.\/|\.\/|(?:\.claude|docs|scripts|skills|tests|memory|contest|guides|commands|_project-deploy)[A-Za-z0-9_./\\-]*)/g)].map(m => m[0]);
    if (found.length) refs.push(...found);
  }

  return { status: 'ok', file: filePath, phase, nextAction, refs, text };
}

function readLedger(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { status: 'missing', file: filePath || null, stage_gates: {}, phase_history: [], skill: null };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      status: 'ok',
      file: filePath,
      stage_gates: parsed.stage_gates || {},
      phase_history: Array.isArray(parsed.phase_history) ? parsed.phase_history : [],
      skill: parsed.skill || null,
      ado_id: parsed.ado_id || null,
      source: parsed.source || {},
      payload: parsed.payload || {},
      raw: parsed,
    };
  } catch (error) {
    return { status: 'invalid', file: filePath, error: error.message };
  }
}

function latestLedgerPhase(ledger) {
  const history = Array.isArray(ledger.phase_history) ? ledger.phase_history : [];
  if (!history.length) return null;
  const last = history[history.length - 1];
  return last.phase || null;
}

function findUnresolvedGate(ledger) {
  const gates = ledger.stage_gates || {};
  for (const [name, verdict] of Object.entries(gates)) {
    if (verdict === 'REVISE' || verdict === 'BLOCK') return name;
  }
  return null;
}

function isPhaseCompleteLabel(label) {
  if (!label) return false;
  const norm = normalizeText(label);
  return /complete|done|finished|closed/.test(norm);
}

function hasIncompleteGate(ledger) {
  const gates = ledger.stage_gates || {};
  return Object.values(gates).some(v => v === 'REVISE' || v === 'BLOCK' || v === 'PENDING' || v === 'NOT_STARTED');
}

function checkTrackerAgainstLedger(tracker, ledger) {
  if (tracker.status === 'missing') {
    return { exit: EXIT.MISSING_TRACKER, ok: false, reason: 'Tracker file not found.' };
  }

  if (tracker.phase === null && tracker.nextAction === null) {
    return { exit: EXIT.INVALID_TRACKER, ok: false, reason: 'Tracker is missing required Phase or Next action fields.' };
  }

  if (ledger.status === 'missing') {
    return { exit: EXIT.INVALID_LEDGER, ok: false, reason: 'Ledger file missing or unreadable.' };
  }

  if (ledger.status === 'invalid') {
    return { exit: EXIT.INVALID_LEDGER, ok: false, reason: `Ledger parse failed: ${ledger.error}` };
  }

  const unresolvedGate = findUnresolvedGate(ledger);
  const latestPhase = latestLedgerPhase(ledger);
  const phaseLabel = (tracker.phase || '').trim();
  const nextLabel = (tracker.nextAction || '').trim();

  if (phaseLabel && isPhaseCompleteLabel(phaseLabel) && hasIncompleteGate(ledger)) {
    return {
      exit: EXIT.STALE_TRACKER,
      ok: false,
      reason: `Tracker says the phase is complete, but ledger still has unresolved gates: ${Object.entries(ledger.stage_gates).filter(([, v]) => ['REVISE', 'BLOCK', 'PENDING', 'NOT_STARTED'].includes(v)).map(([n]) => n).join(', ')}`,
    };
  }

  if (unresolvedGate) {
    const gateNorm = normalizeText(unresolvedGate);
    const phaseNorm = normalizeText(phaseLabel);
    const nextNorm = normalizeText(nextLabel);

    if (phaseNorm && !phaseNorm.includes(gateNorm) && !phaseNorm.includes('resolve') && !phaseNorm.includes('review')) {
      return {
        exit: EXIT.STALE_TRACKER,
        ok: false,
        reason: `Tracker phase '${phaseLabel}' does not reflect unresolved ledger gate '${unresolvedGate}'.`,
      };
    }

    if (nextNorm && !nextNorm.includes(gateNorm) && !nextNorm.includes('resolve') && !nextNorm.includes('re-run') && !nextNorm.includes('review')) {
      return {
        exit: EXIT.STALE_TRACKER,
        ok: false,
        reason: `Tracker next action '${nextLabel}' does not reflect unresolved ledger gate '${unresolvedGate}'.`,
      };
    }
  }

  if (latestPhase && phaseLabel) {
    const phaseNorm = normalizeText(phaseLabel);
    const latestPhaseNorm = normalizeText(latestPhase);
    if (phaseNorm && latestPhaseNorm && !phaseNorm.includes(latestPhaseNorm) && !phaseNorm.includes('resume') && !phaseNorm.includes('next step')) {
      return {
        exit: EXIT.STALE_TRACKER,
        ok: false,
        reason: `Tracker phase '${phaseLabel}' does not match the latest ledger phase '${latestPhase}'.`,
      };
    }
  }

  for (const ref of tracker.refs) {
    const candidate = ref.trim();
    if (!candidate || /^https?:\/\//.test(candidate)) continue;
    const resolved = path.resolve(path.dirname(tracker.file), candidate);
    if (candidate.includes('..') || candidate.startsWith('.') || candidate.includes('/') || candidate.includes('\\')) {
      if (!fs.existsSync(resolved)) {
        return {
          exit: EXIT.MISSING_ARTIFACT,
          ok: false,
          reason: `Tracker references missing artifact '${candidate}'.`,
        };
      }
    }
  }

  return { exit: EXIT.OK, ok: true, reason: 'Tracker is aligned with the ledger.' };
}

function main() {
  const trackerPath = arg('tracker');
  const ledgerPath = arg('ledger');
  const jsonOut = process.argv.includes('--json');

  if (!trackerPath || !ledgerPath) {
    const usage = 'usage: node scripts/tracker-validate.cjs --tracker=<path> --ledger=<path> [--json]';
    if (jsonOut) {
      process.stdout.write(JSON.stringify({ ok: false, exit: 1, error: usage }, null, 2) + '\n');
    } else {
      process.stderr.write(`${usage}\n`);
    }
    process.exit(1);
  }

  const tracker = readTracker(trackerPath);
  const ledger = readLedger(ledgerPath);
  const result = checkTrackerAgainstLedger(tracker, ledger);

  if (jsonOut) {
    process.stdout.write(JSON.stringify({
      ok: result.ok,
      exit: result.exit,
      reason: result.reason,
      tracker: tracker.file,
      ledger: ledger.file,
      phase: tracker.phase,
      next_action: tracker.nextAction,
      resolved_gate: findUnresolvedGate(ledger),
      latest_ledger_phase: latestLedgerPhase(ledger),
    }, null, 2) + '\n');
  } else {
    const status = result.ok ? 'OK' : 'FAIL';
    process.stdout.write(`status: ${status}\n`);
    process.stdout.write(`exit: ${result.exit}\n`);
    process.stdout.write(`reason: ${result.reason}\n`);
    if (tracker.phase) process.stdout.write(`phase: ${tracker.phase}\n`);
    if (tracker.nextAction) process.stdout.write(`next_action: ${tracker.nextAction}\n`);
    if (findUnresolvedGate(ledger)) process.stdout.write(`ledger_unresolved_gate: ${findUnresolvedGate(ledger)}\n`);
    if (latestLedgerPhase(ledger)) process.stdout.write(`ledger_latest_phase: ${latestLedgerPhase(ledger)}\n`);
  }

  process.exit(result.exit);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.argv.includes('--json')) {
      process.stdout.write(JSON.stringify({ ok: false, exit: EXIT.INVALID_TRACKER, reason: error.message }, null, 2) + '\n');
    } else {
      process.stderr.write(`error: ${error.message}\n`);
    }
    process.exit(EXIT.INVALID_TRACKER);
  }
}

module.exports = {
  EXIT,
  readTracker,
  readLedger,
  checkTrackerAgainstLedger,
  findUnresolvedGate,
  latestLedgerPhase,
  normalizeText,
};
