#!/usr/bin/env node
/**
 * ai-assisted-development plugin — structural validator
 * Tests everything that can be verified without an API key.
 *
 * Usage:
 *   node tests/validate.js              # full structural validation
 *   node tests/validate.js --verbose    # show detail on every check
 *   node tests/validate.js --fix        # report fixable issues with instructions
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const FIX     = process.argv.includes('--fix');

let pass = 0, fail = 0, warn = 0;
const issues = [];

function ok(label)        { pass++; if (VERBOSE) console.log(`  ✓ ${label}`); }
function bad(label, fix)  { fail++; issues.push({ label, fix }); console.log(`  ✗ ${label}`); if (FIX && fix) console.log(`    → Fix: ${fix}`); }
function advisory(label)  { warn++; console.log(`  ⚠ ${label}`); }

function exists(rel)      { return fs.existsSync(path.join(ROOT, rel)); }
function read(rel)        { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function readJson(rel)    { return JSON.parse(read(rel)); }

// ── 1. Plugin manifest ────────────────────────────────────────────────────────
console.log('\n▶ Plugin manifest (.claude-plugin/plugin.json)');
if (!exists('.claude-plugin/plugin.json')) {
  bad('plugin.json exists', 'Create .claude-plugin/plugin.json');
} else {
  const p = readJson('.claude-plugin/plugin.json');
  p.version ? ok(`version: ${p.version}`) : bad('version field present');
  p.name    ? ok(`name: ${p.name}`)       : bad('name field present');

  const cmds = p.components?.commands || [];
  const EXPECTED_COMMANDS = [
    'dream','dream-health','setup-init','setup-status','setup-sync','setup-teardown','dream-rollback',
    'session-start','bug','checkin','update-arch','explain','fix',
    'code-review','security-review','token-analysis','sprint-metrics','product-docs',
    'knowledge-freshness'
  ];
  EXPECTED_COMMANDS.forEach(c => {
    cmds.includes(c) ? ok(`command registered: ${c}`) : bad(`command registered: ${c}`, `Add "${c}" to components.commands in plugin.json`);
  });

  const shared = p.components?.shared || [];
  shared.includes('business-context-severity')
    ? ok('shared: business-context-severity registered')
    : bad('shared: business-context-severity registered', 'Add "business-context-severity" to components.shared');

  p.recommended_models?.generation ? ok('recommended_models.generation set') : bad('recommended_models.generation set');
  p.recommended_models?.review     ? ok('recommended_models.review set')     : bad('recommended_models.review set');
  p.recommended_models?.infrastructure ? ok('recommended_models.infrastructure set') : bad('recommended_models.infrastructure set', 'Add infrastructure field to recommended_models in plugin.json');
  p.recommended_models?.last_reviewed ? ok(`model last_reviewed: ${p.recommended_models.last_reviewed}`) : bad('recommended_models.last_reviewed set');
}

// ── 2. Command files ──────────────────────────────────────────────────────────
console.log('\n▶ Command files (commands/)');
const COMMANDS = [
  'dream','dream-health','setup-init','setup-status','setup-sync','setup-teardown','dream-rollback',
  'session-start','bug','checkin','update-arch','explain','fix',
  'code-review','security-review','token-analysis','sprint-metrics','product-docs'
];
COMMANDS.forEach(c => {
  const rel = `commands/${c}.md`;
  if (!exists(rel)) { bad(`commands/${c}.md exists`, `Create commands/${c}.md`); return; }
  const content = read(rel);

  // Must have frontmatter
  content.startsWith('---') ? ok(`${c}: has frontmatter`) : bad(`${c}: has frontmatter`);

  // Must have description in frontmatter
  content.includes('description:') ? ok(`${c}: has description`) : bad(`${c}: has description in frontmatter`);

  // code-review and security-review are now thin commands → their skills own scope + announce
  // (Step 0 + scope-flags-spec.md) and, for code-review, Phase D. Each just asserts delegation;
  // the scope-flag / Phase D / three-pass contracts are validated in the skills + shared specs.
  if (c === 'code-review') {
    content.includes('skills/code-review/SKILL.md')
      ? ok('code-review: delegates to the code-review skill')
      : bad('code-review: missing code-review-skill delegation');
  }
  if (c === 'security-review') {
    content.includes('skills/security/SKILL.md')
      ? ok('security-review: delegates to the security skill')
      : bad('security-review: missing security-skill delegation');
  }
});

// ── 3. Command stubs ──────────────────────────────────────────────────────────
console.log('\n▶ Command stubs (_project-deploy/commands/)');
COMMANDS.forEach(c => {
  exists(`_project-deploy/commands/${c}.md`)
    ? ok(`stub: ${c}.md`)
    : bad(`stub: ${c}.md missing`, `Create _project-deploy/commands/${c}.md`);
});

// ── 4. Shared specs ───────────────────────────────────────────────────────────
console.log('\n▶ Shared specs (skills/shared/)');
const SHARED = [
  'file-cache-schema.md',
  'scope-flags-spec.md',
  'flag-prompt-spec.md',
  'interactive-menu-spec.md',
  // domain-map-spec.md was retired in v3.0.0 (ADR 0038) — validate.py check 9 errors if it exists
  'single-writer-assumption.md',
  'model-routing-spec.md',
  'runtime-generation-spec.md',
  'business-context-severity.md',
  'business-context-presets.md',
  'business-context-grounding.md',
  'business-context-generation.md',
  'source-file-consent.md',
];
SHARED.forEach(f => {
  exists(`skills/shared/${f}`) ? ok(`shared/${f}`) : bad(`shared/${f} missing`);
});

// Scope flags spec must include --ci and canonical find command
if (exists('skills/shared/scope-flags-spec.md')) {
  const s = read('skills/shared/scope-flags-spec.md');
  s.includes('--ci')          ? ok('scope-flags-spec: --ci flag defined')    : bad('scope-flags-spec: --ci missing');
  s.includes('--area')         ? ok('scope-flags-spec: --area flag defined')  : bad('scope-flags-spec: --area flag missing');
  s.includes('--continue')     ? ok('scope-flags-spec: --continue flag defined') : bad('scope-flags-spec: --continue flag missing');
  // FILE_BUDGET / 40-file cap was removed in 3.6.0 — spec must not reference it
  !s.includes('FILE_BUDGET') && !s.includes('40 file')
    ? ok('scope-flags-spec: no stale FILE_BUDGET / 40-file cap (removed 3.6.0)')
    : bad('scope-flags-spec: still references removed FILE_BUDGET or 40-file cap — update scope-flags-spec.md');
  s.includes('find .')        ? ok('scope-flags-spec: canonical find command present') : bad('scope-flags-spec: canonical find command missing');
  // v3.24.0: the (none) case must route to the interactive menu (not a bare silent default),
  // and must carry the CI / non-interactive carve-out — this is the contradiction the release fixed.
  /interactive( scope)? menu/i.test(s)
    ? ok('scope-flags-spec: no-flag routes to the interactive menu')
    : bad('scope-flags-spec: (none) still describes a silent default — must route to the interactive menu (v3.24.0)');
  /CI|non-interactive/i.test(s)
    ? ok('scope-flags-spec: CI / non-interactive carve-out present')
    : bad('scope-flags-spec: missing CI / non-interactive carve-out for the no-flag case (v3.24.0)');
}

// v3.24.0: universal no-flag prompt convention + scan-menu CI carve-out
if (exists('skills/shared/flag-prompt-spec.md')) {
  const fp = read('skills/shared/flag-prompt-spec.md');
  /AskUserQuestion/.test(fp) ? ok('flag-prompt-spec: names AskUserQuestion') : bad('flag-prompt-spec: should reference AskUserQuestion');
  /CI|non-interactive/i.test(fp) ? ok('flag-prompt-spec: CI / non-interactive skip rule present') : bad('flag-prompt-spec: missing CI / non-interactive skip rule');
}
if (exists('skills/shared/interactive-menu-spec.md')) {
  const im = read('skills/shared/interactive-menu-spec.md');
  /CI|non-interactive/i.test(im) ? ok('interactive-menu-spec: CI / non-interactive fallback present') : bad('interactive-menu-spec: missing CI / non-interactive fallback (v3.24.0)');
}

// Business context spec is domain-neutral (v2.0): a variable-length B-series, not a fixed
// B1-B7. Assert the model is intact (floor principle + a B-series with at least B1) and the
// project-local resolution pointer. The verbatim legal B1-B7 now lives in the presets file.
if (exists('skills/shared/business-context-severity.md')) {
  const b = read('skills/shared/business-context-severity.md');
  b.includes('B1') ? ok('business-context-severity: B-series defined (B1 present)') : bad('business-context-severity: B-series missing (no B1)');
  /B-?series/i.test(b) ? ok('business-context-severity: B-series framing present') : bad('business-context-severity: B-series framing missing');
  (b.includes('floor, not a ceiling') || b.includes('floors, not ceilings')) ? ok('business-context-severity: floor principle stated') : bad('business-context-severity: floor principle missing');
  b.includes('.claude/business-context.md') ? ok('business-context-severity: project-local resolution pointer present') : bad('business-context-severity: project-local resolution pointer missing');
}

// The verbatim-locked `legal` preset must preserve the original B1-B7 (regression safety).
if (exists('skills/shared/business-context-presets.md')) {
  const p = read('skills/shared/business-context-presets.md');
  ['B1','B2','B3','B4','B5','B6','B7'].forEach(t => {
    p.includes(t) ? ok(`business-context-presets: legal ${t} preserved`) : bad(`business-context-presets: legal ${t} missing (regression)`);
  });
  /verbatim-locked/i.test(p) ? ok('business-context-presets: legal marked verbatim-locked') : bad('business-context-presets: legal not marked verbatim-locked');
}

// Tech-stack detection must be aware of the .slnx (XML) solution format across every mirror
// of the .NET detection ladder — repo-detect.cjs, external-stack-detection.cjs, and the two
// architect Step-1 bash ladders. Removing .slnx from any one re-opens the exit-3 gap on a
// modern .NET repo. (Guards ADR modern-format resilience; regression fixture: tests/repo-detect.test.cjs.)
[
  'scripts/repo-detect.cjs',
  'scripts/external-stack-detection.cjs',
  'skills/architect/SKILL.md',
].forEach(f => {
  if (!exists(f)) { bad(`slnx-detect: ${f} missing`); return; }
  read(f).includes('.slnx')
    ? ok(`slnx-detect: ${f} is .slnx-aware`)
    : bad(`slnx-detect: ${f} missing .slnx awareness — modern .NET solution format will fail detection`);
});
// repo-detect.cjs must carry the graceful .cs fallback (unknown packaging → DOTNET_API).
if (exists('scripts/repo-detect.cjs')) {
  read('scripts/repo-detect.cjs').includes("anyFileDeep('.cs')")
    ? ok('slnx-detect: repo-detect.cjs has graceful .cs fallback')
    : bad('slnx-detect: repo-detect.cjs missing graceful .cs fallback for unknown packaging formats');
}

// Family-shared, stack-neutral source detection (ADR 0060, superseded by the migration-family split):
// the detector must exist and wrap repo-detect (engine borrowed, interface owned); the migration-family
// skills (upgrade/rewrite/replatform) call it instead of inline probes; the checkpoint documents the
// multi-root source_roots. Regression: tests/migration-source-detect.test.cjs.
if (exists('scripts/migration-source-detect.cjs')) {
  ok('migration-source-detect: scripts/migration-source-detect.cjs exists');
  read('scripts/migration-source-detect.cjs').includes('repo-detect.cjs')
    ? ok('migration-source-detect: wraps repo-detect.cjs (engine borrowed, interface owned)')
    : bad('migration-source-detect: must wrap repo-detect.cjs, not re-implement detection');
} else bad('migration-source-detect: scripts/migration-source-detect.cjs missing');
['skills/upgrade/SKILL.md', 'skills/rewrite/SKILL.md', 'skills/replatform/SKILL.md'].every(f => exists(f) && read(f).includes('migration-source-detect.cjs'))
  ? ok('migration-source-detect: called by upgrade/rewrite/replatform (family-shared detector)')
  : bad('migration-source-detect: a migration-family skill (upgrade/rewrite/replatform) does not call the detector');
exists('skills/shared/checkpoint-schema.md') && read('skills/shared/checkpoint-schema.md').includes('source_roots')
  ? ok('migration-source-detect: checkpoint documents source_roots (multi-root)')
  : bad('migration-source-detect: checkpoint-schema missing source_roots');

// ── 5. Skills ─────────────────────────────────────────────────────────────────
console.log('\n▶ Skills (skills/*/SKILL.md)');
const SKILLS = [
  'icea-feature','icea-review','architect','code-review','security',
  'pr-create','pr-describe','pr-spec-review','ado-tasks','sprint-metrics',
  'setup-status','setup-sync','setup-teardown','dream-rollback','token-analysis','product-docs',
  'app-readiness','plugin-readiness',
  'knowledge-freshness',
];
SKILLS.forEach(s => {
  const rel = `skills/${s}/SKILL.md`;
  if (!exists(rel)) { bad(`skills/${s}/SKILL.md exists`); return; }
  ok(`skills/${s}/SKILL.md exists`);
  const content = read(rel);

  // All skills must have YAML frontmatter with name and description
  if (!content.startsWith('---')) { bad(`${s}: has YAML frontmatter`); }

  // Review skills must reference source-file-consent
  if (['pr-spec-review'].includes(s)) {
    content.includes('source-file-consent')
      ? ok(`${s}: references source-file-consent spec`)
      : bad(`${s}: missing source-file-consent reference`);
  }

  // Review skills must reference business-context-severity
  if (['code-review','security','pr-spec-review'].includes(s)) {
    content.includes('business-context-severity')
      ? ok(`${s}: references business-context-severity`)
      : bad(`${s}: missing business-context-severity reference`, `Add business context override check to ${s}/SKILL.md`);
  }
});

