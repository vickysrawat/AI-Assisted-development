## [3.5.0] — 2026-07-04

### Added — Deterministic EXTRACTED graph edges (ADR 0041)
`EXTRACTED` dependency edges in `.claude/graph/graph.json` were derived **by the model**
(Claude ran `rg` and reasoned about import→module mapping) — non-deterministic, token-costly,
approximate, and it pulled source into context. They're now derived by a script.

- **New `scripts/graph-extract-edges.js`** (Node stdlib, offline): parses imports per language
  — JS/TS relative specifiers, Python dotted/relative modules, C# `using`→namespace map +
  `.csproj` `<ProjectReference>`, Java `import`→package map — resolves each to the owning module
  via node `paths` globs, and rewrites **only** the `EXTRACTED` edges. Byte-deterministic and
  idempotent (an unchanged repo → no diff).
- **Merge policy:** preserves model-authored `INFERRED`/`AMBIGUOUS` edges, upgrades a matching
  pair to `EXTRACTED` when source confirms it (keeping the curated `type`/`reason`), and drops
  stale `EXTRACTED` + dangling edges. Never touches `nodes` or `fingerprint`s; raw source never
  enters model context.
- `skills/graph-sync/SKILL.md` (Step 7b builds only `INFERRED`/`AMBIGUOUS`; Step 8a runs the
  extractor) and `skills/architect/SKILL.md` (Step 7-2 runs it after the node write) now call
  it; `skills/shared/graph-json-schema.md` documents the deterministic producer.
- Existing projects get parser-true `EXTRACTED` edges on the next `/graph-sync`
  (migration `014-3.5.0`). Extends [ADR 0039]; a native harness code-index remains the
  "revisit when" that would retire even this.

---

## [3.4.0] — 2026-07-03

### Changed — Version single source of truth
Different files showed different versions on every bump (e.g. `marketplace.json` stuck at
2.5.0, guides at 3.0.0) because the version was duplicated and the bump tool didn't cover
all copies and required Python.

- **`.claude-plugin/plugin.json` `version` is now the single source of truth.** Runtime
  readers (`dream-init`, `dream-sync`, `install.sh`/`.ps1`) already read it live.
  `marketplace.json` no longer embeds a version (it references the plugin by `source`); the
  only static derived copy is the `CLAUDE.md` `# Plugin version:` label.
- **`scripts/bump-version.js`** (new, Node — no Python) is the sole writer: sets
  `plugin.json`, propagates the `CLAUDE.md` label, prepends a CHANGELOG stub, warns on guide
  staleness. `scripts/bump-version.sh` is now a thin wrapper that adds git-hook re-sync and
  runs the Python validator only when it is available.
- **`scripts/check-version-consistency.js`** (new drift guard) fails on any mismatch between
  `plugin.json` and the `CLAUDE.md` label, or if `marketplace.json` embeds a version —
  CI-friendly, Python-free. Guide stamps are warned, not failed (separate doc lifecycle).
- `DEVELOPER-GUIDE.md` "Releasing a new version" rewritten around the single source + guard,
  removing the manual "bump plugin.json / update README badge" steps that caused the drift.

### Documentation
- CLAUDE.md context budget formalised — [ADR 0040](docs/adr/0040-claude-md-context-budget.md)
  + `skills/shared/claude-md-budget-spec.md`: target ≤ ~200 lines is an *instruction-adherence*
  budget, not a context-window limit.
- Guides brought current (plugin-guide + user-guide: version displays, stamps, and a
  "what's new since 3.0.0" section). Fixed `validate.py`'s guide-freshness check, which
  pointed at a nonexistent `plugin-guide-v9.html` instead of `plugin-guide.html`.

---

## [3.3.0] — 2026-07-03

### Added — Knowledge graph becomes an actual graph (`graph.json`, ADR 0039)
The codebase knowledge graph gains a machine-readable **structure of record**,
`.claude/graph/graph.json`, from which the always-loaded index and per-module detail
files are now a generated **projection**. This closes the FAIR *Interoperable* gap
(relationships become queryable, validatable data) while keeping the auto-loaded
context lean — `graph.json` carries no `paths:` frontmatter and never auto-loads.

- **New shared spec** `skills/shared/graph-json-schema.md` — typed nodes
  (`service`/`repository`/`ui`/`datastore`/`external-api`/`shared-lib`/`domain`), typed
  directed edges (`depends`/`calls`/`reads`/`publishes`/`extends`) with a
  `EXTRACTED`/`INFERRED`/`AMBIGUOUS` confidence tag, hub (god-node) flags, and
  deterministic serialization to minimise merge diffs. `graph.json` is the single
  source of truth; the markdown is projected from it (no dual-source drift, ADR 0038).
- **Correctness fix — module-wide fingerprints.** Staleness detection now hashes *all*
  files under a module's `paths`, not a single entry-point file — a change to any file
  in a module now marks it stale (the single-file anchor silently missed those).
  Applied consistently in `architect`, `/graph-sync`, and the git hook.
- **Missing hook created.** `hooks/graph-stale-detect.sh` (referenced by `dream-init`
  but absent on disk) is now implemented with the module-wide fingerprint; wired to the
  existing post-merge + post-checkout hooks.
