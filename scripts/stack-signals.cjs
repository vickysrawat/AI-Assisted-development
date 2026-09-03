#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Canonical single-source-of-truth for tech-stack detection. Exports
//                      STACK_SIGNALS_TABLE (one entry per rule/stack_key), gatherProjectSignals()
//                      (pruned file walk + multi-manifest dependency union), resolveGeneration()
//                      (.NET runtime generation for P1), and a pure scoreStacks(signals, repoType,
//                      generations) → scored {name, stack_key, confidence, evidence, generation}
//                      per category. Replaces the per-rule `detect:` frontmatter.
// What it touches:     Read-only. Reads project files + manifests under a caller-supplied root.
//                      Writes nothing.
// What it does NOT do: No network, no git, no state writes. No source-content/syntax scanning
//                      (manifest + file-extension signals only; syntax fallback is P2/architect).
// APIs / commands:     Node stdlib fs, path only.
// How to verify:       node tests/stack-signals.test.cjs

'use strict';
const fs = require('fs');
const path = require('path');

// Directories that never carry first-party stack signals — vendored libs, build output,
// package caches. Pruned from the walk so a bundled bootstrap.css / jquery.js under wwwroot/lib
// or bin/ does not register as a frontend signal on a backend repo.
const PRUNE_DIRS = new Set([
  'node_modules', 'bin', 'obj', 'dist', 'build', 'out', 'target', 'packages', 'vendor',
  'Scripts', '.vs', '.git', 'coverage', 'TestResults', 'publish', '.next', '.nuxt', '.svelte-kit',
]);
const MAX_DEPTH = 6;

// ── Project signal gathering (pruned walk + dependency union) ───────────────────────────
// Returns { files: Set<relPath>, exts: Set<'.cs'…>, deps: Set<lowercased pkg id>, manifests: {…} }.
function gatherProjectSignals(root) {
  const files = new Set(), exts = new Set(), deps = new Set();
  // packages: additive name→version map (lowercased name). Kept ALONGSIDE `deps` (name-only set)
  // so existing depHit() scoring is undisturbed. CPM versions from Directory.Packages.props are
  // merged in for PackageReference entries that omit an inline Version. (P1-Shared / Point 4.)
  const packages = {};
  const manifests = { csproj: [], packagesConfig: [], packageJson: null, requirements: false,
    pyproject: null, pom: [], gradle: [], goMod: null, cargo: null, gemfile: null, composer: null,
    // build-file inputs for per-project TFM resolution (Point 2): props are inherited, global.json
    // pins the SDK/toolchain (a low-confidence TFM fallback only), Packages.props holds CPM versions.
    directoryBuildProps: [], directoryPackagesProps: [], globalJson: null };

  function walk(dir, depth) {
    if (depth > MAX_DEPTH) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      if (e.isDirectory()) {
        if (PRUNE_DIRS.has(e.name) || e.name.startsWith('.')) {
          // prune vendored lib dir only when its parent is wwwroot; otherwise a leading-dot skip
          if (e.name.startsWith('.') || PRUNE_DIRS.has(e.name)) continue;
        }
        // wwwroot/lib is vendored client libs; wwwroot/css (first-party) stays matchable
        if (e.name === 'lib' && path.basename(dir).toLowerCase() === 'wwwroot') continue;
        walk(path.join(dir, e.name), depth + 1);
      } else if (e.isFile()) {
        const rel = path.relative(root, path.join(dir, e.name)).replace(/\\/g, '/');
        files.add(rel);
        const ext = path.extname(e.name).toLowerCase();
        if (ext) exts.add(ext);
        collectManifest(root, dir, e.name, manifests, deps, packages);
      }
    }
  }
  walk(root, 0);
  // Merge CPM (Directory.Packages.props) versions into packages for names still lacking a version.
  for (const propsPath of manifests.directoryPackagesProps) {
    let txt = ''; try { txt = fs.readFileSync(propsPath, 'utf8'); } catch (_) {}
    for (const m of txt.matchAll(/<PackageVersion\s+[^>]*Include="([^"]+)"[^>]*Version="([^"]+)"/gi)) {
      const key = m[1].toLowerCase();
      if (!packages[key]) packages[key] = m[2].trim();
    }
  }
  return { files, exts, deps, packages, manifests, _root: root };
}

