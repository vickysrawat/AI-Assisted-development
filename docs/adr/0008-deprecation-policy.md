# 0008 — Deprecation policy: telemetry-driven removal reviews
Status: Accepted · Date: 2026-06-11

## Problem
25 commands, 19 skills, 9 shared specs — and nothing has ever been removed.
Scaffold scripts lower the cost of adding while doing nothing to the cost of
understanding. Unbounded growth is itself a failure mode.

## Decision
token-analysis already records per-skill usage telemetry. Each release, the
maintainer reviews the usage table: any command/skill unused for two
consecutive quarters enters deprecation review — kept (with written reason),
merged, or removed in the next minor version. Removals get an ADR.

Companion rule (bus factor): at least one release per half-year is authored
end-to-end by someone other than the primary maintainer.

## Rationale
The rule matters less than its existence: it establishes removal as normal.
The measurement already exists; this just mandates someone look at it.

## Revisit when
The plugin gains multiple active maintainers and a real RFC process — this
lightweight policy is sized for a one-to-two-person team.
