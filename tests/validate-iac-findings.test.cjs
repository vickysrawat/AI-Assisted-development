#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/validate-iac-findings.cjs by calling validateIacFindings()
//                      directly. 7 test cases: valid batch accepted, missing-field batch rejected,
//                      empty array accepted, non-JSON string rejected, invalid id rejected,
//                      unresolvable path rejected, and performance test (50 findings < 500ms).
//                      Exits 0 if all pass, 1 if any fail.
// What it touches:     Reads scripts/validate-iac-findings.cjs. Creates temporary fixture files
//                      under os.tmpdir() for path-existence checks; removes them at end.
// What it does NOT do: No network calls, no git operations, no ledger writes, no .claude/ writes.
// APIs / commands:     Node stdlib: fs, os, path. require('../scripts/validate-iac-findings.cjs').
// How to verify:       node tests/validate-iac-findings.test.cjs -> "N passed · 0 failed", exit 0.

'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { validateIacFindings } = require('../scripts/validate-iac-findings.cjs');

let passed = 0;
let failed = 0;

// Create temp fixture files that actually exist on disk — needed for the path-existence check
const TMP_DIR   = path.join(os.tmpdir(), `iac-test-${process.pid}`);
const FIXTURE_1 = path.join(TMP_DIR, 'Dockerfile');
const FIXTURE_2 = path.join(TMP_DIR, 'deployment.yaml');
fs.mkdirSync(TMP_DIR, { recursive: true });
fs.writeFileSync(FIXTURE_1, 'FROM node:latest\n');
fs.writeFileSync(FIXTURE_2, 'apiVersion: apps/v1\n');

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
  id: 'SEC-CONTAINER',
  file: FIXTURE_1,
  line: 1,
  severity: 'High',
  rule: 'DOCKER-001',
  evidence: 'FROM node:latest',
  fix: 'FROM node:20.11-alpine3.19',
};
const FINDING_B = {
  fingerprint: 'FP-e5f6a7b8',
  id: 'SEC-IAC',
  file: FIXTURE_2,
  line: 5,
  severity: 'Critical',
  rule: 'K8S-001',
  evidence: 'value: mysecret',
  fix: 'valueFrom:\n  secretKeyRef:\n    name: my-secret\n    key: value',
};

// --- Required test cases (AC-F13) ---

// TC-1: valid batch accepted
// Two complete findings with all 8 fields, valid id/severity/fingerprint, real fixture paths
const r1 = validateIacFindings([{ ...FINDING_A }, { ...FINDING_B }]);
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
    id: 'SEC-IAC', file: FIXTURE_2, line: 5, severity: 'Critical',
    rule: 'K8S-001', evidence: 'value: mysecret', fix: 'valueFrom: secretKeyRef',
  },
];
const r2 = validateIacFindings(batchMissingFingerprint);
assert(
  'missing-field batch rejected',
  r2.valid === false && r2.error === 'MISSING_FIELD' && r2.finding_index === 1 && r2.field === 'fingerprint',
  JSON.stringify(r2),
);

// TC-3: empty array accepted
// No IaC findings is a valid, clean scan result — must not be treated as an error
const r3 = validateIacFindings([]);
assert(
  'empty array accepted',
  r3.valid === true && Array.isArray(r3.findings) && r3.findings.length === 0,
  JSON.stringify(r3),
);

// TC-4: non-JSON string rejected
// Raw non-JSON input (e.g. truncated sub-agent output) must be rejected with INVALID_JSON
const r4 = validateIacFindings('this is not json');
assert(
  'non-JSON string rejected',
  r4.valid === false && r4.error === 'INVALID_JSON',
  JSON.stringify(r4),
);

// --- Additional coverage tests ---

// TC-5: invalid id rejected (AC-F5, AC-F6)
// SEC-OTHER is not a valid pattern ID — only SEC-CONTAINER and SEC-IAC are accepted
const r5 = validateIacFindings([{ ...FINDING_A, id: 'SEC-OTHER' }]);
assert(
  'invalid id rejected',
  r5.valid === false && r5.error === 'INVALID_ID' && r5.finding_index === 0,
  JSON.stringify(r5),
);

// TC-6: unresolvable path rejected (AC-F12)
// A finding whose file does not exist on disk cannot be actioned by /fix or /dismiss
const r6 = validateIacFindings([{ ...FINDING_A, file: '/nonexistent/path/Dockerfile.never' }]);
assert(
  'unresolvable path rejected',
  r6.valid === false && r6.error === 'UNRESOLVABLE_PATH' && r6.finding_index === 0,
  JSON.stringify(r6),
);

// TC-7: 50 findings validated in <500ms (AC-NF2)
// Generates a 50-finding batch programmatically and asserts wall-clock time is under 500ms
const largeBatch = Array.from({ length: 50 }, (_, i) => ({
  fingerprint: 'FP-' + i.toString(16).padStart(8, '0'),
  id: i % 2 === 0 ? 'SEC-CONTAINER' : 'SEC-IAC',
  file: FIXTURE_1,
  line: i + 1,
  severity: 'Medium',
  rule: 'DOCKER-001',
  evidence: `COPY . /app  # finding ${i + 1}`,
  fix: 'COPY --chown=appuser:appgroup . /app',
}));
const t0 = Date.now();
validateIacFindings(largeBatch);
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
