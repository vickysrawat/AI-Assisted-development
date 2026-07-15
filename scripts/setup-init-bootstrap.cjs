#!/usr/bin/env node
// scripts/setup-init-bootstrap.cjs
// Handles all mechanical setup-init work in one deterministic Node.js pass, then writes
// .claude/_bootstrap-manifest.json telling Claude exactly what LLM work remains.
//
// Usage (called by commands/setup-init.md Step 1):
//   node setup-init-bootstrap.cjs [--mode init|sync]
//
// --mode init (default): skip-if-exists for stubs; builds full needsLLMPopulation list
// --mode sync:           overwrite stubs+hooks; needsLLMPopulation is []
//                        sync always starts fresh (loadManifest returns null) so every
//                        isDone-guarded step runs — no silent skip on repeated syncs.
//
// Crash-safe: manifest written after every step; re-run skips completed steps (idempotent).
// Exception: sync mode ignores an existing manifest to prevent silent step-skipping.

'use strict';

const fs      = require('fs');
const os      = require('os');
const path    = require('path');
const crypto  = require('crypto');
const { execSync } = require('child_process');

// ── A: Constants ─────────────────────────────────────────────────────────────────

const PLUGIN_DIR     = path.resolve(__dirname, '..');
const SCHEMA_VERSION = '1';
const MANIFEST_FILE  = '_bootstrap-manifest.json';

let PLUGIN_VERSION = 'unknown';
try {
  const pj = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'), 'utf8'));
  PLUGIN_VERSION = pj.version || 'unknown';
} catch(e) {}

const DIRS_TO_CREATE = [
  '.claude',
  path.join('.claude', 'rules'),
  path.join('.claude', 'commands'),
  path.join('.claude', 'hooks'),
  path.join('.claude', 'skills'),  // project-specific skills + .hashes; developers may add custom skills here
  path.join('.claude', 'architecture'),
  path.join('.claude', 'graph'),
  'memory',
  'temp',
  'token-analysis',
];

// All command stubs from _project-deploy/commands/ (one per command in plugin.json)
const STUB_FILES = [
  'ado-tasks.md',      'app-readiness.md', 'bug.md',           'checkin.md',
  'code-review.md',    'critic.md',        'dismiss.md',        'dream.md',
  'dream-audit.md',    'dream-health.md',  'setup-init.md',     'dream-rollback.md',
  'setup-status.md',   'setup-sync.md',    'setup-teardown.md', 'dynamic-scan.md',   'explain.md',
  'fix.md',            'gitignore-sync.md','graph-sync.md',     'graph-viz.md',
  'icea-approve.md',   'icea-feature.md',  'icea-implement.md', 'icea-review.md',
  'icea-revise.md',    'icea-status.md',   'plugin-readiness.md','pr-create.md',
  'pr-describe.md',    'pr-spec-review.md','product-docs.md',   'security-review.md',
  'session-start.md',  'sprint-metrics.md','sync-dirs.md',      'token-analysis.md',
  'update-arch.md',
];

// Legacy stub names replaced in v3.8.0 — removed from target projects on next sync
const LEGACY_STUB_FILES = [
  'dream-init.md', 'dream-status.md', 'dream-sync.md', 'dream-teardown.md',
];

// All hook files from _project-deploy/hooks/
const HOOK_FILES = [
  'findings-gate-precommit.sh',
  'check-settings-secrets.cjs',  // Secret guard for the shared settings.json (PreToolUse + pre-commit)
  'graph-stale-detect.sh',
  'icea-floor.sh',
  'memory-capture.sh',           // Stop hook: memory capture prompt after every turn
  'validate-ledgers.py',
  'validate-pr-compliance.py',
];

// SYNC WITH: commands/gitignore-sync.md Step 1 — BASE array must be identical.
// Order matters: each `dir/*` line MUST precede its `!dir/<ledger>` re-include, because
// git cannot re-include a file whose parent directory is ignored wholesale. The writer
// (writeGitignoreBlock) emits entries verbatim in this order.
//
// Shared (NOT ignored): .claude/settings.json (secret-free, team config — guarded by
// check-settings-secrets.cjs), .claude/architecture/ (durable docs), and the three review
// ledgers. Ignored: settings.local.json (secrets/permissions), checkpoints/caches, dated
// reports, all dynamic-scan artefacts except its ledger, token-analysis & prod-readiness.
const GITIGNORE_BASE = [
  '.claude/settings.local.json',
  '.claude/security-checkpoint.json',
  '.claude/code-review-checkpoint.json',
  '.claude/file-cache.json',
  '.claude/dream-init-state.json',
  'memory/health.html',
  // Review/scan output: share the durable ledger, ignore regenerable/credential-bearing files
  'CodeReviews/*',
  '!CodeReviews/code-review-ledger.md',
  'security/*',
  '!security/security-ledger.md',
  'dynamic-scan/*',                     // *.session/*.context can hold plaintext creds
  '!dynamic-scan/dynamic-scan-ledger.md',
  'token-analysis/',                    // per-developer analytics — not shared
  'prod-readiness/',                    // regenerable point-in-time reports
  'temp/',
  '.claude/plugin-path.txt',
];

