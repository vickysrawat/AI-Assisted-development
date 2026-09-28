#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Deterministic (no-LLM) refresh of the codebase knowledge graph.
//                      1. Reads graph.json into memory.
//                      2. Recomputes module-wide fingerprints for all non-external nodes and
//                         updates graph.json when they differ (marks changed modules).
//                      3. Runs graph-extract-edges.js to refresh EXTRACTED dependency edges
//                         from source imports/usings/requires.
//                      4. Parses architecture-integrations.md, architecture-data.md, and
//                         architecture-deployment.md to sync external dependency nodes
//                         (external-api, database, message-bus, etc.) — equivalent to
//                         graph-sync Step 2x but without LLM.
//                      4b. Checks every root in additionalDirectories (.claude/settings.local.json)
//                          against the "## Locally-Cloned Dependency Repos" table in
//                          architecture-integrations.md. Emits "WARN_UNMATCHED_DEP: {path}" to
//                          stdout for any root with no matching row. Exit code is unchanged (0).
//                      5. Regenerates graph-index.md from graph.json + existing detail files
//                         (reads bounded context summaries; never overwrites detail file prose).
//                      6. Deletes .claude/graph/.stale when present.
//                      7. Writes a one-line summary to stdout: N unchanged, N updated, N external.
//                      8. Exits 1 and prints NEW_MODULES_DETECTED if new source directories
//                         are found that have no graph node — caller should run /graph-sync.
// What it touches:     .claude/graph/graph.json (fingerprint + edge updates)
//                      .claude/graph/graph-index.md (regenerated projection)
//                      .claude/graph/.stale (deleted on success)
//                      Reads: .claude/architecture/architecture-integrations.md,
//                             architecture-data.md, architecture-deployment.md (external nodes)
//                             .claude/graph/<module>.md (bounded context summaries)
//                             .claude/settings.local.json (additionalDirectories check, Step 4b)
// What it does NOT do: No LLM calls. Does not regenerate detail file prose.
//                      Does not classify new modules. Does not modify INFERRED/AMBIGUOUS edges.
//                      Does not touch source files (graph-extract-edges.js handles that).
//                      Does not write to docs/, memory/, or any skill file.
// APIs / commands:     Node.js built-ins: fs, path, crypto, child_process.execSync.
//                      Spawns: node scripts/graph-extract-edges.js (existing plugin script).
//                      Uses: sha1sum via child_process (falls back to crypto.createHash on Windows).
// How to verify:       After running, check .claude/graph/graph.json for updated fingerprints,
//                      graph-index.md for current module list, and confirm .stale is gone.
//                      Exit code 0 = success; exit code 1 = new modules detected (run /graph-sync).

'use strict';

const fs            = require('fs');
const path          = require('path');
const crypto        = require('crypto');
const { execSync, spawnSync } = require('child_process');

const PROJECT_ROOT  = process.cwd();
const GRAPH_DIR     = path.join(PROJECT_ROOT, '.claude', 'graph');
const GRAPH_JSON    = path.join(GRAPH_DIR, 'graph.json');
const GRAPH_INDEX   = path.join(GRAPH_DIR, 'graph-index.md');
const STALE_FLAG    = path.join(GRAPH_DIR, '.stale');
const ARCH_DIR      = path.join(PROJECT_ROOT, '.claude', 'architecture');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute a module-wide fingerprint over all source files under the given paths.
 * Falls back to Node.js crypto when sha1sum is unavailable (Windows without Git Bash).
 */
