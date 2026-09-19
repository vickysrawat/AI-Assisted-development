#!/usr/bin/env node
// external-stack-detection.cjs
// Detects stacks in additionalDirectories; writes external_detected_stacks
// and seeds external_stacks_prompted in .claude/dream-init-state.json.
// Zero external dependencies (fs + path only). Safe to re-run.
//
// Stack tokens written:
//   dotnet           — modern .NET Core / .NET 5+ / .NET 10
//   dotnet_framework — legacy .NET Framework 4.x (net[1-4] TFM; fallback: <Reference> to System.Web or System.ServiceModel)
//   vsto             — Visual Studio Tools for Office add-in or document customization
//   angular          — Angular app (angular.json present)
//   react            — React app (react in package.json dependencies)
//   nodejs           — Node.js server (express/fastify/hono/@nestjs/core in package.json)
//   java             — Maven or Gradle project (pom.xml or build.gradle present)
//   python           — Python project (pyproject.toml or requirements.txt present)
//
// dotnet and dotnet_framework are mutually exclusive — never both for the same repo.
// vsto always accompanies dotnet_framework (VSTO is always .NET Framework).

'use strict';
const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT   = process.cwd();
const LOCAL_SETTINGS = path.join(PROJECT_ROOT, '.claude', 'settings.local.json');
const STATE_FILE     = path.join(PROJECT_ROOT, '.claude', 'dream-init-state.json');

// Recursive file finder — replaces glob; no node_modules needed in plugin cache
function findFiles(dir, predicate, maxDepth, depth) {
  if (maxDepth === undefined) maxDepth = 5;
  if (depth === undefined) depth = 0;
  if (depth > maxDepth) return [];
  const results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(e) { return []; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'bin' || e.name === 'obj') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push.apply(results, findFiles(full, predicate, maxDepth, depth + 1));
    } else if (e.isFile() && predicate(e.name)) {
      results.push(full);
    }
  }
  return results;
}

function fileExists(p) {
  try { fs.accessSync(p); return true; } catch(e) { return false; }
}

// Read additionalDirectories from settings.local.json
var local = {};
try { local = JSON.parse(fs.readFileSync(LOCAL_SETTINGS, 'utf8')); } catch(e) {}
var externalDirs = (local.additionalDirectories || []).filter(function(d) { return fileExists(d); });

if (!externalDirs.length) {
  writeState([]);
  console.log('external_detected_stacks: [] (no additionalDirectories found or accessible)');
  process.exit(0);
}

var stacks = {};  // use object as Set for compatibility

for (var i = 0; i < externalDirs.length; i++) {
  var dir = externalDirs[i];

  // .NET — scan csproj files once, reuse for both checks
  var csprojFiles = findFiles(dir, function(n) { return n.endsWith('.csproj'); });
  // Extension-tolerant: .sln AND .slnx (the XML solution format).
  var hasSln = findFiles(dir, function(n) { return n.endsWith('.sln') || n.endsWith('.slnx'); }, 1).length > 0;

  if (csprojFiles.length || hasSln) {
    // VSTO: Microsoft.Office.Tools / Interop, VSTO project GUID, or TargetApplication element.
    // VSTO is always .NET Framework — force dotnet_framework regardless of System.Web absence.
    var isVsto = csprojFiles.some(function(f) {
      try {
        var c = fs.readFileSync(f, 'utf8');
        return c.indexOf('Microsoft.Office.Tools') !== -1 ||
               c.indexOf('Microsoft.Office.Interop') !== -1 ||
               c.indexOf('BAA0C2D2') !== -1 ||         // VSTO project type GUID
               c.indexOf('<TargetApplication>') !== -1; // document-level customization
      } catch(e) { return false; }
    });
    if (isVsto) {
      stacks['vsto'] = true;
      stacks['dotnet_framework'] = true; // VSTO is always .NET Framework
    } else {
      // dotnet vs dotnet_framework — mutually exclusive, never add both.
      // Step 1: TFM-first — read the target project's own version declaration.
      //   Modern : net\d+. (e.g. net8.0, net10.0), netstandard, netcoreapp
      //   Framework: net[1-4] without a dot (e.g. net48, net472)
      // TargetFrameworks (plural) may list multiple TFMs; prefer modern if any is modern.
      var modernTfmRe    = /^(net\d+\.|netstandard|netcoreapp)/;
      var frameworkTfmRe = /^net[1-4]/;
      var tfmRe          = /<TargetFrameworks?>([\s\S]*?)<\/TargetFrameworks?>/;
      var dotnetToken    = 'dotnet'; // default to modern
      var tfmFound       = false;

      for (var fi = 0; fi < csprojFiles.length && !tfmFound; fi++) {
        try {
          var cContent = fs.readFileSync(csprojFiles[fi], 'utf8');
          var tfmMatch = cContent.match(tfmRe);
          if (tfmMatch) {
            tfmFound = true;
            var tfms = tfmMatch[1].split(';').map(function(t) { return t.trim(); });
            if (tfms.some(function(t) { return modernTfmRe.test(t); })) {
              dotnetToken = 'dotnet';
            } else if (tfms.some(function(t) { return frameworkTfmRe.test(t); })) {
              dotnetToken = 'dotnet_framework';
            }
          }
        } catch(e) {}
      }

      if (!tfmFound) {
        // Step 2: no TargetFramework element found — fall back to reference-name heuristic,
        // scoped to <Reference> (GAC, Framework-only) not <PackageReference> (NuGet).
        var frameworkRefRe = /<Reference\s[^>]*Include="System\.(Web|ServiceModel)[^"]*"/;
        var isFramework = csprojFiles.some(function(f) {
          try {
            var fc = fs.readFileSync(f, 'utf8');
            return frameworkRefRe.test(fc);
          } catch(e) { return false; }
        });
        dotnetToken = isFramework ? 'dotnet_framework' : 'dotnet';
      }

      stacks[dotnetToken] = true;
    }
  }

  // Java: Maven or Gradle
  if (findFiles(dir, function(n) { return n === 'pom.xml'; }).length ||
      findFiles(dir, function(n) { return n === 'build.gradle'; }).length) {
    stacks['java'] = true;
  }

  // Python
  if (fileExists(path.join(dir, 'pyproject.toml')) ||
      fileExists(path.join(dir, 'requirements.txt'))) {
    stacks['python'] = true;
  }

  // Angular: angular.json at root or one level deep
  if (fileExists(path.join(dir, 'angular.json')) ||
      findFiles(dir, function(n) { return n === 'angular.json'; }, 2).length) {
    stacks['angular'] = true;
  }

  // Node.js + React: read package.json once; each check uses its own authoritative dep key(s).
  var pkgPath = path.join(dir, 'package.json');
  if (fileExists(pkgPath)) {
    try {
      var pkg  = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      var deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
      var nodeFrameworks = ['express', 'fastify', 'hono', '@nestjs/core'];
      if (nodeFrameworks.some(function(d) { return d in deps; })) {
        stacks['nodejs'] = true;
      }
      if ('react' in deps) {
        stacks['react'] = true;
      }
    } catch(e) {}
  }
}

var result = Object.keys(stacks);
writeState(result);
console.log('external_detected_stacks: [' + (result.join(', ') || 'none') + ']');

function writeState(detected) {
  var state = {};
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch(e) {}
  state.external_detected_stacks = detected;
  // Preserve existing true; initialise to false if absent — never reset a true flag
  if (state.external_stacks_prompted !== true) state.external_stacks_prompted = false;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}
