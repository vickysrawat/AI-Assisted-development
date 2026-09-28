#!/usr/bin/env node
// scripts/governance-report.cjs — aggregate governance data for the sprint report skill
//
// Reads .claude/audit/*.json, token-analysis/token-graph.json, finding ledgers,
// .claude/settings.json, and .claude/ApprovalRoles.json. Outputs structured JSON
// to stdout for the governance-report SKILL.md to process and narrate.
//
// Usage:
//   node "$PLUGIN_DIR/scripts/governance-report.cjs"
//   node "$PLUGIN_DIR/scripts/governance-report.cjs" --since 2026-09-01
//   node "$PLUGIN_DIR/scripts/governance-report.cjs" --days 14
//
// Always exits 0 — missing data sources are reported as nulls, never errors.

'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────

function arg(name) {
  const idx = process.argv.indexOf('--' + name);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

const sinceArg = arg('since');   // ISO date string e.g. 2026-09-01
const daysArg  = arg('days');    // integer e.g. 30

function cutoffDate() {
  if (sinceArg) return new Date(sinceArg);
  if (daysArg)  return new Date(Date.now() - parseInt(daysArg, 10) * 86400000);
  return new Date(Date.now() - 30 * 86400000);  // default: last 30 days
}

// ── Data loaders ──────────────────────────────────────────────────────────────

function safeJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { return null; }
}

function loadAuditEvents() {
  const auditDir = path.join(process.cwd(), '.claude', 'audit');
  if (!fs.existsSync(auditDir)) return { all: [], filtered: [], available: false };

  // Accept both legacy per-event .json files (audit-write.cjs) and
  // current per-day .jsonl files (audit-append.cjs). Sort for chronological order.
  const files = fs.readdirSync(auditDir)
    .filter(f => (f.endsWith('.json') || f.endsWith('.jsonl')) && !f.startsWith('.'))
    .sort();

  const raw_events = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(auditDir, f), 'utf8');
      if (f.endsWith('.jsonl')) {
        // JSONL: one JSON object per line — parse each line independently.
        for (const line of raw.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try { raw_events.push(JSON.parse(trimmed)); } catch (_) {}
        }
      } else {
        // Legacy single-object .json file from audit-write.cjs.
        raw_events.push(JSON.parse(raw));
      }
    } catch (_) {}
  }

  // Normalise every event to the canonical field shape (handles both audit-write and
  // audit-append schemas in one pass — see normalizeEvent() above for the mapping).
  const all = raw_events.map(normalizeEvent);

  const cutoff = cutoffDate();
  const filtered = all.filter(e => e.timestamp && new Date(e.timestamp) >= cutoff);
  return { all, filtered, available: true, fileCount: files.length };
}

function loadLedgerStats(ledgerPath) {
  try {
    const content = fs.readFileSync(path.join(process.cwd(), ledgerPath), 'utf8');
    return {
      exists:    true,
      open:      (content.match(/\*\*Status\*\*: Open/g)      || []).length,
      dismissed: (content.match(/\*\*Status\*\*: Dismissed/g) || []).length,
      fixed:     (content.match(/\*\*Status\*\*: Fixed/g)     || []).length,
    };
  } catch (_) {
    return { exists: false, open: 0, dismissed: 0, fixed: 0 };
  }
}

function configuredModels(env) {
  return {
    generation:     env.ICEA_MODEL     || null,
    review:         env.REVIEW_MODEL   || null,
    critic:         env.CRITIC_MODEL   || env.REVIEW_MODEL || null,
    infrastructure: env.INFRA_MODEL    || null,
    note: 'Configured model tiers — per-invocation tracking available in Item 15 (Pass B)',
  };
}

// ── Schema normalisation ──────────────────────────────────────────────────────
//
// Two audit writers produce incompatible field names:
//   audit-write.cjs  (skill-driven, legacy .json files)  → event: SCREAMING_SNAKE, actor, role, ado_id, timestamp
//   audit-append.cjs (hook-driven, daily .jsonl files)   → event: dot.notation,    os_user/git_email, actor_confidence, ado, ts
//
// normalizeEvent() maps both to the canonical shape that analysis functions expect,
// so no analysis function needs to handle both schemas.

// Maps dot.notation event + action → canonical SCREAMING_SNAKE event type.
function normalizeEventType(e) {
  const action = (e.action || '').toUpperCase();
  switch (e.event) {
    case 'gate.approve':
      // APPROVE ADO-{ID} → APPROVE_ADO; APPROVE OPTIONS → APPROVE_OPTIONS; etc.
      if (action === 'APPROVE') return 'APPROVE_ADO';
      return 'APPROVE_' + action.replace(/[\s-]+/g, '_');
    case 'gate.bypass': {
      if (action === 'APPROVE ALL')  return 'APPROVE_ALL';
      if (action === 'REVOKE ALL')   return 'REVOKE_ALL';
      if (action.startsWith('SAVE') && action.includes('ACCEPT')) return 'BYPASS_ICEA';
      if (action === 'SKIP-ICEA' || action === 'SKIP_ICEA_FLOOR') return 'BYPASS_ICEA_FLOOR';
      if (action === 'BYPASS_TEST_GATE') return 'BYPASS_TEST_GATE';
      return 'BYPASS_' + action.replace(/[\s-]+/g, '_');
    }
    case 'gate.block':
      return 'BLOCK_' + action.replace(/[\s-]+/g, '_');
    case 'gate.web-grounding':
      return 'WEB_GROUNDING';
    default:
      return e.event;   // audit-write.cjs events are already canonical
  }
}