// New reference files must exist
['domain-guidance.md','output-formats.md','cross-cutting-principles.md'].forEach(f => {
  exists(`skills/security/references/${f}`)
    ? ok(`security/references/${f} exists`)
    : bad(`security/references/${f} missing`, `Extract section from SKILL.md`);
});
['checkers.md','output-format.md','analysis-rules.md'].forEach(f => {
  exists(`skills/code-review/references/${f}`)
    ? ok(`code-review/references/${f} exists`)
    : bad(`code-review/references/${f} missing`);
});

// Security skill specific checks
if (exists('skills/security/SKILL.md')) {
  const sec = read('skills/security/SKILL.md');
  sec.includes('Static Asset Audit')
    ? ok('security: static asset audit pre-scan present')
    : bad('security: static asset audit pre-scan missing');
  /skip cache entirely|ignore cache/i.test(sec)
    ? ok('security: --full cache bypass is explicit')
    : bad('security: --full cache bypass instruction not explicit enough');
  // FILE_BUDGET was removed in 3.6.0 — its presence is now an error
  !sec.includes('FILE_BUDGET')
    ? ok('security: FILE_BUDGET removed (no file cap since 3.6.0)')
    : bad('security: FILE_BUDGET still present — budget cap was removed in 3.6.0');
  // Adversarial / free-flow pass (Pass 3 in the three-pass architecture, v2.0)
  /Free-Flow Adversarial|Pass 3/i.test(sec)
    ? ok('security: adversarial pass (Pass 3) present')
    : bad('security: adversarial pass (Pass 3) missing');
  sec.includes('priority')
    ? ok('security: priority ordering present')
    : bad('security: priority file ordering missing');
  // Check find command itself - warning prose mentioning 'find ./src' is intentional
  const findCmdLines = sec.split('\n').filter(l => l.trim().startsWith('find ./src') || (l.includes('find ./src') && !l.includes('Running') && !l.includes('instead')));
  findCmdLines.length === 0
    ? ok('security: find command does not scope to ./src')
    : bad('security: find command scopes to ./src — will miss files outside src/');
  sec.includes('public/')
    ? ok('security: public/ directory referenced in static asset check')
    : bad('security: public/ directory not mentioned');
  const domainGuidance = exists('skills/security/references/domain-guidance.md')
    ? read('skills/security/references/domain-guidance.md') : '';
  const outputFormats = exists('skills/security/references/output-formats.md')
    ? read('skills/security/references/output-formats.md') : '';
  const bcs = exists('skills/shared/business-context-severity.md')
    ? read('skills/shared/business-context-severity.md') : '';
  (sec + domainGuidance + outputFormats + bcs).includes('floor, not a ceiling')
    || (sec + domainGuidance + outputFormats + bcs).includes('floors, not ceilings')
    ? ok('security: CVSS floor principle stated')
    : bad('security: CVSS floor principle missing');
  const allSecContent = sec + domainGuidance + outputFormats + bcs;
  const overrideCount = (allSecContent.match(/B[1-7]/g) || []).length;
  overrideCount >= 7
    ? ok(`security: B1-B7 override triggers present (${overrideCount} references)`)
    : bad(`security: missing some B1-B7 override triggers (found ${overrideCount})`);
}