// Required Dream sections in CLAUDE.md — checked by regex, sourced from plugin template
const CLAUDE_MD_SECTIONS = [
  { id: 'write_gate',       detectRe: /^## 0\. WRITE GATE/m,         pluginHeader: '## 0. WRITE GATE'         },
  { id: 'keyword_handlers', detectRe: /^## 0a\. Keyword Handlers/m,  pluginHeader: '## 0a. Keyword Handlers'  },
  { id: 'shell_git',        detectRe: /^## 0b\. Shell/m,             pluginHeader: '## 0b. Shell'             },
  { id: 'project_overview', detectRe: /^## 1\. PROJECT OVERVIEW/m,   pluginHeader: '## 1. PROJECT OVERVIEW'   },
  { id: 'data_access',      detectRe: /^## Data Access Convention/m, pluginHeader: '## Data Access Convention'},
  { id: 'feature_gate',     detectRe: /^## Feature Gate/m,           pluginHeader: '## Feature Gate'          },
  { id: 'dream',            detectRe: /^# Dream/m,                   pluginHeader: '# Dream'                  },
];

// ── B: Args ───────────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const MODE        = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'init';
const REPO_TYPE   = args.includes('--repo-type') ? args[args.indexOf('--repo-type') + 1] : null;
const NO_HOOKS    = args.includes('--no-hooks');   // opt out of the enforcement floor
const PROJECT_ROOT = path.resolve(process.cwd());
const MANIFEST_PATH = path.join(PROJECT_ROOT, '.claude', MANIFEST_FILE);

// ── C: resolvePluginDir() — verbatim from plugin-path-resolution.md §1b ──────────
// Primary: __dirname already points inside the plugin. Registry is fallback only.

function resolvePluginDir() {
  const selfDir = path.resolve(__dirname, '..');
  if (fs.existsSync(path.join(selfDir, '.claude-plugin', 'plugin.json'))) return selfDir;
  const os  = require('os');
  const base = path.join(os.homedir(), '.claude', 'plugins');
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(base, 'installed_plugins.json'), 'utf8'));
    const key = Object.keys(reg.plugins || {}).find(k => k.startsWith('ai-assisted-development@'));
    if (key) {
      const a = reg.plugins[key] || [];
      const e = a.find(x => x.scope === 'user') || a[0];
      if (e && e.installPath && fs.existsSync(e.installPath)) return e.installPath;
    }
  } catch(e) {}
  try {
    for (const m of fs.readdirSync(base)) {
      const d = path.join(base, m, 'plugins', 'ai-assisted-development');
      if (fs.existsSync(d)) return d;
    }
  } catch(e) {}
  return path.join(base, 'local-marketplace', 'plugins', 'ai-assisted-development');
}

// ── D: Manifest helpers ───────────────────────────────────────────────────────────

function atomicWrite(filePath, content) {
  // Ensure the parent dir exists — the very first saveManifest() runs before
  // stepCreateDirectories, and .claude/ does not exist on a fresh project.
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function loadManifest() {
  // Sync mode always starts fresh — a prior sync manifest would cause every isDone-guarded
  // step (stepClaudeMd, stepDeployHooks, stepDeployStubs, etc.) to silently skip on a
  // second setup-sync run. Sync operations are idempotent; crash-recovery resume is not
  // worth the silent-skip risk.
  if (MODE === 'sync') return null;
  // Clean up any stale .tmp file from a prior crashed write
  try { if (fs.existsSync(MANIFEST_PATH + '.tmp')) fs.unlinkSync(MANIFEST_PATH + '.tmp'); } catch(e) {}
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    // Invalidate on schema or mode mismatch — start fresh
    if (m.schemaVersion !== SCHEMA_VERSION) return null;
    if (m.mode !== MODE) return null;
    return m;
  } catch(e) { return null; }
}

function initManifest(pluginDir) {
  // needsLLMPopulation only exists in init mode; sync mode has no LLM work
  const needsLLMPopulation = MODE === 'init' ? [
    { id: 'init_claude_md',         order: 1, skill: '/init',      status: 'pending',
      description: 'CLAUDE.md created from template — run /init to add project-specific content' },
    { id: 'resolve_git_bash_paths', order: 2, skill: 'interactive',status: 'pending',
      description: 'GIT_PATH / BASH_PATH placeholders in CLAUDE.md §0b need manual resolution' },
    { id: 'verify_external_dirs',   order: 3, skill: 'interactive',status: 'pending',
      description: 'Confirm external directory paths in settings.local.json match local checkout' },
    { id: 'generate_architecture',  order: 4, skill: 'architect',  status: 'pending',
      description: 'Run architect skill — generates architecture docs; Step 7-2 calls graph-extract-edges.js' },
    { id: 'build_knowledge_graph',  order: 5, skill: 'graph-sync', status: 'pending',
      description: 'Run graph-sync — refines graph.json, re-runs graph-extract-edges.js for EXTRACTED edges' },
    { id: 'deploy_rules',           order: 6, skill: 'bootstrap-phase-2', status: 'pending',
      description: 'Deployed by bootstrap Phase 2 (called from architect Step 1 after repo type detection)' },
  ] : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    pluginVersion: PLUGIN_VERSION,
    pluginDir,
    mode: MODE,
    projectRoot: PROJECT_ROOT,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'partial',
    vcs: null,
    operations: {},
    needsLLMPopulation,
    warnings: [],
  };
}

function saveManifest(manifest) {
  atomicWrite(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function markStep(manifest, key, data) {
  manifest.operations[key] = { status: 'done', ...data };
  saveManifest(manifest);
}

function isDone(manifest, key) {
  return manifest.operations[key]?.status === 'done';
}

function warn(manifest, msg) {
  manifest.warnings.push(msg);
}

// ── E: main() ─────────────────────────────────────────────────────────────────────

async function main() {
  if (MODE === 'post-detect') return mainPostDetect();

  if (!fs.existsSync(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'))) {
    console.error('  ✗ Plugin installation not found at: ' + PLUGIN_DIR);
    console.error('    Run bash install.sh (or .\\install.ps1) to install the plugin first.');
    process.exit(1);
  }

  let manifest = loadManifest();
  const isResume = !!manifest;
  if (!manifest) {
    manifest = initManifest(PLUGIN_DIR);
    saveManifest(manifest);
  }
  console.log('  bootstrap v' + PLUGIN_VERSION + '  mode=' + MODE + (isResume ? '  [resuming]' : ''));

  stepCreateDirectories(manifest);
  stepDeployStubs(manifest);
  stepDeployHooks(manifest);
  stepWritePluginPath(manifest);
  stepDeployProjectSkills(manifest);
  stepGitPreCommit(manifest);
  stepWireSettings(manifest);
  stepWireUserSettings(manifest);
  stepSeedStateFiles(manifest);
  stepWriteNpmDeps(manifest);
  stepGitignoreSync(manifest);
  stepExternalDirScan(manifest);
  stepClaudeMd(manifest);
  stepDetectGitBashPaths(manifest);

  manifest.completedAt = new Date().toISOString();
  manifest.status = 'complete';
  saveManifest(manifest);

  printSummary(manifest);
}

// ── F: stepCreateDirectories ──────────────────────────────────────────────────────

function stepCreateDirectories(manifest) {
  if (isDone(manifest, 'createDirectories')) { console.log('  — createDirectories: done (skip)'); return; }
  const created = [], existed = [];
  for (const rel of DIRS_TO_CREATE) {
    const abs = path.join(PROJECT_ROOT, rel);
    const wasNew = !fs.existsSync(abs);
    fs.mkdirSync(abs, { recursive: true });
    (wasNew ? created : existed).push(rel);
  }
  console.log('  ✓ directories  : ' + created.length + ' created, ' + existed.length + ' already existed');
  markStep(manifest, 'createDirectories', { created, existed });
}

// ── G: stepDeployStubs ────────────────────────────────────────────────────────────

function stepDeployStubs(manifest) {
  if (isDone(manifest, 'deployStubs')) { console.log('  — deployStubs: done (skip)'); return; }
  const srcDir  = path.join(PLUGIN_DIR, '_project-deploy', 'commands');
  const destDir = path.join(PROJECT_ROOT, '.claude', 'commands');
  let deployed = 0, skipped = 0, legacyRemoved = 0;
  const failed = [];
  if (MODE === 'sync') {
    for (const f of LEGACY_STUB_FILES) {
      const p = path.join(destDir, f);
      try { if (fs.existsSync(p)) { fs.unlinkSync(p); legacyRemoved++; } } catch(e) {}
    }
    if (legacyRemoved > 0) console.log('  ✓ legacy stubs : ' + legacyRemoved + ' removed (dream-* → setup-*)');
  }
  for (const f of STUB_FILES) {
    const src  = path.join(srcDir, f);
    const dest = path.join(destDir, f);
    if (!fs.existsSync(src)) {
      failed.push({ file: f, reason: 'source not found in plugin' });
      warn(manifest, 'stub source missing: ' + f);
      continue;
    }
    // init: skip if already exists (developer may have customised)
    // sync: always overwrite (plugin owns stubs)
    if (MODE === 'init' && fs.existsSync(dest)) { skipped++; continue; }
    try { fs.copyFileSync(src, dest); deployed++; }
    catch(e) { failed.push({ file: f, reason: e.message }); }
  }
  console.log('  ✓ stubs        : ' + deployed + ' deployed, ' + skipped + ' skipped'
    + (failed.length ? ', ' + failed.length + ' failed' : ''));
  markStep(manifest, 'deployStubs', { deployed, skipped, failed });
}

// ── H: stepDeployHooks ────────────────────────────────────────────────────────────

function stepDeployHooks(manifest) {
  if (isDone(manifest, 'deployHooks')) { console.log('  — deployHooks: done (skip)'); return; }
  if (NO_HOOKS) {
    warn(manifest, 'Enforcement floor DECLINED via --no-hooks — record this in architecture-deployment.md');
    console.log('  — hooks        : skipped (--no-hooks)');
    markStep(manifest, 'deployHooks', { deployed: [], skipped: 'no-hooks' });
    return;
  }
  const srcDir  = path.join(PLUGIN_DIR, '_project-deploy', 'hooks');
  const destDir = path.join(PROJECT_ROOT, '.claude', 'hooks');
  if (!fs.existsSync(srcDir)) {
    warn(manifest, 'Plugin _project-deploy/hooks/ directory not found — skipping hook deployment');
    markStep(manifest, 'deployHooks', { deployed: [], failed: ['hooks dir missing'], hashesWritten: false });
    return;
  }
  const deployed = [], failed = [];
  for (const f of HOOK_FILES) {
    const src  = path.join(srcDir, f);
    const dest = path.join(destDir, f);
    if (!fs.existsSync(src)) { failed.push(f); warn(manifest, 'hook not found: ' + f); continue; }
    try {
      fs.copyFileSync(src, dest);
      // Make scripts executable (no-op on Windows but harmless)
      if (f.endsWith('.sh') || f.endsWith('.py')) {
        try { fs.chmodSync(dest, 0o755); } catch(e) {}
      }
      deployed.push(f);
    } catch(e) { failed.push(f); warn(manifest, 'hook copy failed: ' + f + ' — ' + e.message); }
  }
  // Write .hashes in sha256sum format: hash + two spaces + filename
  // (setup-status check 1p runs `sha256sum -c .claude/hooks/.hashes`)
  const hashLines = [];
  for (const f of deployed) {
    const content = fs.readFileSync(path.join(destDir, f));
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    hashLines.push(hash + '  ' + f);
  }
  atomicWrite(path.join(destDir, '.hashes'), hashLines.join('\n') + '\n');
  console.log('  ✓ hooks        : ' + deployed.length + ' deployed'
    + (failed.length ? ', ' + failed.length + ' failed' : '') + ', .hashes written');
  markStep(manifest, 'deployHooks', { deployed, failed, hashesWritten: true });
}

// ── H2: stepWritePluginPath ───────────────────────────────────────────────────────
// Writes the installed plugin's absolute path to .claude/plugin-path.txt.
// Skills read this as a fast path to locate shared reference files without running
// the full installed_plugins.json registry lookup inline.
// No isDone guard — always writes current PLUGIN_DIR; path changes on reinstall.

function stepWritePluginPath(manifest) {
  const destPath = path.join(PROJECT_ROOT, '.claude', 'plugin-path.txt');
  const norm = PLUGIN_DIR.split(path.sep).join('/');  // forward slashes for bash/git-bash on Windows
  try {
    atomicWrite(destPath, norm + '\n');
    console.log('  ✓ plugin-path.txt: ' + norm);
    markStep(manifest, 'writePluginPath', { path: norm });
  } catch(e) {
    warn(manifest, 'Could not write plugin-path.txt: ' + e.message);
    markStep(manifest, 'writePluginPath', { path: null, error: e.message });
  }
}

// ── H3: stepDeployProjectSkills ──────────────────────────────────────────────────
// Deploys the plugin's project-specific skill context files to .claude/skills/ and
// tracks them in .claude/skills/.hashes (sha256sum format, same as hooks/.hashes).
//
// Source: $PLUGIN_DIR/_project-deploy/skills/*.md
// Convention: all files deployed to target projects live under _project-deploy/ at
// the plugin root — the single canonical source for deployment artifacts.
//
// Update policy:
//   File not yet in project                                 → deploy, record hash
//   File in project, .hashes absent, src=dest              → old plugin deploy (pre-.hashes) → record, skip
//   File in project, .hashes absent, src≠dest              → old deploy, possibly customised → warn
//   File in project, .hashes exists, no entry              → developer-created → protect, warn
//   File in project, .hashes exists, hash matches, src=dest → already up to date → skip
//   File in project, .hashes exists, hash matches, src≠dest → unmodified → overwrite with new version
//   File in project, .hashes exists, hash differs           → developer customised → protect, warn
//
// No isDone guard — re-runs every bootstrap to pick up new or updated plugin project-skill files.
// PROJECT_SKILL_FILES is empty today; the step seeds .hashes for future use.

const PROJECT_SKILL_FILES = [
  // Future entries, e.g.: 'code-review.md', 'security.md'
];

function stepDeployProjectSkills(manifest) {
  const destDir    = path.join(PROJECT_ROOT, '.claude', 'skills');
  const hashesPath = path.join(destDir, '.hashes');
  fs.mkdirSync(destDir, { recursive: true });

  // Capture whether .hashes existed BEFORE this run — used to detect first-run transition
  const hashesFileExisted = fs.existsSync(hashesPath);

  // Load recorded hashes — split on \r?\n to handle Windows line endings
  const recorded = {};
  if (hashesFileExisted) {
    try {
      for (const line of fs.readFileSync(hashesPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
        if (m) recorded[m[2]] = m[1];
      }
    } catch(e) {}
  }

  const srcDir = path.join(PLUGIN_DIR, '_project-deploy', 'skills');
  let deployed = 0, skipped = 0, customised = 0;
  const updatedHashes = {};

  for (const f of PROJECT_SKILL_FILES) {
    const src  = path.join(srcDir, f);
    const dest = path.join(destDir, f);
    if (!fs.existsSync(src)) { warn(manifest, 'project skill missing in plugin: ' + f); continue; }

    const srcContent = fs.readFileSync(src);
    const srcHash    = crypto.createHash('sha256').update(srcContent).digest('hex');

    if (fs.existsSync(dest)) {
      const destContent = fs.readFileSync(dest);
      const destHash    = crypto.createHash('sha256').update(destContent).digest('hex');

      if (!recorded[f]) {
        if (!hashesFileExisted) {
          // First run of the .hashes mechanism. File may be an old plugin deployment
          // with no prior hash tracking. Use content equality as the proxy signal:
          if (srcHash === destHash) {
            // Identical to plugin source — unmodified old deployment, record and skip
            updatedHashes[f] = srcHash;
            skipped++;
          } else {
            // Differs — may have been customised before .hashes existed, protect it
            warn(manifest, 'project skill ' + f + ' predates .hashes and differs '
              + 'from plugin source — treating as customised. '
              + 'Run /setup-teardown --skills then /setup-sync to reset to plugin defaults.');
            customised++;
          }
          continue;
        }
        // .hashes existed before this run but has no entry for this file →
        // created after the mechanism existed → developer-created, protect it
        warn(manifest, 'project skill conflict — .claude/skills/' + f
          + ' exists as a developer file (no .hashes entry) — skipped');
        customised++;
        continue;
      }

      if (destHash !== recorded[f]) {
        // Developer has modified the plugin-deployed file — protect their changes
        warn(manifest, 'project skill customised by developer — skipped: ' + f);
        updatedHashes[f] = recorded[f];
        customised++;
        continue;
      }

      if (srcHash === destHash) {
        // Already up to date — no copy needed
        updatedHashes[f] = srcHash;
        skipped++;
        continue;
      }
    }

    try {
      fs.copyFileSync(src, dest);
      updatedHashes[f] = srcHash;
      deployed++;
    } catch(e) {
      warn(manifest, 'project skill copy failed: ' + f + ' — ' + e.message);
      if (recorded[f]) updatedHashes[f] = recorded[f];
    }
  }

  // Rewrite .hashes — only plugin-owned entries; developer files get no entry.
  // Entries for files removed from PROJECT_SKILL_FILES are intentionally dropped —
  // those files become developer-owned orphans and must be cleaned via migration notes.
  const hashLines = Object.entries(updatedHashes).map(([f, h]) => h + '  ' + f);
  atomicWrite(hashesPath, hashLines.join('\n') + (hashLines.length ? '\n' : ''));

  console.log('  ✓ project skills: ' + deployed + ' deployed, ' + skipped + ' up to date'
    + (customised ? ', ' + customised + ' customised (protected)' : '') + ', .hashes written');
  markStep(manifest, 'deployProjectSkills', { deployed, skipped, customised });
}

// ── H4: stepGitPreCommit ──────────────────────────────────────────────────────────
// Installs findings-gate-precommit.sh as .git/hooks/pre-commit (git repos only).
// Mechanical + safe: backs up a developer's existing hook once, skips if already ours.

function stepGitPreCommit(manifest) {
  if (isDone(manifest, 'gitPreCommit')) { console.log('  — gitPreCommit: done (skip)'); return; }
  if (NO_HOOKS) {
    console.log('  — pre-commit   : skipped (--no-hooks)');
    markStep(manifest, 'gitPreCommit', { installed: false, reason: 'no-hooks' });
    return;
  }
  const gitDir = path.join(PROJECT_ROOT, '.git');
  if (!fs.existsSync(gitDir)) {
    // Not a git repo (e.g. TFVC) — the git pre-commit tier does not apply here.
    console.log('  — pre-commit   : not a git repo — skipped');
    markStep(manifest, 'gitPreCommit', { installed: false, reason: 'not a git repo' });
    return;
  }
  const srcHook = path.join(PROJECT_ROOT, '.claude', 'hooks', 'findings-gate-precommit.sh');
  if (!fs.existsSync(srcHook)) {
    warn(manifest, 'pre-commit source hook missing — deployHooks may have failed');
    markStep(manifest, 'gitPreCommit', { installed: false, reason: 'source hook missing' });
    return;
  }
  const hooksDir = path.join(gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const dest = path.join(hooksDir, 'pre-commit');
  const srcContent = fs.readFileSync(srcHook);
  let action;
  if (fs.existsSync(dest)) {
    if (fs.readFileSync(dest).equals(srcContent)) {
      action = 'already current';
    } else {
      const backup = dest + '.backup';
      if (!fs.existsSync(backup)) fs.copyFileSync(dest, backup);  // preserve developer's hook once
      fs.copyFileSync(srcHook, dest);
      action = 'installed (existing backed up to pre-commit.backup)';
    }
  } else {
    fs.copyFileSync(srcHook, dest);
    action = 'installed';
  }
  try { fs.chmodSync(dest, 0o755); } catch(e) {}
  console.log('  ✓ pre-commit   : ' + action);
  markStep(manifest, 'gitPreCommit', { installed: true, action });
}

// ── I: stepWireSettings ───────────────────────────────────────────────────────────

function stepWireSettings(manifest) {
  if (isDone(manifest, 'wireSettings')) { console.log('  — wireSettings: done (skip)'); return; }
  const settingsPath = path.join(PROJECT_ROOT, '.claude', 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
    catch(e) {
      warn(manifest, 'settings.json had invalid JSON — backed up to .bak and recreated');
      try { fs.copyFileSync(settingsPath, settingsPath + '.bak'); } catch(ex) {}
      settings = {};
    }
  }
  // DECISION: disable Claude Code's built-in auto-memory so it does not intercept Dream
  // captures and redirect them to ~/.claude/projects/<slug>/memory/. Dream owns the
  // repo-relative memory/ folder (committable, dream-managed). Options considered:
  // (a) leave both on — rejected: split-brain memory, captures land off-repo;
  // (b) strengthen Dream wording only — rejected: fragile, still two live targets;
  // (c) disable built-in auto-memory — chosen. Set only when unset to preserve an
  // explicit developer override.
  let autoMemSet = false;
  if (settings.autoMemoryEnabled === undefined) {
    settings.autoMemoryEnabled = false;
    autoMemSet = true;
  }
  let wired = false;
  if (!NO_HOOKS) {
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
    const alreadyWired = settings.hooks.PreToolUse.some(
      h => h.hooks && h.hooks.some(x => x.command && x.command.includes('icea-floor.sh'))
    );
    if (!alreadyWired) {
      settings.hooks.PreToolUse.push({
        matcher: 'Write|Edit',
        hooks: [{ type: 'command', command: 'bash .claude/hooks/icea-floor.sh' }],
      });
      wired = true;
    }
    // Secret guard: settings.json is committed/shared, so block any Write|Edit that would
    // put a secret into it. The detector self-gates on the file path (no-op for other files).
    // Wired as a `node` command (not bash) — it parses the PreToolUse JSON directly.
    const secretGuardWired = settings.hooks.PreToolUse.some(
      h => h.hooks && h.hooks.some(x => x.command && x.command.includes('check-settings-secrets.cjs'))
    );
    if (!secretGuardWired) {
      settings.hooks.PreToolUse.push({
        matcher: 'Write|Edit',
        hooks: [{ type: 'command', command: 'node .claude/hooks/check-settings-secrets.cjs --hook' }],
      });
      wired = true;
    }
    // UserPromptSubmit hook: memory capture reminder — fires when the user submits a message,
    // injects additionalContext so Claude sees the memory checklist before the new response.
    // IMPORTANT: additionalContext is only valid on UserPromptSubmit and PostToolUse events;
    // Stop hooks do NOT support it (JSON validation fails with "Invalid input" if you try).
    if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
    const memCapWired = settings.hooks.UserPromptSubmit.some(
      h => h.hooks && h.hooks.some(x => x.command && x.command.includes('memory-capture.sh'))
    );
    if (!memCapWired) {
      settings.hooks.UserPromptSubmit.push({
        hooks: [{ type: 'command', command: 'bash .claude/hooks/memory-capture.sh' }],
      });
      wired = true;
    }
    // Also clean up any stale Stop entry for memory-capture.sh left by the incorrect
    // earlier wiring (ADR 0049 correction: Stop → UserPromptSubmit).
    if (settings.hooks.Stop) {
      settings.hooks.Stop = settings.hooks.Stop.filter(
        h => !(h.hooks && h.hooks.some(x => x.command && x.command.includes('memory-capture.sh')))
      );
      if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
    }
    // PostToolUse hook: memory-log.sh — fires after Write/Edit on memory/MEMORY.md and
    // appends a lightweight [capture] entry to memory/dream-log.md. Deterministic — does
    // not rely on Claude following a text instruction. Handles CRLF + Windows backslash paths.
    if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
    const memLogWired = settings.hooks.PostToolUse.some(
      h => h.hooks && h.hooks.some(x => x.command && x.command.includes('memory-log.sh'))
    );
    if (!memLogWired) {
      settings.hooks.PostToolUse.push({
        matcher: 'Write|Edit',
        hooks: [{ type: 'command', command: 'bash .claude/hooks/memory-log.sh' }],
      });
      wired = true;
    }
  }
  if (!settings.customInstructions) {
    settings.customInstructions = 'Response style: suppress preambles and plan-restatement before tool calls. When writing to existing files, show only a unified diff (changed lines + 3 lines of context) rather than the full file content. When writing new files, show the full content. Never echo generated file content to chat if the content is also being written to disk.';
  }
  atomicWrite(settingsPath, JSON.stringify(settings, null, 2));
  console.log('  ✓ settings.json: PreToolUse (icea-floor + secret-guard) + UserPromptSubmit (memory-capture) + PostToolUse (memory-log) hooks '
    + (NO_HOOKS ? 'skipped (--no-hooks)' : (wired ? 'added' : 'already present')));
  console.log('  ✓ settings.json: autoMemoryEnabled '
    + (autoMemSet ? 'set to false (Dream owns repo memory/)' : 'left as-is (developer override)'));
  markStep(manifest, 'wireSettings', { alreadyWired: !wired, noHooks: NO_HOOKS, autoMemSet });
}

// ── J: stepWireUserSettings ───────────────────────────────────────────────────────
// Writes autoMemoryEnabled: false to the USER-level ~/.claude/settings.json so that
// Claude Code's built-in auto-memory feature is disabled globally for this developer.
// The project-level setting (.claude/settings.json) is NOT respected by Claude Code
// for this feature — it must be set at the user level. Not guarded by isDone — runs
// on every init/sync to catch the case where the user has changed the file since last run.

function stepWireUserSettings(manifest) {
  const userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let userSettings = {};
  let existed = false;
  try {
    if (fs.existsSync(userSettingsPath)) {
      existed = true;
      userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
    }
  } catch(e) {
    warn(manifest, 'autoMemoryEnabled: could not read ~/.claude/settings.json (' + e.message + ') — add "autoMemoryEnabled": false manually to prevent built-in auto-memory writing to your profile instead of memory/MEMORY.md');
    manifest.operations.wireUserSettings = { status: 'failed', error: 'read: ' + e.message };
    saveManifest(manifest);
    return;
  }

  if (userSettings.autoMemoryEnabled !== undefined) {
    // Key already explicitly set — respect the developer's choice
    manifest.operations.wireUserSettings = { status: 'done', set: false, existingValue: userSettings.autoMemoryEnabled };
    if (userSettings.autoMemoryEnabled !== false) {
      warn(manifest, 'autoMemoryEnabled is ' + JSON.stringify(userSettings.autoMemoryEnabled) + ' in ~/.claude/settings.json — built-in auto-memory may write to your profile dir instead of memory/MEMORY.md. Set it to false to fix.');
    } else {
      console.log('  ✓ user settings.json: autoMemoryEnabled already false (no change)');
    }
    saveManifest(manifest);
    return;
  }

  // Key is undefined — set it
  userSettings.autoMemoryEnabled = false;
  try {
    atomicWrite(userSettingsPath, JSON.stringify(userSettings, null, 2));
    console.log('  ✓ user settings.json: autoMemoryEnabled set to false' + (existed ? '' : ' (file created)'));
    manifest.operations.wireUserSettings = { status: 'done', set: true, existed };
  } catch(e) {
    warn(manifest, 'autoMemoryEnabled: could not write ~/.claude/settings.json (' + e.message + ') — add "autoMemoryEnabled": false manually to prevent built-in auto-memory writing to your profile instead of memory/MEMORY.md');
    manifest.operations.wireUserSettings = { status: 'failed', error: 'write: ' + e.message };
  }
  saveManifest(manifest);
}

// ── K: stepSeedStateFiles ─────────────────────────────────────────────────────────

function stepSeedStateFiles(manifest) {
  if (isDone(manifest, 'seedStateFiles')) { console.log('  — seedStateFiles: done (skip)'); return; }
  const today = new Date().toISOString().slice(0, 10);
  const items = [];

  function seedIfMissing(relPath, content) {
    const abs = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(abs)) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const str = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      fs.writeFileSync(abs, str, 'utf8');
      items.push({ file: relPath, result: 'created' });
    } else {
      items.push({ file: relPath, result: 'existed' });
    }
  }

  // dream-init-state.json: empty arrays signal "in-progress init" to session-start
  // (session-start treats length===0 differently from "field absent")
  seedIfMissing(path.join('.claude', 'dream-init-state.json'), {
    dream_init_plugin_version: PLUGIN_VERSION,
    dream_init_last_run:       today,
    detected_stacks:           [],
    deployed_rules:            [],
  });

  // file-cache.json — verbatim seed from setup-init Step 6
  seedIfMissing(path.join('.claude', 'file-cache.json'), {
    _schema:      '1.0',
    _description: 'Character-count cache for diff-based skill scanning. Maintained by code-review and security skills. Do not edit manually.',
    _seeded:      today,
    _lastUpdated: null,
    files:        {},
  });

  // token-graph.json — verbatim seed from setup-init Step 8
  seedIfMissing(path.join('token-analysis', 'token-graph.json'), {
    version:         1,
    generatedAt:     null,
    projectRoot:     null,
    files:           {},
    sessions:        {},
    aggregates:      null,
    recommendations: {},
    staticStatus:    null,
  });

  // memory/MEMORY.md — verbatim seed from setup-init Step 2
  seedIfMissing(path.join('memory', 'MEMORY.md'), [
    '# MEMORY.md — manual override inbox',
    '',
    '> Sessions are the primary memory source.',
    '> /dream reads your Claude Code conversations directly via conversation_search.',
    '> You do not need to write here manually.',
    '>',
    '> This file is for EXCEPTIONS ONLY:',
    '> - Things Claude should remember that didn\'t arise naturally in a session',
    '> - Explicit corrections you want to force into memory immediately',
    '> - Context that exists outside Claude Code (e.g. from a document or meeting)',
    '>',
    '> Auto-capture writes here automatically at trigger points (see CLAUDE.md).',
    '> /dream will process and clear entries after each run.',
    '',
    '---',
    '',
    '## Format for manual entries',
    '',
    '### [manual] YYYY-MM-DD — <topic>',
    '',
  ].join('\n'));

  // memory/dream-log.md — append-only audit trail, starts empty
  seedIfMissing(path.join('memory', 'dream-log.md'), [
    '# dream-log.md — append-only Dream audit trail',
    '',
    '> Auto-populated by /dream. Do not edit manually.',
    '',
  ].join('\n'));

  const created = items.filter(x => x.result === 'created').length;
  console.log('  ✓ state files  : ' + created + ' created, ' + (items.length - created) + ' already existed');
  markStep(manifest, 'seedStateFiles', { items });
}

// ── K: stepWriteNpmDeps ───────────────────────────────────────────────────────────

function stepWriteNpmDeps(manifest) {
  if (isDone(manifest, 'writeNpmDeps')) { console.log('  — writeNpmDeps: done (skip)'); return; }
  const pkgPath = path.join(PROJECT_ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.log('  — writeNpmDeps : no package.json (non-JS project) — skipping');
    markStep(manifest, 'writeNpmDeps', { created: false, reason: 'no package.json' });
    return;
  }
  const deps = new Set();
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (pkg[section] && typeof pkg[section] === 'object') {
        for (const name of Object.keys(pkg[section])) deps.add(name);
      }
    }
  } catch(e) {
    warn(manifest, 'Could not parse package.json: ' + e.message);
    markStep(manifest, 'writeNpmDeps', { created: false, reason: 'parse error' });
    return;
  }
  const depsArray = [...deps].sort();
  atomicWrite(path.join(PROJECT_ROOT, '.claude', '_npm-deps.json'), JSON.stringify(depsArray, null, 2));
  console.log('  ✓ _npm-deps.json: ' + depsArray.length + ' dependencies');
  markStep(manifest, 'writeNpmDeps', { created: true, count: depsArray.length });
}

// ── L: stepGitignoreSync ──────────────────────────────────────────────────────────

function detectVcs(root) {
  // Inline of gitignore-sync.md Step 0 .cjs script
  try { execSync('git rev-parse --is-inside-work-tree', { cwd: root, stdio: 'ignore' }); return 'git'; } catch(e) {}
  try { execSync('tf vc status .', { cwd: root, stdio: 'ignore' }); return 'tfvc'; } catch(e) {}
  if (fs.existsSync(path.join(root, '$tf')) || fs.existsSync(path.join(root, '.tf')) || fs.existsSync(path.join(root, '.tfignore'))) return 'tfvc';
  return 'none';
}

function writeGitignoreBlock(root, vcs) {
  // Inline of gitignore-sync.md Step 1 .cjs script body
  const ignoreFile = path.join(root, vcs === 'tfvc' ? '.tfignore' : '.gitignore');
  const ENTRIES = vcs === 'tfvc'
    ? GITIGNORE_BASE.map(e => e.replace(/\//g, '\\').replace(/\\$/, ''))
    : GITIGNORE_BASE;
  const BEGIN = '# === ai-assisted-development (managed) ===';
  const END   = '# === end ai-assisted-development ===';
  let txt = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile, 'utf8') : '';
  const wasNew = !fs.existsSync(ignoreFile);
  const reBlock = new RegExp(
    '\\n?' + BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[\\s\\S]*?' +
    END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n?', 'g'
  );
  txt = txt.replace(reBlock, '\n');
  const outside = new Set(txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
  const blockEntries = ENTRIES.filter(e => !outside.has(e));
  let wrote = 0;
  if (blockEntries.length) {
    if (txt.length && !txt.endsWith('\n')) txt += '\n';
    if (txt.trim().length) txt += '\n';
    txt += BEGIN + '\n' + blockEntries.join('\n') + '\n' + END + '\n';
    wrote = blockEntries.length;
  }
  atomicWrite(ignoreFile, txt);
  return { file: path.relative(root, ignoreFile), result: wasNew ? 'created' : (wrote > 0 ? 'updated' : 'unchanged'), entriesWritten: wrote };
}

function stepGitignoreSync(manifest) {
  if (isDone(manifest, 'gitignoreSync')) { console.log('  — gitignoreSync: done (skip)'); return; }
  const vcs = detectVcs(PROJECT_ROOT);
  manifest.vcs = vcs;
  if (vcs === 'none') warn(manifest, 'VCS not detected — defaulting to .gitignore');
  const effectiveVcs = vcs === 'none' ? 'git' : vcs;
  const result = writeGitignoreBlock(PROJECT_ROOT, effectiveVcs);
  // Verify all entries are present
  const ignoreFile = path.join(PROJECT_ROOT, result.file);
  const lines = new Set(fs.readFileSync(ignoreFile, 'utf8').split(/\r?\n/).map(l => l.trim()));
  const ENTRIES = effectiveVcs === 'tfvc' ? GITIGNORE_BASE.map(e => e.replace(/\//g, '\\').replace(/\\$/, '')) : GITIGNORE_BASE;
  const missing = ENTRIES.filter(e => !lines.has(e));
  if (missing.length) warn(manifest, 'gitignore verify: ' + missing.length + ' entries missing after write');
  console.log('  ✓ gitignore    : ' + result.result + ' (vcs=' + vcs + ')'
    + (missing.length ? '  ⚠ ' + missing.length + ' entries missing' : ''));
  markStep(manifest, 'gitignoreSync', { vcs, ...result, tfvcDetected: vcs === 'tfvc' });
}

// ── M: stepExternalDirScan ────────────────────────────────────────────────────────
// Inline of external-dir-map SKILL.md Steps 3 + 4 (no temp .cjs files or .json intermediary)

function stepExternalDirScan(manifest) {
  if (isDone(manifest, 'externalDirScan')) { console.log('  — externalDirScan: done (skip)'); return; }
  const root = PROJECT_ROOT;
  const external = new Set();
  const manifestSnapshot = {};

  function isExternal(absP) {
    return !absP.startsWith(root + path.sep) && absP !== root;
  }
  function tryAdd(relPath) {
    if (!relPath || !relPath.trim()) return;
    const abs = path.resolve(root, relPath.replace(/\\/g, '/'));
    const dir = path.extname(abs) ? path.dirname(abs) : abs;
    if (isExternal(dir)) external.add(dir);
  }
  function findByPattern(dir, pattern, depth, results) {
    if (depth < 0) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.match(pattern)) results.push(full);
        else if (entry.isDirectory() && !entry.name.startsWith('.') && depth > 0)
          findByPattern(full, pattern, depth - 1, results);
      }
    } catch(e) {}
  }

  // .NET .sln → csproj references
  const slnFiles = []; findByPattern(root, /\.sln$/, 3, slnFiles);
  for (const sln of slnFiles) {
    try {
      const content = fs.readFileSync(sln, 'utf8');
      manifestSnapshot[path.relative(root, sln)] = { mtime: fs.statSync(sln).mtimeMs };
      for (const m of content.matchAll(/"([^"]+\.csproj)"/g)) tryAdd(path.dirname(m[1]));
    } catch(e) {}
  }

  // Java Maven pom.xml → <module> tags
  const pomFiles = []; findByPattern(root, /^pom\.xml$/, 3, pomFiles);
  for (const pom of pomFiles) {
    try {
      const content = fs.readFileSync(pom, 'utf8');
      manifestSnapshot[path.relative(root, pom)] = { mtime: fs.statSync(pom).mtimeMs };
      for (const m of content.matchAll(/<module>([^<]+)<\/module>/g)) tryAdd(m[1].trim());
    } catch(e) {}
  }

  // Java Gradle settings.gradle → includeBuild(...)
  const gradleFiles = []; findByPattern(root, /^settings\.gradle/, 3, gradleFiles);
  for (const gradle of gradleFiles) {
    try {
      const content = fs.readFileSync(gradle, 'utf8');
      manifestSnapshot[path.relative(root, gradle)] = { mtime: fs.statSync(gradle).mtimeMs };
      for (const m of content.matchAll(/includeBuild\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) tryAdd(m[1].trim());
    } catch(e) {}
  }

  // Angular angular.json → projects[*].root
  const angularJson = path.join(root, 'angular.json');
  if (fs.existsSync(angularJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(angularJson, 'utf8'));
      manifestSnapshot['angular.json'] = { mtime: fs.statSync(angularJson).mtimeMs };
      for (const proj of Object.values(data.projects || {})) {
        if (proj && proj.root) tryAdd(proj.root);
      }
    } catch(e) {}
  }

  // Node.js package.json workspaces
  const pkgJson = path.join(root, 'package.json');
  if (fs.existsSync(pkgJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
      manifestSnapshot['package.json'] = { mtime: fs.statSync(pkgJson).mtimeMs };
      const workspaces = Array.isArray(data.workspaces) ? data.workspaces : ((data.workspaces && data.workspaces.packages) || []);
      for (const ws of workspaces) {
        if (ws.includes('*')) {
          const base = path.resolve(root, ws.replace(/\/\*.*$/, ''));
          try {
            for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
              if (entry.isDirectory()) tryAdd(path.join(ws.replace(/\/\*.*$/, ''), entry.name));
            }
          } catch(e) {}
        } else { tryAdd(ws); }
      }
    } catch(e) {}
  }

  // Python pyproject.toml → path = "..." dependencies
  const pyproject = path.join(root, 'pyproject.toml');
  if (fs.existsSync(pyproject)) {
    try {
      const content = fs.readFileSync(pyproject, 'utf8');
      manifestSnapshot['pyproject.toml'] = { mtime: fs.statSync(pyproject).mtimeMs };
      for (const m of content.matchAll(/path\s*=\s*['"]([^'"]+)['"]/g)) tryAdd(m[1].trim());
    } catch(e) {}
  }

  const externalPaths = [...external];

  // Merge into settings.local.json — touch ONLY the additionalDirectories key
  const settingsLocalPath = path.join(PROJECT_ROOT, '.claude', 'settings.local.json');
  let settingsLocal = {};
  if (fs.existsSync(settingsLocalPath)) {
    try { settingsLocal = JSON.parse(fs.readFileSync(settingsLocalPath, 'utf8')); }
    catch(e) {
      warn(manifest, 'settings.local.json had invalid JSON — backed up to .bak');
      try { fs.copyFileSync(settingsLocalPath, settingsLocalPath + '.bak'); } catch(ex) {}
      settingsLocal = {};
    }
  }
  const existing = Array.isArray(settingsLocal.additionalDirectories) ? settingsLocal.additionalDirectories : [];
  const merged   = [...new Set([...existing, ...externalPaths])];
  let settingsUpdated = false;
  if (merged.length > existing.length) {
    settingsLocal.additionalDirectories = merged;
    atomicWrite(settingsLocalPath, JSON.stringify(settingsLocal, null, 2));
    settingsUpdated = true;
  }

  // Save manifest snapshot to dream-init-state.json (merge, never overwrite other keys)
  const statePath = path.join(PROJECT_ROOT, '.claude', 'dream-init-state.json');
  try {
    let state = {};
    if (fs.existsSync(statePath)) { try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch(e) {} }
    state.external_dir_snapshot  = manifestSnapshot;
    state.external_dir_last_sync = new Date().toISOString().slice(0, 10);
    atomicWrite(statePath, JSON.stringify(state, null, 2));
  } catch(e) { warn(manifest, 'Could not update state file with ext-dir snapshot: ' + e.message); }

  // No external paths → nothing for the developer to verify; mark the LLM item done.
  if (externalPaths.length === 0) {
    markLLMItemDone(manifest, 'verify_external_dirs', 'no external directories found — nothing to verify');
  }

  console.log('  ✓ ext-dir scan : ' + externalPaths.length + ' external path(s), settings.local.json '
    + (settingsUpdated ? 'updated' : 'unchanged'));
  markStep(manifest, 'externalDirScan', { externalPathsFound: externalPaths.length, externalPaths, settingsUpdated });
}

// ── N: stepClaudeMd ───────────────────────────────────────────────────────────────

function extractSection(pluginContent, sectionHeader) {
  // Find the section in the plugin CLAUDE.md and return its content up to the next --- separator.
  // The plugin template uses '---' as section dividers.
  const needle = '\n' + sectionHeader;
  const idx = pluginContent.indexOf(needle);
  if (idx === -1) return null;
  const start = idx + 1;           // skip the leading \n
  const rest   = pluginContent.slice(start);
  // CRLF-tolerant: the plugin template ships with \r\n endings, so an LF-only /\n---\n/
  // never matches and the fallback would return the whole header-to-EOF tail — dragging
  // every later section into each append (the section-duplication bug).
  const hrMatch = rest.match(/\r?\n---\r?\n/);
  return hrMatch ? rest.slice(0, hrMatch.index).trim() : rest.trim();
}

function stepClaudeMd(manifest) {
  if (isDone(manifest, 'claudeMd')) { console.log('  — claudeMd: done (skip)'); return; }
  const targetPath = path.join(PROJECT_ROOT, 'CLAUDE.md');
  const tmpPath    = path.join(PROJECT_ROOT, '.claude', '_claude-md.tmp');
  // Clean up any leftover tmp from a prior failed write
  try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch(e) {}

  // Read the plugin CLAUDE.md template
  let pluginContent = '';
  try { pluginContent = fs.readFileSync(path.join(PLUGIN_DIR, 'CLAUDE.md'), 'utf8'); }
  catch(e) {
    warn(manifest, 'Could not read plugin CLAUDE.md template — skipping CLAUDE.md management');
    markStep(manifest, 'claudeMd', { claudeMdState: 'skipped', reason: 'plugin template unreadable' });
    return;
  }
  // Normalize the template to LF once. extractSection's separator match, the '\n\n---\n\n'
  // section join, and the /m applyAdoSeed regexes all assume LF; the template ships CRLF.
  // Defense-in-depth behind the extractSection fix. Case A then writes an LF CLAUDE.md.
  pluginContent = pluginContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Read ADO values from config.json for seeding
  let adoOrg = '', adoProject = '', adoBase = 'https://dev.azure.com';
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, '.claude-plugin', 'config.json'), 'utf8'));
    adoOrg     = cfg.organization || '';
    adoProject = cfg.project      || '';
    adoBase    = cfg.adoBaseUrl   || 'https://dev.azure.com';
  } catch(e) {}

  function applyAdoSeed(txt) {
    // Verbatim from setup-init Step 5d — only fills if values are non-empty
    if (adoOrg)     txt = txt.replace(/^(- Organization\s*:\s*).*$/m, '$1' + adoOrg);
    if (adoProject) txt = txt.replace(/^(- Project\s*:\s*).*$/m,      '$1' + adoProject);
    if (adoOrg && adoProject)
      txt = txt.replace(/^(- ADO URL\s*:\s*).*$/m, '$1' + adoBase + '/' + adoOrg + '/' + adoProject);
    return txt;
  }

  // ── Case A: CLAUDE.md does not exist — create from plugin template ────────────
  if (!fs.existsSync(targetPath)) {
    const content = applyAdoSeed(pluginContent);
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, targetPath);
    console.log('  ✓ CLAUDE.md    : created from plugin template');
    // init_claude_md stays pending — /init must populate project-specific sections
    markStep(manifest, 'claudeMd', {
      claudeMdState: 'created_from_template',
      sectionsAdded: CLAUDE_MD_SECTIONS.map(s => s.id),
    });
    return;
  }

  // ── Existing CLAUDE.md — check which Dream sections are missing ────────────────
  let existing = fs.readFileSync(targetPath, 'utf8');
  const missing = CLAUDE_MD_SECTIONS.filter(s => !s.detectRe.test(existing));

  if (missing.length === 0) {
    // ── Case C: all sections present — stamp plugin version line only ─────────
    existing = existing.replace(/^# Plugin version:.*$/m, '# Plugin version: ' + PLUGIN_VERSION);
    fs.writeFileSync(tmpPath, existing, 'utf8');
    fs.renameSync(tmpPath, targetPath);
    console.log('  ✓ CLAUDE.md    : all sections present, version stamped');
    // Check adequacy to decide whether /init is needed
    const needsInit = !hasProjectContent(existing);
    if (!needsInit) markLLMItemDone(manifest, 'init_claude_md', 'CLAUDE.md existed with project content');
    markStep(manifest, 'claudeMd', { claudeMdState: 'ok', sectionsAdded: [], needsInit });
    return;
  }

  // ── Case B: append missing sections ───────────────────────────────────────────
  let additions = '';
  const added = [];
  for (const sec of missing) {
    const content = extractSection(pluginContent, sec.pluginHeader);
    if (content) { additions += '\n\n---\n\n' + content; added.push(sec.id); }
    else warn(manifest, 'Section not found in plugin CLAUDE.md: ' + sec.pluginHeader);
  }
  let newContent = existing.trimEnd() + additions + '\n';
  newContent = applyAdoSeed(newContent);
  fs.writeFileSync(tmpPath, newContent, 'utf8');
  fs.renameSync(tmpPath, targetPath);
  console.log('  ✓ CLAUDE.md    : ' + added.length + ' section(s) appended');
  const needsInit = !hasProjectContent(existing);
  if (!needsInit) markLLMItemDone(manifest, 'init_claude_md', 'CLAUDE.md had project content before section append');
  markStep(manifest, 'claudeMd', { claudeMdState: 'sections_appended', sectionsAdded: added, needsInit });
}

