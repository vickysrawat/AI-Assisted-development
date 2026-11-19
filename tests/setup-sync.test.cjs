#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/setup-sync.cjs (ADO-83): version compare and migration-note
//                      selection; exit 2 for a project that was never provisioned and for a
//                      wrong argument; a full sync of an out-of-date project (version stamped, a
//                      deleted hook restored, governance_mode kept, output_mode backfilled,
//                      in-range notes listed, a warning when Claude Code has another version
//                      installed); a second run changes nothing; the same end state as
//                      running the four steps by hand; an unrecognisable project keeps going with a
//                      warning and refreshes external stacks when additionalDirectories is set;
//                      a failing step gives exit 1 while the later steps still run;
//                      --dry-run writes nothing. Also tests the installers: install.cjs copies
//                      docs/migrations/ and nothing else from docs/, and install.sh / install.ps1
//                      call their migration-notes copy after both plugin copies.
// What it touches:     Creates throwaway projects and a throwaway HOME under os.tmpdir(), removed
//                      at the end. Every child process gets HOME / USERPROFILE pointing at the
//                      throwaway HOME, so ~/.claude is never touched. Reads the plugin source.
// What it does NOT do: No network calls, no git operations, no writes inside the repository.
// APIs / commands:     Node stdlib: fs, os, path, child_process.spawn.
//                      node scripts/setup-sync.cjs [--root=] [--dry-run]; node scripts/setup-init-bootstrap.cjs;
//                      node scripts/repo-detect.cjs. require('../scripts/setup-sync.cjs'), require('../install.cjs').
// How to verify:       node tests/setup-sync.test.cjs -> "N passed · 0 failed", exit 0.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const SYNC = path.join(SCRIPTS, 'setup-sync.cjs');
const { compareVersions, migrationNotes, parseArgs, warningsIn } = require(SYNC);
const { copyMigrationNotes } = require('../install.cjs');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-sync-'));
const HOME = path.join(TMP, 'home');
const ENV = { ...process.env, HOME, USERPROFILE: HOME };
let passed = 0;
let failed = 0;

/**
 * Records one named check as passed or failed and prints it.
 */
function assert(name, condition, detail) {
  if (condition) {
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } else {
    failed++;
    process.stdout.write(`  ✗ ${name}\n      ${detail || ''}\n`);
  }
}

/**
 * Runs a node script without blocking, so several syncs can run at the same time.
 * Resolves to { status, out }.
 */
function node(args, cwd) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd, env: ENV });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', status => resolve({ status, out }));
  });
}

const stateFile = dir => path.join(dir, '.claude', 'dream-init-state.json');
const readState = dir => JSON.parse(fs.readFileSync(stateFile(dir), 'utf8'));

/**
 * Changes a project's state file.
 */
function editState(dir, mutate) {
  const s = readState(dir);
  mutate(s);
  fs.writeFileSync(stateFile(dir), JSON.stringify(s, null, 2));
}

/**
 * Every file below a folder, relative to it, mapped to its content. Volatile fields (dates,
 * mtimes, the project's own path) are removed from the two JSON files that carry them.
 */
function snapshot(dir) {
  const VOLATILE = new Set(['dream_sync_last_run', 'detected_at', 'mtime', 'startedAt', 'completedAt', 'projectRoot', 'at', 'timestamp']);
  const strip = v => (Array.isArray(v) ? v.map(strip) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.has(k)).map(([k, x]) => [k, strip(x)])) : v);
  const out = {};
  const walk = rel => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) walk(r);
      else {
        let text = fs.readFileSync(path.join(dir, r), 'utf8');
        if (/(_bootstrap-manifest|dream-init-state)\.json$/.test(r)) text = JSON.stringify(strip(JSON.parse(text)));
        out[r] = text;
      }
    }
  };
  walk('');
  return out;
}

/**
 * The files whose content differs between two snapshots, leaving out the names in `ignore`.
 */
function differences(a, b, ignore = []) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter(k => a[k] !== b[k] && !ignore.includes(path.basename(k)));
}

