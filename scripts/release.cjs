#!/usr/bin/env node
/**
 * Plugin release helper — two-phase workflow.
 *
 * Phase 1 — bump the version (wraps the existing bump-version.js, adds what it misses):
 *   node scripts/release.cjs patch|minor|major [--breaking]
 *   npm run bump:patch | npm run bump:minor | npm run bump:major
 *
 *   - Calls scripts/bump-version.js (handles plugin.json + CLAUDE.md + CHANGELOG stub)
 *   - Also updates _project-deploy/CLAUDE.md plugin version label
 *   - Also seeds plugin-manifest.json with the new version
 *   - Stops with instructions to fill in CHANGELOG before phase 2
 *
 * Phase 2 — commit + tag (run after filling in CHANGELOG stub):
 *   node scripts/release.cjs --commit
 *   npm run release
 *
 *   - Validates CHANGELOG stub is filled (no TODO remaining)
 *   - Validates version consistency across all files
 *   - Stages all release files
 *   - Creates commit: "chore: release v{version}"
 *   - Creates annotated tag: v{version}
 *   - Prints push instructions
 *
 * The tag push triggers CI release validation (see azure-pipelines.yml).
 * CI validates tests pass before teams can see the new version in setup-status.
 */
'use strict';

const fs   = require('fs');
const cp   = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJSON(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }
function run(cmd, opts) {
  return cp.execSync(cmd, { encoding: 'utf8', cwd: ROOT, ...opts }).trim();
}

const RELEASE_FILES = [
  '.claude-plugin/plugin.json',
  'CLAUDE.md',
  '_project-deploy/CLAUDE.md',
  'CHANGELOG.md',
  'plugin-manifest.json',
];

const args    = process.argv.slice(2);
const mode    = args[0];

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: commit + tag
// ─────────────────────────────────────────────────────────────────────────────
if (mode === '--commit') {
  const pj      = readJSON(path.join(ROOT, '.claude-plugin/plugin.json'));
  const version = pj.version;
  const tagName = `v${version}`;

  // 1. Only release files may be modified — nothing else
  const status = run('git status --porcelain');
  const dirty  = status.split('\n').filter(l => l.trim() && !l.startsWith('??'));
  const unexpected = dirty.filter(l => {
    const file = l.slice(3).trim().replace(/^"(.+)"$/, '$1');
    return !RELEASE_FILES.includes(file);
  });
  if (unexpected.length > 0) {
    console.error('❌ Unexpected dirty files — commit or stash before releasing:');
    unexpected.forEach(f => console.error('   ' + f));
    process.exit(1);
  }

  // 2. CHANGELOG top entry must match the version and have no TODO stub
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  if (!changelog.startsWith(`## [${version}]`)) {
    console.error(`❌ CHANGELOG.md does not start with ## [${version}].`);
    console.error(`   Run npm run bump:patch|minor|major first, then fill in the CHANGELOG stub.`);
    process.exit(1);
  }
  if (changelog.includes('### TODO: summary of changes')) {
    console.error('❌ CHANGELOG.md still has the TODO stub. Fill in the changes before releasing.');
    process.exit(1);
  }

  // 3. Version consistency across all files
  const guard = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-version-consistency.js')], {
    stdio: 'inherit', cwd: ROOT,
  });
  if (guard.status !== 0) {
    console.error('❌ Version consistency check failed. Run npm run bump:patch|minor|major to sync.');
    process.exit(1);
  }

  // 4. Tag must not already exist
  try {
    run(`git rev-parse v${version} --`);
    const tagCommit  = run(`git rev-parse v${version}`);
    const headCommit = run('git rev-parse HEAD');
    if (tagCommit === headCommit) {
      console.log(`ℹ Tag ${tagName} already exists on HEAD — nothing to do.`);
      process.exit(0);
    }
    console.error(`❌ Tag ${tagName} already exists at a different commit. Bump to a new version.`);
    process.exit(1);
  } catch (_) { /* tag does not exist — good */ }

  // 5. Stage release files
  run(`git add ${RELEASE_FILES.join(' ')}`);

  // 6. Commit
  run(`git commit -m "chore: release ${tagName}"`);
  console.log(`  ✓ Committed: chore: release ${tagName}`);

  // 7. Annotated tag — summary from first non-empty body line of CHANGELOG entry
  const summary = (changelog.split('\n').slice(2).find(l => l.trim()) || `Release ${version}`).slice(0, 100);
  run(`git tag -a ${tagName} -m "Release ${tagName}: ${summary}"`);
  console.log(`  ✓ Tagged: ${tagName}`);

  console.log(`\n✅ Release ${tagName} ready to push.\n`);
  console.log('Push to trigger CI release validation:');
  console.log(`  git push origin main`);
  console.log(`  git push origin ${tagName}`);
  console.log('\nCI runs tests on the tag — if tests fail, fix and cut a new version.');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: bump
