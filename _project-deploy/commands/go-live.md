---
description: "Generate a Support-Transition Acceptance Checklist (go/no-go gate). Ingests the latest readiness report + security ledger + code-review ledger + deployment architecture to derive go-live blockers. Absent inputs become ⚠ TODO rows — findings are never fabricated.  Example: /go-live"
argument-hint: "(no arguments — asks to confirm scope) | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/go-live — Generate the Support-Transition Acceptance Checklist (go/no-go gate).

The one-time sign-off sheet an incoming support team uses to accept the app
into support. Ingests the plugin's other outputs — the latest prod-readiness
report, the security-review ledger, the code-review ledger — plus deployment
architecture and pipeline state, and derives Section-A go-live blockers and
Section-B fast-follow items from them. Auto-links the Operational Runbook.
A missing input becomes a ⚠ TODO "unverified" row (run the relevant skill) —
never a silent pass, never a fabricated finding. No ICEA, no gates.

For the living operational runbook itself, use /operations instead.

Arguments:
  (no arguments)   Confirm scope, then generate the checklist.
  --help, ?help    Show this help.

Example:
  /go-live
```

<skill>ai-assisted-development:go-live</skill>
