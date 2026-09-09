#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Replatform-skill deterministic core (AC-F7). `plan` emits a cloud-capability
//                      plan with the LANDING ZONE as Tier-0 (provisioned first, inherited by all
//                      capabilities), an IaC-module scaffold per capability, the intake-captured target
//                      CI/CD platform + IaC flavor (recorded for the ledger), and the four
//                      human-executable runbooks (migration · reconciliation · cutover · rollback) —
//                      all author-only (applied:false). `execute` is the EXECUTOR SEAM: it authorizes
//                      author/rehearse always, and DENIES real actions (apply/cutover/destroy) when the
//                      future-autonomy flag is OFF (default) and ALWAYS for prod/regulated even when ON.
//                      `reconcile-gate` blocks cutover when any data-reconciliation step failed.
//                      Pure functions of the inputs — no judgment, reproducible.
// What it touches:     Nothing. Reads process.argv and process.env.REPLATFORM_AUTONOMY only. Writes NOTHING.
// What it does NOT do: No IaC generation to disk, NO real infra/data apply (decision-only — the LLM
//                      authors, the human executes), no network, no cloud SDK, no LLM, no mutation.
// APIs / commands:     Node stdlib only. Exit codes: plan 0; execute 0=authorized · 14=denied;
//                      reconcile-gate 0=pass · 15=blocked; 1=usage/error.
// How to verify:       node scripts/replatform-plan.cjs plan --target=azure --capabilities=compute,data --json
//                      node scripts/replatform-plan.cjs execute --action=apply --json   # -> denied, exit 14
//                      node tests/replatform-plan.test.cjs   -> "N passed · 0 failed".

'use strict';

const OP       = (process.argv[2] || '').trim().toLowerCase();
const JSON_OUT = process.argv.includes('--json');
const arg  = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const num  = (n) => { const v = Number(arg(n)); return Number.isFinite(v) ? v : undefined; };
const bool = (n) => (arg(n) || '').trim().toLowerCase() === 'true';

// The landing zone (Tier-0) IS these capabilities, bundled and provisioned first. Any of them passed
// as an input capability is folded into Tier-0 rather than scheduled as a dependent workload.
const LANDING_ZONE_CAPS = new Set(['network', 'identity', 'secrets', 'observability', 'governance']);

// Minimal capability → IaC-module scaffold map. Deliberately option-shaped (host is a choice, not 1:1).
const IAC_MODULES = {
  'landing-zone': ['subscription/resource-group', 'network (vnet/subnet/nsg)', 'identity (entra-id / managed-identity)',
                   'key-vault (secrets)', 'policy/governance', 'log-analytics (observability)', 'security-baseline'],
  compute:     ['app-host (App Service | AKS | Container Apps | Functions — option)', 'autoscale', 'ingress'],
  data:        ['managed-db (SQL | Postgres — option)', 'storage (blob)', 'backup/geo-replication'],
  messaging:   ['service-bus | event-hub (option)', 'queues/topics'],
  cache:       ['redis'],
};

const RUNBOOKS = ['migration', 'reconciliation', 'cutover', 'rollback'];

// DECISION: how the landing zone is placed in the plan
// Options considered:
//   A) treat landing zone as just another capability ordered by a DAG — rejected: its Tier-0 primacy
//      (every capability inherits it) is a hard invariant, not an emergent ordering; a DAG could
//      accidentally parallelize it
//   B) always inject landing-zone as Tier-0 index 0 with no inbound deps; every workload depends on it
//      — chosen: makes the "provision the landing zone first" rule structural and testable
function buildPlan(target, capabilities, opts = {}) {
  const requested = (capabilities || []).map(c => c.trim().toLowerCase()).filter(Boolean);
  const folded    = requested.filter(c => LANDING_ZONE_CAPS.has(c));
  const workloads = requested.filter(c => !LANDING_ZONE_CAPS.has(c));

  const plan = [{
    tier: 0,
    capability: 'landing-zone',
    depends_on: [],
    iac_modules: IAC_MODULES['landing-zone'],
    folds: folded,                 // input caps absorbed into Tier-0
    note: 'Tier-0 backbone — provisioned first; inherited by every capability.',
  }];

  workloads.forEach((cap) => {
    plan.push({
      tier: 1,
      capability: cap,
      depends_on: ['landing-zone'],
      iac_modules: IAC_MODULES[cap] || ['(no scaffold mapping — author from source topology)'],
    });
  });

  return {
    op: 'plan',
    target: target || 'azure',                        // cloud provider (where the target is hosted)
    // Intake-captured (replatform Stage R1) — the platform of the AUTHORED target deployment pipeline
    // and the IaC language. Recorded so the choice flows into the shared ledger; 'unspecified' until
    // intake answers them. NEVER assumed — these differ per target engagement (Azure DevOps vs
    // GitHub Actions; Bicep vs Terraform).
    cicd_platform: opts.cicdPlatform || 'unspecified',
    iac_flavor:    opts.iacFlavor    || 'unspecified',
    plan,
    runbooks: RUNBOOKS.map(name => ({ name, authored_by: 'llm', executed_by: 'human', executed: false })),
    execution: {
      authored_by: 'llm',
      applied: false,
      note: 'LLM authors + rehearses; human executes. No apply path exists in this planner (AC-F7).',
    },
  };
}