/**
 * A copy of the provisioned base project, made out of date: provisioned at 3.24.0, a hook and
 * a command stub deleted, governance_mode set by the developer, output_mode absent.
 */
function outOfDate(base, name) {
  const dir = path.join(TMP, name);
  fs.cpSync(base, dir, { recursive: true });
  editState(dir, s => {
    s.dream_init_plugin_version = '3.24.0';
    s.governance_mode = 'lightweight';
    delete s.output_mode;
    delete s.dream_sync_last_run;
  });
  fs.rmSync(path.join(dir, '.claude', 'hooks', 'audit-append.cjs'), { force: true });
  fs.rmSync(path.join(dir, '.claude', 'commands', 'explain.md'), { force: true });
  return dir;
}

// ---- pure functions --------------------------------------------------------------------------
function unitCases() {
  process.stdout.write('setup-sync.cjs — functions\n');
  assert('compareVersions orders x.y.z numerically (3.9.0 < 3.10.0)',
    compareVersions('3.9.0', '3.10.0') < 0 && compareVersions('3.28.0', '3.28.0') === 0 && compareVersions('4.0.0', '3.99.9') > 0);
  const dir = path.join(TMP, 'notes');
  fs.mkdirSync(dir);
  for (const f of ['032-3.24.0.md', '033-3.25.0.md', '034-3.29.0.md', '035-3.30.0.md', 'README.md', '2026-09-migration-skill-family.md']) {
    fs.writeFileSync(path.join(dir, f), `# Migration ${f}\n`);
  }
  const picked = migrationNotes(dir, '3.24.0', '3.29.0').map(n => n.version);
  assert('migrationNotes picks notes above the provisioned version up to the installed one, oldest first',
    JSON.stringify(picked) === JSON.stringify(['3.25.0', '3.29.0']), JSON.stringify(picked));
  assert('migrationNotes: same version → none; README.md and dated notes are never picked',
    migrationNotes(dir, '3.29.0', '3.29.0').length === 0 && migrationNotes(dir, '0.0.0', '9.9.9').length === 4);
  assert('migrationNotes: a missing folder gives no notes (no crash)', migrationNotes(path.join(TMP, 'none'), '1.0.0', '2.0.0').length === 0);
  assert('parseArgs reports an unknown argument', parseArgs(['--frobnicate']).bad === '--frobnicate' && parseArgs(['--dry-run']).dryRun === true);
  assert('warningsIn reads the bootstrap warning list and ⚠ lines',
    JSON.stringify(warningsIn('  ⚠ Warnings:\n    · Path detection: x\n  ✓ ok\n  ⚠ careful\n')) === JSON.stringify(['Path detection: x', '⚠ careful']));
}

// ---- installers ------------------------------------------------------------------------------
function installerCases() {
  process.stdout.write('installers — migration notes\n');
  const src = path.join(TMP, 'install-src');
  const dest = path.join(TMP, 'install-dest');
  for (const f of ['docs/migrations/034-3.29.0.md', 'docs/Release3/plan.md']) {
    fs.mkdirSync(path.dirname(path.join(src, f)), { recursive: true });
    fs.writeFileSync(path.join(src, f), 'x');
  }
  copyMigrationNotes(src, dest);
  const docs = fs.readdirSync(path.join(dest, 'docs'));
  assert('install.cjs copies docs/migrations/ and nothing else from docs/',
    JSON.stringify(docs) === JSON.stringify(['migrations']) && fs.existsSync(path.join(dest, 'docs', 'migrations', '034-3.29.0.md')), JSON.stringify(docs));
  const count = (file, re) => (fs.readFileSync(path.join(ROOT, file), 'utf8').match(re) || []).length;
  assert('install.cjs copies the notes after both plugin copies (install and update)',
    count('install.cjs', /safeCopy\(localPath, PLUGIN_DIR\);\r?\n\s*copyMigrationNotes\(localPath, PLUGIN_DIR\);/g) === 2);
  assert('install.sh copies the notes after both plugin copies',
    count('install.sh', /safe_copy "\$LOCAL_PATH" "\$PLUGIN_DIR"\r?\n\s*copy_migration_notes "\$LOCAL_PATH" "\$PLUGIN_DIR"/g) === 2);
  assert('install.ps1 copies the notes after both plugin copies',
    count('install.ps1', /Safe-Copy \$LOCAL_PATH \$PLUGIN_DIR\r?\n\s*Copy-MigrationNotes \$LOCAL_PATH \$PLUGIN_DIR/g) === 2);
}

