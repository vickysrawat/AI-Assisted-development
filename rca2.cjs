// SCRIPT REVIEW
// What it does:        Reads a Claude Code session JSONL transcript and prints every real developer
//                      message (excluding task-notification wrappers), compaction markers, and Agent
//                      tool launches across the whole run, with line numbers.
// What it touches:     Reads the transcript file passed as argv[2]. Writes nothing.
// What it does NOT do: No network calls, no git operations, no file writes, no registry changes.
// APIs / commands:     Node.js fs.readFileSync, JSON.parse, Array methods only.
// How to verify:       Output should show developer turns, COMPACTION markers, and AGENT lines.
//                      Check that the first Agent launch appears after (or without) a developer
//                      APPROVE reply to identify where Step 2 was skipped.

// rca2.cjs — usage: node rca2.cjs <transcript.jsonl>
require('fs').readFileSync(process.argv[2], 'utf8').split('\n').forEach((l, n) => {
  let e; try { e = JSON.parse(l); } catch { return; }
  if (e.isSidechain) return;
  if (e.isCompactSummary || e.type === 'summary') return console.log(n, 'COMPACTION');
  const c = e.message?.content;
  if (e.type === 'user' && typeof c === 'string' && !c.startsWith('<task-notification'))
    console.log(n, 'USER:', c.slice(0, 150));
  if (Array.isArray(c)) for (const b of c)
    if (b.type === 'tool_use' && b.name === 'Agent')
      console.log(n, 'AGENT:', (b.input?.description || '').slice(0, 80));
});
