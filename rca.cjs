// SCRIPT REVIEW
// What it does:        Reads a Claude Code session JSONL transcript; emits the 25 events before and 2 after the first tool call that writes a target-* file. Events include compaction markers, user turns, assistant text (first 120 chars), and matching tool calls.
// What it touches:     Reads the transcript file passed as argv[2]. Writes nothing.
// What it does NOT do: No network calls, no git operations, no file writes, no registry changes.
// APIs / commands:     Node.js fs.readFileSync, JSON.parse, Array methods only.
// How to verify:       Output lines are of the form: <line-number> <event-type>: <snippet>. Check that the first TOOL line contains "target-".

// rca.cjs — usage: node rca.cjs <transcript.jsonl>
const lines = require('fs').readFileSync(process.argv[2], 'utf8').split('\n');
const ev = [];
lines.forEach((l, n) => {
  let e; try { e = JSON.parse(l); } catch { return; }
  if (e.isSidechain) return;
  if (e.isCompactSummary || e.type === 'summary') ev.push([n, 'COMPACTION']);
  const c = e.message?.content;
  if (e.type === 'user' && typeof c === 'string') ev.push([n, 'USER: ' + c.slice(0, 120)]);
  if (Array.isArray(c)) for (const b of c) {
    if (b.type === 'text' && e.type === 'assistant') ev.push([n, 'MODEL: ' + b.text.slice(0, 120)]);
    if (b.type === 'tool_use' && /target-|options\.md|STEP BOUNDARY/.test(JSON.stringify(b.input)))
      ev.push([n, `TOOL ${b.name}: ` + JSON.stringify(b.input).slice(0, 100)]);
  }
});
const first = ev.findIndex(([, t]) => t.startsWith('TOOL') && t.includes('target-'));
ev.slice(Math.max(0, first - 25), first + 2).forEach(([n, t]) => console.log(String(n).padStart(4), t));
