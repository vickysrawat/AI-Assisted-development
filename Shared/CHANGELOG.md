# L1 Content Changelog

Every change to an L1 artifact (`Shared/**`) records a line here with its new version. SemVer for L1:
MAJOR = output-shape/behaviour change · MINOR = additive · PATCH = wording/clarity.

## 2026-08-17 — Story 2 (ADO-4002), governance-rails increment
- `Shared/skills/icea-status/SKILL.md` **v1.0** — first L1 content item; promoted from the Story-1 spike
  (self-contained, no runtime plugin-dir). Seed entry in `prompt-manifest.json`.
- Added the versioning + guardrail rails: `prompt-manifest.json`, this changelog,
  `scripts/check-prompt-versions.cjs` (bump-on-change), `scripts/check-l1-reauthor.cjs` (re-author guardrail).
- Deferred to later increments: `Shared/{icea,rules,knowledge,gate}` population, the fleet-wide
  `$PLUGIN_DIR` retirement, and the generate-from-L1 emitter.
