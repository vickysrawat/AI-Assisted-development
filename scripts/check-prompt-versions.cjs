// SCRIPT REVIEW
// What it does:        Reads Shared/prompt-manifest.json; for each artifact, recomputes SHA-256 of the on-disk
//                      file and reads its `version:`; fails if hash != manifest (content changed w/o rebuild) or version != manifest.
// What it touches:     Reads Shared/prompt-manifest.json + each listed artifact. Writes nothing.
// What it does NOT do: No network, no git, no writes, no child processes, no env/registry access.
// APIs / commands:     node:fs readFileSync, node:crypto createHash, node:path.
// How to verify:       `node scripts/check-prompt-versions.cjs` -> "PASS ..." exit 0; edit a listed artifact -> exit 1.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const readVersion = (t) => {
  const fm = t.match(/^---\n([\s\S]*?)\n---/);
  if (fm) { const m = fm[1].match(/^version:\s*(.+)$/m); if (m) return m[1].trim(); }
  const p = t.match(/version:\s*([0-9][^\s·_]*)/i);
  return p ? p[1].trim() : null;
};

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'Shared', 'prompt-manifest.json'), 'utf8'));
} catch (e) {
  console.error(`FAIL - cannot read manifest: ${e.message}`);
  process.exit(1);
}

let failed = 0;
for (const a of manifest.artifacts || []) {
  let t;
  try {
    t = fs.readFileSync(path.join(ROOT, a.path), 'utf8');
  } catch {
    console.error(`MISSING: ${a.path}`);
    failed++;
    continue;
  }
  if (sha256(t) !== a.sha256) {
    console.error(`HASH DRIFT: ${a.path} - edited without a version bump + manifest rebuild`);
    failed++;
    continue;
  }
  const v = readVersion(t);
  if (v !== a.version) {
    console.error(`VERSION MISMATCH: ${a.path} - file '${v}' vs manifest '${a.version}'`);
    failed++;
  }
}

if (failed) {
  console.error(`FAIL - ${failed} prompt-version issue(s)`);
  process.exit(1);
}
console.error(`PASS - ${(manifest.artifacts || []).length} artifacts consistent`);
process.exit(0);
