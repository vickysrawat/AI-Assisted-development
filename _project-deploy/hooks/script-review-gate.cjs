#!/usr/bin/env node
// hooks/script-review-gate.cjs — PreToolUse hook: requires SCRIPT REVIEW header in scripts
//
// Blocks Write calls to script files (.cjs .mjs .sh .ps1 .bat .cmd) unless the
// content contains a "SCRIPT REVIEW" comment header. Internal hook paths are exempt.
// Exit 0 = allow, exit 2 = block (output shown to the model).

'use strict';
const path = require('path');

const SCRIPT_EXTS   = new Set(['.cjs', '.mjs', '.sh', '.ps1', '.bat', '.cmd']);
const REVIEW_MARKER = 'SCRIPT REVIEW';

// Internal infrastructure paths — never blocked
const EXEMPT_SEGMENTS = [
  '.claude/hooks/',
  '.claude\\hooks\\',
  '_project-deploy/hooks/',
  '_project-deploy\\hooks\\',
];

const BLOCK_MSG = `
────────────────────────────────────────────────
BLOCKED — script-review-gate

This script is missing a SCRIPT REVIEW header. Add the following comment block
at the very top of the file (before any code), then re-submit:

  For .cjs / .mjs / .js:
    // SCRIPT REVIEW
    // What it does:        <plain-English description of every action, in order>
    // What it touches:     <exact files, folders, or system resources modified>
    // What it does NOT do: <side effects explicitly avoided>
    // APIs / commands:     <Node.js APIs or executables invoked>
    // How to verify:       <what to check after running>

  For .sh / .ps1 / .bat:
    # SCRIPT REVIEW
    # What it does:        ...
    # (same five fields)

Also display these five points in the chat window before asking the developer to run the script.
────────────────────────────────────────────────`.trim();

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let toolName = '', filePath = '', content = '';
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    toolName = payload.tool_name || '';
    filePath = (payload.tool_input && payload.tool_input.file_path) || '';
    content  = (payload.tool_input && payload.tool_input.content)   || '';
  } catch (e) { process.exit(0); }

  // Only intercept Write — Edit of existing scripts is allowed
  if (toolName !== 'Write') process.exit(0);
  if (!filePath) process.exit(0);

  // Exempt internal hook paths
  if (EXEMPT_SEGMENTS.some(seg => filePath.includes(seg))) process.exit(0);

  // Only guard known script extensions
  const ext = path.extname(filePath).toLowerCase();
  if (!SCRIPT_EXTS.has(ext)) process.exit(0);

  // Pass if the review header is present
  if (content.includes(REVIEW_MARKER)) process.exit(0);

  // Block
  process.stderr.write(BLOCK_MSG + '\n');
  process.exit(2);
});
