#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateLedgerFile } = require('./checkpoint-ledger.cjs');

const EXIT = {
  OK: 0,
  TRACKER_MISSING: 13,
  TRACKER_INVALID: 14,
  PHASE_MISMATCH: 15,
  NEXT_ACTION_MISMATCH: 16,
  GATE_MISMATCH: 17,
  MISSING_ARTIFACT: 18,
};

function arg(name) {
  const value = process.argv.find(a => a.startsWith(`--${name}=`));
  return value ? value.slice(`--${name}=`.length) : null;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeStatus(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function extractSection(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headerMatch = text.match(new RegExp(`^##\\s+${escaped}\\s*$`, 'mi'));
  if (!headerMatch) return null;
  const start = headerMatch.index + headerMatch[0].length;
  const rest = text.slice(start).replace(/^\r?\n/, '');
  const terminatorMatch = rest.match(/\r?\n##\s+|\r?\n---\s*(?:\r?\n|$)/);
  const section = terminatorMatch ? rest.slice(0, terminatorMatch.index) : rest;
  return section.trim() || null;
}

function splitMarkdownRow(line) {
  return line.split('|').slice(1, -1).map(cell => cell.trim());
}

function parseMarkdownTable(section, expectedHeaders) {
  if (!section) return { ok: false, rows: [] };

  const rows = section
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('|'))
    .map(splitMarkdownRow)
    .filter(cells => cells.length > 0);

  if (rows.length < 2) return { ok: false, rows: [] };

  const header = rows[0].map(normalizeText);
  const normalizedExpected = (expectedHeaders || []).map(normalizeText);
  if (normalizedExpected.length && normalizedExpected.join('|') != header.join('|')) {
    return { ok: false, rows: [] };
  }

  const dataStart = rows[1].every(cell => /^:?-{2,}:?$/.test(cell)) ? 2 : 1;
  return { ok: true, rows: rows.slice(dataStart) };
}

function extractDelimitedRefs(text) {
  const refs = new Set();
  for (const match of String(text || '').matchAll(/`([^`\r\n]+)`/g)) {
    const value = match[1].trim();
    if (!value || /^https?:\/\//i.test(value)) continue;
    if (/[\\/]/.test(value) || /\.[A-Za-z0-9_.-]+$/.test(value)) refs.add(value);
  }
  return [...refs];
}

function parseMarkdownTracker(text) {
  const header = text.match(/^_Last updated:.*?·\s*Phase:\s*([^·\n]+?)\s*·\s*Step:\s*([^\n_]+?)\s*_?$/mi);
  const nextActionSection = extractSection(text, 'Next action');
  if (!header || !nextActionSection) return null;
  const nextAction = nextActionSection.split(/\r?\n\s*\r?\n/)[0].replace(/\s+/g, ' ').trim();

  const phaseTable = parseMarkdownTable(extractSection(text, 'Phase and step status'), ['Phase', 'Step', 'Status', 'Artifact(s)']);
  const artifactTable = parseMarkdownTable(extractSection(text, 'Committed artifacts'), ['Artifact', 'Path', 'Status']);
  if (!phaseTable.ok || !artifactTable.ok) return null;

  const phaseRows = phaseTable.rows
    .map(cells => ({
      phase: cells[0] || null,
      step: cells[1] || null,
      status: cells[2] || null,
      artifacts: cells[3] || null,
    }));

  const artifacts = artifactTable.rows
    .map(cells => ({
      artifact: cells[0] || null,
      path: cells[1] || null,
      status: cells[2] || null,
    }))
    .filter(entry => entry.path && entry.path !== '—');

  return {
    format: 'markdown',
    phase: header[1].trim(),
    step: header[2].trim(),
    nextAction,
    phaseRows,
    artifacts,
    refs: extractDelimitedRefs(text),
  };
}

function parseLegacyTracker(text) {
  const phase = text.match(/^(?:Phase|Current phase|State)\s*:\s*(.+)$/im)?.[1]?.trim() || null;
  const nextAction = text.match(/^(?:Next action|Next)\s*:\s*(.+)$/im)?.[1]?.trim() || null;
  if (!phase && !nextAction) return null;
  return {
    format: 'legacy',
    phase,
    step: null,
    nextAction,
    phaseRows: [],
    artifacts: [],
    refs: extractDelimitedRefs(text),
  };
}

function parseTracker(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { ok: false, status: 'missing', file: filePath || null, code: EXIT.TRACKER_MISSING };
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = parseMarkdownTracker(text) || parseLegacyTracker(text);
  if (!parsed || !parsed.phase || !parsed.nextAction) {
    return {
      ok: false,
      status: 'invalid',
      file: filePath,
      code: EXIT.TRACKER_INVALID,
      reason: 'Tracker is missing the current phase or next action.',
    };
  }

  return {
    ok: true,
    status: 'ok',
    file: filePath,
    text,
    ...parsed,
  };
}

function trackerRepoRoot(trackerFile) {
  const parts = path.resolve(trackerFile).split(path.sep);
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index] === 'docs' && parts[index + 1] === 'migrations') {
      const prefix = parts.slice(0, index).join(path.sep);
      return prefix || path.sep;
    }
  }
  return path.dirname(path.resolve(trackerFile));
}

function resolveArtifactPath(trackerFile, ref, options = {}) {
  const rawRef = String(ref || '');
  const normalizedRef = rawRef.replace(/[\\/]+/g, path.sep);
  if (path.isAbsolute(normalizedRef) || /^[A-Za-z]:[\\/]/.test(rawRef)) return normalizedRef;
  if (options.repoRootRelative || /[\\/]/.test(rawRef)) {
    return path.resolve(trackerRepoRoot(trackerFile), normalizedRef);
  }
  return path.resolve(path.dirname(trackerFile), normalizedRef);
}

function isWithinRepoRoot(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function artifactRefs(tracker) {
  const refs = [];
  for (const artifact of tracker.artifacts || []) {
    if (artifact.path) refs.push({ value: artifact.path, repoRootRelative: true });
  }
  for (const ref of tracker.refs || []) {
    refs.push({ value: ref, repoRootRelative: false });
  }
  return refs;
}

function getLatestLedgerPhase(ledger) {
  const history = Array.isArray(ledger.phase_history) ? ledger.phase_history : [];
  return history.length ? history[history.length - 1]?.phase || null : null;
}

function getUnresolvedGate(ledger) {
  for (const [name, verdict] of Object.entries(ledger.stage_gates || {})) {
    if (String(verdict).toUpperCase() !== 'PASS') return name;
  }
  return null;
}

function humanizePhase(value) {
  return String(value || '').replace(/[_-]+/g, ' ');
}

const MACHINE_PHASE_STALE_HINTS = {
  intake_context: ['0 — initialize', '1 — source analysis', 'source analysis'],
  report: ['0 — initialize', '1 — source analysis', '1.5 — integration + oracle', 'integration + oracle', '2 — options', 'options', '2.5 — target design', 'target design'],
  design_approved: ['0 — initialize', '1 — source analysis', '1.5 — integration + oracle', 'integration + oracle', '2 — options', 'options', '2.5 — target design', 'target design'],
  verify: ['0 — initialize', '1 — source analysis', '1.5 — integration + oracle', 'integration + oracle', '2 — options', 'options', '2.5 — target design', 'target design', '3 — generation', 'generation', '4 — bal + erl', 'bal + erl', '5 — gates', 'gates'],
};

function machinePhaseKey(value) {
  return normalizeText(humanizePhase(value)).replace(/\s+/g, '_');
}

function phaseLooksStaleForLedger(tracker, latestPhase) {
  const hints = MACHINE_PHASE_STALE_HINTS[machinePhaseKey(latestPhase)] || [];
  const currentPhase = normalizeText(`${tracker.phase || ''} ${tracker.step || ''}`);
  return hints.some(hint => currentPhase.includes(normalizeText(hint)));
}

function shouldCheckLatestPhase(tracker, latestPhase) {
  const value = String(latestPhase || '');
  if (!value) return false;
  if (tracker.format === 'legacy') return true;
  if (/^\d/.test(value) || /—/.test(value)) return true;
  const tokens = [normalizeText(value), normalizeText(humanizePhase(value))].filter(Boolean);
  const fields = [tracker.phase, tracker.step, ...(tracker.phaseRows || []).flatMap(row => [row.phase, row.step])]
    .map(normalizeText)
    .filter(Boolean);
  return fields.some(field => tokens.some(token => field.includes(token)));
}

function trackerMatchesLatestPhase(tracker, latestPhase) {
  const tokens = [normalizeText(latestPhase), normalizeText(humanizePhase(latestPhase))].filter(Boolean);
  const current = [tracker.phase, tracker.step].map(normalizeText).filter(Boolean);
  return current.some(field => tokens.some(token => field === token || field.includes(token)));
}

function assertTrackerMatchesLedger(tracker, ledgerValidation, expectations = {}) {
  if (!tracker.ok) {
    return { ok: false, exit: tracker.code, status: tracker.status, reason: tracker.reason || 'Tracker file not found.' };
  }
  if (!ledgerValidation.ok) {
    return {
      ok: false,
      exit: ledgerValidation.code,
      status: ledgerValidation.status,
      reason: ledgerValidation.error || `Ledger validation failed: ${ledgerValidation.status}`,
    };
  }

  const ledger = ledgerValidation.checkpoint;
  const phaseText = normalizeText(tracker.phase);
  const nextText = normalizeText(tracker.nextAction);

  if (expectations.phase && phaseText !== normalizeText(expectations.phase)) {
    return {
      ok: false,
      exit: EXIT.PHASE_MISMATCH,
      status: 'tracker-phase-mismatch',
      reason: `Tracker phase '${tracker.phase}' does not match expected phase '${expectations.phase}'.`,
    };
  }

  if (expectations.nextAction && nextText !== normalizeText(expectations.nextAction)) {
    return {
      ok: false,
      exit: EXIT.NEXT_ACTION_MISMATCH,
      status: 'tracker-next-action-mismatch',
      reason: `Tracker next action '${tracker.nextAction}' does not match expected next action '${expectations.nextAction}'.`,
    };
  }

  if (expectations.gate) {
    const gate = (tracker.phaseRows || []).find(item => normalizeText(item.phase) === normalizeText(expectations.gate.phase));
    const actualStatus = gate ? normalizeStatus(gate.status) : null;
    const expectedStatus = normalizeStatus(expectations.gate.status);
    if (!gate || actualStatus !== expectedStatus) {
      return {
        ok: false,
        exit: EXIT.GATE_MISMATCH,
        status: 'tracker-gate-mismatch',
        reason: `Tracker gate '${expectations.gate.phase}' does not match expected status '${expectations.gate.status}'.`,
      };
    }
  }

  const unresolvedGate = getUnresolvedGate(ledger);
  if (unresolvedGate && /migration complete|complete|completed|done|finished|closed/.test(`${phaseText} ${nextText}`)) {
    return {
      ok: false,
      exit: EXIT.PHASE_MISMATCH,
      status: 'tracker-phase-mismatch',
      reason: `Tracker declares completion while ledger gate '${unresolvedGate}' is unresolved.`,
    };
  }

  const latestPhase = getLatestLedgerPhase(ledger);
  if (latestPhase && phaseText && !/resume|continue|next step/.test(phaseText)) {
    if (phaseLooksStaleForLedger(tracker, latestPhase)) {
      return {
        ok: false,
        exit: EXIT.PHASE_MISMATCH,
        status: 'tracker-phase-mismatch',
        reason: `Tracker phase '${tracker.phase}' is stale for latest ledger phase '${latestPhase}'.`,
      };
    }
    if (shouldCheckLatestPhase(tracker, latestPhase) && !trackerMatchesLatestPhase(tracker, latestPhase)) {
      return {
        ok: false,
        exit: EXIT.PHASE_MISMATCH,
        status: 'tracker-phase-mismatch',
        reason: `Tracker phase '${tracker.phase}' does not match latest ledger phase '${latestPhase}'.`,
      };
    }
  }

  const repoRoot = trackerRepoRoot(tracker.file);
  for (const ref of artifactRefs(tracker)) {
    const target = resolveArtifactPath(tracker.file, ref.value, { repoRootRelative: ref.repoRootRelative });
    if (!isWithinRepoRoot(repoRoot, target)) {
      return {
        ok: false,
        exit: EXIT.MISSING_ARTIFACT,
        status: 'tracker-artifact-outside-repo',
        reason: `Tracker references artifact outside the repository root '${ref.value}'.`,
      };
    }
    if (!fs.existsSync(target)) {
      return {
        ok: false,
        exit: EXIT.MISSING_ARTIFACT,
        status: 'tracker-artifact-missing',
        reason: `Tracker references missing artifact '${ref.value}'.`,
      };
    }
  }

  return { ok: true, exit: EXIT.OK, status: 'ok', reason: 'Tracker is aligned with the ledger.' };
}

function main() {
  const trackerPath = arg('tracker');
  const ledgerPath = arg('ledger');
  const jsonOut = process.argv.includes('--json');
  if (!trackerPath || !ledgerPath) {
    const reason = 'usage: node scripts/tracker-validate.cjs --tracker=<path> --ledger=<path> [--phase=<value>] [--next-action=<value>] [--gate=<phase>] [--gate-status=<status>] [--json]';
    if (jsonOut) console.log(JSON.stringify({ ok: false, exit: 1, reason }, null, 2));
    else process.stderr.write(`${reason}\n`);
    process.exit(1);
  }

  const tracker = parseTracker(trackerPath);
  const ledgerValidation = validateLedgerFile(ledgerPath, { ado: arg('ado') || null, skill: arg('skill') || null });
  const result = assertTrackerMatchesLedger(tracker, ledgerValidation, {
    phase: arg('phase') || null,
    nextAction: arg('next-action') || null,
    gate: arg('gate') ? { phase: arg('gate'), status: arg('gate-status') || '' } : null,
  });

  if (jsonOut) console.log(JSON.stringify(result, null, 2));
  else console.log(`status: ${result.ok ? 'OK' : 'FAIL'}\nexit: ${result.exit}\nreason: ${result.reason}`);
  process.exit(result.exit);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const result = { ok: false, exit: EXIT.TRACKER_INVALID, status: 'error', reason: error.message };
    if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else process.stderr.write(`error: ${error.message}\n`);
    process.exit(result.exit);
  }
}

module.exports = {
  EXIT,
  parseTracker,
  assertTrackerMatchesLedger,
  getLatestLedgerPhase,
  getUnresolvedGate,
  normalizeText,
  resolveArtifactPath,
  trackerRepoRoot,
};
