#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Shared migration-family checkpoint LEDGER (extracted from Story-1's inline
//                      upgrade-checkpoint at the second consumer — rule-of-three). One ledger per
//                      ADO with a shared CORE envelope (schema_version, skill discriminator, ado_id,
//                      timestamps, source, stage_gates, phase_history, decision_log, judge_verdicts)
//                      and a per-skill PAYLOAD namespace (payload.<skill>) opaque to other skills.
//                      Exposes a LIBRARY api (require) + a generic CLI (init|get|validate|set-gate|
//                      set-payload). Every write is a MERGE-WRITE — read whole, change only owned
//                      keys, preserve everything else (tolerant reader → skew-safe across skills
//                      sharing one ledger). Single active writer assumed.
// What it touches:     Reads/writes ONE JSON ledger file (path supplied by the caller / --file).
// What it does NOT do: No network, no git, no code edits, no LLM. Never deletes keys it does not own;
//                      never rebuilds the file from scratch.
// APIs / commands:     Node stdlib: fs (sync JSON), path. Library: coreEnvelope, load, loadValidated,
//                      save, ensurePayload, setGate, setPayload, validateLedgerFile. CLI exit codes: 0=ok · 7=absent
//                      (get on missing) · 1=usage/error.
// How to verify:       node tests/checkpoint-ledger.test.cjs  -> "N passed · 0 failed".

'use strict';
const fs   = require('fs');
const path = require('path');

const SCHEMA_VERSION = '1.0';

// ── Library ───────────────────────────────────────────────────────────────────
function coreEnvelope({ skill, ado, stack, from, to, now }) {
  return {
    schema_version: SCHEMA_VERSION,
    skill: skill || null,               // which skill last wrote (discriminator)
    ado_id: ado || null,
    created_at: now,
    updated_at: now,
    source: { stack: stack || null, from: from || null, to: to || null },
    stage_gates: {},
    phase_history: [],
    decision_log: [],
    judge_verdicts: [],
    payload: {},                        // per-skill namespaces added on demand
  };
}

function load(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`Corrupt ledger ${file}: ${e.message}`); }
}

function save(file, cp) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cp, null, 2) + '\n');
}

// Tolerant reader: ensure the substructures a writer owns exist WITHOUT touching foreign fields.
// `skill` + `skeleton` seed that skill's payload namespace idempotently (never overwrites data).
function normalize(cp, skill, skeleton) {
  cp.stage_gates   ??= {};
  cp.phase_history ??= [];
  cp.decision_log  ??= [];
  cp.judge_verdicts ??= [];
  cp.payload       ??= {};
  if (skill) cp.payload[skill] ??= (skeleton || {});
  return cp;
}

function ensurePayload(cp, skill, skeleton) { normalize(cp, skill, skeleton); return cp.payload[skill]; }

// DECISION: how the shared ledger stays skew-safe when >1 skill shares one ADO ledger
// Options considered:
//   A) each skill writes its own file — rejected: loses the single migration ledger / hand-off
//      contract the family design requires (upgrade → hand-off → rewrite is one journey)
//   B) full-object overwrite per write — rejected: a newer skill's fields get clobbered by an
//      older skill's writer (skew)
//   C) merge-write on a normalized load — chosen: read whole, mutate only owned keys, preserve the
//      rest (incl. unknown newer fields); additive-only core; matches README "skew-safe"
function setGate(cp, skill, gate, verdict, now) {
  normalize(cp, skill);
  cp.stage_gates[gate] = verdict;
  cp.phase_history.push({ phase: gate, verdict, at: now });
  cp.skill = skill || cp.skill;
  cp.updated_at = now;
  return cp;
}

