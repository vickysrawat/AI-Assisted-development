# ADR-0068: Context-aware onboarding guide generated at setup time

**Status:** Accepted · 2026-09-20

## Context

New developers and tech leads joining a project need to understand: what the project is,
how the ICEA workflow works on this team, who approves ICEAs, and what to do when gates
block them. A generic guide exists in the plugin README, but it doesn't know the project's
stack, who the tech leads are, or which ADO organisation the team uses. Generic documentation
gets ignored.

## Decision

A skill (`/onboarding-guide`) generates `docs/ONBOARDING.md` by reading:
- `.claude/architecture/architecture.md` — project overview and stack
- `.claude/ApprovalRoles.json` — actual tech leads and security officers
- `.claude/dream-init-state.json` — detected stacks and plugin version
- `CLAUDE.md` §2 — ADO organisation and project

The generated document has two role-specific sections: "For Developers" and "For Tech Leads".

**Invocation triggers:**
1. `setup-init` Step 4 — auto-generates if `docs/ONBOARDING.md` does not exist
2. `setup-sync` Step 7b — offers to regenerate after a sync (roles or stack may have changed)
3. `ONBOARDING GUIDE` / `ONBOARDING GUIDE --refresh` — explicit invocation at any time

**Idempotency:** `setup-init` skips generation if the file already exists (developer may
have customised it). `--refresh` flag regenerates unconditionally.

## Rationale

**Generated over static template:** a static template with placeholders (`{TECH_LEAD}`,
`{STACK}`) requires manual population and goes stale. A generated guide that reads
`ApprovalRoles.json` at generation time reflects the actual team composition. When new tech
leads are added and `setup-sync` is run, the guide can be refreshed automatically.

**Both audiences in one document over two separate guides:** developers and tech leads share
most context (project overview, workflow, commands). Role-specific sections add ~30% content.
Two separate documents double the maintenance burden and create inconsistency drift.

**Auto-generated at setup-init:** the highest value is at team onboarding time, which
coincides with `setup-init`. Generating it automatically means new projects always have a
guide from day one without requiring an additional manual step.

**Offered (not forced) at setup-sync:** setup-sync is run when the plugin is upgraded — not
necessarily when team composition changes. Forcing regeneration would overwrite customisations.
An offer preserves developer agency.

## Alternatives Rejected

| Alternative | Reason rejected |
|---|---|
| Static template deployed by setup-init | Placeholders require manual population; goes stale |
| Two separate guides (developer / tech lead) | Double maintenance; inconsistency drift |
| Extend product-docs skill | product-docs generates product/user docs; onboarding is plugin-specific content |

## Consequences

- `docs/ONBOARDING.md` is generated, committed, and shareable with new team members
- The guide must be regenerated (`--refresh`) when ApprovalRoles.json or architecture.md changes
- `setup-sync` Step 7b prompts for refresh — teams that customise the guide should use SKIP
- Plugin version is stamped in the guide header so staleness is visible