// ─────────────────────────────────────────────────────────────────────────────
const bumpType = mode;
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Usage:');
  console.error('  npm run bump:patch|minor|major   — bump version + update manifest');
  console.error('  npm run release                  — commit + tag (after filling CHANGELOG)');
  console.error('');
  console.error('Flags:');
  console.error('  --breaking   Mark this release as a breaking change in plugin-manifest.json');
  process.exit(1);
}

// 1. Read current version from plugin.json (single source of truth)
const pj      = readJSON(path.join(ROOT, '.claude-plugin/plugin.json'));
const current = pj.version;
const parts   = current.split('.').map(Number);
if (bumpType === 'major')      { parts[0]++; parts[1] = 0; parts[2] = 0; }
else if (bumpType === 'minor') { parts[0]++; parts[1]++; parts[2] = 0; }
else                           { parts[2]++; }
const newVersion  = parts.join('.');
const isBreaking  = args.includes('--breaking');
const today       = new Date().toISOString().slice(0, 10);

console.log(`Bumping ${current} → ${newVersion} (${bumpType})`);
if (isBreaking) console.log('  ⚠ Flagged as breaking change');

// 2. Working directory must be clean before bumping
const status = run('git status --porcelain');
if (status) {
  console.error('❌ Working directory is not clean. Commit or stash changes first.');
  process.exit(1);
}

// 3. Tag must not already exist
try {
  run(`git rev-parse v${newVersion} --`);
  console.error(`❌ Tag v${newVersion} already exists. Use a different version.`);
  process.exit(1);
} catch (_) { /* good */ }

// 4. Delegate the core bump to the existing tool (plugin.json + CLAUDE.md + CHANGELOG stub)
const bumpResult = cp.spawnSync(process.execPath, [
  path.join(ROOT, 'scripts/bump-version.js'), newVersion, today,
], { stdio: 'inherit', cwd: ROOT });
if ((bumpResult.status ?? 1) !== 0) process.exit(bumpResult.status ?? 1);

// 5. Update _project-deploy/CLAUDE.md — not covered by bump-version.js
const deployPath    = path.join(ROOT, '_project-deploy/CLAUDE.md');
let   deployContent = fs.readFileSync(deployPath, 'utf8');
deployContent = deployContent.replace(/^# Plugin version:.*$/m, `# Plugin version: ${newVersion}`);
fs.writeFileSync(deployPath, deployContent, 'utf8');
console.log('  ✓ _project-deploy/CLAUDE.md label');

// 6. Update plugin-manifest.json (target projects read this for staleness detection)
const manifestPath = path.join(ROOT, 'plugin-manifest.json');
let manifest = {};
try { manifest = readJSON(manifestPath); } catch (_) {}
manifest.latest   = newVersion;
manifest.released = today;
manifest.breaking = isBreaking;
if (!manifest.summary) manifest.summary = '';
writeJSON(manifestPath, manifest);
console.log('  ✓ plugin-manifest.json');

console.log(`
✅ Version bumped to ${newVersion}.

Next steps:
  1. Fill in CHANGELOG.md — replace the TODO stub with what changed.
  2. Optionally update plugin-manifest.json "summary" with a one-line description.
  3. Run: npm run release
     This commits all release files and creates annotated tag v${newVersion}.
  4. Push: git push origin main && git push origin v${newVersion}
`);
if (isBreaking) {
  console.log('⚠ Breaking change — document migration steps in CHANGELOG.');
  console.log('  Target projects will see a breaking-change warning in setup-status.\n');
}