// Returns a new event object with all fields normalised to the canonical shape.
function normalizeEvent(e) {
  return Object.assign({}, e, {
    // Event type: dot.notation → SCREAMING_SNAKE (no-op for audit-write events)
    event: normalizeEventType(e),
    // Canonical actor: prefer verified identity, fall back through available signals
    actor: e.actor || e.verified_actor || e.os_user || e.git_email || 'unknown',
    // Canonical role
    role:  e.role || (e.actor_confidence === 'verified' ? 'verified' : 'developer'),
    // Canonical ADO ID: audit-write uses ado_id, audit-append uses ado
    ado_id: e.ado_id || e.ado || null,
    // Canonical timestamp: audit-write uses timestamp, audit-append uses ts
    timestamp: e.timestamp || e.ts,
  });
}

// ── Event analysis helpers ────────────────────────────────────────────────────

function groupByType(events) {
  const map = {};
  for (const e of events) {
    if (!map[e.event]) map[e.event] = [];
    map[e.event].push(e);
  }
  return map;
}

function actorSummary(events) {
  const map = {};
  for (const e of events) {
    const a = e.actor || 'unknown';
    if (!map[a]) map[a] = { role: e.role || 'developer', eventCounts: {}, eventList: [] };
    map[a].eventCounts[e.event] = (map[a].eventCounts[e.event] || 0) + 1;
    map[a].eventList.push(e.event);
  }
  return map;
}

function bypassRate(byType) {
  const approvals = (byType['APPROVE_ADO'] || []).length;
  const bypasses  = (byType['BYPASS_TEST_GATE'] || []).length;
  if (approvals + bypasses === 0) return null;
  return { approvals, bypasses, rate: (bypasses / (approvals + bypasses) * 100).toFixed(1) };
}

function revisionCycles(byType) {
  const revises = byType['REVISE_ADO'] || [];
  if (!revises.length) return { count: 0, byAdo: {} };
  const byAdo = {};
  for (const e of revises) {
    const id = e.ado_id || 'unknown';
    byAdo[id] = (byAdo[id] || 0) + 1;
  }
  return { count: revises.length, byAdo };
}

// ── Per-invocation model distribution (Pass B) ───────────────────────────────

function modelDistribution(events) {
  const dist = {};
  let tracked = 0, untracked = 0;
  let firstTracked = null;

  for (const e of events) {
    const m = e.model || null;
    if (m) {
      dist[m] = (dist[m] || 0) + 1;
      tracked++;
      if (!firstTracked || e.timestamp < firstTracked) firstTracked = e.timestamp;
    } else {
      untracked++;
    }
  }

  return {
    distribution:   dist,
    trackedCount:   tracked,
    untrackedCount: untracked,
    coverage:       events.length === 0 ? 'no-events'
                  : tracked === events.length ? 'full'
                  : tracked === 0             ? 'none'
                  : 'partial',
    firstTrackedAt: firstTracked,
  };
}

// ── Cost governance ───────────────────────────────────────────────────────────

function loadCostGovernance() {
  return safeJson(path.join(process.cwd(), '.claude', 'cost-governance.json'));
}

