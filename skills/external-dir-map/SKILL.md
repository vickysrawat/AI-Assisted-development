# external-dir-map — External Directory Mapper
_Spec version: 1.0 · Last changed: 2026-06-10 · Used by: setup-init (Step 4d), sync-dirs · Consent: C_

Scans project manifest files to find references to projects or modules that live
outside the solution root, then writes their resolved absolute paths into
`.claude/settings.local.json` as `additionalDirectories`.

This gives Claude Code read and write access to those paths without requiring
developers to pass `--add-dir` flags manually each session.

---

## Persona
Acts with a **[DPE] DevOps/Platform Engineer** lens — idempotent, non-destructive path mapping;
always asks "is this safe to re-run and never removing a developer's paths?" Lens only; never assume,
never attribute in output. See `../shared/personas-spec.md`.

---

## When this skill runs

- Called by `setup-init` Step 4d after stack detection (DETECTED_STACKS is already set)
- Called by `/sync-dirs` at any time to re-sync after a manifest change
- Safe to re-run — fully idempotent

---

## Step 1 — Resolve the solution root

```bash
SOLUTION_ROOT=$(pwd)
echo "Solution root: $SOLUTION_ROOT"
```

All paths extracted from manifests are resolved to absolute paths and compared
against `SOLUTION_ROOT`. Only paths that resolve **outside** `SOLUTION_ROOT` are
added to `additionalDirectories`.

---

## Step 2 — Scan manifests per detected stack

Use `DETECTED_STACKS` from `setup-init` Step 4a if available. If running
standalone via `/sync-dirs`, re-detect stacks now using the same logic:

```bash
HAS_DOTNET=""
HAS_JAVA=""
HAS_ANGULAR=""
HAS_NODEJS=""
HAS_PYTHON=""

find . -name "*.sln" -maxdepth 3 2>/dev/null | head -1 | grep -q "." && HAS_DOTNET=1
find . -name "*.csproj" -maxdepth 4 2>/dev/null | head -1 | grep -q "." && HAS_DOTNET=1
ls angular.json 2>/dev/null && HAS_ANGULAR=1
find . -name "angular.json" -maxdepth 3 2>/dev/null | head -1 | grep -q "." && HAS_ANGULAR=1
node -e "
  try {
    const p = require('./package.json');
    const d = Object.assign({}, p.dependencies, p.devDependencies);
    if (!d['@angular/core']) console.log('HAS_NODEJS');
  } catch(e) {}
" 2>/dev/null && HAS_NODEJS=1
{ find . -name "pom.xml" -maxdepth 3 2>/dev/null | xargs grep -l "spring-boot" 2>/dev/null; \
  find . -name "build.gradle*" -maxdepth 3 2>/dev/null | xargs grep -l "org.springframework.boot" 2>/dev/null; } \
  | head -1 | grep -q "." && HAS_JAVA=1
find . \( -name "*.py" -o -name "requirements.txt" -o -name "pyproject.toml" \) -maxdepth 3 2>/dev/null \
  | head -1 | grep -q "." && HAS_PYTHON=1
```

---

## Step 3 — Extract external paths per stack

Write the Node.js scanner below to `.claude/_ext-dir-scan.cjs`, then run:
`node .claude/_ext-dir-scan.cjs`

Always use the `.cjs` extension — it forces CommonJS mode (`require`) regardless
of whether the target project has `"type":"module"` in its `package.json`. Never
execute this script inline with `node -e "..."`: backslash sequences in the regex
are mangled by the shell when passed through double-quoted strings.

