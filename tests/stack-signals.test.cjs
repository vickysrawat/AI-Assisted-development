#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Regression tests for scripts/stack-signals.cjs — the scored detection
//                      engine. Builds throwaway project fixtures, runs gatherProjectSignals +
//                      resolveDotnetGeneration + scoreStacks, and asserts which stack_keys cross
//                      the 0.6 threshold, the .NET generation bucket, and deriveDetectedStacks.
// What it touches:     Creates + removes temp dirs under os.tmpdir(). Writes nothing to the repo.
// What it does NOT do: No network, no git, no state writes, no bootstrap invocation.
// APIs / commands:     Node stdlib fs, os, path; require('../scripts/stack-signals.cjs').
// How to verify:       node tests/stack-signals.test.cjs → exit 0 and "N passed · 0 failed".

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const S = require('../scripts/stack-signals.cjs');

let pass = 0, fail = 0;
function mk(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-'));
  for (const [rel, content] of Object.entries(files)) {
    const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content);
  }
  return root;
}
function deployedKeys(root, repoType, opts) {
  opts = opts || {};
  const t = opts.threshold == null ? 0.6 : opts.threshold;
  const sig = S.gatherProjectSignals(root);
  const gens = { dotnet: S.resolveDotnetGeneration(sig) };
  const { detection } = S.scoreStacks(sig, repoType, gens, { perProjectRules: !!opts.perProjectRules });
  const keys = new Set();
  for (const cat of Object.keys(detection)) for (const e of detection[cat]) if (e.confidence >= t) keys.add(e.stack_key);
  return { keys, detection, gen: gens.dotnet, stacks: S.deriveDetectedStacks(detection) };
}
function assert(name, cond) { cond ? (pass++, console.log('  ✓ ' + name)) : (fail++, console.log('  ✗ ' + name)); }

console.log('▶ stack-signals: scored detection');

// 1. .NET 10 API with vendored css/js → NO frontend/legacy rules
let r = mk({
  'src/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>',
  'src/Program.cs': 'var b=1;',
  'wwwroot/lib/bootstrap/bootstrap.css': 'a{}',
  'bin/Debug/site.js': 'x',
});
let d = deployedKeys(r, 'DOTNET_API');
assert('.NET10: csharp-dotnet deployed', d.keys.has('csharp-dotnet'));
assert('.NET10: css NOT deployed (vendored, pruned)', !d.keys.has('css'));
assert('.NET10: javascript NOT deployed (vendored, pruned)', !d.keys.has('javascript'));
assert('.NET10: ado-net-legacy NOT deployed (modern generation)', !d.keys.has('ado-net-legacy'));
assert('.NET10: csharp-framework48 NOT deployed', !d.keys.has('csharp-framework48'));
assert('.NET10: backend bloc implied', d.keys.has('backend-base') && d.keys.has('rest-api'));
assert('.NET10: generation = dotnet-modern', d.gen && d.gen.name === 'dotnet-modern');
assert('.NET10: detected_stacks legacy vocab', d.stacks.includes('dotnet') && d.stacks.includes('csharp'));
fs.rmSync(r, { recursive: true, force: true });

// 2. .NET Framework 4.7.2 → legacy rules deploy, csharp-dotnet does not
r = mk({
  'Web.csproj': '<Project><PropertyGroup><TargetFrameworkVersion>v4.7.2</TargetFrameworkVersion></PropertyGroup></Project>',
  'packages.config': '<packages><package id="EntityFramework" version="6.4.4"/></packages>',
});
d = deployedKeys(r, 'ASPNET_FRAMEWORK');
assert('.NET4: generation = dotnet-framework', d.gen && d.gen.name === 'dotnet-framework');
assert('.NET4: csharp-framework48 deployed', d.keys.has('csharp-framework48'));
assert('.NET4: ef6 deployed', d.keys.has('ef6'));
assert('.NET4: csharp-dotnet NOT deployed (requiresGeneration dotnet-modern absent)', !d.keys.has('csharp-dotnet'));
assert('.NET4: detected_stacks has dotnet_framework', d.stacks.includes('dotnet_framework'));
fs.rmSync(r, { recursive: true, force: true });

