---
description: "Run a security review. Omit the flag for an interactive scope menu. Covers OWASP, secrets, auth, data exposure, and compliance mapping.  Example: /security-review --changed"
argument-hint: "[--full | --changed | --pr | --area <type> | --continue | --help]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/security-review — Structured OWASP security review with persistent tracking.

Arguments:
  (no flag)           Interactive scope menu — choose what to scan.
  --changed           Scan staged files only.
  --pr                Scan branch diff against target branch.
  --full              Scan all files, ignore cache.
  --ci                Full scan + emit cache warning for CI pipelines.
  --area <type>       Scope to a specific area: backend, frontend, config, or <ModuleName>.
  --continue          Resume from the last saved checkpoint.
  --help, ?help       Show this help.

Examples:
  /security-review
  /security-review --changed
  /security-review --area backend
  /security-review --full --ci
```

<skill>ai-assisted-development:security-review</skill>
