# Feature Plan — ADO #9004 · knowledge-freshness

ADO #9004 · Release 1 · Sprint 1 · Status: PLAN SAVED
Type (intended): EPIC — 2 stories (final sizing confirmed at Tech Spec)

> ORIENTATION: shared / scripts (domain: plugin-internal tooling) — a new plugin capability that
> validates + refreshes the offline migration-knowledge tier under
> `skills/shared/migration-knowledge/refs/`; adds one shared classifier lib + one deterministic
> `.cjs` validator (scripts module) + one new skill (`knowledge-freshness`), a sibling to the
> retired migration family's substrate. Graph was stale at planning time; `dream-init-state.json`
> reads `python` (the target-app default) — this feature is plugin-internal, so the Tech Spec is
> **base-only** (no app-stack overlay).

---

## Problem Statement

The migration family (Upgrade · Rewrite · Replatform) falls back to an offline knowledge tier at
`skills/shared/migration-knowledge/refs/` — 20 version-sensitive refs tagged INFERRED. They go
stale silently: .NET 8 → 9/10, Angular 17 → 18/19, Spring Boot 3.x moves. Story 3 (ADO-9000)
shipped `freshness-manifest.json` (version anchors + `last_verified` + TTL) as validator-READY
metadata but NOT the validator. Today nothing tells a developer a ref is stale, and nothing
refreshes it. Cost of not solving: the migration skills quietly hand out year-old framework facts
as if current.

## Story

As a plugin maintainer, I want to detect which offline knowledge refs are stale (by age or by
version) and refresh the stale ones with web-grounded facts under the Write Gate, so that the
migration family's offline tier stays trustworthy instead of decaying invisibly.

## Personas (end-users of the feature)

- **Plugin maintainer (Vivek)** — owns the migration-knowledge tier · goal: keep refs current with
  minimal manual diffing · frustration: no signal for staleness, manual web-checking 20 files ·
  success: one command flags stale refs; a guided, gated refresh updates them + re-stamps.

## Feature Priority (MoSCoW)

**Must Have:**
- Deterministic `scripts/knowledge-freshness.cjs check` — reads the manifest + an LLM-supplied
  `--latest` versions input (NO network in the script), classifies each ref
  FRESH / STALE-BY-AGE / STALE-BY-VERSION / UNKNOWN; exit codes as contract; `--now` date seam.
- Self-contained `tests/knowledge-freshness.test.cjs` (spawnSync, prints "N passed · M failed").
- `knowledge-freshness` SKILL.md `check` path — runs the script, renders the staleness table.
- Extract `classifySource` (+ `confidenceFor`) to `scripts/lib/source-classifier.cjs`; repoint
  `upgrade-knowledge-cache.cjs` to require it, keeping `upgrade-knowledge-cache.test.cjs` green.

**Should Have:**
- Skill `refresh` path — for STALE refs: LLM web-grounds current facts (WebSearch) → shows a
  unified diff of the ref → higher-tier inline LLM-as-judge → Write Gate → updates the ref, bumps
  `last_verified`, re-tags VERIFIED/INFERRED via the extracted classifier.

**Could Have:**
- Wire `check` into the plugin CI substrate (`azure-pipelines.yml`) as a non-blocking staleness report.

**Won't Have (this ADO):**
- The script making network calls (breaks the no-network convention — the LLM feeds facts in).
- Auto-refresh without a human Write-Gate approval (never — refs are committed content).
- Freshening evergreen methodology (`specs/*`, `clean-architecture`, `strategies/README`) — the
  manifest deliberately excludes those; not version-tracked.
- Version-tracking the migration `source` field (only `versions`/`target` anchors decay in v1).

## Release Plan

- **MVP (Story 1 — Detector):** one command tells the maintainer exactly which of the 20 refs are
  stale and why. Deferred: refresh, CI wiring.
- **V1 (Story 2 — Refresh):** guided, judge-verified, Write-Gated update of a stale ref +
  re-stamp + re-tag. Deferred: CI wiring.

**Type: EPIC (~9–11 SP)** — final sizing confirmed at Tech Spec.

