#!/usr/bin/env node
// Deterministic migration tracker validator for A4.
// Validates a human-readable tracker against caller-derived ledger state.
// Read-only: never repairs, rewrites, or recreates either artifact.
'use strict';
const fs = require('fs');

const EXIT = {
  OK: 0,
  LEDGER_ABSENT: 7,
  LEDGER_INVALID: 10,
  ADO_MISMATCH: 11,
  SKILL_MISMATCH: 12,
  TRACKER_MISSING: 13,
  TRACKER_INVALID: 14,
  PHASE_MISMATCH: 15,
  NEXT_ACTION_MISMATCH: 16,
  GATE_MISMATCH: 17,
};

function readJson(file) {
  if (!fs.existsSync(file)) return { ok: false, code: EXIT.LEDGER_ABSENT, status: 'ledger-absent' };
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) return { ok: false, code: EXIT.LEDGER_INVALID, status: 'ledger-empty' };
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, code: EXIT.LEDGER_INVALID, status: 'ledger-invalid-structure' };
    }
    return { ok: true, value };
  } catch (error) {
    return { ok: false, code: EXIT.LEDGER_INVALID, status: 'ledger-malformed-json', error: error.message };
  }
}

function extractTracker(text) {
  if (!text || !text.trim()) return { ok: false, code: EXIT.TRACKER_INVALID, status: 'tracker-empty' };
  const phase = text.match(/^_Last updated:.*?· Phase:\s*([^·\n]+?)(?:\s*·|\s*$)/mi)?.[1]?.trim() || null;
  const nextMarker = text.match(/^## Next action\s*\n([\s\S]*?)(?=\n## |\n---|$)/mi);
  const nextAction = nextMarker?.[1]?.trim().replace(/\s+/g, ' ') || null;
  const gates = [...text.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(✅|🔄|⬜|⛔|🔁|🟡)[^|]*\|/gmi)]
    .map(match => ({ phase: match[1].trim(), status: match[3] }));
  if (!phase || !nextAction) return { ok: false, code: EXIT.TRACKER_INVALID, status: 'tracker-structure-invalid', phase, nextAction, gates };
  return { ok: true, phase, nextAction, gates };
}

function validateTracker({ ledgerFile, trackerFile, ado, skill, expectedPhase, expectedNextAction, expectedGate }) {
  const loaded = readJson(ledgerFile);
  if (!loaded.ok) return loaded;
  const ledger = loaded.value;
  if (ado && String(ledger.ado_id || '') !== String(ado)) {
    return { ok: false, code: EXIT.ADO_MISMATCH, status: 'ado-mismatch', expected: String(ado), actual: ledger.ado_id };
  }
  if (skill && String(ledger.skill || '').toLowerCase() !== String(skill).toLowerCase()) {
    return { ok: false, code: EXIT.SKILL_MISMATCH, status: 'skill-mismatch', expected: skill, actual: ledger.skill };
  }
  if (!fs.existsSync(trackerFile)) return { ok: false, code: EXIT.TRACKER_MISSING, status: 'tracker-missing' };
  const tracker = extractTracker(fs.readFileSync(trackerFile, 'utf8'));
  if (!tracker.ok) return tracker;
  if (expectedPhase && tracker.phase !== expectedPhase) {
    return { ok: false, code: EXIT.PHASE_MISMATCH, status: 'tracker-phase-mismatch', expected: expectedPhase, actual: tracker.phase };
  }
  if (expectedNextAction && tracker.nextAction !== expectedNextAction) {
    return { ok: false, code: EXIT.NEXT_ACTION_MISMATCH, status: 'tracker-next-action-mismatch', expected: expectedNextAction, actual: tracker.nextAction };
  }
  if (expectedGate) {
    const gate = tracker.gates.find(item => item.phase === expectedGate.phase);
    if (!gate || gate.status !== expectedGate.status) {
      return { ok: false, code: EXIT.GATE_MISMATCH, status: 'tracker-gate-mismatch', expected: expectedGate, actual: gate || null };
    }
  }
  return { ok: true, code: EXIT.OK, status: 'ok', ledger, tracker };
}

module.exports = { EXIT, extractTracker, validateTracker };

if (require.main === module) {
  const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  const result = validateTracker({
    ledgerFile: arg('ledger'), trackerFile: arg('tracker'), ado: arg('ado'), skill: arg('skill'),
    expectedPhase: arg('phase'), expectedNextAction: arg('next-action'),
    expectedGate: arg('gate') ? { phase: arg('gate'), status: arg('gate-status') } : null,
  });
  const output = { ok: result.ok, status: result.status, code: result.code };
  if (result.expected) output.expected = result.expected;
  if (result.actual) output.actual = result.actual;
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exit(result.code);
}
