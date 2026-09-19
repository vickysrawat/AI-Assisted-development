#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Migration-owned, stack-neutral SOURCE detection. For each --roots entry it
//                      wraps `repo-detect.cjs --json` (the stack/version engine) and consolidates
//                      the migration-specific source signals (data layer, auth, external-integration
//                      ground truth, size, graph/arch presence) into ONE normalized source
//                      descriptor. Read-only; prints the descriptor (JSON with --json, else a human
//                      summary). Multi-root: merges the current repo and additionalDirectories.
// What it touches:     Reads only, under each root: project/source files, *.config (Web/app.config),
//                      package.json/pom.xml, and optionally <root>/.claude/{graph/graph.json,
//                      architecture/architecture.md} as a fast-path presence check. Invokes
//                      repo-detect.cjs (itself read-only in --json mode). Writes NOTHING.
// What it does NOT do: No network. No LLM. Never writes to the source (no dream-init-state, no state
//                      file). Does not write the migration checkpoint — Stage 0 does that from this
//                      descriptor.
// APIs / commands:     Node stdlib only: fs, path, child_process (execFileSync -> node repo-detect.cjs).
// How to verify:       node scripts/migration-source-detect.cjs --roots=<path>[,<path>] --json
//                      -> prints {roots, primary, stacks, dataLayer, auth, integrations,
//                        sizeEstimate, graphPresent, archDocsPresent}. Exit 0 = >=1 stack detected;
//                        exit 3 = no stack detected in any root.

'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PRUNE = new Set(['.git', 'node_modules', 'bin', 'obj', 'dist', 'out', '.angular', 'coverage', '.cache', 'tmp']);
const SRC_EXTS = ['.cs', '.java', '.ts', '.tsx', '.js', '.jsx', '.py'];
const MAX_DEPTH = 6;
const MAX_CONTENT_READS = 5000;   // cap content scans so a huge source tree stays tractable
const MAX_FILE_BYTES = 512 * 1024;
const ROOT_SIGNAL_FILES = ['package.json', 'pom.xml', 'requirements.txt', 'pyproject.toml', 'angular.json', 'nx.json', 'Web.config', 'app.config', 'packages.config'];

// Token vocabulary matches ledger source.stack. `primary` picks the most SPECIFIC stack:
// backend languages first, then frontend frameworks, then generic nodejs last (a repo detected as
// angular/react also carries 'nodejs' — the framework, not the runtime, is the representative stack).
const TOKEN_PRIORITY = ['dotnet_framework', 'dotnet', 'java', 'python', 'angular', 'react', 'nodejs'];
const AUTH_RE = /WebSecurityConfigurerAdapter|SecurityFilterChain|AddAuthentication|passport|jsonwebtoken/;

// ── Args ──────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const jsonOut = argv.includes('--json');
  const rootsArg = argv.find(a => a.startsWith('--roots='))?.slice(8) ?? '.';
  const roots = rootsArg.split(',').map(r => r.trim()).filter(Boolean);
  return { jsonOut, roots };
}

// ── Read-only helpers (bounded walk; prune build/vendor dirs) ──────────────────
function walk(root, onFile) {
  function rec(dir, depth) {
    if (depth > MAX_DEPTH) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      if (e.isDirectory()) {
        if (!PRUNE.has(e.name)) rec(path.join(dir, e.name), depth + 1);
      } else {
        onFile(path.join(dir, e.name), e.name);
      }
    }
  }
  rec(root, 0);
}

function existsUnder(root, rel) {
  try { return fs.statSync(path.join(root, rel)).isFile(); } catch (_) { return false; }
}

function readText(file) {
  try {
    if (fs.statSync(file).size > MAX_FILE_BYTES) return '';
    return fs.readFileSync(file, 'utf8');
  } catch (_) { return ''; }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return null; }
}

function normalizeSlashes(p) {
  return String(p || '').replace(/\\/g, '/');
}

