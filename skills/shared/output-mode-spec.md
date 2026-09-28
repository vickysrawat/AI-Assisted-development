# Output Mode Specification

Skills read `output_mode` from `.claude/dream-init-state.json` to decide how much detail to
emit to chat. The tracker, audit log, and session log files always receive full data — only
the chat channel changes. Absent or unreadable = `verbose` (safe default).

## Reading output_mode

```bash
OUTPUT_MODE=$(node -e "
try {
  const s = JSON.parse(require('fs').readFileSync('.claude/dream-init-state.json','utf8'));
  process.stdout.write(s.output_mode || 'verbose');
} catch(_) { process.stdout.write('verbose'); }
")
```

## Modes

### verbose (default)
All output to chat. Current behaviour — no change.

### compact
Chat shows one-line progress summaries and the APPROVE prompt only.
Verbose detail is written to the session log file via `output-log-write.cjs`.

**What stays in chat in compact mode:**

| Element | Compact format |
|---|---|
| Step progress | `✅ Step N — {step name}` |
| Critic PASS | `✅ Critic — PASS (0 concerns)` |
| Critic PASS WITH NOTES | `⚠ Critic — PASS WITH NOTES ({N} notes) — see log` |
| Critic REVISE | `❌ Critic — REVISE ({N} concerns) — see log` |
| Critic retry | `🔁 Critic retry {N} of 2` |
| Goal-loop result | `Goal-loop: {n}/{total} ACs met ({pct}%)` |
| Hard stops / errors | Always shown in full |
| Questions to developer | Always shown in full |
| Unified diff | **Always shown in full** — developer must see what they approve |
| APPROVE prompt | Always shown, always last — see ordering rule below |

**What goes to the session log in compact mode:**

- Full critic concerns list and analysis
- AC-by-AC goal-loop scoring breakdown
- Step detail narratives and section-level summaries
- Any verbose output that would appear between step progress and the APPROVE prompt

## APPROVE prompt ordering — hard rule that applies to ALL modes

**The APPROVE prompt must be the last output in every write-gate sequence.**

Correct order:
1. Step summaries / critic verdict (one line in compact; full block in verbose)
2. Full unified diff (always shown — developer reviews before approving)
3. `📁 WRITE PENDING` prompt (always last — nothing follows it)

**Never output content after the APPROVE prompt.** Trailing section summaries,
full-file content listings, or any narrative that appears after the prompt pushes it
off-screen and the developer cannot see it. Move such content before the diff or
omit it; put the APPROVE prompt last.

## Session log

**Path:** `.claude/logs/ADO-{ID}-session-{YYYY-MM-DD}.md`
(or `session-{YYYY-MM-DD}.md` when no ADO ID is in context)

**Format:**
```
# Session Log — ADO #{ID} — {YYYY-MM-DD}

## {HH:MM:SS} — {step name}
{verbose content}

## {HH:MM:SS} — critic-gate
{full critic output}
```

The log is append-only. Entries accumulate across the session — one file per day per ADO.
`.claude/logs/` is gitignored (session-local, not team-shared).

## Writing to the session log

```bash
PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
[ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/output-log-write.cjs" \
  --ado-id "{ADO_ID}" \
  --step "{step name}" \
  --content-file "{path/to/temp-content.txt}" 2>/dev/null || true
```

Or inline for short content:
```bash
[ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/output-log-write.cjs" \
  --ado-id "{ADO_ID}" \
  --step "{step name}" \
  --content "{one-line or short verbose text}" 2>/dev/null || true
```

Always exits 0 — never blocks the skill flow.

## Switching modes

`SET OUTPUT verbose` — expand chat output (default)
`SET OUTPUT compact` — compact chat, verbose content → session log

Both commands write `output_mode` to `.claude/dream-init-state.json` and confirm.