// Code-review skill specific checks
if (exists('skills/code-review/SKILL.md')) {
  const cr = read('skills/code-review/SKILL.md');
  /skip cache|ignore cache/i.test(cr)
    ? ok('code-review: --full cache bypass is explicit')
    : bad('code-review: --full cache bypass instruction not explicit enough');
  !cr.includes('find ./src')
    ? ok('code-review: find command does not scope to ./src')
    : bad('code-review: find command scopes to ./src');
}

// ── 6. Rules files ────────────────────────────────────────────────────────────
console.log('\n▶ Rules (_project-deploy/rules/)');
// dotnet-rules.md → csharp-dotnet-rules.md, nodejs-rules.md → nodejs-typescript-rules.md (3.6.0 rename)
const RULES = ['project-rules.md','csharp-dotnet-rules.md','angular-rules.md','nodejs-typescript-rules.md'];
RULES.forEach(r => {
  const rel = `_project-deploy/rules/${r}`;
  if (!exists(rel)) { bad(`_project-deploy/rules/${r} exists`); return; }
  const content = read(rel);
  content.includes('paths:') ? ok(`${r}: has paths frontmatter`) : bad(`${r}: missing paths frontmatter`);
});

// project-rules must have decision transparency
if (exists('_project-deploy/rules/project-rules.md')) {
  const pr = read('_project-deploy/rules/project-rules.md');
  pr.includes('Decision transparency') ? ok('project-rules: Decision transparency rule present') : bad('project-rules: Decision transparency missing');
  pr.includes('Do not assume')         ? ok('project-rules: Do not assume rule present')         : bad('project-rules: Do not assume rule missing');
}

