#!/usr/bin/env node
// hooks/pre-commit-full.cjs — full governance pre-commit chain (Node.js, cross-platform)
//
// Chains both commit-time gates in order, fail-fast:
//   Gate 1: findings-gate-precommit.cjs  — open Critical/High findings + settings.json secrets
//   Gate 2: governance-gate-precommit.cjs — ICEA compliance + staged-file secrets + env-file block
//
// Why this order?
//   findings-gate is fast (reads ledger files only — no git staging context needed).
//   governance-gate is slower (walks staged files, resolves ADO IDs, scans for secrets).
//   Fail-fast on the cheaper gate first gives the fastest feedback loop.
//
// Installation (replaces the auto-installed findings-gate-only hook):
//
//   cp .claude/hooks/pre-commit-full.cjs .git/hooks/pre-commit
//   chmod +x .git/hooks/pre-commit          # Linux / macOS only — git for Windows does not need this
//
// To revert to findings-gate only:
//   cp .claude/hooks/findings-gate-precommit.cjs .git/hooks/pre-commit
//
// Bypass: each gate has its own env-var bypass (see individual hook headers).
//   SKIP_FINDINGS_GATE=1 FINDINGS_GATE_JUSTIFICATION="reason" git commit ...
//   (governance-gate bypass: use a hotfix/ branch — ICEA gate is automatically skipped and audited)

'use strict';
const path          = require('path');
const fs            = require('fs');
const { spawnSync } = require('child_process');

// Hooks live in .claude/hooks/ relative to the repo root.
// Git pre-commit hooks run with cwd = repo root, so this path is always resolvable.
const HOOKS_DIR = path.join(process.cwd(), '.claude', 'hooks');

// Run a hook script and return its exit code.
// stdio: 'inherit' — each hook writes its own error messages directly to the terminal.
function runHook(hookFile) {
  const hookPath = path.join(HOOKS_DIR, hookFile);
  if (!fs.existsSync(hookPath)) {
    process.stderr.write(`⚠  pre-commit-full: ${hookFile} not found in .claude/hooks/ — gate skipped.\n`);
    return 0;   // missing hook = degrade gracefully, do not block commit
  }
  const r = spawnSync(process.execPath, [hookPath], { stdio: 'inherit' });
  return r.status ?? 1;
}

// Gate 1 — findings gate (fast: ledger scan + settings.json secret check)
const findingsExit = runHook('findings-gate-precommit.cjs');
if (findingsExit !== 0) process.exit(findingsExit);

// Gate 2 — governance gate (ICEA compliance + staged-file secret scan + env-file block)
const governanceExit = runHook('governance-gate-precommit.cjs');
process.exit(governanceExit);
