# 0007 — Memory citation telemetry and audit loop
Status: Accepted · Date: 2026-06-11

## Problem
Dream promoted facts with confidence scores but nothing measured whether
promoted memory improved later sessions. A subtly wrong fact in CLAUDE.md
silently steered every future session until a human noticed.

## Decision
Three proxies, all from existing artifacts: citation stamps (session-start
marks topic files that actually influenced the brief), [CORRECTION] events
(dream tags developer corrections of remembered facts), and rollback rate per
category (from dream-log). /dream-audit aggregates quarterly: archives uncited
files, surfaces contradictions, writes audit-hints.md that lowers promotion
confidence for high-rollback categories.

## Rationale
True memory quality is a counterfactual; these proxies are observable and
cheap. The loop converts memory from write-only-with-manual-undo to
self-pruning — which is what the REM-sleep metaphor promised.

## Revisit when
Citation stamping proves too noisy (everything cited) or too strict (nothing
cited) — tune the "genuinely used" bar in session-start Step 2.