// Parse dependency identifiers out of the manifest formats we support, into one lowercased set.
// Also captures package VERSIONS into `packages` (additive; `deps` name-set is unchanged).
function collectManifest(root, dir, name, manifests, deps, packages) {
  const abs = path.join(dir, name);
  const read = () => { try { return fs.readFileSync(abs, 'utf8'); } catch (_) { return ''; } };
  const lower = name.toLowerCase();
  if (lower.endsWith('.csproj')) {
    manifests.csproj.push(abs);
    const txt = read();
    // Match each <PackageReference …> opening tag, then extract Include/Version order-independently
    // (both attribute form `Version="Y"` and child-element form `<Version>Y</Version>`).
    for (const m of txt.matchAll(/<PackageReference\b([^>]*)>([\s\S]*?<\/PackageReference>)?/gi)) {
      const attrs = m[1] || '';
      const inc = attrs.match(/\bInclude="([^"]+)"/i);
      if (!inc) continue;
      const key = inc[1].toLowerCase(); deps.add(key);
      const av = attrs.match(/\bVersion="([^"]+)"/i);
      const cv = (m[2] || '').match(/<Version>([^<]+)<\/Version>/i);
      const ver = (av && av[1]) || (cv && cv[1]);
      if (ver && packages && !/^\$\(/.test(ver.trim())) packages[key] = ver.trim();
    }
  } else if (lower === 'directory.build.props') {
    manifests.directoryBuildProps.push(abs);
  } else if (lower === 'directory.packages.props') {
    manifests.directoryPackagesProps.push(abs);   // CPM versions parsed after the walk
  } else if (lower === 'global.json') {
    manifests.globalJson = abs;
  } else if (lower === 'packages.config') {
    manifests.packagesConfig.push(abs);
    for (const m of read().matchAll(/<package\s+id="([^"]+)"(?:\s+version="([^"]+)")?/gi)) {
      const key = m[1].toLowerCase(); deps.add(key);
      if (m[2] && packages) packages[key] = m[2].trim();
    }
  } else if (lower === 'package.json') {
    manifests.packageJson = abs;
    try {
      const pj = JSON.parse(read());
      for (const k of Object.keys(pj.dependencies || {})) deps.add(k.toLowerCase());
      for (const k of Object.keys(pj.devDependencies || {})) deps.add(k.toLowerCase());
    } catch (_) {}
  } else if (lower === 'requirements.txt') {
    manifests.requirements = true;
    for (const line of read().split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9._-]+)/); if (m) deps.add(m[1].toLowerCase());
    }
  } else if (lower === 'pyproject.toml') {
    manifests.pyproject = abs;
  } else if (lower === 'pom.xml') {
    manifests.pom.push(abs);
    for (const m of read().matchAll(/<artifactId>([^<]+)<\/artifactId>/gi)) deps.add(m[1].toLowerCase());
  } else if (lower === 'build.gradle' || lower === 'build.gradle.kts') {
    manifests.gradle.push(abs);
  } else if (lower === 'go.mod') { manifests.goMod = abs; }
  else if (lower === 'cargo.toml') { manifests.cargo = abs; }
  else if (lower === 'gemfile') { manifests.gemfile = abs; }
  else if (lower === 'composer.json') { manifests.composer = abs; }
}

// ── Runtime-generation resolution (manifest-first; per runtime-generation-spec.md) ──────
// Nested under a language entry when that language has a stack_key. Ruby/PHP/Go/Rust have no
// stack_key/rules today, so their resolvers feed the detection.generations map (migration/
// architect consumers), not a nested entry. Syntax-pattern fallback is consent-gated and lives
// in the architect skill (repo-detect is non-interactive) — see runtime-generation-spec.md.
function resolveGeneration(stackKey, signals) {
  if (/^csharp/.test(stackKey)) return resolveDotnetGeneration(signals);
  if (stackKey === 'python') return resolvePythonGeneration(signals);
  if (stackKey === 'java') return resolveJavaGeneration(signals);
  if (stackKey === 'nodejs-typescript' || stackKey === 'javascript' || stackKey === 'typescript') return resolveNodeGeneration(signals);
  return null;
}

// Aggregate — one entry per language whose manifest is present (for detection.generations).
function resolveAllGenerations(signals) {
  const g = {};
  const put = (k, v) => { if (v && v.confidence > 0) g[k] = v; };
  if (signals.manifests.csproj.length || signals.manifests.packagesConfig.length) put('dotnet', resolveDotnetGeneration(signals));
  if (signals.manifests.requirements || signals.manifests.pyproject || signals.exts.has('.py')) put('python', resolvePythonGeneration(signals));
  if (signals.manifests.pom.length || signals.manifests.gradle.length) put('java', resolveJavaGeneration(signals));
  if (signals.manifests.packageJson) put('node', resolveNodeGeneration(signals));
  if (signals.manifests.gemfile) put('ruby', resolveRubyGeneration(signals));
  if (signals.manifests.composer) put('php', resolvePhpGeneration(signals));
  if (signals.manifests.goMod) put('go', resolveGoGeneration(signals));
  if (signals.manifests.cargo) put('rust', resolveRustGeneration(signals));
  return g;
}

