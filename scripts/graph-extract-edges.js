#!/usr/bin/env node
// ai-assisted-development — deterministic EXTRACTED-edge extractor for the knowledge graph.
//
// Derives dependency edges by PARSING import/using/require/ProjectReference statements and
// resolving each to the owning graph module. Rewrites ONLY the `EXTRACTED` edges in
// `.claude/graph/graph.json`; preserves model-authored `INFERRED`/`AMBIGUOUS` edges. Never
// touches `nodes` and never recomputes `fingerprint`s (those come from the bash
// graph_module_fingerprint helper — a Node re-hash would diverge). Node stdlib only, offline;
// raw source is parsed locally and never surfaced. See ADR 0041 + skills/shared/graph-json-schema.md.
//
// Usage: node graph-extract-edges.js [--graph .claude/graph/graph.json] [--root .] [--dry-run]

const fs = require('fs');
const path = require('path');

function argVal(name, def) { const i = process.argv.indexOf(name); return (i >= 0 && i + 1 < process.argv.length) ? process.argv[i + 1] : def; }
const GRAPH = argVal('--graph', '.claude/graph/graph.json');
const ROOT  = argVal('--root', '.');
const DRY   = process.argv.includes('--dry-run');

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'bin', 'obj', 'dist', '.angular', 'migrations', '__pycache__', '.vs', 'packages']);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.cs', '.java', '.csproj']);

// ── load graph ──────────────────────────────────────────────────────────────
let graph;
try { graph = JSON.parse(fs.readFileSync(GRAPH, 'utf8')); }
catch (e) { console.error('graph-extract-edges: cannot read ' + GRAPH + ' — ' + e.message); process.exit(2); }
const nodes = graph.nodes || [];
if (!nodes.length) { console.error('graph-extract-edges: no nodes in graph — run architect/setup-init first'); process.exit(2); }

