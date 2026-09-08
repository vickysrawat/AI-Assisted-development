#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Deterministic repo-type detection (Phase B of install/setup plan).
//                      Runs the same 12-type detection ladder as architect Step 1 in the
//                      same priority order (R7 parity). Merges repo_type + initial
//                      detected_stacks[] into .claude/dream-init-state.json (atomicWrite).
//                      Signals AMBIGUOUS when multiple mutually-exclusive stacks match so
//                      setup-init.md can invoke the LLM fallback inline.
// What it touches:     Reads: project root files (.sln, angular.json, nx.json, package.json,
//                        pom.xml, build.gradle, requirements.txt, pyproject.toml, *.csproj,
//                        *.py, *.cs), and .claude/dream-init-state.json (if present).
//                      Writes: .claude/dream-init-state.json (merges two fields only:
//                        repo_type, detected_stacks; never clobbers other fields).
// What it does NOT do: No network calls. No LLM. Does not write graph.json or any other
//                      file. Does not run Bootstrap Phase 2 (architect's Step 1c does that).
//                      Does not overwrite a state file that already has repo_type set
//                      (resume-safe — see --force flag to override).
// APIs / commands:     Node.js stdlib only: fs, path, child_process (execSync for grep),
//                      process. Offline. Write to state is atomic (write-tmp → rename).
// How to verify:       Run from a project root: `node path/to/repo-detect.cjs`
//                      Inspect exit code (0=OK, 1=already-set, 2=AMBIGUOUS, 3=UNKNOWN)
//                      and .claude/dream-init-state.json for repo_type / detected_stacks.

'use strict';
const fs   = require('fs');
const path = require('path');
const stackSignals = require('./stack-signals.cjs');   // canonical signal→stack_key detection

// ── Args ──────────────────────────────────────────────────────────────────────
const FORCE  = process.argv.includes('--force');  // overwrite even if repo_type is set
const DRY    = process.argv.includes('--dry-run'); // detect but do not write state
const JSON_OUT = process.argv.includes('--json'); // recompute (bypass resume), no write, print JSON
const ROOT   = process.argv.find(a => a.startsWith('--root='))?.slice(7) || '.';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fileExists(rel) {
  try { return fs.statSync(path.join(ROOT, rel)).isFile(); } catch (_) { return false; }
}
function dirExists(rel) {
  try { return fs.statSync(path.join(ROOT, rel)).isDirectory(); } catch (_) { return false; }
}
function globExists(pattern) {
  // Simple glob: supports leading wildcard dirs. Used for *.sln, *.csproj.
  const [dirPart, ext] = (() => {
    const parts = pattern.split('/');
    const file  = parts.pop();
    return [parts.join('/') || '.', file];
  })();
  const absDir = path.join(ROOT, dirPart);
  try {
    const ents = fs.readdirSync(absDir);
    if (ext.startsWith('*.')) {
      const suffix = ext.slice(1);  // '.sln'
      return ents.some(e => e.endsWith(suffix));
    }
    return ents.includes(ext);
  } catch (_) { return false; }
}
function findFirst(rel, name) {
  // Find a file by name up to maxDepth below ROOT/rel.
  const maxDepth = 5;
  function walk(dir, depth) {
    if (depth > maxDepth) return false;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return false; }
    for (const e of ents) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      if (e.isFile() && e.name === name) return true;
      if (e.isDirectory() && walk(path.join(dir, e.name), depth + 1)) return true;
    }
    return false;
  }
  return walk(path.join(ROOT, rel), 0);
}
function anyFileDeep(suffix) {
  // Recursively find any file whose name ends with `suffix` (e.g. '.slnx', '.cs'), up to
  // maxDepth below ROOT. Unlike findFirst (exact-name only), this matches by extension —
  // used for solution/project/source detection where the base name is unknown.
  const maxDepth = 5;
  function walk(dir, depth) {
    if (depth > maxDepth) return false;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return false; }
    for (const e of ents) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      if (e.isFile() && e.name.endsWith(suffix)) return true;
      if (e.isDirectory() && walk(path.join(dir, e.name), depth + 1)) return true;
    }
    return false;
  }
  return walk(path.join(ROOT, '.'), 0);
}
function grepFile(rel, pattern) {
  // Grep a file for a substring (literal). Returns true if found.
  try {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    return content.includes(pattern);
  } catch (_) { return false; }
}
function grepGlob(rel, fileGlob, pattern) {
  // Search all files matching fileGlob under ROOT/rel for pattern (literal).
  const ext = fileGlob.startsWith('*.') ? fileGlob.slice(1) : '';
  function walk(dir) {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return false; }
    for (const e of ents) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      if (e.isDirectory()) { if (walk(path.join(dir, e.name))) return true; }
      else if (!ext || e.name.endsWith(ext)) {
        try {
          if (fs.readFileSync(path.join(dir, e.name), 'utf8').includes(pattern)) return true;
        } catch (_) {}
      }
    }
    return false;
  }
  return walk(path.join(ROOT, rel));
}
function readPkg() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')); }
  catch (_) { return null; }
}

