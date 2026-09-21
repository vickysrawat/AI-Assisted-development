# ADR-0062: Minimal org config — ApprovalRoles.json only, setup-init prompted

**Status:** Accepted · 2026-09-20
**Related:** ADR-0061 (RBAC)

## Context

To implement RBAC (ADR-0061), the plugin needs a role registry: who are the tech leads,
who are the security officers? This registry must be team-shared, version-controlled, and
populated without friction. Three design axes: what data to store, where to store it, and
when to populate it.

## Decision

**What:** Minimal scope — `.claude/ApprovalRoles.json` with two arrays only:
```json
{ "tech_leads": [...emails], "security_officers": [...emails] }
```

**Where:** Per-project committed file at `.claude/ApprovalRoles.json`.
Not a machine-level `~/.claude/org-config.json` (invisible to git, per-machine drift).
Not a full org config with gates, thresholds, and overrides (deferred as future item).

**When:** Prompted during `setup-init` Step 2d (tech leads + security officers,
comma-separated emails, Enter to skip). Step is skipped idempotently if file already exists.

**File name:** `ApprovalRoles.json` — names the concern directly (not `org-config.json`).

**Opt-out:** empty arrays in the file → all RBAC checks pass silently.
Missing file → same behaviour (opt-out). Teams that don't want enforcement skip the prompt.

## Rationale

**Minimal scope over full org config:** full org config (gates, thresholds, per-stack
overrides) adds complexity for uncertain future benefit. The two arrays unblock RBAC and the
governance report without premature abstraction.

**Per-project file over machine-level file:** a machine-level `~/.claude/org-config.json`
is invisible to git reviewers and drifts across developer machines. A committed per-project
file is version-controlled, diff-able, and deployable by `setup-sync`.

**setup-init prompt over separate command:** collecting roles at setup time is contextual —
the developer is already in setup mode answering questions. A separate command requires a
second session and often gets skipped.

## Alternatives Rejected

| Alternative | Reason rejected |
|---|---|
| Full org config with gates/thresholds | Premature — adds complexity before the need is proven |
| Machine-level `~/.claude/org-config.json` | Not version-controlled; drifts per machine; invisible to git |
| Hardcoded role check (no config file) | Cannot adapt to team composition changes without code changes |

## Consequences

- `setup-init` Step 2d prompts for tech lead and security officer emails
- `setup-status` check 1w validates presence and non-empty state
- `setup-sync` offers to refresh if team composition changes
- Future: full org config (gates, per-stack thresholds) can be added in a new file without changing this one
