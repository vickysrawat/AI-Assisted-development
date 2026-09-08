---
description: "Generate a master Operational Runbook for the current application from the codebase — the single doc a support engineer opens at 3am. Markdown (source of truth) + offline HTML companion. Evidence-derived; unknowns are ⚠ TODO.  Example: /operations"
argument-hint: "(no arguments — asks to confirm scope) | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/operations — Generate the Operational Runbook for this application.

Produces the single document a support engineer opens during an incident:
architecture + dependency map, environments, access, routine ops
(deploy/rollback/restart/migrations), health/logs/monitoring, secrets +
rotation, symptom→playbook triage, failure-mode playbooks, backup/DR,
escalation + ownership, and a command appendix. Markdown (source of truth,
grep-discoverable) plus an offline HTML companion. Every unknowable value is a
⚠ TODO — never fabricated. No ICEA, no gates.

For the one-time go/no-go acceptance gate, use /go-live instead.

Arguments:
  (no arguments)   Confirm scope, then generate the runbook.
  --help, ?help    Show this help.

Example:
  /operations
```

<skill>ai-assisted-development:operations</skill>
