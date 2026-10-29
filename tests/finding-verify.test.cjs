#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Builds a tiny throwaway repo (Python + CommonJS + Dockerfile) and fixture ledgers in
//                      the OS temp dir, runs scripts/finding-verify.cjs (check + audit-ledger) against them,
//                      and asserts each grounding rule: verbatim/unique snippet, indentation drift, invented
//                      symbols, invented keyword args, "..." placeholders, comment-only fixes, declared
//                      external APIs, needs-confirmation routing, config-file skip, syntax-breaking fixes,
//                      fingerprint computation + collision suffix, hand-assigned ID detection. Exit 0 = pass.
// What it touches:     Writes fixture files under a throwaway OS-temp dir (removed at start and end).
// What it does NOT do: No network, no git, no mutation outside the temp dir.
// APIs / commands:     Node stdlib: os, fs, path, crypto, child_process.spawnSync('node' / 'python', ...).
// How to verify:       node tests/finding-verify.test.cjs  -> exit 0 and "N passed · 0 failed".

'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'finding-verify.cjs');
const DIR = path.join(os.tmpdir(), `finding-verify-test-${process.pid}`);
const REPO = path.join(DIR, 'repo');
let pass = 0, fail = 0;

function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      ${detail}`); }
}
function write(rel, text) {
  const p = path.join(REPO, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}
function run(mode, extra) {
  const r = spawnSync('node', [SCRIPT, mode, `--root=${REPO}`, ...extra], { encoding: 'utf8' });
  let json = null; try { json = JSON.parse(r.stdout); } catch (_) {}
  return { json, code: r.status, stderr: r.stderr };
}
function check(findings, extra = []) {
  const f = path.join(DIR, 'findings.json');
  fs.writeFileSync(f, JSON.stringify(findings));
  return run('check', [`--findings=${f}`, ...extra]);
}
const J = x => JSON.stringify(x);
const sha = s => 'FP-' + crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const pythonAvailable = ['python', 'python3', 'py'].some(exe => {
  const r = spawnSync(exe, ['-I', '-c', 'import ast'], { timeout: 20000, stdio: 'ignore' });
  return !r.error && r.status === 0;
});

// ---------------------------------------------------------------------------
// Fixture repo
// ---------------------------------------------------------------------------
fs.rmSync(DIR, { recursive: true, force: true });
write('app/svc.py', [
  'def upsert(items, batch=False):',
  '    for item in items:',
  '        save(item)',
  '',
  '',
  'def save(item):',
  '    return item',
  '',
  '',
  'def dup_a():',
  '    x = 1',
  '',
  '',
  'def dup_b():',
  '    x = 1',
  '',
].join('\n'));
write('web/util.cjs', [
  'function total(list) {',
  '  return list.reduce((a, b) => a + b, 0)',
  '}',
  'module.exports = { total }',
  '',
].join('\n'));
write('Dockerfile', 'FROM python:3.12-slim\nCMD ["run"]\n');
write('package.json', '{\n  "dependencies": {\n    "lodash": "^4.17.20",\n    "react-dom": "18.2.0"\n  }\n}\n');
write('package-lock.json', '{\n  "packages": {\n    "node_modules/minimist": {\n      "version": "1.2.5"\n    }\n  }\n}\n');

// ---------------------------------------------------------------------------
// One check() run covers every single-finding case (each run starts Python once for the syntax probe)
// ---------------------------------------------------------------------------
const base = { checker: 'LOGIC_ERROR', file: 'app/svc.py', category: 'Logic', short_description: 'example defect' };
const CALL = '        save(item)';
const GOOD = '        save(item) if item else None';
const JS_LINE = '  return list.reduce((a, b) => a + b, 0)';
const CASES = {
  sound:        { ...base, line: 3, vulnerable_code: CALL, fix: GOOD },
  condensed:    { ...base, vulnerable_code: 'for item in items: save(item)', fix: 'pass' },
  indent:       { ...base, vulnerable_code: 'for item in items:\nsave(item)', fix: 'pass' },
  ambiguous:    { ...base, vulnerable_code: '    x = 1', fix: '    x = 2' },
  invented:     { ...base, vulnerable_code: CALL, fix: '        save(PendingUpsert.model_validate(item))' },
  badKwarg:     { ...base, vulnerable_code: CALL, fix: '        save(item, conn=item)' },
  goodKwarg:    { ...base, vulnerable_code: CALL, fix: '        upsert([item], batch=True)' },
  placeholder:  { ...base, vulnerable_code: CALL, fix: '        save(...)' },
  spread:       { ...base, file: 'web/util.cjs', vulnerable_code: JS_LINE, fix: '  return [...list].reduce((a, b) => a + b, 0)' },
  commentOnly:  { ...base, vulnerable_code: CALL, fix: '# delete this function and its export' },
  noFix:        { ...base, vulnerable_code: CALL },
  external:     { ...base, vulnerable_code: CALL, fix: '        run_in_threadpool(save, item)', external_symbols: ['run_in_threadpool'] },
  question:     { ...base, vulnerable_code: CALL, fix: GOOD, needs_confirmation: 'Is a falsy item allowed?' },
  nvTag:        { ...base, short_description: 'maybe wrong [Needs Verification]', vulnerable_code: CALL, fix: GOOD },
  dockerfile:   { ...base, checker: 'CONTAINER_ROOT', file: 'Dockerfile', vulnerable_code: 'CMD ["run"]', fix: 'RUN useradd -r app\nUSER app\nCMD ["run"]' },
  jsSyntax:     { ...base, file: 'web/util.cjs', vulnerable_code: JS_LINE, fix: '  return list.reduce((a, b) => a + b, 0' },
  pySyntax:     { ...base, vulnerable_code: '    for item in items:\n        save(item)', fix: '    """Docstring only."""\n        save(item)' },
  wrongLine:    { ...base, line: 40, vulnerable_code: CALL, fix: GOOD },
  missingFile:  { ...base, file: 'app/nope.py', vulnerable_code: 'x', fix: 'y' },
  missingField: { file: 'app/svc.py', vulnerable_code: 'x' },
  // SCA dependency findings (security skill)
  depDeclared:  { kind: 'dependency', checker: 'CVE-2021-23337', file: 'package.json', category: 'SEC-DEP',
                  short_description: 'lodash@4.17.20', package: 'lodash', version: '4.17.20', fix: 'Upgrade to lodash@4.17.21' },
  depEvidence:  { kind: 'dependency', checker: 'CVE-2021-23337', file: 'package.json', category: 'SEC-DEP',
                  short_description: 'lodash@4.17.20', evidence: 'lodash@4.17.20 — command injection in template', fix: 'Upgrade to lodash@4.17.21' },
  depWrongVer:  { kind: 'dependency', checker: 'CVE-2020-8203', file: 'package.json', category: 'SEC-DEP',
                  short_description: 'lodash@4.17.15', package: 'lodash', version: '4.17.15', fix: 'Upgrade' },
  depPrefix:    { kind: 'dependency', checker: 'CVE-X', file: 'package.json', category: 'SEC-DEP',
                  short_description: 'react@18.2.0', package: 'react', version: '18.2.0', fix: 'Upgrade' },
  depLockfile:  { kind: 'dependency', checker: 'CVE-2021-44906', file: 'package-lock.json', category: 'SEC-DEP',
                  short_description: 'minimist@1.2.5', package: 'minimist', version: '1.2.5', fix: 'Upgrade to minimist@1.2.6' },
  depNoPkg:     { kind: 'dependency', checker: 'CVE-X', file: 'package.json', category: 'SEC-DEP', short_description: 'unknown', fix: 'Upgrade' },
};
const names = Object.keys(CASES);
const batch = check(names.map(n => CASES[n]));
const R = Object.fromEntries(names.map((n, i) => [n, (batch.json?.results || []).find(r => r.index === i) || {}]));

// --- 1. sound finding → fingerprint, ID computed per fingerprint-spec.md
assert('exact snippet + real fix → fingerprint', R.sound.verdict === 'fingerprint', J(R.sound));
assert('FP ID is SHA-1 of checker|file|category|short_description',
  R.sound.fp === sha('LOGIC_ERROR|app/svc.py|Logic|example defect'), R.sound.fp);
assert('python fix is syntax-probed (parses, or skipped when python is absent)',
  pythonAvailable ? R.sound.fix?.apply?.status === 'parses' : R.sound.fix?.apply?.status === 'skipped', J(R.sound.fix));

// --- 2. condensed / reworded snippet → requote
assert('condensed snippet → requote NOT_FOUND',
  R.condensed.verdict === 'requote' && R.condensed.snippet?.status === 'NOT_FOUND', J(R.condensed));

// --- 3. indentation-only drift → requote, with the exact file text handed back
assert('indentation drift → requote INDENT_ONLY',
  R.indent.verdict === 'requote' && R.indent.snippet?.status === 'INDENT_ONLY', J(R.indent));
assert('INDENT_ONLY returns exact_text + found_line',
  R.indent.snippet?.found_line === 2 && R.indent.snippet?.exact_text === '    for item in items:\n        save(item)', J(R.indent.snippet));

// --- 4. snippet that occurs twice → requote AMBIGUOUS (str_replace would hit the wrong one)
assert('duplicate snippet → requote AMBIGUOUS',
  R.ambiguous.snippet?.status === 'AMBIGUOUS' && R.ambiguous.snippet?.occurrences.length === 2, J(R.ambiguous));

// --- 5. fix invents a symbol → manual-fix-required
assert('invented symbol → manual-fix-required', R.invented.verdict === 'manual-fix-required', J(R.invented));
assert('unresolved lists the invented names',
  (R.invented.fix?.unresolved || []).includes('PendingUpsert') && R.invented.fix.unresolved.includes('model_validate'), J(R.invented.fix));

// --- 6. fix passes a keyword the repo function does not accept (the `conn=` case)
assert('invented kwarg → manual-fix-required',
  R.badKwarg.verdict === 'manual-fix-required' && (R.badKwarg.fix?.bad_kwargs || []).includes('save(conn=)'), J(R.badKwarg));
assert('real kwarg is accepted',
  R.goodKwarg.verdict === 'fingerprint' && R.goodKwarg.fix?.bad_kwargs.length === 0, J(R.goodKwarg));

// --- 7. "..." placeholder → manual; JS spread is NOT a placeholder
assert('"..." placeholder → manual-fix-required',
  R.placeholder.verdict === 'manual-fix-required' && R.placeholder.fix?.status === 'placeholder', J(R.placeholder));
assert('JS spread is not a placeholder',
  R.spread.verdict === 'fingerprint' && R.spread.fix?.apply?.status === 'parses', J(R.spread));

// --- 8. comment / instruction instead of code → manual
assert('comment-only fix → manual-fix-required',
  R.commentOnly.verdict === 'manual-fix-required' && R.commentOnly.fix?.status === 'comment-only', J(R.commentOnly));
assert('no fix → manual-fix-required', R.noFix.verdict === 'manual-fix-required' && R.noFix.fix?.status === 'none', J(R.noFix));

// --- 9. a library API may be used only when declared, and the declaration is reported
assert('declared external symbol → fingerprint', R.external.verdict === 'fingerprint', J(R.external));
assert('declared external symbols are reported', (R.external.fix?.declared_external || []).includes('run_in_threadpool'), J(R.external));

// --- 10. intent-dependent findings never become gating Open findings
assert('needs_confirmation → needs-confirmation', R.question.verdict === 'needs-confirmation', J(R.question));
assert('[Needs Verification] tag without a question → needs-confirmation + reason',
  R.nvTag.verdict === 'needs-confirmation' && (R.nvTag.reasons || []).some(x => /question/.test(x)), J(R.nvTag));

// --- 11. config / shell files skip identifier resolution
assert('Dockerfile fix → symbol check skipped, fingerprint',
  R.dockerfile.verdict === 'fingerprint' && /skipped/.test(R.dockerfile.fix?.symbol_check), J(R.dockerfile));

// --- 12. a fix that leaves the file unparsable → manual
assert('JS fix with a syntax error → manual-fix-required',
  R.jsSyntax.verdict === 'manual-fix-required' && R.jsSyntax.fix?.apply?.status === 'syntax-error', J(R.jsSyntax));
if (pythonAvailable) {
  assert('python fix with an indentation error → manual-fix-required',
    R.pySyntax.verdict === 'manual-fix-required' && R.pySyntax.fix?.apply?.status === 'syntax-error', J(R.pySyntax));
}

// --- 13. wrong line is reported; missing file / fields are rejected
assert('wrong cited line → reason with the real line',
  R.wrongLine.snippet?.line_mismatch?.actual === 3 && (R.wrongLine.reasons || []).some(x => /use 3/.test(x)), J(R.wrongLine));
assert('missing file → requote FILE_MISSING',
  R.missingFile.verdict === 'requote' && R.missingFile.snippet?.status === 'FILE_MISSING', J(R.missingFile));
assert('missing fingerprint fields → invalid', R.missingField.verdict === 'invalid', J(R.missingField));

// --- 13b. SCA dependency findings: package@version must be declared in the manifest
assert('declared package@version → fingerprint, manifest line returned',
  R.depDeclared.verdict === 'fingerprint' && R.depDeclared.snippet?.status === 'DECLARED'
  && R.depDeclared.snippet?.found_line === 3 && /"lodash": "\^4\.17\.20"/.test(R.depDeclared.snippet?.exact_text), J(R.depDeclared));
assert('package@version parsed from evidence text', R.depEvidence.verdict === 'fingerprint', J(R.depEvidence));
assert('version not declared → requote NOT_DECLARED', R.depWrongVer.verdict === 'requote' && R.depWrongVer.snippet?.status === 'NOT_DECLARED', J(R.depWrongVer));
assert('"react" does not match "react-dom"', R.depPrefix.snippet?.status === 'NOT_DECLARED', J(R.depPrefix));
assert('lockfile version on the next line → declared', R.depLockfile.verdict === 'fingerprint' && R.depLockfile.snippet?.found_line === 4, J(R.depLockfile));
assert('dependency finding with no package → requote NO_PACKAGE', R.depNoPkg.verdict === 'requote' && R.depNoPkg.snippet?.status === 'NO_PACKAGE', J(R.depNoPkg));

// --- 14. collision suffix against an existing ledger
{
  const fp = sha('LOGIC_ERROR|app/svc.py|Logic|example defect');
  const ledger = path.join(DIR, 'ledger.md');
  fs.writeFileSync(ledger, `# Ledger\n\n## Open Findings\n\n### [${fp}] OTHER — Low\n- **File**: other/file.py\n- **Status**: Open\n`);
  const r = check([CASES.sound], [`--ledger=${ledger}`]).json.results[0];
  assert('collision with a different file → suffixed ID', r.fp === fp + 'b', r.fp);
}