// 3. .slnx-only modern repo → csharp-dotnet
r = mk({ 'App.slnx': '<Solution/>', 'src/App.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>' });
d = deployedKeys(r, 'DOTNET_API');
assert('.slnx: csharp-dotnet deployed', d.keys.has('csharp-dotnet'));
fs.rmSync(r, { recursive: true, force: true });

// 4. Fullstack (.NET API + real react dep) → react deploys (survives conflict penalty)
r = mk({
  'src/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
  'client/package.json': JSON.stringify({ dependencies: { react: '18.0.0' } }),
});
d = deployedKeys(r, 'DOTNET_API');
assert('Fullstack: react-ecosystem deployed (real dep)', d.keys.has('react-ecosystem'));
assert('Fullstack: csharp-dotnet deployed', d.keys.has('csharp-dotnet'));
fs.rmSync(r, { recursive: true, force: true });

// 5. Node backend → javascript/typescript NOT suppressed (Node archetype)
r = mk({ 'package.json': JSON.stringify({ dependencies: { express: '4' }, devDependencies: { typescript: '5' } }), 'src/index.ts': 'const x=1', 'tsconfig.json': '{}' });
d = deployedKeys(r, 'JS_LIBRARY');
assert('Node: typescript deployed', d.keys.has('typescript'));
assert('Node: nodejs-typescript deployed', d.keys.has('nodejs-typescript'));
fs.rmSync(r, { recursive: true, force: true });

// 6. Generation resolver: missing manifest → low confidence
r = mk({ 'notes.txt': 'x' });
const genSig = S.gatherProjectSignals(r);
const g = S.resolveDotnetGeneration(genSig);
assert('Generation: no TFM → unknown/low confidence', g.name === 'dotnet-unknown' && g.confidence < 0.6);
fs.rmSync(r, { recursive: true, force: true });

// ── P1-Shared: per-project versions[] spread ──────────────────────────────────────────────

// 7. MIXED generation (modern web + framework WCF) → BOTH rule sets deploy (silent-drop fix)
r = mk({
  'src/Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>',
  'src/Legacy/Legacy.csproj': '<Project><PropertyGroup><TargetFrameworkVersion>v4.8</TargetFrameworkVersion></PropertyGroup></Project>',
  'src/Legacy/packages.config': '<packages><package id="EntityFramework" version="6.4.4"/></packages>',
});
// 7a. Flag ON (Track A) → BOTH rule sets deploy, each to be scoped by paths
d = deployedKeys(r, 'DOTNET_API', { perProjectRules: true });
assert('Mixed[ON]: csharp-dotnet deployed', d.keys.has('csharp-dotnet'));
assert('Mixed[ON]: csharp-framework48 deployed (no longer dropped)', d.keys.has('csharp-framework48'));
assert('Mixed[ON]: ef6 deployed (framework project present)', d.keys.has('ef6'));
assert('Mixed[ON]: generationsPresent has both', d.gen.generationsPresent.includes('dotnet-modern') && d.gen.generationsPresent.includes('dotnet-framework'));
assert('Mixed: heterogeneous flagged', d.gen.heterogeneous === true);
assert('Mixed: name = dotnet-modern (BC scalar)', d.gen.name === 'dotnet-modern');
assert('Mixed: primary version = net10.0 (deployable)', d.gen.version === 'net10.0');
// 7b. Flag OFF (default) → PRE-Track-A behavior preserved: framework rules NOT deployed (no leak)
const off = deployedKeys(r, 'DOTNET_API');
assert('Mixed[OFF]: csharp-dotnet deployed (primary modern)', off.keys.has('csharp-dotnet'));
assert('Mixed[OFF]: csharp-framework48 NOT deployed (old behavior, no legacy-on-modern leak)', !off.keys.has('csharp-framework48'));
assert('Mixed[OFF]: ef6 NOT deployed', !off.keys.has('ef6'));
fs.rmSync(r, { recursive: true, force: true });

