# Migration Family — Queued Follow-Ups (post ADO-9000)

_Recorded 2026-09-09 after the migration skill family (Upgrade · Rewrite · Replatform) shipped
(EPIC ADO-9000, v3.21.0, merged to main). These are DEFERRED, out-of-scope-for-9000 items — each
needs its own ICEA (`/icea-feature`) before implementation._

## Resume tomorrow — start here
**State (restore anchor):** `main @ 007d911` · plugin **v3.21.0** · EPIC ADO-9000 merged **locally only —
NOT pushed to origin** · `validate.js` 282/0 · full unit suite green · working tree clean (except
auto-managed `.claude/audit`, `memory/dream-log.md`, `.claude/graph/.stale`).

**Open decision (first thing):** push `main` → `origin` (GitHub) before starting, or keep working local?
Push was explicitly deferred on 2026-09-09.

**Recommended order** (independent — no blockers): ① knowledge-freshness → ② legacy-migration explainer
→ ③ migration-validation review. Start with ① (highest value — keeps the offline tier trustworthy).

**First action per item:**
- **①** `/icea-feature` for a new ADO; scope from §1 (reuse the VERIFIED/INFERRED tagging in
  `scripts/upgrade-knowledge-cache.cjs` + the existing `skills/shared/migration-knowledge/freshness-manifest.json`).
- **②** recover the retired skill from git — `git show 0b794db^:skills/migration/SKILL.md` and
  `git show 0b794db^:skills/migration/steps/stage-0.md` (…stage-1..6) — then hand-author the explainer with Mermaid.
- **③** `git ls-files tests/migration-validation/` + read `golden-master-replay.cjs`; decide keep-&-repoint
  (Rewrite/Replatform reuse golden-master) vs archive legacy-only pieces.

**Verify before any `git add -A`:** the `.gitignore` managed block was regenerated this session — confirm
`tests/fixtures/**/{obj,bin}/` is still ignored so the fixture's IDE build output doesn't re-track.

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
