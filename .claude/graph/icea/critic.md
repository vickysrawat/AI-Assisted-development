---
paths: skills/critic
---
_Fingerprint: da4e9aad2e054e1a6a9ee8d8706327585d8da36a | Updated: 2026-07-13_

## Bounded context
Second-pass critic. Three modes: `icea` (completeness/testability/B1-B7/scope), `tech` (ICEA↔design traceability, D-option fidelity), `code` (ICEA traceability, simplicity, rules compliance).

## Key files
- `SKILL.md` v1.1

## Dependencies
- ICEA or Tech Spec draft (in-context or on disk)
- Source code (code mode)

## Patterns
- AUTO-fired by icea-feature at Step 5 (icea mode) and Step 8 (tech mode)
- AUTO-fired by icea-implement at Step 4a (code mode)
- Bounded auto-revise loop (max 2 retries) at each gate (ADR 0052)
- Can also be invoked standalone: /critic icea|tech|code
