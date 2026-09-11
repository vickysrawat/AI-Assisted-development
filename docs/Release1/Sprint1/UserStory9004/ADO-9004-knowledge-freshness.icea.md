# ICEA — knowledge-freshness
ADO #9004 · Release 1 · Sprint 1
Status: COMPLETE · EPIC · ~10 SP

---

## Intent

### Goal
Give the plugin maintainer a way to see which offline migration-knowledge refs have gone stale
(by age or by version) and to refresh the stale ones with web-grounded facts under the Write Gate.

### Problem Statement
The migration family (Upgrade · Rewrite · Replatform) falls back to an offline knowledge tier at
`skills/shared/migration-knowledge/refs/` — 20 version-sensitive refs tagged INFERRED. These decay
silently as frameworks move (.NET 8 → 9/10, Angular 17 → 18/19, Spring Boot 3.x). ADO-9000 shipped
`freshness-manifest.json` (per-ref version anchors + `last_verified` + a 180-day TTL) as
validator-ready metadata, but no validator consumes it. Success is measurable: a maintainer can run
one command and get, for all 20 refs, a deterministic FRESH / STALE-BY-AGE / STALE-BY-VERSION /
UNKNOWN classification, and can update any stale ref through a guided, gated refresh that re-stamps
`last_verified` and re-tags source authority.

### Business Impact
Prevents the migration skills from silently emitting year-old framework facts as if current —
protecting the credibility of every Upgrade/Rewrite/Replatform run that falls back to the offline
tier. No revenue/PII exposure (plugin-internal tooling); the cost avoided is wrong-guidance rework.

### Story
As a plugin maintainer, I want to detect which offline knowledge refs are stale and refresh the
stale ones with web-grounded facts under the Write Gate, so that the migration family's offline
tier stays trustworthy instead of decaying invisibly.

### Success Metrics
- `knowledge-freshness.cjs check` classifies all 20 manifest refs in one run, deterministically
  (same inputs + `--now` ⇒ same output), with zero network calls from the script.
- Age-staleness is reported with no `--latest` input at all (pure offline math).
- A stale ref can be refreshed end-to-end: web-ground → diff → judge → Write Gate → ref updated,
  `last_verified` bumped, authority re-tagged VERIFIED/INFERRED.
- `upgrade-knowledge-cache.test.cjs` stays green after `classifySource` is extracted.

---

## Context

### Personas
**Plugin maintainer (Vivek):** owns the migration-knowledge tier · runs the plugin repo, not a
target app · goal: keep the 20 offline refs current with minimal manual diffing · frustration: no
signal today for staleness, would have to web-check 20 files by hand · success measure: one command
flags what's stale and why; a guided, gated refresh updates a ref and re-stamps it.

### System Context
| Layer | Component / File | Change Type | Notes |
|---|---|---|---|
| Script (shared lib) | `scripts/lib/source-classifier.cjs` | new | Extracted `classifySource` + `confidenceFor` (pure, no IO) — single source of truth for source-authority tagging |
| Script | `scripts/upgrade-knowledge-cache.cjs` | modify | Repoint to `require('./lib/source-classifier.cjs')`; delete the in-file copies. No behaviour change |
| Script | `scripts/knowledge-freshness.cjs` | new | `check` (Story 1) reads manifest + `--latest`; classifies each ref; `--now` seam; exit-codes-as-contract; no network |
| Test | `tests/knowledge-freshness.test.cjs` | new | Self-contained `spawnSync`, prints "N passed · M failed" |
| Test | `tests/upgrade-knowledge-cache.test.cjs` | verify | Must stay green after the extract (regression guard) |
| Skill | `skills/knowledge-freshness/SKILL.md` | new | `check` path (Story 1) renders the staleness table; `refresh` path (Story 2) web-grounds → diff → inline judge → Write Gate → update ref + re-stamp + re-tag |
| Data | `skills/shared/migration-knowledge/freshness-manifest.json` | read (check) / modify (refresh) | `check` reads it; `refresh` bumps `last_verified` on the refreshed ref |
| Data | `skills/shared/migration-knowledge/refs/*.md` | modify (refresh only) | The stale ref content updated on Write-Gate approval |
| Config | `.claude-plugin/plugin.json` + `commands/knowledge-freshness.md` | new/modify | Register skill + command (Story 1) |
| Test | `tests/validate.js` | modify | Assert the new skill/command/script are registered + structurally conformant |

### Constraint Context
| Constraint | Type | Bounds the solution how? |
|---|---|---|
| Script performs NO network I/O | technical | The web-grounding is done by the LLM (WebSearch) and fed in via `--latest`; the `.cjs` only compares. Keeps it deterministic + unit-testable |
| Repo script convention | technical | 5-point SCRIPT REVIEW header, `'use strict'`, `arg()` helper, `module.exports` + `require.main` CLI guard, exit-codes-as-contract, `// DECISION:` comments; self-contained `.test.cjs` |
| Write Gate | technical/process | Any write to a `refs/*.md` or the manifest requires `APPROVE ADO-9004`; refresh never auto-writes |
| Source-authority tagging is skeptical | technical | Re-use the existing allowlist: unknown host ⇒ INFERRED, never VERIFIED (no over-trust) |
| Plugin-internal, base-only Tech Spec | technical | No app-stack overlay applies (detected stack `python` is the target-app default, not this tooling) |

