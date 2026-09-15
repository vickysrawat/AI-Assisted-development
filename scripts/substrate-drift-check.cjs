#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Substrate drift-check (the anti-drift half of the standalone-packaging SEAM;
//                      CI-enforced in Story 3). Reads a bundle's manifest and verifies, per file:
//                      (1) the CURRENT canonical file still hashes to the manifest hash (canonical
//                      changed since bundling), and (2) the bundled COPY, with its GENERATED banner
//                      stripped, still hashes to the manifest hash (bundled copy hand-edited). Any
//                      mismatch — or a missing file, or an overall content_hash mismatch — is DRIFT.
// What it touches:     Reads the bundle manifest + bundled copies (--dest) and the canonical source
//                      (--src). Writes nothing.
// What it does NOT do: No network, no git, no LLM, no writes, no auto-fix (it only reports).
// APIs / commands:     Node stdlib: fs, path, crypto (sha256). Exit codes: 0=no drift · 10=drift ·
//                      1=usage/error (e.g. missing manifest).
// How to verify:       node scripts/substrate-drift-check.cjs --dest=.vendor/skills-shared --src=skills/shared
//                      node tests/substrate-drift.test.cjs  -> "N passed · 0 failed".

'use strict';
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MANIFEST } = require('./vendor-substrate.cjs');

const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const SRC  = arg('src')  || path.join('skills', 'shared');
const DEST = arg('dest') || path.join('.vendor', 'skills-shared');
const JSON_OUT = process.argv.includes('--json');

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
// The bundled copy carries a single leading banner line the canonical hash excludes — strip it back
// off before comparing so a clean bundled copy matches its manifest hash.
const stripBanner = (s) => s.startsWith('<!-- GENERATED — DO NOT EDIT') ? s.slice(s.indexOf('\n') + 1) : s;

function check() {
  const manifestPath = path.join(DEST, MANIFEST);
  if (!fs.existsSync(manifestPath)) throw new Error(`no bundle manifest at ${manifestPath} — run vendor-substrate.cjs first`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const drift = [];
  for (const entry of manifest.files) {
    const canonicalPath = path.join(SRC, entry.name);
    const bundledPath   = path.join(DEST, entry.name);

    if (!fs.existsSync(canonicalPath)) { drift.push({ file: entry.name, reason: 'canonical missing' }); continue; }
    if (sha256(fs.readFileSync(canonicalPath, 'utf8')) !== entry.sha256)
      drift.push({ file: entry.name, reason: 'canonical changed since bundling' });

    if (!fs.existsSync(bundledPath)) { drift.push({ file: entry.name, reason: 'bundled copy missing' }); continue; }
    if (sha256(stripBanner(fs.readFileSync(bundledPath, 'utf8'))) !== entry.sha256)
      drift.push({ file: entry.name, reason: 'bundled copy edited' });
  }

  // Overall content hash must also still match (catches added/removed files).
  const recomputed = sha256(JSON.stringify(manifest.files.map(f => ({ name: f.name, sha256: f.sha256 }))));
  const contentHashOk = recomputed === manifest.content_hash;
  if (!contentHashOk) drift.push({ file: '(manifest)', reason: 'content_hash mismatch' });

  return { op: 'drift-check', status: drift.length ? 'drift' : 'clean', substrate_version: manifest.substrate_version, drift };
}

module.exports = { check };

if (require.main === module) {
  try {
    const r = check();
    if (JSON_OUT) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    else if (r.status === 'clean') process.stdout.write(`✓ no drift — bundled substrate matches canonical (v${r.substrate_version})\n`);
    else { process.stdout.write(`✗ DRIFT detected (v${r.substrate_version}):\n`); r.drift.forEach(d => process.stdout.write(`  - ${d.file}: ${d.reason}\n`)); }
    process.exit(r.status === 'drift' ? 10 : 0);
  } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
}