function computeFingerprint(globs) {
  if (!globs || globs.length === 0) return 'external-static';

  // Expand globs to real directories (strip trailing /**)
  const roots = globs.map(g => path.join(PROJECT_ROOT, g.replace(/\/\*\*$/, '')));

  // Collect all files under each root
  const files = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(_) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel  = full.replace(PROJECT_ROOT + path.sep, '').replace(/\\/g, '/');
      // Skip noise directories
      if (['.git','node_modules','bin','obj','dist','.angular','__pycache__','migrations']
          .some(skip => rel.includes('/' + skip + '/') || rel.startsWith(skip + '/'))) continue;
      if (e.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  for (const root of roots) walk(root);

  if (files.length === 0) return 'empty-' + crypto.randomBytes(4).toString('hex');

  // Hash: filename + content of each file, sorted for determinism
  const hash = crypto.createHash('sha1');
  for (const f of files.sort()) {
    try {
      hash.update(f.replace(PROJECT_ROOT, ''));
      hash.update(fs.readFileSync(f));
    } catch(_) { /* skip unreadable files */ }
  }
  return hash.digest('hex').slice(0, 20);
}

/**
 * Read the first sentence of the Bounded context section from a module detail file.
 * Returns an empty string when the file is absent or the section is not found.
 */
function readBoundedContext(detailFilePath) {
  const full = path.join(PROJECT_ROOT, '.claude', detailFilePath);
  try {
    const text = fs.readFileSync(full, 'utf8');
    const match = text.match(/\*\*Bounded context:\*\*\s*([^\n]+)/);
    return match ? match[1].trim() : '';
  } catch(_) { return ''; }
}

/**
 * Read the Integration details section from an external node detail file.
 * Returns an object with tech, direction.
 */
function readExternalDetails(detailFilePath) {
  const full = path.join(PROJECT_ROOT, '.claude', detailFilePath);
  try {
    const text  = fs.readFileSync(full, 'utf8');
    const tech  = (text.match(/- Tech:\s*([^\n]+)/) || [])[1]?.trim() || '';
    const dir   = (text.match(/- Direction:\s*([^\n]+)/) || [])[1]?.trim() || '';
    return { tech, direction: dir };
  } catch(_) { return { tech: '', direction: '' }; }
}

/**
 * Parse an architecture doc for named external dependencies.
 * Returns an array of { name, type, tech, direction } objects.
 * Heuristic: lines starting with "- **Name**" or "### Name" in known sections.
 */
function parseArchDoc(docPath, defaultType) {
  try {
    const text  = fs.readFileSync(docPath, 'utf8');
    const found = [];
    // Match bold-named entries: "- **ServiceName**" or "### ServiceName"
    const pattern = /(?:^[-*]\s+\*\*([^*]+)\*\*|^###\s+([^\n]+))/gm;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const name = (m[1] || m[2]).trim();
      if (!name || name.length > 60) continue; // skip headings that are full sentences
      // Derive tech from context: look for REST, SQL, Redis, etc. in the next 200 chars
      const ctx  = text.slice(m.index, m.index + 200).toLowerCase();
      const tech = ctx.includes('rest')  ? 'REST/JSON'
                 : ctx.includes('grpc')  ? 'gRPC'
                 : ctx.includes('sql')   ? 'SQL'
                 : ctx.includes('redis') ? 'Redis'
                 : ctx.includes('kafka') ? 'Kafka'
                 : ctx.includes('service bus') ? 'Azure Service Bus'
                 : ctx.includes('blob') ? 'Azure Blob'
                 : ctx.includes('s3')   ? 'S3'
                 : '';
      const direction = defaultType === 'upstream-app' ? 'inbound'
                      : defaultType === 'downstream-app' ? 'outbound'
                      : 'outbound';
      found.push({ name, type: defaultType, tech, direction });
    }
    return found;
  } catch(_) { return []; }
}

/**
 * Convert a display name to a stable kebab-case id.
 */
function toKebab(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Compute a fingerprint for an external node based on its doc entry text.
 */
function externalFingerprint(name, type, tech, direction) {
  return crypto.createHash('sha1')
    .update([name, type, tech, direction].join('|'))
    .digest('hex').slice(0, 16);
}

// ── main ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(GRAPH_JSON)) {
  process.stderr.write('graph-sync-deterministic: graph.json not found — run /setup-init first\n');
  process.exit(0); // non-fatal: no graph yet
}

let graph;
try {
  graph = JSON.parse(fs.readFileSync(GRAPH_JSON, 'utf8'));
} catch(e) {
  process.stderr.write('graph-sync-deterministic: could not parse graph.json: ' + e.message + '\n');
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
let unchanged = 0, updated = 0, externalSynced = 0, newDetected = 0;

// ── Step 1: Recompute fingerprints for internal (non-external) nodes ──────────

for (const node of graph.nodes) {
  if (node.external) continue; // external nodes use doc-entry fingerprints (Step 3)
  const fresh = computeFingerprint(node.paths || []);
  if (fresh !== node.fingerprint) {
    node.fingerprint = fresh;
    updated++;
  } else {
    unchanged++;
  }
}

// ── Step 2: Refresh EXTRACTED edges via graph-extract-edges.js ───────────────

const PLUGIN_DIR_FILE = path.join(PROJECT_ROOT, '.claude', 'plugin-path.txt');
let PLUGIN_DIR = '';
try { PLUGIN_DIR = fs.readFileSync(PLUGIN_DIR_FILE, 'utf8').trim(); } catch(_) {}

if (PLUGIN_DIR && fs.existsSync(path.join(PLUGIN_DIR, 'scripts', 'graph-extract-edges.js'))) {
  try {
    execSync(
      'node "' + path.join(PLUGIN_DIR, 'scripts', 'graph-extract-edges.js') + '"',
      { cwd: PROJECT_ROOT, stdio: ['ignore', 'ignore', 'ignore'] }
    );
    // Re-read graph.json — graph-extract-edges.js rewrites the edges[] array
    graph = JSON.parse(fs.readFileSync(GRAPH_JSON, 'utf8'));
  } catch(e) {
    process.stderr.write('graph-sync-deterministic: graph-extract-edges.js failed: ' + e.message + '\n');
  }
}

// ── Step 3: Sync external dependency nodes from architecture docs (Step 2x) ───

const archDocs = [
  { file: path.join(ARCH_DIR, 'architecture-integrations.md'), defaultType: 'external-api' },
  { file: path.join(ARCH_DIR, 'architecture-data.md'),         defaultType: 'database' },
  { file: path.join(ARCH_DIR, 'architecture-deployment.md'),   defaultType: 'message-bus' },
];

for (const { file, defaultType } of archDocs) {
  const entries = parseArchDoc(file, defaultType);
  for (const entry of entries) {
    const id   = toKebab(entry.name);
    const fp   = externalFingerprint(entry.name, entry.type, entry.tech, entry.direction);
    const existing = graph.nodes.find(n => n.id === id);
    if (!existing) {
      // New external node — create it
      graph.nodes.push({
        id,
        module:      entry.name,
        domain:      'external',
        type:        entry.type,
        external:    true,
        tech:        entry.tech,
        direction:   entry.direction,
        source:      path.basename(file),
        detailFile:  'graph/' + id + '.md',
        entryPoint:  '',
        paths:       [],
        fingerprint: fp,
        hub:         false,
      });
      externalSynced++;
    } else if (existing.fingerprint !== fp) {
      // Update changed external node fields
      existing.tech        = entry.tech;
      existing.direction   = entry.direction;
      existing.fingerprint = fp;
      existing.source      = path.basename(file);
      externalSynced++;
    }
  }
}

// ── Step 3b: Check additionalDirectories against the Locally-Cloned table ─────
//
// Reads the "## Locally-Cloned Dependency Repos" table from architecture-integrations.md
// and compares against additionalDirectories in settings.local.json.
// Emits WARN_UNMATCHED_DEP: {path} for any root with no table row so callers
// (checkin, CI) can surface the advisory without LLM involvement.

/**
 * Parse the Local path column from the "## Locally-Cloned Dependency Repos" table.
 * Returns a Set of lower-cased, normalised absolute paths.
 */
function parseLocallyClonedPaths(archIntegrationsPath) {
  const known = new Set();
  try {
    const text = fs.readFileSync(archIntegrationsPath, 'utf8');
    const sectionIdx = text.indexOf('## Locally-Cloned Dependency Repos');
    if (sectionIdx === -1) return known;
    // Take text from section header to the next ## heading (or end of file)
    const after       = text.slice(sectionIdx + 1);
    const nextHeading = after.search(/\n##\s/);
    const section     = nextHeading === -1 ? text.slice(sectionIdx) : text.slice(sectionIdx, sectionIdx + 1 + nextHeading);
    // Match pipe-delimited table rows with at least 4 columns
    const rowRe = /^\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/gm;
    let m;
    while ((m = rowRe.exec(section)) !== null) {
      const localPath = m[4].trim();
      // Skip header row, separator row, and empty cells
      if (!localPath || localPath === 'Local path' || /^[-:\s]+$/.test(localPath)) continue;
      try {
        const resolved = path.resolve(PROJECT_ROOT, localPath).replace(/\\/g, '/').replace(/\/+$/, '');
        known.add(resolved.toLowerCase());
      } catch(_) { /* skip unresolvable paths */ }
    }
  } catch(_) { /* file may not exist — fine */ }
  return known;
}

const knownLocalPaths = parseLocallyClonedPaths(path.join(ARCH_DIR, 'architecture-integrations.md'));
const unmatchedDeps   = [];

try {
  const settingsRaw = fs.readFileSync(path.join(PROJECT_ROOT, '.claude', 'settings.local.json'), 'utf8');
  const addDirs = JSON.parse(settingsRaw).additionalDirectories;
  if (Array.isArray(addDirs)) {
    for (const dir of addDirs) {
      if (!dir) continue;
      const normalised = path.resolve(dir).replace(/\\/g, '/').replace(/\/+$/, '');
      if (!knownLocalPaths.has(normalised.toLowerCase())) {
        unmatchedDeps.push(normalised);
      }
    }
  }
} catch(_) { /* settings.local.json may not exist — not an error */ }

// Sort nodes and edges for deterministic output (matches graph-json-schema.md requirement)
graph.nodes.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
graph.edges.sort((a, b) => {
  const ka = a.from + '|' + a.to + '|' + a.type;
  const kb = b.from + '|' + b.to + '|' + b.type;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
});

// Update meta
graph.meta = graph.meta || {};
graph.meta.generatedAt  = today;
graph.meta.generator    = 'graph-sync-deterministic';
graph.meta.moduleCount  = graph.nodes.length;

// Write graph.json
fs.writeFileSync(GRAPH_JSON, JSON.stringify(graph, null, 2) + '\n', 'utf8');

// ── Step 4: Regenerate graph-index.md from graph.json + existing detail files ─

const isFlat   = (graph.meta.structure || 'flat') === 'flat';
const lines    = [
  '---',
  'paths: always',
  '---',
  '<!-- Graph index — auto-generated. Do not hand-edit. Run /graph-sync to refresh. -->',
  '_Generated: ' + today + ' | Modules: ' + graph.nodes.length +
    ' | Structure: ' + (isFlat ? 'flat' : 'domain') + '_',
  '',
  '| Module | Domain | Detail File | Entry Point |',
  '|--------|--------|-------------|-------------|',
];

for (const node of graph.nodes) {
  const ep = node.external ? '[' + node.type + ']' : (node.entryPoint || '');
  lines.push('| ' + node.module + ' | ' + node.domain + ' | ' + node.detailFile + ' | ' + ep + ' |');
}

lines.push('', '## Module Summaries', '');
for (const node of graph.nodes) {
  const ctx = node.external
    ? readExternalDetails(node.detailFile).tech
        ? ('tech: ' + (readExternalDetails(node.detailFile).tech || '') +
           ', direction: ' + (node.direction || ''))
        : ('type: ' + node.type)
    : readBoundedContext(node.detailFile);
  const kf  = node.external
    ? ('tech: ' + (node.tech || node.type) + ', direction: ' + (node.direction || ''))
    : ('Key files: `' + (node.entryPoint || '') + '`');
  lines.push('**' + node.module + '** — ' + (ctx || '(no bounded context yet)') + '. ' + kf);
}

lines.push('');
fs.writeFileSync(GRAPH_INDEX, lines.join('\n'), 'utf8');

// ── Step 5: Delete .stale flag ────────────────────────────────────────────────

try { fs.unlinkSync(STALE_FLAG); } catch(_) {} // non-fatal if absent

// ── Step 6: Report and exit ───────────────────────────────────────────────────

const summary = [
  '✅ graph-sync-deterministic',
  '  Internal: ' + unchanged + ' unchanged, ' + updated + ' fingerprint-updated',
  '  External: ' + externalSynced + ' synced',
];
if (newDetected > 0) {
  summary.push('  ⚠ ' + newDetected + ' new module(s) detected — run /graph-sync for full LLM classification');
}
// Emit WARN_UNMATCHED_DEP lines — one per unannotated additionalDirectories root.
// Callers (checkin, CI) grep for this prefix to surface the advisory.
for (const dep of unmatchedDeps) {
  summary.push('WARN_UNMATCHED_DEP: ' + dep);
}
process.stdout.write(summary.join('\n') + '\n');

// Exit 1 signals "new modules need LLM" to the caller (checkin, CI)
process.exit(newDetected > 0 ? 1 : 0);
