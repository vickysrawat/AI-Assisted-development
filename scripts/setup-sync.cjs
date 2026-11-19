#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Brings a provisioned target project up to this plugin's version in one
//                      command (ADO-83) — the deterministic part of /setup-sync. Stamps the version
//                      early, runs setup-init-bootstrap.cjs --mode sync, repo-detect.cjs --force and
//                      the post-detect rule deploy, retries "⚠ NOT DETECTED" git/bash paths in
//                      CLAUDE.md, refreshes external-stack detection when it is already set up,
//                      records the run, then prints the in-range migration notes and what still
//                      needs Claude.
// What it touches:     The target project only (the working directory, or --root): .claude/,
//                      CLAUDE.md, .gitignore / .tfignore and .git/hooks, through the scripts it
//                      runs. The bootstrap also sets autoMemoryEnabled in ~/.claude/settings.json
//                      when the key is absent (unchanged behaviour).
// What it does NOT do: No network calls, no git commits, no LLM. Never deletes rules, hooks or
//                      stubs. Never overwrites state the developer set (governance_mode, output_mode).
// APIs / commands:     Node stdlib: fs, os, path, child_process (spawnSync, execSync). Runs, with the
//                      same node: setup-init-bootstrap.cjs, repo-detect.cjs, external-stack-detection.cjs.
// How to verify:       cd <target repo> && node <plugin>/scripts/setup-sync.cjs -> summary, exit 0.
//                      Exit codes: 0 all steps ok · 1 a step failed (the later steps still ran) ·
//                      2 wrong arguments, or the project was never provisioned.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

const PLUGIN_DIR = path.resolve(__dirname, '..');
const PLUGIN_NAME = 'ai-assisted-development';
const STATE = path.join('.claude', 'dream-init-state.json');
const USAGE = 'Usage: node setup-sync.cjs [--root=<project folder>] [--dry-run] [--verbose]';
// A path the bootstrap could not find; it writes this marker into CLAUDE.md §0b.
const NOT_DETECTED = /⚠ NOT DETECTED — run where\.exe (git|bash) and update manually/;
const NOT_DETECTED_ALL = new RegExp(NOT_DETECTED.source, 'g');

/**
 * Reads the command line: --root=<folder>, --dry-run, --verbose, --help. Anything else is
 * reported back in `bad`.
 */
function parseArgs(argv) {
  const opts = { root: process.cwd(), dryRun: false, verbose: false, help: false, bad: null };
  for (const a of argv) {
    if (a.startsWith('--root=')) opts.root = path.resolve(a.slice('--root='.length));
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--verbose') opts.verbose = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else opts.bad = a;
  }
  return opts;
}

/**
 * Parses a JSON file; null when it is missing or not valid JSON.
 */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Reads the project state, lets `mutate` change it, and writes it back.
 */
function updateState(mutate) {
  const state = readJson(STATE) || {};
  mutate(state);
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
  return state;
}

/**
 * True for an x.y.z version string.
 */
function isVersion(v) {
  return /^\d+\.\d+\.\d+$/.test(String(v));
}

/**
 * Compares two x.y.z versions: negative when a < b, 0 when equal, positive when a > b.
 */
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/**
 * The migration notes (docs/migrations/NNN-x.y.z.md) newer than `from` and up to `to`, oldest
 * first, as { version, file, title }. Other files in the folder (README.md, dated notes) are
 * ignored.
 */
function migrationNotes(dir, from, to) {
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
  return files
    .map(name => ({ name, m: /^\d+-(\d+\.\d+\.\d+)\.md$/.exec(name) }))
    .filter(x => x.m && compareVersions(x.m[1], from) > 0 && compareVersions(x.m[1], to) <= 0)
    .sort((a, b) => compareVersions(a.m[1], b.m[1]))
    .map(x => {
      const file = path.join(dir, x.name);
      const heading = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.startsWith('# '));
      return { version: x.m[1], file, title: heading ? heading.slice(2).trim() : x.name };
    });
}

/**
 * The version and folder Claude Code has registered for this plugin, or null.
 */
