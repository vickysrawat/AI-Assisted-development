#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Shared migration-family checkpoint LEDGER (extracted from Story-1's inline
//                      upgrade-checkpoint at the second consumer — rule-of-three). One ledger per
//                      ADO with a shared CORE envelope (schema_version, skill discriminator, ado_id,
//                      timestamps, source, stage_gates, phase_history, decision_log, judge_verdicts)
//                      and a per-skill PAYLOAD namespace (payload.<skill>) opaque to other skills.
//                      Exposes a LIBRARY api (require) + a generic CLI (init|get|set-gate|
//                      set-payload|validate-artifacts|dirty-stop). Every write is a MERGE-WRITE — read whole,
//                      change only owned keys, preserve everything else (tolerant reader → skew-safe
//                      across skills sharing one ledger). Writes are crash-safe (atomic temp→rename).
//                      Single active writer assumed.
// What it touches:     Reads/writes ONE JSON ledger file (path supplied by the caller / --file).
// What it does NOT do: No network, no git, no code edits, no LLM. Never deletes keys it does not own;
//                      never rebuilds the file from scratch.
// APIs / commands:     Node stdlib: fs (sync JSON), path. Library: coreEnvelope, load, save,
//                      ensurePayload, setGate, setPayload, get. CLI exit codes: 0=ok · 7=absent
//                      (get on missing) · 2=artifact invalid (validate-artifacts) · 5=checkpoint
//                      missing at write time · 1=usage/error.
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
  // A21: write to a temp file then rename — prevents corrupt ledger on crash mid-write.
  // rename(2) is atomic on POSIX; on Windows the original is intact if rename fails.
  const tmp = file + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(cp, null, 2) + '\n');
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
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
//
// DECISION: gate storage format — flat string vs object
// Options considered:
//   A) always store as object { verdict, at } — rejected: breaks all existing readers and tests
//      that compare stage_gates.gate === 'PASS' directly; unnecessary complexity for simple gates
//   B) store as flat string always — rejected: no place to attach artifact metadata needed for
//      validate-artifacts to check file existence + content without an external manifest
//   C) flat string for decision-only gates, object when artifact metadata is provided — chosen:
//      backward-compatible (1.0 readers ignore unknown fields / still see a string for old gates);
//      check-gate uses a tolerant reader that handles both forms
function setGate(cp, skill, gate, verdict, now, artifactMeta) {
  normalize(cp, skill);
  // Store gate as an object when artifact metadata is provided; flat string for simple decision gates.
  if (artifactMeta && Object.keys(artifactMeta).length > 0) {
    cp.stage_gates[gate] = { verdict, at: now, ...artifactMeta };
  } else {
    cp.stage_gates[gate] = verdict;
  }
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

module.exports = { SCHEMA_VERSION, coreEnvelope, load, save, normalize, ensurePayload, setGate, setPayload };

// ── Generic CLI ─────────────────────────────────────────────────────────────

// Builds the error message shown when set-gate or set-payload is called on a missing checkpoint.
// Uses technical language (git commands, file paths) but no plugin-internal jargon.
function missingCheckpointMessage(file, skill, ado) {
  const resumeVerb = { rewrite: 'REWRITE', upgrade: 'UPGRADE', replatform: 'REPLATFORM' }[skill] || skill.toUpperCase();
  return [
    `❌  Migration checkpoint missing — ${ado}`,
    `    File: ${file}`,
    ``,
    `    This file records which steps have completed and all decisions made so far.`,
    `    Writing migration state without it would silently discard all prior progress.`,
    ``,
    `    ── Scenario A: Migration not yet started ──`,
    `    This command creates a new empty checkpoint (Step 0 start state):`,
    `      node scripts/checkpoint-ledger.cjs init --skill=${skill} --ado=${ado}`,
    `    Then type: ${resumeVerb} RESUME ${ado}`,
    ``,
    `    ── Scenario B: Migration was in progress — file was deleted ──`,
    `    Do NOT run the command in Scenario A. It creates an empty file and`,
    `    all records of completed steps and decisions are permanently lost.`,
    ``,
    `    Step 1 — Check git history for the file:`,
    `      git log --all --oneline -- ${file}`,
    ``,
    `    Step 2 — If found in git, restore it:`,
    `      git checkout <commit-hash> -- ${file}`,
    `      Then type: ${resumeVerb} RESUME ${ado}`,
    ``,
    `    Step 3 — If not in git, open docs/migrations/${ado}/migration-tracker.md`,
    `              It shows which phases completed. Share it with your Tech Lead`,
    `              before taking any further action.`,
  ].join('\n');
}

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
    // A14: Reject unknown flags per-operation — prevents silent no-ops from undocumented flag names.
    const ALLOWED_CLI = {
      'init':        new Set(['skill', 'ado', 'file', 'now', 'json', 'stack', 'from', 'to']),
      'get':         new Set(['skill', 'ado', 'file', 'json']),
      'set-gate':          new Set(['skill', 'ado', 'file', 'now', 'json', 'gate', 'verdict', 'artifact-path', 'sentinel', 'min-bytes']),
      'set-payload':       new Set(['skill', 'ado', 'file', 'now', 'json', 'payload-json', 'payload-file', 'key', 'value']),
      'validate':          new Set(['skill', 'ado', 'file', 'json']),
      'check-gate':        new Set(['skill', 'ado', 'file', 'json', 'gate']),
      'validate-artifacts': new Set(['skill', 'ado', 'file', 'json']),
      'dirty-stop':        new Set(['skill', 'ado', 'file', 'now', 'json', 'data-file']),
      'set-source':        new Set(['skill', 'ado', 'file', 'now', 'json', 'roots-json']),
    };
    const allowedForOp = ALLOWED_CLI[OP];
    if (allowedForOp) {
      for (const a of process.argv.slice(3)) {
        if (!a.startsWith('--')) continue;
        const flag = a.split('=')[0].slice(2);
        if (!allowedForOp.has(flag)) {
          process.stderr.write(`error: unknown flag --${flag} for ${OP}.\nKnown flags: ${[...allowedForOp].map(f => '--' + f).join(', ')}\n`);
          process.exit(1);
        }
      }
    }
    if (OP === 'init') {
      const existing = load(FILE);
      if (existing) result = { op: 'init', status: 'exists', file: FILE, checkpoint: existing };
      else { const cp = coreEnvelope({ skill: SKILL, ado: ADO, stack: arg('stack'), from: arg('from'), to: arg('to'), now: NOW }); save(FILE, cp); result = { op: 'init', status: 'created', file: FILE, checkpoint: cp }; }
    } else if (OP === 'get') {
      const cp = load(FILE);
      if (!cp) { result = { op: 'get', status: 'absent', file: FILE }; exit = 7; }
      else result = { op: 'get', status: 'ok', file: FILE, checkpoint: cp };
    } else if (OP === 'set-gate') {
      if (!arg('gate') || !arg('verdict')) throw new Error('set-gate requires --gate and --verdict');
      const existing_sg = load(FILE);
      if (!existing_sg) { process.stderr.write(missingCheckpointMessage(FILE, SKILL, ADO) + '\n'); process.exit(5); }
      // Build artifact metadata from optional flags — only present when the gate produces a file artifact.
      const artifactMeta = {};
      if (arg('artifact-path') !== undefined) artifactMeta.artifact_path = arg('artifact-path');
      if (arg('sentinel')      !== undefined) artifactMeta.sentinel       = arg('sentinel');
      if (arg('min-bytes')     !== undefined) artifactMeta.min_bytes      = parseInt(arg('min-bytes'), 10);
      const cp = setGate(existing_sg, SKILL, arg('gate'), arg('verdict'), NOW, artifactMeta);
      save(FILE, cp); result = { op: 'set-gate', status: 'ok', file: FILE, gate: arg('gate'), verdict: arg('verdict'), checkpoint: cp };
    } else if (OP === 'set-payload') {
      if (!SKILL) throw new Error('set-payload requires --skill');
      const existing_sp = load(FILE);
      if (!existing_sp) { process.stderr.write(missingCheckpointMessage(FILE, SKILL, ADO) + '\n'); process.exit(5); }
      let patch = {};
      if (arg('payload-json') !== undefined) patch = JSON.parse(arg('payload-json'));
      // B9: file-based payload avoids shell quoting failures, arg-length limits, and LLM truncation.
      else if (arg('payload-file') !== undefined) patch = JSON.parse(fs.readFileSync(arg('payload-file'), 'utf8'));
      else if (arg('key') !== undefined) patch = { [arg('key')]: arg('value') };
      const cp = setPayload(existing_sp, SKILL, patch, NOW);
      save(FILE, cp); result = { op: 'set-payload', status: 'ok', file: FILE, payload: cp.payload[SKILL], checkpoint: cp };
    } else if (OP === 'validate') {
      // A2: three-scenario checkpoint validation — missing(2) / corrupt(3) / incomplete(4) / ok(0).
      // Never writes. Safe to call before any resume/advance operation.
      if (!fs.existsSync(FILE)) {
        result = { op: 'validate', status: 'missing', file: FILE,
                   message: 'Checkpoint file does not exist.',
                   next: 'Read migration-tracker.md, then run: node scripts/checkpoint-ledger.cjs init --skill=<skill> --ado=<ado>' };
        exit = 2;
      } else {
        let parsed = null;
        try { parsed = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {
          result = { op: 'validate', status: 'corrupt', file: FILE, parse_error: e.message,
                     message: 'Checkpoint file exists but is not valid JSON. Do NOT overwrite — inspect first.',
                     next: 'Inspect the file. If unrecoverable: delete it, then run init. If repairable: fix JSON, then retry validate.' };
          exit = 3;
        }
        if (parsed !== null) {
          const REQUIRED = ['source', 'stage_gates'];
          const missing = REQUIRED.filter(f => parsed[f] === undefined);
          // Only flag payload.<skill> missing if the flow has progressed past init
          // (stage_gates has entries). A fresh init with no gates is a valid clean-start state.
          const hasProgress = Object.keys(parsed.stage_gates || {}).length > 0;
          if (SKILL && hasProgress && (parsed.payload === undefined || parsed.payload[SKILL] === undefined))
            missing.push(`payload.${SKILL}`);
          if (missing.length > 0) {
            result = { op: 'validate', status: 'incomplete', file: FILE, missing_fields: missing,
                       message: `Checkpoint is valid JSON but missing required fields: ${missing.join(', ')}.`,
                       next: 'init will NOT overwrite an existing file. Delete the file first, then run init.' };
            exit = 4;
          } else {
            result = { op: 'validate', status: 'ok', file: FILE,
                       message: 'Checkpoint is present, valid, and complete.' };
            exit = 0;
          }
        }
      }
    } else if (OP === 'check-gate') {
      // A9: exits 0 (PASS), 1 (REVISE), 2 (BLOCK), 3 (no verdict / unrecognised). Never writes.
      // Safe to call before any gate-approval prompt.
      const gate = arg('gate');
      if (!SKILL || !ADO || !gate) throw new Error('check-gate requires --skill, --ado, --gate');
      const cp = load(FILE);
      if (!cp) throw new Error(`Ledger not found: ${FILE}. Run init first.`);
      const raw = (cp.stage_gates || {})[gate];
      // Tolerant reader: handle both flat string ("PASS") and object ({ verdict: "PASS", ... })
      const verdict = raw === undefined || raw === null ? null :
        (typeof raw === 'object' ? String(raw.verdict || '').toUpperCase() : String(raw).toUpperCase());
      if (!verdict) {
        result = { op: 'check-gate', status: 'none', file: FILE, gate, verdict: null,
          message: 'No verdict recorded — gate has not been reached.' };
        exit = 3;
      } else if (verdict === 'PASS') {
        result = { op: 'check-gate', status: 'PASS', file: FILE, gate, verdict,
          message: 'Gate passed.' };
        exit = 0;
      } else if (verdict === 'REVISE') {
        result = { op: 'check-gate', status: 'REVISE', file: FILE, gate, verdict,
          message: 'Judge verdict is REVISE — developer must acknowledge before proceeding.' };
        exit = 1;
      } else if (verdict === 'BLOCK') {
        result = { op: 'check-gate', status: 'BLOCK', file: FILE, gate, verdict,
          message: 'Judge verdict is BLOCK — named approver and written reason required.' };
        exit = 2;
      } else {
        result = { op: 'check-gate', status: 'unknown', file: FILE, gate, verdict,
          message: `Unrecognised verdict value: ${verdict}.` };
        exit = 3;
      }
    } else if (OP === 'validate-artifacts') {
      // Reads checkpoint, iterates PASS gates that have artifact_path stored, and verifies each artifact.
      // Three failure modes per artifact: missing (file not found), empty (below min_bytes threshold),
      // truncated (file present and large enough but missing the expected sentinel string).
      // Exit 0 = all ok (or no artifact-tracked PASS gates found). Exit 2 = one or more invalid.
      // Never writes. Safe to call at the start of every RESUME operation.
      const cp = load(FILE);
      if (!cp) throw new Error(`Ledger not found: ${FILE}. Run init first.`);

      const issues  = [];
      const checked = [];

      for (const [gate, raw] of Object.entries(cp.stage_gates || {})) {
        // Only inspect PASS gates stored as objects (schema 1.1+). Flat-string gates have no
        // artifact metadata — skip them (they are decision gates, not artifact-producing gates).
        if (typeof raw !== 'object' || raw === null) continue;
        if (String(raw.verdict || '').toUpperCase() !== 'PASS') continue;
        if (!raw.artifact_path) continue;

        const ap   = raw.artifact_path;
        const minB = typeof raw.min_bytes === 'number' ? raw.min_bytes : 0;
        const sent = raw.sentinel || null;
        let status = 'ok', detail = null;

        if (!fs.existsSync(ap)) {
          status = 'missing';
          detail = `File not found: ${ap}`;
        } else {
          const sz = fs.statSync(ap).size;
          if (sz < minB) {
            status = 'empty';
            detail = `File is ${sz} bytes, expected >= ${minB}`;
          } else if (sent && !fs.readFileSync(ap, 'utf8').includes(sent)) {
            status = 'truncated';
            detail = `File does not contain expected sentinel: "${sent}"`;
          }
        }

        checked.push({ gate, artifact_path: ap, status, detail });
        if (status !== 'ok') issues.push({ gate, artifact_path: ap, status, detail });
      }

      result = {
        op: 'validate-artifacts', status: issues.length > 0 ? 'invalid' : 'ok',
        file: FILE, checked_count: checked.length, issue_count: issues.length,
        issues, all: checked,
      };
      if (issues.length > 0) exit = 2;

    } else if (OP === 'dirty-stop') {
      // Atomically writes a dirty_stop entry into payload[skill] when context exhaustion forces an
      // unplanned stop between safe points. The data-file (written by the skill before calling this)
      // carries the structured stop state: stopped_at, stopped_before, at, reason are required;
      // wave_current, clusters_completed[], clusters_pending[] are optional but strongly recommended.
      // Uses the standard merge-write so all other payload fields are preserved.
      // Exit 0 = written. Exit 5 = checkpoint missing. Exit 1 = bad args / file / JSON / fields.
      if (!SKILL) throw new Error('dirty-stop requires --skill');
      const dataFile = arg('data-file');
      if (!dataFile) throw new Error('dirty-stop requires --data-file');
      if (!fs.existsSync(dataFile)) throw new Error(`dirty-stop: --data-file not found: ${dataFile}`);

      let dsData;
      try { dsData = JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
      catch (e) { throw new Error(`dirty-stop: --data-file is not valid JSON: ${e.message}`); }

      // Validate required fields before touching the ledger — fail fast, never write a partial entry.
      const DS_REQUIRED = ['stopped_at', 'stopped_before', 'at', 'reason'];
      const dsMissing = DS_REQUIRED.filter(f => !dsData[f]);
      if (dsMissing.length > 0)
        throw new Error(`dirty-stop: data-file missing required fields: ${dsMissing.join(', ')}`);

      const existing_ds = load(FILE);
      if (!existing_ds) { process.stderr.write(missingCheckpointMessage(FILE, SKILL, ADO) + '\n'); process.exit(5); }

      const cp = setPayload(existing_ds, SKILL, { dirty_stop: dsData }, NOW);
      save(FILE, cp);
      result = { op: 'dirty-stop', status: 'ok', file: FILE, dirty_stop: dsData, checkpoint: cp };

    } else if (OP === 'set-source') {
      if (!SKILL) throw new Error('set-source requires --skill');
      if (arg('roots-json') === undefined) throw new Error('set-source requires --roots-json');
      let roots;
      try { roots = JSON.parse(arg('roots-json')); } catch (e) { throw new Error(`set-source: --roots-json is not valid JSON: ${e.message}`); }
      if (!Array.isArray(roots) || roots.some(r => typeof r !== 'string')) throw new Error('set-source: --roots-json must be a JSON array of strings');
      const cp = load(FILE) || coreEnvelope({ skill: SKILL, ado: ADO, now: NOW });
      cp.source = cp.source || {};
      cp.source.roots = roots;
      cp.updated_at = NOW;
      save(FILE, cp);
      result = { op: 'set-source', status: 'ok', file: FILE, roots, checkpoint: cp };
    } else {
      process.stderr.write('usage: checkpoint-ledger.cjs <init|get|set-gate|set-payload|validate|check-gate|validate-artifacts|dirty-stop|set-source> --skill=<s> --ado=<id> [--gate=<gate>] ...\n');
      process.exit(1);
    }
    if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else process.stdout.write(`op: ${result.op}\nstatus: ${result.status}\nfile: ${result.file}\n`);
    process.exit(exit);
  } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
}
