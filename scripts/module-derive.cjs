#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Deterministic module-skeleton derivation (Phase C of install/setup plan).
//                      Walks the project directory tree using the same bounded-context heuristic
//                      as architect Step 7-1 and graph-sync Step 4. Produces a PRIVATE,
//                      non-schema-bound file `.claude/graph/.module-skeleton.json` containing
//                      the canonical module list + path globs. This shared artifact is consumed
//                      by both architect (for doc section headings) and graph-create (for graph
//                      node derivation), guaranteeing they agree on module boundaries (S6).
// What it touches:     Reads: project root directory tree (source files and subdirs only).
//                      Writes: .claude/graph/.module-skeleton.json — atomic (write-tmp → rename).
//                      Does NOT write graph.json, fingerprints, or any schema artifact.
// What it does NOT do: No LLM calls. No fingerprint computation (stays in graph-create/graph-sync
//                      bash helper). No graph-extract-edges.js invocation. No schema validation.
//                      Does not overwrite an existing skeleton unless --force is passed.
// APIs / commands:     Node.js stdlib only: fs, path, process. Offline. Atomic write.
// How to verify:       Run: `node scripts/module-derive.cjs --dry-run` — prints discovered
//                      modules without writing. Inspect .claude/graph/.module-skeleton.json
//                      after a real run: should list source dirs as modules with paths globs.

'use strict';
const fs   = require('fs');
const path = require('path');

// ── Args ──────────────────────────────────────────────────────────────────────
const FORCE = process.argv.includes('--force');
const DRY   = process.argv.includes('--dry-run');
const ROOT  = process.argv.find(a => a.startsWith('--root='))?.slice(7)
           || process.cwd();

// ── Exclusions — SAME set as graph-sync Step 4 + architect Step 7-1 (S6) ─────
// Do NOT add/remove items here without updating both SKILL.md skills to match.
const EXCLUDE_DIRS = new Set([
  '.git', '.claude', 'node_modules', 'dist', 'bin', 'obj', '.angular',
  '__pycache__', 'migrations', 'target', '.vs', '.vscode', '.idea',
  'temp', 'tmp', '.github', 'infra', 'terraform', 'k8s', 'helm',
  'coverage', '.nyc_output', '.next', '.nuxt', 'out', 'build',
  'vendor', 'packages', // packages is a "container" dir — we look INSIDE it
]);

// Depth-1 "container" dir names: we look inside these for bounded contexts
// instead of treating the container itself as a module.
const CONTAINER_DIRS = new Set([
  'src', 'app', 'lib', 'apps', 'modules', 'services', 'microservices',
  'packages', 'libs', 'core', 'shared', 'common',
]);

// ── Count source files in a directory (non-recursive) ────────────────────────
const SOURCE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.cs', '.java', '.py', '.go', '.rs', '.rb', '.php', '.kt', '.scala',
]);
function countSourceFiles(absDir) {
  try {
    return fs.readdirSync(absDir, { withFileTypes: true })
      .filter(e => e.isFile() && SOURCE_EXTS.has(path.extname(e.name).toLowerCase()))
      .length;
  } catch (_) { return 0; }
}

// ── Find common entry point in a directory ────────────────────────────────────
const ENTRY_PATTERNS = [
  'index.ts', 'index.js', 'index.tsx',
  'Program.cs', 'Startup.cs',
  'App.tsx', 'App.ts', 'app.ts', 'app.js',
  'main.py', 'app.py', 'manage.py',
  'main.ts', 'main.js',
];
function findEntryPoint(absDir, relDir) {
  for (const pat of ENTRY_PATTERNS) {
    if (fs.existsSync(path.join(absDir, pat))) {
      return relDir ? relDir + '/' + pat : pat;
    }
  }
  return null;
}

// ── toId: directory name → kebab-case module id ──────────────────────────────
function toId(name) {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
}

