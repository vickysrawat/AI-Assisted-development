#!/usr/bin/env node
// scripts/signal-write.cjs — write one ICEA quality signal to .claude/signals/
//
// Three signal types:
//   gap          — icea-implement found an Example that cannot produce a real assertion
//   revision     — icea-revise ran; records which ICEA section changed and inferred cause
//   story-quality — icea-feature needed feature-clarifying questions beyond the 3 identifiers
//
// Signals accumulate in .claude/signals/ (committed, team-shared) between Dream runs.
// Dream reads the folder, updates memory/topic-signals.md tally, promotes patterns that
// reach the threshold to project-knowledge.md, then DELETES the processed signal files.
// The folder stays lean — bounded by velocity between Dream runs, not total project history.
//
// Gap category taxonomy:
//   dependency-contract-missing  — Example calls a service; Context lacks its return contract
//   return-shape-unspecified     — Result described as "success/failure"; no object shape
//   edge-case-missing            — No null/error/boundary Example for a method that needs one
//   test-data-unspecified        — Example references data ("a user") without defining its shape
//   mock-contract-missing        — Unit test needs a mock; interface not derivable from ICEA
//
// Revision category taxonomy:
//   context-incomplete     — Context section changed (missing tech detail, dependency, etc.)
//   examples-underspecified — Examples section changed (input/output pairs not concrete)
//   ac-not-testable        — Acceptance Criteria changed (not measurable or too vague)
//   intent-unclear         — Intent section changed (feature was misunderstood)
//   scope-changed          — Post-approval revision due to scope change
//   tech-lead-feedback     — Post-approval revision due to Tech Lead or Product feedback
//
// Story-quality category:
//   clarifications-required — Feature-clarifying questions were needed (use --count N)
//
// Usage:
//   node "$PLUGIN_DIR/scripts/signal-write.cjs" \
//     --type gap \
//     --category dependency-contract-missing \
//     --ado-id 1234 \                  ← optional; null when ADO not in context
//     --detail "IUserRepository.GetById — return contract not in Context"
//
//   node "$PLUGIN_DIR/scripts/signal-write.cjs" \
//     --type revision \
//     --category context-incomplete \  ← no --ado-id: still useful for pattern learning
//     --detail "ICEA edited outside formal skill flow"
//
// --ado-id is OPTIONAL for gap and story-quality signals (pattern still learned without attribution).
// Revision signals without an ADO ID are dropped — they cannot be attributed to any ICEA.
//
// Output: .claude/signals/ADO-{ID}-signals.jsonl    (one append-only file per ADO)
//         .claude/signals/unattributed-signals.jsonl (gap/story-quality without ADO ID)
//         Each line is one compact JSON object (JSON Lines format).
// Always exits 0 — never blocks skill flows.

'use strict';

const fs   = require('fs');
const path = require('path');

function arg(name) {
  const idx = process.argv.indexOf('--' + name);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

const type     = arg('type');      // gap | revision | story-quality
const category = arg('category');  // taxonomy category (see above)
const adoId    = arg('ado-id');
const detail   = arg('detail');    // brief description of the specific signal
const count    = arg('count');     // for story-quality: number of clarifying questions

if (!type || !category) {
  process.stderr.write('signal-write: --type and --category are required (--ado-id is optional)\n');
  process.exit(0);
}

try {
  // Revision signals without an ADO ID cannot be attributed to any ICEA — not useful.
  // gap and story-quality signals are still valuable for category-level pattern learning without attribution.
  if (!adoId && type === 'revision') process.exit(0);

  const entry = {
    timestamp:  new Date().toISOString(),
    type,
    category,
    ado_id:     adoId || null,
    detail:     detail || null,
    count:      count ? parseInt(count, 10) : null,
  };

  const signalsDir = path.join(process.cwd(), '.claude', 'signals');
  fs.mkdirSync(signalsDir, { recursive: true });

  // Append-only JSONL: one file per ADO groups all signals for Dream to read in one pass.
  // gap/story-quality without ADO goes to unattributed-signals.jsonl for aggregate pattern learning.
  const filename = adoId ? 'ADO-' + adoId + '-signals.jsonl' : 'unattributed-signals.jsonl';
  fs.appendFileSync(
    path.join(signalsDir, filename),
    JSON.stringify(entry) + '\n',
    'utf8'
  );
} catch (e) {
  process.stderr.write('signal-write: ' + e.message + '\n');
}

process.exit(0);