function setPayload(cp, skill, patch, now) {
  normalize(cp, skill, {});
  Object.assign(cp.payload[skill], patch);
  cp.skill = skill || cp.skill;
  cp.updated_at = now;
  return cp;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function formatAdo(ado) {
  if (!ado) return 'unknown ADO';
  return /^ado-/i.test(ado) ? ado.toUpperCase() : `ADO-${ado}`;
}

function commandFor(skill, action, ado) {
  const verb = action === 'resume' ? 'RESUME' : '';
  const normalized = (skill || 'migration').toUpperCase();
  return `${normalized}${verb ? ` ${verb}` : ''} ${formatAdo(ado)}`.trim();
}

function nextStepsFor(reason, { expectedSkill, expectedAdo, file, foundSkill, foundAdo }) {
  const startCommand = expectedSkill && expectedAdo ? commandFor(expectedSkill, 'start', expectedAdo) : null;
  const resumeCommand = expectedSkill && expectedAdo ? commandFor(expectedSkill, 'resume', expectedAdo) : null;
  if (reason === 'checkpoint-missing') {
    return [
      startCommand
        ? `If this is a fresh run, start explicitly with: ${startCommand}`
        : 'If this is a fresh run, initialize the ledger explicitly with checkpoint-ledger.cjs init.',
      'If you expected prior state, stop and recover the missing checkpoint file before resuming.',
    ];
  }
  if (reason === 'checkpoint-empty') {
    return [
      `Inspect the file and recover the last known-good checkpoint before continuing: ${file}`,
      startCommand
        ? `Only after confirming there is no recoverable state, remove the empty file and start fresh with: ${startCommand}`
        : 'Only after confirming there is no recoverable state, remove the empty file and run checkpoint-ledger.cjs init explicitly.',
    ];
  }
  if (reason === 'checkpoint-malformed-json') {
    return [
      `Repair the JSON in ${file} or restore a valid checkpoint backup.`,
      resumeCommand
        ? `After repair, re-run: ${resumeCommand}`
        : 'After repair, re-run the resume command that owns this ledger.',
    ];
  }
  if (reason === 'checkpoint-invalid-shape') {
    return [
      `Compare ${file} with the shared ledger contract in skills/shared/migration-ledger-schema.md and restore the missing required fields.`,
      resumeCommand
        ? `After fixing the ledger shape, re-run: ${resumeCommand}`
        : 'After fixing the ledger shape, re-run the owning resume command.',
    ];
  }
  if (reason === 'checkpoint-ado-mismatch') {
    return [
      foundAdo
        ? `Resume the ADO recorded in the file instead, if that is the intended migration: ${commandFor(expectedSkill, 'resume', foundAdo)}`
        : 'Confirm the requested ADO ID and point the command at the correct checkpoint file.',
      `If ${expectedAdo} is correct, choose the checkpoint file whose ado_id matches ${expectedAdo} before resuming.`,
    ];
  }
  if (reason === 'checkpoint-skill-mismatch') {
    return [
      foundSkill && expectedAdo
        ? `Resume the skill recorded in the file if that is correct: ${commandFor(foundSkill, 'resume', expectedAdo)}`
        : 'Confirm which migration skill owns this checkpoint before resuming.',
      `If ${expectedSkill} is correct, use that skill's checkpoint file or re-enter through the proper hand-off step before retrying.`,
    ];
  }
  return ['Review the checkpoint file and correct the ledger before retrying.'];
}

function buildValidationFailure(reason, info = {}) {
  const {
    file,
    expectedSkill = null,
    expectedAdo = null,
    foundSkill = null,
    foundAdo = null,
    details = [],
    parseError = null,
  } = info;
  return {
    ok: false,
    status: 'invalid',
    reason,
    file,
    ado: expectedAdo || foundAdo || null,
    skill: expectedSkill || foundSkill || null,
    expected: { ado: expectedAdo, skill: expectedSkill },
    found: { ado: foundAdo, skill: foundSkill },
    details,
    parse_error: parseError,
    next_steps: nextStepsFor(reason, { expectedSkill, expectedAdo, file, foundSkill, foundAdo }),
  };
}

function validateLedgerFile(file, { expectedSkill, expectedAdo } = {}) {
  if (!fs.existsSync(file)) {
    return buildValidationFailure('checkpoint-missing', { file, expectedSkill, expectedAdo });
  }

  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) {
    return buildValidationFailure('checkpoint-empty', { file, expectedSkill, expectedAdo });
  }

  let checkpoint;
  try {
    checkpoint = JSON.parse(raw);
  } catch (error) {
    return buildValidationFailure('checkpoint-malformed-json', {
      file,
      expectedSkill,
      expectedAdo,
      parseError: error.message,
      details: ['The checkpoint file is not valid JSON.'],
    });
  }

  const shapeProblems = [];
  if (!isPlainObject(checkpoint)) {
    shapeProblems.push('top-level JSON must be an object');
  } else {
    if (checkpoint.schema_version !== SCHEMA_VERSION) {
      shapeProblems.push(`schema_version must equal "${SCHEMA_VERSION}"`);
    }
    if (typeof checkpoint.skill !== 'string' || !checkpoint.skill.trim()) {
      shapeProblems.push('skill must be a non-empty string');
    }
    if (typeof checkpoint.ado_id !== 'string' || !checkpoint.ado_id.trim()) {
      shapeProblems.push('ado_id must be a non-empty string');
    }
    if (!isPlainObject(checkpoint.source)) shapeProblems.push('source must be an object');
    if (!isPlainObject(checkpoint.stage_gates)) shapeProblems.push('stage_gates must be an object');
    if (!Array.isArray(checkpoint.phase_history)) shapeProblems.push('phase_history must be an array');
    if (!Array.isArray(checkpoint.decision_log)) shapeProblems.push('decision_log must be an array');
    if (!Array.isArray(checkpoint.judge_verdicts)) shapeProblems.push('judge_verdicts must be an array');
    if (!isPlainObject(checkpoint.payload)) shapeProblems.push('payload must be an object');
  }

  if (shapeProblems.length) {
    return buildValidationFailure('checkpoint-invalid-shape', {
      file,
      expectedSkill,
      expectedAdo,
      foundSkill: isPlainObject(checkpoint) ? checkpoint.skill || null : null,
      foundAdo: isPlainObject(checkpoint) ? checkpoint.ado_id || null : null,
      details: shapeProblems,
    });
  }

  if (expectedAdo && checkpoint.ado_id !== expectedAdo) {
    return buildValidationFailure('checkpoint-ado-mismatch', {
      file,
      expectedSkill,
      expectedAdo,
      foundSkill: checkpoint.skill,
      foundAdo: checkpoint.ado_id,
      details: [`expected ado_id "${expectedAdo}" but found "${checkpoint.ado_id}"`],
    });
  }

  if (expectedSkill && checkpoint.skill !== expectedSkill) {
    return buildValidationFailure('checkpoint-skill-mismatch', {
      file,
      expectedSkill,
      expectedAdo,
      foundSkill: checkpoint.skill,
      foundAdo: checkpoint.ado_id,
      details: [`expected skill "${expectedSkill}" but found "${checkpoint.skill}"`],
    });
  }

  return {
    ok: true,
    status: 'ok',
    reason: null,
    file,
    ado: checkpoint.ado_id,
    skill: checkpoint.skill,
    checkpoint,
  };
}

