#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        BFS 3-level root resolution for the migration family (upgrade · rewrite ·
//                      replatform). Starting from --source-path, reads each directory's
//                      .claude/settings.local.json and follows additionalDirectories up to
//                      --depth levels deep (default 3). Produces a deduplicated, ordered list of
//                      all migration roots reachable from the source. Cycle-safe (visited-set
//                      prevents re-enqueue). Optionally merge-writes the resolved roots into a
//                      settings.local.json under the migrationRoots key (--write-to).
// What it touches:     Reads .claude/settings.local.json at each BFS node. If --write-to is
//                      given: reads the target file (or starts empty), sets migrationRoots only,
//                      and writes with JSON.stringify(…, null, 2) + newline.
// What it does NOT do: No LLM, no git, no network, no ledger writes, no graph reads, no code edits.
// Exit codes:
//   0  Resolved OK. stdout = JSON: { status, source_path, roots, depth_used, wrote_to }
//   1  Usage error / unknown flag.
//   5  .claude/settings.local.json absent at --source-path — plugin not integrated; developer
//      must supply paths manually. stdout (--json): { status:"settings-absent", source_path,
//      settings_path, message }
//   6  One or more resolved additionalDirectories do not exist on disk. stdout (--json):
//      { status:"missing-dirs", missing:[{path, found_in, depth}] }
// How to verify:       Run manually:
//   node scripts/resolve-migration-roots.cjs --source-path=. --json
//   node scripts/resolve-migration-roots.cjs --source-path=. --depth=2 --write-to=.claude/settings.local.json --json
//   node scripts/resolve-migration-roots.cjs --source-path=. --unknown-flag  → exit 1
//   (with no .claude/settings.local.json present) → exit 5

'use strict';
const fs   = require('fs');
const path = require('path');

// ── Allowlist-enforced flag parsing (A14 fix pattern from checkpoint-ledger.cjs) ──────────────
const KNOWN_FLAGS = new Set(['source-path', 'write-to', 'depth', 'json']);

for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const flag = a.split('=')[0].slice(2);
  if (!KNOWN_FLAGS.has(flag)) {
    process.stderr.write(`error: unknown flag --${flag}\nKnown flags: ${[...KNOWN_FLAGS].map(f => '--' + f).join(', ')}\n`);
    process.exit(1);
  }
}

const JSON_OUT  = process.argv.includes('--json');
const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const SOURCE_PATH_RAW = arg('source-path');
const WRITE_TO        = arg('write-to') || null;
const DEPTH_RAW       = arg('depth');
const MAX_DEPTH       = DEPTH_RAW !== undefined ? parseInt(DEPTH_RAW, 10) : 3;

// ── normP: canonical, forward-slash, no trailing slash ─────────────────────────────────────────
function normP(p) {
  return path.resolve(p).split('\\').join('/').replace(/\/+$/, '');
}

// ── Emit helpers ───────────────────────────────────────────────────────────────────────────────
function exitOk(obj) {
  if (JSON_OUT) process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  else {
    process.stdout.write(`status: ${obj.status}\nsource_path: ${obj.source_path}\nroots: ${(obj.roots || []).join(', ')}\ndepth_used: ${obj.depth_used}\nwrote_to: ${obj.wrote_to || '(none)'}\n`);
  }
  process.exit(0);
}

function exitErr(code, obj, humanLines) {
  if (JSON_OUT) process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  else humanLines.forEach(l => process.stderr.write(l + '\n'));
  process.exit(code);
}

// ── Usage guard ────────────────────────────────────────────────────────────────────────────────
if (!SOURCE_PATH_RAW) {
  process.stderr.write('usage: resolve-migration-roots.cjs --source-path=<path> [--write-to=<settings.local.json>] [--depth=<n>] [--json]\n');
  process.exit(1);
}

if (isNaN(MAX_DEPTH) || MAX_DEPTH < 0) {
  process.stderr.write(`error: --depth must be a non-negative integer, got: ${DEPTH_RAW}\n`);
  process.exit(1);
}

// ── Resolve SOURCE_PATH ────────────────────────────────────────────────────────────────────────
const SOURCE_PATH = normP(SOURCE_PATH_RAW);

// P1: exit 1 when --source-path itself doesn't exist — clearer than the fallthrough exit 5
// message which suggests running /setup-init, when the real problem is a wrong path argument.
if (!fs.existsSync(SOURCE_PATH)) {
  exitErr(1,
    { status: 'source-path-absent', source_path: SOURCE_PATH },
    [
      `error: --source-path does not exist on disk: ${SOURCE_PATH}`,
      `  Verify the path argument and re-run.`,
    ]
  );
}

