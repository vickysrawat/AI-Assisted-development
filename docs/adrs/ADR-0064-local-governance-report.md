# ADR-0064: Sprint governance report — local-only, no telemetry

**Status:** Accepted · 2026-09-20
**Related:** ADR-0060 (audit trail)

## Context

The plugin team and project tech leads have no aggregate visibility into how the plugin is
being used, where governance is breaking down, or whether the team is following the ICEA
process. "Telemetry" was listed as an enterprise readiness gap. The design question: who
benefits, what data is needed, and where does it go?

## Decision

A local-only sprint governance report (`GOVERNANCE REPORT` command). No data is transmitted.
Consumer is the tech lead per project, not the plugin maintainer.

The report reads three existing data sources:
- `.claude/audit/*.json` — governance events (ADR-0060)
- `token-analysis/token-graph.json` — skill token costs
- Finding ledgers — open/dismissed finding counts

Output is saved to `governance/governance-report-{date}.md`.

Reports cover: ICEA approvals, gate bypasses, RBAC blocks, finding dismissals, config
changes, model distribution (Pass B), estimated cost (ADR-0067), and auto-generated lessons.
Lessons surface patterns and offer project-knowledge.md promotion.

## Rationale

**Local-only over network telemetry:** Kirkland & Ellis is a law firm. Automatic data
transmission to any server — even an internal one — requires legal and compliance review that
was explicitly out of scope. A local report satisfies the visibility need without network calls.

**Tech lead consumer over plugin maintainer:** the plugin maintainer cannot receive data without
a server. The tech lead can run a local report and act on it immediately. The value is in
per-sprint process improvement, not in aggregate cross-firm analytics.

**Reading existing data sources over new logging:** the audit trail (ADR-0060) already captures
the governance events. Token analysis already captures costs. Building new logging infra
would duplicate what exists and add maintenance burden.

## Alternatives Rejected

| Alternative | Reason rejected |
|---|---|
| Opt-in telemetry to plugin author's server | Prohibited by law firm context; requires infrastructure not yet built |
| Per-developer usage log | Individual visibility only; tech leads need team aggregate |
| Manual reporting by developers | Too much friction; never happens consistently |

## Consequences

- `scripts/governance-report.cjs` aggregates existing data sources
- `GOVERNANCE REPORT [--since / --days / --sprint]` keyword handler in CLAUDE.md
- `governance/` directory created by setup-init bootstrap
- Item 15 (per-invocation model tracking) improves cost accuracy over time
