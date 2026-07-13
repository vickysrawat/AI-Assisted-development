#!/usr/bin/env node
// scripts/plugin-state.cjs
// Fast, node-only, deterministic report of plugin version state. ONE call yields everything the
// version/drift checks need — so no consumer ever recursively `find`s the plugin cache or builds a
// plugin path from a (possibly stale) state version.
//
// Resolves the INSTALLED version + install path from ~/.claude/plugins/installed_plugins.json (the
// authoritative registry), reads the PROVISIONED version from ./.claude/dream-init-state.json in the
// current working directory (the target project), and computes drift.
//
// Usage:
//   node plugin-state.cjs            → KEY=value lines (default; eval-friendly for bash)
//   node plugin-state.cjs --json     → JSON object
//   node plugin-state.cjs --field INSTALL_PATH   → just that value
//
// KEY=value output is designed for:  eval "$(node "$PLUGIN_DIR/scripts/plugin-state.cjs")"
// then use $INSTALLED_VERSION / $INSTALL_PATH / $PROVISIONED_VERSION / $DRIFT.
//
// DRIFT ∈ UP_TO_DATE | UPGRADE_PENDING | DOWNGRADE | NO_STATE | INSTALLED_UNKNOWN
// Exit code is always 0 — DRIFT encodes the state (so callers never branch on exit status).

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const PLUGIN = 'ai-assisted-development';

// ── Resolve installed version + installPath from the registry (never a recursive find) ──
// Same shape as skills/shared/plugin-path-resolution.md §1b. Uses os.homedir()/path.join only —
// never a bash-passed /c/... MSYS path (Node on Windows rejects those).
function resolveInstalled() {
  const base = path.join(os.homedir(), '.claude', 'plugins');
  // 1) registry: installed_plugins.json → prefer user scope
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(base, 'installed_plugins.json'), 'utf8'));
    const key = Object.keys(reg.plugins || {}).find(k => k.startsWith(PLUGIN + '@'));
    if (key) {
      const arr = reg.plugins[key] || [];
      const e = arr.find(x => x.scope === 'user') || arr[0];
      if (e && e.installPath && fs.existsSync(e.installPath)) {
        let ver = e.version || '';
        if (!ver) {
          try { ver = JSON.parse(fs.readFileSync(path.join(e.installPath, '.claude-plugin', 'plugin.json'), 'utf8')).version || ''; } catch (x) {}
        }
        return { version: ver, installPath: e.installPath };
      }
    }
  } catch (x) {}
  // 2) fallback: shallow scan of ~/.claude/plugins/*/plugins/ai-assisted-development (one level, no crawl)
  try {
    for (const m of fs.readdirSync(base)) {
      const d = path.join(base, m, 'plugins', PLUGIN);
      if (fs.existsSync(d)) {
        let ver = '';
        try { ver = JSON.parse(fs.readFileSync(path.join(d, '.claude-plugin', 'plugin.json'), 'utf8')).version || ''; } catch (x) {}
        return { version: ver, installPath: d };
      }
    }
  } catch (x) {}
  return { version: '', installPath: '' };
}

// ── Provisioned version from the CURRENT PROJECT's state (relative to CWD, not the plugin) ──
function readProvisioned() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.claude', 'dream-init-state.json'), 'utf8'));
    return s.dream_init_plugin_version || '';
  } catch (x) { return ''; }
}

const installed    = resolveInstalled();
const provisioned  = readProvisioned();

// Semantic (X.Y.Z) comparison so 1.10.0 > 1.9.0 sorts correctly, not lexically.
function semver(v) { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v || ''); return m ? [+m[1], +m[2], +m[3]] : null; }

let drift;
if (!installed.version)      drift = 'INSTALLED_UNKNOWN';
else if (!provisioned)       drift = 'NO_STATE';
else {
  const pi = semver(installed.version), pp = semver(provisioned);
  if (pi && pp) {
    const c = (pi[0] - pp[0]) || (pi[1] - pp[1]) || (pi[2] - pp[2]);
    drift = c === 0 ? 'UP_TO_DATE' : (c > 0 ? 'UPGRADE_PENDING' : 'DOWNGRADE');
  } else {
    drift = (provisioned === installed.version) ? 'UP_TO_DATE' : 'UPGRADE_PENDING';
  }
}

// Normalise Windows backslashes to forward slashes for consistent bash consumption.
const norm = p => (p ? p.split(path.sep).join('/') : '');

const state = {
  INSTALLED_VERSION:    installed.version || 'unknown',
  INSTALL_PATH:         norm(installed.installPath),
  PROVISIONED_VERSION:  provisioned || 'none',
  DRIFT:                drift,
};

// ── Output ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes('--json')) {
  process.stdout.write(JSON.stringify(state) + '\n');
} else if (args.includes('--field')) {
  const f = args[args.indexOf('--field') + 1];
  process.stdout.write((state[f] != null ? String(state[f]) : '') + '\n');
} else {
  // Default: KEY=value lines. Quote values so `eval "$(...)"` is safe with spaces in paths.
  for (const k of Object.keys(state)) {
    process.stdout.write(k + '=' + JSON.stringify(String(state[k])) + '\n');
  }
}
process.exit(0);
