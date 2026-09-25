#!/usr/bin/env node
// hooks/memory-capture.cjs — UserPromptSubmit hook: memory capture prompt (pure Node.js)
//
// Wired by setup-init-bootstrap.cjs when shell_type = "node".
// Identical behaviour to memory-capture.sh — no bash required.
// Guard: only active when .claude/dream-init-state.json exists.

'use strict';
const fs = require('fs');
if (!fs.existsSync('.claude/dream-init-state.json')) process.exit(0);

const msg = [
  '\u{1F4BE} Memory check — if any of these happened in the PREVIOUS response, write to the repo-root memory/MEMORY.md NOW',
  '(the repo-relative memory/ folder at the project root — NOT the ~/.claude profile memory;',
  'before answering the current message — do not defer):',
  '  • Plan approved / approach agreed  → approach, tools chosen, constraints set',
  '  • Task completed                   → pattern that worked, convention confirmed',
  '  • Error resolved                   → error + root cause + fix + gotcha to avoid repeating',
  '  • Approach abandoned               → what failed, why, what not to retry',
  '  • Architecture decision            → decision + rationale + alternatives rejected',
  'If none apply, skip. Write a SEPARATE entry to memory/MEMORY.md for EACH trigger that fired:',
  '',
  '  ### [YYYY-MM-DD] <trigger> — <topic>',
  '  <what to remember — 1–3 sentences>',
  '  Trigger: <trigger>  Confidence: 0.70  Source: auto-capture'
].join('\n');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: msg }
}) + '\n');
