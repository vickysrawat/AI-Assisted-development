# Tech Spec — knowledge-freshness · Story 1 (Detector)
ADO #9004 · Release 1 · Sprint 1
Status: DRAFT

---

## Overview

Story 1 delivers the staleness **detector**: it extracts the source-authority classifier out of
`upgrade-knowledge-cache.cjs` into a shared lib (`scripts/lib/source-classifier.cjs`), adds a
deterministic, no-network validator (`scripts/knowledge-freshness.cjs check`) that classifies every
`freshness-manifest.json` ref as FRESH / STALE-BY-AGE / STALE-BY-VERSION / UNKNOWN, and surfaces it
through a new `knowledge-freshness` skill's `check` path. Governing pattern: comparison logic is a
pure, unit-tested CJS function reading local JSON only; the network (learning "what's current") is
the LLM's job and enters solely via an `--latest` JSON. Shippable alone — "one command tells you
what's stale."

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F1 | Classify every ref FRESH/STALE-BY-AGE/STALE-BY-VERSION/UNKNOWN | `scripts/knowledge-freshness.cjs` | ✅ Covered |
| AC-F2 | STALE-BY-AGE from last_verified+TTL vs `--now`, no `--latest` needed | `scripts/knowledge-freshness.cjs` | ✅ Covered |
| AC-F3 | STALE-BY-VERSION via normalized-string compare of anchor vs `--latest`; absent ⇒ UNKNOWN | `scripts/knowledge-freshness.cjs` | ✅ Covered |
| AC-F4 | No network I/O; exit codes are a documented contract | `scripts/knowledge-freshness.cjs`, `tests/knowledge-freshness.test.cjs` | ✅ Covered |
| AC-F5 | Extract classifySource/confidenceFor to shared lib; upgrade-cache requires it; its test stays green | `scripts/lib/source-classifier.cjs`, `scripts/upgrade-knowledge-cache.cjs`, `tests/upgrade-knowledge-cache.test.cjs` | ✅ Covered |
| AC-F6 | Skill `check` path renders the table; skill+command registered | `skills/knowledge-freshness/SKILL.md`, `commands/knowledge-freshness.md`, `.claude-plugin/plugin.json`, `tests/validate.js` | ✅ Covered |
| AC-NF1 | Deterministic, dependency-free; self-contained test prints "N passed · M failed" | `scripts/knowledge-freshness.cjs`, `tests/knowledge-freshness.test.cjs` | ✅ Covered |
| AC-NF2 | Script convention: 5-point header, 'use strict', exports+CLI guard, DECISION comments | `scripts/knowledge-freshness.cjs`, `scripts/lib/source-classifier.cjs`, `tests/validate.js` | ✅ Covered |
| AC-NF3 | Version staleness never fabricated — UNKNOWN not FRESH when unfed | `scripts/knowledge-freshness.cjs`, `tests/knowledge-freshness.test.cjs` | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `scripts/lib/source-classifier.cjs` (new) | AC-F5, AC-NF2 |
| `scripts/upgrade-knowledge-cache.cjs` (modify) | AC-F5 |
| `scripts/knowledge-freshness.cjs` (new) | AC-F1, AC-F2, AC-F3, AC-F4, AC-NF1, AC-NF2, AC-NF3 |
| `tests/knowledge-freshness.test.cjs` (new) | AC-F1, AC-F2, AC-F3, AC-F4, AC-NF1, AC-NF3 |
| `tests/upgrade-knowledge-cache.test.cjs` (verify green) | AC-F5 |
| `skills/knowledge-freshness/SKILL.md` (new) | AC-F6 |
| `commands/knowledge-freshness.md` (new) | AC-F6 |
| `.claude-plugin/plugin.json` (modify) | AC-F6 |
| `tests/validate.js` (modify) | AC-F6, AC-NF2 |
| `tests/fixtures/knowledge-freshness/*` (new) | AC-F1, AC-F2, AC-F3, AC-NF3 |

**Coverage result:** all 9 ACs covered, no orphaned file changes ✅

---

## Files Changed

> Node CJS tooling (base-only — no app framework). CLI scripts + one skill + registration.

