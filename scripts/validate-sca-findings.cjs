// SCRIPT REVIEW
// What it does:        Validates a batch of SCA findings (JSON array) produced by the
//                      security skill's SCA Scan sub-agent before any findings are written
//                      to security/security-ledger.md. Checks all 8 required fields per
//                      finding, validates id/severity/fingerprint format, and verifies each
//                      file path exists on disk. Uses all-or-nothing semantics — a single
//                      malformed finding rejects the entire batch. On failure, writes the raw
//                      sub-agent output to .claude/logs/sca-scan-{YYYY-MM-DD}.md for review.
// What it touches:     Reads the input file specified by --input-file=<path>.
//                      On failure: writes .claude/logs/sca-scan-{YYYY-MM-DD}.md (creates
//                      .claude/logs/ if it does not exist). On success: writes nothing.
// What it does NOT do: No network calls. No git operations. Does not write to the security
//                      ledger (that is the caller's responsibility). Does not modify the
//                      input file. No registry or environment changes.
// APIs / commands:     Node stdlib: fs.readFileSync, fs.writeFileSync, fs.existsSync,
//                      fs.mkdirSync. JSON.parse. process.argv, process.exit, process.stdout,
//                      process.stderr. No external executables.
// How to verify:       node scripts/validate-sca-findings.cjs --input-file=/tmp/test.json
//                      with a valid JSON array -> exits 0, prints "VALID N".
//                      With malformed JSON -> exits 1, prints advisory, writes .claude/logs/.

'use strict';

const fs   = require('fs');
const path = require('path');

// All 8 required fields — every finding must have all of these or the batch is rejected (AC-F12)
const REQUIRED_FIELDS = ['fingerprint', 'id', 'file', 'line', 'severity', 'rule', 'evidence', 'fix'];

// Valid pattern ID — SCA findings always use SEC-DEP (AC-F7)
const VALID_IDS = new Set(['SEC-DEP']);

// Valid severity values — must match ledger schema
const VALID_SEVERITIES = new Set(['Critical', 'High', 'Medium', 'Low']);

// Fingerprint must be exactly FP- followed by 8 lowercase hex characters
const FINGERPRINT_RE = /^FP-[0-9a-f]{8}$/;

/**
 * Validates a batch of SCA findings produced by the sub-agent.
 *
 * All-or-nothing semantics: a single malformed finding rejects the entire batch
 * so that no partial or unactionable findings reach the security ledger.
 * Findings that pass validation can be actioned by /fix and /dismiss, and
 * will trigger checkin Check D when Status is Open.
 *
 * Accepts either a JSON string (CLI invocation path) or an already-parsed
 * value (test invocation path) to avoid forcing tests to re-serialise fixtures.
 *
 * @param {string|any} input  JSON string or pre-parsed value
 * @returns {{ valid: boolean, findings?: object[], error?: string, finding_index?: number, field?: string, file?: string }}
 */
function validateScaFindings(input) {
  // DECISION: Accept both raw JSON string and pre-parsed value
  // Options considered:
  //   A) String only — rejected: tests must serialise objects before calling; extra noise
  //   B) Parsed value only — rejected: CLI caller must parse before passing; asymmetric API
  //   C) Accept both via typeof check — chosen: simple, zero cost, symmetric for callers
  let findings;
  if (typeof input === 'string') {
    try {
      findings = JSON.parse(input);
    } catch (_) {
      return { valid: false, error: 'INVALID_JSON' };
    }
  } else {
    findings = input;
  }

  // Result must be an array — sub-agent is required to return [] or [finding, ...]
  if (!Array.isArray(findings)) {
    return { valid: false, error: 'NOT_AN_ARRAY' };
  }

  // An empty array is valid — no SCA findings is a clean, normal scan result
  if (findings.length === 0) {
    return { valid: true, findings: [] };
  }

  // Validate each finding in index order — first failure rejects the entire batch
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];

    // All 8 required fields must be present and non-null (AC-F12)
    for (const field of REQUIRED_FIELDS) {
      if (f[field] === undefined || f[field] === null) {
        return { valid: false, error: 'MISSING_FIELD', finding_index: i, field };
      }
    }

    // id must be SEC-DEP — the only valid SCA finding type (AC-F7)
    if (!VALID_IDS.has(f.id)) {
      return { valid: false, error: 'INVALID_ID', finding_index: i };
    }

    // severity must be one of the four recognised values
    if (!VALID_SEVERITIES.has(f.severity)) {
      return { valid: false, error: 'INVALID_SEVERITY', finding_index: i };
    }

    // fingerprint must match FP-[0-9a-f]{8} — format required for /fix and /dismiss
    if (!FINGERPRINT_RE.test(f.fingerprint)) {
      return { valid: false, error: 'INVALID_FINGERPRINT', finding_index: i };
    }

    // file path must exist on disk — a finding for a non-existent manifest cannot be actioned
    if (!fs.existsSync(f.file)) {
      return { valid: false, error: 'UNRESOLVABLE_PATH', finding_index: i, file: f.file };
    }
  }

  return { valid: true, findings };
}

/**
 * CLI entry point. Reads --input-file=<path>, validates the JSON batch, and exits.
 *
 * On invalid batch (AC-F13):
 *   - Writes raw input to .claude/logs/sca-scan-{YYYY-MM-DD}.md for manual review
 *   - Prints the advisory message to stdout so SKILL.md can surface it
 *   - Exits with code 1 so SKILL.md skips the ledger merge
 */
function runCli() {
  // Locate --input-file=<path> argument
  const inputArg = process.argv.find(a => a.startsWith('--input-file='));
  if (!inputArg) {
    process.stderr.write('validate-sca-findings: --input-file=<path> is required\n');
    process.exit(1);
  }
  const inputFilePath = inputArg.slice('--input-file='.length);

  let rawInput;
  try {
    rawInput = fs.readFileSync(inputFilePath, 'utf8');
  } catch (err) {
    process.stderr.write(`validate-sca-findings: cannot read ${inputFilePath}: ${err.message}\n`);
    process.exit(1);
  }

  const result = validateScaFindings(rawInput);

  if (result.valid) {
    // Print finding count for SKILL.md to read and include in "N finding(s) written to ledger"
    process.stdout.write(`VALID ${(result.findings || []).length}\n`);
    process.exit(0);
  }

  // Invalid batch — write raw output to .claude/logs/ for manual review (AC-F13)
  const today   = new Date().toISOString().slice(0, 10);
  const logDir  = path.join('.claude', 'logs');
  const logPath = path.join(logDir, `sca-scan-${today}.md`);

  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logContent = [
      `# SCA Scan Raw Output — ${today}`,
      '',
      '```json',
      rawInput,
      '```',
      '',
      `Validation error: ${JSON.stringify(result)}`,
      '',
    ].join('\n');
    fs.writeFileSync(logPath, logContent, 'utf8');
  } catch (writeErr) {
    // Non-fatal — log write failure does not change the exit code or the advisory message
    process.stderr.write(`validate-sca-findings: could not write log: ${writeErr.message}\n`);
  }

  // Advisory message that SKILL.md surfaces to the developer
  process.stdout.write(`SCA scan output invalid — manual review required, see .claude/logs/sca-scan-${today}.md\n`);
  process.exit(1);
}

module.exports = { validateScaFindings };

// Only run CLI entry point when invoked directly, not when require()'d by tests
if (require.main === module) {
  runCli();
}