function registeredInstall() {
  const reg = readJson(path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json'));
  const key = reg && Object.keys(reg.plugins || {}).find(k => k.startsWith(PLUGIN_NAME + '@'));
  if (!key) return null;
  const entries = reg.plugins[key] || [];
  const entry = entries.find(e => e.scope === 'user') || entries[0];
  return entry ? { version: entry.version, dir: entry.installPath } : null;
}

/**
 * Runs one of the plugin's scripts with the same node, in the project folder. Its output is
 * kept for the summary and shown as it is only with --verbose.
 */
function runScript(script, args, verbose) {
  const r = spawnSync(process.execPath, [path.join(PLUGIN_DIR, 'scripts', script), ...args], {
    encoding: 'utf8',
    env: process.env,
  });
  const out = (r.stdout || '') + (r.stderr || '') + (r.error ? r.error.message + '\n' : '');
  if (verbose) process.stdout.write(out.replace(/^/gm, '      | '));
  return { status: r.status === null ? -1 : r.status, out };
}

/**
 * The warning lines a script printed (⚠ lines, and the "·" lines of the bootstrap's warning list).
 */
function warningsIn(out) {
  const lines = out.split(/\r?\n/).map(l => l.trim());
  const start = lines.indexOf('⚠ Warnings:');
  const listed = start < 0 ? [] : lines.slice(start + 1).filter(l => l.startsWith('· ')).map(l => l.slice(2));
  const flagged = lines.filter(l => l.startsWith('⚠') && l !== '⚠ Warnings:');
  return [...listed, ...flagged];
}

/**
 * The last few lines of a failed script's output, for the summary.
 */
function tail(out, n = 3) {
  return out.trim().split(/\r?\n/).slice(-n).map(l => l.trim());
}

// ---------------------------------------------------------------- steps

/**
 * Bootstrap in sync mode: hooks, command stubs, plugin-owned skills, plugin-path.txt,
 * CLAUDE.md sections, the ignore file and .hashes.
 */
function stepBootstrap(opts) {
  const r = runScript('setup-init-bootstrap.cjs', ['--mode', 'sync'], opts.verbose);
  if (r.status !== 0) return { status: 'fail', text: 'bootstrap --mode sync failed (exit ' + r.status + ')', details: tail(r.out) };
  const warnings = warningsIn(r.out);
  return {
    status: warnings.length ? 'warn' : 'ok',
    text: 'hooks, stubs, skills, plugin-path.txt, CLAUDE.md sections and ignore file refreshed',
    details: warnings,
  };
}

/**
 * Re-detects the stack (repo-detect --force). "Nothing recognisable" keeps the old repo_type.
 */
function stepDetect(opts) {
  const r = runScript('repo-detect.cjs', ['--force', '--root=.'], opts.verbose);
  const type = (/^REPO_TYPE=(.*)$/m.exec(r.out) || [])[1];
  const stacks = (/^DETECTED_STACKS=(.*)$/m.exec(r.out) || [])[1];
  if (r.status === 0) return { status: 'ok', text: `stack detected: ${type} (${stacks || 'no stacks'})` };
  const kept = (readJson(STATE) || {}).repo_type || 'none';
  if (r.status === 3) return { status: 'warn', text: `no recognisable project structure — kept repo_type ${kept}` };
  return { status: 'fail', text: 'repo-detect failed (exit ' + r.status + ')', details: tail(r.out) };
}

/**
 * Redeploys the rules for the detected repo type (bootstrap --mode post-detect). Rules a
 * developer edited stay protected by .claude/rules/.hashes.
 */
function stepRules(opts) {
  const type = (readJson(STATE) || {}).repo_type;
  if (!type) return { status: 'warn', text: 'rules not redeployed: repo_type is empty (setup-init not finished?)' };
  const r = runScript('setup-init-bootstrap.cjs', ['--mode', 'post-detect', '--repo-type', type], opts.verbose);
  if (r.status !== 0) return { status: 'fail', text: 'rule deploy failed (exit ' + r.status + ')', details: tail(r.out) };
  const warnings = warningsIn(r.out);
  return { status: warnings.length ? 'warn' : 'ok', text: 'rules redeployed for ' + type, details: warnings };
}

/**
 * Finds git or bash the way the bootstrap does (where.exe, then which); '' when not found.
 */
function findTool(name) {
  for (const cmd of ['where.exe ' + name, 'which ' + name]) {
    try {
      const found = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).split(/\r?\n/)[0].trim();
      if (found) return found;
    } catch (e) {
      // try the next command
    }
  }
  return '';
}

