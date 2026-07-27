---
description: "Re-scans project manifests and updates .claude/settings.local.json additionalDirectories. Run after adding or removing an external project reference.  Example: /sync-dirs"
argument-hint: "(no arguments) | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop:

```
/sync-dirs — Re-scan project manifests and update additionalDirectories.

Updates .claude/settings.local.json with the current set of external project
references. Run after adding or removing a project reference.

Arguments:
  (no arguments)   Run the re-scan.
  --help, ?help    Show this help.

Example:
  /sync-dirs
```

Read the full command at `commands/sync-dirs.md` in the plugin and execute it.
