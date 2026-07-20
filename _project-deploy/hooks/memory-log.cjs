#!/usr/bin/env node
// hooks/memory-log.cjs — PostToolUse hook: log MEMORY.md writes to dream-log.md (pure Node.js)
//
// Wired by setup-init-bootstrap.cjs when shell_type = "node".
// Identical behaviour to memory-log.sh — no bash required.
// Guard: only active when .claude/dream-init-state.json exists.

'use strict';
const fs = require('fs');
if (!fs.existsSync('.claude/dream-init-state.json')) process.exit(0);

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  try {
    const ev   = JSON.parse(raw.replace(/\r\n/g, '\n'));
    const tool = ev.tool_name || '';
    const fp   = ((ev.tool_input || {}).file_path || (ev.tool_input || {}).path || '')
                   .replace(/\\/g, '/');

    if ((tool !== 'Write' && tool !== 'Edit') || !fp.endsWith('memory/MEMORY.md')) process.exit(0);
    if (!fs.existsSync('memory/MEMORY.md')) process.exit(0);

    let headers = [];
    if (tool === 'Edit') {
      const newStr = (ev.tool_input.new_string || '').replace(/\r\n/g, '\n');
      headers = newStr.split('\n').filter(l => l.startsWith('### '));
    } else {
      const content = fs.readFileSync('memory/MEMORY.md', 'utf8').replace(/\r\n/g, '\n');
      const last = content.split('\n').filter(l => l.startsWith('### ')).slice(-1)[0];
      if (last) headers = [last];
    }
    if (!headers.length) process.exit(0);

    const logPath   = 'memory/dream-log.md';
    const logExists = fs.existsSync(logPath) && fs.readFileSync(logPath, 'utf8').trim().length > 0;
    const entries   = (logExists ? '\n' : '') +
                      headers.map(h => h.replace(/^### /, '### [capture] ')).join('\n') + '\n';
    fs.appendFileSync(logPath, entries);
  } catch(e) { process.exit(0); }
});
