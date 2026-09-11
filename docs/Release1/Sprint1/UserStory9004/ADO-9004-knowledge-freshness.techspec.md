# Epic Tech Spec — knowledge-freshness
ADO #9004 · Release 1 · Sprint 1
Status: DRAFT · EPIC · ~10 SP total

---

## Overview

This epic makes the migration family's offline knowledge tier (`skills/shared/migration-knowledge/refs/`,
20 INFERRED refs) self-auditing. **Story 1 (Detector)** extracts the existing source-authority
classifier into a shared lib and adds a deterministic, no-network CJS validator
(`knowledge-freshness.cjs check`) that classifies every manifest ref FRESH / STALE-BY-AGE /
STALE-BY-VERSION / UNKNOWN, surfaced through a new `knowledge-freshness` skill's `check` path.
**Story 2 (Refresh)** adds the skill's `refresh` path: for a stale ref it web-grounds current facts,
shows a unified diff, runs a higher-tier inline judge, and — only on `APPROVE ADO-9004` — updates the
ref, bumps `last_verified` (via a deterministic `restamp` op), and re-tags source authority.
Governing pattern: **the LLM does the network + judgement; the CJS does the deterministic, testable
comparison + mutation; the Write Gate guards every byte written to committed content.**

Scope boundaries — this epic deliberately does NOT: make the CJS perform network I/O; auto-refresh
without human approval; freshen evergreen methodology refs (excluded by the manifest); or
version-track the migration `source` field.

---

## Story Breakdown

All implementation detail (AC Coverage Matrix, Files Changed, Test Cases) lives in each story's spec.

| Story | Title | SP | Shippable alone? | Depends on | Tech Spec | Status |
|---|---|---|---|---|---|---|
| 1 | Detector — shared classifier + `check` validator + skill `check` path | 5–6 | Yes | None | [ADO-9004-Story-1-detector.techspec.md]() | ⏳ Pending |
| 2 | Refresh — web-ground → diff → inline judge → Write Gate → update + restamp + re-tag | 4–5 | Yes | Story 1 | [ADO-9004-Story-2-refresh.techspec.md]() | ⏳ Pending |

> Story 1 is the shared-components story — it owns the new shared lib (`source-classifier.cjs`) and
> the `knowledge-freshness.cjs` script that Story 2 extends with the `restamp` op.
> Broken by logical completion; each is a shippable ≤6 SP slice. Never broken by AC.

---

## Auth & Security

Plugin-internal developer tooling — **no HTTP surface, no runtime auth**. The relevant security
boundary is the **Write Gate**, not authentication.

**Authentication pattern:** N/A (CLI script + skill; no network endpoint).

**Authorisation:** N/A at runtime. The human approval boundary is `APPROVE ADO-9004`, enforced by
the Write Gate for every write to `refs/*.md` and `freshness-manifest.json`.

**Cross-cutting security concerns:**

| Concern | Mitigation |
|---|---|
| Untrusted web content degrading a committed ref (Story 2) | Skeptical `classifySource` allowlist (unknown host ⇒ INFERRED, never VERIFIED) + higher-tier inline judge + human Write-Gate diff-approval |
| Non-deterministic / untestable validation | CJS performs NO network I/O; web facts arrive via an LLM-supplied `--latest` JSON; `--now` seams the date |
| Silent over-trust of stale facts | UNKNOWN (never FRESH) is reported for any ref the `--latest` input does not cover |
| Secrets in tooling | None handled; scripts read only local JSON/markdown, no credentials, no env secrets |

---

## Overall Request Flow

```
CHECK (Story 1):
  maintainer runs skill `check`
    → (optional) LLM WebSearch → writes latest.json
    → [Story 1] node knowledge-freshness.cjs check --latest=latest.json --now=<today>
        → reads freshness-manifest.json (no network)
        → per ref: age math + normalized version compare
        → prints table + exit code (0 none-stale · 9 some-stale · 1 error)
    → skill renders the staleness table

REFRESH (Story 2, per stale ref):
  maintainer runs skill `refresh <ref-path>`
    → [Story 2] LLM WebSearch grounds current facts (records source host)
    → skill composes proposed ref change → unified diff shown
    → [Story 2] higher-tier inline judge (CRITIC_MODEL/REVIEW_MODEL) → pass/fail
    → fail ⇒ no write proposed;  pass ⇒ Write Gate prompt (APPROVE ADO-9004)
    → on approval:
        → write refs/<ref>.md  (gated)
        → [Story 2] node knowledge-freshness.cjs restamp --path=<ref> --now=<today>  → bumps last_verified (gated)
        → re-tag authority via scripts/lib/source-classifier.cjs (VERIFIED/INFERRED)
```

