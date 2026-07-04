#!/usr/bin/env node
// ai-assisted-development — uninstall cleanup engine
//
// Removes global plugin config left behind by uninstall:
//   • the plugin cache dir (all versions) under ~/.claude/plugins/cache/<marketplace>/<plugin>
//   • caches orphaned by a marketplace rename or past version bumps
//   • stale extraKnownMarketplaces entries in ~/.claude/settings.json
//
// Dry-run by default (prints the plan); pass --apply to actually delete.
// Only ever touches paths under ~/.claude/plugins. Invoked by install.sh / install.ps1.
//
// Usage: node uninstall-cleanup.js --plugin <name> --marketplace <currentName> [--apply]

const fs = require('fs');
const os = require('os');
const path = require('path');

// ── args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argVal(name) { const i = args.indexOf(name); return (i >= 0 && i + 1 < args.length) ? args[i + 1] : null; }
const PLUGIN     = argVal('--plugin') || 'ai-assisted-development';
const CURRENT_MP = argVal('--marketplace') || '';
const APPLY      = args.includes('--apply');

const PLUGINS_ROOT = path.join(os.homedir(), '.claude', 'plugins');
const CACHE_ROOT   = path.join(PLUGINS_ROOT, 'cache');
const SETTINGS     = path.join(os.homedir(), '.claude', 'settings.json');

// ── helpers ─────────────────────────────────────────────────────────────────────
function exists(p) { try { fs.accessSync(p); return true; } catch (e) { return false; } }
function isDir(p)  { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }
function listDir(p){ try { return fs.readdirSync(p); } catch (e) { return []; } }

// Safety guard: never delete anything outside ~/.claude/plugins (and never the root itself).
function underRoot(p) {
  const rel = path.relative(PLUGINS_ROOT, p);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}
function safeRm(p) {
  if (!underRoot(p)) { console.error('    ! refusing to delete outside plugins root: ' + p); return false; }
  fs.rmSync(p, { recursive: true, force: true });
  return true;
}

// ── discover "our" marketplaces ─────────────────────────────────────────────────
// current name + every cache/<name>/<plugin> that exists (catches rename orphans;
// never matches unrelated marketplaces that never hosted this plugin).
const mpSet = new Set();
if (CURRENT_MP) mpSet.add(CURRENT_MP);
for (const name of listDir(CACHE_ROOT)) {
  if (exists(path.join(CACHE_ROOT, name, PLUGIN))) mpSet.add(name);
}

// ── build removal plan ────────────────────────────────────────────────────────
const dirPlan = []; // { path, why }
for (const name of mpSet) {
  const cacheDir = path.join(CACHE_ROOT, name, PLUGIN);
  if (exists(cacheDir)) dirPlan.push({ path: cacheDir, why: 'cache (' + name + ', all versions)' });

  const srcDir       = path.join(PLUGINS_ROOT, name);
  const srcPluginDir = path.join(srcDir, 'plugins', PLUGIN);
  if (exists(srcDir)) {
    const marketplaceJson = path.join(srcDir, '.claude-plugin', 'marketplace.json');
    const pluginsSub      = path.join(srcDir, 'plugins');
    // Ours to remove wholesale only if it is a dedicated marketplace hosting just this plugin.
    const onlyOurPlugin = isDir(pluginsSub) && listDir(pluginsSub).every(x => x === PLUGIN);
    if (exists(marketplaceJson) && onlyOurPlugin) {
      dirPlan.push({ path: srcDir, why: 'marketplace source dir (' + name + ')' });
    } else if (exists(srcPluginDir)) {
      dirPlan.push({ path: srcPluginDir, why: 'plugin source subtree (' + name + ', shared marketplace)' });
    }
  }
}

// settings keys to strip
let settings = null;
const settingsKeys = [];
if (exists(SETTINGS)) {
  try { settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch (e) { settings = null; }
  if (settings && settings.extraKnownMarketplaces) {
    for (const name of mpSet) {
      if (Object.prototype.hasOwnProperty.call(settings.extraKnownMarketplaces, name)) settingsKeys.push(name);
    }
  }
}

// ── print plan ──────────────────────────────────────────────────────────────────
console.log('  Plugin config cleanup (' + (APPLY ? 'APPLYING' : 'dry-run') + '):');
if (dirPlan.length === 0 && settingsKeys.length === 0) {
  console.log('    (nothing to remove — already clean)');
}
for (const d of dirPlan)     console.log('    dir : ' + d.path + '   [' + d.why + ']');
for (const k of settingsKeys) console.log('    key : settings.json  extraKnownMarketplaces.' + k);

if (!APPLY) {
  console.log('  (dry-run — re-run with --apply to remove)');
  process.exit(0);
}

// ── apply ──────────────────────────────────────────────────────────────────────
for (const d of dirPlan) {
  if (safeRm(d.path)) console.log('    ✓ removed ' + d.path);
  // prune now-empty cache/<name> parent (but never the cache root itself)
  const parent = path.dirname(d.path);
  if (parent !== CACHE_ROOT && parent.startsWith(CACHE_ROOT + path.sep) && isDir(parent) && listDir(parent).length === 0) {
    if (safeRm(parent)) console.log('    ✓ pruned empty ' + parent);
  }
}
if (settings && settingsKeys.length) {
  for (const k of settingsKeys) delete settings.extraKnownMarketplaces[k];
  if (Object.keys(settings.extraKnownMarketplaces).length === 0) delete settings.extraKnownMarketplaces;
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
  console.log('    ✓ removed ' + settingsKeys.length + ' stale extraKnownMarketplaces entr' + (settingsKeys.length === 1 ? 'y' : 'ies'));
}
console.log('  Cleanup complete.');