// ── ADR 0059: scored stack-key detection & rule deployment ─────────────────────
console.log('\n▶ Stack-key detection (ADR 0059)');
// (a) No rule file may carry `detect:` frontmatter — detection lives only in stack-signals.cjs.
if (typeof require('fs').readdirSync === 'function' && exists('_project-deploy/rules')) {
  const rd = require('fs').readdirSync('_project-deploy/rules').filter(f => f.endsWith('.md'));
  const withDetect = rd.filter(f => /^detect:/m.test(read('_project-deploy/rules/' + f)));
  withDetect.length === 0
    ? ok('rules: no `detect:` frontmatter (moved to stack-signals.cjs)')
    : bad('rules: still carry `detect:` frontmatter — ' + withDetect.join(', '));
}
// (b) stack-signals.cjs exists and every stack_key maps to an existing rule file (convention).
if (exists('scripts/stack-signals.cjs')) {
  ok('scripts/stack-signals.cjs exists');
  let S = null; try { S = require('../scripts/stack-signals.cjs'); } catch (e) { bad('stack-signals.cjs failed to load: ' + e.message); }
  if (S && Array.isArray(S.STACK_SIGNALS_TABLE)) {
    const keyToFile = k => (k === 'project-rules' ? 'project-rules.md' : k + '-rules.md');
    const backendCaps = ['backend-base','rest-api','auth','api-security','data-access','testing-backend','observability'];
    const allKeys = new Set([...S.STACK_SIGNALS_TABLE.map(e => e.stack_key), ...backendCaps]);
    const missing = [...allKeys].filter(k => !exists('_project-deploy/rules/' + keyToFile(k)));
    missing.length === 0 ? ok('stack-signals: every stack_key has a rule file') : bad('stack-signals: keys without a rule file — ' + missing.join(', '));
    // no orphan rule files (every -rules.md maps to a known key)
    const known = new Set([...allKeys].map(keyToFile));
    const orphans = require('fs').readdirSync('_project-deploy/rules').filter(f => f.endsWith('-rules.md') && !known.has(f));
    orphans.length === 0 ? ok('stack-signals: no orphan rule files') : bad('stack-signals: rule files with no stack_key — ' + orphans.join(', '));
    // prune denylist present
    const ps = S.PRUNE_DIRS || new Set();
    ['bin','obj','node_modules'].every(d => ps.has(d)) ? ok('stack-signals: PRUNE_DIRS covers bin/obj/node_modules') : bad('stack-signals: PRUNE_DIRS missing build/vendor dirs');
  }
} else bad('scripts/stack-signals.cjs missing');
// (c) repo-detect emits detection; bootstrap consumes it + writes manifest/.hashes.
if (exists('scripts/repo-detect.cjs')) {
  const rdc = read('scripts/repo-detect.cjs');
  rdc.includes('stack-signals') && rdc.includes('state.detection')
    ? ok('repo-detect: computes + writes scored detection') : bad('repo-detect: missing scored detection wiring');
}