function hasProjectContent(claudeMdText) {
  // Heuristic from setup-init Step 5 Phase 1: ≥15 lines AND contains a stack keyword
  const lines    = claudeMdText.split('\n').length;
  const hasStack = /\.NET|Angular|Node\.js|React|Spring|Python|FastAPI|Django|Flask|Java|TypeScript/i.test(claudeMdText);
  return lines >= 15 && hasStack;
}

function markLLMItemDone(manifest, id, description) {
  const item = (manifest.needsLLMPopulation || []).find(x => x.id === id);
  if (item) { item.status = 'done'; item.description = description; }
}

// ── O: stepDetectGitBashPaths ─────────────────────────────────────────────────────

function tryExec(fn) {
  try { const r = fn(); if (r && r.trim()) return r.replace(/\r\n|\r/g, '').trim(); } catch(e) {}
  return null;
}

function stepDetectGitBashPaths(manifest) {
  if (isDone(manifest, 'gitBashPaths')) { console.log('  — gitBashPaths: done (skip)'); return; }

  const gitPath = tryExec(() => execSync('where.exe git',  { encoding: 'utf8' }).split('\n')[0])
               || tryExec(() => execSync('which git',      { encoding: 'utf8' }))
               || ['/mingw64/bin/git.exe', '/usr/bin/git', 'C:/Program Files/Git/bin/git.exe', 'C:/Program Files/Git/mingw64/bin/git.exe'].find(p => fs.existsSync(p))
               || null;

  const bashPath = tryExec(() => execSync('where.exe bash', { encoding: 'utf8' }).split('\n')[0])
                || tryExec(() => execSync('which bash',     { encoding: 'utf8' }))
                || ['/usr/bin/bash', '/bin/bash', 'C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find(p => fs.existsSync(p))
                || null;

  const targetPath = path.join(PROJECT_ROOT, 'CLAUDE.md');
  let substituted = false;
  if (fs.existsSync(targetPath)) {
    let content = fs.readFileSync(targetPath, 'utf8');
    let changed = false;
    if (content.includes('{GIT_PATH}')) {
      content = content.replace(/\{GIT_PATH\}/g, gitPath || '⚠ NOT DETECTED — run where.exe git and update manually');
      changed = true;
    }
    if (content.includes('{BASH_PATH}')) {
      content = content.replace(/\{BASH_PATH\}/g, bashPath || '⚠ NOT DETECTED — run where.exe bash and update manually');
      changed = true;
    }
    if (changed) { atomicWrite(targetPath, content); substituted = true; }
  }

  const unresolved = [!gitPath && 'GIT_PATH', !bashPath && 'BASH_PATH'].filter(Boolean);
  if (unresolved.length) {
    warn(manifest, 'Path detection: could not resolve ' + unresolved.join(', '));
  }

  // Mark resolve_git_bash_paths done when CLAUDE.md has no remaining unresolved markers.
  // This covers BOTH "both paths substituted successfully" AND "file never had placeholders
  // (already resolved in a prior init)" — only stays pending when a raw placeholder or a
  // NOT DETECTED marker actually remains for the developer to fix.
  let stillUnresolved = false;
  if (fs.existsSync(targetPath)) {
    stillUnresolved = /\{GIT_PATH\}|\{BASH_PATH\}|NOT DETECTED — run where/.test(fs.readFileSync(targetPath, 'utf8'));
  }
  if (!stillUnresolved) {
    markLLMItemDone(manifest, 'resolve_git_bash_paths', 'no unresolved git/bash placeholders remain in CLAUDE.md');
  }

  console.log('  ✓ git/bash     : git=' + (gitPath ? path.basename(gitPath) : 'NOT FOUND')
    + ', bash=' + (bashPath ? path.basename(bashPath) : 'NOT FOUND'));
  markStep(manifest, 'gitBashPaths', { gitPath, bashPath, substituted, unresolved });
}

// ── P: printSummary ───────────────────────────────────────────────────────────────

function printSummary(manifest) {
  const pending = (manifest.needsLLMPopulation || []).filter(x => x.status === 'pending');
  console.log('');
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✓ Bootstrap complete  v' + PLUGIN_VERSION + '  (' + MODE + ' mode)');
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (manifest.warnings.length) {
    console.log('  ⚠ Warnings:');
    manifest.warnings.forEach(w => console.log('    · ' + w));
  }
  if (pending.length) {
    console.log('  LLM work remaining (handle in order):');
    pending.forEach(t => console.log('    [' + t.order + '] ' + t.id));
    pending.forEach(t => console.log('        → ' + t.description));
  } else if (MODE === 'init') {
    console.log('  ✓ All LLM tasks already complete.');
  }
  // Server-side gates are the authoritative enforcement tier (ADR 0009). Remind the
  // developer to wire the CI validators unless they opted out of the floor.
  const hooksDeployed = manifest.operations.deployHooks
    && Array.isArray(manifest.operations.deployHooks.deployed)
    && manifest.operations.deployHooks.deployed.length > 0;
  if (hooksDeployed) {
    console.log('  📋 Add to your ADO pipeline (server-side authoritative gates — ADR 0009):');
    console.log('       - script: python3 .claude/hooks/validate-ledgers.py');
    console.log('       - script: python3 .claude/hooks/validate-pr-compliance.py');
    console.log('     Then make this pipeline a required Build Validation in branch policy.');
  }
  console.log('');
}

// ── Q: Phase 2 — post-detect mode (called by architect after repo type is known) ──
// Deploys architecture templates for the detected repo type and deploys matching rules.
// Called as: node setup-init-bootstrap.cjs --mode post-detect --repo-type REACT

const ARCH_TEMPLATE_FOLDER = {
  'DOTNET_API':       'dotnet-api',
  'ANGULAR_NX':       'angular-nx',
  'ANGULAR_STANDARD': 'angular-standard',
  'REACT':            'react',
  'JS_LIBRARY':       'js-library',
  'ASPNET_FRAMEWORK': 'aspnet-framework',
  'ASPNET_MVC':       'aspnet-mvc',
  'SPRING_BOOT':      'spring-boot',
  'PYTHON_FASTAPI':   'python-fastapi',
  'PYTHON_DJANGO':    'python-django',
  'PYTHON_FLASK':     'python-flask',
};

// Layer 3 backend language files — trigger Layer 1 (backend-only) rule deployment
const BACKEND_LAYER3_RULES = new Set([
  'csharp-dotnet-rules.md',
  'csharp-framework48-rules.md',
  'nodejs-typescript-rules.md',
  'python-rules.md',
  'java-rules.md',
]);

// Stack signal map — which canonical stack keys each rule signals (per plugin-path-resolution §2)
const STACK_SIGNALS = {
  'csharp-dotnet-rules.md':     ['dotnet', 'csharp'],
  'csharp-framework48-rules.md':['dotnet', 'csharp'],
  'nodejs-typescript-rules.md': ['nodejs'],
  'java-rules.md':              ['java'],
  'python-rules.md':            ['python'],
  'angular-rules.md':           ['angular'],
  'react-ecosystem-rules.md':   ['react'],
};

async function mainPostDetect() {
  if (!REPO_TYPE) {
    console.error('  ✗ --mode post-detect requires --repo-type <REPO_TYPE>');
    process.exit(1);
  }
  console.log('  bootstrap v' + PLUGIN_VERSION + '  mode=post-detect  repo-type=' + REPO_TYPE);

  // Load existing Phase 1 manifest if present — update it with Phase 2 results
  let manifest = null;
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    }
  } catch(e) {}

  stepPreCopyArchTemplates(manifest);
  stepDeployRules(manifest);

  if (manifest) saveManifest(manifest);
  console.log('  ✓ Bootstrap Phase 2 complete');
}

