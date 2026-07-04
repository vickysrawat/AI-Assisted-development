#!/usr/bin/env node
// Version drift guard.
//
// `.claude-plugin/plugin.json` "version" is the SINGLE SOURCE OF TRUTH for the plugin
// version. Runtime readers (dream-init, dream-sync, install.sh/.ps1) already read it live.
// This guard checks the few STATIC display copies that must be derived from it, and fails
// (exit 1) on any mismatch. Node-only — no Python needed. Run from the plugin root.
//
//   node scripts/check-version-consistency.js
//
// Hard checks (must match / must be absent):
//   • CLAUDE.md  "# Plugin version: X.Y.Z"  == plugin.json version
//   • marketplace.json must NOT embed a version string (version lives in plugin.json only)
// Warn-only (separate doc lifecycle, not a derived copy):
//   • *.html guide  "documents-plugin-version: X.Y.Z"  — reminder to update before release

const fs = require('fs');

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } }

const pj = read('.claude-plugin/plugin.json');
if (!pj) { console.error('✗ .claude-plugin/plugin.json not found — run from the plugin root'); process.exit(2); }
const VERSION = JSON.parse(pj).version;

const hard = [];
const warn = [];

// CLAUDE.md label — derived, must match
const claude = read('CLAUDE.md');
if (claude) {
  const m = claude.match(/^# Plugin version:\s*([0-9]+\.[0-9]+\.[0-9]+)/m);
  if (!m) hard.push('CLAUDE.md: missing "# Plugin version: X.Y.Z" line');
  else if (m[1] !== VERSION) hard.push(`CLAUDE.md label is ${m[1]}, expected ${VERSION}`);
}

// marketplace.json — must carry NO version (it references the plugin by source; version is plugin.json's)
const mk = read('.claude-plugin/marketplace.json');
if (mk) {
  const m = mk.match(/v?[0-9]+\.[0-9]+\.[0-9]+/);
  if (m) hard.push(`marketplace.json embeds a version "${m[0]}" — remove it (version lives in plugin.json)`);
}

// Guides — independent "which version this doc documents" stamp; warn, don't fail
for (const g of ['plugin-guide.html', 'user-guide.html']) {
  const h = read(g);
  if (!h) continue;
  const m = h.match(/documents-plugin-version:\s*([0-9]+\.[0-9]+\.[0-9]+)/);
  if (m && m[1] !== VERSION) warn.push(`${g} documents v${m[1]} (plugin is ${VERSION}) — update guide content + stamp before release`);
}

for (const w of warn) console.warn('  ⚠ ' + w);
if (hard.length) {
  console.error('✗ version drift (source of truth = plugin.json ' + VERSION + '):');
  for (const h of hard) console.error('  - ' + h);
  process.exit(1);
}
console.log('✓ version consistent with plugin.json (' + VERSION + ')' + (warn.length ? ' — see guide warnings above' : ''));
