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
    'code-review','security-review','token-analysis','sprint-metrics','product-docs'
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

  // Commands that use scope flags must not have {% if args %}
  if (['code-review','security-review'].includes(c)) {
    !content.includes('{% if args %}')
      ? ok(`${c}: no broken {% if args %} template`)
      : bad(`${c}: has broken {% if args %} template — flags will not work`, `Rewrite ${c}.md to use SCOPE_FLAG pattern`);
    content.includes('SCOPE_FLAG')
      ? ok(`${c}: uses SCOPE_FLAG pattern`)
      : bad(`${c}: missing SCOPE_FLAG — --full will be ignored`);
    content.includes('--area')
      ? ok(`${c}: --area flag defined`)
      : bad(`${c}: --area flag missing`);
    content.includes('--continue')
      ? ok(`${c}: --continue flag defined`)
      : bad(`${c}: --continue flag missing`);
  }

  // security-review must reference the skill
  if (c === 'security-review') {
    content.includes('source file scan') ? ok('security-review: has scan announcement') : bad('security-review: missing scan announcement');
    content.includes('SKILL.md') ? ok('security-review: references skill SKILL.md') : bad('security-review: missing skill reference');
    content.includes('SKIP THE CACHE') || content.includes('skip the cache')
      ? ok('security-review: --full cache-bypass instruction present')
      : bad('security-review: --full cache-bypass instruction missing');
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
  // domain-map-spec.md was retired in v3.0.0 (ADR 0038) — validate.py check 9 errors if it exists
  'single-writer-assumption.md',
  'model-routing-spec.md',
  'business-context-severity.md',
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
}

// Business context spec must have B1-B7
if (exists('skills/shared/business-context-severity.md')) {
  const b = read('skills/shared/business-context-severity.md');
  ['B1','B2','B3','B4','B5','B6','B7'].forEach(trigger => {
    b.includes(trigger) ? ok(`business-context-severity: ${trigger} defined`) : bad(`business-context-severity: ${trigger} missing`);
  });
  (b.includes('floor, not a ceiling') || b.includes('floors, not ceilings')) ? ok('business-context-severity: floor principle stated') : bad('business-context-severity: floor principle missing');
}

// ── 5. Skills ─────────────────────────────────────────────────────────────────
console.log('\n▶ Skills (skills/*/SKILL.md)');
const SKILLS = [
  'icea-feature','icea-review','architect','code-review','security',
  'pr-create','pr-describe','pr-spec-review','ado-tasks','sprint-metrics',
  'setup-status','setup-sync','setup-teardown','dream-rollback','token-analysis','product-docs',
  'app-readiness','plugin-readiness',
];
SKILLS.forEach(s => {
  const rel = `skills/${s}/SKILL.md`;
  if (!exists(rel)) { bad(`skills/${s}/SKILL.md exists`); return; }
  ok(`skills/${s}/SKILL.md exists`);
  const content = read(rel);

  // All skills must have YAML frontmatter with name and description
  if (!content.startsWith('---')) { bad(`${s}: has YAML frontmatter`); }

  // Review skills must reference source-file-consent
  if (['icea-review','pr-spec-review'].includes(s)) {
    content.includes('source-file-consent')
      ? ok(`${s}: references source-file-consent spec`)
      : bad(`${s}: missing source-file-consent reference`);
  }

  // Review skills must reference business-context-severity
  if (['code-review','icea-review','security','pr-spec-review'].includes(s)) {
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

// icea-review checks
if (exists('skills/icea-review/references/review-checks.md')) {
  const rc = read('skills/icea-review/references/review-checks.md');
  rc.includes('Business Context')
    ? ok('icea-review/review-checks: Business Context check present')
    : bad('icea-review/review-checks: Business Context check missing');
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

// ── 7. setup-init completeness ────────────────────────────────────────────────
console.log('\n▶ setup-init completeness (commands/setup-init.md)');
if (exists('commands/setup-init.md')) {
  const di = read('commands/setup-init.md');
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
  bs.includes('deployed_rules') || bs.includes('detect')
    ? ok('setup-init-bootstrap: frontmatter-discovery rule deployment present')
    : bad('setup-init-bootstrap: frontmatter-discovery rule deployment missing');
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
