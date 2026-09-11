#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Deterministic, NO-network freshness engine for the migration-knowledge offline
//                      tier. `check` reads freshness-manifest.json + an optional LLM-supplied --latest
//                      JSON and classifies each ref FRESH / STALE-BY-AGE / STALE-BY-VERSION / UNKNOWN.
//                      `restamp` bumps ONE ref's last_verified to --now in the manifest (used by the
//                      skill's refresh flow AFTER human Write-Gate approval).
// What it touches:     `check` reads the manifest (default skills/shared/migration-knowledge/
//                      freshness-manifest.json, override --manifest) + the --latest JSON if given, and
//                      writes nothing. `restamp` writes ONE field (last_verified) back to the manifest.
//                      Reads process.argv.
// What it does NOT do: NO network (the LLM web-grounds and feeds --latest in), NO git, NO LLM call.
//                      `check` never writes. Never guesses version currency — a ref absent from
//                      --latest is UNKNOWN. The ref-CONTENT rewrite on refresh is the skill's job,
//                      gated by APPROVE — this script only restamps the date.
// APIs / commands:     Node stdlib fs, path. Exit codes ARE the contract:
//                      check   0=no ref stale · 9=>=1 ref STALE · 1=usage/read/parse error.
//                      restamp 0=stamped · 10=--path not in manifest · 1=usage/read/parse error.
// How to verify:       node scripts/knowledge-freshness.cjs check --now=2026-09-10          -> table
//                      node tests/knowledge-freshness.test.cjs                               -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const path = require('path');

const OP       = (process.argv[2] || '').trim().toLowerCase();
const JSON_OUT = process.argv.includes('--json');
const arg = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const DEFAULT_MANIFEST = path.join('skills', 'shared', 'migration-knowledge', 'freshness-manifest.json');
const MANIFEST = arg('manifest') || DEFAULT_MANIFEST;
const LATEST   = arg('latest') || null;
// `--now` seams "today" so tests are deterministic; defaults to the system date otherwise.
const NOW = (arg('now') || new Date().toISOString().slice(0, 10)).trim();

const daysBetween = (fromIso, toIso) =>
  Math.floor((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);

// Coarse, forgiving compare — the anchors are freeform ("Node 20 / Express 4-5", "React 18-19").
function normalizeVersion(s) {
  return String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// DECISION: which manifest field is the staleness anchor per ref shape
// Options considered:
//   A) every version token in the ref — rejected: a migration `source` is intentionally old and
//      would raise false STALE positives
//   B) versions (stacks/strategies) else target (mappings/shared), one anchor per ref — chosen:
//      matches how each ref actually decays; keeps --latest a flat path->string map
function anchorOf(ref) {
  if (ref.versions != null) return ref.versions;
  if (ref.target   != null) return ref.target;
  return null;
}

// DECISION: version-compare granularity
// Options considered:
//   A) parse semver + numeric "<" — rejected: anchors are freeform/ranges, no reliable single number
//   B) normalized-string equality; differs => STALE-BY-VERSION — chosen: deterministic, matches the
//      coarse anchor granularity, zero brittle parsing. The script decides differs/matches/unknown
//      only; a human/judge decides whether a difference is a real bump.
// Age axis is independent and needs no --latest. A ref with no --latest entry (or no anchor) is
// UNKNOWN on the version axis — never silently FRESH.
function classifyRef(ref, latestVal, nowIso, ttlDays) {
  const age = daysBetween(ref.last_verified, nowIso);
  if (Number.isFinite(age) && age > ttlDays) return 'STALE-BY-AGE';
  if (latestVal == null) return 'UNKNOWN';
  const anchor = anchorOf(ref);
  if (anchor == null) return 'UNKNOWN';
  return normalizeVersion(anchor) === normalizeVersion(latestVal) ? 'FRESH' : 'STALE-BY-VERSION';
}

function loadJson(file, label) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch (e) { throw new Error(`cannot read ${label} at ${file}: ${e.message}`); }
  try { return JSON.parse(raw); }
  catch (e) { throw new Error(`cannot parse ${label} at ${file}: ${e.message}`); }
}

function opCheck() {
  const manifest = loadJson(MANIFEST, 'manifest');
  const latest   = LATEST ? loadJson(LATEST, '--latest') : null;
  const ttl = Number.isFinite(Number(manifest.default_ttl_days)) ? Number(manifest.default_ttl_days) : 180;
  const rows = (manifest.refs || []).map(ref => {
    const latestVal = latest ? (latest[ref.path] ?? null) : null;
    return {
      path: ref.path, anchor: anchorOf(ref), latest: latestVal,
      last_verified: ref.last_verified, status: classifyRef(ref, latestVal, NOW, ttl),
    };
  });
  const stale = rows.filter(r => r.status === 'STALE-BY-AGE' || r.status === 'STALE-BY-VERSION');
  return { op: 'check', now: NOW, ttl_days: ttl, total: rows.length, stale: stale.length, rows };
}

// Pure — set last_verified=nowIso on the ref matching refPath. Returns {found, manifest}. No IO.
function applyRestamp(manifest, refPath, nowIso) {
  let found = false;
  for (const ref of (manifest.refs || [])) {
    if (ref.path === refPath) { ref.last_verified = nowIso; found = true; }
  }
  return { found, manifest };
}

// restamp writes ONE field back to the manifest. The skill invokes this only AFTER APPROVE — the
// Write Gate governs the human approval; this op performs the deterministic date bump.
function opRestamp() {
  const refPath = arg('path');
  if (!refPath) throw new Error('restamp requires --path=<ref path>');
  const manifest = loadJson(MANIFEST, 'manifest');
  const { found } = applyRestamp(manifest, refPath, NOW);
  if (!found) return { op: 'restamp', status: 'not-found', path: refPath };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  return { op: 'restamp', status: 'stamped', path: refPath, last_verified: NOW };
}

module.exports = { classifyRef, normalizeVersion, anchorOf, daysBetween, applyRestamp };

const RESTAMP_EXIT = { stamped: 0, 'not-found': 10 };

if (require.main === module) {
  try {
    if (OP === 'check') {
      const result = opCheck();
      if (JSON_OUT) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      } else {
        const lines = [`check: ${result.stale}/${result.total} stale (ttl ${result.ttl_days}d, now ${result.now})`];
        for (const r of result.rows) {
          const extra = r.status === 'STALE-BY-VERSION' ? `  (${r.anchor} -> ${r.latest})` : '';
          lines.push(`  ${r.status.padEnd(17)} ${r.path}${extra}`);
        }
        process.stdout.write(lines.join('\n') + '\n');
      }
      process.exit(result.stale > 0 ? 9 : 0);
    } else if (OP === 'restamp') {
      const result = opRestamp();
      if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      else process.stdout.write(`restamp: ${result.status} ${result.path}${result.last_verified ? ` -> ${result.last_verified}` : ''}\n`);
      process.exit(RESTAMP_EXIT[result.status] ?? 1);
    } else {
      process.stderr.write('usage: knowledge-freshness.cjs <check|restamp> [--manifest=<path>] [--latest=<path>] [--path=<ref>] [--now=YYYY-MM-DD] [--json]\n');
      process.exit(1);
    }
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }
}
