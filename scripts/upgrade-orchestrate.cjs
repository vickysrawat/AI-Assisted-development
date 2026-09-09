#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Upgrade-skill execution PLANNER + verify evaluator. `plan` turns a multi-hop
//                      version path into an ordered, bisectable runbook: (1) a pre-upgrade baseline
//                      TAG created BEFORE any edit (the oracle anchor), (2) an isolated branch, (3)
//                      run-tool + ONE commit per hop, (4) a verify step against the baseline tag.
//                      `verify` evaluates per-hop pass/fail results: all pass -> verified (merge
//                      allowed); any fail -> blocked, pins the first failing hop, returns resolution
//                      options, and refuses the merge. Pure function of its inputs.
// What it touches:     Nothing. No filesystem, no network, no git execution. Reads only process.argv.
//                      It EMITS git/tool commands as strings for the developer to run (LLM authors,
//                      human executes) — it never runs them.
// What it does NOT do: Never edits the repo, never tags/branches/commits, never runs the stack tool,
//                      never merges, no LLM call. Emitting a command is not running it.
// APIs / commands:     Node stdlib only. Exit codes ARE the contract: plan 0; verify 0=verified ·
//                      9=blocked; 1=usage/error.
// How to verify:       node scripts/upgrade-orchestrate.cjs plan --stack=dotnet --from=6 --to=8 \
//                        --hops=7,8 --json   -> steps[0].op==="tag", commit_plan.length===2
//                      node tests/upgrade-orchestrate.test.cjs  -> "N passed · 0 failed".

'use strict';

// ── Args ────────────────────────────────────────────────────────────────────
const OP       = (process.argv[2] || '').trim().toLowerCase();
const JSON_OUT = process.argv.includes('--json');
const arg = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const STACK = (arg('stack') || '').trim().toLowerCase();
const FROM  = (arg('from')  || '').trim();
const TO    = (arg('to')    || '').trim();
const ADO   = (arg('ado')   || '').trim();
const HOPS  = (arg('hops') || '').split(',').map(h => h.trim()).filter(Boolean);

// ── plan ──────────────────────────────────────────────────────────────────────
function opPlan() {
  if (!STACK) throw new Error('plan requires --stack');
  if (!HOPS.length) throw new Error('plan requires --hops=<v1,v2,...> (the bisectable version path)');

  const baselineTag = arg('tag')    || `pre-upgrade/${STACK}-${FROM || 'current'}`;
  const branch      = arg('branch') || `upgrade/${STACK}-${FROM || 'x'}-to-${TO || HOPS[HOPS.length - 1]}`;
  const tool        = arg('tool')   || `<${STACK} upgrade tool>`;
  const verifyCmd   = arg('verify-cmd') || '<project test command>';
  const idTag       = ADO ? `[ADO-${ADO}] ` : '';

  // DECISION: how much of execution the script performs
  // Options considered:
  //   A) the script runs git tag/branch/commit + the stack tool itself — rejected: mutating a
  //      working repo is un-unit-testable, non-deterministic, and violates the family invariant
  //      "LLM authors + rehearses, human executes"; residual fixes must each pass the Write Gate
  //   B) the script only EMITS an ordered runbook + evaluates verify results (pure) — chosen: the
  //      sequencing (baseline-first, one-commit-per-hop, no-merge-until-verify) is the safety
  //      property worth encoding + testing; execution stays gated + human/LLM-driven
  const steps = [];
  let n = 1;
  steps.push({ n: n++, op: 'tag',    hop: null, cmd: `git tag ${baselineTag}`,
               why: 'baseline oracle anchor — created BEFORE any edit; verify diffs against this' });
  steps.push({ n: n++, op: 'branch', hop: null, cmd: `git checkout -b ${branch}`,
               why: 'isolate the upgrade; the baseline tag stays reachable for verification' });

  const commitPlan = [];
  HOPS.forEach((hop, i) => {
    const msg = `${idTag}upgrade: ${STACK} → ${hop} (hop ${i + 1}/${HOPS.length})`;
    steps.push({ n: n++, op: 'run-tool', hop, cmd: `${tool}   # target ${hop}`,
                 why: 'deterministic tool performs the bulk transform for this single hop' });
    steps.push({ n: n++, op: 'commit', hop, cmd: `git commit -am "${msg}"`,
                 why: 'exactly ONE commit per hop keeps history bisectable' });
    commitPlan.push({ hop, commit_msg: msg });
  });

  steps.push({ n: n++, op: 'verify', hop: null, cmd: `${verifyCmd}   # then diff behaviour vs ${baselineTag}`,
               why: 'no merge until the upgraded branch matches the baseline oracle' });

  return { op: 'plan', stack: STACK, from: FROM || null, to: TO || null,
           baseline_tag: baselineTag, branch, tool, hops: HOPS, steps, commit_plan: commitPlan,
           note: 'Author-only runbook: run these yourself. Each residual fix pauses on the Write Gate.' };
}

