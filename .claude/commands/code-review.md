---
description: "Run a Coverity-style code review with persistent tracking. Flags: --full (ignore cache, scan all), --ci (full + cache warning), --changed (staged files only), --pr (branch diff only).  Example: /code-review --changed"
argument-hint: "[--full | --ci | --changed | --pr | path | --help]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/code-review — Coverity-style static analysis with persistent finding cache.

Arguments:
  (no flag)        Incremental scan — only files changed since last cached review.
  --full           Ignore cache, scan all files from scratch.
  --ci             Full scan + emit cache warning for CI pipelines.
  --changed        Scan staged files only.
  --pr             Scan the branch diff against the target branch only.
  <path>           Scan a specific file or directory.
  --help, ?help    Show this help.

Examples:
  /code-review --changed
  /code-review --pr
  /code-review --full
  /code-review src/api/
```

<skill>ai-assisted-development:code-review</skill>
