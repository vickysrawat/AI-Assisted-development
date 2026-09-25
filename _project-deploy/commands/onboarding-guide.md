---
description: "Generate or refresh the project onboarding guide (docs/ONBOARDING.md) for developers and tech leads joining the project."
argument-hint: "[--refresh]"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop:

```
/onboarding-guide — Generate the project onboarding guide

Produces docs/ONBOARDING.md — a project-specific guide for:
  • Developers joining the project (ICEA workflow, daily commands, gate troubleshooting)
  • Tech leads (approving ICEAs, governance report, role configuration)

Reads: architecture.md, ApprovalRoles.json, dream-init-state.json
Output: docs/ONBOARDING.md

Arguments:
  --refresh     Regenerate even if docs/ONBOARDING.md already exists
  --help        Show this help

Also triggered by:
  ONBOARDING GUIDE            (generate if missing)
  ONBOARDING GUIDE --refresh  (always regenerate)

Automatically run by /setup-init (first-time) and offered by /setup-sync (after upgrades).
```

<skill>ai-assisted-development:onboarding-guide</skill>
