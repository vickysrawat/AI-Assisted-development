#!/usr/bin/env pwsh
# hooks/memory-capture.ps1 — UserPromptSubmit hook: memory capture prompt (PowerShell port of memory-capture.sh)
#
# Fallback when bash is unavailable. Behaviour is identical to memory-capture.sh.
# Invoked by dispatch.cjs — do not call directly from settings.json.
#
# Guard: only active when .claude/dream-init-state.json exists (plugin-provisioned project).
# Output: JSON with hookSpecificOutput.additionalContext injected before the user message.

if (-not (Test-Path '.claude/dream-init-state.json')) { exit 0 }

# All non-ASCII chars use \u escapes so the JS source stays ASCII-safe when passed as a
# command-line arg to node on any Windows console code page (CP-1252, UTF-8, or otherwise).
$js = @'
const msg = [
  "\u{1F4BE} Memory check — if any of these happened in the PREVIOUS response, write to the repo-root memory/MEMORY.md NOW",
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
'@

& node -e $js
exit $LASTEXITCODE