- **`/graph-sync` overhaul** — reconciliation (confirm-then-remove dead modules, rename
  detection that carries curated prose forward, orphan repair), typed edges derived
  from source imports (`EXTRACTED`), reverse-edge (`Depended on by`) projection, hub
  detection, multi-root modules, and stack-derived ignore globs.
- **Validation** — `validate.py` check 9 now registers `graph-json-schema.md`, asserts
  the generator/refresher reference it, and (when a `graph.json` exists) enforces no
  orphans, no dangling edges, unique ids, index/detail projection agreement, and warns
  on dependency cycles.
- New ADR `docs/adr/0039-graph-json-sidecar.md`.

### Added — `/graph-viz` knowledge-graph visualization
New command + skill `graph-viz` renders the graph as a **self-contained, offline** HTML
view at `.claude/graph/graph.html` (gitignored). Reads `graph.json` only (Category C —
never application source): nodes grouped/coloured by type, edges styled by type and
confidence (solid = extracted, dashed = inferred/ambiguous), hub (god) nodes and stale
modules flagged, and hover reveals a module's dependencies and dependents (impact
analysis). Default 2D SVG needs no dependencies; opt-in `--3d` uses a **locally vendored**
WebGL library (no external download) and falls back to 2D when absent.

### Changed — CLAUDE.md context footprint slimmed (no governance change)
CLAUDE.md is loaded whole every session, so its length is a recurring per-session token cost.
The plugin injected ~180 governance lines into every project (own template was 239 lines).

- **Injected sections compressed** — `## 0. WRITE GATE`, `## 0a. Keyword Handlers`,
  `## 0b. Shell & Git`, `## Feature Gate`, `# Dream` slimmed with **every operative rule kept**
  (the gate, the full keyword table, the feature-gate constraint). Supporting detail/rationale
  moved to new shared specs `skills/shared/write-gate-spec.md` and `dream-reference.md`.
- **De-duplicated** — `## 3. DESIGN PHILOSOPHY` → pointer to `rules/project-rules.md` (already
  the enforced copy); `## 4. MODEL ROUTING` → pointer to `skills/shared/model-routing-spec.md`.
- **Latent injector bug fixed** — `# Dream` (an H1) was extracted through EOF, swallowing
  `## Data Access Convention` + `## Feature Gate` and duplicating them into consumers. `# Dream`
  moved to the end of CLAUDE.md; extraction is now clean. Plugin CLAUDE.md 239 → ~153 lines.
- **Governance-aware size advisory** — new read-only `scripts/claude-md-audit.js` classifies
  sections as governance (must stay) vs movable, and (only when over ~200 lines with meaningful
  movable content) suggests targets. Surfaced in `dream-init` (one-time, at creation) and
  `dream-health` (size card). Never edits CLAUDE.md; never suggests moving an always-active gate.
- Existing projects: `dream-sync` stale-detection refreshes the verbose WRITE GATE / Keyword
  Handlers to the slim versions (both H2-bounded — no neighbour clobber). Migration `013-3.3.0`.

## [3.0.2] — 2026-07-03

### Fixed — Uninstall now removes all global plugin config
`--uninstall` / `-Uninstall` previously removed only the current marketplace source dir and
one `extraKnownMarketplaces` key, relying on `claude plugin uninstall` for the cache. It left
behind: the plugin **cache** dir (all versions), caches **orphaned by a marketplace rename or
past version bumps** (e.g. an old `ke-marketplace/ai-assisted-development` tree with 5
stranded versions), and **stale `extraKnownMarketplaces` entries** for renamed marketplaces.

- New shared engine `scripts/uninstall-cleanup.js` (cross-platform Node) computes and applies
  the cleanup. "Our marketplaces" = the current name plus any under `plugins/cache/*` that
  hosted this plugin — so rename orphans are caught while unrelated marketplaces are never
  touched. It refuses to delete anything outside `~/.claude/plugins`.
- Both installers now run it: **dry-run plan → confirm → apply**. Pass `--yes` (`-Yes`) to skip
  the prompt. Non-interactive shells abort unless `--yes` is given — never a silent delete.
- Scope is global machine config only. Per-project `.claude/` provisioning and credentials are
  intentionally not touched.

## [3.0.1] — 2026-07-02

### Fixed — Fast, unambiguous plugin-path & stack resolution
Provisioning skills (`dream-init`, `dream-sync`, `dream-status`) resolved the plugin
directory by globbing/`readdirSync`-ing `~/.claude/plugins/*/plugins/ai-assisted-development`,
which matched the marketplace **source** tree rather than the installed **cache** copy
that actually runs. When it missed, sessions improvised whole-tree `find` crawls over
`~/.claude` and broke on shell mismatches (a PowerShell `$env:` snippet under bash),
triggering slow syncs and permission prompts.