// ---- end-to-end syncs ------------------------------------------------------------------------
async function syncCases() {
  process.stdout.write('setup-sync.cjs — syncing a project\n');
  fs.mkdirSync(HOME);
  const base = path.join(TMP, 'base');
  fs.mkdirSync(path.join(base, 'src'), { recursive: true });
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'contoso-web', dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' } }));
  fs.writeFileSync(path.join(base, 'src', 'App.jsx'), 'export const App = () => null;\n');
  const init = await node([path.join(SCRIPTS, 'setup-init-bootstrap.cjs'), '--mode', 'init'], base);
  const detect = await node([path.join(SCRIPTS, 'repo-detect.cjs'), '--root=.'], base);
  if (init.status !== 0 || detect.status !== 0) {
    assert('fixture project provisioned', false, init.out.slice(-400) + detect.out);
    return;
  }

  const bare = path.join(TMP, 'never-provisioned');
  fs.mkdirSync(bare);
  const full = outOfDate(base, 'full');
  const byHand = outOfDate(base, 'by-hand');
  const unknown = outOfDate(base, 'unknown');
  fs.rmSync(path.join(unknown, 'package.json'));
  fs.rmSync(path.join(unknown, 'src'), { recursive: true });
  editState(unknown, s => { s.repo_type = ''; });
  // additionalDirectories set but never asked: the script refreshes external stacks itself.
  fs.mkdirSync(path.join(TMP, 'external-repo'));
  fs.writeFileSync(path.join(unknown, '.claude', 'settings.local.json'),
    JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(unknown, '.claude', 'settings.local.json'), 'utf8')), additionalDirectories: [path.join(TMP, 'external-repo')] }));
  editState(unknown, s => { delete s.external_stacks_prompted; });
  const broken = outOfDate(base, 'broken');
  fs.rmSync(path.join(broken, '.claude', 'commands'), { recursive: true });
  fs.writeFileSync(path.join(broken, '.claude', 'commands'), 'not a folder');
  const dry = outOfDate(base, 'dry');
  const dryBefore = snapshot(dry);
  // Claude Code's registry says a different version is installed than the script being run.
  fs.mkdirSync(path.join(HOME, '.claude', 'plugins'), { recursive: true });
  fs.writeFileSync(path.join(HOME, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
    version: 2, plugins: { 'ai-assisted-development@test-marketplace': [{ scope: 'user', version: '0.0.1', installPath: path.join(TMP, 'old-install') }] },
  }));

  const manual = async dir => {
    await node([path.join(SCRIPTS, 'setup-init-bootstrap.cjs'), '--mode', 'sync'], dir);
    await node([path.join(SCRIPTS, 'repo-detect.cjs'), '--force', '--root=.'], dir);
    await node([path.join(SCRIPTS, 'setup-init-bootstrap.cjs'), '--mode', 'post-detect', '--repo-type', readState(dir).repo_type], dir);
    editState(dir, s => { s.dream_init_plugin_version = VERSION; s.output_mode = 'verbose'; });
  };
  const [bareRun, badArg, fullRun, , unknownRun, brokenRun, dryRun] = await Promise.all([
    node([SYNC], bare),
    node([SYNC, '--frobnicate'], full),
    node([SYNC, `--root=${full}`], TMP),
    manual(byHand),
    node([SYNC], unknown),
    node([SYNC], broken),
    node([SYNC, '--dry-run'], dry),
  ]);

  assert('never provisioned: exit 2, says to run /setup-init, writes nothing',
    bareRun.status === 2 && bareRun.out.includes('/setup-init') && !fs.existsSync(path.join(bare, '.claude')), `${bareRun.status} ${bareRun.out}`);
  assert('unknown argument: exit 2 with the usage line', badArg.status === 2 && badArg.out.includes('Usage:'), `${badArg.status} ${badArg.out}`);

  const s = readState(full);
  const today = new Date().toISOString().slice(0, 10);
  assert(`full sync (--root): exit 0, v3.24.0 → v${VERSION}, run recorded`,
    fullRun.status === 0 && fullRun.out.includes(`v3.24.0 → v${VERSION}`) && s.dream_init_plugin_version === VERSION && s.dream_sync_last_run === today,
    `${fullRun.status} ${JSON.stringify({ v: s.dream_init_plugin_version, d: s.dream_sync_last_run })}\n${fullRun.out}`);
  assert('full sync restores a deleted hook and command stub',
    fs.existsSync(path.join(full, '.claude', 'hooks', 'audit-append.cjs')) && fs.existsSync(path.join(full, '.claude', 'commands', 'explain.md')));
  assert('full sync keeps governance_mode the developer set and backfills a missing output_mode',
    s.governance_mode === 'lightweight' && s.output_mode === 'verbose', JSON.stringify({ g: s.governance_mode, o: s.output_mode }));
  assert('full sync lists the in-range migration note 033 (v3.25.0) and a Needs Claude list',
    fullRun.out.includes('033-3.25.0.md') && !fullRun.out.includes('032-3.24.0.md') && fullRun.out.includes('Needs Claude'), fullRun.out);

  // The same starting point synced two ways: by hand (byHand) and by the script with --root (full).
  const vsManual = differences(snapshot(byHand), snapshot(full));
  assert('same end state as running bootstrap sync, repo-detect, post-detect and the stamp by hand',
    vsManual.length === 0, `differ: ${vsManual.join(', ')}`);

  assert('warns when Claude Code has a different version installed than the script being run',
    fullRun.out.includes(`Claude Code has v0.0.1 installed, but this script is v${VERSION}`), fullRun.out);

  const before = snapshot(full);
  const again = await node([SYNC], full);
  // _bootstrap-manifest.json is the bootstrap's log of what its last run did ("updated" vs
  // "already current"), not project configuration, so it is left out here.
  const changed = differences(before, snapshot(full), ['_bootstrap-manifest.json']);
  assert('a second run exits 0 and changes nothing in the project', again.status === 0 && changed.length === 0, `${again.status} ${changed.join(', ')}`);

  assert('unrecognisable project: warns, keeps going, rules skipped for an empty repo_type, exit 0',
    unknownRun.status === 0 && unknownRun.out.includes('no recognisable project structure') && unknownRun.out.includes('rules not redeployed'),
    `${unknownRun.status} ${unknownRun.out}`);
  assert('additionalDirectories set but never asked: external stacks refreshed and marked as asked',
    unknownRun.out.includes('external_detected_stacks') && readState(unknown).external_stacks_prompted === true
      && !/· external-repos/.test(unknownRun.out), unknownRun.out);
  assert('a failing step: ✗ line, later steps still run, version still stamped, exit 1',
    brokenRun.status === 1 && brokenRun.out.includes('✗ bootstrap --mode sync failed') && brokenRun.out.includes('run recorded')
      && readState(broken).dream_init_plugin_version === VERSION, `${brokenRun.status} ${brokenRun.out}`);
  const dryChanged = differences(dryBefore, snapshot(dry));
  assert('--dry-run: exit 0, says nothing was written, and writes nothing',
    dryRun.status === 0 && dryRun.out.includes('dry run') && dryChanged.length === 0, `${dryRun.status} ${dryChanged.join(', ')}`);
}

async function main() {
  try {
    unitCases();
    installerCases();
    await syncCases();
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  process.stdout.write(`\n${passed} passed · ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  process.stdout.write(`  ✗ unexpected error: ${err.stack}\n`);
  process.exit(1);
});
