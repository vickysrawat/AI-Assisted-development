#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/validate-sca-findings.cjs by calling validateScaFindings()
//                      directly. 7 test cases: valid batch accepted, missing-field batch rejected,
//                      empty array accepted, non-JSON string rejected, invalid id rejected,
//                      unresolvable path rejected, and performance test (50 findings < 500ms).
//                      Exits 0 if all pass, 1 if any fail.
// What it touches:     Reads scripts/validate-sca-findings.cjs. Creates temporary fixture files
//                      under os.tmpdir() for path-existence checks; removes them at end.
// What it does NOT do: No network calls, no git operations, no ledger writes, no .claude/ writes.
// APIs / commands:     Node stdlib: fs, os, path. require('../scripts/validate-sca-findings.cjs').
// How to verify:       node tests/validate-sca-findings.test.cjs -> "7 passed · 0 failed", exit 0.

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { validateScaFindings } = require('../scripts/validate-sca-findings.cjs');

let passed = 0;
let failed = 0;

// Create temp fixture files that actually exist on disk — needed for the path-existence check
const TMP_DIR   = path.join(os.tmpdir(), `sca-test-${process.pid}`);
const FIXTURE_1 = path.join(TMP_DIR, 'package.json');
const FIXTURE_2 = path.join(TMP_DIR, 'requirements.txt');
fs.mkdirSync(TMP_DIR, { recursive: true });
fs.writeFileSync(FIXTURE_1, '{"dependencies":{"lodash":"4.17.15"}}\n');
fs.writeFileSync(FIXTURE_2, 'requests==2.27.1\n');

/**
 * Asserts a named condition and tracks pass/fail totals.
 * Prints a checkmark on pass, an X with detail on fail.
 *
 * @param {string} name       Human-readable test case name
 * @param {boolean} condition True = pass, false = fail
 * @param {string} [detail]   Extra detail printed on failure for debugging
 */
function assert(name, condition, detail) {
  if (condition) {
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } else {
    failed++;
    process.stdout.write(`  ✗ ${name}\n      ${detail || ''}\n`);
  }
}

// Reusable valid findings — used as a base for multiple test cases
const FINDING_A = {
  fingerprint: 'FP-a1b2c3d4',
  id: 'SEC-DEP',
  file: FIXTURE_1,
  line: 1,
  severity: 'High',
  rule: 'CVE-2021-23337',
  evidence: 'lodash@4.17.15 — Prototype Pollution via argument pollution',
  fix: 'Upgrade to lodash@4.17.21',
};
const FINDING_B = {
  fingerprint: 'FP-e5f6a7b8',
  id: 'SEC-DEP',
  file: FIXTURE_2,
  line: 1,
  severity: 'Critical',
  rule: 'CVE-2023-32681',
  evidence: 'requests@2.27.1 — Unintended leak of Proxy-Authorization header',
  fix: 'Upgrade to requests@2.31.0',
};

// --- Required test cases (AC-F14) ---

// TC-1: valid batch accepted
// Two complete findings with all 8 fields, valid id/severity/fingerprint, real fixture paths
const r1 = validateScaFindings([{ ...FINDING_A }, { ...FINDING_B }]);
assert(
  'valid batch accepted',
  r1.valid === true && Array.isArray(r1.findings) && r1.findings.length === 2,
  JSON.stringify(r1),
);

// TC-2: missing-field batch rejected
// finding[1] has the fingerprint field removed — entire batch must be rejected with MISSING_FIELD
const batchMissingFingerprint = [
  { ...FINDING_A },
  {
    // fingerprint intentionally omitted
    id: 'SEC-DEP', file: FIXTURE_2, line: 1, severity: 'Critical',
    rule: 'CVE-2023-32681', evidence: 'requests@2.27.1 — leak', fix: 'Upgrade to requests@2.31.0',
  },
];
const r2 = validateScaFindings(batchMissingFingerprint);
assert(
  'missing-field batch rejected',
  r2.valid === false && r2.error === 'MISSING_FIELD' && r2.finding_index === 1 && r2.field === 'fingerprint',
  JSON.stringify(r2),
);

// TC-3: empty array accepted
// No SCA findings is a valid, clean scan result — must not be treated as an error
const r3 = validateScaFindings([]);
assert(
  'empty array accepted',
  r3.valid === true && Array.isArray(r3.findings) && r3.findings.length === 0,
  JSON.stringify(r3),
);

// TC-4: non-JSON string rejected
// Raw non-JSON input (e.g. truncated sub-agent output) must be rejected with INVALID_JSON
const r4 = validateScaFindings('this is not json');
assert(
  'non-JSON string rejected',
  r4.valid === false && r4.error === 'INVALID_JSON',
  JSON.stringify(r4),
);

// --- Additional coverage tests ---

// TC-5: invalid id rejected (AC-F7)
// SEC-CONTAINER is not a valid SCA finding type — only SEC-DEP is accepted
const r5 = validateScaFindings([{ ...FINDING_A, id: 'SEC-CONTAINER' }]);
assert(
  'invalid id rejected',
  r5.valid === false && r5.error === 'INVALID_ID' && r5.finding_index === 0,
  JSON.stringify(r5),
);

// TC-6: unresolvable path rejected (AC-F12)
// A finding whose manifest file does not exist on disk cannot be actioned by /fix or /dismiss
const r6 = validateScaFindings([{ ...FINDING_A, file: '/nonexistent/path/package.json.never' }]);
assert(
  'unresolvable path rejected',
  r6.valid === false && r6.error === 'UNRESOLVABLE_PATH' && r6.finding_index === 0,
  JSON.stringify(r6),
);

// TC-7: 50 findings validated in <500ms (AC-NF2)
// Generates a 50-finding batch programmatically and asserts wall-clock time is under 500ms
const largeBatch = Array.from({ length: 50 }, (_, i) => ({
  fingerprint: 'FP-' + i.toString(16).padStart(8, '0'),
  id: 'SEC-DEP',
  file: FIXTURE_1,
  line: 1,
  severity: 'Medium',
  rule: `CVE-2021-${String(i + 1).padStart(5, '0')}`,
  evidence: `lodash@4.17.15 — finding ${i + 1}`,
  fix: 'Upgrade to lodash@4.17.21',
}));
const t0 = Date.now();
validateScaFindings(largeBatch);
const elapsed = Date.now() - t0;
assert(
  '50 findings validated in <500ms (AC-NF2)',
  elapsed < 500,
  `elapsed: ${elapsed}ms`,
);

// --- Cleanup temp fixtures ---
fs.rmSync(TMP_DIR, { recursive: true, force: true });

// --- Summary ---
process.stdout.write(`\n  ${passed} passed · ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
