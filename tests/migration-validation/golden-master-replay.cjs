#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Replays source golden-master recordings against a target-response set: applies
//                      each recording's normalizations to the target body, diffs status+body into
//                      match/drift/error per feature_id, fires a gate (exit 1) on any HIGH-risk drift
//                      or error, and reports INFERRED->OBSERVED promotable matches.
// What it touches:     READ-ONLY. Reads the --recordings and --target JSON directories. Writes nothing.
// What it does NOT do: No writes, no network, no git, no LLM, no live servers (target is canned JSON).
// APIs / commands:     Node fs, path.
// How to verify:       Against _selftest-gm: target-good -> all match, exit 0; target-drift -> HIGH-risk
//                      drift, gate fires, exit 1.

'use strict';
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { json: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--json') a.json = true;
    else if (t.startsWith('--')) a[t.slice(2)] = argv[++i];
  }
  return a;
}

function loadDir(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const obj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    out[obj.id] = obj;
  }
  return out;
}

// Apply the agreed normalizations to a response body before diffing.
// DECISION: normalization vocabulary
// Options considered:
//   A) Full spec vocabulary (strip/sort/mask/round/canonicalize) up front — rejected: YAGNI for the
//      mechanics test; more surface to get wrong.
//   B) The three that carry the mechanics — strip / mask / sort — chosen: enough to prove the diff
//      respects normalizations; extend when a real recording needs more.
function applyNorms(body, norms) {
  const b = JSON.parse(JSON.stringify(body ?? {}));
  for (const n of norms || []) {
    const [op, field] = n.split(':');
    if (op === 'strip') delete b[field];
    else if (op === 'mask') { if (field in b) b[field] = '<masked>'; }
    else if (op === 'sort') { if (Array.isArray(b[field])) b[field] = b[field].slice().sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))); }
  }
  return b;
}

// Stable stringify (sorted keys) so key order never causes a false drift.
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.recordings || !args.target) {
    console.error('usage: golden-master-replay.cjs --recordings <dir> --target <dir> [--json]');
    process.exit(2);
  }

  const recs = loadDir(args.recordings);
  const targets = loadDir(args.target);

  const verdicts = [];
  let promotable = 0;
  for (const id of Object.keys(recs)) {
    const r = recs[id];
    const t = targets[id];
    if (!t) { verdicts.push({ id, feature_id: r.feature_id, risk: r.risk, verdict: 'error', detail: 'no target response' }); continue; }
    const tbody = applyNorms(t.response.body, r.normalizations);
    const statusMatch = r.response.status === t.response.status;
    const bodyMatch = stable(r.response.body_normalized) === stable(tbody);
    if (statusMatch && bodyMatch) {
      verdicts.push({ id, feature_id: r.feature_id, risk: r.risk, verdict: 'match' });
      if (r.tier === 'INFERRED') promotable++;
    } else {
      verdicts.push({
        id, feature_id: r.feature_id, risk: r.risk, verdict: 'drift',
        detail: !statusMatch ? `status ${r.response.status} -> ${t.response.status}` : `body ${stable(r.response.body_normalized)} -> ${stable(tbody)}`,
      });
    }
  }

  const drift = verdicts.filter(v => v.verdict === 'drift');
  const errors = verdicts.filter(v => v.verdict === 'error');
  const highDrift = drift.filter(v => v.risk === 'HIGH');
  const gateFail = highDrift.length > 0 || errors.length > 0;

  if (args.json) { console.log(JSON.stringify({ verdicts, promotable, gateFail }, null, 2)); }
  else {
    console.log(`\n  Golden-master replay`);
    console.log(`  ${'─'.repeat(52)}`);
    for (const v of verdicts) {
      const mark = v.verdict === 'match' ? '✓' : v.verdict === 'drift' ? '✗' : '⚠';
      console.log(`  ${mark} ${v.feature_id} [${v.risk}] ${v.verdict}${v.detail ? ' — ' + v.detail : ''}`);
    }
    console.log(`  ${'─'.repeat(52)}`);
    console.log(`  ${verdicts.filter(v => v.verdict === 'match').length} match · ${drift.length} drift (${highDrift.length} HIGH) · ${errors.length} error · ${promotable} promotable INFERRED→OBSERVED`);
    console.log(`  ${gateFail ? '✗ GATE FAIL — HIGH-risk drift or error; do NOT mark migration COMPLETE' : '✓ GATE PASS'}\n`);
  }
  process.exit(gateFail ? 1 : 0);
}

main();