### Change Tier
**T2** — a standard multi-file feature that adds a script + skill and modifies one shipped script
via a pure extract. Blast radius is bounded to plugin tooling; the extract is the only touch to
existing behaviour and is regression-guarded by an existing test.

---

## Examples

> All scenarios use Given/When/Then table format.

### Happy Path
| Given | When | Then (observable outcome) |
|---|---|---|
| The manifest with 20 refs, all `last_verified` within 180 days | `check --now=<within TTL>` run with no `--latest` | Every ref reports FRESH (age) / version UNKNOWN; exit code = all-fresh contract value |
| A `--latest` JSON where `refs/stacks/dotnet.md` = ".NET 10" while manifest anchor = ".NET 8" | `check --latest=latest.json --now=<within TTL>` | That ref reports STALE-BY-VERSION; others FRESH/UNKNOWN; exit code = some-stale contract value |
| A ref flagged STALE and web-grounded from `learn.microsoft.com` | maintainer runs `refresh` for it and `APPROVE ADO-9004` after the diff | Ref content updated, `last_verified` bumped to today, re-tagged VERIFIED |

### Edge Cases
| Given | When | Then (expected behaviour) |
|---|---|---|
| A ref whose `last_verified` is exactly TTL days before `--now` | `check` | Boundary is defined and tested (age > TTL ⇒ stale; age == TTL ⇒ still fresh) — deterministic, documented |
| A `--latest` value phrased differently but equal after normalization (".NET 8" vs " .net  8 ") | `check` | Reports FRESH (normalized equality: lowercase/trim/collapse-whitespace) — not a false STALE |
| A mappings ref (has `source`/`target`, no `versions`) | `check` with `--latest` for its path | Compares against the `target` anchor only; `source` is not version-checked |

### Error States
| Given | When | Then (user-visible message + system behaviour) |
|---|---|---|
| `--latest` points to a missing or malformed JSON file | `check` | Exits with a usage/error message naming the bad path; exit code = error; no partial/garbage table |
| The manifest file is missing or corrupt | `check` | Clear error ("cannot read/parse freshness-manifest.json at <path>"); non-zero exit; no crash stack dump as the primary output |
| A web-ground during `refresh` returns from a non-authoritative host | `refresh` | The change is tagged INFERRED (never VERIFIED); the inline judge sees the low authority; maintainer is shown the tag before the Write Gate |

### Permission Boundary (mandatory)
| Given | When | Then (observable outcome) |
|---|---|---|
| `refresh` has produced a ref change but the maintainer has NOT sent `APPROVE ADO-9004` | refresh attempts to persist the ref/manifest change | Write is blocked by the Write Gate; no `refs/*.md` or manifest byte changes; the pending-write prompt is shown |
| Any invocation of `check` | `check` runs | Read-only — it cannot write any ref or the manifest under any code path (no write API in the detector) |

---

## Acceptance

### Acceptance Criteria

**Story 1 — Detector**
- [ ] AC-F1: `scripts/knowledge-freshness.cjs check` reads `freshness-manifest.json` and (optionally) a `--latest` JSON and classifies EVERY ref as exactly one of FRESH / STALE-BY-AGE / STALE-BY-VERSION / UNKNOWN.
- [ ] AC-F2: STALE-BY-AGE is computed only from `last_verified` + TTL vs `--now`, requiring no `--latest`; `--now` seams the date for determinism (default = system date).
- [ ] AC-F3: STALE-BY-VERSION is computed by normalized-string comparison (lowercase, trim, collapse whitespace) of the manifest anchor — `versions` for stacks/strategies, `target` for mappings/shared — against the `--latest` value keyed by exact ref `path`; a ref absent from `--latest` is UNKNOWN, never FRESH.
- [ ] AC-F4: The script performs no network I/O, and its exit codes are a documented contract (all-fresh vs some-stale vs usage/error), asserted by the test.
- [ ] AC-F5: `classifySource` + `confidenceFor` are extracted to `scripts/lib/source-classifier.cjs`; `upgrade-knowledge-cache.cjs` requires it with no behaviour change; `tests/upgrade-knowledge-cache.test.cjs` stays green.
- [ ] AC-F6: `skills/knowledge-freshness/SKILL.md` `check` path runs the script and renders a per-ref staleness table; the skill + command are registered in `.claude-plugin/plugin.json` with a `commands/knowledge-freshness.md` stub.

