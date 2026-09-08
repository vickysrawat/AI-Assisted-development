#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Deterministic Upgrade-skill classifier. Given a detected stack token, a
//                      current version (--from) and a requested target version (--to) — plus an
//                      optional target stack (--to-stack) — it classifies the request as
//                      `upgrade` | `false-upgrade` | `unsupported` | `invalid`, selects the
//                      deterministic tool, and (for `upgrade`) computes the multi-hop version path.
//                      Read-only, pure function of its inputs. Prints JSON (--json) or a summary.
// What it touches:     Nothing. No filesystem, no network, no git. Reads only process.argv.
// What it does NOT do: No detection (that is scripts/migration-source-detect.cjs), no code edits,
//                      no LLM, no writes. It never mutates the project.
// APIs / commands:     Node stdlib only (no imports needed). Exit codes ARE the contract:
//                      0=upgrade · 3=false-upgrade(route Rewrite) · 4=unsupported · 5=invalid.
// How to verify:       node scripts/upgrade-classify.cjs --stack=java --from=8 --to=21 --json
//                      -> {"classification":"upgrade","tool":"OpenRewrite","hops":[11,17,21],...}
//                      node tests/upgrade-classify.test.cjs  -> "N passed · 0 failed".

'use strict';

// ── Args ────────────────────────────────────────────────────────────────────
const JSON_OUT = process.argv.includes('--json');
const arg = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const STACK    = (arg('stack')    || '').trim().toLowerCase();
const TO_STACK = (arg('to-stack') || '').trim().toLowerCase();
const FROM     = (arg('from')     || '').trim();
const TO       = (arg('to')       || '').trim();

// ── Static knowledge (design of record: docs/plans/migrationSkill/upgrade.md §A–§B) ──
const SUPPORTED = new Set(['dotnet', 'angular', 'java', 'python', 'nodejs', 'react']);

// Cross-runtime transitions that are rewrites, not upgrades → route to Rewrite.
const CROSS_RUNTIME = {
  'dotnet_framework>dotnet': '.NET Framework → .NET crosses the runtime + BCL boundary',
  'webforms>blazor':         'WebForms → Blazor is a different programming model',
  'webforms>dotnet':         'WebForms → .NET (Core) is an out-of-place rewrite',
  'angularjs>angular':       'AngularJS (1.x) → Angular (2+) is a framework rewrite',
  'python2>python3':         'Python 2 → 3 is a language-level breaking change',
};
// Legacy source tokens that are always a false-upgrade source, whatever the target.
const LEGACY_SOURCES = new Set(['dotnet_framework', 'angularjs', 'webforms', 'python2']);

// Tool + coverage per supported stack (feeds the Gap/Risk report).
const TOOLING = {
  dotnet:  { tool: 'dotnet upgrade-assistant', coverage: 'good',      residualLoad: 'low-med' },
  angular: { tool: 'ng update',                coverage: 'excellent', residualLoad: 'low' },
  java:    { tool: 'OpenRewrite',              coverage: 'good',      residualLoad: 'med' },
  python:  { tool: 'pyupgrade / ruff',         coverage: 'modest',    residualLoad: 'med-high' },
  nodejs:  { tool: 'npm-check-updates',        coverage: 'weak',      residualLoad: 'high' },
  react:   { tool: 'npm-check-updates + codemods', coverage: 'modest', residualLoad: 'med' },
};

// ── Version helpers ───────────────────────────────────────────────────────────
const majorOf = (v) => { const m = /^\s*(\d+)/.exec(v); return m ? Number(m[1]) : NaN; };
const minorOf = (v) => { const m = /^\s*\d+\.(\d+)/.exec(v); return m ? Number(m[1]) : 0; };

// ── Hop strategies (Workstream B — bisectable multi-hop paths) ─────────────────
// DECISION: How to sequence multi-hop upgrade paths
// Options considered:
//   A) Always jump straight to target — rejected: a broken jump can't be bisected to one hop
//   B) Step by every major for all stacks — rejected: ignores LTS ladders (Java/Node) teams follow
//   C) Per-stack strategy (LTS ladder / one-major / minor-step) — chosen: matches each ecosystem's
//      supported upgrade path and keeps one commit per hop (the safety model in upgrade.md §D)
const HOP_STRATEGY = {
  java: (from, to) => [11, 17, 21].filter(v => v > from && v < to).concat(to),
  nodejs: (from, to) => {
    const hops = [];
    for (let v = from % 2 === 0 ? from + 2 : from + 1; v < to; v += 2) hops.push(v);
    hops.push(to);
    return hops;
  },
  python: (fromV, toV) => {
    // 3.x minor steps; from/to majors are equal (== 3) here by construction.
    const hops = [];
    for (let m = minorOf(fromV) + 1; m < minorOf(toV); m++) hops.push(`3.${m}`);
    hops.push(`3.${minorOf(toV)}`);
    return hops;
  },
  eachMajor: (from, to) => { const hops = []; for (let v = from + 1; v <= to; v++) hops.push(v); return hops; },
};

