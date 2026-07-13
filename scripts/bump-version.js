#!/usr/bin/env node
// Bump the plugin version. `.claude-plugin/plugin.json` "version" is the SINGLE SOURCE OF
// TRUTH; this writes it and propagates the one derived display copy (the CLAUDE.md label),
// prepends a CHANGELOG stub, warns about guide staleness, and runs the drift guard. Node-only
// (no Python). Run from the plugin root.
//
//   node scripts/bump-version.js <X.Y.Z>
//
// For a full release pass (this + git-hook re-sync + the Python validator when available),
// use scripts/bump-version.sh, which wraps this.

const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const NEW = process.argv[2];
if (!NEW || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(NEW)) {
  console.error('Usage: node scripts/bump-version.js <X.Y.Z>');
  process.exit(1);
}

// 1. plugin.json — the source of truth
const PJ = '.claude-plugin/plugin.json';
const pj = JSON.parse(fs.readFileSync(PJ, 'utf8'));
const CUR = pj.version;
if (CUR === NEW) console.log(`Version already ${NEW} — re-propagating derived copies.`);
else console.log(`Bumping ${CUR} → ${NEW}`);
pj.version = NEW;
fs.writeFileSync(PJ, JSON.stringify(pj, null, 2) + '\n');
console.log('  ✓ plugin.json');

// 2. CLAUDE.md label — the only static copy derived from the version
let claude = fs.readFileSync('CLAUDE.md', 'utf8');
claude = claude.replace(/^# Plugin version:.*$/m,
  `# Plugin version: ${NEW} (update this line after setup-init or plugin upgrade)`);
fs.writeFileSync('CLAUDE.md', claude);
console.log('  ✓ CLAUDE.md label');

// 3. CHANGELOG stub — prepend unless the top entry is already this version
const CL = 'CHANGELOG.md';
let changelog = fs.readFileSync(CL, 'utf8');
if (!changelog.startsWith(`## [${NEW}]`)) {
  const today = process.argv[3] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[3])
    ? process.argv[3] : new Date().toISOString().slice(0, 10);
  changelog = `## [${NEW}] — ${today}\n\n### TODO: summary of changes\n\nTODO: describe what changed, which files, and why.\n\n---\n\n` + changelog;
  fs.writeFileSync(CL, changelog);
  console.log('  ✓ CHANGELOG.md — stub prepended (fill in the TODO)');
} else {
  console.log(`  - CHANGELOG.md already has a [${NEW}] entry — left as is`);
}

// 4. Guide staleness reminder (guides have their own doc lifecycle — not auto-stamped)
for (const g of ['plugin-guide.html', 'user-guide.html']) {
  if (!fs.existsSync(g)) continue;
  const m = fs.readFileSync(g, 'utf8').match(/documents-plugin-version:\s*([0-9.]+)/);
  const gv = m ? m[1] : 'NONE';
  if (gv !== NEW) console.log(`  ⚠ ${g} documents v${gv} — update its content AND stamp to ${NEW} before release`);
}

// 5. Drift guard
console.log('');
const guard = cp.spawnSync(process.execPath, [path.join(__dirname, 'check-version-consistency.js')], { stdio: 'inherit' });
process.exit(guard.status || 0);