// ── Q1: stepPreCopyArchTemplates ──────────────────────────────────────────────────
// Composes the architecture templates for the detected repo type into
// .claude/architecture/ from TWO tiers (see ADR — architect template dedup):
//   1. templates/_shared/  — stack-agnostic base files (decisions, integrations,
//      security, data), authored once instead of duplicated per stack.
//   2. templates/<stack>/  — stack-specific files (architecture, reference,
//      deployment, the File-2 variant) PLUS any per-stack overrides of a shared
//      file (e.g. dotnet-api ships its own decisions/integrations/security/data;
//      frontend + js-library ship their own data).
// The compose is keyed by filename with the stack file WINNING any collision, so
// every stack still resolves to its exact 8-file set. Files are pre-copied as
// *scaffolding* — the <!-- TEMPLATE --> marker is RETAINED so the architect skill
// detects them as unpopulated and runs its population pass (the marker is the
// authoritative "needs population" signal; it is removed only after a genuine
// population pass in architect Step 5). See ADR 0053.

function stepPreCopyArchTemplates(manifest) {
  const folder = ARCH_TEMPLATE_FOLDER[REPO_TYPE];
  if (!folder) {
    console.log('  — arch-templates: unknown repo type "' + REPO_TYPE + '" — skipped');
    if (manifest) markStep(manifest, 'preCopyArchTemplates', { copied: 0, reason: 'unknown-repo-type' });
    return;
  }

  const templatesRoot = path.join(PLUGIN_DIR, 'skills', 'architect', 'templates');
  const sharedDir = path.join(templatesRoot, '_shared');
  const stackDir  = path.join(templatesRoot, folder);
  const destDir   = path.join(PROJECT_ROOT, '.claude', 'architecture');

  if (!fs.existsSync(stackDir)) {
    console.log('  — arch-templates: template dir not found at ' + stackDir + ' — skipped');
    if (manifest) markStep(manifest, 'preCopyArchTemplates', { copied: 0, reason: 'template-dir-missing' });
    return;
  }

  // Build the compose map: shared files first, then stack files overlay them
  // (stack wins collisions). Missing _shared/ is a packaging error, not fatal —
  // warn and continue with whatever the stack folder provides.
  const compose = new Map();   // filename -> absolute source path
  if (fs.existsSync(sharedDir)) {
    for (const f of fs.readdirSync(sharedDir).filter(f => f.endsWith('.md'))) {
      compose.set(f, path.join(sharedDir, f));
    }
  } else {
    console.log('  ⚠ arch-templates: shared base dir not found at ' + sharedDir
      + ' — stack-only compose (some architecture docs may be missing)');
  }
  for (const f of fs.readdirSync(stackDir).filter(f => f.endsWith('.md'))) {
    compose.set(f, path.join(stackDir, f));   // stack override wins
  }

  fs.mkdirSync(destDir, { recursive: true });
  let copied = 0, skipped = 0;
  for (const [file, src] of compose) {
    const dest = path.join(destDir, file);
    if (fs.existsSync(dest)) { skipped++; continue; }   // never overwrite real content

    // Pre-copy the composed scaffolding VERBATIM — the <!-- TEMPLATE --> marker is
    // retained so architect's Step 3 guard detects the file as unpopulated and runs
    // Steps 3–6. The marker is removed only after real population (architect Step 5).
    const content = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dest, content, 'utf8');
    copied++;
  }

  console.log('  ✓ arch-templates: ' + copied + ' composed [' + REPO_TYPE + ']'
    + (skipped ? ', ' + skipped + ' already existed' : ''));
  if (manifest) markStep(manifest, 'preCopyArchTemplates', { repoType: REPO_TYPE, folder, composed: copied, skipped });
}