**Story 2 — Refresh**
- [ ] AC-F7: The skill `refresh` path, for a ref flagged STALE, web-grounds current facts (WebSearch) and presents a unified diff (changed lines + 3 lines context) of the proposed ref change.
- [ ] AC-F8: A higher-tier inline LLM-as-judge (`CRITIC_MODEL`/`REVIEW_MODEL`) evaluates the grounded change before the Write Gate; on a fail verdict, refresh does not present a write.
- [ ] AC-F9: On `APPROVE ADO-9004`, refresh updates the ref, bumps `last_verified` to today in the manifest, and re-tags the ref's source authority VERIFIED/INFERRED via `source-classifier.cjs`.
- [ ] AC-F10: refresh never runs automatically and never writes any ref or manifest byte without an explicit `APPROVE ADO-9004`.

**Non-functional**
- [ ] AC-NF1: `knowledge-freshness.cjs` is deterministic and dependency-free; `tests/knowledge-freshness.test.cjs` runs under `node` with no external packages and prints "N passed · M failed". Verification: run the test; expect 0 failed.
- [ ] AC-NF2: `knowledge-freshness.cjs` and `source-classifier.cjs` carry the 5-point SCRIPT REVIEW header, `'use strict'`, `module.exports` + `require.main` guard, and `// DECISION:` comments for the anchor-selection and compare-granularity choices. Verification: `tests/validate.js` + inspection.
- [ ] AC-NF3: Version staleness is never fabricated — the detector reports UNKNOWN (not FRESH) for any ref with no `--latest` entry. Verification: unit test with a partial `--latest`.

### Out of Scope
- We will NOT let the `.cjs` make network calls — because that would make it non-deterministic and un-unit-testable; the LLM does web-grounding and feeds `--latest` in.
- We will NOT auto-refresh or write any ref without `APPROVE ADO-9004` — because refs are committed content and a bad web-ground could silently degrade guidance.
- We will NOT freshen evergreen methodology refs (`specs/*`, `clean-architecture`, `fullstack-integration`, `strategies/README`) — because the manifest deliberately excludes them; they are not version-tracked.
- We will NOT version-track the migration `source` field in v1 — because a migration source is intentionally an older version and would produce false STALE positives.

### Assumptions
- The script stays no-network; latest versions arrive via an LLM-supplied `--latest` JSON, mirroring `upgrade-knowledge-cache.cjs`. — **verified**
- `classifySource`/`confidenceFor` are cleanly extractable (already pure + exported). — **verified**
- Plugin-internal feature ⇒ base-only Tech Spec (no app-stack overlay). — **verified**

### Open Questions
| # | Question (product / stakeholder) | Owner | Status |
|---|---|---|---|
| — | None — all planning questions resolved before SAVE PLAN | — | — |

### Risks & Pre-Mortem
| Risk | Probability | Impact |
|---|---|---|
| Two ref shapes (`versions` vs `source`/`target`) make version compare fuzzy | H | M |
| `refresh` mutates committed ref content; a bad web-ground degrades a ref | M | H |
| Extract touches shipped code and breaks `upgrade-knowledge-cache` | L | M |

**Pre-mortem:** "This shipped and failed. What went wrong?"
`refresh` over-trusted a non-authoritative web source, rewrote a `stacks/` ref with wrong version
facts, re-tagged it VERIFIED, and a later migration consumed it as current. Guardrails: the skeptical
`classifySource` allowlist (unknown host ⇒ INFERRED, never VERIFIED), a higher-tier inline judge pass,
and a human Write-Gate diff-approval before any ref write; refresh is never automatic.

### Dependencies
- Blocked by: none (both inputs shipped in ADO-9000)
- Blocks: Story 2 (Refresh) is blocked by Story 1 (Detector) being live

### Irreversibility Flags
`refresh` overwrites committed ref content and the manifest — reversible via git history, but flagged
for explicit Write-Gate review (diff shown before every write). No other irreversible actions.

### D-Blocks
None — the architectural forks (extract-vs-require, anchor selection, compare granularity, no-network
split, EPIC split, judge choice) were all decided during planning and are recorded as DECISIONs in the
plan / System Context, not left open.

---

## Story Breakdown

**Type:** EPIC
**Total SP:** ~9–11 (confirmed at Tech Spec)

| Story | Child ADO # | Logical scope | SP | Shippable alone? | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | ADO-9005 | Detector — extract classifier + `knowledge-freshness.cjs check` + test + skill `check` path + registration | 5–6 | Yes — "one command tells you what's stale" | None | ✅ Done | 
| 2 | ADO-9006 | Refresh — web-ground → diff → higher-tier inline judge → Write Gate → update ref + bump `last_verified` + re-tag | 4–5 | Yes — refresh a flagged ref | Story 1 live | ✅ Done |

---

## Sign-Off
| Role | Name | Date | Status |
|---|---|---|---|
| Product | | | ⬜ Pending |
| Tech Lead | | | ⬜ Pending |

---
### Revision Log
2026-09-09 — ICEA drafted from approved plan (SAVE PLAN ADO-9004).
2026-09-10 — Approved
