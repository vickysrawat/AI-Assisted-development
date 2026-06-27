# 0020 — Baseline strategy: pre-existing findings never gate
Status: Accepted · Date: 2026-06-11

## Problem
Running analyzers against a fifteen-year-old codebase for the first time
produces thousands of warnings. Ledgering them all blocks every commit on
inherited debt, and the team disables the feature within a week.

## Decision
First Phase D run writes all findings to ## Baseline (never gates). Only
findings new vs baseline, or baseline findings in touched files (boy-scout
rule, team-configurable), enter Open Findings. Baseline burns down via
/code-review --baseline-review, never by ambushing commits.

## Revisit when
Baseline count stabilizes at zero for 2 quarters — the section can be archived.
Or if the boy-scout rule generates excessive noise on frequently-touched legacy
files — may need a per-file opt-out.
