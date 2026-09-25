# Context Budget Spec — Plugin-wide context guard protocol

## Purpose

Prevents a long-running skill from starting a step on an exhausted session. The guard is
enforced by `_project-deploy/hooks/context-guard.cjs` (a `UserPromptSubmit` hook): it fires
before the developer's reply is processed and blocks if remaining context is below the
declared headroom for the current step.

This replaces hardcoded token estimates in skill prose — estimates diverge, rot, and are
model-specific. The guard is model-agnostic: window size is configured once in
`.claude-plugin/context-budgets.json`, not embedded in SKILL.md files.

## How it works

```
Developer replies CONTINUE at a STEP BOUNDARY
          │
          ▼
UserPromptSubmit hook fires (before the message reaches the model)
          │
          ├─ Read last assistant usage block from transcript:
          │    used = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
          │
          ├─ Read .claude/active-task.json → { skill, step, ado }
          │
          ├─ Read .claude-plugin/context-budgets.json → window_size, declared_need[skill][step]
          │
          ├─ remaining = window_size - used
          │
          ├─ remaining ≥ declared_need → allow (exit 0, no output)
          │
          └─ remaining < declared_need → BLOCK (exit 2, stderr message with /compact + resume)
```

## active-task.json schema

Written by the skill immediately before showing each STEP BOUNDARY prompt. The hook reads
the file on the developer's next reply.

```json
{
  "skill": "rewrite",
  "step":  "step2.5",
  "ado":   "9000"
}
```

- `skill`: matches a key in `context-budgets.json → skills`
- `step`: matches a key in `context-budgets.json → skills[skill]`
- `ado`: used to build the resume command shown in the block message

### Location

Always `.claude/active-task.json` relative to the project root (process.cwd()).
The hook reads from there; the skill writes there.

## How to add a new skill

### 1 — Declare headroom in `.claude-plugin/context-budgets.json`

```json
"skills": {
  "my-skill": {
    "step1": 20000,
    "step2": 40000
  }
}
```

Values are in tokens. Use the main-session cost from the skill's budget table (subagent
costs do not count — they run in isolated contexts). Add a safety buffer: if main-session
cost is ~25–40K, declare 40000 (upper bound).

### 2 — Write `active-task.json` at each STEP BOUNDARY

In the STEP BOUNDARY block of the skill, immediately before the `_(Do not proceed...)_`
line:

```
> 📊 **STEP BOUNDARY — Step N: ...**
> Write `.claude/active-task.json`:
>   `{"skill":"my-skill","step":"step1","ado":"{ADO}"}`
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> ...
> _(Do not proceed past this prompt without a reply.)_
```

The AI writes the file, then waits for the developer's reply. When the reply arrives, the
hook fires and measures context before the message is processed.

### 3 — Remove inline token estimates from the skill

Inline estimates ("Expected cost: ~60–100K tokens") become redundant once the guard
enforces the declared need. Remove them from the skill prose to prevent contradictions.
Keep the budget table (at the start of the skill or in a dedicated section) as a planning
reference only.

## Model window configuration

Update `context-budgets.json → model_windows` to match the model in use:

```json
"model_windows": {
  "claude-sonnet-4-6": 1000000
}
```

The model ID is taken from the transcript entry's `message.model` field. If the model ID
is not in the map, `default_window` is used (conservative — set to 200000).

## Wiring the hook

Add to `.claude/settings.json` in the target project:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node .claude-plugin/hooks/context-guard.cjs" }] }
    ]
  }
}
```

`setup-init` deploys this automatically when migration skills are detected in the project.

## What the guard does NOT cover

- Context exhaustion DURING a step (after the reply is allowed in). The checkpoint +
  resume mechanism handles mid-step recovery: if context expires, the skill writes the
  checkpoint, shows a stop instruction, and the developer resumes via `SKILL RESUME ADO-{ID}`.
- Subagent context: subagents run in isolated contexts; their token usage does not count
  against the main session window.
- Quality of output: the guard prevents STARTING a step with insufficient context; it
  cannot guarantee quality once the step is underway.