function renderValidationFailure(result) {
  const header = {
    'checkpoint-missing': `❌ RESUME BLOCKED — checkpoint not found for ${formatAdo(result.ado)}`,
    'checkpoint-empty': `❌ RESUME BLOCKED — checkpoint file is empty for ${formatAdo(result.ado)}`,
    'checkpoint-malformed-json': `❌ RESUME BLOCKED — checkpoint file is not valid JSON for ${formatAdo(result.ado)}`,
    'checkpoint-invalid-shape': `❌ RESUME BLOCKED — checkpoint ledger shape is invalid for ${formatAdo(result.ado)}`,
    'checkpoint-ado-mismatch': '❌ RESUME BLOCKED — checkpoint belongs to a different ADO',
    'checkpoint-skill-mismatch': '❌ RESUME BLOCKED — checkpoint belongs to a different skill',
  }[result.reason] || '❌ RESUME BLOCKED — checkpoint validation failed';

  const lines = [
    header,
    '',
    `  File: ${result.file}`,
  ];
  if (result.parse_error) lines.push(`  Parse error: ${result.parse_error}`);
  if (result.expected?.ado || result.found?.ado) lines.push(`  Requested ADO: ${result.expected?.ado || 'n/a'} · Found: ${result.found?.ado || 'n/a'}`);
  if (result.expected?.skill || result.found?.skill) lines.push(`  Requested skill: ${result.expected?.skill || 'n/a'} · Found: ${result.found?.skill || 'n/a'}`);
  if (Array.isArray(result.details) && result.details.length) {
    lines.push('  Details:');
    for (const detail of result.details) lines.push(`    - ${detail}`);
  }
  if (Array.isArray(result.next_steps) && result.next_steps.length) {
    lines.push('', 'Next step:');
    for (const step of result.next_steps) lines.push(`  - ${step}`);
  }
  lines.push('', 'No ledger was created or modified by this check.');
  return lines.join('\n');
}

