# 0006 — Diff-classified change tiers (T1/T2/T3)
Status: Accepted · Date: 2026-06-11
Governs: `skills/shared/change-tier-spec.md`

## Problem
The full ICEA ceremony applied to every change, including one-line renames.
Ceremony without payoff teaches developers to resent the tooling — and to
describe features as bugs to dodge the gate.

## Decision
The SYSTEM classifies each change from measurable diff properties (files,
lines, signatures, dependencies, sensitive paths) into T1 micro / T2 standard /
T3 elevated. Developers never request a tier. T1 gets a one-line auto-ICEA
with implied approval; the critic still runs. Re-classification at checkin can
only move tiers UP; a T1 diff that outgrew its bounds blocks the commit.

## Rationale
The moment developers self-classify, "trivial" expands monthly. Mechanical
classification removes the thing to game. The critic remaining unconditional
means T1 removes the interrupt, not the quality gate.

## Revisit when
T1 misclassification (T1 changes later causing rework) appears in the net-value
scorecard, or thresholds (1 file / 20 lines) prove wrong in either direction.