function isWithin(base, candidate) {
  const rel = path.relative(path.resolve(base), path.resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function globBase(glob) {
  const rel = normalizeSlashes(glob).replace(/^\.\//, '');
  const i = rel.search(/[*?]/);
  return (i < 0 ? rel : rel.slice(0, i)).replace(/\/+$/, '');
}

function uniqueScanRoots(roots) {
  const sorted = [...new Set(roots.map(r => path.resolve(r)))].sort((a, b) => a.length - b.length);
  const kept = [];
  for (const root of sorted) {
    if (!kept.some(existing => isWithin(existing, root))) kept.push(root);
  }
  return kept;
}

// ── Engine wrapper: borrow repo-detect for stack/version, own the interface ─────
// DECISION: how migration gets the source stack/version
//   A) re-implement stack detection here — rejected: duplicates the mature ADR-0059 engine, drifts.
//   B) read the source's dream-init-state.json only — rejected: requires the source to be a
//      plugin-managed brownfield repo; fails for a foreign source.
//   C) wrap repo-detect.cjs --json per root — chosen: engine borrowed, interface owned; works on any
//      repo, stays in sync with engine fixes. (A full fork is deferred to the standalone plan.)
function detectStack(root) {
  const script = path.join(__dirname, 'repo-detect.cjs');
  try {
    const out = execFileSync(process.execPath, [script, `--root=${root}`, '--json'], { encoding: 'utf8' });
    return JSON.parse(out);
  } catch (err) {
    // exit 3 (UNKNOWN) still prints JSON on stdout; recover it if present.
    const stdout = err?.stdout ? String(err.stdout) : '';
    try { return JSON.parse(stdout); }
    catch (_) { return { repo_type: null, detected_stacks: [], generations: {}, meta: {} }; }
  }
}

function tokensFromDetect(d) {
  const known = new Set(TOKEN_PRIORITY);
  return (d.detected_stacks ?? []).filter(t => known.has(t));
}

// Flatten detected tokens + generations{lang:{version, versions:[{path,role,tfm,generation}]}}
// into stacks[] rows. .NET carries per-project versions[]; others get a single versioned row.
function buildStacks(tokens, generations) {
  const gens = generations ?? {};
  const rows = [];
  for (const token of tokens) {
    if (token === 'dotnet' || token === 'dotnet_framework') {
      const g = gens.dotnet ?? {};
      const versions = Array.isArray(g.versions) ? g.versions : [];
      if (versions.length) {
        for (const v of versions) {
          rows.push({ token, role: v.role ?? null, version: v.tfm ?? g.version ?? null, generation: v.generation ?? g.name ?? null, projectPath: v.path ?? null });
        }
        continue;
      }
      rows.push({ token, role: null, version: g.version ?? null, generation: g.name ?? null, projectPath: null });
      continue;
    }
    // angular / react / nodejs all map to the node generation; java/python to their own.
    const langKey = token === 'java' ? 'java' : token === 'python' ? 'python' : 'node';
    const g = gens[langKey] ?? {};
    rows.push({ token, role: null, version: g.version ?? null, generation: g.name ?? null, projectPath: null });
  }
  return rows;
}

function collectRootSignalFiles(root) {
  const files = [];
  for (const rel of ROOT_SIGNAL_FILES) {
    const full = path.join(root, rel);
    try { if (fs.statSync(full).isFile()) files.push(full); } catch (_) {}
  }
  try {
    for (const name of fs.readdirSync(root)) {
      if (name.toLowerCase().endsWith('.config')) {
        const full = path.join(root, name);
        try { if (fs.statSync(full).isFile()) files.push(full); } catch (_) {}
      }
    }
  } catch (_) {}
  return [...new Set(files.map(f => path.resolve(f)))];
}

function processSignalFile(full, name, state) {
  const ext = path.extname(name).toLowerCase();
  const lower = name.toLowerCase();
  if (SRC_EXTS.includes(ext)) state.srcCount++;

  if (lower.endsWith('.edmx')) state.dataHits.add('EF6 (EDMX)');
  if (lower.endsWith('dbcontext.cs')) state.dataHits.add('EF (DbContext)');
  if (name === 'pom.xml' && /spring-data|jpa|hibernate/i.test(readText(full))) state.dataHits.add('JPA/Hibernate');
  if (name === 'package.json' && /typeorm|sequelize|prisma/i.test(readText(full))) state.dataHits.add('Node ORM (TypeORM/Sequelize/Prisma)');
  if (name === 'Web.config' || name === 'app.config' || ext === '.config') state.configFiles.push(full);

  // Auth + Dapper need content; cap total reads so a large tree stays tractable.
  if ((ext === '.cs' || ext === '.java' || ext === '.ts' || ext === '.js') && state.contentReads < MAX_CONTENT_READS) {
    const t = readText(full);
    if (!t) return;
    state.contentReads++;
    if (AUTH_RE.test(t)) {
      if (/passport|jsonwebtoken/.test(t)) state.authHits.add('passport / JWT (Node)');
      if (/AddAuthentication/.test(t)) state.authHits.add('ASP.NET AddAuthentication');
      if (/WebSecurityConfigurerAdapter|SecurityFilterChain/.test(t)) state.authHits.add('Spring Security');
    }
    if (ext === '.cs' && /\bDapper\b|IDbConnection|\.Query<|\.Execute\(/.test(t)) state.dataHits.add('Dapper');
  }
}

function scanPaths(roots, extraFiles) {
  const configFiles = [];
  const authHits = new Set();
  const dataHits = new Set();
  let srcCount = 0;
  let contentReads = 0;
  const seenFiles = new Set();
  const state = { configFiles, authHits, dataHits, get srcCount() { return srcCount; }, set srcCount(v) { srcCount = v; }, get contentReads() { return contentReads; }, set contentReads(v) { contentReads = v; } };

  function handleFile(full) {
    const resolved = path.resolve(full);
    if (seenFiles.has(resolved)) return;
    seenFiles.add(resolved);
    processSignalFile(resolved, path.basename(resolved), state);
  }

  for (const root of uniqueScanRoots(roots)) {
    let st;
    try { st = fs.statSync(root); } catch (_) { continue; }
    if (st.isFile()) handleFile(root);
    else if (st.isDirectory()) walk(root, handleFile);
  }
  for (const file of extraFiles || []) {
    let st;
    try { st = fs.statSync(file); } catch (_) { continue; }
    if (st.isFile()) handleFile(file);
  }

  return { configFiles, authHits: [...authHits], dataHits: [...dataHits], srcCount };
}

// ── Migration-specific signals: one bounded walk per root gathers everything ────
function scanRoot(root) {
  return scanPaths([root], []);
}

function readStoredBuildfileFingerprint(root) {
  const state = readJson(path.join(root, '.claude', 'dream-init-state.json'));
  return state?.generations_meta?.buildfile_fingerprint || '';
}

function graphScanContext(root, detectMeta) {
  const graphPath = path.join(root, '.claude', 'graph', 'graph.json');
  if (!existsUnder(root, '.claude/graph/graph.json')) return null;
  if (existsUnder(root, '.claude/graph/.stale')) return null;
  const graph = readJson(graphPath);
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return null;

  const storedFingerprint = readStoredBuildfileFingerprint(root);
  const currentFingerprint = detectMeta?.buildfile_fingerprint || '';
  if (storedFingerprint && currentFingerprint && storedFingerprint !== currentFingerprint) return null;

  const rootAbs = path.resolve(root);
  const localRoots = [];
  for (const node of graph.nodes) {
    const sourceRoot = node?.sourceRoot ? path.resolve(node.sourceRoot) : rootAbs;
    if (!isWithin(rootAbs, sourceRoot)) continue; // dependency-repo nodes belong to other roots
    if (!Array.isArray(node?.paths) || node.paths.length === 0) return null;
    for (const ownedPath of node.paths) {
      if (typeof ownedPath !== 'string' || !ownedPath.trim()) return null;
      const base = globBase(ownedPath);
      const candidate = path.resolve(sourceRoot, base || '.');
      if (!isWithin(rootAbs, candidate)) return null;
      localRoots.push(candidate);
    }
  }
  if (localRoots.length === 0) return null;
  return {
    scanRoots: uniqueScanRoots(localRoots),
    extraFiles: collectRootSignalFiles(rootAbs),
  };
}

function scanRootWithGraphFastPath(root, detectMeta, tokens) {
  const graph = graphScanContext(root, detectMeta);
  if (!graph) return { mode: 'fallback', scan: scanRoot(root) };
  const scan = scanPaths(graph.scanRoots, graph.extraFiles);
  if ((tokens || []).length > 0 && scan.srcCount === 0) return { mode: 'fallback', scan: scanRoot(root) };
  return { mode: 'graph', scan };
}

// External-integration GROUND TRUTH (preserves the integration-verification hardening extraction):
// for .NET sources, read the host config directly rather than inferring from consumer code.
function extractIntegrations(configFiles) {
  const rows = [];
  for (const f of configFiles) {
    const t = readText(f);
    if (!t) continue;
    const base = path.basename(f);
    const endpoints = (t.match(/<endpoint\b[^>]*address=/gi) ?? []).length;
    if (/<client>/i.test(t) && endpoints > 0) {
      const sec = /security\s+mode=/i.test(t) ? '; security mode present' : '';
      rows.push({ kind: 'WCF-client', evidence: `config:${base}`, detail: `${endpoints} endpoint(s)${sec}` });
    }
    const conns = (t.match(/<add\s+name=[^>]*connectionString=/gi) ?? []).length;
    if (conns > 0) rows.push({ kind: 'direct-DB', evidence: `config:${base}`, detail: `${conns} connection string(s)` });
  }
  return rows;
}

function describeRoot(root) {
  const d = detectStack(root);
  const tokens = tokensFromDetect(d);
  const graphAware = scanRootWithGraphFastPath(root, d.meta, tokens);
  const scan = graphAware.scan;
  return {
    root,
    tokens,
    stacks: buildStacks(tokens, d.generations),
    dataLayer: scan.dataHits,
    auth: scan.authHits,
    integrations: extractIntegrations(scan.configFiles),
    sizeFiles: scan.srcCount,
    graphPresent: existsUnder(root, '.claude/graph/graph.json'),
    archDocsPresent: existsUnder(root, '.claude/architecture/architecture.md'),
  };
}

function createDescriptor(roots) {
  const perRoot = roots.map(describeRoot);

  const allStacks = [];
  const seen = new Set();
  for (const r of perRoot) {
    for (const s of r.stacks) {
      const key = `${s.token}|${s.projectPath ?? ''}`;
      if (!seen.has(key)) { seen.add(key); allStacks.push(s); }
    }
  }
  const allTokens = [...new Set(perRoot.flatMap(r => r.tokens))];
  const primaryToken = TOKEN_PRIORITY.find(t => allTokens.includes(t)) ?? null;
  const primaryVersion = allStacks.find(s => s.token === primaryToken && s.version)?.version ?? null;

  return {
    roots,
    primary: { token: primaryToken, version: primaryVersion },
    stacks: allStacks,
    dataLayer: [...new Set(perRoot.flatMap(r => r.dataLayer))],
    auth: [...new Set(perRoot.flatMap(r => r.auth))],
    integrations: perRoot.flatMap(r => r.integrations),
    sizeEstimate: { files: perRoot.reduce((n, r) => n + r.sizeFiles, 0) },
    graphPresent: perRoot.some(r => r.graphPresent),
    archDocsPresent: perRoot.some(r => r.archDocsPresent),
  };
}

function renderDescriptor(descriptor, jsonOut) {
  if (jsonOut) {
    process.stdout.write(JSON.stringify(descriptor, null, 2) + '\n');
  } else {
    const stacksLine = descriptor.stacks.map(s => s.token + (s.version ? `@${s.version}` : '')).join(' · ') || 'none';
    const lines = [
      `Source roots   : ${descriptor.roots.join(', ')}`,
      `Primary        : ${descriptor.primary.token ?? 'unknown'}${descriptor.primary.version ? ' ' + descriptor.primary.version : ''}`,
      `Stacks         : ${stacksLine}`,
      `Data layer     : ${descriptor.dataLayer.join(', ') || 'none detected'}`,
      `Auth           : ${descriptor.auth.join(', ') || 'not detected'}`,
      `Integrations   : ${descriptor.integrations.length ? descriptor.integrations.map(i => `${i.kind} (${i.evidence})`).join(', ') : 'none detected'}`,
      `Source files   : ${descriptor.sizeEstimate.files}`,
      `Knowledge graph: ${descriptor.graphPresent ? 'available' : 'not available'}`,
      `Arch docs      : ${descriptor.archDocsPresent ? 'available' : 'not available'}`,
    ];
    process.stdout.write(lines.join('\n') + '\n');
  }
  return descriptor.primary.token ? 0 : 3;
}

function main(argv) {
  const { jsonOut, roots } = parseArgs(argv);
  const descriptor = createDescriptor(roots);
  return renderDescriptor(descriptor, jsonOut);
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = {
  buildStacks,
  createDescriptor,
  detectStack,
  graphScanContext,
  main,
  parseArgs,
  scanPaths,
  scanRoot,
  scanRootWithGraphFastPath,
  tokensFromDetect,
};
