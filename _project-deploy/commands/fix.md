---
description: "Apply a specific code-review ledger finding fix directly to source. Args: FP-<fingerprint> from the review ledger.  Example: /fix FP-a1b2c3d4"
argument-hint: "FP-<fingerprint> | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/fix — Apply a code-review ledger finding fix directly to source.

Arguments:
  FP-<fingerprint>    The finding fingerprint from the /code-review ledger
                      (e.g. FP-a1b2c3d4). Find fingerprints with /code-review.
  --help, ?help       Show this help.

Example:
  /fix FP-a1b2c3d4
```

<skill>ai-assisted-development:fix</skill>
