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

// ── Args ──────────────────────────────────────────────────────────────────────
const FORCE  = process.argv.includes('--force');  // overwrite even if repo_type is set
const DRY    = process.argv.includes('--dry-run'); // detect but do not write state
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

  // 10. .NET (any .sln present — broadest .NET catch-all, last .NET check)
  if (globExists('*.sln') || findFirst('.', '*.sln') || globExists('*.csproj')) {
    return { type: 'DOTNET_API', stacks: ['dotnet'] };
  }

  // Nothing matched
  return null;
}

// ── Atomic state write ────────────────────────────────────────────────────────
function mergeState(type, stacks) {
  const statePath = path.join(ROOT, '.claude', 'dream-init-state.json');
  let state = {};
  if (fs.existsSync(statePath)) {
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); }
    catch (_) { /* malformed — preserve what we can by merging over an empty base */ }
  }
  state.repo_type       = type;
  // Merge detected_stacks: union of existing + newly detected, deduplicated.
  const existing        = Array.isArray(state.detected_stacks) ? state.detected_stacks : [];
  state.detected_stacks = [...new Set([...existing, ...stacks])];
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
    '  Checked: angular.json, nx.json, package.json, *.sln, *.csproj, pom.xml,\n' +
    '           build.gradle, manage.py, requirements.txt, pyproject.toml, *.cs VSTO,\n' +
    '           packages.config.\n' +
    '  Run /setup-init after adding source files, or specify the type manually.\n'
  );
  process.exit(3);  // exit 3 = UNKNOWN — skill must hard-fail
}

if (!DRY) {
  mergeState(result.type, result.stacks);
}

process.stdout.write('REPO_TYPE='       + result.type          + '\n');
process.stdout.write('DETECTED_STACKS=' + result.stacks.join(',') + '\n');
process.stdout.write('AMBIGUOUS=false\n');
process.exit(0);  // exit 0 = detection successful