// ── Detection ladder — EXACTLY matches architect Step 1 priority order ────────
// R7: must be byte-for-byte equivalent in ordering; edit BOTH if the ladder changes.

function detect() {
  const pkg  = readPkg();
  const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};

  // 1. Nx Angular monorepo (before standard Angular)
  if (fileExists('nx.json')) return { type: 'ANGULAR_NX', stacks: ['angular', 'nodejs'] };

  // 2. Standard Angular workspace
  if (fileExists('angular.json')) return { type: 'ANGULAR_STANDARD', stacks: ['angular', 'nodejs'] };

  // 3. React (package.json with react dependency)
  if (pkg && deps['react']) return { type: 'REACT', stacks: ['react', 'nodejs'] };

  // 4. Custom JS/TS library (package.json, no framework, has main/exports/module)
  if (pkg && !deps['react'] && !deps['@angular/core'] && (pkg.main || pkg.exports || pkg.module)) {
    return { type: 'JS_LIBRARY', stacks: ['nodejs', 'javascript'] };
  }

  // 5. Java / Spring Boot (Maven or Gradle with spring-boot dependency)
  if (grepGlob('.', '*.xml',    'spring-boot') ||
      grepGlob('.', '*.gradle', 'org.springframework.boot')) {
    return { type: 'SPRING_BOOT', stacks: ['java'] };
  }

  // 6. Python — check in priority order: Django → FastAPI → Flask
  if (findFirst('.', 'manage.py')) {
    return { type: 'PYTHON_DJANGO', stacks: ['python'] };
  }
  if (grepGlob('.', 'requirements.txt', 'fastapi') ||
      grepGlob('.', 'pyproject.toml',   'fastapi')) {
    return { type: 'PYTHON_FASTAPI', stacks: ['python'] };
  }
  if (grepGlob('.', 'requirements.txt', 'flask') ||
      grepGlob('.', 'requirements.txt', 'Flask') ||
      grepGlob('.', 'pyproject.toml',   'flask')) {
    return { type: 'PYTHON_FLASK', stacks: ['python'] };
  }

  // 7. VSTO add-in — check BEFORE ASPNET_FRAMEWORK (both may have .csproj)
  if (findFirst('.', 'ThisAddIn.cs') || findFirst('.', 'ThisWorkbook.cs') || findFirst('.', 'ThisDocument.cs')) {
    return { type: 'VSTO', stacks: ['dotnet'] };
  }

  // 8. Legacy ASP.NET Framework (packages.config)
  if (fileExists('packages.config') || findFirst('.', 'packages.config')) {
    return { type: 'ASPNET_FRAMEWORK', stacks: ['dotnet_framework'] };
  }

  // 9. ASP.NET MVC (SDK-style csproj + Views folder)
  if (globExists('*.csproj') && dirExists('Views')) {
    return { type: 'ASPNET_MVC', stacks: ['dotnet'] };
  }
  if (grepGlob('.', '*.csproj', 'Microsoft.NET.Sdk.Web') && findFirst('.', 'Views')) {
    return { type: 'ASPNET_MVC', stacks: ['dotnet'] };
  }

  // 10. .NET (any solution or project file — broadest .NET catch-all, last .NET check).
  //     Extension-tolerant on purpose: matches .sln AND .slnx (the XML solution format,
  //     .NET 9+/VS 17.13+) and any *.sln* variant, plus C#/F#/VB project files. Uses
  //     anyFileDeep (glob-capable) because findFirst matches exact names only — a nested
  //     Foo.slnx/Foo.csproj must still be found. (ADR: modern-format resilience.)
  if (globExists('*.sln') || globExists('*.slnx') ||
      anyFileDeep('.sln') || anyFileDeep('.slnx') ||
      globExists('*.csproj') || globExists('*.fsproj') || globExists('*.vbproj') ||
      anyFileDeep('.csproj') || anyFileDeep('.fsproj') || anyFileDeep('.vbproj')) {
    return { type: 'DOTNET_API', stacks: ['dotnet'] };
  }

  // 10b. Graceful .NET fallback — no recognised solution/project file matched, but a C#
  //      source tree is present. A future unknown packaging format degrades to DOTNET_API
  //      (a .cs tree is unambiguously .NET) rather than failing UNKNOWN. Warn so a rare
  //      false positive is visible and can be overridden manually.
  if (anyFileDeep('.cs')) {
    process.stderr.write(
      'repo-detect: no .sln/.slnx/.csproj matched, but .cs sources are present — ' +
      'falling back to DOTNET_API. If that is wrong, set repo_type manually in ' +
      '.claude/dream-init-state.json.\n'
    );
    return { type: 'DOTNET_API', stacks: ['dotnet'] };
  }

  // Nothing matched
  return null;
}