// ── 7. setup-init completeness ────────────────────────────────────────────────
// ── knowledge-freshness (ADO-9004 Story 1) — detector + shared classifier extract ──
console.log('\n▶ knowledge-freshness (ADO-9004)');
{
  const kf = 'scripts/knowledge-freshness.cjs';
  if (exists(kf)) {
    const c = read(kf);
    c.includes('SCRIPT REVIEW')           ? ok('kf: detector has SCRIPT REVIEW header')  : bad('kf: detector missing SCRIPT REVIEW header');
    c.includes('require.main === module') ? ok('kf: detector has require.main CLI guard') : bad('kf: detector missing require.main guard');
    (!c.includes("require('http") && !c.includes("require('https") && !c.includes('fetch('))
      ? ok('kf: detector performs no network I/O') : bad('kf: detector must not perform network I/O');
    (c.includes("=== 'restamp'") && c.includes('function applyRestamp'))
      ? ok('kf: restamp op + pure applyRestamp present') : bad('kf: restamp op/applyRestamp missing');
  } else bad('kf: scripts/knowledge-freshness.cjs missing');

  const lib = 'scripts/lib/source-classifier.cjs';
  if (exists(lib)) {
    const l = read(lib);
    l.includes('SCRIPT REVIEW') ? ok('kf: source-classifier has SCRIPT REVIEW header') : bad('kf: source-classifier missing SCRIPT REVIEW header');
    (l.includes('module.exports') && l.includes('classifySource'))
      ? ok('kf: source-classifier exports classifySource') : bad('kf: source-classifier must export classifySource');
  } else bad('kf: scripts/lib/source-classifier.cjs missing');

  if (exists('scripts/upgrade-knowledge-cache.cjs')) {
    const u = read('scripts/upgrade-knowledge-cache.cjs');
    u.includes("require('./lib/source-classifier.cjs')")
      ? ok('kf: upgrade-cache imports the shared classifier') : bad('kf: upgrade-cache must import the shared classifier');
    !u.includes('function classifySource')
      ? ok('kf: upgrade-cache no longer defines its own classifySource') : bad('kf: upgrade-cache still defines classifySource (extract incomplete)');
  }

  exists('commands/knowledge-freshness.md') ? ok('kf: command stub exists') : bad('kf: commands/knowledge-freshness.md missing');
}

// setup-init is a thin command → skills/setup-init/SKILL.md holds the procedure.
console.log('\n▶ setup-init completeness (skills/setup-init/SKILL.md)');
if (exists('skills/setup-init/SKILL.md')) {
  const di = read('skills/setup-init/SKILL.md');
  // 3.6.0: stubs are deployed by setup-init-bootstrap.cjs, not a bash loop in setup-init.md
  di.includes('setup-init-bootstrap.cjs')
    ? ok('setup-init: references bootstrap script for stub/hook deployment')
    : bad('setup-init: bootstrap script reference missing — stubs should be deployed via setup-init-bootstrap.cjs');
  // ADR 0046: rule deployment + cache seeding moved into setup-init-bootstrap.cjs,
  // so the command delegates rather than carrying inline cp/writeFileSync logic.
  const bs = exists('scripts/setup-init-bootstrap.cjs') ? read('scripts/setup-init-bootstrap.cjs') : '';
  bs
    ? ok('setup-init: mechanical work delegated to setup-init-bootstrap.cjs (ADR 0046)')
    : bad('setup-init: scripts/setup-init-bootstrap.cjs missing');
  bs.includes('file-cache.json') && bs.includes('token-graph.json')
    ? ok('setup-init-bootstrap: seeds file-cache.json and token-graph.json')
    : bad('setup-init-bootstrap: cache/token-graph seeding missing');
  bs.includes('deployed_rules') && bs.includes('state.detection') && bs.includes('_deploy-manifest.json')
    ? ok('setup-init-bootstrap: scored deploy present (reads detection, writes deployed_rules + manifest)')
    : bad('setup-init-bootstrap: scored rule deployment wiring missing (ADR 0059)');
}

// ── 8. Test scenario coverage ─────────────────────────────────────────────────
console.log('\n▶ Test scenario coverage (tests/skill-scenarios/)');
const EXPECTED_SCENARIOS = [
  'icea-feature','icea-review','code-review','security',
  'pr-create','setup-status','session-start','bug','checkin',
  'update-arch','explain','fix'
];
EXPECTED_SCENARIOS.forEach(s => {
  exists(`tests/skill-scenarios/${s}.yaml`)
    ? ok(`scenario: ${s}.yaml`)
    : bad(`scenario: ${s}.yaml missing`, `Create tests/skill-scenarios/${s}.yaml`);
});