/**
 * The bootstrap fills {GIT_PATH} / {BASH_PATH} but never retries a path it could not find
 * on an earlier run. Retry those "⚠ NOT DETECTED" markers here.
 */
function stepClaudePaths() {
  if (!fs.existsSync('CLAUDE.md')) return { status: 'ok', text: 'CLAUDE.md paths: no CLAUDE.md' };
  const text = fs.readFileSync('CLAUDE.md', 'utf8');
  if (!NOT_DETECTED.test(text)) return { status: 'ok', text: 'CLAUDE.md git/bash paths resolved' };
  const found = { git: findTool('git'), bash: findTool('bash') };
  const fixed = text.replace(NOT_DETECTED_ALL, (marker, tool) => found[tool] || marker);
  if (fixed !== text) fs.writeFileSync('CLAUDE.md', fixed);
  const missing = Object.keys(found).filter(t => !found[t] && new RegExp('run where\\.exe ' + t).test(text));
  return missing.length
    ? { status: 'warn', text: 'CLAUDE.md: ' + missing.join(', ') + ' path still not found — edit §0b by hand' }
    : { status: 'ok', text: 'CLAUDE.md git/bash paths resolved (retried)' };
}

/**
 * Refreshes external_detected_stacks when the developer was already asked about external
 * repos, or additionalDirectories is set. Asking for the first time needs Claude.
 */
function stepExternalStacks(opts) {
  const state = readJson(STATE) || {};
  const local = readJson(path.join('.claude', 'settings.local.json')) || {};
  const hasDirs = (local.additionalDirectories || []).length > 0;
  if (state.external_stacks_prompted !== true && !hasDirs) {
    return { status: 'skip', text: 'external stacks: never set up (needs Claude, or run /sync-dirs)' };
  }
  if (state.external_stacks_prompted !== true) updateState(s => { s.external_stacks_prompted = true; });
  const r = runScript('external-stack-detection.cjs', [], opts.verbose);
  if (r.status !== 0) return { status: 'fail', text: 'external-stack detection failed (exit ' + r.status + ')', details: tail(r.out) };
  const line = r.out.split(/\r?\n/).find(l => l.startsWith('external_detected_stacks')) || 'external stacks refreshed';
  return { status: 'ok', text: line.trim() };
}

/**
 * Records the run and fills in state fields added by later plugin versions, only when absent.
 */
function stepRecordRun(version) {
  const today = new Date().toISOString().slice(0, 10);
  const added = [];
  updateState(s => {
    s.dream_init_plugin_version = version;
    s.dream_sync_last_run = today;
    if (s.governance_mode === undefined) { s.governance_mode = 'full'; added.push('governance_mode=full'); }
    if (s.output_mode === undefined) { s.output_mode = 'verbose'; added.push('output_mode=verbose'); }
  });
  return { status: 'ok', text: 'run recorded (dream_sync_last_run ' + today + ')' + (added.length ? '; added ' + added.join(', ') : '') };
}

/**
 * What still needs Claude (or a person) in this project, as [id, explanation] pairs.
 */
function needsClaude(notes, versionChanged) {
  const state = readJson(STATE) || {};
  const local = readJson(path.join('.claude', 'settings.local.json')) || {};
  const items = [];
  if (notes.length) items.push(['migration-notes', `read the ${notes.length} migration note(s) above and do any manual step they list`]);
  if (!(state.detected_stacks || []).length) items.push(['setup-init', 'detected_stacks is empty — finish /setup-init']);
  if (state.external_stacks_prompted !== true && !(local.additionalDirectories || []).length) {
    items.push(['external-repos', 'never asked which external repos this project calls — /setup-sync asks, or run /sync-dirs']);
  }
  const bc = path.join('.claude', 'business-context.md');
  if (!fs.existsSync(bc) || fs.readFileSync(bc, 'utf8').split(/\r?\n/)[0].includes('Not yet generated')) {
    items.push(['business-context', '.claude/business-context.md missing — run SET DOMAIN']);
  }
  if (!fs.existsSync(path.join('docs', 'ONBOARDING.md'))) items.push(['onboarding-guide', 'docs/ONBOARDING.md missing — run ONBOARDING GUIDE']);
  if (versionChanged && fs.existsSync(path.join('.claude', 'graph', 'graph.json'))) {
    items.push(['graph-sync', 'the knowledge graph is likely stale after an upgrade — run /graph-sync']);
  }
  if (fs.existsSync('CLAUDE.md') && fs.readFileSync('CLAUDE.md', 'utf8').includes('⚠ NOT DETECTED')) {
    items.push(['claude-md-paths', 'CLAUDE.md still has a "⚠ NOT DETECTED" value (git, bash or target branch) — fill it in by hand']);
  }
  return items;
}

