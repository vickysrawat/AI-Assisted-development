#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/graph-sync-deterministic.cjs external-node sync from
//                      architecture-data.md — table "###" headings still become database nodes,
//                      while "### ..." sub-headings inside "## Data Lineage" do not.
// What it touches:     Creates a throwaway project under os.tmpdir()/graph-sync-det-test-{pid}/
//                      (.claude/graph/graph.json + .claude/architecture/architecture-data.md);
//                      removed at start and end of the run.
// What it does NOT do: No network. No git. No LLM. No writes outside the temp dir (no
//                      .claude/plugin-path.txt, so the edge-extraction spawn is skipped).
// APIs / commands:     Node stdlib: os.tmpdir, fs, path, child_process.spawnSync.
// How to verify:       node tests/graph-sync-deterministic.test.cjs  -> exit 0 and "N passed · 0 failed"

'use strict';
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'graph-sync-deterministic.cjs');
const DIR    = path.join(os.tmpdir(), `graph-sync-det-test-${process.pid}`);
let pass = 0, fail = 0;

function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else       { fail++; console.log(`  ✗ ${name}\n      ${String(detail)}`); }
}

// Sets up a minimal project with the given architecture-data.md, runs the script, returns node ids.
function syncWith(dataDoc) {
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIR, '.claude', 'graph'), { recursive: true });
  fs.mkdirSync(path.join(DIR, '.claude', 'architecture'), { recursive: true });
  fs.writeFileSync(path.join(DIR, '.claude', 'graph', 'graph.json'),
    JSON.stringify({ meta: {}, nodes: [], edges: [] }, null, 2));
  fs.writeFileSync(path.join(DIR, '.claude', 'architecture', 'architecture-data.md'), dataDoc);
  const r = spawnSync('node', [SCRIPT], { cwd: DIR, encoding: 'utf8' });
  const graph = JSON.parse(fs.readFileSync(path.join(DIR, '.claude', 'graph', 'graph.json'), 'utf8'));
  return { code: r.status, ids: graph.nodes.map(n => n.id), stderr: r.stderr };
}

const DOC = [
  '# Architecture — Data Model', '',
  '## Entities / Tables', '',
  '### Orders', '', '| Column | Type |', '|---|---|', '',
  '## Data Lineage', '',
  '### Business data — from source to sink', '',
  '```mermaid', 'flowchart LR', '    A --> B', '```', '',
  '### Retention', '',
  '## Key Aggregates', '',
  '### Customers', '',
].join('\n');

console.log('graph-sync-deterministic — architecture-data.md external nodes');

const withLineage = syncWith(DOC);
assert('exit 0', withLineage.code === 0, withLineage.stderr);
assert('table heading before Data Lineage becomes a node', withLineage.ids.includes('orders'), withLineage.ids);
assert('heading after Data Lineage still becomes a node', withLineage.ids.includes('customers'), withLineage.ids);
assert('Data Lineage sub-headings are not nodes',
  !withLineage.ids.some(id => id.startsWith('business-data') || id === 'retention'), withLineage.ids);

const lineageLast = syncWith(DOC.replace(/## Key Aggregates[\s\S]*$/, ''));
assert('Data Lineage as last section — sub-headings still excluded',
  !lineageLast.ids.includes('retention') && lineageLast.ids.includes('orders'), lineageLast.ids);

const noLineage = syncWith('# Data\n\n### Orders\n\n### Retention\n');
assert('doc without Data Lineage is parsed unchanged',
  noLineage.ids.includes('orders') && noLineage.ids.includes('retention'), noLineage.ids);

fs.rmSync(DIR, { recursive: true, force: true });
console.log(`\n  ${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
