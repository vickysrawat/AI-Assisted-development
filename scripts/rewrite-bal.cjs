#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Rewrite-skill Behavioral Assurance Level (BAL) engine + the two gates (AC-F5).
//                      `bal` computes a cluster's BAL (A→D) by the WEAKEST-LINK rule across dimensions
//                      whose grades come from MECHANICAL denominators (verified/total, passing/total)
//                      plus an oracle ceiling (no runnable oracle caps the cluster at C/D). `merge-gate`
//                      enforces provisional BAL ≠ D. `completion-gate` HARD-BLOCKS a B-series cluster
//                      whose final BAL is below the floor (named approver + reason required; no silent
//                      pass). Pure functions of the counts passed in — no judgment, reproducible.
// What it touches:     Nothing. Reads process.argv only. Writes NOTHING.
// What it does NOT do: No code generation, no test execution (counts are supplied by the caller — the
//                      skill runs tests / the golden-master and feeds the numbers in), no network,
//                      no LLM, no mutation.
// APIs / commands:     Node stdlib only. Exit codes: bal 0; merge-gate 0=pass · 12=blocked;
//                      completion-gate 0=pass/warn · 13=blocked; 1=usage/error.
// How to verify:       node scripts/rewrite-bal.cjs bal --cluster=auth --oracle=runnable --behaviors-total=10 --behaviors-verified=9 --json
//                      node tests/rewrite-bal.test.cjs  -> "N passed · 0 failed".

'use strict';

const OP       = (process.argv[2] || '').trim().toLowerCase();
const JSON_OUT = process.argv.includes('--json');
const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const num = (n) => { const v = Number(arg(n)); return Number.isFinite(v) ? v : undefined; };

// Grade lattice — A strongest, D weakest. Rank lets "weakest-link" be a numeric min.
const RANK = { A: 4, B: 3, C: 2, D: 1 };
const GRADE = { 4: 'A', 3: 'B', 2: 'C', 1: 'D' };
const weaker = (g1, g2) => GRADE[Math.min(RANK[g1], RANK[g2])];
const belowFloor = (grade, floor) => RANK[grade] < RANK[floor];

// DECISION: how a coverage ratio maps to a grade (must be MECHANICAL, not judgment)
// Options considered:
//   A) reviewer assigns a grade — rejected: the whole point of BAL is a mechanical, auditable measure
//      that can't be talked up; a judgment grade defeats it
//   B) fixed ratio bands on real denominators (verified/total) — chosen: reproducible, and the
//      denominator is surfaced so the number is falsifiable
function coverageGrade(verified, total) {
  if (!total) return 'D';                 // no measurable behaviors → unverified
  const r = verified / total;
  if (r >= 0.9) return 'A';
  if (r >= 0.7) return 'B';
  if (r >= 0.4) return 'C';
  return 'D';
}

// A cluster with no runnable oracle cannot exceed C — behavior was never actually observed.
const oracleCeiling = (oracle) => (oracle === 'runnable' ? 'A' : 'C');

function opBal() {
  const cluster = arg('cluster') || '(unnamed)';
  const oracle  = (arg('oracle') || 'none').trim().toLowerCase();
  const bTotal = num('behaviors-total'), bVerified = num('behaviors-verified') ?? 0;

  const dims = [];
  const ceiling = oracleCeiling(oracle);
  dims.push({ name: 'oracle', grade: ceiling, detail: oracle === 'runnable' ? 'runnable source oracle available' : 'no runnable oracle — capped at C' });

  if (bTotal !== undefined) {
    const g = coverageGrade(bVerified, bTotal);
    dims.push({ name: 'coverage', grade: g, detail: `${bVerified}/${bTotal} behaviors verified (${(bVerified / (bTotal || 1)).toFixed(2)})` });
  }
  const tTotal = num('tests-total');
  if (tTotal !== undefined) {
    const tPassing = num('tests-passing') ?? 0;
    const g = coverageGrade(tPassing, tTotal);
    dims.push({ name: 'tests', grade: g, detail: `${tPassing}/${tTotal} tests passing (${(tPassing / (tTotal || 1)).toFixed(2)})` });
  }

  // Weakest-link: the cluster BAL is the WEAKEST dimension grade (oracle ceiling included).
  const bal = dims.map(d => d.grade).reduce((a, b) => weaker(a, b));
  const weakest = dims.find(d => d.grade === bal)?.name;
  return {
    op: 'bal', cluster, bal, weakest, dimensions: dims,
    ceiling_flagged: oracle !== 'runnable',
    note: oracle !== 'runnable'
      ? `No runnable oracle — BAL is capped at C (assurance ceiling). Surface this BEFORE commit.`
      : `Weakest-link BAL = ${bal} (limited by ${weakest}).`,
  };
}

function opMergeGate() {
  const bal = (arg('bal') || '').trim().toUpperCase();
  if (!RANK[bal]) throw new Error('merge-gate requires --bal=<A|B|C|D> (the provisional BAL)');
  // Merge gate: provisional BAL must be ≠ D.
  if (bal === 'D') return { op: 'merge-gate', status: 'blocked', bal, reason: 'provisional BAL D — raise assurance or re-scope the cluster before merge' };
  return { op: 'merge-gate', status: 'pass', bal, reason: `provisional BAL ${bal} ≠ D — merge allowed` };
}

function opCompletionGate() {
  const bal = (arg('bal') || '').trim().toUpperCase();
  const floor = (arg('floor') || 'C').trim().toUpperCase();
  const bSeries = (arg('b-series') || 'false').trim().toLowerCase() === 'true';
  if (!RANK[bal] || !RANK[floor]) throw new Error('completion-gate requires --bal=<A|B|C|D> and --floor=<A|B|C|D>');

  if (belowFloor(bal, floor)) {
    if (bSeries) {
      return { op: 'completion-gate', status: 'blocked', bal, floor, b_series: true, requires_approver: true,
               reason: `B-series cluster at final BAL ${bal} is below the floor ${floor} — HARD BLOCK. A named approver + written reason are required; no silent pass.` };
    }
    return { op: 'completion-gate', status: 'warn', bal, floor, b_series: false, requires_approver: false,
             reason: `final BAL ${bal} below floor ${floor} (non-B-series) — allowed with an explicit note.` };
  }
  return { op: 'completion-gate', status: 'pass', bal, floor, b_series: bSeries, requires_approver: false,
           reason: `final BAL ${bal} meets floor ${floor}.` };
}

module.exports = { coverageGrade, oracleCeiling, weaker, belowFloor, opBal };

if (require.main === module) {
  try {
    let result, exit = 0;
    if (OP === 'bal') result = opBal();
    else if (OP === 'merge-gate') { result = opMergeGate(); exit = result.status === 'blocked' ? 12 : 0; }
    else if (OP === 'completion-gate') { result = opCompletionGate(); exit = result.status === 'blocked' ? 13 : 0; }
    else { process.stderr.write('usage: rewrite-bal.cjs <bal|merge-gate|completion-gate> [--cluster --oracle --behaviors-total --behaviors-verified --tests-total --tests-passing] [--bal --floor --b-series] [--json]\n'); process.exit(1); }

    if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else if (result.op === 'bal') {
      const lines = [`cluster: ${result.cluster}`, `BAL: ${result.bal} (weakest: ${result.weakest})`];
      result.dimensions.forEach(d => lines.push(`  ${d.name}: ${d.grade} — ${d.detail}`));
      lines.push(result.note);
      process.stdout.write(lines.join('\n') + '\n');
    } else {
      process.stdout.write(`${result.op}: ${result.status}\n${result.reason}\n`);
    }
    process.exit(exit);
  } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
}
