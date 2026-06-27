# 0018 — Language-agnostic design
Status: Accepted · Date: 2026-04 (retroactive, 2026-06-11)

Governs: language-coverage matrix in `tests/validate.py`, per-language rule files

## Problem
The plugin began assuming one stack: .NET, Angular, Node.js. But the ICEA gate,
the memory system, the consent model, the critic — none are language ideas.
They're workflow ideas.

## Decision
Detection routes by repo-type signal; generation reads active layers from
architecture.md; review and scanning dispatch to per-language references by file
extension. A language-coverage matrix gates support: a language isn't "supported"
until it has a rule file, a review checker, and an architecture template.
Half-added languages fail the validator instead of silently misbehaving.

## Revisit when
A supported language needs runtime that can't be assumed on the developer's
machine (e.g. Java linting requires a JDK the developer may not have for a
polyglot repo) — probe-ladder pattern from phase-d-spec handles this.