// ── 9. CLAUDE.md baseline ─────────────────────────────────────────────────────
console.log('\n▶ CLAUDE.md baseline');
if (exists('CLAUDE.md')) {
  const cm = read('CLAUDE.md');
  cm.includes('# Dream')              ? ok('CLAUDE.md: Dream section present')            : bad('CLAUDE.md: Dream section missing');
  cm.includes('ICEA')                 ? ok('CLAUDE.md: ICEA reference present')           : bad('CLAUDE.md: ICEA reference missing');
  cm.includes('MODEL ROUTING')        ? ok('CLAUDE.md: Model routing section present')    : bad('CLAUDE.md: Model routing section missing');
  cm.includes('INFRA_MODEL')           ? ok('CLAUDE.md: INFRA_MODEL documented')            : bad('CLAUDE.md: INFRA_MODEL missing from model routing table');
  (cm.includes('Windows env var') && cm.includes('AZURE_DEVOPS_PAT')) || cm.includes('Windows User Environment Variables')
    ? ok('CLAUDE.md: PAT stored in Windows env var') : bad('CLAUDE.md: PAT Windows env var guidance missing');
  // Migration family §0a (ADO-9000 Story 3) — status+resume for all 3 skills + MIGRATE retirement signpost
  ['UPGRADE STATUS', 'REWRITE STATUS', 'REPLATFORM STATUS', 'UPGRADE RESUME', 'REWRITE RESUME', 'REPLATFORM RESUME'].every(k => cm.includes(k))
    ? ok('CLAUDE.md: §0a STATUS+RESUME present for all 3 migration skills') : bad('CLAUDE.md: §0a missing a STATUS/RESUME row for upgrade/rewrite/replatform');
  (cm.includes('**RETIRED**') && cm.includes('Do NOT auto-route'))
    ? ok('CLAUDE.md: §0a MIGRATE retirement signpost present')             : bad('CLAUDE.md: §0a MIGRATE retirement signpost missing');
  !cm.includes('Run migration skill for that ADO ID')
    ? ok('CLAUDE.md: §0a legacy MIGRATE→migration handler removed')        : bad('CLAUDE.md: §0a still routes MIGRATE to the retired migration skill');
}

// ── 9b. _project-deploy/CLAUDE.md deployment template ────────────────────────
console.log('\n▶ _project-deploy/CLAUDE.md deployment template');
if (exists('_project-deploy/CLAUDE.md')) {
  const dp = read('_project-deploy/CLAUDE.md');
  dp.includes('# Dream')                    ? ok('deploy CLAUDE.md: Dream section present')           : bad('deploy CLAUDE.md: Dream section missing');
  dp.includes('## 0a. Keyword Handlers')    ? ok('deploy CLAUDE.md: §0a Keyword Handlers present')   : bad('deploy CLAUDE.md: §0a Keyword Handlers missing');
  dp.includes('## 0. WRITE GATE')           ? ok('deploy CLAUDE.md: Write Gate section present')      : bad('deploy CLAUDE.md: Write Gate section missing');
  dp.includes('{ADO_ORG}')                  ? ok('deploy CLAUDE.md: ADO_ORG placeholder present')    : bad('deploy CLAUDE.md: {ADO_ORG} placeholder missing — template must not have hardcoded values');
  dp.includes('Invoke icea-feature skill')  ? ok('deploy CLAUDE.md: §0a recovery handlers updated')  : bad('deploy CLAUDE.md: §0a still has old "Draft…cross-session recovery" handlers');
  dp.includes('INFRA_MODEL')                ? ok('deploy CLAUDE.md: MODEL ROUTING present')           : bad('deploy CLAUDE.md: MODEL ROUTING section missing');
  // Migration family §0a (ADO-9000 Story 3) — status+resume for all 3 skills + MIGRATE retirement signpost
  ['UPGRADE STATUS', 'REWRITE STATUS', 'REPLATFORM STATUS', 'UPGRADE RESUME', 'REWRITE RESUME', 'REPLATFORM RESUME'].every(k => dp.includes(k))
    ? ok('deploy CLAUDE.md: §0a STATUS+RESUME present for all 3 migration skills') : bad('deploy CLAUDE.md: §0a missing a STATUS/RESUME row for upgrade/rewrite/replatform');
  (dp.includes('**RETIRED**') && dp.includes('Do NOT auto-route'))
    ? ok('deploy CLAUDE.md: §0a MIGRATE retirement signpost present')             : bad('deploy CLAUDE.md: §0a MIGRATE retirement signpost missing');
  !dp.includes('Run migration skill for that ADO ID')
    ? ok('deploy CLAUDE.md: §0a legacy MIGRATE→migration handler removed')        : bad('deploy CLAUDE.md: §0a still routes MIGRATE to the retired migration skill');
} else {
  bad('_project-deploy/CLAUDE.md missing — create it as the deployment template source');
}

// ── 10. install.sh syntax ─────────────────────────────────────────────────────
console.log('\n▶ install.sh syntax');
if (exists('install.sh')) {
  const sh = read('install.sh');
  sh.includes("node -e 'require")
    ? ok('install.sh: plugin.json check uses single quotes')
    : bad('install.sh: plugin.json check may have unescaped double-quote syntax error');
  !sh.includes('require("./.claude-plugin/plugin.json")"')
    ? ok('install.sh: no double-quote nesting error')
    : bad('install.sh: double-quote nesting error — will crash on error path');
}