function createValidationError(result) {
  const error = new Error(renderValidationFailure(result));
  error.validation = result;
  return error;
}

function loadValidated(file, options) {
  const validation = validateLedgerFile(file, options);
  if (!validation.ok) throw createValidationError(validation);
  return validation.checkpoint;
}

module.exports = {
  SCHEMA_VERSION,
  coreEnvelope,
  load,
  loadValidated,
  save,
  normalize,
  ensurePayload,
  setGate,
  setPayload,
  validateLedgerFile,
  renderValidationFailure,
};

// ── Generic CLI ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const OP = (process.argv[2] || '').trim().toLowerCase();
  const JSON_OUT = process.argv.includes('--json');
  const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
  const SKILL = (arg('skill') || '').trim().toLowerCase();
  const ADO   = (arg('ado') || '').trim();
  const NOW   = (arg('now') || new Date().toISOString().slice(0, 10)).trim();
  const FILE  = arg('file') || path.join('.claude', 'migration', `${ADO || 'ledger'}.checkpoint.json`);

  try {
    let result, exit = 0;
    if (OP === 'init') {
      if (!fs.existsSync(FILE)) {
        const cp = coreEnvelope({ skill: SKILL, ado: ADO, stack: arg('stack'), from: arg('from'), to: arg('to'), now: NOW });
        save(FILE, cp); result = { op: 'init', status: 'created', file: FILE, checkpoint: cp };
      } else {
        const existing = loadValidated(FILE, { expectedAdo: ADO || undefined });
        result = { op: 'init', status: 'exists', file: FILE, checkpoint: existing };
      }
    } else if (OP === 'get') {
      if (!fs.existsSync(FILE)) { result = { op: 'get', status: 'absent', file: FILE }; exit = 7; }
      else {
        const validation = validateLedgerFile(FILE, { expectedAdo: ADO || undefined });
        if (!validation.ok) throw createValidationError(validation);
        result = { op: 'get', status: 'ok', file: FILE, checkpoint: validation.checkpoint };
      }
    } else if (OP === 'validate') {
      const validation = validateLedgerFile(FILE, { expectedSkill: SKILL || undefined, expectedAdo: ADO || undefined });
      if (!validation.ok) throw createValidationError(validation);
      result = { op: 'validate', status: 'ok', file: FILE, ado: validation.ado, skill: validation.skill, checkpoint: validation.checkpoint };
    } else if (OP === 'set-gate') {
      if (!arg('gate') || !arg('verdict')) throw new Error('set-gate requires --gate and --verdict');
      const cp = setGate(loadValidated(FILE, { expectedAdo: ADO || undefined }), SKILL, arg('gate'), arg('verdict'), NOW);
      save(FILE, cp); result = { op: 'set-gate', status: 'ok', file: FILE, gate: arg('gate'), verdict: arg('verdict'), checkpoint: cp };
    } else if (OP === 'set-payload') {
      if (!SKILL) throw new Error('set-payload requires --skill');
      let patch = {};
      if (arg('payload-json') !== undefined) patch = JSON.parse(arg('payload-json'));
      else if (arg('key') !== undefined) patch = { [arg('key')]: arg('value') };
      const cp = setPayload(loadValidated(FILE, { expectedAdo: ADO || undefined }), SKILL, patch, NOW);
      save(FILE, cp); result = { op: 'set-payload', status: 'ok', file: FILE, payload: cp.payload[SKILL], checkpoint: cp };
    } else {
      process.stderr.write('usage: checkpoint-ledger.cjs <init|get|validate|set-gate|set-payload> --skill=<s> --ado=<id> [--gate --verdict] [--key --value | --payload-json] [--file --now]\n');
      process.exit(1);
    }
    if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else process.stdout.write(`op: ${result.op}\nstatus: ${result.status}\nfile: ${result.file}\n`);
    process.exit(exit);
  } catch (e) {
    if (e.validation && JSON_OUT) process.stdout.write(JSON.stringify({ op: OP || null, ...e.validation }, null, 2) + '\n');
    else process.stderr.write(`${e.validation ? '' : 'error: '}${e.message}\n`);
    process.exit(1);
  }
}
