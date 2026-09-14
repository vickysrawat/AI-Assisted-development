---
description: "Write/refresh the repo's ignore file with plugin-required entries. Auto-detects VCS: writes .gitignore on Git, .tfignore on TFVC. Creates the file if missing, never touches your own lines.  Example: /gitignore-sync --with-artifacts"
argument-hint: "[--with-artifacts | --help]  — omit to be prompted (plugin entries only recommended; CI does plugin entries only)"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/gitignore-sync — Write/refresh the repo's VCS ignore file with plugin-required entries.

Auto-detects VCS: writes .gitignore on Git repos, .tfignore on TFVC/TFS repos.
Creates the file if missing. Never modifies your own entries — only the managed block.

Arguments:
  (no arguments)     Prompt: plugin entries only (recommended) or also detect artifacts. (CI / non-interactive: plugin entries only, no prompt.)
  --with-artifacts   Also scan for and offer to add detected build/env artifact patterns.
  --help, ?help      Show this help.

Examples:
  /gitignore-sync
  /gitignore-sync --with-artifacts
```

<skill>ai-assisted-development:gitignore-sync</skill>