function readIf(p) { try { return p ? fs.readFileSync(p, 'utf8') : ''; } catch (_) { return ''; } }

function resolvePythonGeneration(signals) {
  const py = readIf(signals.manifests.pyproject);
  const req = signals.manifests.requirements;
  const m = py.match(/python[_-]?requires\s*=?\s*["']?([><=!~ .0-9,]+)/i) || py.match(/requires-python\s*=\s*["']([^"']+)"/i);
  if (m) {
    const floor = (m[1].match(/(\d+)\.(\d+)/) || [])[0];
    if (/(^|[^0-9])2\./.test(m[1]) && !/3\./.test(m[1])) return { name: 'python-2', confidence: 0.85, evidence: 'python_requires ' + m[1].trim() };
    return { name: 'python-3', confidence: 0.85, evidence: 'python_requires ' + m[1].trim() + (floor ? '' : '') };
  }
  if (py || req) return { name: 'python-3', confidence: 0.6, evidence: py ? 'pyproject.toml (no floor)' : 'requirements.txt' };
  return { name: 'python-unknown', confidence: 0.3, evidence: 'no python_requires' };
}

function resolveJavaGeneration(signals) {
  const txt = [...signals.manifests.pom, ...signals.manifests.gradle].map(readIf).join('\n');
  const rel = txt.match(/<maven\.compiler\.release>(\d+)</i) || txt.match(/<(?:maven\.compiler\.)?source>(?:1\.)?(\d+)</i) || txt.match(/sourceCompatibility\s*=?\s*['"]?(?:1\.)?(\d+)/i);
  const moduleInfo = [...signals.files].some(f => /module-info\.java$/.test(f));
  if (rel) {
    const v = parseInt(rel[1], 10);
    return { name: v >= 11 ? 'java-modern' : 'java-legacy', confidence: 0.85, evidence: 'compiler ' + v + (moduleInfo ? '; module-info.java' : '') };
  }
  if (moduleInfo) return { name: 'java-modern', confidence: 0.7, evidence: 'module-info.java (JPMS ⇒ 9+)' };
  const ant = [...signals.files].some(f => /(^|\/)build\.xml$/.test(f));
  if (ant) return { name: 'java-legacy', confidence: 0.6, evidence: 'Ant build.xml' };
  return { name: 'java-unknown', confidence: 0.3, evidence: 'no compiler target' };
}

function resolveNodeGeneration(signals) {
  const pj = readIf(signals.manifests.packageJson);
  let engines = null, esm = false;
  try { const o = JSON.parse(pj); engines = o.engines && o.engines.node; esm = o.type === 'module'; } catch (_) {}
  const modernLock = [...signals.files].some(f => /(^|\/)(pnpm-lock\.yaml|\.yarnrc\.yml)$/.test(f));
  if (engines) {
    const floor = (String(engines).match(/(\d+)/) || [])[1];
    const n = floor ? parseInt(floor, 10) : 0;
    return { name: n >= 16 ? 'node-modern' : 'node-legacy', confidence: 0.85, evidence: 'engines.node ' + engines };
  }
  if (esm || modernLock) return { name: 'node-modern', confidence: 0.7, evidence: esm ? 'type:module' : 'pnpm/yarn2 lockfile' };
  if (pj) return { name: 'node-unknown', confidence: 0.5, evidence: 'package.json (no engines pin)' };
  return { name: 'node-unknown', confidence: 0.3, evidence: 'no package.json' };
}

function resolveRubyGeneration(signals) {
  const g = readIf(signals.manifests.gemfile);
  const m = g.match(/ruby\s+["']([0-9.]+)/i);
  if (m) return { name: /^3\./.test(m[1]) ? 'ruby-modern' : 'ruby-legacy', confidence: 0.8, evidence: "ruby '" + m[1] + "'" };
  return { name: 'ruby-unknown', confidence: 0.3, evidence: 'no ruby directive' };
}
function resolvePhpGeneration(signals) {
  const c = readIf(signals.manifests.composer);
  const m = c.match(/"php"\s*:\s*"([^"]+)"/i);
  if (m) return { name: /(^|[^0-9])[89]\./.test(m[1]) ? 'php-modern' : 'php-legacy', confidence: 0.8, evidence: 'require.php ' + m[1] };
  return { name: 'php-unknown', confidence: 0.3, evidence: 'no require.php' };
}
function resolveGoGeneration(signals) {
  const m = readIf(signals.manifests.goMod).match(/^go\s+(\d+\.\d+)/m);
  if (m) return { name: 'go-modules', confidence: 0.85, evidence: 'go ' + m[1] };
  return { name: 'go-legacy', confidence: 0.4, evidence: 'go.mod without go directive' };
}
function resolveRustGeneration(signals) {
  const c = readIf(signals.manifests.cargo);
  const ed = c.match(/edition\s*=\s*"([0-9]+)"/i); const rv = c.match(/rust-version\s*=\s*"([^"]+)"/i);
  const ev = [ed && 'edition ' + ed[1], rv && 'rust-version ' + rv[1]].filter(Boolean).join('; ');
  return { name: 'rust', confidence: ed || rv ? 0.85 : 0.4, evidence: ev || 'Cargo.toml (no edition)' };
}

// ── .NET per-project helpers (P1-Shared) ────────────────────────────────────────────────
// TFM string → coarse generation. TFM is AUTHORITATIVE (gap #7): net4x/v4/netframework →
// framework; netcoreapp/netstandard/net5+/net1x → modern; otherwise null (unknown).
function classifyTfm(v) {
  const s = (v || '').trim();
  if (!s) return null;
  if (/^net4/i.test(s) || /^v4/i.test(s) || /^netframework/i.test(s)) return 'framework';
  if (/^net(coreapp|standard)?\d/i.test(s) || /^net[5-9]/i.test(s) || /^net1\d/i.test(s)) return 'modern';
  return null;
}
// Numeric major for a MODERN net TFM only (net10.0→10, netcoreapp3.1→3); null for framework/netstandard.
function tfmMajor(v) {
  const s = (v || '').trim();
  const m = /^net(\d{1,2})\.\d/i.exec(s) || /^netcoreapp(\d)/i.exec(s);
  return m ? parseInt(m[1], 10) : null;
}
// Extract TFM strings from MSBuild text (plural TargetFrameworks → multi-target; else single;
// else <TargetFrameworkVersion> for old-style). Drops unresolved MSBuild expressions ($(Var)).
function parseTfmsFromText(txt) {
  const plural = txt.match(/<TargetFrameworks>([^<]+)</i);
  const single = txt.match(/<TargetFramework>([^<]+)</i);
  const tfv = txt.match(/<TargetFrameworkVersion>([^<]+)</i);
  let tfms = plural ? plural[1].split(';') : single ? [single[1]] : tfv ? [tfv[1]] : [];
  return tfms.map(t => t.trim()).filter(t => t && !/^\$\(/.test(t));
}
// Nearest-ancestor Directory.Build.props with a concrete TFM (MSBuild inheritance, Point 2).
function nearestPropsTfms(csprojAbs, dirBuildProps) {
  const byDir = new Map((dirBuildProps || []).map(p => [path.dirname(p), p]));
  let dir = path.dirname(csprojAbs), prev = null;
  while (dir && dir !== prev) {
    if (byDir.has(dir)) {
      let txt = ''; try { txt = fs.readFileSync(byDir.get(dir), 'utf8'); } catch (_) {}
      const tfms = parseTfmsFromText(txt);
      if (tfms.length) return tfms;
    }
    prev = dir; dir = path.dirname(dir);
  }
  return null;
}
// global.json sdk.version major → net{major}.0 (SDK/toolchain, NOT runtime — low-confidence only).
function globalJsonTfm(globalJsonPath) {
  if (!globalJsonPath) return null;
  let txt = ''; try { txt = fs.readFileSync(globalJsonPath, 'utf8'); } catch (_) {}
  const m = txt.match(/"version"\s*:\s*"(\d+)\./);
  return m ? 'net' + m[1] + '.0' : null;
}
// Deployable/test classification for the primary-pick (gap: Sdk.Worker MUST count as deployable).
function classifyDotnetRole(txt, csprojAbs) {
  const base = path.basename(csprojAbs, '.csproj');
  if (/\.tests?$/i.test(base) || /(microsoft\.net\.test\.sdk|xunit|nunit|mstest)/i.test(txt)) return { role: 'test', deployable: false };
  if (/Sdk="Microsoft\.NET\.Sdk\.Web/i.test(txt)) return { role: 'web', deployable: true };
  if (/Sdk="Microsoft\.NET\.Sdk\.Worker/i.test(txt)) return { role: 'worker', deployable: true };
  if (/<OutputType>\s*Exe\s*</i.test(txt)) return { role: 'exe', deployable: true };
  return { role: 'lib', deployable: false };
}

// Per-project .NET generation spread (P1-Shared). Returns the coarse `name` (BC scalar), plus the
// additive `versions[]` spread, representative `version`, `heterogeneous`, `generationsPresent`
// (SET for the rule-deploy gate), and `packages` (.NET NuGet name→version). See the plan.
function resolveDotnetGeneration(signals) {
  const root = signals._root || '.';
  const buildProps = signals.manifests.directoryBuildProps || [];
  const globalJson = signals.manifests.globalJson || null;
  const pkgCfgDirs = new Set((signals.manifests.packagesConfig || []).map(p => path.dirname(p)));
  const versions = [];
  let sawModern = false, sawFramework = false, sawUnknown = false;

  for (const csprojAbs of signals.manifests.csproj) {
    let txt = ''; try { txt = fs.readFileSync(csprojAbs, 'utf8'); } catch (_) {}
    const relDir = path.relative(root, path.dirname(csprojAbs)).replace(/\\/g, '/') || '.';

    // Effective TFM: inline → nearest Directory.Build.props → global.json (sdk-derived).
    let tfms = parseTfmsFromText(txt), tfmSource = 'inline', conf = 0.9;
    if (!tfms.length) { const np = nearestPropsTfms(csprojAbs, buildProps); if (np) { tfms = np; tfmSource = 'inherited'; conf = 0.85; } }
    if (!tfms.length) { const gjt = globalJsonTfm(globalJson); if (gjt) { tfms = [gjt]; tfmSource = 'sdk-derived'; conf = 0.5; } }

    const { role } = classifyDotnetRole(txt, csprojAbs);
    // TFM-authoritative generation; weak signals only when NO TFM resolves (fail-safe to modern).
    const gens = [...new Set(tfms.map(classifyTfm).filter(Boolean))];
    let generation;
    if (gens.length === 0) {
      const sdk = /<Project\s+Sdk="Microsoft\.NET\.Sdk/i.test(txt);
      if (pkgCfgDirs.has(path.dirname(csprojAbs))) { generation = 'dotnet-framework'; conf = Math.min(conf, 0.7); }
      else if (sdk) { generation = 'dotnet-modern'; conf = Math.min(conf, 0.7); }
      else { generation = 'dotnet-unknown'; conf = Math.min(conf, 0.3); tfmSource = 'none'; }
    } else if (gens.length === 1) {
      generation = gens[0] === 'framework' ? 'dotnet-framework' : 'dotnet-modern';
    } else {
      generation = ['dotnet-framework', 'dotnet-modern'];   // multi-target SET (gap #8)
    }
    const gset = Array.isArray(generation) ? generation : [generation];
    if (gset.includes('dotnet-modern')) sawModern = true;
    if (gset.includes('dotnet-framework')) sawFramework = true;
    if (gset.includes('dotnet-unknown')) sawUnknown = true;

    const entry = { path: relDir, role, tfmSource, confidence: round2(conf) };
    if (tfms.length > 1) entry.tfms = tfms; else entry.tfm = tfms[0] || null;
    if (Array.isArray(generation)) entry.generations = generation; else entry.generation = generation;
    versions.push(entry);
  }

  // Primary pick: highest modern TFM among deployables, then any non-test, then any (gap #3/tie=highest).
  const nonTest = versions.filter(v => v.role !== 'test');
  const deployables = nonTest.filter(v => v.role === 'web' || v.role === 'worker' || v.role === 'exe');
  const highestTfm = (arr) => {
    let best = null, bestMaj = -1;
    for (const v of arr) for (const t of (v.tfms || (v.tfm ? [v.tfm] : []))) {
      const maj = tfmMajor(t);
      if (maj != null && maj > bestMaj) { bestMaj = maj; best = t; }
    }
    return best;
  };
  let version = highestTfm(deployables) || highestTfm(nonTest) || highestTfm(versions);
  if (!version) { const any = versions.find(v => (v.tfms && v.tfms[0]) || v.tfm); version = any ? (any.tfms ? any.tfms[0] : any.tfm) : null; }

  // heterogeneous: >1 distinct TFM among application (non-test) projects.
  const appTfms = new Set();
  for (const v of nonTest) for (const t of (v.tfms || (v.tfm ? [v.tfm] : []))) appTfms.add(t);
  const heterogeneous = appTfms.size > 1;

  // generationsPresent (fail-safe, gap #7): framework ONLY when a framework project is seen;
  // modern when any modern OR any unknown project (unknown falls to the safe modern default).
  const generationsPresent = [];
  if (sawModern || sawUnknown) generationsPresent.push('dotnet-modern');
  if (sawFramework) generationsPresent.push('dotnet-framework');

  // Coarse `name` (BC scalar, stays in enum): mixed → dotnet-modern (matches prior behavior).
  let name = 'dotnet-unknown';
  if (versions.length === 0 && signals.manifests.packagesConfig.length) { name = 'dotnet-framework'; if (!generationsPresent.includes('dotnet-framework')) generationsPresent.push('dotnet-framework'); }
  else if (sawModern) name = 'dotnet-modern';
  else if (sawFramework) name = 'dotnet-framework';
  const confidence = (sawFramework && sawModern) ? 0.8 : (sawModern || sawFramework) ? 0.9 : (versions.length || signals.manifests.packagesConfig.length ? 0.5 : 0.3);

  const evidence = versions.length
    ? `${versions.length} project(s); TFMs ${[...appTfms].join(', ') || 'none'}${heterogeneous ? ' (mixed)' : ''}`
    : (signals.manifests.packagesConfig.length ? 'packages.config (no csproj TFM)' : 'no TFM signal');

  return { name, confidence, evidence, version, versions, heterogeneous, generationsPresent, packages: signals.packages || {} };
}

// ── Canonical signal → stack_key table ──────────────────────────────────────────────────
// category ∈ language | backend | database | styling | frontend | apiclient | testing | always
// files/deps: signals (deps matched against the union set, lowercased). excludeDeps: negations.
// implies: capability keys emitted when this key matches (one level, deduped).
// requiresGeneration / excludeGeneration: gate on resolveGeneration(name).
const BACKEND_CAPS = ['backend-base', 'rest-api', 'auth', 'api-security', 'data-access', 'testing-backend', 'observability'];
const STACK_SIGNALS_TABLE = [
  { stack_key: 'project-rules', category: 'always', name: 'Project', always: true },

  // ── languages ──
  { stack_key: 'csharp-dotnet', category: 'language', name: 'C#', coarse: ['dotnet', 'csharp'],
    files: ['**/*.csproj', '**/*.sln', '**/*.slnx'], requiresGeneration: ['dotnet-modern'], implies: BACKEND_CAPS },
  { stack_key: 'csharp-framework48', category: 'language', name: 'C# (.NET Framework)', coarse: ['dotnet_framework', 'csharp'],
    files: ['**/*.csproj'], deps: ['microsoft.aspnet.mvc', 'microsoft.aspnet.webapi.core'], requiresGeneration: ['dotnet-framework'], implies: BACKEND_CAPS },
  { stack_key: 'csharp-vsto', category: 'language', name: 'VSTO', coarse: ['vsto', 'dotnet', 'csharp'],
    files: ['**/ThisAddIn.cs', '**/ThisWorkbook.cs', '**/ThisDocument.cs'], implies: BACKEND_CAPS },
  { stack_key: 'nodejs-typescript', category: 'language', name: 'Node.js', coarse: ['nodejs'],
    deps: ['express', 'fastify', 'hono', '@nestjs/core'], implies: BACKEND_CAPS },
  { stack_key: 'python', category: 'language', name: 'Python', coarse: ['python'],
    files: ['**/*.py', 'requirements.txt', 'pyproject.toml'], implies: BACKEND_CAPS },
  { stack_key: 'java', category: 'language', name: 'Java', coarse: ['java'],
    files: ['pom.xml', 'build.gradle', 'build.gradle.kts'], implies: BACKEND_CAPS },
  { stack_key: 'javascript', category: 'language', name: 'JavaScript', coarse: ['javascript'],
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'], excludeDeps: ['typescript'] },
  { stack_key: 'typescript', category: 'language', name: 'TypeScript', coarse: ['typescript'],
    files: ['tsconfig.json'], deps: ['typescript'] },

  // ── .NET data / legacy (generation-gated) ──
  { stack_key: 'ado-net-legacy', category: 'database', name: 'ADO.NET (legacy)',
    deps: ['system.data.sqlclient'], files: ['**/packages.config'], requiresGeneration: ['dotnet-framework'] },
  { stack_key: 'ef6', category: 'database', name: 'Entity Framework 6', deps: ['entityframework'], requiresGeneration: ['dotnet-framework'] },
  { stack_key: 'wcf', category: 'database', name: 'WCF', files: ['**/*.svc'], deps: ['system.servicemodel'], requiresGeneration: ['dotnet-framework'] },

  // ── database / infra (dep-gated, cross-stack) ──
  { stack_key: 'sql-relational', category: 'database', name: 'SQL', files: ['**/*.sql'],
    deps: ['mssql', 'pg', 'mysql2', 'npgsql', 'microsoft.data.sqlclient', 'psycopg2', 'asyncpg', 'pyodbc'] },
  { stack_key: 'sql-server', category: 'database', name: 'SQL Server', deps: ['mssql', 'microsoft.data.sqlclient', 'system.data.sqlclient', 'pyodbc', 'tedious'] },
  { stack_key: 'postgresql', category: 'database', name: 'PostgreSQL', deps: ['pg', 'npgsql', 'asyncpg', 'psycopg2', 'psycopg', '@neondatabase/serverless'] },
  { stack_key: 'nosql-document', category: 'database', name: 'NoSQL', deps: ['mongodb', 'mongoose', '@azure/cosmos', 'cosmosdb', 'dynamoose', '@aws-sdk/client-dynamodb'] },
  { stack_key: 'caching', category: 'database', name: 'Caching', deps: ['ioredis', 'redis', 'node-cache', 'django-redis', 'redis-py', 'microsoft.extensions.caching.stackexchangeredis', 'stackexchange.redis'] },
  { stack_key: 'prisma-drizzle', category: 'database', name: 'Prisma/Drizzle', deps: ['@prisma/client', 'drizzle-orm'] },

  // ── styling (frontend family) ──
  { stack_key: 'css', category: 'styling', name: 'CSS', files: ['**/*.css', '**/*.pcss'] },
  { stack_key: 'css-modules', category: 'styling', name: 'CSS Modules', files: ['**/*.module.css', '**/*.module.scss'] },
  { stack_key: 'sass', category: 'styling', name: 'Sass', deps: ['sass', 'node-sass', 'dart-sass'] },
  { stack_key: 'tailwind', category: 'styling', name: 'Tailwind', deps: ['tailwindcss'] },

  // ── frontend frameworks (dep-gated) ──
  { stack_key: 'angular', category: 'frontend', name: 'Angular', coarse: ['angular'], deps: ['@angular/core'] },
  { stack_key: 'react-ecosystem', category: 'frontend', name: 'React', coarse: ['react'], deps: ['react'], excludeDeps: ['next', '@remix-run/react'] },
  { stack_key: 'vue-ecosystem', category: 'frontend', name: 'Vue', deps: ['vue'] },
  { stack_key: 'svelte-ecosystem', category: 'frontend', name: 'Svelte', deps: ['svelte'] },
  { stack_key: 'solid-ecosystem', category: 'frontend', name: 'Solid', deps: ['solid-js'] },
  { stack_key: 'nextjs-ecosystem', category: 'frontend', name: 'Next.js', deps: ['next'] },
  { stack_key: 'nuxt-ecosystem', category: 'frontend', name: 'Nuxt', deps: ['nuxt'] },
  { stack_key: 'remix-ecosystem', category: 'frontend', name: 'Remix', deps: ['@remix-run/react'] },
  { stack_key: 'astro-ecosystem', category: 'frontend', name: 'Astro', deps: ['astro'] },

  // ── api clients / e2e ──
  { stack_key: 'graphql-client', category: 'apiclient', name: 'GraphQL client', deps: ['@apollo/client', 'graphql'] },
  { stack_key: 'graphql-server', category: 'apiclient', name: 'GraphQL server', deps: ['apollo-server-core', '@apollo/server', '@nestjs/graphql', 'strawberry-graphql', 'graphene'] },
  { stack_key: 'rest-client', category: 'apiclient', name: 'REST client', deps: ['react', 'vue', '@angular/core', 'svelte', 'solid-js', 'next', 'nuxt', 'astro'] },
  { stack_key: 'trpc', category: 'apiclient', name: 'tRPC', deps: ['@trpc/client', '@trpc/server'] },
  { stack_key: 'cypress', category: 'testing', name: 'Cypress', deps: ['cypress'] },
  { stack_key: 'playwright', category: 'testing', name: 'Playwright', deps: ['@playwright/test', 'playwright'] },
];

// Capability keys (implied only — never matched directly).
const CAPABILITY_KEYS = new Set(BACKEND_CAPS);

const BACKEND_ARCHETYPES = new Set(['DOTNET_API', 'ASPNET_MVC', 'ASPNET_FRAMEWORK', 'SPRING_BOOT', 'PYTHON_FASTAPI', 'PYTHON_DJANGO', 'PYTHON_FLASK', 'VSTO']);
const FRONTEND_CATEGORIES = new Set(['frontend', 'styling', 'apiclient']);

// glob (only * and ** as used in the table) → RegExp on a relative path
function globToRe(pattern) {
  const s = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.+/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp('(^|/)' + s + '$');
}

function fileHit(signals, globs) {
  const res = globs.map(globToRe);
  for (const rel of signals.files) if (res.some(re => re.test(rel))) return true;
  return false;
}
function depHit(signals, list) { return (list || []).some(d => signals.deps.has(d.toLowerCase())); }

// ── Pure scorer ─────────────────────────────────────────────────────────────────────────
// Returns { detection: {category: [entries]}, deployKeys: Set } — entries carry confidence.
function scoreStacks(signals, repoType, generations, opts) {
  const gen = generations || {};
  // Track-A feature flag (default OFF). When OFF the gate uses the single primary `g.name` — which
  // reproduces PRE-Track-A behavior exactly (a mixed repo drops framework rules, as before). When ON
  // the gate uses the per-project `generationsPresent` SET so a mixed repo deploys BOTH rule sets
  // (Track A then scopes their `paths`). This keeps flag-OFF byte-identical and avoids the mixed-repo
  // legacy-on-modern leak from an unconditional set-based gate.
  const perProjectRules = !!(opts && opts.perProjectRules);
  const emitted = new Map();   // stack_key → entry

  function scoreEntry(e) {
    if (e.always) return { conf: 1.0, evidence: ['always'] };
    let base = 0; const evidence = [];
    if (depHit(signals, e.deps)) { base = Math.max(base, 0.9); evidence.push('dependency'); }
    if (e.files && fileHit(signals, e.files)) { base = Math.max(base, 0.75); evidence.push('file'); }
    if (base === 0) return null;
    if (e.excludeDeps && depHit(signals, e.excludeDeps)) return null;   // hard negation
    // repoType agreement / conflict adjustment (coarse stack feeds confidence)
    let conf = base;
    if (FRONTEND_CATEGORIES.has(e.category) && BACKEND_ARCHETYPES.has(repoType)) conf -= 0.25;
    if (e.coarse && repoTypeCoarse(repoType).some(c => e.coarse.includes(c))) conf = Math.min(0.98, conf + 0.05);
    return { conf: Math.max(0, Math.min(1, conf)), evidence };
  }

  for (const e of STACK_SIGNALS_TABLE) {
    if (CAPABILITY_KEYS.has(e.stack_key)) continue;   // implied-only
    const s = scoreEntry(e);
    if (!s) continue;
    // generation gate — SET-based (P1-Shared): mixed repos expose `generationsPresent` (per-project
    // union) so BOTH framework and modern rule sets can deploy; falls back to [g.name] for stacks
    // without a spread. Only the 5 dotnet keys gate on generation; non-.NET is unaffected.
    const g = e.category === 'language' ? resolveGeneration(e.stack_key, signals) : genForStack(e, gen, signals);
    const gnames = g ? (perProjectRules && g.generationsPresent && g.generationsPresent.length ? g.generationsPresent : [g.name]) : [];
    if (e.requiresGeneration && !e.requiresGeneration.some(x => gnames.includes(x))) continue;
    if (e.excludeGeneration && e.excludeGeneration.some(x => gnames.includes(x))) continue;
    const entry = { name: e.name, stack_key: e.stack_key, category: e.category,
      confidence: round2(s.conf), evidence: s.evidence };
    if (g) entry.generation = g;
    emitted.set(e.stack_key, entry);
    // implies → capability keys at a fixed high confidence (backend bloc)
    for (const cap of (e.implies || [])) {
      if (!emitted.has(cap)) emitted.set(cap, { name: cap, stack_key: cap, category: 'backend', confidence: 0.9, evidence: ['implied:' + e.stack_key] });
    }
  }

  // group into categories
  const detection = { language: [], backend: [], database: [], styling: [], frontend: [], apiclient: [], testing: [], always: [] };
  for (const entry of emitted.values()) (detection[entry.category] = detection[entry.category] || []).push(entry);
  return { detection };
}

function genForStack(entry, generations, signals) {
  // .NET data/legacy keys gate on the dotnet language generation
  if (entry.requiresGeneration && entry.requiresGeneration.some(g => g.startsWith('dotnet'))) {
    return generations.dotnet || resolveDotnetGeneration(signals);
  }
  return null;
}

function repoTypeCoarse(repoType) {
  const map = {
    DOTNET_API: ['dotnet', 'csharp'], ASPNET_MVC: ['dotnet', 'csharp'], ASPNET_FRAMEWORK: ['dotnet_framework', 'csharp'],
    VSTO: ['vsto', 'dotnet', 'csharp'], SPRING_BOOT: ['java'], PYTHON_FASTAPI: ['python'], PYTHON_DJANGO: ['python'],
    PYTHON_FLASK: ['python'], ANGULAR_NX: ['angular'], ANGULAR_STANDARD: ['angular'], REACT: ['react'], JS_LIBRARY: ['javascript', 'typescript'],
  };
  return map[repoType] || [];
}

const round2 = n => Math.round(n * 100) / 100;

// Derive the legacy detected_stacks vocabulary (dotnet, dotnet_framework, angular, …) from the
// scored detection — union of `coarse` on emitted language/frontend keys.
function deriveDetectedStacks(detection) {
  const out = new Set();
  for (const cat of ['language', 'frontend']) for (const e of (detection[cat] || [])) {
    const tbl = STACK_SIGNALS_TABLE.find(t => t.stack_key === e.stack_key);
    for (const c of (tbl && tbl.coarse) || []) out.add(c);
  }
  return [...out];
}

module.exports = {
  STACK_SIGNALS_TABLE, PRUNE_DIRS, BACKEND_ARCHETYPES,
  gatherProjectSignals, resolveGeneration, resolveDotnetGeneration, resolveAllGenerations,
  scoreStacks, deriveDetectedStacks,
};
