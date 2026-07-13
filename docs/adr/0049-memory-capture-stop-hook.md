# 0049 — Memory capture uses UserPromptSubmit hook with JSON `additionalContext`, not Stop
Status: Accepted · Date: 2026-07-08 · Revised: 2026-07-08 (Stop → UserPromptSubmit after schema validation failure)
Governs: `hooks/memory-capture.sh`, `scripts/setup-init-bootstrap.cjs` (stepWireSettings)

## Problem

Memory entries were never reaching `memory/MEMORY.md` in target applications despite the
trigger table in CLAUDE.md. Two root causes:

1. **No enforcement mechanism.** The trigger table is advice, not a gate. Under a long CLAUDE.md,
   the model routinely deprioritises instructions near the end of the file, especially when a new
   user message follows immediately (the model addresses the new request and forgets to capture).
2. **Settings.json had no hooks** in target projects because they were initialised before the
   bootstrap existed. Even after the bootstrap was added, the Stop hook for memory capture was
   never built.

## Decision

Add a **Stop hook** (`hooks/memory-capture.sh`) that fires after every Claude turn and injects
a compact capture checklist back to the model via `hookSpecificOutput.additionalContext`.

### Critical: `additionalContext` is NOT valid on Stop hooks

The initial implementation used `hookSpecificOutput.hookEventName: "Stop"` with
`additionalContext`. This caused a JSON schema validation failure:

```
Stop hook error: JSON validation failed: Hook JSON output validation failed: Invalid input
```

The Claude Code hook schema only supports `additionalContext` on **`UserPromptSubmit`** and
**`PostToolUse`** events. Stop hooks only support top-level fields: `continue`, `decision`,
`reason`, `systemMessage`, `stopReason`. There is no `additionalContext` on Stop.

The correct event type is **`UserPromptSubmit`** — fires when the user submits a message,
injects `additionalContext` into the model's context before it processes the new prompt.
Timing: the model sees "did anything happen in the previous response?" at the start of each
new turn, which achieves the same effect as a post-turn reminder.

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "<memory checklist text>"
  }
}
```

The hook uses `node -e '…'` for JSON serialisation (no `jq` dependency, no escaping hazards
from shell heredocs with special characters, and node is always available in plugin projects).

### Guard condition

The hook exits 0 silently when `.claude/dream-init-state.json` does not exist. This scopes it
to plugin-provisioned projects only and prevents it from firing in unrelated projects that
happen to have a `memory/` directory.

### CLAUDE.md dual-layer instruction

The trigger table in CLAUDE.md is strengthened with a **hard immediacy rule** — write in the
same response, not deferred. The Stop hook is a safety net; the CLAUDE.md instruction is the
primary mechanism.

### Automatic wiring via bootstrap

`dream-init-bootstrap.cjs` `stepWireSettings` wires both hooks in `.claude/settings.json`:
- `hooks.PreToolUse` → `icea-floor.sh` (ICEA enforcement gate)
- `hooks.UserPromptSubmit` → `memory-capture.sh` (memory capture reminder)

The bootstrap also cleans up any stale `hooks.Stop` entry for `memory-capture.sh` left by
the incorrect initial wiring, so re-running dream-sync self-heals the configuration.

Running `/dream-sync` on existing projects applies the wiring automatically.

## Rationale

- **Stop hook is the correct tier** (not PostToolUse): memory capture is a turn-level concern,
  not a per-tool concern. PostToolUse fires after every Write/Edit, which would be too frequent
  and interrupt the model mid-task. Stop fires once at end-of-turn.
- **JSON output is non-negotiable:** verified experimentally and confirmed in Claude Code
  documentation — plain stdout from Stop hooks reaches the terminal only. This is the primary
  trap that would make the whole feature a no-op if implemented naively with `cat << 'EOF'`.
- **Noise on every turn is acceptable for now:** the model sees the checklist and writes nothing
  when no trigger fired — the "skip if none apply" instruction handles this. Optimisation
  (smarter guard detecting turns with Write/Edit activity) is deferred to a later pass.

## Consequences

- New `hooks/memory-capture.sh` (node-based JSON output).
- `scripts/setup-init-bootstrap.cjs` HOOK_FILES + stepWireSettings updated.
- `CLAUDE.md` `# Dream` section strengthened with immediacy rule.
- `DEVELOPER-GUIDE.md` and `docs/workflow/developer-guide.html` document the mechanism and
  fallback troubleshooting steps.
- Existing target projects: run `/dream-sync` once; bootstrap sync mode wires both hooks.

## Revisit when

A smarter guard (e.g. only fire after turns containing Write/Edit/Bash tool calls) is worth
adding once the feature is confirmed working — it reduces noise without changing the mechanism.
