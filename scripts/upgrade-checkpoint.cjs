#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Upgrade-skill checkpoint CLI — now a THIN ADAPTER over the shared ledger
//                      (scripts/checkpoint-ledger.cjs), extracted in Story 2 (rule-of-three: Upgrade
//                      + Rewrite are the two consumers). It maps the upgrade-specific flags
//                      (--baseline-tag, --hops, --gate/--verdict) onto the shared core + the
//                      `payload.upgrade` namespace, preserving the EXACT on-disk shape + CLI that
//                      Story 1 shipped (the unchanged upgrade-checkpoint.test.cjs is the
//                      behavior-preservation proof). Ops: init | get | set-gate | set-payload.
// What it touches:     Reads/writes ONE JSON checkpoint (default
//                      .claude/migration/<ado>.checkpoint.json, override with --file) via the shared
//                      ledger library. Nothing else.
// What it does NOT do: No network, no git, no code edits, no LLM. Merge-write only (delegated to the
//                      ledger) — never clobbers fields it does not own.
// APIs / commands:     require('./checkpoint-ledger.cjs') library + Node stdlib path. Exit codes:
//                      0=ok · 7=absent (get on missing) · 1=usage/error.
// How to verify:       node tests/upgrade-checkpoint.test.cjs  -> "N passed · 0 failed" (unchanged).

'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const ledger = require('./checkpoint-ledger.cjs');

const SKILL = 'upgrade';
// The upgrade payload skeleton — seeded on init / normalized on every write so the shape is stable.
const SKELETON = () => ({ hops: [], baseline_tag: null, gate_verdicts: {} });

module.exports = { SKELETON };

/**
 * A report PASS is only legal after the intake verifier has revalidated the ledger.
 * Keep this check at the adapter boundary so direct/manual checkpoint calls cannot
 * bypass the Upgrade skill's fail-closed report gate.
 */
function requireIntakeForReportPass(file, ado) {
  const verifier = path.join(__dirname, 'intake-verify.cjs');
  const result = spawnSync(process.execPath, [
    verifier,
    'check-gate',
    `--ado=${ado}`,
    `--file=${file}`,
    '--json',
  ], { encoding: 'utf8' });

  if (result.error) throw new Error(`report gate intake validation could not run: ${result.error.message}`);
  if (result.status !== 0) {
    let detail = '';
    try {
      const output = JSON.parse(result.stdout || '{}');
      detail = output.reason || (Array.isArray(output.problems) ? output.problems.join('; ') : 'intake gate is not PASS');
    } catch (_) {
      detail = (result.stderr || result.stdout || '').trim() || 'intake gate is not PASS';
    }
    throw new Error(`cannot record report=PASS before intake verification passes (${detail})`);
  }
}

if (require.main === module) {
  const OP       = (process.argv[2] || '').trim().toLowerCase();
  const JSON_OUT = process.argv.includes('--json');
  const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  const ADO  = (arg('ado') || '').trim();
  const NOW  = (arg('now') || new Date().toISOString().slice(0, 10)).trim();
  const FILE = arg('file') || path.join('.claude', 'migration', `${ADO || 'upgrade'}.checkpoint.json`);

  const freshWithPayload = () => {
    const cp = ledger.coreEnvelope({ skill: SKILL, ado: ADO, stack: arg('stack'), from: arg('from'), to: arg('to'), now: NOW });
    ledger.ensurePayload(cp, SKILL, SKELETON());
    return cp;
  };

  try {
    let result, exit = 0;
    if (OP === 'init') {
      const existing = ledger.load(FILE);
      if (existing) result = { op: 'init', status: 'exists', file: FILE, checkpoint: existing };
      else { const cp = freshWithPayload(); ledger.save(FILE, cp); result = { op: 'init', status: 'created', file: FILE, checkpoint: cp }; }
    } else if (OP === 'get') {
      const cp = ledger.load(FILE);
      if (!cp) { result = { op: 'get', status: 'absent', file: FILE }; exit = 7; }
      else result = { op: 'get', status: 'ok', file: FILE, checkpoint: cp };
    } else if (OP === 'set-gate') {
      const gate = arg('gate'), verdict = arg('verdict');
      if (!gate || !verdict) throw new Error('set-gate requires --gate=<name> and --verdict=<PASS|REVISE|BLOCK|approved>');
      if (gate === 'report' && verdict === 'PASS') requireIntakeForReportPass(FILE, ADO);
      const cp = ledger.setGate(ledger.load(FILE) || freshWithPayload(), SKILL, gate, verdict, NOW);
      ledger.ensurePayload(cp, SKILL, SKELETON());
      ledger.save(FILE, cp);
      result = { op: 'set-gate', status: 'ok', file: FILE, gate, verdict, checkpoint: cp };
    } else if (OP === 'set-payload') {
      const cp = ledger.load(FILE) || freshWithPayload();
      ledger.ensurePayload(cp, SKILL, SKELETON());
      const patch = {};
      if (arg('baseline-tag') !== undefined) patch.baseline_tag = arg('baseline-tag');
      if (arg('hops') !== undefined) patch.hops = arg('hops').split(',').map(h => h.trim()).filter(Boolean);
      if (arg('gate') === 'report' && arg('verdict') === 'PASS') requireIntakeForReportPass(FILE, ADO);
      ledger.setPayload(cp, SKILL, patch, NOW);
      if (arg('gate') !== undefined && arg('verdict') !== undefined) { cp.payload.upgrade.gate_verdicts[arg('gate')] = arg('verdict'); ledger.save(FILE, cp); }
      else ledger.save(FILE, cp);
      result = { op: 'set-payload', status: 'ok', file: FILE, payload: cp.payload.upgrade, checkpoint: cp };
    } else {
      process.stderr.write('usage: upgrade-checkpoint.cjs <init|get|set-gate|set-payload> --ado=<id> [--stack --from --to] [--gate --verdict] [--baseline-tag --hops] [--file --now]\n');
      process.exit(1);
    }
    if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else {
      const lines = [`op: ${result.op}`, `status: ${result.status}`, `file: ${result.file}`];
      if (result.gate) lines.push(`gate: ${result.gate} = ${result.verdict}`);
      process.stdout.write(lines.join('\n') + '\n');
    }
    process.exit(exit);
  } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
}
