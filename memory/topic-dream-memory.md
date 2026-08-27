# Dream / Memory System

> Consolidated from MEMORY.md auto-capture entries (2026-07-12 to 2026-07-14).
> Dream run: 2026-08-25. Confidence: 0.80 (avg).

---

## Confidence Scoring with Age Bonus

Entries with no `Confidence:` field get an age-based bonus on first dream scoring:
- < 14 days: +0.00
- 14-28 days: +0.05
- 28-56 days: +0.10
- > 56 days: +0.15

Cap baseline + age bonus at 0.85 before per-session reference bonuses. Entries already containing `Confidence:` use that recorded value as starting point.

## memory-log.sh PostToolUse Hook

Deterministically appends `### [capture]` entries to dream-log.md on every MEMORY.md Write/Edit. Edit extracts from new_string (all new headers), Write takes last header. CRLF + Windows path normalization throughout.

Dream skill skips `### [capture]` lines when finding last dream run date — match only `## Dream run --` (H2) headers.

## autoMemoryEnabled = false

Claude Code's built-in auto-memory diverts captures to `~/.claude/projects/<slug>/memory/` — wrong target for Dream. The plugin sets `autoMemoryEnabled: false` in project settings.json so Dream owns repo `memory/`. See topic-plugin-infrastructure.md for details.

## Memory-Capture Format

Concrete multi-field format in memory-capture hook ensures Claude writes `Confidence: 0.70` reliably (abstract template was being ignored). Format:
```
### [YYYY-MM-DD] <trigger> -- <topic>
<what to remember>
Trigger: <trigger>  Confidence: 0.70  Source: auto-capture
```