const REAL_ACTIONS = new Set(['apply', 'cutover', 'destroy']);

// DECISION: where the future-autonomy gate lives
// Options considered:
//   A) allow apply when a flag is set — rejected: prod + regulated must stay human even when autonomy
//      is enabled; a single boolean can't express that
//   B) a decision function that (i) always allows author/rehearse, (ii) denies real actions with the
//      flag OFF, (iii) denies prod/regulated even with the flag ON, and never itself applies — chosen:
//      encodes the executor-seam contract (skills/shared/executor-seam.md) mechanically
function authorize({ action, env, autonomy, regulated }) {
  const act = (action || 'author').trim().toLowerCase();
  const environment = (env || 'dev').trim().toLowerCase();

  if (!REAL_ACTIONS.has(act)) {
    return { op: 'execute', action: act, authorized: true, applied: false, executor: 'author-time',
             reason: `'${act}' is an author-time / rehearsal action — no real infra/data touched.` };
  }
  if (!autonomy) {
    return { op: 'execute', action: act, authorized: false, applied: false, executor: 'manual-handoff',
             reason: `Real action '${act}' denied — future-autonomy flag is OFF (default). The LLM authors; a human executes the runbook.` };
  }
  if (environment === 'prod' || regulated) {
    return { op: 'execute', action: act, authorized: false, applied: false, executor: 'manual-handoff',
             reason: `Real action '${act}' denied — ${environment === 'prod' ? 'production' : 'regulated/PII'} is permanently human-executed, even with autonomy ON.` };
  }
  return { op: 'execute', action: act, authorized: true, applied: false, executor: 'seam (shipped = manual-handoff)',
           reason: `Real action '${act}' authorized for ${environment} (non-regulated) — routed through the executor seam; the planner itself never applies (applied:false).` };
}

// DECISION: what blocks a cutover
// Options considered:
//   A) reviewer eyeballs reconciliation — rejected: data loss is the family's highest-consequence risk;
//      the gate must be mechanical
//   B) block when any reconciliation step failed (passing < total, or a named failed step) — chosen:
//      a mandatory pre-cutover gate on real counts; regulated/PII must be a full pass
function reconcileGate({ total, passing, failedStep }) {
  const t = total ?? 0;
  const p = passing ?? 0;
  const failing = Boolean(failedStep) || (t > 0 && p < t);
  if (failing) {
    return { op: 'reconcile-gate', status: 'blocked', total: t, passing: p,
             failed_step: failedStep || `${t - p} of ${t} reconciliation step(s) failed`,
             reason: 'Cutover BLOCKED — a reconciliation step failed. Show the failing PASS/FAIL step; a human decides. Regulated/PII/financial require a full pass.' };
  }
  return { op: 'reconcile-gate', status: 'pass', total: t, passing: p,
           reason: `All ${t} reconciliation step(s) passed — pre-cutover gate clear.` };
}

module.exports = { buildPlan, authorize, reconcileGate, LANDING_ZONE_CAPS, REAL_ACTIONS };

if (require.main === module) {
  try {
    let result, exit = 0;
    if (OP === 'plan') {
      const caps = (arg('capabilities') || 'compute,data').split(',');
      result = buildPlan(arg('target'), caps, { cicdPlatform: arg('cicd-platform'), iacFlavor: arg('iac-flavor') });
    } else if (OP === 'execute') {
      const autonomy = (arg('autonomy') || process.env.REPLATFORM_AUTONOMY || 'off').trim().toLowerCase() === 'on';
      result = authorize({ action: arg('action'), env: arg('env'), autonomy, regulated: bool('regulated') });
      exit = result.authorized ? 0 : 14;
    } else if (OP === 'reconcile-gate') {
      result = reconcileGate({ total: num('steps-total'), passing: num('steps-passing'), failedStep: arg('failed-step') });
      exit = result.status === 'blocked' ? 15 : 0;
    } else {
      process.stderr.write('usage: replatform-plan.cjs <plan|execute|reconcile-gate> [--target --capabilities --cicd-platform --iac-flavor] [--action --env --autonomy --regulated] [--steps-total --steps-passing --failed-step] [--json]\n');
      process.exit(1);
    }

    if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else if (result.op === 'plan') {
      const lines = [`target: ${result.target} · cicd: ${result.cicd_platform} · iac: ${result.iac_flavor}`, 'plan (Tier-0 first):'];
      result.plan.forEach(p => lines.push(`  [tier ${p.tier}] ${p.capability}${p.depends_on.length ? ` (depends on ${p.depends_on.join(', ')})` : ''}`));
      lines.push(`runbooks: ${result.runbooks.map(r => r.name).join(', ')} (all human-executed, executed:false)`);
      lines.push(result.execution.note);
      process.stdout.write(lines.join('\n') + '\n');
    } else {
      process.stdout.write(`${result.op}: ${result.status || (result.authorized ? 'authorized' : 'denied')}\n${result.reason}\n`);
    }
    process.exit(exit);
  } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
}