// ── Q2: stepDeployRules ───────────────────────────────────────────────────────────
// Reads each rule file's detect: frontmatter and applies 4-layer selection logic,
// then copies matching rules to .claude/rules/. Mirrors the logic previously done
// by the LLM in setup-init Step 4 — fully deterministic, no LLM needed.

function stepDeployRules(manifest) {
  const rulesDir   = path.join(PLUGIN_DIR, '_project-deploy', 'rules');
  const destDir    = path.join(PROJECT_ROOT, '.claude', 'rules');
  const npmDepsPath = path.join(PROJECT_ROOT, '.claude', '_npm-deps.json');

  if (!fs.existsSync(rulesDir)) {
    console.log('  — rules: plugin rules dir not found — skipped');
    return;
  }

  fs.mkdirSync(destDir, { recursive: true });

  let npmDeps = [];
  try { npmDeps = JSON.parse(fs.readFileSync(npmDepsPath, 'utf8')); } catch(e) {}

  const ruleFiles = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md')).sort();
  const deployed = [], skipped = [];
  let backendLayer3Deployed = false;
  const detectedStacks = new Set();

  // Pass 1: Layer 0 (always) + Layer 3 (files/dependencies)
  for (const file of ruleFiles) {
    const content = fs.readFileSync(path.join(rulesDir, file), 'utf8');
    const fm = parseRuleFrontmatter(content);
    if (!fm) continue;
    const d = fm.detect || {};

    // Layer 0: always: true
    if (d.always === true) {
      deployRule(rulesDir, destDir, file, deployed, skipped);
      continue;
    }

    // Layer 1: always: false — handled in Pass 2
    if (d.always === false && !d.files && !d.dependencies) continue;

    // Layer 3a: files
    if (d.files && d.files.length > 0) {
      const fileHit    = d.files.some(p => globExistsInProject(PROJECT_ROOT, p));
      const exclFile   = (d.excludeIfFiles || []).some(p => globExistsInProject(PROJECT_ROOT, p));
      const exclDep    = (d.excludeIfDependencies || []).some(dep => npmDeps.includes(dep));
      if (fileHit && !exclFile && !exclDep) {
        deployRule(rulesDir, destDir, file, deployed, skipped);
        if (BACKEND_LAYER3_RULES.has(file)) backendLayer3Deployed = true;
        for (const s of (STACK_SIGNALS[file] || [])) detectedStacks.add(s);
      }
      continue;
    }

    // Layer 3b: dependencies
    if (d.dependencies && d.dependencies.length > 0) {
      const depHit  = d.dependencies.some(dep => npmDeps.includes(dep));
      const exclDep = (d.excludeIfDependencies || []).some(dep => npmDeps.includes(dep));
      if (depHit && !exclDep) {
        deployRule(rulesDir, destDir, file, deployed, skipped);
        if (BACKEND_LAYER3_RULES.has(file)) backendLayer3Deployed = true;
        for (const s of (STACK_SIGNALS[file] || [])) detectedStacks.add(s);
      }
    }
  }

  // Pass 2: Layer 1 (always: false, no other conditions) — backend-only rules
  if (backendLayer3Deployed) {
    for (const file of ruleFiles) {
      const content = fs.readFileSync(path.join(rulesDir, file), 'utf8');
      const fm = parseRuleFrontmatter(content);
      if (!fm) continue;
      const d = fm.detect || {};
      if (d.always !== false || d.files || d.dependencies) continue;
      deployRule(rulesDir, destDir, file, deployed, skipped);
    }
  }

  // Update dream-init-state.json
  const statePath = path.join(PROJECT_ROOT, '.claude', 'dream-init-state.json');
  try {
    let state = {};
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch(e) {}
    state.detected_stacks = [...detectedStacks];
    state.deployed_rules  = [...new Set([...deployed, ...skipped])];
    state.repo_type       = REPO_TYPE;
    atomicWrite(statePath, JSON.stringify(state, null, 2));
  } catch(e) {}

  // Clean up npm deps — no longer needed after rules are deployed
  try { if (fs.existsSync(npmDepsPath)) fs.unlinkSync(npmDepsPath); } catch(e) {}

  const preview = deployed.slice(0, 3).join(', ') + (deployed.length > 3 ? ', …' : '');
  console.log('  ✓ rules        : ' + deployed.length + ' deployed'
    + (skipped.length ? ', ' + skipped.length + ' already existed' : '')
    + (deployed.length ? ' [' + preview + ']' : ''));

  if (manifest) {
    markStep(manifest, 'deployRules', { deployed: deployed.length, skipped: skipped.length, rules: deployed });
    markLLMItemDone(manifest, 'deploy_rules', 'deployed by bootstrap Phase 2 (' + deployed.length + ' rules)');
  }
}

