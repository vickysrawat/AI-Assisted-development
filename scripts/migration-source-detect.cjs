#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Migration-owned, stack-neutral SOURCE detection. For each --roots entry it
//                      wraps `repo-detect.cjs --json` (the stack/version engine) and consolidates
//                      the migration-specific source signals (data layer, auth, external-integration
//                      ground truth, size, graph/arch presence) into ONE normalized source
//                      descriptor. Read-only; prints the descriptor (JSON with --json, else a human
//                      summary). Multi-root: merges the current repo and additionalDirectories.
// What it touches:     Reads only, under each root: project/source files, nested manifest/config
//                      signals (including package.json/pom.xml and *.config), and optionally
//                      <root>/.claude/{graph/graph.json,architecture/architecture.md,dream-init-state.json}
//                      as a conservative fast-path optimization. Invokes repo-detect.cjs (itself
//                      read-only in --json mode). Writes NOTHING.
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
const CODE_SCAN_EXTS = new Set(['.cs', '.java', '.ts', '.js']);
const ROOT_SIGNAL_FILES = ['package.json', 'pom.xml', 'requirements.txt', 'pyproject.toml', 'angular.json', 'nx.json', 'web.config', 'app.config', 'packages.config'];
const MAX_DEPTH = 6;
const MAX_CONTENT_READS = 5000;
const MAX_FILE_BYTES = 512 * 1024;

const TOKEN_PRIORITY = ['dotnet_framework', 'dotnet', 'java', 'python', 'angular', 'react', 'nodejs'];
const AUTH_RE = /WebSecurityConfigurerAdapter|SecurityFilterChain|AddAuthentication|passport|jsonwebtoken/;
const DAPPER_RE = /\bDapper\b|IDbConnection|\.Query<|\.Execute\(/;

function parseArgs(argv) {
  const jsonOut = argv.includes('--json');
  const rootsArg = argv.find(a => a.startsWith('--roots='))?.slice(8) ?? '.';
  const roots = rootsArg.split(',').map(r => r.trim()).filter(Boolean);
  return { jsonOut, roots };
}

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
  const sorted = [...new Set((roots || []).map(r => path.resolve(r)))].sort((a, b) => a.length - b.length);
  const kept = [];
  for (const root of sorted) {
    if (!kept.some(existing => isWithin(existing, root))) kept.push(root);
  }
  return kept;
}

function isSignalFileName(name) {
  const lower = String(name || '').toLowerCase();
  return ROOT_SIGNAL_FILES.includes(lower) ||
    lower.endsWith('.config') ||
    lower.endsWith('.edmx') ||
    lower.endsWith('dbcontext.cs');
}

function detectStack(root) {
  const script = path.join(__dirname, 'repo-detect.cjs');
  try {
    const out = execFileSync(process.execPath, [script, `--root=${root}`, '--json'], { encoding: 'utf8' });
    return JSON.parse(out);
  } catch (err) {
    const stdout = err?.stdout ? String(err.stdout) : '';
    try { return JSON.parse(stdout); }
    catch (_) { return { repo_type: null, detected_stacks: [], generations: {}, meta: {} }; }
  }
}

function tokensFromDetect(d) {
  const known = new Set(TOKEN_PRIORITY);
  return (d.detected_stacks ?? []).filter(t => known.has(t));
}

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
    const langKey = token === 'java' ? 'java' : token === 'python' ? 'python' : 'node';
    const g = gens[langKey] ?? {};
    rows.push({ token, role: null, version: g.version ?? null, generation: g.name ?? null, projectPath: null });
  }
  return rows;
}

function processSignalFile(full, name, state, opts = {}) {
  const ext = path.extname(name).toLowerCase();
  const lower = name.toLowerCase();
  const countSource = opts.countSource !== false;
  const scanCode = opts.scanCode !== false;

  if (countSource && SRC_EXTS.includes(ext)) state.srcCount++;

  if (lower.endsWith('.edmx')) state.dataHits.add('EF6 (EDMX)');
  if (lower.endsWith('dbcontext.cs')) state.dataHits.add('EF (DbContext)');
  if (name === 'pom.xml' && /spring-data|jpa|hibernate/i.test(readText(full))) state.dataHits.add('JPA/Hibernate');
  if (name === 'package.json' && /typeorm|sequelize|prisma/i.test(readText(full))) state.dataHits.add('Node ORM (TypeORM/Sequelize/Prisma)');
  if (name === 'Web.config' || name === 'app.config' || ext === '.config') state.configFiles.push(full);

  if (scanCode && CODE_SCAN_EXTS.has(ext) && state.contentReads < MAX_CONTENT_READS) {
    const text = readText(full);
    if (!text) return;
    state.contentReads++;
    if (AUTH_RE.test(text)) {
      if (/passport|jsonwebtoken/.test(text)) state.authHits.add('passport / JWT (Node)');
      if (/AddAuthentication/.test(text)) state.authHits.add('ASP.NET AddAuthentication');
      if (/WebSecurityConfigurerAdapter|SecurityFilterChain/.test(text)) state.authHits.add('Spring Security');
    }
    if (ext === '.cs' && DAPPER_RE.test(text)) state.dataHits.add('Dapper');
  }
}

