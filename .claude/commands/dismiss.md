---
description: "Dismiss a finding with an auditable justification. Args: FP-<fingerprint> <disposition> \"<reason>\".  Example: /dismiss FP-a1b2c3d4 false-positive \"third-party library call\""
argument-hint: "FP-<fingerprint> false-positive|wont-fix|accepted-risk|by-design \"<reason>\" [--undo | --help]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/dismiss — Dismiss a code-review or security finding with an auditable justification.

Arguments:
  FP-<fingerprint>      The finding fingerprint from the code-review or security ledger.
  false-positive        Disposition: the finding is incorrect.
  wont-fix              Disposition: known issue, accepted as-is.
  accepted-risk         Disposition: risk acknowledged and accepted by the team.
  by-design             Disposition: the behaviour is intentional.
  "<reason>"            Justification text (required, in quotes).
  --undo                Reverse a prior dismissal for this fingerprint.
  --help, ?help         Show this help.

Examples:
  /dismiss FP-a1b2c3d4 false-positive "third-party library call, not our code"
  /dismiss FP-b5c6d7e8 wont-fix "low severity, tracked in ADO-2002"
  /dismiss FP-a1b2c3d4 --undo
```

<skill>ai-assisted-development:dismiss</skill>