```javascript
// Written to .claude/_ext-dir-scan.cjs and executed as: node .claude/_ext-dir-scan.cjs
const fs   = require('fs');
const path = require('path');
const root = process.cwd();

const external = new Set();
const manifestSnapshot = {};

function isExternal(absPath) {
  return !absPath.startsWith(root + path.sep) && absPath !== root;
}

function tryAdd(relPath, manifestFile) {
  if (!relPath || relPath.trim() === '') return;
  const abs = path.resolve(root, relPath.replace(/\\/g, '/'));
  // Resolve to directory (strip filename if it looks like a file path)
  const dir = path.extname(abs) ? path.dirname(abs) : abs;
  if (isExternal(dir)) {
    external.add(dir);
    console.log('EXTERNAL: ' + dir + '  (from ' + manifestFile + ')');
  }
}

// ── .NET ── *.sln files
const slnFiles = [];
function findFiles(dir, pattern, depth) {
  if (depth < 0) return;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.match(pattern)) slnFiles.push(full);
      else if (entry.isDirectory() && !entry.name.startsWith('.') && depth > 0)
        findFiles(full, pattern, depth - 1);
    }
  } catch(e) {}
}
findFiles(root, /\.sln$/, 3);
for (const sln of slnFiles) {
  const content = fs.readFileSync(sln, 'utf8');
  const mtime = fs.statSync(sln).mtimeMs;
  manifestSnapshot[path.relative(root, sln)] = { mtime };
  const matches = content.matchAll(/"([^"]+\.csproj)"/g);
  for (const m of matches) tryAdd(path.dirname(m[1]), sln);
}

// ── Java Maven ── pom.xml <module> tags
const pomFiles = [];
function findPoms(dir, depth) {
  if (depth < 0) return;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === 'pom.xml') pomFiles.push(full);
      else if (entry.isDirectory() && !entry.name.startsWith('.') && depth > 0)
        findPoms(full, depth - 1);
    }
  } catch(e) {}
}
findPoms(root, 3);
for (const pom of pomFiles) {
  const content = fs.readFileSync(pom, 'utf8');
  const mtime = fs.statSync(pom).mtimeMs;
  manifestSnapshot[path.relative(root, pom)] = { mtime };
  const matches = content.matchAll(/<module>([^<]+)<\/module>/g);
  for (const m of matches) tryAdd(m[1].trim(), pom);
}

// ── Java Gradle ── settings.gradle includeBuild(...)
const gradleFiles = [];
function findGradle(dir, depth) {
  if (depth < 0) return;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.match(/^settings\.gradle/)) gradleFiles.push(full);
      else if (entry.isDirectory() && !entry.name.startsWith('.') && depth > 0)
        findGradle(full, depth - 1);
    }
  } catch(e) {}
}
findGradle(root, 3);
for (const gradle of gradleFiles) {
  const content = fs.readFileSync(gradle, 'utf8');
  const mtime = fs.statSync(gradle).mtimeMs;
  manifestSnapshot[path.relative(root, gradle)] = { mtime };
  const matches = content.matchAll(/includeBuild\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of matches) tryAdd(m[1].trim(), gradle);
}

// ── Angular ── angular.json projects[*].root
const angularJson = path.join(root, 'angular.json');
if (fs.existsSync(angularJson)) {
  try {
    const data = JSON.parse(fs.readFileSync(angularJson, 'utf8'));
    manifestSnapshot['angular.json'] = { mtime: fs.statSync(angularJson).mtimeMs };
    for (const proj of Object.values(data.projects || {})) {
      if (proj && proj.root) tryAdd(proj.root, 'angular.json');
    }
  } catch(e) { console.error('WARN: Could not parse angular.json'); }
}

// ── Node.js ── package.json workspaces[]
const pkgJson = path.join(root, 'package.json');
if (fs.existsSync(pkgJson)) {
  try {
    const data = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
    manifestSnapshot['package.json'] = { mtime: fs.statSync(pkgJson).mtimeMs };
    const workspaces = Array.isArray(data.workspaces)
      ? data.workspaces
      : (data.workspaces && data.workspaces.packages) || [];
    for (const ws of workspaces) {
      // Resolve globs (basic support — expand * patterns one level deep)
      if (ws.includes('*')) {
        const base = path.resolve(root, ws.replace(/\/\*.*$/, ''));
        try {
          for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
            if (entry.isDirectory()) tryAdd(path.join(ws.replace(/\/\*.*$/, ''), entry.name), pkgJson);
          }
        } catch(e) {}
      } else {
        tryAdd(ws, pkgJson);
      }
    }
  } catch(e) { console.error('WARN: Could not parse package.json'); }
}

// ── Python ── pyproject.toml path = dependencies
const pyproject = path.join(root, 'pyproject.toml');
if (fs.existsSync(pyproject)) {
  const content = fs.readFileSync(pyproject, 'utf8');
  manifestSnapshot['pyproject.toml'] = { mtime: fs.statSync(pyproject).mtimeMs };
  const matches = content.matchAll(/path\s*=\s*['"]([^'"]+)['"]/g);
  for (const m of matches) tryAdd(m[1].trim(), 'pyproject.toml');
}

// ── Emit results as JSON for Step 4 to consume ──
const result = {
  externalPaths: [...external],
  manifestSnapshot
};
fs.writeFileSync('.claude/_ext-dir-scan.json', JSON.stringify(result, null, 2));
console.log('SCAN_DONE: ' + external.size + ' external path(s) found');
```

---

## Step 4 — Write to settings.local.json

