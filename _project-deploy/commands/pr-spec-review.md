---
description: "Review a Pull Request against a functional specification or ICEA document. Produces a structured pass/fail compliance report. Use when checking a PR against a spec before merging.  Example: /pr-spec-review"
argument-hint: "(no arguments — paste the spec when prompted) | --help"
---

# /pr-spec-review

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/pr-spec-review — Review a PR against a functional spec or ICEA.

Produces a structured pass/fail compliance report mapping PR changes to spec requirements.
Paste the spec or ICEA content when prompted, or it will auto-locate by branch ADO ID.

Arguments:
  (no arguments)   Start the review — spec will be requested interactively.
  --help, ?help    Show this help.

Example:
  /pr-spec-review
```

<skill>ai-assisted-development:pr-spec-review</skill>
