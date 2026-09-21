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
//                      `validate` (A2/A4) is a deterministic, read-only fail-closed check that must
//                      pass before a resume or phase-advance boundary is allowed to proceed: it
//                      rejects a missing/empty/malformed/structurally-invalid ledger, an ADO/skill
//                      mismatch, and (optionally) a tracker file that is missing or lacks a
//                      "## Next action" section. It NEVER repairs or recreates state — a failed
//                      validation only reports; recovery is a separate, explicit, human-approved step.
// What it touches:     Reads/writes ONE JSON ledger file (path supplied by the caller / --file);
//                      `validate` additionally reads (never writes) an optional --tracker file.
// What it does NOT do: No network, no git, no code edits, no LLM. Never deletes keys it does not own;
//                      never rebuilds the file from scratch. `validate` never mutates the ledger or
//                      the tracker, even on failure — it is read-only in every branch.
// APIs / commands:     Node stdlib: fs (sync JSON), path. Library: coreEnvelope, load, save,
//                      ensurePayload, setGate, setPayload, validateLedgerFile, validateTrackerText.
//                      CLI exit codes: 0=ok · 7=absent · 8=empty · 9=malformed JSON ·
//                      10=invalid structure (schema/core fields) · 11=ADO mismatch ·
//                      12=skill mismatch · 13=tracker missing · 14=tracker empty ·
//                      15=tracker missing "## Next action" · 1=usage/error.
// How to verify:       node tests/checkpoint-ledger.test.cjs  -> "N passed · 0 failed".

'use strict';
const fs   = require('fs');
const path = require('path');

const SCHEMA_VERSION = '1.0';

// ── Library ─────────────────────────────────────────────────────────────────
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

// DECISION (A2/A4 — session design principle: "validate before use, fail closed, never silently
// repair"). `validate` is deterministic and read-only. It intentionally does NOT try to fix,
// recreate, or infer a corrected ledger/tracker — that would hide the very drift it exists to
// catch. Recovery (e.g. re-`init`, or a future reconstruct-from-tracker capability) is always a
// separate, explicit, human-approved action taken AFTER validate reports the problem.
function validateTrackerText(text) {
  if (!text || !String(text).trim()) return { ok: false, status: 'tracker-empty', code: 14 };
  if (!String(text).includes('## Next action')) return { ok: false, status: 'tracker-next-action-missing', code: 15 };
  return { ok: true, status: 'ok', code: 0 };
}

function validateLedgerFile(file, opts = {}) {
  const { ado, skill, tracker } = opts;

  if (!fs.existsSync(file)) {
    return { ok: false, status: 'absent', code: 7, file };
  }

  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) {
    return { ok: false, status: 'empty', code: 8, file };
  }

  let cp;
  try {
    cp = JSON.parse(raw);
  } catch (e) {
    return { ok: false, status: 'malformed-json', code: 9, file, error: e.message };
  }

  if (!cp || typeof cp !== 'object' || Array.isArray(cp)) {
    return { ok: false, status: 'invalid-structure', code: 10, file };
  }

  if (cp.schema_version !== SCHEMA_VERSION) {
    return { ok: false, status: 'schema-version-mismatch', code: 10, file, actual: cp.schema_version };
  }

  if (!cp.source || typeof cp.source !== 'object') {
    return { ok: false, status: 'missing-source', code: 10, file };
  }

  if (!cp.stage_gates || typeof cp.stage_gates !== 'object' || Array.isArray(cp.stage_gates)) {
    return { ok: false, status: 'missing-stage-gates', code: 10, file };
  }

  if (!Array.isArray(cp.phase_history) || !Array.isArray(cp.decision_log) || !Array.isArray(cp.judge_verdicts)) {
    return { ok: false, status: 'invalid-collections', code: 10, file };
  }

  if (ado && String(cp.ado_id || '') !== String(ado)) {
    return { ok: false, status: 'ado-mismatch', code: 11, file, expected: String(ado), actual: cp.ado_id };
  }

  if (skill) {
    const expected = String(skill).toLowerCase();
    const actual = String(cp.skill || '').toLowerCase();
    if (!cp.skill || actual !== expected) {
      return { ok: false, status: 'skill-mismatch', code: 12, file, expected, actual };
    }
  }

  if (tracker) {
    if (!fs.existsSync(tracker)) {
      return { ok: false, status: 'tracker-missing', code: 13, file: tracker };
    }
    const trackerText = fs.readFileSync(tracker, 'utf8');
    const trackerCheck = validateTrackerText(trackerText);
    if (!trackerCheck.ok) return { ok: false, status: trackerCheck.status, code: trackerCheck.code, file: tracker };
  }

  return { ok: true, status: 'ok', code: 0, file, checkpoint: cp };
}