| File | Change | Detail |
|---|---|---|
| `scripts/lib/source-classifier.cjs` | new | Pure module: `classifySource(stack, source)`, `confidenceFor(tier, provided)`, `hostOf(url)`, `AUTHORITATIVE` allowlist — moved verbatim from `upgrade-knowledge-cache.cjs`. `module.exports` all three. 5-point header, `'use strict'`. No IO. |
| `scripts/upgrade-knowledge-cache.cjs` | modify | Delete the in-file `AUTHORITATIVE`/`hostOf`/`classifySource`/`confidenceFor` copies; `const { classifySource, confidenceFor } = require('./lib/source-classifier.cjs');`. Keep `factId` local. Re-export from the lib so existing `module.exports` shape is preserved. No behaviour change. |
| `scripts/knowledge-freshness.cjs` | new | `check` op. `arg()` helper; reads `--manifest` (default `skills/shared/migration-knowledge/freshness-manifest.json`), optional `--latest=<path>`, `--now` (default system date), `--json`. Pure `classifyRef(ref, latestVal, nowIso, ttlDays)` → one of FRESH/STALE-BY-AGE/STALE-BY-VERSION/UNKNOWN. `module.exports = { classifyRef, normalizeVersion, anchorOf }` + `require.main` CLI guard. No network. |
| `tests/knowledge-freshness.test.cjs` | new | Self-contained `spawnSync` + direct `require` of pure fns; fixture manifests + `--latest`; prints "N passed · M failed"; 0xC0000005 retry-once. |
| `skills/knowledge-freshness/SKILL.md` | new | `check` path only in Story 1 (`refresh` stub notes "Story 2"). Reads plugin-path, runs the script, renders the staleness table; Category C (reads local knowledge files only). Model routing note. |
| `commands/knowledge-freshness.md` | new | Command stub loading the skill (mirrors existing command stubs). |
| `.claude-plugin/plugin.json` | modify | Register skill `knowledge-freshness` + command; bump plugin version (patch). |
| `tests/validate.js` | modify | Assert: skill+command registered; both new scripts carry SCRIPT REVIEW header + `require.main` guard; `source-classifier.cjs` exports the 3 fns; `upgrade-knowledge-cache.cjs` no longer defines its own `classifySource`. |
| `tests/fixtures/knowledge-freshness/` | new | `manifest-fresh.json`, `manifest-aged.json`, `latest-*.json` fixtures for deterministic tests. |

---

## Implementation Notes (CJS — base-only)

**`knowledge-freshness.cjs check` — classification logic (pure, per ref):**

```
anchorOf(ref)      = ref.versions ?? ref.target ?? null          // stacks/strategies use versions; mappings/shared use target
normalizeVersion(s)= s.toLowerCase().trim().replace(/\s+/g,' ')  // coarse, forgiving compare
age                = daysBetween(ref.last_verified, now)
ttl                = manifest.default_ttl_days (180)

classifyRef:
  if age > ttl                                   → STALE-BY-AGE      (no --latest needed)
  else if latest has no entry for ref.path       → UNKNOWN (version) but FRESH (age)  → report UNKNOWN
  else if normalize(anchor) !== normalize(latest)→ STALE-BY-VERSION
  else                                           → FRESH
```

> A ref can be STALE-BY-AGE regardless of `--latest`. Version status is only computed when age is
> within TTL and a `--latest` entry exists; missing entry ⇒ UNKNOWN (never silently FRESH — AC-NF3).

**Exit-code contract (AC-F4) — mirrors `upgrade-knowledge-cache.cjs`'s style:**

| Op | Exit | Meaning |
|---|---|---|
| check | 0 | No ref STALE (all FRESH/UNKNOWN) |
| check | 9 | ≥1 ref STALE-BY-AGE or STALE-BY-VERSION |
| check | 1 | Usage error / missing or corrupt manifest / bad `--latest` JSON |

> UNKNOWN does not trigger exit 9 (unknown ≠ stale). The table is asserted by the test.

---

## API Changes

None — no HTTP API. The public surface is the CLI (`check`) + the exported pure functions
(`classifyRef`, `normalizeVersion`, `anchorOf`) for unit testing.

---

## Auth & Security

N/A at runtime (no endpoint). `check` is strictly read-only — it has no write code path and cannot
mutate any ref or the manifest. No secrets handled.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `--latest` file missing/malformed JSON | stderr "cannot read/parse --latest at <path>"; exit 1; no partial table |
| Manifest missing/corrupt | stderr "cannot read/parse freshness-manifest.json at <path>"; exit 1 |
| Ref has neither `versions` nor `target` | `anchorOf` returns null ⇒ version axis UNKNOWN for that ref (age axis still evaluated) |
| `--latest` value phrased differently but equal after normalize | FRESH (no false STALE) |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F5 | Extract classifier → shared lib + repoint upgrade-cache + keep test green | 2 |
| AC-F1–F4, NF1, NF3 | `knowledge-freshness.cjs check` + self-contained test + fixtures | 3 |
| AC-F6, NF2 | Skill `check` path + command stub + plugin.json + validate.js | 1 |
| **Total** | | **6** |

**Total SP: 6**
**Type: STORY** — this is Story 1 of EPIC ADO-9004; a shippable ≤6 SP slice (the detector).

---

## Definition of Done

**Implementation**
- [ ] All files changed as specified in Files Changed section
- [ ] No hardcoded secrets, connection strings, or credentials
- [ ] No `console.log`/diagnostic output in production paths (script prints its report via stdout by design)
- [ ] Both new scripts carry the 5-point SCRIPT REVIEW header + `// DECISION:` blocks (anchor selection, compare granularity)

