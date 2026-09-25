#!/usr/bin/env node
// hooks/context-guard.cjs — UserPromptSubmit hook
// SCRIPT REVIEW
// What it does:    Blocks a user message when remaining context is below the declared
//                  headroom for the current skill step. Skill-agnostic: any skill
//                  participates by writing .claude/active-task.json at each STEP BOUNDARY
//                  and declaring needs in .claude-plugin/context-budgets.json.
// What it reads:   transcript_path (from hook payload) → last assistant usage block;
//                  .claude/active-task.json → {skill, step, ado};
//                  .claude-plugin/context-budgets.json → window sizes + per-step headroom.
// What it writes:  Nothing. Read-only, never mutates state.
// Block signal:    process.stderr.write(message) + process.exit(2).
// Allow signal:    process.exit(0) — no output needed.
// Wiring:          Add to .claude/settings.json hooks.UserPromptSubmit. Setup-init deploys
//                  this automatically when migration skills are detected.

'use strict';
const fs   = require('fs');
const path = require('path');

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let transcriptPath;
  try {
    const payload  = JSON.parse(Buffer.concat(chunks).toString());
    transcriptPath = payload.transcript_path;
  } catch (_) { process.exit(0); }
  if (!transcriptPath || !fs.existsSync(transcriptPath)) process.exit(0);

  // ── 1. Compute current token usage from last assistant entry ─────────────────────────────
  // Must sum all three input fields: input_tokens alone is near-zero under heavy caching;
  // cache_read_input_tokens carries the bulk of the accumulated context.
  const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n');
  let used = 0, modelId = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === 'assistant' && entry.message?.usage) {
        const u = entry.message.usage;
        used    = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
        modelId = entry.message.model || '';
        break;
      }
    } catch (_) {}
  }
  if (!used) process.exit(0);

  // ── 2. Load budget config ─────────────────────────────────────────────────────────────────
  const budgetsPath = path.join(process.cwd(), '.claude-plugin', 'context-budgets.json');
  if (!fs.existsSync(budgetsPath)) process.exit(0);
  let budgets;
  try { budgets = JSON.parse(fs.readFileSync(budgetsPath, 'utf8')); }
  catch (_) { process.exit(0); }

  const windowSize = (budgets.model_windows || {})[modelId] || budgets.default_window || 200000;
  const remaining  = windowSize - used;

  // ── 3. Read active task state ─────────────────────────────────────────────────────────────
  // Written by the skill at each STEP BOUNDARY immediately before showing the boundary prompt.
  // If absent: skill has not declared a step → allow.
  const activeTaskPath = path.join(process.cwd(), '.claude', 'active-task.json');
  if (!fs.existsSync(activeTaskPath)) process.exit(0);
  let activeTask;
  try { activeTask = JSON.parse(fs.readFileSync(activeTaskPath, 'utf8')); }
  catch (_) { process.exit(0); }

  const { skill, step, ado } = activeTask;
  if (!skill || !step) process.exit(0);

  // ── 4. Look up declared headroom ─────────────────────────────────────────────────────────
  const declared = ((budgets.skills || {})[skill] || {})[step];
  if (declared === undefined) process.exit(0); // undeclared step → allow

  // ── 5. Block if insufficient ─────────────────────────────────────────────────────────────
  if (remaining >= declared) process.exit(0);

  const pct       = Math.round((used / windowSize) * 100);
  const resumeCmd = ado ? `${skill.toUpperCase()} RESUME ADO-${ado}` : `Resume the ${skill} skill`;

  process.stderr.write(
    `⛔ CONTEXT GUARD — insufficient headroom for ${skill} / ${step}\n\n` +
    `  Context used : ${used.toLocaleString()} / ${windowSize.toLocaleString()} tokens (${pct}%)\n` +
    `  Remaining    : ${remaining.toLocaleString()} tokens\n` +
    `  Step needs   : ${declared.toLocaleString()} tokens headroom\n\n` +
    `Options:\n` +
    `  A — /compact  (recommended — stay in this session)\n` +
    `      Run /compact, then reply: ${resumeCmd}\n` +
    `      The checkpoint resumes you at the current step — no rework.\n\n` +
    `  B — New session\n` +
    `      Open a new session and run: ${resumeCmd}\n`
  );
  process.exit(2);
});