function planHops(stack, fromMajor, toMajor) {
  if (stack === 'java')   return HOP_STRATEGY.java(fromMajor, toMajor);
  if (stack === 'nodejs') return HOP_STRATEGY.nodejs(fromMajor, toMajor);
  if (stack === 'python') return HOP_STRATEGY.python(FROM, TO);
  return HOP_STRATEGY.eachMajor(fromMajor, toMajor); // dotnet, angular, react
}

// ── Classification ──────────────────────────────────────────────────────────
function classify() {
  if (!STACK) {
    return { classification: 'invalid', reason: 'No --stack provided', route: null };
  }

  // 1. Legacy source token → always a false-upgrade.
  if (LEGACY_SOURCES.has(STACK)) {
    const key = TO_STACK ? `${STACK}>${TO_STACK}` : null;
    const reason = (key && CROSS_RUNTIME[key]) || `${STACK} is a legacy runtime with no in-place upgrade path`;
    return { classification: 'false-upgrade', reason, route: 'rewrite' };
  }

  // 2. Cross-runtime transition (target stack differs across a boundary).
  if (TO_STACK && TO_STACK !== STACK) {
    const reason = CROSS_RUNTIME[`${STACK}>${TO_STACK}`];
    if (reason) return { classification: 'false-upgrade', reason, route: 'rewrite' };
    // A cross-stack request with no known in-place path is not an upgrade either.
    return { classification: 'false-upgrade', reason: `${STACK} → ${TO_STACK} is not an in-place version upgrade`, route: 'rewrite' };
  }

  // 3. Within-stack version-boundary false-upgrades.
  const fromMajor = majorOf(FROM);
  if (STACK === 'python' && fromMajor === 2) {
    return { classification: 'false-upgrade', reason: CROSS_RUNTIME['python2>python3'], route: 'rewrite' };
  }
  if (STACK === 'angular' && fromMajor === 1) {
    return { classification: 'false-upgrade', reason: CROSS_RUNTIME['angularjs>angular'], route: 'rewrite' };
  }

  // 4. Unsupported stack.
  if (!SUPPORTED.has(STACK)) {
    return { classification: 'unsupported', reason: `No in-place upgrade tool for '${STACK}'`, route: null,
             supported: [...SUPPORTED] };
  }

  // 5. Version sanity.
  const toMajor = majorOf(TO);
  if (!Number.isFinite(fromMajor) || !Number.isFinite(toMajor)) {
    return { classification: 'invalid', reason: 'Both --from and --to versions are required for an upgrade', route: null };
  }
  const sameMajor = fromMajor === toMajor;
  const downgrade = toMajor < fromMajor || (STACK === 'python' && sameMajor && minorOf(TO) <= minorOf(FROM));
  if (downgrade || (sameMajor && STACK !== 'python')) {
    return { classification: 'invalid', reason: `Target (${TO}) is not higher than current (${FROM})`, route: null };
  }

  // 6. Upgrade — plan hops + select tool.
  const hops = planHops(STACK, fromMajor, toMajor);
  return { classification: 'upgrade', reason: 'In-place, same-stack version upgrade', route: null,
           ...TOOLING[STACK], hops };
}

// ── Output + exit-code contract ────────────────────────────────────────────────
const EXIT = { upgrade: 0, 'false-upgrade': 3, unsupported: 4, invalid: 5 };
// Exports are assigned unconditionally so `require()` can unit-test the pure logic without
// running the CLI or calling process.exit (which would kill the requiring process).
module.exports = { classify, planHops };

if (require.main === module) {
  const result = { stack: STACK, from: FROM || null, to: TO || null, toStack: TO_STACK || null, ...classify() };
  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    const lines = [`classification: ${result.classification}`, `reason: ${result.reason}`];
    if (result.route) lines.push(`route: ${result.route}`);
    if (result.tool)  lines.push(`tool: ${result.tool} (coverage: ${result.coverage}, residual: ${result.residualLoad})`);
    if (result.hops)  lines.push(`hops: ${result.hops.join(' → ')}`);
    if (result.supported) lines.push(`supported: ${result.supported.join(', ')}`);
    process.stdout.write(lines.join('\n') + '\n');
  }
  process.exit(EXIT[result.classification] ?? 5);
}
