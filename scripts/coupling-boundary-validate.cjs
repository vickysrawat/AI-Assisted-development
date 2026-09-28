#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Validates that critical deployment coupling patterns
//                      (required_cluster_splits from the checkpoint payload) are respected in
//                      the target cluster decomposition (cluster-spec.json). For each required
//                      split {concern_a, concern_b}, verifies those two concerns appear in
//                      DIFFERENT clusters. Concern names are normalized (lowercase, non-alnum→hyphen)
//                      for case-insensitive matching between the coupling analysis and cluster naming.
// What it touches:     Reads ONE checkpoint JSON and ONE cluster-spec.json. Never writes.
// What it does NOT do: No network. No git. No file mutations. No LLM calls.
// APIs / commands:     Node stdlib: fs, path. No third-party dependencies.
// How to verify:       node tests/coupling-boundary-validate.test.cjs -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const path = require('path');

const JSON_OUT = process.argv.includes('--json');
const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

// Normalise a concern name for comparison: lowercase + replace non-alnum with hyphen.
// "Business Logic" → "business-logic", "data_access" → "data-access".
function normalise(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

try {
  const checkpointPath = arg('checkpoint');
  const clusterSpecPath = arg('cluster-spec');

  if (!checkpointPath) throw new Error('requires --checkpoint=<path>');
  if (!clusterSpecPath) throw new Error('requires --cluster-spec=<path>');
  if (!fs.existsSync(checkpointPath))  throw new Error(`checkpoint not found: ${checkpointPath}`);
  if (!fs.existsSync(clusterSpecPath)) throw new Error(`cluster-spec not found: ${clusterSpecPath}`);

  let checkpoint, clusterSpec;
  try { checkpoint  = JSON.parse(fs.readFileSync(checkpointPath,  'utf8')); }
  catch (e) { throw new Error(`checkpoint is not valid JSON: ${e.message}`); }
  try { clusterSpec = JSON.parse(fs.readFileSync(clusterSpecPath, 'utf8')); }
  catch (e) { throw new Error(`cluster-spec is not valid JSON: ${e.message}`); }

  // DECISION: required_cluster_splits lives in payload.rewrite (the skill namespace).
  // Options: (A) top-level field — rejected: breaks the merge-write isolation contract;
  //          (B) payload.<skill> — chosen: consistent with all other rewrite state.
  const splits   = checkpoint?.payload?.rewrite?.required_cluster_splits || [];
  const clusters = clusterSpec?.clusters || [];

  if (splits.length === 0) {
    const result = {
      op: 'validate-coupling-boundaries', status: 'ok',
      splits_checked: 0, violations: [], unmapped: [], clusters_count: clusters.length,
      message: 'No required_cluster_splits in checkpoint — nothing to validate.',
    };
    if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else process.stdout.write(`status: ok\nsplits_checked: 0\n`);
    process.exit(0);
  }

  // Build a map: normalised concern name → cluster name (the raw name from cluster-spec).
  // Each cluster maps to exactly one concern name (its own name, normalised).
  const normToCluster = new Map();
  for (const cluster of clusters) {
    const key = normalise(cluster.name);
    if (key) normToCluster.set(key, cluster.name);
  }

  const violations = [];
  const unmapped   = [];

  for (const split of splits) {
    const normA = normalise(split.concern_a);
    const normB = normalise(split.concern_b);

    const clusterA = normToCluster.get(normA);
    const clusterB = normToCluster.get(normB);

    if (!clusterA) { unmapped.push({ concern: split.concern_a, split_source: split.source || null }); continue; }
    if (!clusterB) { unmapped.push({ concern: split.concern_b, split_source: split.source || null }); continue; }

    // Violation: both concerns map to the same cluster name.
    if (clusterA === clusterB) {
      violations.push({
        concern_a:      split.concern_a,
        concern_b:      split.concern_b,
        shared_cluster: clusterA,
        source:         split.source || null,
        message:        `"${split.concern_a}" and "${split.concern_b}" must be in different clusters — both found in "${clusterA}"`,
      });
    }
  }

  const hasIssues = violations.length > 0 || unmapped.length > 0;
  const result = {
    op: 'validate-coupling-boundaries',
    status: hasIssues ? 'invalid' : 'ok',
    splits_checked: splits.length,
    violations,
    unmapped,
    clusters_count: clusters.length,
  };

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(`status: ${result.status}\nsplits_checked: ${splits.length}\nviolations: ${violations.length}\nunmapped: ${unmapped.length}\n`);
    for (const v of violations) process.stdout.write(`  VIOLATION: ${v.message}\n`);
    for (const u of unmapped)   process.stdout.write(`  UNMAPPED: concern "${u.concern}" not found in cluster-spec.json — cluster names must use concern vocabulary\n`);
  }

  process.exit(hasIssues ? 1 : 0);

} catch (e) {
  process.stderr.write(`error: ${e.message}\n`);
  process.exit(1);
}