// ── Exit 5: settings.local.json absent at source root ─────────────────────────────────────────
// The source root MUST have a settings.local.json — without it the plugin is not integrated here
// and we cannot perform BFS. The developer must supply paths manually.
const SOURCE_SETTINGS = normP(path.join(SOURCE_PATH, '.claude', 'settings.local.json'));
if (!fs.existsSync(SOURCE_SETTINGS)) {
  exitErr(5,
    {
      status:        'settings-absent',
      source_path:   SOURCE_PATH,
      settings_path: SOURCE_SETTINGS,
      message:       `No .claude/settings.local.json found at the source root (${SOURCE_SETTINGS}). `
                   + `The plugin is not integrated at this path. `
                   + `Run /setup-init in that project first, or supply migration roots manually by `
                   + `adding them to the settings.local.json at the source root and re-running this script.`,
    },
    [
      `error: .claude/settings.local.json not found at source root: ${SOURCE_SETTINGS}`,
      `  The plugin is not integrated in the source project.`,
      `  Run /setup-init in the source project first, or add the required additionalDirectories`,
      `  to its settings.local.json manually and re-run this script.`,
    ]
  );
}

// ── BFS ────────────────────────────────────────────────────────────────────────────────────────
// resolved: Set of normP'd directory paths already added (cycle prevention + dedup)
// queue:    [{dir, depth}]  — FIFO
// missingDirs: [{path, found_in, depth}]  — entries that don't exist on disk

const resolved    = new Set();
const queue       = [];
const missingDirs = [];
const rootsOrdered = [];   // insertion-order preserved result list

function enqueue(dir, depth) {
  if (resolved.has(dir)) return;   // cycle prevention / dedup
  resolved.add(dir);
  rootsOrdered.push(dir);
  queue.push({ dir, depth });
}

enqueue(SOURCE_PATH, 0);

while (queue.length > 0) {
  const { dir, depth } = queue.shift();

  // Do not follow children beyond MAX_DEPTH
  if (depth >= MAX_DEPTH) continue;

  const settingsFile = path.join(dir, '.claude', 'settings.local.json');

  // If no settings file at this node: skip silently — this may be an external dependency
  // directory that hasn't been set up with the plugin. That is fine; we simply don't BFS into it.
  if (!fs.existsSync(settingsFile)) continue;

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  } catch (_) {
    // Unparseable JSON: skip silently — not our file format or corrupt, don't error
    continue;
  }

  const additionalDirs = Array.isArray(settings.additionalDirectories)
    ? settings.additionalDirectories
    : [];

  for (const rawDir of additionalDirs) {
    if (!rawDir || typeof rawDir !== 'string') continue;
    // P1: resolve relative rawDir against the repo root that OWNS the settings file (dir),
    // not against process.cwd(). For rewrite/replatform the CWD is the target folder,
    // not the source app — a relative path like '../sibling-repo' in the source app's
    // settings would resolve to the wrong location if anchored to CWD.
    const abs = path.isAbsolute(rawDir) ? normP(rawDir) : normP(path.resolve(dir, rawDir));

    if (resolved.has(abs)) continue;   // already seen — cycle prevention

    if (!fs.existsSync(abs)) {
      // Track missing dirs — don't add to resolved, don't enqueue
      missingDirs.push({ path: abs, found_in: normP(settingsFile), depth: depth + 1 });
      continue;
    }

    enqueue(abs, depth + 1);
  }
}

// ── Exit 6: missing directories ────────────────────────────────────────────────────────────────
if (missingDirs.length > 0) {
  const humanLines = [
    `error: ${missingDirs.length} directory/directories referenced in additionalDirectories do not exist on disk:`,
    ...missingDirs.map(m =>
      `  path: ${m.path}\n  configured in: ${m.found_in}\n  bfs depth: ${m.depth}`
    ),
    '',
    'Fix: update the additionalDirectories entries in the listed settings.local.json files to point to existing paths, then re-run.',
  ];
  exitErr(6,
    { status: 'missing-dirs', missing: missingDirs },
    humanLines
  );
}

// ── Roots resolved — optionally write-to ──────────────────────────────────────────────────────
const roots = rootsOrdered;   // SOURCE_PATH first, then BFS-discovered in order

let wroteTo = null;

if (WRITE_TO) {
  const writePath = normP(WRITE_TO);
  let existingSettings = {};
  if (fs.existsSync(writePath)) {
    try {
      existingSettings = JSON.parse(fs.readFileSync(writePath, 'utf8'));
    } catch (e) {
      // P2: refuse to overwrite — silently starting fresh would discard additionalDirectories
      // and all other settings keys. The caller must fix the file manually.
      exitErr(1,
        { status: 'write-to-corrupt', path: writePath, parse_error: e.message },
        [
          `error: --write-to target exists but is not valid JSON — refusing to overwrite: ${writePath}`,
          `  parse error: ${e.message}`,
          `  Fix the file manually, then re-run.`,
        ]
      );
    }
  }
  // Merge-write: set only migrationRoots, preserve all other keys
  existingSettings.migrationRoots = roots;
  fs.mkdirSync(path.dirname(writePath), { recursive: true });
  fs.writeFileSync(writePath, JSON.stringify(existingSettings, null, 2) + '\n');
  wroteTo = writePath;
}

// ── Exit 0: OK ─────────────────────────────────────────────────────────────────────────────────
exitOk({
  status:      'ok',
  source_path: SOURCE_PATH,
  roots,
  depth_used:  MAX_DEPTH,
  wrote_to:    wroteTo,
});
