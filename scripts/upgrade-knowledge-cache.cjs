#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Upgrade-skill migration-knowledge cache + source-verification engine. Stores
//                      and retrieves grounded breaking-change / gap facts in TWO volatility layers —
//                      a STABLE delta-KB keyed {stack,from,to} (immutable once a version ships) and a
//                      VOLATILE tool-capability layer keyed {stack} with a TTL. On `put` it TAGS each
//                      fact VERIFIED (traced to an authoritative source) or INFERRED (no/weak source,
//                      confidence lowered). `get` returns cached facts (hit / stale / miss); `tag`
//                      classifies a source with no write. Prints JSON (--json) or a summary.
// What it touches:     Reads/writes ONLY JSON cache files under the cache dir (default
//                      .claude/migration-knowledge/, override with --cache-dir). Reads process.argv.
// What it does NOT do: NO network — the LLM performs web-grounding (WebSearch) and feeds results in;
//                      this engine only caches + tags them. No git, no code edits, no LLM call, no
//                      project-source mutation. Never fabricates facts — a fact only exists once put.
// APIs / commands:     Node stdlib: fs (sync JSON read/write), path. Exit codes ARE the contract:
//                      get 0=hit · 6=stale(volatile past TTL) · 7=miss; put 0=stored ·
//                      8=immutable-conflict(stable); tag 0; 1=usage/error.
// How to verify:       node scripts/upgrade-knowledge-cache.cjs put --stack=dotnet --from=6 --to=8 \
//                        --fact="ApiController base changed" --source=https://learn.microsoft.com/... \
//                        --cache-dir=/tmp/kb --now=2026-09-08 --json   -> tier "VERIFIED"
//                      node tests/upgrade-knowledge-cache.test.cjs  -> "N passed · 0 failed".

'use strict';
const fs   = require('fs');
const path = require('path');
// classifySource/confidenceFor extracted to a shared lib (ADO-9004 Story 1) — single source of
// truth for source-authority tagging, reused by knowledge-freshness.cjs.
const { classifySource, confidenceFor } = require('./lib/source-classifier.cjs');

// ── Args ────────────────────────────────────────────────────────────────────
const OP       = (process.argv[2] || '').trim().toLowerCase();
const JSON_OUT = process.argv.includes('--json');
const arg = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const STACK  = (arg('stack') || '').trim().toLowerCase();
const FROM   = (arg('from')  || '').trim();
const TO     = (arg('to')    || '').trim();
const LAYER  = (arg('layer') || 'stable').trim().toLowerCase();       // stable | volatile
const SOURCE = (arg('source') || '').trim();
const FACT   = (arg('fact')   || '').trim();
const CACHE_DIR = arg('cache-dir') || path.join('.claude', 'migration-knowledge');
const TTL_DAYS  = Number.isFinite(Number(arg('ttl-days'))) && arg('ttl-days') !== undefined ? Number(arg('ttl-days')) : 14;
// `--now` seams the "today" date so tests are deterministic; defaults to the system date otherwise.
const NOW = (arg('now') || new Date().toISOString().slice(0, 10)).trim();

// Source-authority tagging (AUTHORITATIVE / hostOf / classifySource / confidenceFor) lives in
// ./lib/source-classifier.cjs (extracted ADO-9004 Story 1) — imported at the top of this file.

// ── Deterministic fact id (no randomness — same text => same id, so `put` is idempotent) ──
// DECISION: how to identify a fact for de-dup + immutability checks
// Options considered:
//   A) random/uuid id — rejected: re-putting the same fact would duplicate it and break the
//      "immutable once shipped" guarantee for the stable layer; also non-reproducible in tests
//   B) crypto hash — rejected: heavier than needed for a short cache key, adds no value here
//   C) small deterministic string hash (djb2) of the fact text — chosen: stable, dependency-free,
//      collision risk negligible at cache scale
function factId(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

// ── Cache file paths ──────────────────────────────────────────────────────────
function layerFile(layer) {
  if (layer === 'volatile') return path.join(CACHE_DIR, 'tool-layer', `${STACK}.json`);
  return path.join(CACHE_DIR, 'delta-kb', `${STACK}-${FROM}-${TO}.json`);
}

function loadLayer(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`Corrupt cache file ${file}: ${e.message}`); }
}

