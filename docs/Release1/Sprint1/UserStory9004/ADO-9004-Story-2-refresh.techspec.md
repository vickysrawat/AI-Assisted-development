# Tech Spec — knowledge-freshness · Story 2 (Refresh)
ADO #9004 · Release 1 · Sprint 1
Status: DRAFT

---

## Overview

Story 2 delivers the **refresh** path of the `knowledge-freshness` skill: for a ref flagged STALE by
Story 1's detector, the LLM web-grounds current facts, the skill presents a unified diff of the
proposed ref change, a higher-tier inline judge evaluates it, and — only on `APPROVE ADO-9004` — the
ref is updated, `last_verified` is bumped (via a new deterministic `restamp` op on
`knowledge-freshness.cjs`), and the ref's source authority is re-tagged VERIFIED/INFERRED using the
Story-1 shared classifier. Governing pattern: **LLM does the web + judgement; the CJS does the
deterministic manifest mutation; the Write Gate guards every committed byte; refresh is never
automatic.** Depends on Story 1 (detector + `source-classifier.cjs`). Shippable alone — refresh a
flagged ref.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F7 | Web-ground a STALE ref (WebSearch) + present a unified diff | `skills/knowledge-freshness/SKILL.md` | ✅ Covered |
| AC-F8 | Higher-tier inline judge gates the change before the Write Gate; fail ⇒ no write | `skills/knowledge-freshness/SKILL.md` | ✅ Covered |
| AC-F9 | On APPROVE: update ref, bump `last_verified` (restamp), re-tag authority | `skills/knowledge-freshness/SKILL.md`, `scripts/knowledge-freshness.cjs`, `scripts/lib/source-classifier.cjs` | ✅ Covered |
| AC-F10 | Never auto-runs; never writes without APPROVE ADO-9004 | `skills/knowledge-freshness/SKILL.md` | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `skills/knowledge-freshness/SKILL.md` (modify — add `refresh` path) | AC-F7, AC-F8, AC-F9, AC-F10 |
| `scripts/knowledge-freshness.cjs` (modify — add `restamp` op) | AC-F9 |
| `scripts/lib/source-classifier.cjs` (reuse from Story 1) | AC-F9 |
| `tests/knowledge-freshness.test.cjs` (modify — add `restamp` cases) | AC-F9 |
| `azure-pipelines.yml` (modify — Could-have, non-blocking CI report) | — (Could-have; not an AC) |

**Coverage result:** all 4 Story-2 ACs covered, no orphaned file changes ✅
(The `azure-pipelines.yml` row is an explicitly-optional Could-have, flagged not-an-AC — not an orphan.)

---

## Schema Changes

None (no database). The only structured mutation is bumping `last_verified` (a string date) for one
ref inside `freshness-manifest.json`, performed by the deterministic `restamp` op.

---

## Files Changed

| File | Change | Detail |
|---|---|---|
| `skills/knowledge-freshness/SKILL.md` | modify | Add the `refresh <ref-path>` path: (1) confirm the ref is STALE via `check`; (2) WebSearch current facts, recording each source host; (3) compose the proposed ref content; (4) show a unified diff (changed lines + 3 context); (5) run the inline judge (below); (6) on pass, present the Write Gate prompt; (7) on APPROVE, write the ref, run `restamp`, re-tag via `source-classifier.cjs`. Reads plugin-path; Category C except the gated ref write. |
| `scripts/knowledge-freshness.cjs` | modify | Add `restamp` op: `restamp --path=<ref> --now=<today> [--manifest=...]` → sets that ref's `last_verified = now`, writes the manifest back (stable key order, trailing newline). Pure `applyRestamp(manifest, refPath, nowIso)` exported for unit tests. |
| `tests/knowledge-freshness.test.cjs` | modify | Add `restamp` unit cases (pure `applyRestamp` + CLI exit codes). |
| `azure-pipelines.yml` | modify (Could-have) | Optional non-blocking step: `node scripts/knowledge-freshness.cjs check || true` as a staleness report. Deferred; ship-optional. |

---

## Inline Judge (AC-F8) — rubric

The judge runs on `CRITIC_MODEL`/`REVIEW_MODEL` (higher tier than the default), evaluating the
proposed change **before** the Write Gate. It returns PASS / FAIL with reasons. FAIL ⇒ no Write-Gate
prompt is presented (refresh stops, reports why).

| Judge check | FAIL condition |
|---|---|
| Source authority | The change would be tagged VERIFIED but every grounding source is a non-authoritative host (per `classifySource`) |
| Diff ↔ grounding fidelity | The diff introduces version/API claims not supported by the grounded material (hallucinated content) |
| Real version movement | The proposed anchor does not actually differ from the current one (nothing to refresh) |
| Scope | The diff edits parts of the ref unrelated to the staleness being fixed |

> The judge is advisory-strict: uncertain ⇒ FAIL (do not present a write). This mirrors the
> skeptical `classifySource` default.

**`restamp` exit-code contract (AC-F9):**

| Op | Exit | Meaning |
|---|---|---|
| restamp | 0 | `last_verified` updated for the given ref |
| restamp | 10 | `--path` not found in the manifest (no write) |
| restamp | 1 | Usage error / missing or corrupt manifest |

---

## API Changes

None (no HTTP API). New CLI op `restamp`; new skill path `refresh`.

---

## Auth & Security

