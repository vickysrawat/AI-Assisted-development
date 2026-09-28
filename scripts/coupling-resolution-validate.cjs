#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Validates structural completeness of coupling resolution decisions in the
//                      checkpoint payload. Checks that every critical/major coupling pattern has
//                      a resolution_approach set; that facade couplings have named
//                      external_dependencies[] with migration_status per consumer; and that
//                      the decision_log contains at least one coupling-resolution entry.
//                      Called at the end of Step 1.5 before setting coupling_resolution_confirmed.
// What it touches:     Reads ONE checkpoint JSON file. Never writes.
// What it does NOT do: No network. No git. No file mutations. No LLM calls.
// APIs / commands:     Node stdlib: fs, path. No third-party dependencies.
// How to verify:       node tests/coupling-resolution-validate.test.cjs -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const path = require('path');

const JSON_OUT = process.argv.includes('--json');
const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const VALID_APPROACHES  = new Set(['replace', 'facade', 'retain', 'defer']);
const VALID_MIG_STATUS  = new Set(['in_scope', 'out_of_scope', 'unknown']);

try {
  const checkpointPath = arg('checkpoint');
  if (!checkpointPath) throw new Error('requires --checkpoint=<path>');
  if (!fs.existsSync(checkpointPath)) throw new Error(`checkpoint not found: ${checkpointPath}`);

  let checkpoint;
  try { checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8')); }
  catch (e) { throw new Error(`checkpoint is not valid JSON: ${e.message}`); }

  const patterns  = checkpoint?.payload?.rewrite?.coupling_patterns || [];
  const decLog    = checkpoint?.decision_log || [];
  const issues    = [];
  let   checked   = 0;

  // Only critical and major couplings require a resolution decision.
  // Minor couplings are informational and do not block.
  const reviewable = patterns.filter(p => p.severity === 'critical' || p.severity === 'major');

  for (const p of reviewable) {
    checked++;
    const id = p.id || p.name || `(unnamed)`;

    // DECISION: resolution_approach validation
    // Options considered:
    //   A) Accept any non-null value — rejected: typos silently pass (e.g. "replaced" vs "replace")
    //   B) Validate against enum — chosen: explicit allowed set prevents drift
    if (!p.resolution_approach) {
      issues.push({ id, field: 'resolution_approach', problem: 'missing — must be replace|facade|retain|defer' });
      continue;
    }
    if (!VALID_APPROACHES.has(p.resolution_approach)) {
      issues.push({ id, field: 'resolution_approach', problem: `invalid value "${p.resolution_approach}" — must be replace|facade|retain|defer` });
    }

    // facade couplings must name the external consumers they are protecting
    if (p.resolution_approach === 'facade') {
      const deps = p.external_dependencies;
      if (!deps || !Array.isArray(deps) || deps.length === 0) {
        issues.push({ id, field: 'external_dependencies', problem: 'facade resolution requires at least one external_dependency entry' });
      } else {
        for (const dep of deps) {
          if (!dep.system_name || dep.system_name.trim() === '') {
            issues.push({ id, field: 'external_dependencies[].system_name', problem: 'system_name is missing or empty' });
          }
          if (!VALID_MIG_STATUS.has(dep.migration_status)) {
            issues.push({ id, field: 'external_dependencies[].migration_status',
              problem: `"${dep.migration_status}" is not valid — must be in_scope|out_of_scope|unknown` });
          }
        }
      }
    }
  }

  // Verify at least one decision_log entry references coupling resolution.
  // Any entry containing "coupling" in any field is sufficient — we don't enforce
  // a specific schema on decision_log, only that a coupling decision was recorded.
  const hasCouplingLogEntry = decLog.some(e => JSON.stringify(e).toLowerCase().includes('coupling'));
  if (reviewable.length > 0 && !hasCouplingLogEntry) {
    issues.push({ id: 'decision_log', field: 'decision_log', problem: 'no coupling-resolution entry found — Coupling Resolution Gate must write a decision_log entry' });
  }

  const result = {
    op: 'validate-coupling-resolution',
    status: issues.length > 0 ? 'invalid' : 'ok',
    checked_count: checked,
    issue_count: issues.length,
    issues,
  };

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(`status: ${result.status}\nchecked: ${checked}\nissues: ${issues.length}\n`);
    for (const i of issues) process.stdout.write(`  ISSUE [${i.id}] ${i.field}: ${i.problem}\n`);
  }

  process.exit(issues.length > 0 ? 1 : 0);

} catch (e) {
  process.stderr.write(`error: ${e.message}\n`);
  process.exit(1);
}