**Quality**
- [ ] `node tests/knowledge-freshness.test.cjs` → "N passed · 0 failed"
- [ ] `node tests/upgrade-knowledge-cache.test.cjs` → still 9 passed · 0 failed (regression)
- [ ] `node tests/validate.js` → all structural checks pass
- [ ] Regression verified: `upgrade-knowledge-cache.cjs` behaviour unchanged after the extract

**Review readiness**
- [ ] PR title: `[ADO-9004] knowledge-freshness Story 1 — staleness detector`
- [ ] PR maps each changed file to its ACs (AC Coverage Matrix)
- [ ] ICEA committed in the same branch

### Reviewer Checklist
- [ ] `classifySource` MOVED (not duplicated) — no second copy in `upgrade-knowledge-cache.cjs`
- [ ] `knowledge-freshness.cjs` imports no `http`/`https`/`fetch`/`net` — zero network
- [ ] Exit-code table matches the implementation and is asserted by a test
- [ ] UNKNOWN is reported (not FRESH) for a ref absent from `--latest`

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None | — | — | — |

---

## Request Flow

```
node knowledge-freshness.cjs check --latest=latest.json --now=2026-09-10
  → load manifest (local read)      [error → exit 1]
  → load --latest if given          [error → exit 1]
  → for each ref: classifyRef(...)  [pure]
  → print table (FRESH/STALE-BY-AGE/STALE-BY-VERSION/UNKNOWN per ref)
  → exit 9 if any STALE else 0
skill `check`:
  → (optional) WebSearch → latest.json → run script → render table to the maintainer
```

---

## Rollback

Purely additive except the two-line-ish edit to `upgrade-knowledge-cache.cjs`. Revert the branch
commits; the upgrade-cache reverts to its in-file classifier copy. No data migration.

---

## Handover

### QA Team
Run the three test commands above. Create test data by copying `freshness-manifest.json` into
`tests/fixtures/knowledge-freshness/` and editing `last_verified`/anchors to force each state; pair
with a `latest-*.json`. Regression risk is confined to the classifier extract (guarded by
`upgrade-knowledge-cache.test.cjs`).

### DevOps / Platform Team
No env vars, no secrets, no pipeline changes required. Scripts run under plain `node`. (CI wiring is
a Story-2 Could-have, not this story.)

### Future Developer — Follow-on Work
`refresh` (Story 2) will `require('./lib/source-classifier.cjs')` for re-tagging and add a `restamp`
op to `knowledge-freshness.cjs`. New refs added to the manifest are auto-picked-up by `check`.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `classifyRef` | ref last_verified within TTL, no `--latest` entry | UNKNOWN (age FRESH) | AC-F2, AC-NF3 |
| P-U2 | `classifyRef` | anchor ".NET 8", latest ".NET 8" (diff whitespace/case) | FRESH | AC-F3 |
| P-U3 | `classifyRef` | last_verified 200 days before `--now`, TTL 180 | STALE-BY-AGE | AC-F2 |
| P-U4 | `classifyRef` | mappings ref target ".NET 8", latest ".NET 10" | STALE-BY-VERSION (uses target anchor) | AC-F1, AC-F3 |
| P-U5 | check CLI | fixture manifest all fresh, no `--latest` | exit 0, table all FRESH/UNKNOWN | AC-F1, AC-F4 |
| P-U6 | `source-classifier.classifySource` | dotnet + learn.microsoft.com URL | tier VERIFIED | AC-F5 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | check CLI | manifest with one aged ref | exit 9 (some-stale) | AC-F4 |
| N-U2 | check CLI | `--latest` path does not exist | exit 1 + stderr names the path | AC-F4 |
| N-U3 | check CLI | corrupt manifest JSON | exit 1 + parse error message | AC-F4 |
| N-U4 | `classifyRef` | ref present but absent from `--latest` | UNKNOWN, NOT FRESH | AC-NF3 |
| N-U5 | `source-classifier.classifySource` | dotnet + random-blog.example URL | tier INFERRED (unknown host) | AC-F5 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Detector against the real manifest | `node scripts/knowledge-freshness.cjs check --now=<today>` (no `--latest`) | All 20 refs classified; version col UNKNOWN; exit 0 (none age-stale today) | AC-F1, AC-F2 |
| INT-2 | Skill `check` render | run the skill's check path | Staleness table rendered from script output | AC-F6 |
| INT-3 | Registration | `node tests/validate.js` | Skill+command present; scripts conform | AC-F6, AC-NF2 |

> NF AC verification:
> AC-NF1 (deterministic, dependency-free): verified by running `tests/knowledge-freshness.test.cjs`
> under plain `node` (no `npm install`) and confirming "0 failed" + identical output across runs
> with a fixed `--now`.
> AC-NF2 (script convention): verified by `tests/validate.js` structural assertions + inspection.
> AC-NF3 (no fabrication): verified by N-U4 / P-U1.

---

### Revision Log
2026-09-10 — Story 1 (Detector) tech spec drafted (base-only).
