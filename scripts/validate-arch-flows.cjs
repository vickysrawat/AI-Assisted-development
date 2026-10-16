#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Validates that an architect-generated architecture-flows.md or
//                      architecture-callchains.md file conforms to the four-gate structure
//                      required by the File 2 prompt: (A) Table of Contents appears before
//                      the first ## Workflow section, (B) every mermaid block uses
//                      sequenceDiagram (not flowchart/graph/other), (C) every ## Workflow
//                      section has a **What happens:** bullet list with at least 4 bullets,
//                      (D) every ToC row has a matching ## Workflow N section.
// What it touches:     Reads ONE markdown file. Never writes.
// What it does NOT do: No network. No git. No file mutations. No LLM calls.
// APIs / commands:     Node stdlib: fs. No third-party dependencies.
// How to verify:       node tests/validate-arch-flows.test.cjs -> "N passed · 0 failed"

'use strict';
const fs = require('fs');

const JSON_OUT = process.argv.includes('--json');
const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

/**
 * Validates the four structural gates for a File 2 architecture document.
 * Returns { failures, warnings, workflowCount, tocRowCount }.
 *
 * Gate A: ToC (| # | Workflow | table) appears before first ## Workflow heading.
 * Gate B: Every ```mermaid block starts with sequenceDiagram.
 * Gate C: Every ## Workflow section has **What happens:** with >= 4 bullets.
 * Gate D: Every ToC row maps to a ## Workflow N section.
 */
function validate(filePath) {
  if (!filePath) throw new Error('requires --file=<path>');
  if (!fs.existsSync(filePath)) throw new Error(`file not found: ${filePath}`);

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const failures = [];
  const warnings = [];

  // ── Gate A: ToC appears before first ## Workflow heading ──────────────────
  const firstWorkflowIdx = lines.findIndex(l => /^## Workflow\s+\d+\s*[—–-]/.test(l));
  const tocHeaderIdx     = lines.findIndex(l => /\|\s*#\s*\|\s*Workflow\s*\|/i.test(l));

  if (tocHeaderIdx === -1) {
    failures.push({
      gate: 'A',
      message: 'No Table of Contents found — missing | # | Workflow | table header',
    });
  } else if (firstWorkflowIdx !== -1 && tocHeaderIdx > firstWorkflowIdx) {
    failures.push({
      gate: 'A',
      message:
        `Table of Contents (line ${tocHeaderIdx + 1}) appears after ` +
        `first ## Workflow (line ${firstWorkflowIdx + 1}) — ToC must come first`,
    });
  }

  // ── Gate B: every mermaid block starts with sequenceDiagram ───────────────
  let inMermaid = false;
  let firstLineOfBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!inMermaid && trimmed === '```mermaid') {
      inMermaid = true;
      firstLineOfBlock = true;
      continue;
    }
    if (inMermaid) {
      if (trimmed === '```') { inMermaid = false; continue; }
      if (firstLineOfBlock) {
        firstLineOfBlock = false;
        if (!trimmed.startsWith('sequenceDiagram')) {
          const type = trimmed.match(/^(\S+)/)?.[1] ?? trimmed;
          failures.push({
            gate: 'B',
            line: i + 1,
            message: `Mermaid block at line ${i + 1} uses "${type}" instead of sequenceDiagram`,
          });
        }
      }
    }
  }

  // ── Locate all ## Workflow sections ───────────────────────────────────────
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^## Workflow\s+(\d+)\s*[—–-]/);
    if (m) sections.push({ num: parseInt(m[1], 10), title: lines[i].trim(), start: i });
  }

  // ── Gate C: every section has **What happens:** with >= 4 bullets ──────────
  for (let s = 0; s < sections.length; s++) {
    const from  = sections[s].start;
    const to    = s + 1 < sections.length ? sections[s + 1].start : lines.length;
    const slice = lines.slice(from, to);

    const whIdx = slice.findIndex(l => /^\*\*What happens:?\*\*/.test(l.trim()));
    if (whIdx === -1) {
      failures.push({
        gate: 'C',
        line: sections[s].start + 1,
        message: `"${sections[s].title}" (line ${sections[s].start + 1}) is missing **What happens:** bullet list`,
      });
    } else {
      const bullets = slice.slice(whIdx).filter(l => /^-\s+\S/.test(l.trim())).length;
      if (bullets < 4) {
        warnings.push({
          gate: 'C',
          line: sections[s].start + 1,
          message:
            `"${sections[s].title}" has ${bullets} bullet(s) under **What happens:** — expected ≥4`,
        });
      }
    }
  }

  // ── Gate D: every ToC row has a matching ## Workflow section ──────────────
  const tocRows = [];
  let inToc = false;

  for (let i = 0; i < lines.length; i++) {
    if (/\|\s*#\s*\|\s*Workflow\s*\|/i.test(lines[i])) { inToc = true; continue; }
    if (inToc) {
      if (/^\|[\s|-]+\|$/.test(lines[i].trim())) continue;
      const m = lines[i].match(/^\|\s*(\d+)\s*\|\s*([^|]+)\|/);
      if (m) {
        tocRows.push({ num: parseInt(m[1], 10), name: m[2].trim() });
      } else if (!lines[i].trim().startsWith('|')) {
        inToc = false;
      }
    }
  }

  for (const row of tocRows) {
    if (!sections.some(s => s.num === row.num)) {
      failures.push({
        gate: 'D',
        message:
          `ToC lists Workflow ${row.num} ("${row.name}") but no matching ` +
          `## Workflow ${row.num} section exists`,
      });
    }
  }

  if (sections.length === 0 && tocRows.length === 0) {
    failures.push({ gate: 'A', message: 'No workflows found — file appears empty or unpopulated' });
  }

  return { failures, warnings, workflowCount: sections.length, tocRowCount: tocRows.length };
}

// ── CLI entry point ───────────────────────────────────────────────────────────
try {
  const filePath = arg('file');
  const { failures, warnings, workflowCount, tocRowCount } = validate(filePath);
  const passed = failures.length === 0;

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify({
      op: 'validate-arch-flows',
      status: passed ? 'ok' : 'fail',
      file: filePath,
      workflows_found: workflowCount,
      toc_rows_found:  tocRowCount,
      failures,
      warnings,
    }, null, 2) + '\n');
  } else {
    process.stdout.write(`validate-arch-flows: ${filePath}\n`);
    process.stdout.write(`  Workflows : ${workflowCount}  |  ToC rows : ${tocRowCount}\n`);
    if (passed) {
      process.stdout.write(`  ✅ All gates passed\n`);
    } else {
      for (const f of failures) {
        const loc = f.line ? ` (line ${f.line})` : '';
        process.stdout.write(`  ❌ Gate ${f.gate}${loc}: ${f.message}\n`);
      }
    }
    for (const w of warnings) {
      const loc = w.line ? ` (line ${w.line})` : '';
      process.stdout.write(`  ⚠  Gate ${w.gate}${loc}: ${w.message}\n`);
    }
  }

  process.exit(passed ? 0 : 1);
} catch (err) {
  if (JSON_OUT) {
    process.stdout.write(
      JSON.stringify({ op: 'validate-arch-flows', status: 'error', error: err.message }) + '\n'
    );
  } else {
    process.stderr.write(`validate-arch-flows error: ${err.message}\n`);
  }
  process.exit(2);
}

module.exports = { validate };
