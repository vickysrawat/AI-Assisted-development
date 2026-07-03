# 0024 — Async checkpoint queue (proposal, v0.9)
Status: Proposal · Date: 2026-06-11
Governs: `docs/proposals/async-checkpoint-queue.md`

## Problem
Human gates are synchronous interrupts — every ICEA approval, every critic
escalation, every accepted-risk dismissal blocks work until a human responds.
Agent-era development needs gates that preserve accountability transfer
(a named person takes responsibility) without requiring real-time attendance.

## Decision (proposed)
Generalize pr-create's draft-artifact pattern: work proceeds on provisionally-
approved artifacts under strict containment (icea-floor hook, nothing committed,
no ledger writes), and the human reviews a queue on their schedule. Phased:
pr-create first (already async), then ICEA queue for T2, then critic and
dismissal escalations. T3 always synchronous. Each phase gated on the prior
phase's scorecard.

## Revisit when
Phase 1 prototype is deployed; accuracy and gate-override data determine
whether Phase 2 proceeds.
