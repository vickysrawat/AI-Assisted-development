#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Integration test for stepDeployRules — runs the REAL bootstrap
//                      (--mode post-detect) against a temp fixture project whose
//                      dream-init-state.json carries a pre-seeded scored `detection`, then
//                      asserts .claude/rules/ contents, _deploy-manifest.json, .hashes, and
//                      developer-edit protection (edited rule warned+skipped, not clobbered).
// What it touches:     Creates + removes temp dirs under os.tmpdir(); runs the bootstrap with
//                      cwd = the temp fixture (bootstrap writes only inside that fixture).
//                      Writes nothing to the plugin repo.
// What it does NOT do: No network, no git, no writes outside the temp fixture.
// APIs / commands:     Node stdlib fs, os, path; child_process.spawnSync('node', [bootstrap]).
// How to verify:       node tests/rule-deploy.test.cjs → exit 0 and "N passed · 0 failed".

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const BOOT = path.join(__dirname, '..', 'scripts', 'setup-init-bootstrap.cjs');
let pass = 0, fail = 0;
function assert(name, cond) { cond ? (pass++, console.log('  ✓ ' + name)) : (fail++, console.log('  ✗ ' + name)); }

// Fixture: a .NET-10 API detection (csharp-dotnet high + backend bloc; NO css/js).
const detection = {
  language: [{ name: 'C#', stack_key: 'csharp-dotnet', category: 'language', confidence: 0.8,
    evidence: ['file'], generation: { name: 'dotnet-modern', confidence: 0.9, evidence: 'net10.0' } }],
  backend: ['backend-base', 'rest-api', 'auth', 'api-security', 'data-access', 'testing-backend', 'observability']
    .map(k => ({ name: k, stack_key: k, category: 'backend', confidence: 0.9, evidence: ['implied'] })),
  database: [], styling: [], frontend: [], apiclient: [], testing: [], always: [],
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-'));
fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
fs.writeFileSync(path.join(root, '.claude', 'dream-init-state.json'),
  JSON.stringify({ repo_type: 'DOTNET_API', detected_stacks: ['dotnet', 'csharp'], detection }, null, 2));

function runDeploy() {
  return spawnSync('node', [BOOT, '--mode', 'post-detect', '--repo-type', 'DOTNET_API'],
    { cwd: root, encoding: 'utf8' });
}
const rulesDir = path.join(root, '.claude', 'rules');
const has = f => fs.existsSync(path.join(rulesDir, f));

// ── First deploy ──
runDeploy();
assert('project-rules deployed', has('project-rules.md'));
assert('csharp-dotnet deployed', has('csharp-dotnet-rules.md'));
assert('backend bloc deployed (rest-api)', has('rest-api-rules.md'));
assert('css NOT deployed', !has('css-rules.md'));
assert('javascript NOT deployed', !has('javascript-rules.md'));
assert('ado-net-legacy NOT deployed', !has('ado-net-legacy-rules.md'));
assert('.hashes written', fs.existsSync(path.join(rulesDir, '.hashes')));
let man = {};
try { man = JSON.parse(fs.readFileSync(path.join(rulesDir, '_deploy-manifest.json'), 'utf8')); } catch (e) {}
assert('manifest lists csharp-dotnet', (man.stack_keys || []).includes('csharp-dotnet'));
assert('manifest records threshold', man.threshold === 0.6);
assert('deployed_rules[] persisted in state', (() => {
  try { return JSON.parse(fs.readFileSync(path.join(root, '.claude', 'dream-init-state.json'), 'utf8')).deployed_rules.includes('csharp-dotnet-rules.md'); } catch (e) { return false; }
})());

// ── Developer-edit protection: modify a deployed rule, re-run → warn + skip, not clobbered ──
const edited = path.join(rulesDir, 'csharp-dotnet-rules.md');
fs.writeFileSync(edited, '--- DEVELOPER EDIT ---\n');
const r2 = runDeploy();
const stillEdited = fs.readFileSync(edited, 'utf8').startsWith('--- DEVELOPER EDIT ---');
assert('developer-edited rule NOT clobbered on re-deploy', stillEdited);
assert('re-deploy reported a protected/customised rule', /customised|protected/i.test(r2.stdout + r2.stderr));

fs.rmSync(root, { recursive: true, force: true });

// ── Track-A: per-project scope-by-exception deploy (feature-flagged) ──────────────────────
// Mixed repo: modern csharp-dotnet (broad, verbatim) + framework csharp-framework48/ef6 scoped
// to the framework project dir. Fixture pre-seeds detection (both rule sets) + generations spread.
const mixedDetection = {
  language: [
    { name: 'C#', stack_key: 'csharp-dotnet', category: 'language', confidence: 0.8, evidence: ['file'] },
    { name: 'C# (.NET Framework)', stack_key: 'csharp-framework48', category: 'language', confidence: 0.8, evidence: ['file'] },
  ],
  backend: [{ name: 'backend-base', stack_key: 'backend-base', category: 'backend', confidence: 0.9, evidence: ['implied'] }],
  database: [{ name: 'Entity Framework 6', stack_key: 'ef6', category: 'database', confidence: 0.9, evidence: ['dependency'] }],
  styling: [], frontend: [], apiclient: [], testing: [], always: [],
};
const mixedGenerations = { dotnet: { name: 'dotnet-modern', confidence: 0.8, evidence: 'mixed', version: 'net10.0',
  heterogeneous: true, generationsPresent: ['dotnet-modern', 'dotnet-framework'],
  versions: [
    { path: 'src/Api', role: 'web', tfm: 'net10.0', generation: 'dotnet-modern' },
    { path: 'src/Legacy', role: 'lib', tfm: 'v4.8', generation: 'dotnet-framework' },
  ] } };

const root2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-pp-'));
fs.mkdirSync(path.join(root2, '.claude'), { recursive: true });
fs.writeFileSync(path.join(root2, '.claude', 'dream-init-state.json'),
  JSON.stringify({ repo_type: 'DOTNET_API', detected_stacks: ['dotnet', 'dotnet_framework', 'csharp'],
    per_project_rules: true, detection: mixedDetection, generations: mixedGenerations }, null, 2));
const rd2 = path.join(root2, '.claude', 'rules');
const read2 = f => { try { return fs.readFileSync(path.join(rd2, f), 'utf8'); } catch (e) { return ''; } };
function runDeploy2(env) {
  return spawnSync('node', [BOOT, '--mode', 'post-detect', '--repo-type', 'DOTNET_API'],
    { cwd: root2, encoding: 'utf8', env: { ...process.env, ...(env || {}) } });
}

// ON (flag from state.per_project_rules:true)
runDeploy2();
const fwText = read2('csharp-framework48-rules.md');
const fmPaths = (fwText.match(/^paths:\s*(.+)$/m) || [])[1] || '';
assert('PP: framework rule deployed', !!fwText);
assert('PP: framework rule paths scoped to framework dir', fmPaths.includes('src/Legacy/**') && !fmPaths.includes('**/*.cs'));
assert('PP: modern csharp-dotnet deployed VERBATIM (broad, not scoped)', (() => {
  const src = fs.readFileSync(path.join(__dirname, '..', '_project-deploy', 'rules', 'csharp-dotnet-rules.md'), 'utf8');
  return read2('csharp-dotnet-rules.md') === src;   // byte-identical to source (not rewritten)
})());
let man2 = {}; try { man2 = JSON.parse(read2('_deploy-manifest.json')); } catch (e) {}
assert('PP: manifest mode = per-project', man2.mode === 'per-project');
assert('PP: manifest records scoped_paths', man2.scoped_paths && Array.isArray(man2.scoped_paths['csharp-framework48-rules.md']));

// Re-deploy → scoped framework rule NOT re-flagged as developer-edited (body-hash stable / re-baseline)
const rr = runDeploy2();
assert('PP: re-deploy does not flag scoped rule as edited', !/csharp-framework48.*customised/i.test(rr.stdout + rr.stderr));
assert('PP: scoped paths still present after re-deploy', read2('csharp-framework48-rules.md').includes('src/Legacy/**'));

// Developer edits the BODY of the scoped rule → protected (body preserved)
const fwFile = path.join(rd2, 'csharp-framework48-rules.md');
fs.writeFileSync(fwFile, fwText.replace(/\n---\n/, '\n---\n<!-- DEV BODY EDIT -->\n'));
const rr2 = runDeploy2();
assert('PP: developer BODY edit protected', fs.readFileSync(fwFile, 'utf8').includes('<!-- DEV BODY EDIT -->'));

// Dry-run → no scoped write, plan printed
fs.rmSync(rd2, { recursive: true, force: true });
const dry = runDeploy2({ PER_PROJECT_RULES_DRYRUN: '1' });
assert('PP: dry-run prints plan', /DRY-RUN/i.test(dry.stdout));
assert('PP: dry-run wrote NO scoped framework rule', !fs.existsSync(fwFile));

// Flag OFF (per_project_rules:false) → scoped path NOT applied (byte-identical/off-path)
fs.rmSync(rd2, { recursive: true, force: true });
fs.writeFileSync(path.join(root2, '.claude', 'dream-init-state.json'),
  JSON.stringify({ repo_type: 'DOTNET_API', detected_stacks: ['dotnet', 'dotnet_framework', 'csharp'],
    per_project_rules: false, detection: mixedDetection, generations: mixedGenerations }, null, 2));
runDeploy2();
const offFw = read2('csharp-framework48-rules.md');
assert('OFF: framework rule (if deployed) NOT scoped — verbatim source', (() => {
  if (!offFw) return true;   // not deployed at all is also fine (off-path)
  const src = fs.readFileSync(path.join(__dirname, '..', '_project-deploy', 'rules', 'csharp-framework48-rules.md'), 'utf8');
  return offFw === src;
})());
fs.rmSync(root2, { recursive: true, force: true });

console.log('\n  ' + pass + ' passed · ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
