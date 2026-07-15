#!/usr/bin/env node
// external-stack-detection.cjs
// Detects stacks in additionalDirectories; writes external_detected_stacks
// and seeds external_stacks_prompted in .claude/dream-init-state.json.
// Zero external dependencies (fs + path only). Safe to re-run.
//
// Stack tokens written:
//   dotnet           — modern .NET Core / .NET 5+ / .NET 10
//   dotnet_framework — legacy .NET Framework 4.x (System.Web or System.ServiceModel)
//   angular          — Angular app (angular.json present)
//   nodejs           — Node.js server (express/fastify/hono/@nestjs/core in package.json)
//   java             — Maven or Gradle project
//   python           — pyproject.toml or requirements.txt present
//
// dotnet and dotnet_framework are mutually exclusive — never both for the same repo.

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
  var hasSln = findFiles(dir, function(n) { return n.endsWith('.sln'); }, 1).length > 0;

  if (csprojFiles.length || hasSln) {
    // dotnet_framework: System.Web (MVC/WebForms) OR System.ServiceModel (WCF)
    // dotnet: modern .NET Core / .NET 5+ / .NET 10
    // Mutually exclusive — never add both.
    var isFramework = csprojFiles.some(function(f) {
      try {
        var c = fs.readFileSync(f, 'utf8');
        return c.indexOf('System.Web') !== -1 || c.indexOf('System.ServiceModel') !== -1;
      } catch(e) { return false; }
    });
    stacks[isFramework ? 'dotnet_framework' : 'dotnet'] = true;
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

  // Node.js: package.json with known server framework dependency
  var pkgPath = path.join(dir, 'package.json');
  if (fileExists(pkgPath)) {
    try {
      var pkg  = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      var deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
      var nodeFrameworks = ['express', 'fastify', 'hono', '@nestjs/core'];
      if (nodeFrameworks.some(function(d) { return d in deps; })) {
        stacks['nodejs'] = true;
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
