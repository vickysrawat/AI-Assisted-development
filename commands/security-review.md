---
description: Security review — scans codebase for OWASP, CWE, and IaC vulnerabilities. Writes HTML report to security/ and updates security/security-ledger.md with FP-fingerprinted findings. Use /fix FP-xxxxxxxx to apply remediations. Flags: --pr (git diff, PR changes only), --changed (git diff, uncommitted changes), --full (entire working tree, no limit), --ci, --area, --continue. Invoked with no flag, it presents an interactive scope menu (skipped in CI).
argument-hint: [--changed | --pr | --full | --ci | --with-deps]  — omit to pick from the interactive scope menu (--with-deps also scans additionalDirectories dependency repos)
---

# /security-review

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/security/SKILL.md` and execute it in full, passing the provided scope flag.

If **no flag** was provided, do not default silently — the skill presents the interactive scope
menu (Step 0a) and waits for a choice. The **only** exception is CI / non-interactive runs
(`--ci`, headless, or gate-invoked), which skip the menu and use the cache-aware full scan.