// ---------------------------------------------------------------- main

const MARK = { ok: '✓', warn: '⚠', fail: '✗', skip: '—' };

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (opts.bad) {
    console.error('setup-sync: unknown argument ' + opts.bad + '\n' + USAGE);
    return 2;
  }
  if (!fs.existsSync(opts.root)) {
    console.error('setup-sync: folder not found: ' + opts.root);
    return 2;
  }
  process.chdir(opts.root);
  const state = readJson(STATE);
  if (!state) {
    console.error(`setup-sync: ${path.join(opts.root, STATE)} not found or not valid JSON — this project`
      + ' was never provisioned by the plugin. Run /setup-init first.');
    return 2;
  }

  const to = (readJson(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json')) || {}).version || 'unknown';
  const from = state.dream_init_plugin_version || 'unknown';
  console.log(`setup-sync  v${from} → v${to}  ·  ${opts.root}`);
  console.log(`  plugin: ${PLUGIN_DIR}`);
  const reg = registeredInstall();
  if (reg && reg.version && reg.version !== to) {
    console.log(`  ⚠ Claude Code has v${reg.version} installed, but this script is v${to}.`
      + ` To sync to the installed version run: node "${path.join(reg.dir, 'scripts', 'setup-sync.cjs')}"`);
  }

  const notes = isVersion(from) && isVersion(to) ? migrationNotes(path.join(PLUGIN_DIR, 'docs', 'migrations'), from, to) : [];
  const steps = [
    ['stamp', () => { updateState(s => { s.dream_init_plugin_version = to; }); return { status: 'ok', text: 'state stamped to v' + to + ' (early, so a partial run is never stale)' }; }],
    ['bootstrap', () => stepBootstrap(opts)],
    ['detect', () => stepDetect(opts)],
    ['rules', () => stepRules(opts)],
    ['claude-md', () => stepClaudePaths()],
    ['external', () => stepExternalStacks(opts)],
    ['record', () => stepRecordRun(to)],
  ];

  let failed = 0;
  if (opts.dryRun) {
    console.log('  dry run — nothing written. Would run: ' + steps.map(s => s[0]).join(' → '));
  } else {
    // DECISION: What to do when one step fails
    // Options considered:
    //   A) Stop at the first failure — rejected: the later steps do not depend on it and are
    //      safe to re-run, so stopping only leaves more of the project out of date
    //   B) Run every step, mark the failure ✗ and exit 1 — chosen (ADO-83 plan, open question 3)
    for (const [name, run] of steps) {
      let result;
      try {
        result = run();
      } catch (err) {
        result = { status: 'fail', text: name + ' failed: ' + err.message };
      }
      if (result.status === 'fail') failed++;
      console.log(`  ${MARK[result.status]} ${result.text}`);
      for (const d of result.details || []) console.log('      ' + d);
    }
  }

  console.log('');
  if (!isVersion(from)) console.log('Migration notes: provisioned version unknown — none selected.');
  else if (!notes.length) console.log(`Migration notes: none between v${from} and v${to}.`);
  else {
    console.log(`Migration notes (${notes.length}):`);
    for (const n of notes) console.log(`  v${n.version}  ${n.title}  —  ${n.file}`);
  }
  const todo = needsClaude(notes, from !== to);
  if (todo.length) {
    console.log('Needs Claude (run /setup-sync in Claude Code, or do these yourself):');
    for (const [id, text] of todo) console.log(`  · ${id.padEnd(17)} ${text}`);
  } else {
    console.log('Nothing needs Claude.');
  }
  console.log('');
  if (failed) {
    console.log(`✗ setup-sync finished with ${failed} failed step(s). Fix the cause and re-run — every step is safe to re-run.`);
    return 1;
  }
  console.log(opts.dryRun ? '✓ dry run complete' : `✓ setup-sync complete — project at v${to}`);
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { parseArgs, compareVersions, migrationNotes, warningsIn };