// ── Architecture templates (skills/architect/templates/) ───────────────────────
// Verifies the two-tier compose layout (ADR — architect template dedup): a stack-
// agnostic _shared/ base + per-stack folders that supply stack-specific files and
// overrides. The bootstrap composes union(_shared, <stack>) with the stack winning
// collisions, so every stack must resolve to exactly its 8-file set.
console.log('\n▶ Architecture templates (skills/architect/templates/)');
{
  const TPL = 'skills/architect/templates';
  // The File-2 variant each stack ships (the rest of the 8-file set is fixed).
  const STACK_FILE2 = {
    'dotnet-api':       'architecture-callchains.md',
    'spring-boot':      'architecture-callchains.md',
    'js-library':       'architecture-api.md',
    'angular-nx':       'architecture-flows.md',
    'angular-standard': 'architecture-flows.md',
    'react':            'architecture-flows.md',
    'aspnet-framework': 'architecture-flows.md',
    'aspnet-mvc':       'architecture-flows.md',
    'python-fastapi':   'architecture-flows.md',
    'python-django':    'architecture-flows.md',
    'python-flask':     'architecture-flows.md',
  };
  const SHARED_FILES   = ['architecture-decisions.md','architecture-integrations.md','architecture-security.md','architecture-data.md'];
  // Files every stack must resolve to after compose (File-2 added per stack below).
  const STACK_FIXED    = ['architecture.md','architecture-reference.md','architecture-deployment.md'];
  const EXPECTED_TOTAL = 8;

  // _shared/ base
  const sharedRel = `${TPL}/_shared`;
  if (!exists(sharedRel)) {
    bad('_shared/ base folder exists', `Create ${sharedRel}/ with the stack-agnostic templates`);
  } else {
    SHARED_FILES.forEach(f => exists(`${sharedRel}/${f}`)
      ? ok(`_shared/${f}`)
      : bad(`_shared/${f} exists`, `Move the stack-agnostic ${f} into ${sharedRel}/`));
  }
  const sharedOnDisk = exists(sharedRel)
    ? fs.readdirSync(path.join(ROOT, sharedRel)).filter(f => f.endsWith('.md'))
    : [];

  // Per-stack folders — cross-check against the bootstrap's ARCH_TEMPLATE_FOLDER map
  const bootstrap = read('scripts/setup-init-bootstrap.cjs');
  const stacks = Object.keys(STACK_FILE2);
  stacks.forEach(stack => {
    const stackRel = `${TPL}/${stack}`;
    if (!exists(stackRel)) { bad(`stack folder ${stack}/ exists`, `Create ${stackRel}/`); return; }
    const onDisk = fs.readdirSync(path.join(ROOT, stackRel)).filter(f => f.endsWith('.md'));

    // Required stack-specific files present
    [...STACK_FIXED, STACK_FILE2[stack]].forEach(f => onDisk.includes(f)
      ? ok(`${stack}/${f}`)
      : bad(`${stack}/${f} exists`, `Add ${f} to ${stackRel}/`));

    // Compose completeness: union(_shared, stack) == the exact 8-file set
    const composed = new Set([...sharedOnDisk, ...onDisk]);
    composed.size === EXPECTED_TOTAL
      ? ok(`${stack}: composes to ${EXPECTED_TOTAL} files`)
      : bad(`${stack}: composes to ${EXPECTED_TOTAL} files (got ${composed.size}: ${[...composed].sort().join(', ')})`,
             'A stack must resolve to exactly 8 files via union(_shared, stack)');

    // Bootstrap must map this stack folder
    bootstrap.includes(`'${stack}'`)
      ? ok(`${stack}: mapped in ARCH_TEMPLATE_FOLDER`)
      : bad(`${stack}: mapped in ARCH_TEMPLATE_FOLDER`, `Add ${stack} to ARCH_TEMPLATE_FOLDER in setup-init-bootstrap.cjs`);
  });

  // Override sanity — dotnet-api overrides all 4 shared files; frontend + js-library override data.md
  ['architecture-decisions.md','architecture-integrations.md','architecture-security.md','architecture-data.md']
    .forEach(f => exists(`${TPL}/dotnet-api/${f}`)
      ? ok(`dotnet-api overrides ${f}`)
      : bad(`dotnet-api overrides ${f}`, `dotnet-api ships a .NET-specific ${f} — restore its override in ${TPL}/dotnet-api/`));
  ['angular-nx','angular-standard','react','js-library']
    .forEach(s => exists(`${TPL}/${s}/architecture-data.md`)
      ? ok(`${s} overrides architecture-data.md`)
      : bad(`${s} overrides architecture-data.md`, `${s} needs its own architecture-data.md variant`));

  // Marker check — every template (shared + stack) must start with <!-- TEMPLATE -->
  let markerBad = 0;
  const allTplDirs = [sharedRel, ...stacks.map(s => `${TPL}/${s}`)].filter(d => exists(d));
  allTplDirs.forEach(d => {
    fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.md')).forEach(f => {
      const first = read(`${d}/${f}`).split(/\r?\n/, 1)[0];
      if (!/^<!--\s*TEMPLATE\s*-->/.test(first)) { markerBad++; if (VERBOSE) console.log(`    ✗ ${d}/${f} missing <!-- TEMPLATE --> marker`); }
    });
  });
  markerBad === 0
    ? ok('all templates start with <!-- TEMPLATE --> marker')
    : bad(`all templates start with <!-- TEMPLATE --> marker (${markerBad} missing)`, 'Add <!-- TEMPLATE --> as line 1 of every architecture template');
}