function scanPaths(roots, extraFiles) {
  const state = {
    configFiles: [],
    authHits: new Set(),
    dataHits: new Set(),
    srcCount: 0,
    contentReads: 0,
  };
  const seenFiles = new Set();

  function handleFile(full, opts) {
    const resolved = path.resolve(full);
    if (seenFiles.has(resolved)) return;
    seenFiles.add(resolved);
    processSignalFile(resolved, path.basename(resolved), state, opts);
  }

  for (const root of uniqueScanRoots(roots)) {
    let st;
    try { st = fs.statSync(root); } catch (_) { continue; }
    if (st.isFile()) handleFile(root);
    else if (st.isDirectory()) walk(root, full => handleFile(full));
  }
  for (const file of extraFiles || []) {
    let st;
    try { st = fs.statSync(file); } catch (_) { continue; }
    if (st.isFile()) handleFile(file, { countSource: false, scanCode: false });
  }

  return {
    configFiles: state.configFiles,
    authHits: [...state.authHits],
    dataHits: [...state.dataHits],
    srcCount: state.srcCount,
  };
}

function scanRoot(root) {
  return scanPaths([root], []);
}

function hasSourceOutsideScanRoots(root, scanRoots) {
  const coveredAbs = uniqueScanRoots(scanRoots || []).map(r => path.resolve(r));
  let outside = false;
  walk(path.resolve(root), full => {
    if (outside) return;
    const ext = path.extname(full).toLowerCase();
    if (!SRC_EXTS.includes(ext)) return;
    const abs = path.resolve(full);
    if (!coveredAbs.some(base => isWithin(base, abs))) outside = true;
  });
  return outside;
}

function hasSignalOutsideScanRoots(root, scanRoots) {
  const coveredAbs = uniqueScanRoots(scanRoots || []).map(r => path.resolve(r));
  let outside = false;
  walk(path.resolve(root), (full, name) => {
    if (outside) return;
    if (!isSignalFileName(name)) return;
    const abs = path.resolve(full);
    if (!coveredAbs.some(base => isWithin(base, abs))) outside = true;
  });
  return outside;
}

function collectNestedSignalFiles(root, scanRoots) {
  const coveredAbs = uniqueScanRoots(scanRoots || []).map(r => path.resolve(r));
  const files = [];
  walk(path.resolve(root), (full, name) => {
    if (!isSignalFileName(name)) return;
    const abs = path.resolve(full);
    if (coveredAbs.some(base => isWithin(base, abs))) return;
    files.push(abs);
  });
  return [...new Set(files)];
}

function readStoredBuildfileFingerprint(root) {
  const state = readJson(path.join(root, '.claude', 'dream-init-state.json'));
  return state?.generations_meta?.buildfile_fingerprint || '';
}

function graphScanContext(root, detectMeta) {
  const rootAbs = path.resolve(root);
  const graphPath = path.join(rootAbs, '.claude', 'graph', 'graph.json');
  if (!existsUnder(rootAbs, '.claude/graph/graph.json')) return null;
  if (existsUnder(rootAbs, '.claude/graph/.stale')) return null;

  const graph = readJson(graphPath);
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return null;

  const state = readJson(path.join(rootAbs, '.claude', 'dream-init-state.json'));
  if (!state) return null;

  const storedFingerprint = state?.generations_meta?.buildfile_fingerprint || '';
  const currentFingerprint = detectMeta?.buildfile_fingerprint || '';
  if (!storedFingerprint || !currentFingerprint) return null;
  if (storedFingerprint !== currentFingerprint) return null;

  const localRoots = [];
  for (const node of graph.nodes) {
    const sourceRoot = node?.sourceRoot ? path.resolve(node.sourceRoot) : rootAbs;
    if (!isWithin(rootAbs, sourceRoot)) continue;
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

  const scanRoots = uniqueScanRoots(localRoots);
  return {
    scanRoots,
    extraFiles: collectNestedSignalFiles(rootAbs, scanRoots),
  };
}

function scanRootWithGraphFastPath(root, detectMeta, tokens) {
  const graph = graphScanContext(root, detectMeta);
  if (!graph) return { mode: 'fallback', scan: scanRoot(root) };

  const rootAbs = path.resolve(root);
  const alreadyFullRoot = graph.scanRoots.some(r => path.resolve(r) === rootAbs);
  if (!alreadyFullRoot && hasSourceOutsideScanRoots(rootAbs, graph.scanRoots)) {
    return { mode: 'fallback', scan: scanRoot(root) };
  }
  if (!alreadyFullRoot && hasSignalOutsideScanRoots(rootAbs, graph.scanRoots)) {
    return { mode: 'fallback', scan: scanRoot(root) };
  }

  const scan = scanPaths(graph.scanRoots, graph.extraFiles);
  if ((tokens || []).length > 0 && scan.srcCount === 0) {
    return { mode: 'fallback', scan: alreadyFullRoot ? scan : scanRoot(root) };
  }
  return { mode: 'graph', scan };
}

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
  hasSignalOutsideScanRoots,
  hasSourceOutsideScanRoots,
  main,
  parseArgs,
  scanPaths,
  scanRoot,
  scanRootWithGraphFastPath,
  tokensFromDetect,
};
