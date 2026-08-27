#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Replays source frontend-parity recordings against a canned target-observation
//                      set: applies each recording's normalizations to the target's observed semantic
//                      projection (url/text/aria/network), diffs per feature_id into match/drift/error,
//                      and tags each drift by layer — aria=discovery, url/text/network=assertion.
//                      ADVISORY: always exits 0 (frontend drift is human-dispositioned, never a hard
//                      gate) — it reports drift, it does not block.
// What it touches:     READ-ONLY. Reads the --recordings and --target JSON directories. Writes nothing.
// What it does NOT do: No writes, no network, no git, no LLM, no live browser (target is canned JSON).
//                      No DOM/pixel diffing — semantic projection only. Never exits non-zero on drift.
// APIs / commands:     Node fs, path.
// How to verify:       Against _selftest-fp: target-good -> all match, 0 drift; target-drift -> F-19
//                      drift (aria/discovery) + F-07 drift (text/assertion). Both exit 0 (advisory).

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
  for (const f of fs.readdirSync(dir).filter(name => name.endsWith('.json'))) {
    const obj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    out[obj.id] = obj;
  }
  return out;
}

// Apply the agreed normalizations to an observed projection before diffing.
// Vocabulary mirrors golden-master-replay.cjs (strip / mask / sort) — enough to prove the diff
// respects normalizations; extend when a real recording needs more.
function applyNorms(observed, norms) {
  const o = JSON.parse(JSON.stringify(observed ?? {}));
  for (const n of norms || []) {
    const [op, field] = n.split(':');
    if (op === 'strip') delete o[field];
    else if (op === 'mask') { if (field in o) o[field] = '<masked>'; }
    else if (op === 'sort') { if (Array.isArray(o[field])) o[field] = o[field].slice().sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))); }
  }
  return o;
}

// Stable stringify (sorted keys) so key order never causes a false drift.
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

// DECISION: how to classify a drift for the reviewer
// Options considered:
//   A) One opaque "drift" verdict — rejected: hides the whole point of the two-layer design (whether
//      the catch came from an outcome nobody asserted).
//   B) Tag each changed key by layer — aria => discovery, url/text/network => assertion — chosen: it
//      shows when the ARIA discovery layer caught a regression the hand-authored assertions missed.
function layerOf(key) {
  return key === 'aria' ? 'discovery' : 'assertion';
}

function diffObserved(expected, actual) {
  const changed = [];
  const keys = new Set([...Object.keys(expected || {}), ...Object.keys(actual || {})]);
  for (const k of keys) {
    if (stable(expected?.[k]) !== stable(actual?.[k])) {
      changed.push({ key: k, layer: layerOf(k), from: expected?.[k], to: actual?.[k] });
    }
  }
  return changed;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.recordings || !args.target) {
    console.error('usage: frontend-parity-replay.cjs --recordings <dir> --target <dir> [--json]');
    process.exit(2);
  }

  const recs = loadDir(args.recordings);
  const targets = loadDir(args.target);

  const verdicts = [];
  let promotable = 0;
  for (const id of Object.keys(recs)) {
    const r = recs[id];
    const t = targets[id];
    if (!t) { verdicts.push({ id, feature_id: r.feature_id, risk: r.risk, verdict: 'error', detail: 'no target observation' }); continue; }
    const actual = applyNorms(t.observed, r.normalizations);
    const changed = diffObserved(r.observed_normalized, actual);
    if (changed.length === 0) {
      verdicts.push({ id, feature_id: r.feature_id, risk: r.risk, verdict: 'match' });
      if (r.tier === 'INFERRED') promotable++;
    } else {
      const layers = [...new Set(changed.map(c => c.layer))].join('+');
      const detail = changed.map(c => `${c.key} (${c.layer}): ${stable(c.from)} -> ${stable(c.to)}`).join('; ');
      verdicts.push({ id, feature_id: r.feature_id, risk: r.risk, verdict: 'drift', layers, detail });
    }
  }

  const drift = verdicts.filter(v => v.verdict === 'drift');
  const errors = verdicts.filter(v => v.verdict === 'error');
  const discoveryCatches = drift.filter(v => v.layers && v.layers.includes('discovery'));

  if (args.json) { console.log(JSON.stringify({ verdicts, promotable, advisory: true }, null, 2)); }
  else {
    console.log(`\n  Frontend-parity replay (ADVISORY)`);
    console.log(`  ${'─'.repeat(52)}`);
    for (const v of verdicts) {
      const mark = v.verdict === 'match' ? '✓' : v.verdict === 'drift' ? '✗' : '⚠';
      const tag = v.verdict === 'drift' ? ` [${v.layers}]` : '';
      console.log(`  ${mark} ${v.feature_id} [${v.risk}] ${v.verdict}${tag}${v.detail ? ' — ' + v.detail : ''}`);
    }
    console.log(`  ${'─'.repeat(52)}`);
    console.log(`  ${verdicts.filter(v => v.verdict === 'match').length} match · ${drift.length} drift (${discoveryCatches.length} via discovery/aria) · ${errors.length} error · ${promotable} promotable INFERRED→OBSERVED`);
    console.log(`  ⚑ ADVISORY — drift requires human disposition (Tier-1 session); this is NOT an auto-block\n`);
  }
  // Advisory: never a hard gate. Exit 0 even on drift/error (usage error above exits 2).
  process.exit(0);
}

main();
