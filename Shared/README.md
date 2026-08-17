# Shared/ — L1 content core (single source of truth)

`Shared/` is **Layer 1 (L1)** of the multi-harness plugin (Epic ADO-4000): the **content & standards**,
authored **once**, harness-independent, **never duplicated**. `Claude/` and `Copilot/` (L2/L3, native per
harness) **consume** L1 — they re-deliver it, they never re-author it.

## Layout
- `Shared/skills/` — reusable skill content (SKILL.md), the authored source for each skill.
- `Shared/icea/` — ICEA + Tech-Spec method, templates, critic rubric. *(scaffold — populated in later 2c increments)*
- `Shared/rules/` — coding standards + the B1–B7 taxonomy + decision/consent specs. *(scaffold)*
- `Shared/knowledge/` — code-review + security checker knowledge; architecture/graph generator knowledge. *(scaffold)*
- `Shared/gate/` — the harness-independent `ai-gate` (Tier-C floor). *(scaffold — Story 6)*
- `Shared/prompt-manifest.json` — AC-F9 version manifest: `{version, sha256, consumes}` per artifact.
- `Shared/CHANGELOG.md` — L1 change log.

## Rules (CI-enforced)
1. **Single source, native consumption.** Edit L1 only in `Shared/`. Each harness's placement under
   `Claude/`/`Copilot/` is **generated** from L1 and carries a `GENERATED FROM \`Shared/…\` — DO NOT EDIT`
   marker. Never hand-edit a generated copy.
2. **Version on change (AC-F9).** Any change to an L1 artifact must bump its `version:` and rebuild the
   manifest. `scripts/check-prompt-versions.cjs` fails a PR whose on-disk content ≠ the manifest hash/version.
3. **Never re-author (AC-F2).** A `Claude/`/`Copilot/` file that mirrors an L1 artifact must be a generated
   copy (carry the marker), never a hand-authored fork. `scripts/check-l1-reauthor.cjs` enforces this.

## Status
This is the **Story-2 governance-rails increment** (2a versioning + 2b guardrail + a 2c seed). The
fleet-wide `$PLUGIN_DIR` retirement (2d) and full content migration are **deferred** to their own
separately-gated passes. First seeded artifact: `Shared/skills/icea-status/SKILL.md` (promoted from the
Story-1 spike).
