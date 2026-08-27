# Code Review (SAST)

> Consolidated from MEMORY.md auto-capture entries (2026-07-16 to 2026-07-17).
> Dream run: 2026-08-25. Confidence: 0.85 (avg).

---

## Multi-Agent Architecture

Phase 2.5 taint tracer (confirmed at 0.85 confidence) + per-module Pass 1 agents (0.95 intra-module, 0.30 graph-inferred) + three-persona Pass 2 + mandatory holistic adversarial Pass 3. Taint tracer caps at 50 agents per run; chains >5 modules truncate to entry+sink+3 hops.

Cross-module findings never silently dropped — <0.50 confidence surfaces as Candidates.

## Deduplication

Two dedup passes:
1. **Fingerprint dedup** — primary, by FP-hash
2. **Sink-location dedup** (`deduplicateBySinkLocation`) — secondary, keyed on `(file:line:checker)`. Required because tracer confirmed findings use entry-side fingerprints while intra-module Pass 1 uses sink-side — same defect gets two different fingerprints. Merge: keep higher confidence, union callers, prefer dataFlow with confirmed steps.

`_source: 'tracer'` tag on tracer findings enables collision-anchoring on the Pass 1 (sink-side) fingerprint for ledger continuity. Confidence uses `Math.max`.

## Adversarial Pass 3 — Unified Skip Logic

Single skip check for all modes: skip if scoped modules have no security-critical contact (direct or graph-neighbor). PR mode adds ICEA keyword check + conservative fallbacks (no ICEA = run). Unconfigured codebase always runs. `--force-pass3` overrides.

## Phase Checkpoints

Orchestrator writes checkpoint JSON after each phase (`.code-review/checkpoint-{phase}.json`) and rewrites partial.html. `--continue` resumes from last completed phase.

## Orchestrator Decoupling

All prompts, schema, dedup, report logic in `shared/` modules. Workflow (Claude Code interactive) and LangGraph (CI/CD headless, future) are thin runners importing the same logic. `CODE_REVIEW_ORCHESTRATOR=workflow|langgraph` env var.

## Terminology

"Coverity-style" replaced with "SAST" — correct industry-standard term, not proprietary.

## Approaches Abandoned

- **Area-scoped single-agent:** cannot solve vulnerability coverage — exhausts context, misses cross-module taints. DO NOT revisit.
- **LLM progress markers:** relies on LLM to track state (counters, timing) — fails 70-80% of the time. Root fix is file-count guard + area-scoped accumulation.

## Key Findings from Critic Rounds

- Round 4 (8 issues): failed suspects -> Candidates at 0.30, dedup by sink, --changed mode file diff, caps (50 items), RETIRED_CHECKERS, HAIKU_MODEL literal fix, checkpoint COMPLETED marker
- Round 5-6 (11 issues): merge-base diff, tracer _source tag, mtime comparison, contentHash cache-buster
