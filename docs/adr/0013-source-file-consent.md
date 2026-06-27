# 0013 — Source-file consent model (Category A/B/C)
Status: Accepted · Date: 2026-03 (retroactive, 2026-06-11)
Governs: `skills/shared/source-file-consent.md`

## Problem
Claude was reading source files without telling the developer — the ICEA skill
silently opened controllers, the PR review read every changed file before the
developer knew it had started. For a tool the team is supposed to trust, opacity
is poison.

## Decision
Three consent categories per skill. A (scan tools): announce what will be read
and why before the first file opens. B (review skills): ask before each file
with the file, why, what it's looking for, and token cost. C (infrastructure):
never reads source regardless of request. Every skill declares its category.

## Revisit when
Category B creates measurable friction (tracked as consent-gate time in token
analysis). Could evolve to blanket consent per session with a summary, rather
than per-file, if accuracy data shows the model's file-selection is reliable.
