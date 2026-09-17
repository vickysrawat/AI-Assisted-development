# ADR 0066 — Rule file refresh: deploy snapshots, staleness tracking, and REFRESH RULES

Date: 2026-09-16 · Status: Accepted · Extends ADR 0059 (scored rule deployment)

## Context

ADR 0059 established hash-tracked rule deployment: `stepDeployRules` in
`setup-init-bootstrap.cjs` copies plugin-canonical rule files to `.claude/rules/`,
records a SHA-256 hash per file in `.claude/rules/.hashes`, and protects developer-edited
files from being silently overwritten. `_deploy-manifest.json` records which rules were
deployed.

Two gaps emerged:

1. **No staleness signal.** Rule files contain coding conventions, security patterns, and
   framework-specific guidance. These go stale when the plugin ships updated rules, when the
   target framework version changes (e.g., Angular 17 → 19), or simply through regulatory or
   security landscape change. Nothing in `setup-status` surfaced this.

2. **No refresh path that respects developer edits.** `setup-sync` re-deploys rules when the
   plugin version changes, but it protects (skips) any file the developer has edited. There is
   no mechanism to review what the plugin updated, merge it with the developer's changes, and
   produce a correct combined result — the developer is left to do this manually or not at all.

## Decision

**Deploy-time artifacts** — `stepDeployRules` now writes two additional artifacts per deployed file:

- **`.claude/rules/.snapshots/{file}`** — a byte-exact copy of the plugin-canonical file at
  deploy time. This is A (the three-way merge baseline). Gitignored (regenerable, per-machine).
- **`.claude/rules/.deploy-meta.json`** — a committed JSON object mapping each file to
  `{ deployedAt, pluginVersion }`. This is the staleness clock and is durable across machines.

`GITIGNORE_BASE` in the bootstrap is extended with `.claude/rules/.snapshots/`.

**Three-way diff model in `skills/shared/rule-refresh.md`** — the canonical spec for
`REFRESH RULES`. For each file:
- **A** = snapshot at deploy (`.snapshots/{file}`)
- **B** = current on-disk file (may include developer edits)
- **C** = plugin's latest canonical file (`_project-deploy/rules/{file}`)

Hash comparison classifies the case:

| A==B | A==C | Action |
|:---:|:---:|---|
| ✓ | ✓ | Nothing to do — skip |
| ✓ | — | Plugin-only update — clean apply, no developer edits to preserve |
| — | ✓ | Developer-only edit — show dev's changes; no plugin update |
| — | — | Both changed — full three-way diff; conflicts marked, never auto-resolved |
| No snapshot | — | Degrade to B vs C diff with a warning |

Conflicts are marked `<<<<<<< YOUR EDIT / ======= / >>>>>>> PLUGIN`. APPROVED is blocked until
the developer resolves them. On APPROVED, the snapshot and `.deploy-meta.json` are updated so
the next refresh uses the new merged file as the baseline.

**`REFRESH RULES` and `REFRESH RULES {filename}` keyword handlers** — added to both CLAUDE.md
files. Per-file scope (`{filename}`) is the primary UX; all-at-once (`REFRESH RULES`) processes
the full `deployed_rules` list. Files not in `_deploy-manifest.json` are off-limits — the
mechanism only touches plugin-managed files, never developer-created rules.

**`setup-status` check `1c-ter`** — reads `.deploy-meta.json` per file and computes age:

| Age | Status |
|---|---|
| < 6 months | ✅ Green |
| 6–12 months | ⚠️ Amber — `REFRESH RULES {file}` recommended |
| > 12 months | ❌ Red — rule content likely out of date |
| No `.deploy-meta.json` | ⚠️ Amber — pre-0066 install; run `/setup-sync` to seed |

## Consequences

- Developers can refresh any plugin-managed rule file on demand, with full visibility into
  what the plugin changed and what they changed, before approving anything.
- The APPROVED gate is preserved per file — no automatic merges or overwrites.
- Developer-edited files that were previously protected (skipped) by `setup-sync` now have a
  safe, auditable path to receive plugin updates without losing customisations.
- The `.snapshots/` directory is gitignored — it does not bloat the repo. `.deploy-meta.json`
  is small (one JSON object) and committed so staleness is visible to all team members.
- `setup-sync` is unchanged in its re-deploy logic; `REFRESH RULES` is additive.
- Rollback: remove the snapshot + deploy-meta writes from bootstrap; remove `rule-refresh.md`,
  keyword handlers, and 1c-ter from setup-status. Existing `.hashes` and `_deploy-manifest.json`
  are unaffected.

## Alternatives rejected

- Store snapshot content in `_deploy-manifest.json` — bloats a committed file with full rule
  file text; gitignored `.snapshots/` keeps the committed footprint minimal.
- Two-way diff only (B vs C) without a baseline — cannot distinguish plugin updates from
  developer edits, producing a misleading diff that conflates both.
- Per-stack (not per-file) refresh granularity — a stack may have multiple rule files with
  different ages and different degrees of developer customisation; per-file is the right unit.
- Auto-merge without human review — developer customisations in rule files are intentional
  policy decisions; silently overwriting them, even with a "smart" merge, removes the developer
  from a decision that is theirs to make.