// ── Scored detection (ADR 0059) ────────────────────────────────────────────────
// Coarse detect() gives repo_type + coarse stacks; scoreStacks() adds the canonical scored
// stack_keys + nested runtime generation that rule deployment consumes.
// Track-A feature flag (default OFF): per-project rule scoping. Read from env or persisted state.
// OFF → scoreStacks uses the single-name gate (pre-Track-A behavior). See runtime-generation-spec.md.
function perProjectRulesEnabled() {
  if (process.env.PER_PROJECT_RULES === '1') return true;
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'dream-init-state.json'), 'utf8')).per_project_rules === true; }
  catch (_) { return false; }
}

function computeDetection(type, coarseStacks, perProjectRules) {
  const signals = stackSignals.gatherProjectSignals(ROOT);
  const generations = stackSignals.resolveAllGenerations(signals);   // all-stack manifest generations
  const { detection } = stackSignals.scoreStacks(signals, type, generations, { perProjectRules: !!perProjectRules });
  // detected_stacks: legacy coarse vocabulary — union of detect()'s stacks + derived-from-detection.
  const derived = stackSignals.deriveDetectedStacks(detection);
  const detectedStacks = [...new Set([...(coarseStacks || []), ...derived])];
  // Freshness fingerprint (adversarial #3): hash of the build-file set (path+mtime). Consumers
  // (graph-sync / setup-status) recompute generations when this diverges; `versions[]` is best-effort.
  const meta = { buildfile_fingerprint: buildfileFingerprint(signals) };
  // generations map (keyed by language) is a SIBLING of detection — keeping it out of the
  // detection categories keeps every detection[cat] an array for the deploy loop.
  return { detection, detectedStacks, generations, meta };
}

// Stable hash over the build-file set that determines TFM/generation (path + mtime). Short digest.
function buildfileFingerprint(signals) {
  const m = signals.manifests || {};
  const files = [
    ...(m.csproj || []), ...(m.directoryBuildProps || []), ...(m.directoryPackagesProps || []),
    ...(m.packagesConfig || []), ...(m.globalJson ? [m.globalJson] : []),
  ].sort();
  const h = require('crypto').createHash('sha256');
  for (const f of files) {
    let mt = 0; try { mt = Math.floor(fs.statSync(f).mtimeMs); } catch (_) {}
    h.update(path.relative(ROOT, f).replace(/\\/g, '/') + ':' + mt + '\n');
  }
  return h.digest('hex').slice(0, 16);
}

