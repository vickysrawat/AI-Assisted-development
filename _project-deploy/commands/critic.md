---
description: "Run the critic as a standalone pass. Phase argument: icea (critique a spec) or code (critique generated/changed code). With no phase, infers from context.  Example: /critic icea ADO-1847"
argument-hint: "[icea | code | --help] [ADO-<id>]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/critic — Run the critic as a standalone pass on an ICEA spec or generated code.

Arguments:
  icea [ADO-<id>]    Critique an ICEA draft for completeness, testability, and B1–B7 coverage.
                     ADO id is optional — inferred from the branch name if omitted.
  code [ADO-<id>]    Critique staged/changed source files for ICEA traceability, simplicity,
                     rules compliance, decision transparency, and hidden assumptions.
                     ADO id is optional.
  (no argument)      Infers mode from context: code if generated code is in session,
                     else icea for the current branch's ADO id.
  --help, ?help      Show this help.

Examples:
  /critic icea ADO-1847
  /critic icea                  (id inferred from branch)
  /critic code ADO-1847
  /critic code                  (staged files, id inferred from branch)
  /critic                       (mode inferred from context)
```

<skill>ai-assisted-development:critic</skill>
