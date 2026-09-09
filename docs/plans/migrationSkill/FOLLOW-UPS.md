# Migration Family — Queued Follow-Ups (post ADO-9000)

_Recorded 2026-09-09 after the migration skill family (Upgrade · Rewrite · Replatform) shipped
(EPIC ADO-9000, v3.21.0, merged to main). These are DEFERRED, out-of-scope-for-9000 items — each
needs its own ICEA (`/icea-feature`) before implementation._

## 1. `knowledge-freshness` skill — validate + refresh the offline knowledge tier
**Why:** `skills/shared/migration-knowledge/refs/` is an INFERRED offline-fallback tier that goes
stale (framework versions, cloud service names). Story 3 shipped `freshness-manifest.json` (version
anchors + `last_verified` + `default_ttl_days`) as validator-ready metadata but NOT the validator.
**Scope:** deterministic `scripts/knowledge-freshness.cjs check` (manifest → per-ref
FRESH / STALE-BY-AGE / STALE-BY-VERSION vs a supplied latest-versions input) + a skill that, for STALE
refs, web-grounds current facts → shows a diff → Write Gate → updates the ref + bumps `last_verified` +
re-tags; judge-verified. Reuses the VERIFIED/INFERRED tagging from `upgrade-knowledge-cache.cjs`.
**Entry:** `/icea-feature` (own ADO). **Est:** ~5–8 SP.

## 2. `docs/architecture/legacy-migration-skill.md` — diagrammed explainer of the RETIRED skill
**Why:** The retired `migration` skill embodied a rich 9-stage orchestrator pattern worth capturing
before it lives only in git history. The DEVELOPER-GUIDE orchestrator-pattern section already points here.
**Scope:** hand-authored explainer with Mermaid diagrams (stage flow · gate/checkpoint model · hybrid
inline/subagent execution · SA/SE personas) + a per-stage walkthrough (source-read → target-options →
architecture → feasibility → cluster-plan → per-cluster migration on worktree branches → tests →
golden-master verification).
**Source material:** removed `skills/migration/SKILL.md` + `steps/stage-0..6` (git — `git show
0b794db^:skills/migration/steps/stage-0.md`, etc.), the DEVELOPER-GUIDE section, `docs/plans/migrationSkill/`.
**Entry:** documentation task (no ICEA). **Est:** ~3 SP.

## 3. Review `tests/migration-validation/` for reusable tooling
**Why:** Left intact during retirement (D2b) — not coupled to the retired skill dir. Its
`golden-master-replay.cjs` may be reusable by Rewrite/Replatform (both reuse golden-master for
behavioral regression); the inventory-trace pieces may be legacy-only.
**Scope:** audit the dir → keep + repoint reusable tooling to the family, or archive legacy-only pieces.
**Entry:** review task. **Est:** ~1–2 SP.

---
Sequencing: independent; (1) is highest-value (keeps the offline tier trustworthy). None block each other.