Write the script below to `.claude/_ext-dir-merge.cjs`, then run:
`node .claude/_ext-dir-merge.cjs`

Read the scan output from `.claude/_ext-dir-scan.json`, then merge into
`.claude/settings.local.json` using the read / create / merge logic below.
Delete both temp files (`.json` and both `.cjs` scripts) when done.

```javascript
// Written to .claude/_ext-dir-merge.cjs and executed as: node .claude/_ext-dir-merge.cjs
const fs   = require('fs');
const path = require('path');

// Read scan results
const scan = JSON.parse(fs.readFileSync('.claude/_ext-dir-scan.json', 'utf8'));
const incoming = scan.externalPaths;
const manifestSnapshot = scan.manifestSnapshot;

const settingsPath    = '.claude/settings.local.json';
const statePath       = '.claude/dream-init-state.json';

// ── Read or initialise settings.local.json ──────────────────────────────────
let settings = {};
if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    console.log('settings.local.json found — merging');
  } catch(e) {
    // Invalid JSON — back up and start clean
    fs.copyFileSync(settingsPath, settingsPath + '.bak');
    console.warn('WARN: settings.local.json was invalid JSON — backed up to .bak, recreating');
    settings = {};
  }
} else {
  console.log('settings.local.json not found — will create it');
}

// ── Merge additionalDirectories (no duplicates, no removals) ────────────────
const existing = Array.isArray(settings.additionalDirectories)
  ? settings.additionalDirectories
  : [];

const merged = [...new Set([...existing, ...incoming])];

// ── Only write if something actually changed ─────────────────────────────────
const changed = merged.length !== existing.length ||
  merged.some((v, i) => v !== existing[i]);

if (!changed) {
  console.log('additionalDirectories already up to date — nothing to write');
} else {
  settings.additionalDirectories = merged;
  fs.mkdirSync('.claude', { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  const added = merged.filter(p => !existing.includes(p));
  console.log('✓ settings.local.json updated');
  console.log('  Added  : ' + (added.length  ? added.join('\n           ') : 'none'));
  console.log('  Total  : ' + merged.length + ' director(ies) mapped');
}

// ── Save manifest snapshot to dream-init-state.json ─────────────────────────
let state = {};
if (fs.existsSync(statePath)) {
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch(e) {}
}
state.external_dir_snapshot = manifestSnapshot;
state.external_dir_last_sync = new Date().toISOString().slice(0, 10);
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
console.log('✓ dream-init-state.json updated with manifest snapshot');

// ── Clean up temp files ──────────────────────────────────────────────────────
fs.unlinkSync('.claude/_ext-dir-scan.json');
try { fs.unlinkSync('.claude/_ext-dir-scan.cjs'); } catch(e) {}
try { fs.unlinkSync('.claude/_ext-dir-merge.cjs'); } catch(e) {}
```

---

## Step 5 — Print summary

```
📁 External directory map
   Manifests scanned : {list of manifest files found}
   External paths    : {N}
   {each path on its own line, prefixed with →}
   Written to        : .claude/settings.local.json
   Snapshot saved to : .claude/dream-init-state.json

   {If no external paths found:}
   ✓ All referenced projects are within the solution root — no additionalDirectories needed.
```

---

## Behaviour matrix

| Condition | Result |
|---|---|
| `settings.local.json` does not exist | Created with `additionalDirectories` containing scanned paths |
| File exists, key absent | Key added; all other existing keys preserved |
| File exists, key present, paths already listed | No write — exits with "already up to date" |
| File exists, key present, new paths found | New paths appended; existing paths untouched |
| File exists but invalid JSON | Backed up to `.bak`; recreated cleanly |
| No external paths found in any manifest | `additionalDirectories` left empty or unchanged; no write if nothing to add |

---

## Hard rules

- NEVER remove a path already in `additionalDirectories` — only append
- NEVER overwrite other keys in `settings.local.json` (e.g. `env`, `hooks`)
- NEVER commit `settings.local.json` — it is machine-specific and auto-gitignored by Claude Code
- ALWAYS resolve paths to absolute before writing
- ALWAYS clean up `.claude/_ext-dir-scan.json`, `_ext-dir-scan.cjs`, and `_ext-dir-merge.cjs` after Step 4
- ALWAYS write scripts to `.cjs` files — NEVER use `node -e "..."` (shell escaping breaks backslash regexes)

---

## Reference files

| File | Purpose |
|---|---|
| `../shared/source-file-consent.md` | Consent category C — this skill never reads source files |
| `../shared/business-context-severity.md` | Not applicable — this skill produces no security findings. Referenced to satisfy validator enforcement. |
