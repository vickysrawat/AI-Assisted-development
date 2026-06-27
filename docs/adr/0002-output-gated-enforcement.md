# 0002 — Output-gated enforcement over input-triggered
Status: Accepted · Date: 2026-04 (retroactive record, 2026-06-11)

## Problem
icea-feature contained its own trigger detection — "load me when you see these
words." It failed reliably: the model began implementing before the skill
loaded, then self-corrected mid-stream. Enforcement that depends on the
enforcer being consulted first will be bypassed.

## Decision
Hard rules fire on what the model is about to PRODUCE, not on what the
developer typed. "Never write implementation code without an approved ICEA on
disk" lives in CLAUDE.md as a standing output rule; trigger detection is a
routing convenience, not the enforcement.

## Rationale
There is no pre-request hook in Claude Code; input-triggered enforcement is
probabilistic by definition. Output-gating is structurally harder to bypass
because it constrains the artifact, not the conversation.

## Revisit when
Claude Code ships pre-request hooks, or ADR 0005's mechanical floor proves
sufficient to retire the prompt-layer rule entirely (unlikely — judgment layer
remains valuable).
