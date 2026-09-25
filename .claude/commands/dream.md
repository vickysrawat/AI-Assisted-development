---
description: "Run a Dream memory consolidation pass — reads Claude Code sessions, scores entries, proposes ADD/UPDATE/DELETE operations with justification, and waits for tiered approval before writing.  Example: /dream"
argument-hint: "(no arguments) | --help"
---

# /dream

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/dream — Memory consolidation pass.

Reads recent Claude Code sessions, scores memory entries by confidence, and proposes
ADD/UPDATE/DELETE operations with justification. Waits for tiered approval before writing
to memory/MEMORY.md. Run every 5–8 sessions for optimal memory health.

Arguments:
  (no arguments)   Run the consolidation pass.
  --help, ?help    Show this help.

Example:
  /dream
```

<skill>ai-assisted-development:dream</skill>