function saveLayer(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

const daysBetween = (fromIso, toIso) =>
  Math.floor((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);

// ── Operations ──────────────────────────────────────────────────────────────
function opPut() {
  if (!STACK) throw new Error('put requires --stack');
  if (!FACT)  throw new Error('put requires --fact="<claim text>"');
  if (LAYER === 'stable' && (!FROM || !TO)) throw new Error('stable put requires --from and --to');

  const { tier, authoritative, host } = classifySource(STACK, SOURCE);
  const record = {
    id: factId(FACT), text: FACT, tier, authoritative,
    source: SOURCE || null, source_host: host || null, source_date: arg('source-date') || null,
    confidence: confidenceFor(tier, arg('confidence')), cached_at: NOW,
  };

  const file = layerFile(LAYER);
  const existing = loadLayer(file) || {
    layer: LAYER, stack: STACK,
    ...(LAYER === 'stable' ? { from: FROM, to: TO } : { ttl_days: TTL_DAYS }),
    cached_at: NOW, facts: [],
  };
  existing.cached_at = NOW;
  if (LAYER === 'volatile') existing.ttl_days = TTL_DAYS;

  const prior = existing.facts.find(f => f.id === record.id);
  if (prior) {
    // Stable layer is immutable once a version ships: identical re-put is idempotent, but a
    // changed claim under the same id is a contract violation the caller must resolve.
    if (LAYER === 'stable' && prior.text !== record.text) {
      return { op: 'put', status: 'immutable-conflict', file, id: record.id,
               reason: 'stable delta-KB is immutable; a differing fact shares this id', prior };
    }
    if (LAYER === 'volatile') { Object.assign(prior, record); }   // volatile facts refresh in place
    saveLayer(file, existing);
    return { op: 'put', status: 'stored', duplicate: LAYER === 'stable', file, record };
  }

  existing.facts.push(record);
  saveLayer(file, existing);
  return { op: 'put', status: 'stored', duplicate: false, file, record };
}

function opGet() {
  if (!STACK) throw new Error('get requires --stack');
  if (LAYER === 'stable' && (!FROM || !TO)) throw new Error('stable get requires --from and --to');

  const file = layerFile(LAYER);
  const data = loadLayer(file);
  if (!data || !data.facts?.length) return { op: 'get', status: 'miss', file };

  if (LAYER === 'volatile') {
    const age = daysBetween(data.cached_at, NOW);
    const ttl = Number.isFinite(data.ttl_days) ? data.ttl_days : TTL_DAYS;
    if (age > ttl) return { op: 'get', status: 'stale', age_days: age, ttl_days: ttl, file, ...data };
    return { op: 'get', status: 'hit', age_days: age, ttl_days: ttl, file, ...data };
  }
  return { op: 'get', status: 'hit', file, ...data };   // stable facts never go stale
}

function opTag() {
  if (!STACK) throw new Error('tag requires --stack');
  const c = classifySource(STACK, SOURCE);
  return { op: 'tag', ...c, confidence: confidenceFor(c.tier, arg('confidence')), source: SOURCE || null };
}

// ── Output + exit-code contract ────────────────────────────────────────────────
const GET_EXIT = { hit: 0, stale: 6, miss: 7 };
const PUT_EXIT = { stored: 0, 'immutable-conflict': 8 };

module.exports = { classifySource, confidenceFor, factId };

if (require.main === module) {
  try {
    let result, exit;
    if (OP === 'put')      { result = opPut(); exit = PUT_EXIT[result.status] ?? 1; }
    else if (OP === 'get') { result = opGet(); exit = GET_EXIT[result.status] ?? 1; }
    else if (OP === 'tag') { result = opTag(); exit = 0; }
    else {
      process.stderr.write('usage: upgrade-knowledge-cache.cjs <put|get|tag> --stack=<s> [--from --to] [--layer=stable|volatile] [--fact --source] [--json]\n');
      process.exit(1);
    }

    if (JSON_OUT) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      const lines = [`op: ${result.op}`, `status: ${result.status}`];
      if (result.record) lines.push(`tier: ${result.record.tier} (confidence ${result.record.confidence})`,
                                    `source: ${result.record.source || 'none'} [${result.record.authoritative ? 'authoritative' : 'unverified'}]`);
      if (result.tier && !result.record) lines.push(`tier: ${result.tier} (confidence ${result.confidence})`);
      if (result.facts) lines.push(`facts: ${result.facts.length}`);
      if (result.age_days !== undefined) lines.push(`age: ${result.age_days}d (ttl ${result.ttl_days}d)`);
      if (result.reason) lines.push(`reason: ${result.reason}`);
      process.stdout.write(lines.join('\n') + '\n');
    }
    process.exit(exit);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }
}
