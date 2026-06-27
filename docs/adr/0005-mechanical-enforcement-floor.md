# 0005 — Mechanical enforcement floor (hooks) beneath prompt gates
Status: Accepted · Date: 2026-06-11

## Problem
Every hard rule was a model instruction — probabilistic by nature. For a
regulated environment the gap between "usually enforced" and "enforced"
matters, and no prompt can close it.

## Decision
Three enforcement tiers; each rule lives at the lowest tier that can hold it.
(a) model instructions — judgment; (b) PreToolUse hooks — deterministic per
tool call; (c) git/CI hooks — deterministic, survive any client. Shipped:
icea-floor.sh (b), findings-gate-precommit.sh (c), validate-ledgers.py (c).
Principle: prompts propose, hooks dispose.

## Rationale
The hook can't know WHICH feature a write belongs to (coarse floor), but it
guarantees code is never written with NO approval at all. The prompt layer
keeps the rich judgment; evals measure it; hooks guarantee the minimum.

## Revisit when
Claude Code hook capabilities expand enough to move per-feature ICEA matching
from tier (a) to tier (b).
