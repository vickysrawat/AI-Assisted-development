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
  const terminatorMatch = rest.match(/\n##\s+|\n---\s*(?:\n|$)/);
  const section = terminatorMatch ? rest.slice(0, terminatorMatch.index) : rest;
  return section.trim() || null;
}

function splitMarkdownRow(line) {
  return line.split('|').slice(1, -1).map(cell => cell.trim());
}

function parseMarkdownTable(section) {
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('|'))
    .map(splitMarkdownRow)
    .filter(cells => cells.length > 0)
    .filter(cells => !cells.every(cell => /^:?-{2,}:?$/.test(cell)));
}

function extractRefs(text) {
  const refs = new Set();
  const pattern = /(?:\.\.?\/|\/?)(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_.-]+)?/g;
  for (const match of String(text || '').matchAll(pattern)) {
    const value = match[0];
    if (/^https?:\/\//i.test(value)) continue;
    refs.add(value.replace(/^[`'"]|[`'"]$/g, ''));
  }
  return [...refs];
}

function parseMarkdownTracker(text) {
  const header = text.match(/^_Last updated:.*?·\s*Phase:\s*([^·\n]+?)\s*·\s*Step:\s*([^\n_]+?)\s*_?$/mi);
  const nextActionSection = extractSection(text, 'Next action');
  if (!header || !nextActionSection) return null;
  const nextAction = nextActionSection.split(/\r?\n\s*\r?\n/)[0].replace(/\s+/g, ' ').trim();

  const phaseRows = parseMarkdownTable(extractSection(text, 'Phase and step status'))
    .slice(1)
    .map(cells => ({
      phase: cells[0] || null,
      step: cells[1] || null,
      status: cells[2] || null,
      artifacts: cells[3] || null,
    }));

  const artifacts = parseMarkdownTable(extractSection(text, 'Committed artifacts'))
    .slice(1)
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
    refs: extractRefs(text),
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
    refs: extractRefs(text),
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
  const docsIndex = parts.lastIndexOf('docs');
  if (docsIndex >= 0 && parts[docsIndex + 1] === 'migrations') {
    const prefix = parts.slice(0, docsIndex).join(path.sep);
    return prefix || path.sep;
  }
  return path.dirname(path.resolve(trackerFile));
}

function resolveArtifactPath(trackerFile, ref) {
  if (/^(?:docs|memory|scripts|skills|tests|\.claude)\//.test(ref)) {
    return path.resolve(trackerRepoRoot(trackerFile), ref);
  }
  return path.resolve(path.dirname(trackerFile), ref);
}

function isWithinRepoRoot(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function artifactRefs(tracker) {
  const refs = new Set(tracker.refs || []);
  for (const artifact of tracker.artifacts || []) {
    if (artifact.path) refs.add(artifact.path);
  }
  return [...refs];
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
  if (
    latestPhase &&
    tracker.format === 'legacy' &&
    phaseText &&
    normalizeText(latestPhase) !== phaseText &&
    !/resume|continue|next step/.test(phaseText)
  ) {
    return {
      ok: false,
      exit: EXIT.PHASE_MISMATCH,
      status: 'tracker-phase-mismatch',
      reason: `Tracker phase '${tracker.phase}' does not match latest ledger phase '${latestPhase}'.`,
    };
  }

  const repoRoot = trackerRepoRoot(tracker.file);
  for (const ref of artifactRefs(tracker)) {
    const target = resolveArtifactPath(tracker.file, ref);
    if (!isWithinRepoRoot(repoRoot, target)) {
      return {
        ok: false,
        exit: EXIT.MISSING_ARTIFACT,
        status: 'tracker-artifact-outside-repo',
        reason: `Tracker references artifact outside the repository root '${ref}'.`,
      };
    }
    if (!fs.existsSync(target)) {
      return {
        ok: false,
        exit: EXIT.MISSING_ARTIFACT,
        status: 'tracker-artifact-missing',
        reason: `Tracker references missing artifact '${ref}'.`,
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