- **Registry-based resolution** — the plugin dir and version now come from
  `~/.claude/plugins/installed_plugins.json`, matching any key starting with
  `ai-assisted-development@` (fork/rebrand-safe), preferring the `user` scope, verifying
  the path exists, normalising `\`→`/` for git-bash, and **falling back** to the original
  source glob if the registry is absent. Applied at all 7 resolution sites across
  `dream-sync` and `dream-init`. Canonical snippet: `skills/shared/plugin-path-resolution.md`.
- **Cache-first stack detection** — `dream-status` reads `detected_stacks` from
  `.claude/dream-init-state.json` before touching the filesystem; the `find` scan is now a
  fallback used only when the state file is absent.
- **Stack drift fixed** — the stack→rule mapping now covers all seven canonical keys, so
  `dotnet_framework` and `javascript` projects correctly verify
  `dotnet-framework-rules.md` / `javascript-rules.md` (previously never checked).
- Internal skill-logic fix — no project-state migration required; consumers pick it up on
  the next plugin update.

## [3.0.0] — 2026-07-02

### Changed — Company-agnostic identity (BREAKING)
The plugin no longer hardcodes any company/organization. All identity — company,
Azure DevOps organization/project, ADO base URL, plugin repo name, and the
marketplace name — lives in one file, **`.claude-plugin/config.json`**, which ships
with generic placeholders (`your-org`, `your-project`, `Your Company`).

- **The installer prompts** for organization, project, company, and ADO base URL on a
  fresh install (Enter keeps the shown default), writes them into `config.json`, and
  runs `scripts/sync-config.sh` to propagate into `plugin.json` (author, repository) and
  `marketplace.json` (name, description). Updates preserve the entered values.
- **`scripts/sync-config.sh`** (new) is the propagation tool for manual edits/CI.
- **Marketplace namespace de-branded**: `ke-marketplace` → a name **derived from the
  organization** — `{organization}-marketplace` for a real org, else `local-marketplace`.
  Skills now locate the plugin dir by glob (`~/.claude/plugins/*/plugins/ai-assisted-development`),
  so the marketplace name is free and existing installs keep working; `--update`/`--uninstall`
  discover the installed dir regardless of its name.
- CLAUDE.md §2 ships with `{ADO_ORG}` / `{ADO_PROJECT}` / `{ADO_URL}` placeholders, seeded
  from config by `dream-init` Step 5d. Reference docs/guides use `<your-org>` placeholders.
- `validate.py` check 7 enforces no hardcoded real org in skills/commands (once a real org
  is set) and that the manifests never drift from `config.json`.
- Note: the `/ai-assisted-development:` command namespace is unchanged (renaming it would
  break every stub). Law-firm-specific domain content (B1–B7 severity triggers) is retained.

### Changed — Knowledge graph is the single orientation layer (BREAKING)
The codebase knowledge graph (`.claude/graph/`) is now the **only** codebase-orientation
artifact. `domain-map.md` is **retired**. This resolves a redundancy in which two
fingerprint-tracked orientation systems overlapped but only domain-map was consumed
([ADR 0038](docs/adr/0038-knowledge-graph-orientation.md), supersedes [ADR 0017](docs/adr/0017-domain-map.md)).

- **`architect` Step 7** now generates the graph (index + per-module detail files)
  directly, instead of `domain-map.md`. `dream-init` Step 7b only verifies it, deploys
  the stale-detection git hooks, and confirms it is tracked.
- **~20 consumers repointed** — orientation readers (icea-feature, icea-review,
  ado-tasks, pr-describe, pr-spec-review, bug, explain), the `--area` scope flag
  (code-review, security, scope-flags-spec), and health checks (dream-status 1f,
  session-start, plugin-readiness) now read `.claude/graph/graph-index.md` + the
  matching `.claude/graph/<module>.md`. Staleness is the `.claude/graph/.stale` flag
  (refresh with `/graph-sync`), replacing the domain-map 7-day/fingerprint checks.
- **The graph is committed and PR-reviewed — no longer gitignored.** As the single
  source of orientation truth it is version-controlled and reviewed like source.
- **`/update-arch`** no longer touches orientation data; it refreshes the prose
  `architecture.md` and re-runs the deployment questionnaire only. Module/orientation
  refresh is `/graph-sync`.
- **Removed** `skills/shared/domain-map-spec.md` and its `components.shared` entry
  (16 → 15 shared specs). Its `architecture-deployment.md` refresh triggers moved into
  `/update-arch --deployment`. `validate.py` check 9 now asserts the graph schemas exist
  and domain-map-spec is gone.

### Migration
Run `/dream-sync` after upgrading — it generates the graph, removes `domain-map.md`,
and confirms the graph is tracked. See `docs/migrations/012-3.0.0.md`.

---

## [2.6.0] — 2026-06-21

### Added — Codebase knowledge graph (`.claude/graph/`)
Introduces a persistent, fingerprint-tracked knowledge graph populated by
`dream-init` Step 7b. The graph stores a lightweight index (`graph-index.md`)
and per-module detail files (max 400 tokens each) covering bounded context,
key files, dependencies, and patterns. All graph files are gitignored.

### Added — `/graph-sync` command and `graph-sync` skill
Incremental refresh of the knowledge graph. Checks entry-point fingerprints
for all modules and regenerates only stale detail files — unchanged modules
are skipped entirely. Detects new source modules and restructures flat→domain
layout when the project crosses 30 modules. Deletes the `.stale` flag on
success. Typical run cost: 1–3 module scans.

### Added — Staleness detection git hooks (post-merge, post-checkout)
`dream-init` Step 7b deploys `graph-stale-detect.sh` as both
`.git/hooks/post-merge` and `.git/hooks/post-checkout`. After each pull or
branch switch the hook compares entry-point fingerprints and writes
`.claude/graph/.stale` if any mismatch is found. `session-start` reads this
flag and warns the developer at the start of the next session.

### Added — Two new shared schemas
- `skills/shared/graph-index-schema.md` — schema and authoring rules for
  `graph-index.md` (module table, flat/domain structure, fingerprint contract)
- `skills/shared/graph-module-schema.md` — schema and hard rules for
  per-module detail files (frontmatter, ambient-context suppression, four
  required sections, 400-token ceiling)

### Changed — `dream-status`: 3 new knowledge graph checks (now 16 total)
Added checks 1s (graph-index.md present), 1t (fingerprint freshness for all
modules), and 1u (`.stale` flag). Action item 6 "Run /graph-sync" covers
both freshness and stale-flag findings.

### Changed — `dream-init` Step 7b: generates knowledge graph on init
After the architect skill populates architecture docs, Step 7b generates the
full knowledge graph and deploys the git hooks. Graph generation is
idempotent — skipped if `graph-index.md` exists and all fingerprints are
current.

### Changed — `session-start`: checks knowledge graph stale flag
Added a check for `.claude/graph/.stale` at session start. If the flag is
present, the session brief includes: "⚠ Knowledge graph is stale since last
git pull — run /graph-sync to refresh."

### Changed — Write Gate: diff-only display for existing files
The `## 0. WRITE GATE` section in `CLAUDE.md` now instructs:
- Modifications to existing files: show a unified diff (changed lines + 3
  lines of context). Never re-output unchanged lines.
- New files: show the full intended content.
Previously: "show the full intended content (or a clear summary if very large)"

### Changed — `settings.json`: output style `customInstructions`
`dream-sync` now adds `customInstructions` to `.claude/settings.json` to
suppress response preambles and prevent full-file echo when writing existing
files. Reduces output-token cost per session.

### Changed — `.gitignore` managed block: added `.claude/graph/`
`gitignore-sync` and `dream-init` Step 6b now include `.claude/graph/` in
the managed block so the knowledge graph is never accidentally committed.

---

## [2.5.0] — 2026-06-18

### Fixed — icea-implement, icea-revise, icea-approve, icea-status: section number references
All four skills referenced Tech Spec sections by number (Section 9, 10, 11).
Numbers shift when new sections are added — breaking all downstream skills
silently. Fixed to use heading text throughout:
- icea-implement: "Section 9" → `` `## Test Cases` ``
- icea-revise: "Section 10 table" → `` `## Open Questions` table`` (2 places)
- icea-revise: "Section 4 API Contract" → "the API Changes section"
- icea-revise: "Section {N} {title}" → "{section heading}"
- icea-approve: "Section 11" → `` `## Sizing and Story Breakdown` ``
- icea-status: "Section 10 table" → `` `## Open Questions` table``

### Added — techspec-base.md: framework-agnostic Tech Spec template
New file `skills/icea-feature/references/techspec-base.md` defines all
mandatory sections by heading name: AC Coverage Matrix (bidirectional
AC↔File traceability), Files Changed, API Changes, Auth & Security,
Error Handling, Sizing and Story Breakdown, Definition of Done,
Open Questions, Request Flow, Rollback, Handover, Test Cases
(positive unit / negative unit / integration, one row per AC).

### Added — techspec-aspnet-mvc-jquery.md: ASP.NET MVC + jQuery overlay
New file defines framework-specific implementation sections for the
primary K&E stack: Controller pattern, Service interface + stub/swap
implementation, DTO/model, View (HTML + IIFE JS + CSS), XSS safety
analysis table, anti-forgery table, reviewer checklist.

### Changed — icea-feature Step 8: reads detected_stacks, selects overlay
Step 8 now reads `detected_stacks` from `.claude/dream-init-state.json`
and selects the correct overlay template before drafting. Falls back
to base template with a warning if stack is unknown or overlay is not
yet available. Explicitly mandates AC Coverage Matrix and Test Cases.

### Changed — icea-feature Hard Rules: mandatory sections enforced
Added NEVER rules: never omit AC Coverage Matrix, never omit Test Cases,
never use section numbers. Added ALWAYS rules: read templates before
drafting, select correct overlay, never reference sections by number.

### Changed — critic skill: Tech Spec conformance check added
Critic now checks Tech Spec structural conformance: AC Coverage Matrix
present and gap-free, every AC-F* has a test row, NF ACs have
verification methods, Open Questions / Sizing / DoD sections present.

---

## [2.4.4] — 2026-06-18

### Fixed — dream-init Step 4: plugin.json read from wrong path (foundational)
`require('.claude-plugin/plugin.json')` resolved relative to the project
root — a path that never exists. Every dream-init run wrote
`dream_init_plugin_version: undefined` to `dream-init-state.json`, making
dream-sync's version comparison always show `PROVISIONED_VERSION = unknown`.
Fixed to read from the correct plugin install path:
`$HOME/.claude/plugins/ke-marketplace/plugins/ai-assisted-development/.claude-plugin/plugin.json`

### Fixed — dream-init Phase 2: stale section content never updated on upgrade
Phase 2 only checked section presence — if `## 0. WRITE GATE` existed (even
with stale 2.3.0 content), it was skipped entirely. Projects upgraded from
2.3.0 kept the old write gate and keyword handler tables, causing the
plan-skip bug to persist after upgrade.

Phase 2 now runs three passes:
1. **Stale-content replacement** — detects known-bad strings (`Immediately
   after draft`, `draft ICEA inline`, `draft Tech Spec inline`) and replaces
   the entire section from the plugin's CLAUDE.md. Only fires on exact
   known-bad strings — never touches developer customisations.
2. **Missing-section append** — unchanged from before.
3. **Version stamp** — updates `# Plugin version:` line to the installed
   version only after passes 1 and 2 complete. Stamp reflects reality.

### Fixed — dream-init Phase 2: version stamp was never written on re-run
`# Plugin version:` was in the required sections list and checked for
presence only. On re-run (section already present), it was skipped and
the version number was never updated. Now explicitly stamped in Pass 3
regardless of whether the line was already present.

---

## [2.4.3] — 2026-06-18

### Fixed — icea-feature Step 1: prompt framing
"Before I create the ICEA" reworded to "Before I plan and document this
feature" — removes the ICEA-as-primary-goal bias that was causing Claude
to treat the plan as a preamble rather than a gate.

### Fixed — icea-feature Step 5: missing STOP block after temp ICEA write
After writing temp/ADO-{ID}-icea.md, there was no STOP equivalent to
Step 2's gate. Claude could skip Step 6 review and auto-save. Added
explicit ⛔ STOP — ICEA review gate block, same pattern as Step 2.

### Fixed — icea-feature Step 6: structural end-of-response save prompt
Every Step 6 response now ends with `Review the ICEA in VS Code preview.
When ready: SAVE ICEA ADO-{ADO_ID}` — structural rule, not conditional.

### Fixed — icea-feature Step 7: missing mkdir -p before cp
`cp` to permanent location would silently fail if the UserStory directory
didn't exist yet. Added `mkdir -p "$DEST_DIR"` before every cp. Without
this, `rm temp/...` would delete the only copy of the ICEA.

### Fixed — icea-feature Step 8: missing mechanical ICEA gate
No file existence check before Tech Spec drafting — Claude could jump
from Step 5 directly to Step 8 skipping SAVE ICEA. Added mechanical gate
identical to Step 5's plan gate: checks for permanent `*.icea.md` on
disk, emits `ICEA_GATE_BLOCKED` and stops if missing.

### Fixed — icea-feature Step 9: structural end-of-response save prompt
Every Step 9 response now ends with `Review the Tech Spec in VS Code
preview. When ready: SAVE TECH ADO-{ADO_ID}` — structural rule.

### Fixed — icea-feature Step 10: missing mkdir -p before cp
Same data loss risk as Step 7. Added `mkdir -p "$DEST_DIR"` before cp.

### Changed — icea-feature Hard Rules: full gate coverage
Added NEVER rules for Steps 5/6/7/8 gates. Added ALWAYS rules for
Step 6 and Step 9 structural prompts, Step 8 mechanical gate, mkdir -p.

---

## [2.4.2] — 2026-06-18

### Fixed — icea-feature Step 5: mechanical plan gate (root cause of plan skip)
Added a bash file existence check at the top of Step 5 that runs before
any ICEA work begins. If no `*.plan.md` exists at the expected story path,
Step 5 emits `PLAN_GATE_BLOCKED` and halts with an explicit error. This
is deterministic — no amount of instruction interpretation can bypass it.
The prompt-layer STOP/BLOCKED instructions are probabilistic; this gate is not.

### Fixed — icea-feature Step 2: renamed heading + hard STOP block
`### Step 2 — Draft Plan inline` renamed to `### Step 2 — Draft Plan`.
Added explicit ⛔ STOP block after the plan draft with clear statement that
advancing before `SAVE PLAN ADO-{ID}` is a hard violation. Removes the
completion-pattern signal that was causing Claude to continue into ICEA.

### Fixed — icea-feature Step 3: structural end-of-response gate
Every Step 3 response now ends with `Review the plan. When ready: SAVE PLAN
ADO-{ADO_ID}` — not as a conditional but as a structural rule. Proactive
advancement explicitly prohibited even when the plan appears complete.
Guard changed from reactive ("if developer asks") to proactive ("always").

### Fixed — session-start Feature Gate: stale ICEA path + "plan implementation" wording
Gate was checking `docs/icea/ADO-[ID]-*.md` — a path that doesn't exist.
Updated to `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-*.icea.md`.
"Do not generate code, plan implementation" reworded to "Do not generate
implementation code" — previous wording could be read as blocking the plan
drafting step itself.

### Changed — icea-feature Hard Rules: updated to reference mechanical gate
Added: NEVER advance from Step 2/3 to Step 5 proactively.
Added: ALWAYS run Step 5 mechanical gate check before drafting ICEA content.
Added: ALWAYS end every Step 3 response with save prompt.

---

## [2.4.1] — 2026-06-17

### Fixed — CLAUDE.md write gate table was stale
`*.icea.md` and `*.techspec.md` rows said "Immediately after draft — no gate"
— contradicting the draft-then-save flow and causing Claude Code to write
ICEA directly without waiting for SAVE ICEA. Updated to reflect actual
trigger points (SAVE ICEA, SAVE TECH). Added pre-plan gate rule block.

### Fixed — CLAUDE.md keyword handler table referenced "inline" drafting
`SAVE PLAN` and `SAVE ICEA` rows still said "draft ICEA inline" / "draft
Tech Spec inline". Claude Code reads CLAUDE.md as primary instruction
source — these stale descriptions overrode the skill Hard Rules, causing
the plan phase and temp/ flow to be skipped entirely. Updated to describe
the temp/ write flow correctly.

### Fixed — README version blurb described v1.16 features
Rewritten to accurately describe v2.3.x and v2.4.x changes.

### Fixed — developer-guide.html showed Version 2.1.0
Nav header bumped to 2.4.1. Milestone 3 and 4 ICEA/Tech Spec review steps
updated to describe the temp/ flow and VS Code preview pattern.

### Added — migrations 008, 009, 010
Migration files for v2.3.0, v2.3.1, and v2.4.1 — used by dream-sync to
apply version-specific changes to existing projects on upgrade.

### Fixed — ADR README missing ADR 0036
Row for `0036-temp-rendering-aid.md` added to the index table.

### Fixed — icea-template.md version header
Updated from v2.2.0 to v2.4.1.

---

## [2.4.0] — 2026-06-17

### Changed — icea-feature: ICEA and Tech Spec written to temp/ for VS Code preview
ICEA and Tech Spec drafts are no longer dumped inline in chat (150+ lines
unreadable). Both are written to `temp/ADO-{ID}-icea.md` and
`temp/ADO-{ID}-tech.md` immediately after drafting. Developer opens in
VS Code preview (Ctrl+Shift+V) for rendered markdown with tables and headings.
Chat is used only for gap/question replies and change instructions.

### Changed — icea-feature: temp file rewritten on each iterative change
After each correction in chat, Claude rewrites the temp file in place.
VS Code preview auto-refreshes. Chat confirmation is one line only:
`✅ Updated — {section}. Refresh preview.`

### Changed — icea-feature: SAVE ICEA / SAVE TECH copy from temp then delete
On `SAVE ICEA ADO-{ID}`: copies `temp/ADO-{ID}-icea.md` to permanent docs/
location and deletes the temp file. On `SAVE TECH ADO-{ID}`: same for tech,
plus cleans up any remaining temp files for that ADO ID.

### Changed — icea-revise: revision draft written to temp/ for preview
icea-revise now writes to `temp/ADO-{ID}-icea.md` during the revision cycle
(same pattern as icea-feature). Each iterative change rewrites in place.
Step 6 copies to permanent location and deletes temp.

### Added — TEMP_WRITE_EXEMPT block in icea-feature and icea-revise
Both skills declare a `TEMP_WRITE_EXEMPT` block scoping the exception to
`temp/ADO-{ID}-*.md` files only. Global write gate (`## 0. WRITE GATE`)
remains unchanged.

### Changed — gitignore-sync: temp/ added to managed block
`temp/` is now included in the BASE entries written to the managed
`.gitignore` block by gitignore-sync. Existing projects: run
`/gitignore-sync` to pick up the new entry.

### Added — ADR 0036
Documents the temp/ rendering aid pattern and TEMP_WRITE_EXEMPT convention.

---

## [2.3.1] — 2026-06-17

### Fixed — dream-init Step 2a: removed conflicting early path resolution
Step 2a previously ran `where.exe` and wrote to bare `CLAUDE.md` before
`## 0b` existed in the project file. Step 2a is now a no-op placeholder;
all path resolution happens in Step 5 Phase 3 after the section is appended.

### Fixed — dream-init / dream-sync: where.exe-only path detection
`where.exe` is not reliably on PATH in Claude Code's bash context on Windows.
Detection now uses a fallback chain: `where.exe` → `which` → known installation
paths (`/mingw64/bin/git.exe`, `/usr/bin/git`, `C:/Program Files/Git/...`).

### Fixed — dream-sync: grep missed already-written ⚠ NOT DETECTED state
`grep -q "{GIT_PATH}"` only matched the literal placeholder — if NOT DETECTED
was already written, dream-sync silently skipped resolution on every subsequent
run. Grep now matches both placeholder and NOT DETECTED pattern.

### Fixed — dream-init / dream-sync: no recovery path once ⚠ NOT DETECTED written
Re-running dream-init or dream-sync after a failed detection left ⚠ NOT DETECTED
permanently. Both now strip NOT DETECTED back to `{GIT_PATH}` / `{BASH_PATH}`
placeholders before attempting detection, so a successful re-run overwrites the
failure.

---

## [2.3.0] — 2026-06-17

### Fixed — dream-init Step 1: CLAUDE.md path resolution
`!ls CLAUDE.md` could resolve to the plugin's own CLAUDE.md instead of the
project's CLAUDE.md. Fixed to use explicit `[ -f "./CLAUDE.md" ]` check.

### Fixed — dream-init Step 5: only checked for `# Dream` section
Step 5 checked a single marker and hardcoded Dream content inline. Now checks
all 7 required section markers: `# Plugin version:`, `## 0. WRITE GATE`,
`## 0a. Keyword Handlers`, `## 0b. Shell & Git Configuration`,
`## Data Access Convention`, `## Feature Gate`, `# Dream`.

### Fixed — dream-init Step 5: section content read from plugin CLAUDE.md
Section content is no longer hardcoded inline. Each missing section is
extracted dynamically from the installed plugin's CLAUDE.md so it stays
in sync with the current plugin version. Missing sections are appended
individually — existing content is never touched.

### Changed — dream-init Step 5: two-phase init logic
Phase 1 detects whether project-specific content exists (line count + stack
signal). Runs `/init` only when needed. Phase 2 appends each missing plugin
section individually. Phase 3 resolves `{GIT_PATH}` / `{BASH_PATH}`
placeholders. Phase 4 confirms all 7 sections are present.

---

## [2.2.0] — 2026-06-17

### Added — Plan phase integrated into icea-feature (ADR 0035)
icea-feature now drafts a structured plan before the ICEA. Plan covers
problem statement, story (As a/I want/so that), personas, MoSCoW feature
priority, release plan, assumptions, risks, pre-mortem, dependencies, and
open questions. SAVE PLAN ADO-{ID} writes the plan and immediately triggers
the ICEA draft. ICEA auto-populated from plan — no re-asking answered questions.

### Changed — ICEA template extended with User Story protocol
ICEA now includes: Problem Statement, Story, Personas, Pre-mortem,
Irreversibility Flags, MoSCoW Won't Haves (→ Out of Scope), Sign-Off table,
Story Breakdown section. ICEA terminology retained — extended not replaced.

### Changed — Story Breakdown replaces child story sub-folders
Epic ICEA contains a Story Breakdown table (STORY or EPIC type, logical
scope per story, SP, dependency). Child story sub-folders no longer created.
Child ADO numbers recorded at implement time (IMPLEMENT ADO-{ID} Story-{N}).

### Changed — Story breakdown by logical completion
Stories broken by shippable slice (≤5 SP, independently deployable),
never by AC. Each story delivers user value on its own.

### Changed — Epic tracker tracks stories not ACs
Story tracker (≤5 SP): tracks ACs — unchanged.
Epic tracker (>5 SP): tracks stories (child ADO, scope, SP, status).

### Added — SAVE PLAN, PLAN keywords
SAVE PLAN ADO-{ID}: writes plan, triggers ICEA draft.
PLAN ADO-{ID}: cross-session recovery — drafts ICEA from saved plan.

### Changed — icea-revise: plan sync warning added
When ICEA is revised substantively, warns that plan may be out of sync.

### Added — ADR 0035

---

## [2.1.1] — 2026-06-16

### Fixed — install.ps1 rewrite
Version now read dynamically from plugin.json — never hardcoded. -Update mode
offers git pull or local folder (mirrors fresh install). Post-install and
post-update: patches Plugin version line in all found CLAUDE.md files and
dream_init_plugin_version in all found dream-init-state.json files. Marketplace
description version dynamic. Command count in next-steps panel dynamic.

---

## [2.1.0] — 2026-06-16

### Changed — icea-feature single responsibility (ADR 0033)
Step 6 replaced with clean handoff. icea-feature no longer generates
implementation code, writes Status: ✅ Approved, or handles revision inline.
Code generation moved entirely to icea-implement (Step 4 + Step 4a critic gate).
ADO description block moved to icea-approve. Revision redirect to icea-revise.

### Changed — Interactive draft-then-save flow (ADR 0034)
Plan presented inline before ICEA draft. ICEA presented and refined
interactively before any disk write. SAVE ICEA ADO-{ID} writes Plan + ICEA
and triggers Tech Spec draft automatically. SAVE TECH ADO-{ID} writes Tech
Spec, Tracker, and Epic doc. Nothing written to disk before SAVE ICEA received.

### Added — SAVE ICEA, SAVE TECH, ICEA, TECH keywords (CLAUDE.md Section 0a)
New global keyword handlers for the interactive draft-then-save flow.
Cross-session recovery via ICEA ADO-{ID} and TECH ADO-{ID}.

### Changed — icea-implement Step 4 + Step 4a
Full code generation detail absorbed from old icea-feature Step 6. Dapper
with parameterised SQL enforced. Layer generation order defined. Decision
transparency inline comments required. Auto-critic gate (Step 4a) with
2-retry loop before surfacing to developer.

### Changed — icea-approve Step 5
ADO description block output added to approval confirmation.

### Changed — icea-revise Steps 6 + 7
Status-aware reset: only resets to DRAFT — Revising if was ✅ Approved or
IN PROGRESS. If already DRAFT, applies changes without status change.
Tech Spec sync warning added when ICEA revised substantively.

### Changed — icea-status Step 3
Plan-only and ICEA-only states added. Next action logic table covers all
file combinations. ICEA ADO-{ID} and TECH ADO-{ID} directed for recovery.

### Fixed — Dapper convention enforced (rules/dotnet-rules.md)
EF Core reference replaced with Dapper + parameterised SQL rule.

### Added — ADR 0033, ADR 0034
Single responsibility boundaries and interactive draft-then-save flow.

---

## [2.0.0] — 2026-06-15

### Added — Session-independent ICEA workflow (ADR 0031, 0032)
All ICEA workflow state is now disk-based. Developers can close and reopen
sessions freely. Global keyword handlers recognised in any session:
APPROVE ADO-{ID}, IMPLEMENT ADO-{ID}, REVISE ADO-{ID}, STATUS ADO-{ID},
BUG ADO-{ID} — {description}. ADO ID normalised across all three forms.

### Added — /icea-approve (+ APPROVE ADO-{ID})
Approves ICEA from any session. Reads Status from disk, presents summary
of ICEA and Tech Spec, writes ✅ Approved on confirmation, prompts for
next action. Never generates code.

### Added — /icea-implement (+ IMPLEMENT ADO-{ID} [Story-N])
Generates and writes implementation code for an approved ICEA. Reads all
state from disk. Checks tracker for already-implemented ACs. Story-by-story
for Epics. All source code gated behind APPROVE ADO-{ID}. Updates tracker
after every write.

### Added — /icea-status (+ STATUS ADO-{ID})
Shows current state of all ICEA files for an ADO ID — status, open
questions, tracker progress, bugs, and exact next action. Read-only.
The re-entry point after a session gap.

### Added — /icea-revise (+ REVISE ADO-{ID})
Dedicated revision command with 6 critical fixes: path confirmation,
open question source-of-truth (Section 10 table), mid-implementation guard,
icea-feature Step 1.0 redirect, Dream deduplication, re-gate guard.
See ADR 0030.

### Added — Epic support
icea-feature now determines Story vs Epic based on SP total (>5 SP = Epic).
Epic structure: docs/Release{R}/Epic{ID}/ with Sprint/UserStory sub-folders.
Four artefacts per feature: *.icea.md, *.techspec.md, *.epic.md, *.tracker.md.
Epic doc mirrors the QA/review guide format for Tech Lead and Product review.

### Added — Tech Spec sizing (Section 11)
Per-AC effort estimates (SP scale: 1=4h, 2=8h, 3=16h, 5=24h), positive and
negative test cases per AC, total SP, Story vs Epic recommendation, suggested
story breakdown with dependency map.

### Added — Progress Tracker (*.tracker.md)
Created alongside ICEA and Tech Spec. Tracks AC implementation status
(⏳/✅/🚫/🐛/✔), bugs and fixes, open items. Epic-level tracker spans
all stories and sprints. Updated automatically by icea-implement.

### Added — ADR 0030, 0031, 0032
ADR 0030: /icea-revise command (6 critical fixes)
ADR 0031: ICEA state model — disk-based, session-independent
ADR 0032: Global keyword handlers for ICEA workflow

### Fixed — Write Gate scoping (ADR 0028 amended)
*.epic.md and *.tracker.md added to ungated artefacts. APPROVE instruction
updated to APPROVE ADO-{ID} form. Only source code and config files gated.

### Changed — CLAUDE.md Section 0 and 0a
Section 0 Write Gate updated with full artefact scoping table and
APPROVE ADO-{ID} form. Section 0a Keyword Handlers added.

### Changed — CLAUDE.md Feature Gate
Now covers both Story path and Epic path patterns.

### Changed — ADR 0027, 0028, 0029 amended
See individual ADR files for amendment notes.

---



### Added — Write Gate (ADR 0028)
No developer-facing artefact is written to disk until the developer replies
APPROVE. Skills present full content and target path, then block on a
WRITE PENDING prompt. Exclusion: `memory/` auto-capture remains automatic
to preserve the Dream consolidation pipeline. Boundary stated explicitly in
CLAUDE.md § 0 to prevent conflict with Auto-Capture.

### Added — ICEA and Tech Spec hierarchical folder structure (ADR 0029)
ICEA and Tech Spec files now stored under
`docs/Release{R}/Sprint{S}/UserStory{ID}/` instead of flat `docs/icea/`.
Two files per feature: `ADO-{ID}-{feature}.icea.md` and
`ADO-{ID}-{feature}.techspec.md`. The Tech Spec covers architecture touch
points, data design, API contract, business logic, UI, error handling,
security, testing strategy, and open questions — using `❓` blocks instead
of silent assumptions.

### Added — ADO/Release/Sprint identifiers required before ICEA draft
icea-feature skill now collects all three identifiers before drafting.
Missing ones are requested in a single grouped prompt. Release and Sprint
are never inferred.

### Added — ADR 0028, ADR 0029
Architecture decision records for the Write Gate and the new folder structure.

### Changed — icea-floor.sh
Find pattern updated to match `*.icea.md`; legacy `ADO-*.md` and `icea-*.md`
retained for backward compat. Write-exemption case updated for `.icea.md`
and `.techspec.md`.

### Changed — CLAUDE.md Feature Gate
Path updated from `docs/icea/ADO-[ID]-*.md` to new hierarchical structure.

---

_Older releases (< 2.0.0) are archived in [docs/changelog-archive/CHANGELOG-1.x.md](docs/changelog-archive/CHANGELOG-1.x.md)._
