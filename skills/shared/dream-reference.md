# Shared spec: Dream memory — reference detail

The operative auto-capture triggers live in `CLAUDE.md` (# Dream). This spec holds the
consolidation guidance and thresholds moved out of CLAUDE.md to keep session context lean.

## Consolidation rules

- Run `/dream` every 5–8 sessions to consolidate memory.
- Run `/dream-health` to see confidence scores and the decay dashboard.
- Max entries promoted to `memory/MEMORY.md`: **20** — demote stale entries to topic files.
- `memory/topic-*.md` holds detail; `MEMORY.md` holds only promoted, high-confidence facts.
- `memory/health.html` is generated — do not commit it (it is in the managed ignore block).

## Auto-capture entry format

```
### [auto] YYYY-MM-DD — <topic>
<what to remember>
Trigger: <which trigger fired>
Source: auto-capture
```

These live under `memory/MEMORY.md`. See `commands/dream.md` / `commands/dream-health.md`
for the full consolidation and scoring behaviour.
