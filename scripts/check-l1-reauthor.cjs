// SCRIPT REVIEW
// What it does:        Enforces the L1 guardrail (re-deliver, never re-author): any file under Claude/ or Copilot/
//                      whose basename mirrors an L1 artifact must contain the "GENERATED FROM `Shared/...`" marker;
//                      a mirror lacking it is a hand-authored fork of an L1 standard -> fail.
// What it touches:     Reads Shared/prompt-manifest.json + walks Claude/ and Copilot/. Writes nothing.
// What it does NOT do: No network, no git, no writes, no child processes.
// APIs / commands:     node:fs readdirSync/readFileSync, node:path.
// How to verify:       `node scripts/check-l1-reauthor.cjs` -> "PASS ..." exit 0; strip the marker from a Copilot copy -> exit 1.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MARKER = 'GENERATED FROM';

const walk = (dir, out) => {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
};

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'Shared', 'prompt-manifest.json'), 'utf8'));
} catch (e) {
  console.error(`FAIL - cannot read manifest: ${e.message}`);
  process.exit(1);
}
const l1 = new Set((manifest.artifacts || []).map((a) => path.basename(a.path)));

let failed = 0;
let checked = 0;
for (const h of ['Claude', 'Copilot']) {
  const files = [];
  walk(path.join(ROOT, h), files);
  for (const f of files) {
    if (!l1.has(path.basename(f))) continue;
    checked++;
    if (!fs.readFileSync(f, 'utf8').includes(MARKER)) {
      console.error(`RE-AUTHOR: ${path.relative(ROOT, f)} mirrors an L1 artifact without the GENERATED marker`);
      failed++;
    }
  }
}

if (failed) {
  console.error(`FAIL - ${failed} L1 re-author violation(s)`);
  process.exit(1);
}
console.error(`PASS - ${checked} harness mirror(s) are generated, not re-authored`);
process.exit(0);
