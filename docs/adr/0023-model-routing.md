# 0023 — Model routing tiers
Status: Accepted · Date: 2026-02 (retroactive, 2026-06-11)
Governs: `skills/shared/model-routing-spec.md`

## Problem
Different skills need different model capability levels — ICEA drafting and
critic need the strongest model; infrastructure tasks and token analysis don't.
A single model setting means either over-spending on trivial tasks or under-
powering critical judgment.

## Decision
Three tiers: ICEA_MODEL (drafting + critic), REVIEW_MODEL (code-review,
security), INFRA_MODEL (infrastructure). Each is an environment variable with
documented defaults. Project-level settings take priority over machine-level.
The spec stays tool-agnostic (check 26); wiring is in the consumer.

## Revisit when
Anthropic releases models where a single model handles all tiers cost-
effectively, or the org adopts a gateway that routes automatically by task.
