#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Generates the "Shared specs" table in skills/shared/README.md from the
//                      authoritative manifest (plugin.json → components.shared) + each spec's H1.
//                      README is a PROJECTION, not a source of truth (ADR 0063) — this keeps the
//                      spec list/count un-driftable. Modes: default prints the block to stdout;
//                      --write injects it between the markers in README; --check verifies README's
//                      block matches a fresh generation (the CI drift guard).
// What it touches:     Reads .claude-plugin/plugin.json + skills/shared/*.md. --write edits
//                      skills/shared/README.md ONLY between the generated markers. default/--check
//                      write nothing.
// What it does NOT do: No network, no git, no LLM. Never edits outside the marker block.
// APIs / commands:     Node stdlib: fs, path. Exit: 0 ok/clean · 3 (--check) drift · 1 error.
// How to verify:       node scripts/gen-shared-index.cjs            # print
//                      node scripts/gen-shared-index.cjs --write    # refresh README
//                      node scripts/gen-shared-index.cjs --check    # CI drift guard

'use strict';
const fs   = require('fs');
const path = require('path');
const ROOT   = path.join(__dirname, '..');
const README = path.join(ROOT, 'skills', 'shared', 'README.md');
const BEGIN  = '<!-- BEGIN GENERATED: shared-specs (scripts/gen-shared-index.cjs) — do not hand-edit -->';
const END    = '<!-- END GENERATED: shared-specs -->';

function h1(name) {
  const p = path.join(ROOT, 'skills', 'shared', `${name}.md`);
  if (!fs.existsSync(p)) return '⚠ missing on disk';
  const line = fs.readFileSync(p, 'utf8').split('\n').find(l => /^#\s+/.test(l));
  return line ? line.replace(/^#\s+/, '').trim() : name;
}

function generate() {
  const shared = (JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).components?.shared || []).slice().sort();
  const rows = shared.map(n => `| \`${n}.md\` | ${h1(n)} |`).join('\n');
  return [
    BEGIN,
    '',
    `_${shared.length} shared specs — generated from \`plugin.json\` → \`components.shared\`. Refresh with \`node scripts/gen-shared-index.cjs --write\`._`,
    '',
    '| Spec | Summary (spec H1) |',
    '|---|---|',
    rows,
    '',
    END,
  ].join('\n');
}

function blockIn(txt) {
  const s = txt.indexOf(BEGIN), e = txt.indexOf(END);
  return (s >= 0 && e >= 0) ? txt.slice(s, e + END.length) : null;
}

const gen = generate();

if (process.argv.includes('--write')) {
  const txt = fs.readFileSync(README, 'utf8');
  const cur = blockIn(txt);
  if (cur === null) { process.stderr.write('error: generated markers not found in README — add the BEGIN/END markers first\n'); process.exit(1); }
  fs.writeFileSync(README, txt.replace(cur, gen));
  process.stdout.write(`updated shared-specs block in ${path.relative(ROOT, README)}\n`);
  process.exit(0);
}

if (process.argv.includes('--check')) {
  const cur = blockIn(fs.readFileSync(README, 'utf8'));
  if (cur === gen) { process.stdout.write('✓ README shared-specs block matches generator\n'); process.exit(0); }
  process.stderr.write('✗ README shared-specs block is STALE — run: node scripts/gen-shared-index.cjs --write\n');
  process.exit(3);
}

process.stdout.write(gen + '\n');