module.exports = {
  SCHEMA_VERSION,
  coreEnvelope,
  load,
  save,
  normalize,
  ensurePayload,
  setGate,
  setPayload,
  validateLedgerFile,
  validateTrackerText,
};

// ── Generic CLI ───────────────────────────────────────────────────────────
if (require.main === module) {
  const OP = (process.argv[2] || '').trim().toLowerCase();
  const JSON_OUT = process.argv.includes('--json');
  const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
  const SKILL = (arg('skill') || '').trim().toLowerCase();
  const ADO   = (arg('ado') || '').trim();
  const NOW   = (arg('now') || new Date().toISOString().slice(0, 10)).trim();
  const FILE  = arg('file') || path.join('.claude', 'migration', `${ADO || 'ledger'}.checkpoint.json`);
  const TRACKER = arg('tracker') || null;

  try {
    let result, exit = 0;
    if (OP === 'init') {
      const existing = load(FILE);
      if (existing) result = { op: 'init', status: 'exists', file: FILE, checkpoint: existing };
      else { const cp = coreEnvelope({ skill: SKILL, ado: ADO, stack: arg('stack'), from: arg('from'), to: arg('to'), now: NOW }); save(FILE, cp); result = { op: 'init', status: 'created', file: FILE, checkpoint: cp }; }
    } else if (OP === 'get') {
      const cp = load(FILE);
      if (!cp) { result = { op: 'get', status: 'absent', file: FILE }; exit = 7; }
      else result = { op: 'get', status: 'ok', file: FILE, checkpoint: cp };
    } else if (OP === 'validate') {
      const validation = validateLedgerFile(FILE, { ado: ADO || null, skill: SKILL || null, tracker: TRACKER });
      exit = validation.code || 0;
      result = {
        op: 'validate',
        ok: validation.ok,
        status: validation.status,
        file: FILE,
        code: validation.code,
        tracker: TRACKER || null,
        expected: ADO ? String(ADO) : null,
        actual: validation.checkpoint?.ado_id || null,
      };
    } else if (OP === 'set-gate') {
      if (!arg('gate') || !arg('verdict')) throw new Error('set-gate requires --gate and --verdict');
      const cp = setGate(load(FILE) || coreEnvelope({ skill: SKILL, ado: ADO, now: NOW }), SKILL, arg('gate'), arg('verdict'), NOW);
      save(FILE, cp); result = { op: 'set-gate', status: 'ok', file: FILE, gate: arg('gate'), verdict: arg('verdict'), checkpoint: cp };
    } else if (OP === 'set-payload') {
      if (!SKILL) throw new Error('set-payload requires --skill');
      let patch = {};
      if (arg('payload-json') !== undefined) patch = JSON.parse(arg('payload-json'));
      else if (arg('key') !== undefined) patch = { [arg('key')]: arg('value') };
      const cp = setPayload(load(FILE) || coreEnvelope({ skill: SKILL, ado: ADO, now: NOW }), SKILL, patch, NOW);
      save(FILE, cp); result = { op: 'set-payload', status: 'ok', file: FILE, payload: cp.payload[SKILL], checkpoint: cp };
    } else {
      process.stderr.write('usage: checkpoint-ledger.cjs <init|get|validate|set-gate|set-payload> --skill=<s> --ado=<id> [--gate --verdict] [--key --value | --payload-json] [--file --now --tracker]\n');
      process.exit(1);
    }
    if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else process.stdout.write(`op: ${result.op}\nstatus: ${result.status}\nfile: ${result.file}\n`);
    process.exit(exit);
  } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
}
