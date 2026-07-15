#!/usr/bin/env bash
# hooks/memory-capture.sh — UserPromptSubmit hook: memory capture prompt
#
# Fires when the user submits a message. Injects a memory-check reminder as
# additionalContext so Claude sees it BEFORE processing the new message —
# prompting it to write any memory entry from the PREVIOUS response first.
#
# IMPORTANT — correct event type: additionalContext is only valid on
# UserPromptSubmit and PostToolUse. Stop hooks do NOT support it (the schema
# only allows systemMessage/decision/reason on Stop events). Using the wrong
# event type causes "JSON validation failed: Invalid input".
#
# Guard: only prompts when this is a plugin-provisioned project
# (.claude/dream-init-state.json exists). Exits 0 silently on unrelated projects.
#
# Wired as hooks.UserPromptSubmit in .claude/settings.json by setup-init bootstrap.
# See docs/adr/0049-memory-capture-stop-hook.md for design rationale.

[ -f ".claude/dream-init-state.json" ] || exit 0

# Use node for JSON serialization — avoids escaping issues and is always available.
node -e '
const msg = [
  "💾 Memory check — if any of these happened in the PREVIOUS response, write to the repo-root memory/MEMORY.md NOW",
  "(the repo-relative memory/ folder at the project root — NOT the ~/.claude profile memory;",
  "before answering the current message — do not defer):",
  "  • Plan approved / approach agreed  → approach, tools chosen, constraints set",
  "  • Task completed                   → pattern that worked, convention confirmed",
  "  • Error resolved                   → error + root cause + fix + gotcha to avoid repeating",
  "  • Approach abandoned               → what failed, why, what not to retry",
  "  • Architecture decision            → decision + rationale + alternatives rejected",
  "If none apply, skip. Write a SEPARATE entry to memory/MEMORY.md for EACH trigger that fired:",
  "",
  "  ### [YYYY-MM-DD] <trigger> — <topic>",
  "  <what to remember — 1–3 sentences>",
  "  Trigger: <trigger>  Confidence: 0.70  Source: auto-capture"
].join("\n");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: msg
  }
}) + "\n");
'
