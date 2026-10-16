#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Tests scripts/validate-arch-flows.cjs across all four gates:
//                      Gate A (ToC before first workflow), Gate B (sequenceDiagram only),
//                      Gate C (What happens bullets present), Gate D (ToC/section coverage).
//                      Also tests missing --file arg, file not found, and empty-file cases.
// What it touches:     Writes temp .md files under os.tmpdir()/arch-flows-test-{pid}/.
// What it does NOT do: No network. No git. No mutations outside the temp dir.
// APIs / commands:     Node stdlib: os, fs, path, child_process.spawnSync.
// How to verify:       node tests/validate-arch-flows.test.cjs -> "N passed · 0 failed"

'use strict';
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'validate-arch-flows.cjs');
const DIR    = path.join(os.tmpdir(), `arch-flows-test-${process.pid}`);
let pass = 0, fail = 0;

function reset()  { fs.rmSync(DIR, { recursive: true, force: true }); }
function setup()  { fs.mkdirSync(DIR, { recursive: true }); }
function write(name, content) {
  const p = path.join(DIR, name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}
function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args, '--json'], { encoding: 'utf8' });
  let json = {};
  try { json = JSON.parse(r.stdout || '{}'); } catch (_) {}
  return { json, code: r.status, stderr: r.stderr || '' };
}
function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else       { fail++; console.log(`  ✗ ${name}\n      ${String(detail)}`); }
}

// ── Shared fixture builders ───────────────────────────────────────────────────

function toc(rows) {
  const header = `| # | Workflow | Description |\n|---|----------|-------------|\n`;
  const body   = rows.map(r => `| ${r.num} | ${r.name} | ${r.desc ?? ''} |`).join('\n');
  return header + body + '\n\n';
}

function workflow(num, { diagram = 'sequenceDiagram', whatHappens = 4 } = {}) {
  const bullets = Array.from({ length: whatHappens }, (_, i) => `- Bullet ${i + 1}.`).join('\n');
  const mermaidBlock =
    `\`\`\`mermaid\n${diagram}\n  actor User\n  User->>API: GET /items\n  API-->>User: 200 OK\n\`\`\``;
  const wh = whatHappens > 0
    ? `\n\n**What happens:**\n${bullets}`
    : '';
  return `## Workflow ${num} — Example Workflow ${num}\n\nLead paragraph.\n\n${mermaidBlock}${wh}\n\n`;
}

// ── Valid file fixture ────────────────────────────────────────────────────────

const VALID = toc([
  { num: 1, name: 'Upload File',  desc: 'User uploads a file' },
  { num: 2, name: 'Approve Item', desc: 'User approves an item' },
]) + workflow(1) + workflow(2);

reset();
setup();

// ── 1: valid file — all gates pass, exit 0 ───────────────────────────────────
console.log('\n1: valid file — all gates pass');
{
  const file = write('valid.md', VALID);
  const { json, code } = run([`--file=${file}`]);

  assert('status is ok',           json.status === 'ok',     json.status);
  assert('exit code 0',            code === 0,               code);
  assert('no failures',            json.failures?.length === 0, JSON.stringify(json.failures));
  assert('workflow count 2',       json.workflows_found === 2, json.workflows_found);
  assert('toc row count 2',        json.toc_rows_found  === 2, json.toc_rows_found);
}

// ── 2: Gate A — missing ToC ───────────────────────────────────────────────────
console.log('\n2: Gate A — missing Table of Contents');
{
  const content = workflow(1) + workflow(2);
  const file = write('no-toc.md', content);
  const { json, code } = run([`--file=${file}`]);

  assert('status is fail',         json.status === 'fail',   json.status);
  assert('exit code 1',            code === 1,               code);
  assert('Gate A failure',         json.failures?.some(f => f.gate === 'A'), JSON.stringify(json.failures));
}

// ── 3: Gate A — ToC appears after first ## Workflow ───────────────────────────
console.log('\n3: Gate A — ToC appears after first workflow section');
{
  const content = workflow(1) + toc([{ num: 1, name: 'Upload' }, { num: 2, name: 'Approve' }]) + workflow(2);
  const file = write('toc-after.md', content);
  const { json, code } = run([`--file=${file}`]);

  assert('status is fail',         json.status === 'fail',   json.status);
  assert('exit code 1',            code === 1,               code);
  assert('Gate A failure',         json.failures?.some(f => f.gate === 'A'), JSON.stringify(json.failures));
}

// ── 4: Gate B — flowchart instead of sequenceDiagram ─────────────────────────
console.log('\n4: Gate B — mermaid block uses flowchart');
{
  const content = toc([{ num: 1, name: 'Upload' }]) + workflow(1, { diagram: 'flowchart LR' });
  const file = write('flowchart.md', content);
  const { json, code } = run([`--file=${file}`]);

  assert('status is fail',         json.status === 'fail',   json.status);
  assert('exit code 1',            code === 1,               code);
  assert('Gate B failure',         json.failures?.some(f => f.gate === 'B'), JSON.stringify(json.failures));
  assert('Gate B message mentions flowchart',
    json.failures?.some(f => f.gate === 'B' && f.message.includes('flowchart')),
    JSON.stringify(json.failures)
  );
}