// ── Scan for module candidates ────────────────────────────────────────────────
function scan() {
  const modules = [];

  let depth1;
  try {
    depth1 = fs.readdirSync(ROOT, { withFileTypes: true })
      .filter(e => e.isDirectory() && !EXCLUDE_DIRS.has(e.name) && !e.name.startsWith('.'));
  } catch (_) { return modules; }

  for (const d1 of depth1) {
    const abs1 = path.join(ROOT, d1.name);
    const rel1 = d1.name;

    if (CONTAINER_DIRS.has(d1.name)) {
      // Look INSIDE this container for bounded contexts (depth 2)
      let depth2;
      try { depth2 = fs.readdirSync(abs1, { withFileTypes: true }); } catch (_) { continue; }
      const subDirs = depth2.filter(e => e.isDirectory() && !EXCLUDE_DIRS.has(e.name) && !e.name.startsWith('.'));

      if (subDirs.length === 0) {
        // Container has no subdirs — treat it as the module itself
        modules.push({
          id:        toId(d1.name),
          module:    d1.name,
          domain:    d1.name,
          paths:     [rel1 + '/**'],
          entryPoint: findEntryPoint(abs1, rel1),
        });
        continue;
      }

      for (const d2 of subDirs) {
        const abs2 = path.join(abs1, d2.name);
        const rel2 = rel1 + '/' + d2.name;
        const srcCount = countSourceFiles(abs2);

        if (srcCount <= 2) {
          // Merge rule: too few files — fold back into the container if it has content
          // (but only if the container itself has source files). Otherwise still list it.
          if (countSourceFiles(abs1) === 0) continue; // truly empty intermediate dir
          // Skip the sub-dir; it will be included via the container's glob if needed.
          continue;
        }
        modules.push({
          id:        toId(d2.name),
          module:    d2.name,
          domain:    d2.name,
          paths:     [rel2 + '/**'],
          entryPoint: findEntryPoint(abs2, rel2),
        });
      }
    } else {
      // Non-container: treat this depth-1 dir as a module
      const srcCount = countSourceFiles(abs1);

      // Merge rule: skip depth-1 dirs with no source files and no meaningful subdirs
      let depth2;
      try { depth2 = fs.readdirSync(abs1, { withFileTypes: true }); } catch (_) { depth2 = []; }
      const hasMeaningfulSubs = depth2.some(
        e => e.isDirectory() && !EXCLUDE_DIRS.has(e.name) && !e.name.startsWith('.')
      );

      if (srcCount === 0 && !hasMeaningfulSubs) continue; // empty leaf dir — skip

      modules.push({
        id:        toId(d1.name),
        module:    d1.name,
        domain:    d1.name,
        paths:     [rel1 + '/**'],
        entryPoint: findEntryPoint(abs1, rel1),
      });
    }
  }

  // De-duplicate by id (container sub-dirs may conflict with a same-named depth-1 dir)
  const seen = new Set();
  return modules.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
}

// ── Main ──────────────────────────────────────────────────────────────────────
// Check for existing skeleton (resume path) unless --force
const skelPath = path.join(ROOT, '.claude', 'graph', '.module-skeleton.json');
if (fs.existsSync(skelPath) && !FORCE) {
  process.stdout.write('SKELETON_EXISTS=true\n');
  process.exit(1); // exit 1 = already present; setup-init.md treats this as "skip, continue"
}

const modules   = scan();
const structure = modules.length > 30 ? 'domain' : 'flat';
const today     = new Date().toISOString().slice(0, 10);

const skeleton = {
  generatedAt: today,
  structure,
  moduleCount: modules.length,
  modules,
};

if (DRY) {
  process.stdout.write(JSON.stringify(skeleton, null, 2) + '\n');
  process.stdout.write('DRY_RUN — nothing written\n');
  process.exit(0);
}

// Atomic write: .tmp → rename
const tmp = skelPath + '.tmp';
try {
  fs.mkdirSync(path.dirname(skelPath), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(skeleton, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, skelPath);
} catch (e) {
  process.stderr.write('module-derive: failed to write skeleton — ' + e.message + '\n');
  process.exit(2);
}

process.stdout.write('MODULES=' + modules.length + '\n');
process.stdout.write('STRUCTURE=' + structure + '\n');
process.stdout.write('SKELETON_PATH=.claude/graph/.module-skeleton.json\n');
process.exit(0);