// 8. Primary pick: web net10 + lib net9 + test net10 → primary net10; test excluded; roles correct
r = mk({
  'Web/Web.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>',
  'Lib/Lib.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net9.0</TargetFramework></PropertyGroup></Project>',
  'Tests/App.Tests.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup><ItemGroup><PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.0.0"/></ItemGroup></Project>',
});
let gen = deployedKeys(r, 'DOTNET_API').gen;
assert('Primary: version = net10.0 (highest deployable)', gen.version === 'net10.0');
assert('Primary: Web role=web', gen.versions.find(v => v.path === 'Web').role === 'web');
assert('Primary: Tests role=test', gen.versions.find(v => v.path === 'Tests').role === 'test');
assert('Primary: heterogeneous (net10 vs net9 app projects)', gen.heterogeneous === true);
fs.rmSync(r, { recursive: true, force: true });

// 9. Directory.Build.props inheritance: csproj with no TFM inherits the props TFM
r = mk({
  'Directory.Build.props': '<Project><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
  'Svc/Svc.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
});
gen = deployedKeys(r, 'DOTNET_API').gen;
assert('Props: inherited TFM net8.0', gen.versions[0].tfm === 'net8.0');
assert('Props: tfmSource=inherited', gen.versions[0].tfmSource === 'inherited');
fs.rmSync(r, { recursive: true, force: true });

// 10. global.json sdk-derived fallback (no TFM anywhere else)
r = mk({
  'global.json': JSON.stringify({ sdk: { version: '10.0.100' } }),
  'App/App.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
});
gen = deployedKeys(r, 'DOTNET_API').gen;
assert('global.json: sdk-derived net10.0', gen.versions[0].tfm === 'net10.0' && gen.versions[0].tfmSource === 'sdk-derived');
fs.rmSync(r, { recursive: true, force: true });

// 11. Multi-target Bridge net48;net8.0 → generations SET + tfms array (gap #8)
r = mk({ 'Bridge/Bridge.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFrameworks>net48;net8.0</TargetFrameworks></PropertyGroup></Project>' });
gen = deployedKeys(r, 'DOTNET_API').gen;
assert('Multi-target: tfms array', Array.isArray(gen.versions[0].tfms) && gen.versions[0].tfms.length === 2);
assert('Multi-target: generations SET has both', gen.versions[0].generations.includes('dotnet-framework') && gen.versions[0].generations.includes('dotnet-modern'));
fs.rmSync(r, { recursive: true, force: true });

// 12. Package versions: PackageReference Version + CPM Directory.Packages.props
r = mk({
  'Directory.Packages.props': '<Project><ItemGroup><PackageVersion Include="Serilog" Version="3.1.1"/></ItemGroup></Project>',
  'App/App.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup><ItemGroup><PackageReference Include="Microsoft.EntityFrameworkCore" Version="10.0.0"/><PackageReference Include="Serilog"/></ItemGroup></Project>',
});
gen = deployedKeys(r, 'DOTNET_API').gen;
assert('Packages: EF Core version captured', gen.packages['microsoft.entityframeworkcore'] === '10.0.0');
assert('Packages: CPM version merged for versionless ref', gen.packages['serilog'] === '3.1.1');
fs.rmSync(r, { recursive: true, force: true });

// 13. Sdk.Worker counts as deployable for the primary pick (gap: worker-only solution)
r = mk({ 'Worker/Worker.csproj': '<Project Sdk="Microsoft.NET.Sdk.Worker"><PropertyGroup><TargetFramework>net9.0</TargetFramework></PropertyGroup></Project>' });
gen = deployedKeys(r, 'DOTNET_API').gen;
assert('Worker: role=worker', gen.versions[0].role === 'worker');
assert('Worker: primary version = net9.0 (worker is deployable)', gen.version === 'net9.0');
fs.rmSync(r, { recursive: true, force: true });

console.log('\n  ' + pass + ' passed · ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