// ── path helpers ──────────────────────────────────────────────────────────────
// All file identity is ABSOLUTE + forward-slashed so nodes from multiple source roots
// (repo + additionalDirectories dependency repos) never collide and cross-root imports /
// ProjectReferences resolve. See skills/shared/multi-root-scan.md.
const norm = p => (p || '').replace(/\\/g, '/').replace(/^\.\//, '');
const REPO = norm(path.resolve(ROOT));
function globToRegex(g) {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') { if (g[i + 1] === '*') { re += '.*'; i++; if (g[i + 1] === '/') i++; } else re += '[^/]*'; }
    else if (c === '?') re += '.';
    else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$');
}
function globBase(g) { const i = g.search(/[*?]/); const b = i < 0 ? g : g.slice(0, i); return b.replace(/\/+$/, ''); }

// node path matchers, most-specific (longest base) first. Each glob resolves against the
// node's sourceRoot (dependency repo) or the repo root, so matchers key ABSOLUTE paths.
const matchers = [];
for (const n of nodes) {
  const nodeBase = n.sourceRoot ? norm(n.sourceRoot) : REPO;
  for (const g of (n.paths || [])) {
    const gg = norm(nodeBase + '/' + g);
    matchers.push({ id: n.id, re: globToRegex(gg), base: globBase(gg) });
  }
}
matchers.sort((a, b) => b.base.length - a.base.length);
function ownerOf(absPath) { const p = norm(absPath); for (const m of matchers) if (m.re.test(p)) return m.id; return null; }

// ── walk source files under the union of node bases (absolute) ───────────────
const roots = [...new Set(matchers.map(m => m.base).filter(Boolean))]; // absolute base dirs
const files = []; const seen = new Set();
function walk(absDir) {
  let ents; try { ents = fs.readdirSync(absDir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (e.name.startsWith('.git') || IGNORE_DIRS.has(e.name)) continue;
    const abs = norm(absDir + '/' + e.name);
    if (e.isDirectory()) walk(abs);
    else if (CODE_EXT.has(path.extname(e.name).toLowerCase())) { if (!seen.has(abs)) { seen.add(abs); files.push(abs); } }
  }
}
for (const r of roots) walk(r);

const fileToNode = {};
for (const f of files) { const o = ownerOf(f); if (o) fileToNode[f] = o; }

function readSafe(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }
const JS_CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const records = []; // Single-read parse records; this reduces duplicate per-file I/O.
for (const f of files) {
  const from = fileToNode[f]; if (!from) continue;
  const ext = path.extname(f).toLowerCase();
  const src = readSafe(f); if (!src) continue;
  const rec = { file: f, from, ext, declarations: [], refs: [] };

  if (JS_CODE_EXT.has(ext)) {
    let m;
    let re = /(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g; while ((m = re.exec(src))) if (m[1].startsWith('.')) rec.refs.push({ kind: 'rel-js', spec: m[1] });
    re = /\bimport\s*['"]([^'"]+)['"]/g;                          while ((m = re.exec(src))) if (m[1].startsWith('.')) rec.refs.push({ kind: 'rel-js', spec: m[1] });
    re = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;                  while ((m = re.exec(src))) if (m[1].startsWith('.')) rec.refs.push({ kind: 'rel-js', spec: m[1] });

  } else if (ext === '.py') {
    let m;
    let re = /^\s*from\s+(\.*[\w.]*)\s+import\s+/gm;
    while ((m = re.exec(src))) rec.refs.push({ kind: 'py', spec: m[1] });
    re = /^\s*import\s+([\w.]+)/gm;
    while ((m = re.exec(src))) rec.refs.push({ kind: 'py', spec: m[1] });

  } else if (ext === '.cs') {
    let m; const nsRe = /^\s*namespace\s+([A-Za-z_][\w.]*)/gm;
    while ((m = nsRe.exec(src))) rec.declarations.push({ kind: 'cs-namespace', spec: m[1] });
    const usingRe = /^\s*using\s+(?:static\s+)?([A-Za-z_][\w.]*)\s*;/gm;
    while ((m = usingRe.exec(src))) rec.refs.push({ kind: 'cs-using', spec: m[1] });

  } else if (ext === '.java') {
    let m; const pkgRe = /^\s*package\s+([A-Za-z_][\w.]*)\s*;/gm;
    while ((m = pkgRe.exec(src))) rec.declarations.push({ kind: 'java-package', spec: m[1] });
    const importRe = /^\s*import\s+(?:static\s+)?([A-Za-z_][\w.]*)\.[A-Za-z_]\w*\s*;/gm;
    while ((m = importRe.exec(src))) rec.refs.push({ kind: 'java-import', spec: m[1] });

  } else if (ext === '.csproj') {
    let m; const re = /<ProjectReference\s+[^>]*Include\s*=\s*"([^"]+)"/g;
    while ((m = re.exec(src))) rec.refs.push({ kind: 'csproj-ref', spec: m[1] });
  }

  records.push(rec);
}

// ── namespace/package → node maps (C#, Java) ─────────────────────────────────
const nsToNode = {}; // C# namespace  → node id
const pkgToNode = {}; // Java package → node id
for (const rec of records) {
  for (const d of rec.declarations) {
    if (d.kind === 'cs-namespace' && !(d.spec in nsToNode)) nsToNode[d.spec] = rec.from;
    else if (d.kind === 'java-package' && !(d.spec in pkgToNode)) pkgToNode[d.spec] = rec.from;
  }
}
const nsKeys = Object.keys(nsToNode).sort((a, b) => b.length - a.length);
const pkgKeys = Object.keys(pkgToNode).sort((a, b) => b.length - a.length);
// longest-prefix namespace/package resolver
function resolveNs(map, keys, ns) {
  if (map[ns]) return map[ns];
  for (const k of keys) if (ns === k || ns.startsWith(k + '.')) return map[k];
  return null;
}

// ── resolve a relative import to a repo file (JS/TS/Py) ──────────────────────
const JS_EXT = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.d.ts'];
function resolveRelFile(fromFile, spec, exts) {
  const baseDir = path.posix.dirname(norm(fromFile));
  const target = norm(path.posix.normalize(baseDir + '/' + spec));
  for (const e of exts) { const cand = target + e; if (seen.has(cand)) return cand; }
  for (const e of exts) { const cand = norm(target + '/index' + e); if (seen.has(cand)) return cand; } // JS index
  for (const e of ['/__init__.py']) { const cand = norm(target + e); if (seen.has(cand)) return cand; } // Py package
  return null;
}

// Absolute Python imports resolve from graph source roots (repo root and any dependency roots),
// not matcher bases, so `import pkg.sub` resolves to `<sourceRoot>/pkg/sub.py`.
const sourceRoots = [...new Set(nodes.map(n => norm(n.sourceRoot || REPO)).filter(Boolean))];
// ── resolve parsed refs per file → target node ────────────────────────────────
const edgeSet = new Set(); // "from\tto"
function addEdge(from, to) { if (from && to && from !== to) edgeSet.add(from + '\t' + to); }

for (const rec of records) {
  for (const ref of rec.refs) {
    if (ref.kind === 'rel-js') {
      const tf = resolveRelFile(rec.file, ref.spec, JS_EXT);
      if (tf) addEdge(rec.from, fileToNode[tf]);
    } else if (ref.kind === 'py') {
      addEdge(rec.from, resolvePy(rec.file, ref.spec));
    } else if (ref.kind === 'cs-using') {
      addEdge(rec.from, resolveNs(nsToNode, nsKeys, ref.spec));
    } else if (ref.kind === 'java-import') {
      addEdge(rec.from, resolveNs(pkgToNode, pkgKeys, ref.spec));
    } else if (ref.kind === 'csproj-ref') {
      const refWin = ref.spec.split('\\').join('/');
      const target = norm(path.posix.normalize(path.posix.dirname(norm(rec.file)) + '/' + refWin));
      addEdge(rec.from, fileToNode[target] || ownerOf(target));
    }
  }
}

function resolvePy(fromFile, mod) {
  if (!mod) return null;
  let rel = mod;
  if (mod.startsWith('.')) {
    // relative: leading dots = levels up from the file's dir
    const dots = mod.match(/^\.+/)[0].length;
    let dir = path.posix.dirname(norm(fromFile));
    for (let i = 1; i < dots; i++) dir = path.posix.dirname(dir);
    const sub = mod.slice(dots).replace(/\./g, '/');
    const base = sub ? dir + '/' + sub : dir;
    return fileToNode[norm(base + '.py')] || fileToNode[norm(base + '/__init__.py')] || ownerOf(base + '.py');
  }
  // absolute dotted: resolve from each graph source root.
  const sub = rel.replace(/\./g, '/');
  for (const r of sourceRoots) {
    const cand = fileToNode[norm(r + '/' + sub + '.py')] || fileToNode[norm(r + '/' + sub + '/__init__.py')];
    if (cand) return cand;
  }
  return null;
}

// ── merge policy ──────────────────────────────────────────────────────────────
// The parser decides which (from,to) pairs have a real, source-visible dependency.
//   • parser-confirmed pair with an existing edge → keep the edge (its LLM-refined
//     type + reason) but mark confidence EXTRACTED — no redundant `depends` added.
//   • parser-confirmed pair with no existing edge → add {type:"depends", EXTRACTED}.
//   • existing INFERRED/AMBIGUOUS on a pair the parser can't see (DI/dynamic/prose) → kept.
//   • existing EXTRACTED on a pair no longer in source → dropped (stale).
// Drops edges with endpoints that are no longer nodes (no dangling).
const nodeIds = new Set(nodes.map(n => n.id));
const found = edgeSet; // "from\tto" pairs confirmed in source
const result = [];
const confirmedPairs = new Set();
for (const e of (graph.edges || [])) {
  if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;                 // dangling → drop
  const pair = e.from + '\t' + e.to;
  if (e.confidence === 'EXTRACTED' && !found.has(pair)) continue;          // stale EXTRACTED → drop
  const edge = ordered_(e);
  if (found.has(pair)) { edge.confidence = 'EXTRACTED'; confirmedPairs.add(pair); } // parser confirms → EXTRACTED
  result.push(edge);
}
for (const pair of found) if (!confirmedPairs.has(pair)) {                 // new pair, no existing edge
  const [from, to] = pair.split('\t');
  result.push({ from, to, type: 'depends', confidence: 'EXTRACTED' });
}
function ordered_(e) { return { from: e.from, to: e.to, type: e.type || 'depends', confidence: e.confidence, ...(e.reason ? { reason: e.reason } : {}) }; }
// dedupe by (from,to,type) and sort
const seenEdge = new Set();
const merged = result.filter(e => { const k = e.from + '\t' + e.to + '\t' + (e.type || 'depends'); if (seenEdge.has(k)) return false; seenEdge.add(k); return true; })
  .sort((a, b) => (a.from + '\t' + a.to + '\t' + (a.type || '')).localeCompare(b.from + '\t' + b.to + '\t' + (b.type || '')));

// ── deterministic serialization (schema key order) ────────────────────────────
const NODE_KEYS = ['id', 'module', 'domain', 'type', 'detailFile', 'entryPoint', 'paths', 'sourceRoot', 'fingerprint', 'hub'];
const EDGE_KEYS = ['from', 'to', 'type', 'confidence', 'reason'];
function ordered(obj, keys) { const o = {}; for (const k of keys) if (obj[k] !== undefined) o[k] = obj[k]; for (const k of Object.keys(obj)) if (!keys.includes(k)) o[k] = obj[k]; return o; }
const out = {
  meta: graph.meta,
  nodes: nodes.slice().sort((a, b) => String(a.id).localeCompare(String(b.id))).map(n => ordered(n, NODE_KEYS)),
  edges: merged.map(e => ordered(e, EDGE_KEYS)),
};
const json = JSON.stringify(out, null, 2) + '\n';

const nExtracted = merged.filter(e => e.confidence === 'EXTRACTED').length;
const nOther = merged.length - nExtracted;
const summary = `graph-extract-edges: ${nExtracted} EXTRACTED edge(s) from ${files.length} file(s) across ${nodes.length} module(s); kept ${nOther} INFERRED/AMBIGUOUS.`;
if (DRY) {
  console.log('[dry-run] ' + summary);
  for (const e of merged.filter(x => x.confidence === 'EXTRACTED')) console.log('  ' + e.from + ' -> ' + e.to + ' [' + e.type + ']');
  process.exit(0);
}
fs.writeFileSync(GRAPH, json);
console.log(summary);
