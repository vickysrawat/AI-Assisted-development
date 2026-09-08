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

// ── Args ──────────────────────────────────────────────────────────────────────
const JSON_OUT = process.argv.includes('--json');
const rootsArg = process.argv.find(a => a.startsWith('--roots='))?.slice(8) ?? '.';
const ROOTS = rootsArg.split(',').map(r => r.trim()).filter(Boolean);

const PRUNE = new Set(['.git', 'node_modules', 'bin', 'obj', 'dist', 'out', '.angular', 'coverage', '.cache', 'tmp']);
const SRC_EXTS = ['.cs', '.java', '.ts', '.tsx', '.js', '.jsx', '.py'];
const MAX_DEPTH = 6;
const MAX_CONTENT_READS = 5000;   // cap content scans so a huge source tree stays tractable
const MAX_FILE_BYTES = 512 * 1024;

// Token vocabulary matches checkpoint mode.source_token. `primary` picks the most SPECIFIC stack:
// backend languages first, then frontend frameworks, then generic nodejs last (a repo detected as
// angular/react also carries 'nodejs' — the framework, not the runtime, is the representative stack).
const TOKEN_PRIORITY = ['dotnet_framework', 'dotnet', 'java', 'python', 'angular', 'react', 'nodejs'];
const AUTH_RE = /WebSecurityConfigurerAdapter|SecurityFilterChain|AddAuthentication|passport|jsonwebtoken/;

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

// ── Migration-specific signals: one bounded walk per root gathers everything ────
function scanRoot(root) {
  const configFiles = [];
  const authHits = new Set();
  const dataHits = new Set();
  let srcCount = 0;
  let contentReads = 0;

  walk(root, (full, name) => {
    const ext = path.extname(name).toLowerCase();
    const lower = name.toLowerCase();
    if (SRC_EXTS.includes(ext)) srcCount++;

    if (lower.endsWith('.edmx')) dataHits.add('EF6 (EDMX)');
    if (lower.endsWith('dbcontext.cs')) dataHits.add('EF (DbContext)');
    if (name === 'pom.xml' && /spring-data|jpa|hibernate/i.test(readText(full))) dataHits.add('JPA/Hibernate');
    if (name === 'package.json' && /typeorm|sequelize|prisma/i.test(readText(full))) dataHits.add('Node ORM (TypeORM/Sequelize/Prisma)');
    if (name === 'Web.config' || name === 'app.config' || ext === '.config') configFiles.push(full);

    // Auth + Dapper need content; cap total reads so a large tree stays tractable.
    if ((ext === '.cs' || ext === '.java' || ext === '.ts' || ext === '.js') && contentReads < MAX_CONTENT_READS) {
      const t = readText(full);
      if (!t) return;
      contentReads++;
      if (AUTH_RE.test(t)) {
        if (/passport|jsonwebtoken/.test(t)) authHits.add('passport / JWT (Node)');
        if (/AddAuthentication/.test(t)) authHits.add('ASP.NET AddAuthentication');
        if (/WebSecurityConfigurerAdapter|SecurityFilterChain/.test(t)) authHits.add('Spring Security');
      }
      if (ext === '.cs' && /\bDapper\b|IDbConnection|\.Query<|\.Execute\(/.test(t)) dataHits.add('Dapper');
    }
  });

  return { configFiles, authHits: [...authHits], dataHits: [...dataHits], srcCount };
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

// ── Per-root detect + merge ─────────────────────────────────────────────────────
const perRoot = ROOTS.map(root => {
  const d = detectStack(root);
  const tokens = tokensFromDetect(d);
  const scan = scanRoot(root);
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
});

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

const descriptor = {
  roots: ROOTS,
  primary: { token: primaryToken, version: primaryVersion },
  stacks: allStacks,
  dataLayer: [...new Set(perRoot.flatMap(r => r.dataLayer))],
  auth: [...new Set(perRoot.flatMap(r => r.auth))],
  integrations: perRoot.flatMap(r => r.integrations),
  sizeEstimate: { files: perRoot.reduce((n, r) => n + r.sizeFiles, 0) },
  graphPresent: perRoot.some(r => r.graphPresent),
  archDocsPresent: perRoot.some(r => r.archDocsPresent),
};

// ── Output ──────────────────────────────────────────────────────────────────────
if (JSON_OUT) {
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
process.exit(descriptor.primary.token ? 0 : 3);