function estimateCosts(tokenGraph, costConfig, settingsEnv) {
  if (!costConfig) return { available: false, reason: 'cost-governance.json missing' };
  if (!tokenGraph || !tokenGraph.aggregates || !tokenGraph.aggregates.bySkill) {
    return { available: false, reason: 'Run /token-analysis to populate token data' };
  }

  const pricing     = costConfig.pricing || {};
  const bySkill     = tokenGraph.aggregates.bySkill || {};
  const modelMap    = {
    icea:    settingsEnv.ICEA_MODEL     || 'claude-opus-4-8',
    review:  settingsEnv.REVIEW_MODEL   || 'claude-sonnet-4-6',
    infra:   settingsEnv.INFRA_MODEL    || 'claude-haiku-4-5-20251001',
  };

  // Skill → model tier heuristic (conservative: skill names suggest tier)
  function modelForSkill(skillName) {
    const s = (skillName || '').toLowerCase();
    if (s.includes('icea-feature') || s.includes('icea-implement') || s.includes('rewrite')) return modelMap.icea;
    if (s.includes('review') || s.includes('critic') || s.includes('checkin')) return modelMap.review;
    if (s.includes('graph') || s.includes('setup') || s.includes('token')) return modelMap.infra;
    return modelMap.review; // default mid-tier
  }

  function rateFor(model) {
    return pricing[model] || { input_per_mtok: 3.0, output_per_mtok: 15.0 };
  }

  function computeCost(inputTok, outputTok, model) {
    const r = rateFor(model);
    return (inputTok / 1_000_000) * r.input_per_mtok + (outputTok / 1_000_000) * r.output_per_mtok;
  }

  let totalInput = 0, totalOutput = 0, totalCost = 0;
  const bySkillCost = {};

  for (const [skill, stats] of Object.entries(bySkill)) {
    const input  = stats.inputTokens  || stats.tokens || 0;
    const output = stats.outputTokens || 0;
    const model  = modelForSkill(skill);
    const cost   = computeCost(input, output, model);
    bySkillCost[skill] = { input, output, estimatedUSD: parseFloat(cost.toFixed(4)), model };
    totalInput  += input;
    totalOutput += output;
    totalCost   += cost;
  }

  const totalUSD     = parseFloat(totalCost.toFixed(2));
  const budget       = costConfig.monthly_token_budget;
  const alertPercent = costConfig.alert_at_percent || 80;
  const budgetStatus = budget
    ? (totalUSD >= budget               ? 'exceeded'
     : totalUSD >= budget * alertPercent / 100 ? 'alert'
     : 'ok')
    : null;

  return {
    available:       true,
    currency:        costConfig.currency || 'USD',
    pricingUpdated:  costConfig._pricing_updated || 'unknown',
    totalInputTok:   totalInput,
    totalOutputTok:  totalOutput,
    estimatedTotalUSD: totalUSD,
    monthlyBudget:   budget,
    alertAtPercent:  alertPercent,
    budgetStatus,
    bySkill:         bySkillCost,
    note:            'Estimates only — model-per-invocation tracking not yet active (Item 15). Skill→tier heuristic used.',
  };
}

// ── Model tier compliance ─────────────────────────────────────────────────────

function modelTierCompliance(settingsEnv) {
  const tiers = ['ICEA_MODEL', 'REVIEW_MODEL', 'INFRA_MODEL'];
  const set   = tiers.filter(k => settingsEnv[k]);
  const unset = tiers.filter(k => !settingsEnv[k]);
  return {
    allExplicit: unset.length === 0,
    set,
    unset,
    configured: Object.fromEntries(tiers.map(k => [k, settingsEnv[k] || null])),
  };
}

// ── Skill cost summary from token-graph ──────────────────────────────────────

function skillCostSummary(tokenGraph) {
  if (!tokenGraph || !tokenGraph.aggregates) return null;
  const agg = tokenGraph.aggregates;
  return {
    totalSessions:  Object.keys(tokenGraph.sessions || {}).length,
    skillBreakdown: agg.bySkill || null,
    topExpensive:   agg.recommendations?.topExpensive || null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const cutoff    = cutoffDate();
const audit     = loadAuditEvents();
const settings  = safeJson(path.join(process.cwd(), '.claude', 'settings.json')) || {};
const roles     = safeJson(path.join(process.cwd(), '.claude', 'ApprovalRoles.json')) || {};
const tokenGraph = safeJson(path.join(process.cwd(), 'token-analysis', 'token-graph.json'));

const events      = audit.filtered;
const byType      = groupByType(events);
const settingsEnv = settings.env || {};
const costConfig  = loadCostGovernance();

const result = {
  period: {
    since:  cutoff.toISOString().slice(0, 10),
    days:   daysArg ? parseInt(daysArg, 10) : 30,
    label:  sinceArg ? `since ${sinceArg}` : `last ${daysArg || 30} days`,
  },
  auditAvailable: audit.available,
  totalAuditFiles: audit.fileCount || 0,
  eventCount: events.length,
  allTimeEventCount: audit.all.length,

  // Governance events — grouped
  byType,
  bypassRate:    bypassRate(byType),
  revisionCycles: revisionCycles(byType),

  // People
  actors: actorSummary(events),
  approvalRoles: {
    techLeads:        roles.tech_leads        || [],
    securityOfficers: roles.security_officers || [],
  },

  // Model config
  models:             configuredModels(settingsEnv),
  modelCompliance:    modelTierCompliance(settingsEnv),
  modelDistribution:  modelDistribution(events),

  // Cost governance
  costEstimate: estimateCosts(tokenGraph, costConfig, settingsEnv),
  costConfig:   costConfig ? {
    currency:       costConfig.currency,
    monthlyBudget:  costConfig.monthly_token_budget,
    alertPercent:   costConfig.alert_at_percent,
    pricingUpdated: costConfig._pricing_updated,
  } : null,

  // Token efficiency (raw)
  tokenEfficiency: skillCostSummary(tokenGraph),

  // Finding counts from ledgers
  ledgers: {
    codeReview:  loadLedgerStats('CodeReviews/code-review-ledger.md'),
    security:    loadLedgerStats('security/security-ledger.md'),
    dynamicScan: loadLedgerStats('dynamic-scan/dynamic-scan-ledger.md'),
  },
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(0);
