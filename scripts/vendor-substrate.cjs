#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Substrate vendoring build step (the standalone-packaging SEAM; wired into CI
//                      in Story 3). Copies the canonical shared substrate (skills/shared/*.md) into a
//                      vendor bundle, prepends a "GENERATED — DO NOT EDIT" banner to each copy, and
//                      writes a manifest stamping {substrate_version, per-file sha256, overall
//                      content_hash}. The manifest records the CANONICAL content hash (banner
//                      excluded) so drift-check can compare later.
// What it touches:     Reads skills/shared/*.md (--src). Writes copies + .substrate-manifest.json
//                      under the vendor dir (--dest, default .vendor/skills-shared). Nothing else.
// What it does NOT do: No network, no git, no LLM, no edits to the canonical source. Only writes into
//                      the vendor dir.
// APIs / commands:     Node stdlib: fs, path, crypto (sha256). Exit 0 on success, 1 on error.
// How to verify:       node scripts/vendor-substrate.cjs --src=skills/shared --dest=.vendor/skills-shared --version=1.0
//                      node tests/substrate-drift.test.cjs  -> "N passed · 0 failed".

'use strict';
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const SRC  = arg('src')  || path.join('skills', 'shared');
const DEST = arg('dest') || path.join('.vendor', 'skills-shared');
const NOW  = (arg('now') || new Date().toISOString().slice(0, 10)).trim();
const JSON_OUT = process.argv.includes('--json');

const MANIFEST = '.substrate-manifest.json';
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const banner = (version, name) => `<!-- GENERATED — DO NOT EDIT · vendored substrate ${version} · source: ${SRC}/${name} -->\n`;

function version() {
  if (arg('version')) return arg('version');
  try { return require(path.resolve('.claude-plugin', 'plugin.json')).version || '0.0.0'; }
  catch (_) { return '0.0.0'; }
}

function mdFiles(dir) {
  if (!fs.existsSync(dir)) throw new Error(`substrate source not found: ${dir}`);
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
}

function main() {
  const v = version();
  fs.mkdirSync(DEST, { recursive: true });
  const files = mdFiles(SRC).map(name => {
    const canonical = fs.readFileSync(path.join(SRC, name), 'utf8');
    const hash = sha256(canonical);                       // canonical hash — banner excluded
    fs.writeFileSync(path.join(DEST, name), banner(v, name) + canonical);
    return { name, sha256: hash };
  });
  // Overall content hash is a pure function of the per-file (name, hash) pairs — order-stable.
  const content_hash = sha256(JSON.stringify(files));
  const manifest = { substrate_version: v, vendored_at: NOW, source: SRC, content_hash, files };
  fs.writeFileSync(path.join(DEST, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
  return { op: 'vendor', status: 'ok', dest: DEST, version: v, file_count: files.length, content_hash };
}

module.exports = { sha256, MANIFEST };

if (require.main === module) {
  try {
    const r = main();
    if (JSON_OUT) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    else process.stdout.write(`vendored ${r.file_count} files → ${r.dest} (v${r.version}, content ${r.content_hash.slice(0, 12)}…)\n`);
    process.exit(0);
  } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
}