---

## Rollback

Purely additive except the Story 2 `refresh` path, which overwrites committed ref content + the
manifest — reversible via git.

**Schema migrations:** None (no database; JSON/markdown files only).
**Rollback procedure:**
1. Story 1: revert the feature branch commits — additive files (`source-classifier.cjs`,
   `knowledge-freshness.cjs`, the skill, tests, registration). `upgrade-knowledge-cache.cjs` reverts
   to its in-file classifier copy.
2. Story 2: `git checkout` the affected `refs/*.md` and `freshness-manifest.json` to restore prior
   content; no data migration to unwind.
3. Verify: `node tests/validate.js` green + `node tests/knowledge-freshness.test.cjs` + `node
   tests/upgrade-knowledge-cache.test.cjs` all pass.

**Per-story rollback:** detailed in each story tech spec.

---

## Handover

### QA Team
**What was added:** a `check` command that classifies staleness of the 20 offline refs, and a gated
`refresh` flow that updates a stale ref with web-grounded facts.

**Test entry points:**
- Story 1: `node tests/knowledge-freshness.test.cjs` (deterministic, fixture manifests) + `node
  tests/upgrade-knowledge-cache.test.cjs` (regression after extract) + `node tests/validate.js`.
- Story 2: `restamp` unit tests (deterministic) + a manual/skill-run integration walk-through of the
  refresh flow against a fixture ref (web-ground → diff → judge → APPROVE → verify updated + re-tagged).

**Regression risk:** the `classifySource` extract is the only change to shipped behaviour — guarded
by the existing `upgrade-knowledge-cache.test.cjs` (must stay green).

**Test data:** small fixture manifests + `--latest` JSONs under `tests/fixtures/knowledge-freshness/`.

### DevOps / Platform Team

| Item | Story | Detail |
|---|---|---|
| No env vars, no secrets, no pipelines required | — | Scripts run under plain `node`; no external deps |
| Optional (Could-have) CI staleness report | Story 2 | Non-blocking `node scripts/knowledge-freshness.cjs check` step in `azure-pipelines.yml` — deferred, not required to ship |
| Model routing | Story 2 | Inline judge uses `CRITIC_MODEL`/`REVIEW_MODEL` (already configured) |

### Future Developer — Follow-on Work
Shared components land in Story 1: `scripts/lib/source-classifier.cjs` (authority tagging — the single
source of truth) and `scripts/knowledge-freshness.cjs` (`check`; Story 2 adds `restamp`). To extend:
add new refs to `freshness-manifest.json` (the detector picks them up automatically); to broaden
authority, edit the allowlist in `source-classifier.cjs` (both consumers inherit it). Known gap: the
migration `source` field is intentionally not version-tracked.

---

## Definition of Done — Epic

**Delivery**
- [ ] Both story tech specs generated and saved (tracker shows all ✅)
- [ ] Both stories implemented, reviewed, and merged (tracker Child ADO # filled)
- [ ] Both child ADOs closed in Azure DevOps

**Quality**
- [ ] `knowledge-freshness.test.cjs` + `upgrade-knowledge-cache.test.cjs` + `validate.js` all pass
- [ ] Regression verified: `upgrade-knowledge-cache.cjs` behaviour unchanged after the extract
- [ ] No hardcoded secrets, connection strings, or credentials in any story

**Review**
- [ ] Epic tech spec reviewed by Tech Lead and Product
- [ ] Each story's PR maps changed files to ACs (AC Coverage Matrix)
- [ ] ICEA and both story tech specs committed in the feature branch

---

## Reviewer Checklist

- [ ] Story 1: `classifySource`/`confidenceFor` moved (not copied) — no divergent second copy remains in `upgrade-knowledge-cache.cjs`
- [ ] Story 1: `knowledge-freshness.cjs` performs zero network I/O (no `http`/`https`/`fetch`)
- [ ] Story 1: exit-code contract matches the spec table and is asserted by the test
- [ ] Story 2: no ref/manifest write occurs on any path without `APPROVE ADO-9004`
- [ ] Story 2: a non-authoritative web source can never yield a VERIFIED tag
- [ ] Both scripts carry the 5-point SCRIPT REVIEW header + `// DECISION:` blocks for the non-obvious choices
- [ ] No story breaks the shippable-slice rule

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None — exit-code values and judge rubric pinned in the story specs | — | — | — |

> All open questions resolved before SAVE TECH.

---

## Revision Log
2026-09-10 — Epic tech spec drafted (EPIC branch, base-only).
