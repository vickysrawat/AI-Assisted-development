---
description: "Run a static-analysis code review with persistent tracking. Omit the flag for an interactive scope menu (skipped in CI). Flags: --full (ignore cache, scan all), --ci (full + cache warning), --changed (staged files only), --pr (branch diff only).  Example: /code-review --changed"
argument-hint: "[--full | --ci | --changed | --pr | path | --with-deps | --help]  — omit for the interactive scope menu"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/code-review — static code analysis with persistent finding cache.

Arguments:
  (no flag)        Interactive scope menu — choose what to scan. (CI / non-interactive: cache-aware full scan, no prompt.)
  --full           Ignore cache, scan all files from scratch.
  --ci             Full scan + emit cache warning for CI pipelines.
  --changed        Scan staged files only.
  --pr             Scan the branch diff against the target branch only.
  <path>           Scan a specific file or directory.
  --help, ?help    Show this help.

Examples:
  /code-review
  /code-review --changed
  /code-review --pr
  /code-review --full
  /code-review src/api/
```

<skill>ai-assisted-development:code-review</skill>