The security boundary is the **Write Gate** — every write to `refs/*.md` and
`freshness-manifest.json` requires `APPROVE ADO-9004`. The skeptical classifier (unknown host ⇒
INFERRED) plus the inline judge plus the human diff-approval form defence-in-depth against a bad
web-ground degrading a committed ref. No secrets handled.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| WebSearch yields only non-authoritative sources | Judge FAILs on "source authority"; refresh stops; ref would only ever be tagged INFERRED anyway |
| Maintainer declines the Write Gate (no APPROVE) | No ref/manifest byte changes; refresh reports "not applied" |
| `restamp --path` not in manifest | exit 10; manifest untouched; skill surfaces the mismatch |
| Judge FAIL | No Write-Gate prompt shown; reasons reported to the maintainer |
| Ref already FRESH when refresh invoked | Skill declines: "ref is not stale — nothing to refresh" |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F9 (deterministic) | `restamp` op + pure `applyRestamp` + unit tests | 1 |
| AC-F7, AC-F8, AC-F10 | Skill `refresh` path: WebSearch → diff → inline judge → Write Gate wiring | 3 |
| Could-have | CI staleness report | 1 |
| **Total** | | **4–5** |

**Total SP: 4–5**
**Type: STORY** — Story 2 of EPIC ADO-9004; a shippable slice (refresh a flagged ref). Depends on Story 1 live.

---

## Definition of Done

**Implementation**
- [ ] `refresh` path implemented in the skill per Files Changed
- [ ] `restamp` op added with the documented exit-code contract + `// DECISION:` block
- [ ] No ref/manifest write on any path without `APPROVE ADO-9004`
- [ ] No hardcoded secrets/credentials

**Quality**
- [ ] `node tests/knowledge-freshness.test.cjs` (incl. new `restamp` cases) → "0 failed"
- [ ] `node tests/validate.js` → passes
- [ ] Manual/skill-run integration walk-through of the refresh flow recorded (INT-1)

**Review readiness**
- [ ] PR title: `[ADO-9004] knowledge-freshness Story 2 — gated refresh`
- [ ] PR maps each changed file to its ACs
- [ ] ICEA + both story specs committed in the branch

### Reviewer Checklist
- [ ] A non-authoritative-only grounding can never produce a VERIFIED tag (judge + classifier)
- [ ] Refresh is never invoked automatically (no hook/cron entry) and always shows a diff before the gate
- [ ] `restamp` writes only `last_verified` for the named ref — no other manifest field mutated
- [ ] Manifest round-trips with stable key order + trailing newline (no spurious diff churn)

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None | — | — | — |

---

## Request Flow

```
skill `refresh refs/stacks/dotnet.md`
  → check confirms STALE (else decline)
  → WebSearch current .NET facts (record hosts)
  → compose proposed refs/stacks/dotnet.md content
  → show unified diff
  → inline judge (CRITIC_MODEL) → PASS / FAIL
       FAIL → stop, report reasons (no write)
       PASS → Write Gate prompt: "APPROVE ADO-9004"
  → APPROVE:
       write refs/stacks/dotnet.md                        (gated)
       node knowledge-freshness.cjs restamp --path=refs/stacks/dotnet.md --now=<today>   (gated)
       re-tag authority via source-classifier.cjs (VERIFIED/INFERRED)
```

---

## Rollback

`refresh` overwrites committed ref content + one manifest field — reversible via
`git checkout <ref> freshness-manifest.json`. No data migration. Reverting the branch removes the
`restamp` op and the `refresh` path.

---

## Handover

### QA Team
Integration walk-through (INT-1): pick a fixture ref, force it STALE, run `refresh`, verify: diff
shown, judge verdict shown, no write until APPROVE, and after APPROVE the ref content + `last_verified`
+ authority tag all update. `restamp` has deterministic unit coverage.

### DevOps / Platform Team
No new secrets/env. The inline judge uses the already-configured `CRITIC_MODEL`/`REVIEW_MODEL`. The
optional CI staleness report is non-blocking (`|| true`) and ship-optional.

### Future Developer — Follow-on Work
To broaden trusted sources, edit the allowlist in `scripts/lib/source-classifier.cjs`. The `restamp`
op is the only deterministic manifest mutator — reuse it if other freshness workflows appear.

---

## Test Cases

> AC-F7/F8/F10 are skill-orchestrated (WebSearch + LLM judge + Write Gate) — not pure functions, so
> their positive/negative coverage is via **integration** (skill-run/manual), with the deterministic
> `restamp` (AC-F9) unit-tested. This split is intentional and honest — we do not fabricate unit
> tests for LLM/gate behaviour.

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `applyRestamp` | manifest + existing ref path + now=2026-09-10 | that ref's `last_verified`=2026-09-10; all other refs unchanged | AC-F9 |
| P-U2 | restamp CLI | fixture manifest + valid `--path` | exit 0; manifest round-trips with stable key order | AC-F9 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | restamp CLI | `--path` not in manifest | exit 10; manifest byte-identical (no write) | AC-F9 |
| N-U2 | restamp CLI | corrupt manifest | exit 1; no write | AC-F9 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 (pos) | Full gated refresh | force a fixture ref STALE → `refresh` → judge PASS → APPROVE ADO-9004 | ref updated + `last_verified` bumped + re-tagged; diff shown before gate | AC-F7, AC-F9 |
| INT-2 (neg) | Judge FAIL blocks write | ground from a non-authoritative host only → `refresh` | judge FAIL; NO Write-Gate prompt; no bytes changed | AC-F8 |
| INT-3 (neg) | No auto-write | `refresh` but decline the Write Gate (no APPROVE) | no ref/manifest change; "not applied" reported | AC-F10 |
| INT-4 (neg) | Refresh a fresh ref | `refresh` on a non-stale ref | declined: "not stale — nothing to refresh" | AC-F10 |

> NF verification: none new in Story 2 (the deterministic/convention NF ACs are Story 1). The
> refresh path's safety properties are covered by INT-2/INT-3 (gate + judge) and the reviewer checklist.

---

### Revision Log
2026-09-10 — Story 2 (Refresh) tech spec drafted (base-only).
