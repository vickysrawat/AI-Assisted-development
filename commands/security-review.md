---
description: Security review — scans codebase for OWASP, CWE, and IaC vulnerabilities. Writes HTML report to security/ and updates security/security-ledger.md with FP-fingerprinted findings. Use /fix FP-xxxxxxxx to apply remediations. Flags: --pr (git diff, PR changes only), --changed (git diff, uncommitted changes), --full (entire working tree, no limit), --ci, --area, --continue.
argument-hint: [--changed | --pr | --full | --ci]
---

# /security-review

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Read `$PLUGIN_DIR/skills/security/SKILL.md` and execute it in full, passing the provided scope flag.