// ── Atomic state write ────────────────────────────────────────────────────────
function mergeState(type, stacks, detection, generations, meta) {
  const statePath = path.join(ROOT, '.claude', 'dream-init-state.json');
  let state = {};
  if (fs.existsSync(statePath)) {
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); }
    catch (_) { /* malformed — preserve what we can by merging over an empty base */ }
  }
  state.repo_type       = type;
  // detected_stacks: union of existing + newly detected (legacy vocabulary, deduped).
  const existing        = Array.isArray(state.detected_stacks) ? state.detected_stacks : [];
  state.detected_stacks = [...new Set([...existing, ...stacks])];
  if (detection) state.detection = detection;         // NEW scored detection (ADR 0059)
  if (generations) state.generations = generations;   // all-stack runtime generations (sibling)
  if (meta) state.generations_meta = { ...(meta), detected_at: new Date().toISOString() }; // freshness (#3)
  // Track-A flag — seed the explicit default OFF for already-initialized projects (setup-sync /
  // re-provision), but NEVER overwrite a developer's explicit true/false.
  if (!('per_project_rules' in state)) state.per_project_rules = false;
  // Atomic write: tmp → rename (crash-safe).
  const tmp = statePath + '.tmp';
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, statePath);
}

// ── Check for existing detection (resume path) ────────────────────────────────
function existingType() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'dream-init-state.json'), 'utf8'));
    return s.repo_type || null;
  } catch (_) { return null; }
}

// ── Main ──────────────────────────────────────────────────────────────────────
// --json: reusable "inspect any repo without touching it" primitive (P1-Shared). Always
// recomputes (bypasses the resume short-circuit), NEVER writes state, prints machine-readable
// {repo_type, detected_stacks, generations, meta}. Owned caller: scripts/migration-source-detect.cjs
// (the migration skill's stack-neutral source detector wraps this per source root). See ADR 0060.
if (JSON_OUT) {
  const r = detect();
  // Inspection mode always emits the full per-project spread (no deployment consequence).
  const out = r ? computeDetection(r.type, r.stacks, true) : { detection: {}, detectedStacks: [], generations: {}, meta: {} };
  process.stdout.write(JSON.stringify({
    repo_type: r ? r.type : null,
    detected_stacks: out.detectedStacks,
    generations: out.generations,
    meta: out.meta,
  }, null, 2) + '\n');
  process.exit(r ? 0 : 3);
}

const existing = existingType();
if (existing && !FORCE) {
  // Resume path: detection already done, no need to re-detect.
  process.stdout.write('REPO_TYPE=' + existing + '\n');
  process.stdout.write('AMBIGUOUS=false\n');
  process.stdout.write('SKIP=true\n');
  process.exit(1);  // exit 1 = already-set; setup-init.md treats this as "skip, continue"
}

const result = detect();

if (!result) {
  // Nothing matched — signal UNKNOWN so the skill can fail loudly.
  process.stderr.write(
    'repo-detect: no recognisable project structure found in ' + path.resolve(ROOT) + '\n' +
    '  Checked: angular.json, nx.json, package.json, *.sln, *.slnx, *.csproj/*.fsproj/*.vbproj,\n' +
    '           *.cs, pom.xml, build.gradle, manage.py, requirements.txt, pyproject.toml,\n' +
    '           *.cs VSTO, packages.config.\n' +
    '  Run /setup-init after adding source files, or specify the type manually.\n'
  );
  process.exit(3);  // exit 3 = UNKNOWN — skill must hard-fail
}

const { detection, detectedStacks, generations, meta } = computeDetection(result.type, result.stacks, perProjectRulesEnabled());

if (!DRY) {
  mergeState(result.type, detectedStacks, detection, generations, meta);
}

process.stdout.write('REPO_TYPE='       + result.type              + '\n');
process.stdout.write('DETECTED_STACKS=' + detectedStacks.join(',')  + '\n');
process.stdout.write('AMBIGUOUS=false\n');
process.exit(0);  // exit 0 = detection successful
