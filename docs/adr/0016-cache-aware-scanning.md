# 0016 — Cache-aware scanning and token efficiency
Status: Accepted · Date: 2026-02 (retroactive, 2026-06-11)
Governs: `skills/shared/file-cache-schema.md`, `skills/shared/scope-flags-spec.md`, `skills/shared/single-writer-assumption.md`

## Problem
Every skill treated every run as a cold start. Code-review re-scanned all 50
files daily; security loaded all language references regardless of stack. The
ICEA skill read thousands of lines to orient itself. Token costs were 80–95%
higher than necessary.

## Decision
Shared primitives: domain-map.md for orientation (one read vs hundreds),
file-cache.json for change detection (character count per file — scan only
what changed), scope flags (--changed, --pr, --full) for developer control.
First run is a full baseline; every subsequent run processes only the delta.

## Revisit when
Token-analysis telemetry shows cache misses rising (files changing between
scans faster than the cache updates) — may need hash-based detection instead
of character-count.