// ── Deploy-stub delegation integrity (_project-deploy/commands/) ───────────────
// Every deployed stub must delegate to something that actually exists, or the
// project-local /X invokes nothing. Three accepted patterns:
//   1. <skill>[ai-assisted-development:]X</skill>  → X registered in plugin.json + skills/X/SKILL.md on disk
//   2. Read the full command at `commands/X.md` …   → commands/X.md exists
//   3. …$PLUGIN_DIR/skills/X/SKILL.md…              → skills/X/SKILL.md on disk
// This guards against the broken-stub class (deployed /X pointing at a non-existent skill).
console.log('\n▶ Deploy-stub delegation integrity (_project-deploy/commands/)');
{
  const pj = readJson('.claude-plugin/plugin.json');
  const regSkills = new Set(pj.components?.skills || []);
  const deployDir = '_project-deploy/commands';
  if (!exists(deployDir)) {
    bad('_project-deploy/commands/ exists', 'Create the deploy-stub folder');
  } else {
    let broken = 0, checked = 0;
    fs.readdirSync(path.join(ROOT, deployDir)).filter(f => f.endsWith('.md')).forEach(f => {
      const body = read(`${deployDir}/${f}`);
      const skill = body.match(/<skill>(?:ai-assisted-development:)?([a-z0-9-]+)<\/skill>/);
      const cmdDeleg = body.match(/command at `commands\/([a-z0-9-]+)\.md`/);
      const skillPath = body.match(/skills\/([a-z0-9-]+)\/SKILL\.md/);
      if (skill) {
        checked++;
        const n = skill[1];
        if (!regSkills.has(n) || !exists(`skills/${n}/SKILL.md`)) {
          broken++;
          bad(`${f}: <skill> "${n}" is not a registered on-disk skill`,
              `Register skills/${n}/SKILL.md in plugin.json components.skills, or use command-delegation (Read commands/${n}.md)`);
        }
      } else if (cmdDeleg) {
        checked++;
        const n = cmdDeleg[1];
        if (!exists(`commands/${n}.md`)) {
          broken++;
          bad(`${f}: command-delegation target commands/${n}.md is missing`,
              `Create commands/${n}.md or fix the deploy-stub reference`);
        }
      } else if (skillPath) {
        checked++;
        const n = skillPath[1];
        if (!exists(`skills/${n}/SKILL.md`)) {
          broken++;
          bad(`${f}: skill-path target skills/${n}/SKILL.md is missing`,
              `Create skills/${n}/SKILL.md or fix the deploy-stub reference`);
        }
      }
    });
    if (broken === 0) ok(`all ${checked} delegating deploy stubs resolve to a registered skill or existing command`);
  }
}

// ── Decoupling guards (stack-neutral + company-agnostic shipping content) ───────
console.log('\n▶ Decoupling guards');
{
  // (a) No company/personal identity may ship. docs/ (case studies) + this file are exempt.
  const DENY = ['Vivek Rawat', 'Product Engineering', 'Kirkland', 'K&E', 'kirkland.com'];
  const SCAN_DIRS  = ['skills', 'commands', '_project-deploy'];
  const SCAN_FILES = ['.claude-plugin/marketplace.json', '.claude-plugin/plugin.json',
                      '.claude-plugin/config.json', 'install.sh', 'install.ps1', 'install.cjs',
                      'scripts/sync-config.sh', 'scripts/sync-config.cjs'];
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = [...SCAN_DIRS.filter(exists).flatMap(walk), ...SCAN_FILES.filter(exists)];
  const hits = [];
  files.forEach(f => { const c = read(f); DENY.forEach(t => { if (c.includes(t)) hits.push(`${f} → "${t}"`); }); });
  hits.length === 0
    ? ok('no company/personal identity in shipping content')
    : bad('company/personal identity leaked into shipping content', hits.join(' | '));

  // (b) Data Access Convention must be stack-conditional, not an unconditional Dapper mandate.
  ['CLAUDE.md', '_project-deploy/CLAUDE.md'].forEach(f => {
    const c = read(f);
    (!/Always use \*\*Dapper/.test(c) && c.includes('- .NET:') && c.includes('- Python:'))
      ? ok(`${f}: Data Access Convention is stack-conditional`)
      : bad(`${f}: Data Access Convention must be stack-conditional (per-stack bullets, no unconditional Dapper mandate)`);
  });

  // (c) Stack-context fallbacks must not assume a stack.
  ['skills/icea-feature/SKILL.md', 'skills/critic/SKILL.md', 'skills/pr-describe/SKILL.md'].forEach(f => {
    /No (repo )?stack is assumed/.test(read(f))
      ? ok(`${f}: stack context is detection-driven (no assumed default)`)
      : bad(`${f}: stack context must say "No stack is assumed" and resolve via detection`);
  });

  // (d) Emitted templates must derive layers, not hardcode .NET/Angular/Node.js.
  const T = {
    'skills/ado-tasks/references/task-formats.md':                 ['EF Core Entity:', 'Angular Route/Component:'],
    'skills/icea-feature/references/ado-description-template.md':  ['.NET API:', 'EF Core Entity:'],
    'skills/pr-describe/references/pr-description-template.md':     ['.NET: FluentValidation', 'Angular: OnPush'],
  };
  Object.entries(T).forEach(([f, banned]) => {
    const c = read(f);
    const found = banned.filter(b => c.includes(b));
    (found.length === 0 && /active layer/.test(c))
      ? ok(`${f}: emitted layers are stack-neutral`)
      : bad(`${f}: emitted template still hardcodes a stack`, found.length ? `remove: ${found.join(', ')}` : 'add layer-driven "active layer" template');
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'━'.repeat(52)}`);
console.log(`  Structural validation complete`);
console.log(`  ✓ ${pass} passed   ✗ ${fail} failed   ⚠ ${warn} advisory`);
if (fail > 0) {
  console.log(`\n  Failures:`);
  issues.forEach(i => {
    console.log(`    ✗ ${i.label}`);
    if (FIX && i.fix) console.log(`      → ${i.fix}`);
  });
}
if (fail === 0) console.log(`\n  All structural checks passed. Run node tests/runner.js for behaviour tests.`);
console.log(`${'━'.repeat(52)}\n`);
process.exit(fail > 0 ? 1 : 0);
