#!/usr/bin/env node
// hooks/governance-gate-precommit.cjs — git pre-commit hook (cross-platform Node.js)
//
// Installed as .git/hooks/pre-commit by setup-init-bootstrap.cjs.
// Fires on every git commit regardless of tool (CLI, VS Code, Visual Studio, any GUI).
// Only bypass: git commit --no-verify (source changes still caught by CI icea-gate).
//
// Runs two gates via scripts/validate-governance.cjs:
//   Gate 1 — ICEA gate     : source code requires approved ICEA per ADO ID
//   Gate 2 — Security gate : config files get secret scan + audit entry; env files blocked

'use strict';
const path          = require('path');
const fs            = require('fs');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();
const script   = path.join(repoRoot, 'scripts', 'validate-governance.cjs');

if (!fs.existsSync(script)) {
  process.stderr.write('⚠  governance-gate: scripts/validate-governance.cjs not found — gate skipped.\n');
  process.exit(0);
}

const r = spawnSync(process.execPath, [script], { stdio: 'inherit', cwd: repoRoot });
process.exit(r.status ?? 1);
