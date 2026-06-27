# 0010 — Local-only authoritative enforcement (supersedes 0009's deployment claim)
Status: Accepted · Date: 2026-06-11 · Supersedes: 0009 (deployment model only)

## Problem
ADR 0009 made CI the authoritative enforcement rung. The actual deployment
model is: plugin on the developer's laptop, never in CI. The application's own
toolchain (MSBuild for a Framework app) is guaranteed locally — the developer
could not work otherwise — but no pipeline will ever run the plugin's gates.

## Decision
The enforcement ladder ends at the local rung: prompt → local hook, full stop.
Consequences accepted and designed for:
- dream-status check 1p (hook integrity) is the single mechanical assurance;
  session-start performs a lightweight hook presence check every session.
- Bypass telemetry relocates: pr-create re-runs compliance and T1-bound checks
  at submission (last plugin-controlled checkpoint); sprint-metrics mines
  commit history for gaps (source commits with no checkin artifacts).
- architecture-deployment.md records which ADO-native branch policies
  (required reviewers, linked work items) back the plugin up; the governance
  story is the combination, honestly described.
- The CI scripts (validate-ledgers.py, validate-pr-compliance.py) remain in
  hooks/ — plain Python, model-free, CI-compatible if the org ever reconsiders.

## Honesty clause (required reading)
A determined developer can bypass everything local: --no-verify, deleted
hooks, unwired settings. The floor governs the willing and makes bypass
VISIBLE (1p integrity, pr-create re-checks, history mining) — it does not make
bypass impossible. For this organisation that is an accepted posture; claiming
otherwise would be the overclaim this plugin refuses everywhere else.

## Revisit when
The org permits plugin-related checks in CI (flip the authoritative rung back
per 0009 — the scripts are ready), or Claude Code ships tamper-evident hooks.