// ── 5: Gate B — graph diagram type ───────────────────────────────────────────
console.log('\n5: Gate B — mermaid block uses graph TD');
{
  const content = toc([{ num: 1, name: 'Upload' }]) + workflow(1, { diagram: 'graph TD' });
  const file = write('graph-td.md', content);
  const { json, code } = run([`--file=${file}`]);

  assert('status is fail',         json.status === 'fail',   json.status);
  assert('Gate B failure',         json.failures?.some(f => f.gate === 'B'), JSON.stringify(json.failures));
}

// ── 6: Gate C — missing **What happens:** section ────────────────────────────
console.log('\n6: Gate C — missing **What happens:** section');
{
  const content = toc([{ num: 1, name: 'Upload' }]) + workflow(1, { whatHappens: 0 });
  const file = write('no-what-happens.md', content);
  const { json, code } = run([`--file=${file}`]);

  assert('status is fail',         json.status === 'fail',   json.status);
  assert('exit code 1',            code === 1,               code);
  assert('Gate C failure',         json.failures?.some(f => f.gate === 'C'), JSON.stringify(json.failures));
}

// ── 7: Gate C — **What happens:** present but only 2 bullets (warning) ────────
console.log('\n7: Gate C — **What happens:** present but only 2 bullets (warning not failure)');
{
  const content = toc([{ num: 1, name: 'Upload' }]) + workflow(1, { whatHappens: 2 });
  const file = write('few-bullets.md', content);
  const { json, code } = run([`--file=${file}`]);

  assert('status is ok (warning only)', json.status === 'ok',  json.status);
  assert('exit code 0',            code === 0,               code);
  assert('Gate C warning present', json.warnings?.some(w => w.gate === 'C'), JSON.stringify(json.warnings));
  assert('no Gate C failure',      !json.failures?.some(f => f.gate === 'C'), JSON.stringify(json.failures));
}

// ── 8: Gate D — ToC row with no matching section ──────────────────────────────
console.log('\n8: Gate D — ToC row has no matching ## Workflow section');
{
  const content = toc([
    { num: 1, name: 'Upload' },
    { num: 2, name: 'Approve' },  // section 2 is absent
  ]) + workflow(1);
  const file = write('missing-section.md', content);
  const { json, code } = run([`--file=${file}`]);

  assert('status is fail',         json.status === 'fail',   json.status);
  assert('exit code 1',            code === 1,               code);
  assert('Gate D failure',         json.failures?.some(f => f.gate === 'D'), JSON.stringify(json.failures));
  assert('Gate D message mentions Workflow 2',
    json.failures?.some(f => f.gate === 'D' && f.message.includes('2')),
    JSON.stringify(json.failures)
  );
}

// ── 9: multiple gates failing together ───────────────────────────────────────
console.log('\n9: multiple gates failing (no ToC + flowchart + no What happens)');
{
  const mermaid = `\`\`\`mermaid\nflowchart LR\n  A-->B\n\`\`\``;
  const content = `## Workflow 1 — Bad\n\nLead.\n\n${mermaid}\n\n`;
  const file = write('multi-fail.md', content);
  const { json, code } = run([`--file=${file}`]);

  assert('status is fail',         json.status === 'fail',   json.status);
  assert('exit code 1',            code === 1,               code);
  assert('Gate A failure present', json.failures?.some(f => f.gate === 'A'), JSON.stringify(json.failures));
  assert('Gate B failure present', json.failures?.some(f => f.gate === 'B'), JSON.stringify(json.failures));
  assert('Gate C failure present', json.failures?.some(f => f.gate === 'C'), JSON.stringify(json.failures));
  assert('3+ failures total',      json.failures?.length >= 3, json.failures?.length);
}

// ── 10: empty file ────────────────────────────────────────────────────────────
console.log('\n10: empty file');
{
  const file = write('empty.md', '');
  const { json, code } = run([`--file=${file}`]);

  assert('status is fail',         json.status === 'fail',   json.status);
  assert('exit code 1',            code === 1,               code);
  assert('Gate A failure present', json.failures?.some(f => f.gate === 'A'), JSON.stringify(json.failures));
}

// ── 11: missing --file argument ───────────────────────────────────────────────
console.log('\n11: missing --file argument');
{
  const { json, code } = run([]);

  assert('status is error',        json.status === 'error',  json.status);
  assert('exit code 2',            code === 2,               code);
}

// ── 12: file not found ────────────────────────────────────────────────────────
console.log('\n12: file not found');
{
  const { json, code } = run([`--file=/nonexistent/path/arch-flows.md`]);

  assert('status is error',        json.status === 'error',  json.status);
  assert('exit code 2',            code === 2,               code);
}

// ── 13: architecture-callchains.md format (.NET / Spring Boot) ───────────────
console.log('\n13: callchains format — valid .NET / Spring Boot file');
{
  const callchains = toc([
    { num: 1, name: 'Create Order',    desc: 'POST /api/orders' },
    { num: 2, name: 'Get Order by ID', desc: 'GET /api/orders/{id}' },
  ]) + workflow(1) + workflow(2);
  const file = write('architecture-callchains.md', callchains);
  const { json, code } = run([`--file=${file}`]);

  assert('status is ok',           json.status === 'ok',     json.status);
  assert('exit code 0',            code === 0,               code);
  assert('2 workflows found',      json.workflows_found === 2, json.workflows_found);
}

// ── Teardown ──────────────────────────────────────────────────────────────────
reset();

console.log(`\n${'─'.repeat(48)}`);
console.log(`${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
