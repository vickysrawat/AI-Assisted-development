'use strict';
// SCRIPT REVIEW
// What it does:        Writes all plugin-owned entries to ~/.claude/settings.json during install:
//                      (1) extraKnownMarketplaces.<name> — registers the plugin marketplace source;
//                      (2) statusLine — registers context-status-write.cjs for context monitoring.
//                      Skips each entry if it already exists. Creates settings.json if absent.
// What it touches:     ~/.claude/settings.json (read + write). No other files modified.
// What it does NOT do: No network calls. No git operations. No plugin file modifications.
//                      Does not remove or overwrite existing settings entries other than the two above.
// APIs / commands:     Node.js built-ins: fs, os, path, process.argv. No external executables.
// How to verify:       After running, open ~/.claude/settings.json and confirm extraKnownMarketplaces
//                      contains the marketplace entry and statusLine points to context-status-write.cjs.
//
// Usage:
//   node install-configure-settings.cjs \
//     --marketplace-name  NAME \
//     --marketplace-dir   PATH \
//     --plugin-dir        PATH \
//     [--settings-file    PATH]   (default: ~/.claude/settings.json)
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const argv = process.argv.slice(2);
function arg(name) {
  const i = argv.indexOf(name);
  return (i >= 0 && i + 1 < argv.length) ? argv[i + 1] : null;
}

const marketplaceName = arg('--marketplace-name');
const marketplaceDir  = arg('--marketplace-dir');
const pluginDir       = arg('--plugin-dir');
const settingsFile    = arg('--settings-file') || path.join(os.homedir(), '.claude', 'settings.json');

if (!marketplaceName || !marketplaceDir || !pluginDir) {
  process.stderr.write(
    'Usage: node install-configure-settings.cjs' +
    ' --marketplace-name NAME --marketplace-dir PATH --plugin-dir PATH\n'
  );
  process.exit(1);
}

if (!fs.existsSync(settingsFile)) fs.writeFileSync(settingsFile, '{}', 'utf8');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch (_) {}

// extraKnownMarketplaces
if (!settings.extraKnownMarketplaces) settings.extraKnownMarketplaces = {};
if (settings.extraKnownMarketplaces[marketplaceName]) {
  console.log(`  - extraKnownMarketplaces.${marketplaceName} already exists, skipping.`);
} else {
  settings.extraKnownMarketplaces[marketplaceName] = { source: { source: 'directory', path: marketplaceDir } };
  console.log(`  + extraKnownMarketplaces.${marketplaceName} registered`);
}

// statusLine — context window monitoring for skills
const statusLineScript = path.join(pluginDir, 'scripts', 'context-status-write.cjs');
const statusLineCmd    = `node "${statusLineScript}"`;
if (settings.statusLine) {
  console.log('  - statusLine already configured, skipping.');
} else {
  settings.statusLine = statusLineCmd;
  console.log('  + statusLine registered (context window monitoring)');
}

fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n', 'utf8');
console.log(`  ✓ ${settingsFile} updated`);