// ── verify ──────────────────────────────────────────────────────────────────
function opVerify() {
  const results = (arg('hop-results') || '').split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
  if (!results.length) throw new Error('verify requires --hop-results=<pass|fail,...> aligned to hops');
  const hops = HOPS.length ? HOPS : results.map((_, i) => String(i + 1));

  const failIdx = results.findIndex(r => r !== 'pass');
  if (failIdx === -1) {
    return { op: 'verify', status: 'verified', merge_allowed: true, hops,
             note: 'All hops match the baseline oracle — merge is allowed.' };
  }
  const failingHop = hops[failIdx] ?? String(failIdx + 1);
  return {
    op: 'verify', status: 'blocked', merge_allowed: false, failing_hop: failingHop, hop_index: failIdx + 1, hops,
    resolution_options: [
      `Inspect the isolated hop: git checkout ${arg('branch') || '<branch>'} && git log --oneline`,
      `Reproduce on the failing hop only (bisectable — exactly one commit changed it)`,
      `Remediate the residual for hop ${failingHop} (each fix behind the Write Gate), then re-verify`,
      `If the hop is a hard BLOCKER, stop and surface it in the Gap + Risk report — do NOT merge`,
    ],
    note: 'A hop failed baseline-oracle verification. No merge until verify passes.',
  };
}

// ── Output + exit-code contract ────────────────────────────────────────────────
const VERIFY_EXIT = { verified: 0, blocked: 9 };
module.exports = { opPlan, opVerify };

if (require.main === module) {
  try {
    let result, exit;
    if (OP === 'plan')        { result = opPlan();   exit = 0; }
    else if (OP === 'verify') { result = opVerify(); exit = VERIFY_EXIT[result.status] ?? 1; }
    else {
      process.stderr.write('usage: upgrade-orchestrate.cjs <plan|verify> --stack=<s> --hops=<v1,v2> [--from --to --tool --branch --tag] | verify --hop-results=<pass|fail,...>\n');
      process.exit(1);
    }

    if (JSON_OUT) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else if (result.op === 'plan') {
      const lines = [`baseline tag: ${result.baseline_tag}`, `branch: ${result.branch}`, `hops: ${result.hops.join(' → ')}`, '', 'Runbook (run these yourself):'];
      result.steps.forEach(s => lines.push(`  ${s.n}. [${s.op}${s.hop ? ' ' + s.hop : ''}] ${s.cmd}`));
      lines.push('', result.note);
      process.stdout.write(lines.join('\n') + '\n');
    } else {
      const lines = [`verify: ${result.status}`, `merge allowed: ${result.merge_allowed}`];
      if (result.failing_hop) { lines.push(`failing hop: ${result.failing_hop}`, 'resolution options:'); result.resolution_options.forEach(o => lines.push(`  - ${o}`)); }
      process.stdout.write(lines.join('\n') + '\n');
    }
    process.exit(exit);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }
}