// --- 15. hand-assigned ID detection
{
  const { looksHandAssigned } = require(SCRIPT);
  const fake = ['FP-a1b2c3d4', 'FP-e9f0a1b2', 'FP-c9d0e1f2', 'FP-00000000', 'FP-01234567'];
  const real = ['FP-93779c8f', 'FP-2b4e60fd', sha('anything')];
  assert('sequential / repeated IDs flagged as hand-assigned', fake.every(looksHandAssigned), fake.filter(x => !looksHandAssigned(x)).join(','));
  assert('hashed IDs are not flagged', !real.some(looksHandAssigned), real.filter(looksHandAssigned).join(','));
}

// --- 16. audit-ledger over an existing ledger
{
  const ledger = path.join(DIR, 'audit-ledger.md');
  fs.writeFileSync(ledger, [
    '# Code Review Ledger', '', '## Open Findings', '',
    '### [FP-93779c8f] LOGIC_ERROR — High',
    '- **File**: app/svc.py', '- **Location**: upsert() (line 2)', '- **Status**: Open',
    '- **Vulnerable code**:', '  ```', '  for item in items: save(item)', '  ```',
    '- **Fix**:', '  ```', '  pass', '  ```', '',
    '### [FP-2b4e60fd] LOGIC_ERROR — Low',
    '- **File**: app/svc.py', '- **Location**: upsert() (line 3)', '- **Status**: Open',
    '- **Vulnerable code**:', '  ```', '          save(item)', '  ```',
    '- **Fix**:', '  ```', '          save(item) if item else None', '  ```', '',
    '### [FP-5d4c3e21] LOGIC_ERROR — Medium',
    '- **File**: app/svc.py', '- **Location**: gone() (line 9)', '- **Status**: Open',
    '- **Vulnerable code**:', '  ```', '  def gone():', '  ```',
    '- **Fix**:', '  ```', '  pass', '  ```',
    '- **Verified**: 2026-10-01 (finding-verify)', '',
    '### [FP-7c1e9a40] SEC-DEP — High',
    '- **File**: package.json', '- **Location**: lodash (line 3)', '- **Status**: Open',
    '- **Vulnerable code**:', '  ```', '      "lodash": "^4.17.19",', '  ```',
    '- **Fix**:', '  ```', '  Upgrade to lodash@4.17.21', '  ```',
    '- **Fix kind**: dependency-upgrade', '- **Verified**: 2026-10-01 (finding-verify)', '',
    '| FP-0f3c2b19 | SEC-IAC | Open | High | k8s/deploy.yaml | 12 | K8S-001 | runAsNonRoot missing | add securityContext |', '',
    '## Fixed Findings', '',
    '### [FP-a1b2c3d4] TAINTED_PATH — High', '- **File**: app/svc.py', '- **Status**: Fixed', '',
    '## Dismissed Findings', '',
    '### [FP-1bad0f9d] X — Low', '- **File**: app/svc.py', '- **Status**: Dismissed', '',
  ].join('\n'));
  const { json, code } = run('audit-ledger', [`--ledger=${ledger}`]);
  const by = Object.fromEntries(json.results.map(r => [r.fp, r]));
  assert('audit exits 0', code === 0, String(code));
  assert('audit: condensed Open snippet → requote', by['FP-93779c8f'].verdict === 'requote', J(by['FP-93779c8f']));
  assert('audit: sound Open finding → fingerprint', by['FP-2b4e60fd'].verdict === 'fingerprint', J(by['FP-2b4e60fd']));
  assert('audit: Fixed/Dismissed blocks are not re-verified', !by['FP-a1b2c3d4'].verdict && !by['FP-1bad0f9d'].verdict, J(json.results));
  assert('audit: hand-assigned ID reported', json.summary.suspect_hand_assigned_ids.includes('FP-a1b2c3d4'), J(json.summary));
  assert('audit: verified entry whose code is gone → fixed candidate',
    json.summary.fixed_candidates.includes('FP-5d4c3e21'), J(json.summary));
  assert('audit: upgraded dependency (manifest line changed) → fixed candidate, not manual-fix',
    json.summary.fixed_candidates.includes('FP-7c1e9a40') && by['FP-7c1e9a40'].verdict === 'requote', J(by['FP-7c1e9a40']));
  assert('audit: legacy security table row reported',
    json.summary.legacy_table_rows.some(r => r.fp === 'FP-0f3c2b19' && r.id === 'SEC-IAC' && r.status === 'Open'), J(json.summary.legacy_table_rows));
  assert('audit: UNverified entry whose snippet is missing is NOT a fixed candidate',
    !json.summary.fixed_candidates.includes('FP-93779c8f') && json.summary.unverified_snippets.includes('FP-93779c8f'), J(json.summary));
}

// --- 17. usage errors
{
  const r = spawnSync('node', [SCRIPT, 'bogus'], { encoding: 'utf8' });
  assert('unknown mode → exit 1', r.status === 1, String(r.status));
  const r2 = spawnSync('node', [SCRIPT, 'check', `--root=${REPO}`], { encoding: 'utf8' });
  assert('check without --findings → exit 1', r2.status === 1, String(r2.status));
}

fs.rmSync(DIR, { recursive: true, force: true });
console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