function deployRule(rulesDir, destDir, file, deployed, skipped) {
  const dest = path.join(destDir, file);
  if (fs.existsSync(dest)) { skipped.push(file); return; }
  try { fs.copyFileSync(path.join(rulesDir, file), dest); deployed.push(file); }
  catch(e) {}
}

// ── Q3: Frontmatter + glob helpers ────────────────────────────────────────────────

function parseRuleFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const yaml = match[1];
  const detect = {};

  const alwaysM = yaml.match(/^\s*always:\s*(true|false)/m);
  if (alwaysM) detect.always = alwaysM[1] === 'true';

  const parseArr = str => str.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);

  const filesM     = yaml.match(/^\s*files:\s*\[([^\]]*)\]/m);
  if (filesM) detect.files = parseArr(filesM[1]);

  const depsM      = yaml.match(/^\s*dependencies:\s*\[([^\]]*)\]/m);
  if (depsM) detect.dependencies = parseArr(depsM[1]);

  const exclDepsM  = yaml.match(/^\s*excludeIfDependencies:\s*\[([^\]]*)\]/m);
  if (exclDepsM) detect.excludeIfDependencies = parseArr(exclDepsM[1]);

  const exclFilesM = yaml.match(/^\s*excludeIfFiles:\s*\[([^\]]*)\]/m);
  if (exclFilesM) detect.excludeIfFiles = parseArr(exclFilesM[1]);

  return { detect };
}

function globExistsInProject(root, pattern) {
  // Convert glob pattern to a RegExp that matches relative paths.
  // Only supports the * and ** wildcards used in rule frontmatter.
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape regex special chars (preserves escaped dots)
    .replace(/\*\*\//g, '(.+\/)?')           // **/ = optional path prefix (zero or more dirs)
    .replace(/\*\*/g, '.*')                  // ** anywhere else = any characters
    .replace(/\*/g, '[^/]*');                // * = any chars except path separator
  const regex = new RegExp(regexStr);
  return walkAndMatch(root, root, regex, 4);
}

function walkAndMatch(root, dir, regex, depth) {
  if (depth < 0) return false;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      if (entry.isFile() && regex.test(rel)) return true;
      if (entry.isDirectory() && depth > 0 && walkAndMatch(root, abs, regex, depth - 1)) return true;
    }
  } catch(e) {}
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('  ✗ Bootstrap fatal: ' + err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
