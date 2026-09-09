# ADR 0061 — Migration skill family split (Upgrade · Rewrite · Replatform)

Date: 2026-09-09 · Status: Accepted · Supersedes the "migration-owned" framing of ADR 0060

## Context
The single `migration` skill ran all cross-stack/version/host migrations through one 9-stage pipeline,
conflating three jobs that differ by **locality**: in-place version upgrade, out-of-place code
translation, and hosting/topology move. One skill, one incoherent oracle (behavioral vs NFR), coupled
workflows.

## Decision
Split into three directly-invoked skills over a shared substrate (`checkpoint-ledger.cjs` +
`migration-ledger-schema.md`, `judge.md`, model-routing, vendored-copy/drift-check):
- **Upgrade** — in-place same-stack version upgrade; LLM orchestrates a deterministic tool.
- **Rewrite** — out-of-place generative translation to a new target folder; per-cluster BAL/ERL, two-gate.
- **Replatform** — hosting/topology move (on-prem→cloud); NFR/Well-Architected oracle; LLM authors IaC +
  human-executed runbooks.

Retire the `migration` + `migration-status` skills. **No routing classifier** — the `MIGRATE*` keywords
become a **static deprecation signpost** listing the three skills for the human to choose. Preserve the
legacy knowledge (mappings/stacks/strategies/shared + 3 curated specs) at
`skills/shared/migration-knowledge/refs/` as an offline-fallback tier (INFERRED) with a freshness
manifest; archive 8 superseded stage-machine specs (git history). `scripts/migration-source-detect.cjs`
is retained as a **family-shared** detector (supersedes ADR 0060's "migration-owned" framing).

## Consequences
- Per-skill vocabulary: `UPGRADE|REWRITE|REPLATFORM ADO/RESUME/STATUS`; STATUS is an `icea-status`-style
  re-entry over the shared ledger.
- Zero orphaned invocations — every legacy `MIGRATE*`/`APPROVE …-stage` keyword resolves to the signpost
  (verified by `tests/migration-retirement.test.cjs` + `validate.js` §0a checks).
- Offline/air-gapped use retains stack knowledge (INFERRED tier); a future `knowledge-freshness` skill
  validates/refreshes it.
- The multi-stage orchestrator **pattern** is preserved as documentation (DEVELOPER-GUIDE note + planned
  `docs/architecture/legacy-migration-skill.md`).
- Rollback: revert the ADO-9000 feature-branch merge.

## Alternatives rejected
- Keep one `migration` skill — conflates three locality-distinct jobs + incoherent oracle.
- `MIGRATE` routing classifier — rigid rule table, duplicates each skill's intake, breakable extra step.
- Blanket-relocate all 34 refs — 8 stage-machine specs superseded (archived instead).
- Delete all refs — loses offline/air-gapped knowledge (regulated environments).