| Story | Logical scope (shippable slice) | ~SP | Shippable alone? | Depends on |
|---|---|---|---|---|
| 1 — Detector | Extract `classifySource` → `scripts/lib/source-classifier.cjs` (+ repoint upgrade-cache, keep its tests green) · `knowledge-freshness.cjs check` + self-contained test · skill `check` path (render staleness table) · register skill+command in `plugin.json` + command stub | 5–6 | Yes — "one command tells you what's stale" | None |
| 2 — Refresh | Skill `refresh` path: WebSearch grounding → unified diff of the ref → higher-tier inline judge → Write Gate → update ref + bump `last_verified` + re-tag VERIFIED/INFERRED via the extracted classifier. Could-have: non-blocking CI staleness report. | 4–5 | Yes — refresh a flagged ref | Story 1 live (needs detector + extracted classifier) |

## Assumptions

- [1] The script stays no-network; "latest versions" arrive via an LLM-supplied `--latest` JSON
  file/arg, mirroring `upgrade-knowledge-cache.cjs`. — **verified** (matches shipped convention)
- [2] `classifySource`/`confidenceFor` are cleanly extractable — they are already pure and in
  `module.exports`. — **verified**
- [3] Plugin-internal feature → Tech Spec is base-only (no app-stack overlay). — **verified**

## Risks

- [1] Two ref shapes (`versions` vs `source`/`target`) → version compare is string-fuzzy — P:H I:M
  (mitigated: normalized string equality on a single anchor per ref shape; `UNKNOWN` when unfed)
- [2] `refresh` mutates committed ref content; a bad web-ground could degrade a ref — P:M I:H
  (mitigated: higher-tier inline judge + unified diff + Write Gate + git history)
- [3] Extract touches shipped code — P:L I:M (mitigated: `upgrade-knowledge-cache.test.cjs` must
  stay green; extract is a pure move, no behaviour change)

## Pre-mortem: "This shipped and failed. What went wrong?"

`refresh` over-trusted a non-authoritative web source, rewrote a `stacks/` ref with wrong version
facts, re-tagged it VERIFIED, and a later migration consumed it as current. Guardrails: reuse the
skeptical `classifySource` allowlist (unknown host ⇒ INFERRED, never VERIFIED), require a
higher-tier inline judge pass + a human Write-Gate diff-approval before any ref write, never
auto-run `refresh`.

## Dependencies

- [1] `skills/shared/migration-knowledge/freshness-manifest.json` — Owner: shipped (ADO-9000) | Blocking: no
- [2] `scripts/upgrade-knowledge-cache.cjs` (`classifySource` extraction source) — Owner: shipped | Blocking: no

## Open Questions

_All resolved during planning:_
- [1] `classifySource` → **EXTRACT** to `scripts/lib/source-classifier.cjs`; both scripts require it.
  Constraint: `upgrade-knowledge-cache.test.cjs` stays green. ✅
- [2] `check` is no-network: age axis is pure offline math; version axis compares against an
  LLM-supplied `--latest` JSON. Script never fetches. ✅
- [3] Anchor = `versions` (stacks/strategies) / `target` (mappings/shared); normalized string
  equality, differs ⇒ STALE-BY-VERSION; absent from `--latest` ⇒ UNKNOWN. ✅
- [4] **EPIC** — 2 stories (detector, then refresh). ✅
- [5] `refresh` gated by a higher-tier inline LLM-as-judge (`CRITIC_MODEL`/`REVIEW_MODEL`), not the
  full critic skill. ✅

## Design detail carried into ICEA/Tech Spec

**No-network split (Q2):** the `.cjs` does comparison logic only (pure fn + file IO, deterministic,
unit-testable). Two staleness axes:
- STALE-BY-AGE — needs no network ever: `last_verified + TTL(180d) < --now`.
- STALE-BY-VERSION — script compares manifest anchor vs an LLM-supplied `--latest` value; `--latest`
  omitted ⇒ `UNKNOWN (no --latest supplied)`, never guessed.

**Version-compare (Q3) — DECISIONs for the script:**
- Staleness anchor per ref shape: `versions` (stacks/strategies) + `target` (mappings/shared), one
  anchor per ref. `source` is intentionally old — not tracked (avoids false positives).
- Compare granularity: normalized-string equality (lowercase, trim, collapse whitespace); differs ⇒
  STALE-BY-VERSION. NOT semver numeric `<` (anchors are freeform/ranges: ".NET Framework 4.8",
  "Node 20 / Express 4-5", "React 18-19"). The script decides differs/matches/unknown only — a
  human/judge decides whether a difference is a real bump.
- `--latest` keyed by exact ref `path` → current anchor string, 1:1 with the manifest.
