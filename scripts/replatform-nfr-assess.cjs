#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Replatform NFR-assurance engine (AC-F8). `assess` computes an NFR's assurance by
//                      the WEAKEST-LINK rule across three MECHANICAL dimensions — measurability ceiling
//                      (from the NFR's tag), evidence (what was actually done), and load-profile (the
//                      oracle analog) — and flags the ceiling when the result is capped. `gate` enforces
//                      the "done" gate: a REGULATED NFR below the floor is a HARD BLOCK (named approver +
//                      reason); non-regulated below floor is a warn. Pure functions of the inputs — no
//                      judgment, reproducible (symmetric to rewrite-bal.cjs).
// What it touches:     Nothing. Reads process.argv only. Writes NOTHING.
// What it does NOT do: No measuring/load-testing itself (the skill runs the drills / load test and feeds
//                      the results in), no Well-Architected grading (that reuses app-readiness output —
//                      see references/well-architected.md), no network, no LLM, no mutation.
// APIs / commands:     Node stdlib only. Exit codes: assess 0; gate 0=pass/warn · 16=blocked; 1=usage/error.
// How to verify:       node scripts/replatform-nfr-assess.cjs assess --nfr=latency --measurability=testable --evidence=measured --load-profile=real --json
//                      node scripts/replatform-nfr-assess.cjs gate --assurance=projected --floor=measured --regulated=true --json   # -> blocked, exit 16
//                      node tests/replatform-nfr-assess.test.cjs   -> "N passed · 0 failed".

'use strict';

const OP       = (process.argv[2] || '').trim().toLowerCase();
const JSON_OUT = process.argv.includes('--json');
const arg  = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const bool = (n) => (arg(n) || '').trim().toLowerCase() === 'true';

// Assurance lattice — measured strongest, modeled-only weakest. Rank lets "weakest-link" be a numeric min.
const RANK  = { 'measured': 4, 'drilled-partial': 3, 'projected': 2, 'modeled-only': 1 };
const GRADE = { 4: 'measured', 3: 'drilled-partial', 2: 'projected', 1: 'modeled-only' };
const weaker     = (g1, g2) => GRADE[Math.min(RANK[g1], RANK[g2])];
const belowFloor = (grade, floor) => RANK[grade] < RANK[floor];

// DECISION: how an NFR's measurability tag maps to a ceiling (must be MECHANICAL, symmetric to BAL's oracle ceiling)
// Options considered:
//   A) reviewer decides how much assurance an NFR "deserves" — rejected: the whole point is a ceiling
//      that cannot be talked up
//   B) fixed mapping from the tag: testable/auditable CAN reach measured; projected is capped at projected
//      — chosen: an unmeasurable NFR mechanically cannot claim to be measured
function measurabilityCeiling(tag) {
  const t = (tag || '').trim().toLowerCase();
  if (t === 'testable' || t === 'auditable') return 'measured';
  if (t === 'projected') return 'projected';
  return 'projected';   // unknown/absent tag → cannot claim measured
}

// The load profile is the oracle analog (like BAL's runnable oracle): real traffic → measured, synthetic
// → drilled-partial, none → modeled-only.
function loadProfileGrade(profile) {
  const p = (profile || 'none').trim().toLowerCase();
  if (p === 'real') return 'measured';
  if (p === 'synthetic') return 'drilled-partial';
  return 'modeled-only';
}

// DECISION: how the three dimensions combine into one assurance grade
// Options considered:
//   A) average the dimensions — rejected: averaging lets a strong dimension mask an unmeasured one
//   B) WEAKEST-LINK (min) across measurability ceiling · evidence · load-profile — chosen: assurance can
//      only be as strong as its weakest, auditable input (same rule as BAL)
function assess({ nfr, measurability, evidence, loadProfile }) {
  const m  = (measurability || '').trim().toLowerCase();
  const e  = (evidence || 'modeled-only').trim().toLowerCase();
  const lp = (loadProfile || 'none').trim().toLowerCase();

  const ceiling = measurabilityCeiling(m);
  const evGrade = RANK[e] ? e : 'modeled-only';
  const lpGrade = loadProfileGrade(lp);

  const dims = [
    { name: 'measurability-ceiling', grade: ceiling, detail: `tag '${m || '(none)'}' → ceiling ${ceiling}` },
    { name: 'evidence',              grade: evGrade, detail: `evidence: ${e}` },
    { name: 'load-profile',          grade: lpGrade, detail: `load profile: ${lp} → ${lpGrade}` },
  ];
  const assurance = dims.map(d => d.grade).reduce((a, b) => weaker(a, b));
  const weakest = dims.find(d => d.grade === assurance)?.name;
  const ceiling_flagged = ceiling !== 'measured' || lp !== 'real';

  return {
    op: 'assess', nfr: nfr || '(unnamed)', assurance, weakest, dimensions: dims, ceiling_flagged,
    note: ceiling_flagged
      ? `Assurance capped at ${assurance} (limited by ${weakest}) — STATE this ceiling; do not report as fully measured.`
      : `NFR assurance = ${assurance} (measured).`,
  };
}

function gate({ assurance, floor, regulated }) {
  const a = (assurance || '').trim().toLowerCase();
  const f = (floor || 'projected').trim().toLowerCase();
  if (!RANK[a] || !RANK[f]) throw new Error('gate requires --assurance and --floor in {measured|drilled-partial|projected|modeled-only}');

  if (belowFloor(a, f)) {
    if (regulated) {
      return { op: 'gate', status: 'blocked', assurance: a, floor: f, regulated: true, requires_approver: true,
               reason: `Regulated NFR at assurance ${a} is below the floor ${f} — HARD BLOCK. A named approver + written reason are required; no silent pass.` };
    }
    return { op: 'gate', status: 'warn', assurance: a, floor: f, regulated: false, requires_approver: false,
             reason: `NFR assurance ${a} below floor ${f} (non-regulated) — allowed with an explicit note.` };
  }
  return { op: 'gate', status: 'pass', assurance: a, floor: f, regulated: Boolean(regulated), requires_approver: false,
           reason: `NFR assurance ${a} meets floor ${f}.` };
}

module.exports = { assess, gate, measurabilityCeiling, loadProfileGrade, weaker, belowFloor };

if (require.main === module) {
  try {
    let result, exit = 0;
    if (OP === 'assess') {
      result = assess({ nfr: arg('nfr'), measurability: arg('measurability'), evidence: arg('evidence'), loadProfile: arg('load-profile') });
    } else if (OP === 'gate') {
      result = gate({ assurance: arg('assurance'), floor: arg('floor'), regulated: bool('regulated') });
      exit = result.status === 'blocked' ? 16 : 0;
    } else {
      process.stderr.write('usage: replatform-nfr-assess.cjs <assess|gate> [--nfr --measurability --evidence --load-profile] [--assurance --floor --regulated] [--json]\n');
      process.exit(1);
    }

    if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else if (result.op === 'assess') {
      const lines = [`nfr: ${result.nfr}`, `assurance: ${result.assurance} (weakest: ${result.weakest})`];
      result.dimensions.forEach(d => lines.push(`  ${d.name}: ${d.grade} — ${d.detail}`));
      lines.push(result.note);
      process.stdout.write(lines.join('\n') + '\n');
    } else {
      process.stdout.write(`${result.op}: ${result.status}\n${result.reason}\n`);
    }
    process.exit(exit);
  } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
}
