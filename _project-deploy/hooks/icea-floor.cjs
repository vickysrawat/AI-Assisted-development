#!/usr/bin/env node
// hooks/icea-floor.cjs — PreToolUse hook: mechanical ICEA floor (pure Node.js)
//
// Wired by setup-init-bootstrap.cjs when shell_type = "node".
// Identical enforcement to icea-floor.sh — no bash required.
// Exit 0 = allow, exit 2 = block (stderr shown to the model).

'use strict';
const fs   = require('fs');
const path = require('path');

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    filePath = (payload.tool_input && payload.tool_input.file_path) || '';
  } catch(e) { process.exit(0); }

  if (!filePath) process.exit(0);
  filePath = filePath.replace(/\\/g, '/');

  // Exempt paths — mirrors the icea-floor.sh case statement exactly
  const exemptPatterns = [
    /^(.*\/)?docs\//i,
    /\.md$/i,
    /^(.*\/)?memory\//i,
    /^(.*\/)?\.claude\//i,
    /\.(json|yaml|yml|gitignore)$/i,
    /^(.*\/)?tests\//i,
    /(plugin-guide|user-guide)\.html$/i,
    /^(.*\/)?(prod-readiness|CodeReviews|security|dynamic-scan|token-analysis)\//i,
    /^(prod-readiness|CodeReviews|security|dynamic-scan|token-analysis)\//i,
  ];
  if (exemptPatterns.some(p => p.test(filePath))) process.exit(0);

  // Guard only source extensions
  const guardedExts = ['.cs', '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.html', '.css', '.scss', '.sql'];
  if (!guardedExts.includes(path.extname(filePath).toLowerCase())) process.exit(0);

  // Floor predicate: approved ICEA modified in last 8 hours under docs/
  if (fs.existsSync('docs')) {
    const cutoff = Date.now() - 480 * 60 * 1000;
    const recurse = (dir, results) => {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(e) { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { recurse(full, results); continue; }
        if (e.name.endsWith('.icea.md') ||
            (e.name.startsWith('ADO-') && e.name.endsWith('.md')) ||
            (e.name.startsWith('icea-') && e.name.endsWith('.md'))) {
          results.push(full);
        }
      }
    };
    const iceas = [];
    recurse('docs', iceas);
    for (const f of iceas) {
      try {
        if (fs.statSync(f).mtimeMs > cutoff) {
          const content = fs.readFileSync(f, 'utf8');
          if (/Status:.*Approved|Tier:\s*T1/.test(content)) process.exit(0);
        }
      } catch(e) {}
    }
  }

  process.stderr.write(
    'ICEA FLOOR: blocked write to ' + filePath +
    ' — no approved ICEA (or T1 auto-ICEA) found modified in the last 8h under docs/.' +
    ' Create and approve an ICEA first (/icea-feature), or if one exists, touch it to confirm it is current.' +
    ' This is the mechanical floor beneath the ICEA gate.\n'
  );
  process.exit(2);
});
