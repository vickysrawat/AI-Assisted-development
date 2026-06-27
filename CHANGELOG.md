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

## [1.29.0] — 2026-06-12

### Added — ICEA re-run revises instead of overwriting (ADR 0027)

Re-running `/icea-feature` on a feature that already had an ICEA regenerated from
scratch and silently overwrote prior edits/approvals — or orphaned a duplicate when
the reworded feature name changed the filename slug.

**`skills/icea-feature/SKILL.md` Step 1.0 (new)** — globs `docs/icea/ADO-<id>-*.md`
by ADO ID before classifying. No file → fresh draft. `DRAFT` → load as working
draft and revise via the EDIT/APPROVE cycle, reusing the exact existing path.
`✅ Approved`/`Locked` → confirm REVISE/KEEP before touching it. `--force` is the
explicit scrap-and-restart override. Prior Sign-Off and D-selections carry forward.

### Fixed — revising an approved ICEA now re-blocks the gate; gate predicates corrected (ADR 0027)

On REVISE the skill rewrites the `Status:` line off Approved, which re-blocks
source-file writes until re-approval. Fixing this surfaced two latent bugs that
meant the ICEA enforcement floor was **inert**:
- `hooks/icea-floor.sh` and `hooks/validate-pr-compliance.py` globbed `icea-*.md`
  but ICEA files are named `ADO-<id>-*.md` — they matched nothing. Now glob
  `ADO-*.md` (plus legacy `icea-*.md`).
- The approved-status regex (`Status:\s*Approved`) did not match the documented
  `Status: ✅ Approved` emoji format. Now `Status:.*Approved`; the revise line uses
  lowercase "approval" so it cannot self-satisfy the predicate.

Both hooks changed, so projects will show `hashes: STALE_OR_MODIFIED` (dream-status
1p) until `/dream-sync` refreshes them. Verified with a gate lifecycle eval:
approved satisfies the floor, revising re-blocks, re-approval unblocks, T1 still
satisfies, no-ICEA blocks.

---

## [1.28.2] — 2026-06-12

### Fixed — icea-feature now enforces the template structure; critic catches drift

A reported ICEA generated by `/icea-feature` contained rich technical detail but
omitted the template's mandatory structure — no System Context / Constraint Context
tables, no Non-Functional ACs, no Open Questions or Sign-Off, and Examples not in
Given/When/Then table form. Root cause: Step 2 only *referenced* the template file
("use the template") and the ICEA critic had no dimension that checked structural
conformance, so a drifted draft passed the gate.

**`skills/icea-feature/SKILL.md` Step 2** — now inlines the mandatory section/sub-
table list with exact headers and a hard rule that technical detail goes in the
**System Context table**, not prose; Examples must use Given/When/Then tables with a
genuine permission-boundary scenario. Domain richness is explicitly not a licence to
drop sections.

**`skills/critic/SKILL.md` ICEA mode** — new **Conformance** dimension: flags any
missing/prose-substituted template section, mis-placed technical detail, or non-table
Examples. Added to the sample output; dimension count corrected.

Verified by an eval that runs the conformance check against the reported drifted
ICEA (correctly flagged) and a conforming draft (passes).

---

## [1.28.1] — 2026-06-12

### Fixed — gitignore-sync now actually writes .tfignore on TFVC (ADR 0025)

The 1.27.0 VCS-aware work added the detection spec, the `dream-status` checks, and
the documentation — but the command that does the actual writing,
`commands/gitignore-sync.md`, was never updated and still wrote only `.gitignore`.
On TFVC repos that file is inert, so generated files and the credential file had
**zero protection** even after upgrading. This release closes that gap — the
implementation now matches the spec.

**`commands/gitignore-sync.md`** — now detects the VCS before writing (new Step 0),
writes `.gitignore` on Git and `.tfignore` on TFVC with the correct per-VCS syntax
(backslashes, no trailing slash for TFVC), verifies the right file (Step 3), and on
TFVC checks whether the credential file is already tracked (new Step 1b) — surfacing
the `tf vc delete --keep-local` remediation, since an ignore entry alone does not
unprotect an already-tracked file. `dream-init` delegates to this command, so its
setup flow is fixed by the same change.

Verified by executing the actual shell-escaped embedded script against Git and TFVC
fixtures: correct file and syntax per VCS, idempotent re-runs (managed block written
once), zero forward slashes in `.tfignore`.

---

## [1.28.0] — 2026-06-12

### Added — Plugin version drift detection and re-provisioning (ADR 0026)

`dream-init` stamps the version that provisioned a project but nothing re-stamped
or re-provisioned it on upgrade — so an upgraded install silently assumed the older
setup was still correct, and the routine health check reported green against stale
artifacts. This release makes upgrade drift visible and fixable.

**`skills/dream-status/SKILL.md` — new check 1r** — compares installed
(`.claude-plugin/plugin.json`) against provisioned (`dream_init_plugin_version`)
with a semantic X.Y.Z compare: match → Green; installed newer → Amber "UPGRADE
PENDING — run /dream-sync" with a per-version change list from `docs/migrations/`;
downgrade → Blue; missing state/field → Amber; unreadable `plugin.json` → Red.
Added to the report summary and recommended-actions list.

**`/dream-sync` (new command)** — idempotent re-provision after upgrade: re-copies
hooks and refreshes `.hashes`, re-runs the VCS-aware ignore writer, seeds/migrates
new state files, deploys missing rule files, then re-stamps the version. Never
overwrites developer content. Alias: `dream-init --upgrade`. Wired through the
canonical stub list, `commands/`, `dream-init` deploy step, and `dream-status` 1d.

**`session-start`** — now runs the same drift comparison and surfaces a one-line
upgrade notice on the first interaction, instead of waiting for a status run.

**`docs/migrations/` (new)** — per-release manifest of version-sensitive changes a
sync must apply; drives targeted re-provisioning instead of a blind full re-run.
First entry: `001-1.27.0.md` (TFVC `.tfignore` / managed-block refresh).

---

## [1.27.0] — 2026-06-12

### Added — VCS-aware ignore-file selection (ADR 0025)

The plugin assumed Git everywhere and wrote `.gitignore`. Applications in TFVC
(TFS / Azure DevOps Server) ignore that file entirely, so generated-file and
credential protection was silently inert there — and `dream-status` reported
green against a file TFVC never reads. This release detects the VCS and writes
the file the repo actually honours.

**`skills/shared/vcs-detect-spec.md` (new)** — single detection contract:
- Returns `git` / `tfvc` / `none`; Git wins any tie; `none` falls back to
  `.gitignore` and surfaces a detection-failure note
- Defines the 13-entry managed block as the single source of truth and the
  rules to translate it to `.tfignore` (backslash separators, no trailing
  slash, `#` comments, managed markers preserved)
- TFVC honesty: `.tfignore` only blocks new adds, so an already-tracked
  `.claude/settings.json` is flagged for `tf vc delete --keep-local`; Windows
  env-var PAT storage (Option A) preferred on TFVC

**`skills/dream-status/SKILL.md`** — check 1i now reads the authoritative ignore
file; PAT check adds a `SETTINGS_TRACKED` test on TFVC; pre-commit hook check
reports `n/a` on TFVC (no client-side hook) instead of a false "not installed";
report line and remediation text are VCS-aware.

**Command stubs** (`gitignore-sync`, `dream-init`) — descriptions updated to
reflect the branch; both must apply `detect_vcs` + the managed-block writer per
the new spec.

Verified with a behavioural eval suite (per ADR 0021): Git and TFVC fixtures
exercised against the patched logic, 17/17 assertions passing — correct file and
syntax per VCS, no false Red on protected TFVC repos, tracked-credential and
Git-regression cases held.

---

## [1.26.0] — 2026-06-11

### Added — ICEA-D decisions block, change manifest, trust calibration loop (ADR 0011)

Re-sequenced per priority: SCA moves to v1.27.0. This release makes the *how*
visible and approvable, and starts measuring the model's predictability — the
mechanism "trusted outputs" was missing.

**`skills/shared/icea-decisions-spec.md` (new)** — fork-triggered D block:
- Mechanical fork signals (new dependency, schema choice, novel pattern,
  cross-layer placement, sync/async boundary); T1 never, T2 on fork, T3 always
- Anti-strawman mechanics are load-bearing: steelman-or-delete per option,
  repo-evidence-required recommendations, critic decoration audit
- Selection-shaped approval: OPTION A | OPTION B | EDIT | DIRECT — selecting
  IS the judgment; bare APPROVED invalid while D items are open
- Role-based approvals block (Product: Intent/Examples/Acceptance · Tech Lead:
  Context/Decisions) — the tech lead approves an approach they can see
- Deviation = recorded amendment re-surfacing to the tech lead; never silent

**`skills/shared/change-manifest-spec.md` (new)** — instrumentation mode:
- Complete file-level prediction with the ICEA; every row traces to AC/E/
  Context/D; concrete paths only (vague rows score as misses)
- checkin measures the delta mechanically: precision AND recall (over-
  prediction is its own error — anti-Goodhart); result written to the ICEA;
  NEVER blocks
- `[MANIFEST-DEVIATION]` memory events: deviations train future predictions
  via Dream (recurring deviations consolidate; selected D decisions harvested
  as application decision history)
- sprint-metrics: manifest predictability (median P/R per tier and feature
  area) joins the scorecard — labeled predictability, never correctness
- Graduated autonomy criteria fixed now, shipped later: per-category,
  human-flipped, auto-reverting, floor-invariant, T3 never

**Wiring:** icea-feature Step 2 + selection-gated Step 4; critic ICEA mode
gains the Decisions dimension, code mode gains D-option fidelity (deviation
without amendment = REVISE); checkin gains manifest delta + option-drift WARN;
dream harvests deviations and decisions.

**ADR 0011** · validator check 33 (wiring) · 4 new icea-feature eval scenarios
(d-block-only-on-fork, steelman-required, selection-not-bare-approved,
manifest-rows-concrete).

---

## [1.25.0] — 2026-06-11

### Added — Code-review hybrid: deterministic + probabilistic (Phase D), local-only enforcement model (ADR 0010)

Machines find patterns, models find meaning — where machines exist. Designed
for the actual deployment: developer laptop, legacy-capable, never in CI.

**`skills/shared/phase-d-spec.md` (new, 12th shared spec)** — the three
principal-review faults designed out from day one:
- Fault 1: capability profile is MACHINE-LOCAL (`settings.local.json` → phaseD
  key, auto-gitignored) — never committed; tool availability is a per-machine
  fact. Plus capability-aware reconciliation: a finding may only transition on
  absence when the run possessed the producing capability (no false-Fixed from
  under-equipped machines).
- Fault 2: mandatory baseline strategy — first Phase D run records all
  pre-existing findings in a non-gating `## Baseline` ledger section; only new
  findings or touched-file baseline findings gate. No warning-flood ambush on
  legacy codebases.
- Fault 3: probe ladders built for detected stacks only (C#, JS); Python/Java
  documented as pattern. Cheap per-run version verify self-heals stale profiles.

**code-review command — Phase D/Phase P split**
- Step 3a: C# build-warning capture (stable codes CA/SCS/SA only — never
  localizable message text; fingerprint `code|file|symbol`), project-local
  ESLint for JS, webconfig-checks for config files. Source field mandatory on
  every ledger entry. Coverage block in every scope report.
- Step 3b: Phase P scoped to the judgment tier; receives Phase D output, never
  re-reports it, may annotate but NEVER suppress (suppression = /dismiss only).
- Step 4 rule 2: capability guard before any Fixed transition.
- Ledger: `## Baseline` section added.

**`skills/code-review/references/webconfig-checks.md` (new)** — 15 build-free
ASP.NET Framework config checks (WC001–WC015): debug mode, request validation,
ViewState MAC, machineKey, forms auth, transform-file coverage. The legacy
workhorse — no toolchain required.

**architect Step 1b** — Phase D probe after stack detection; writes machine-
local profile, records only team policy in architecture-deployment.md.

**ADR 0010 (supersedes 0009's deployment claim)** — local-only authoritative
enforcement with the honesty clause: the floor governs the willing and makes
bypass visible; it does not make bypass impossible. session-start now performs
a lightweight floor-presence check every session; pr-create remains the
relocated telemetry point.

**dream-status check 1q** (17 checks) — Phase D coverage health per stack.
**Validator checks 31–32** — Phase D wiring + Baseline section present (fault
guards); webconfig checker required when dotnet-framework rules exist; no
phaseD capability blocks in committed templates.
**Evals** — 3 new code-review scenarios: baseline-never-gates,
capability-guard-no-false-fixed, phase-p-never-suppresses-phase-d.

Deferred to v1.26.0 per approved sequencing: SCA (inventory + license +
version-currency; NO CVE matching — no vulnerability DB in this environment,
and the model never asserts CVE status from memory).

---

## [1.24.0] — 2026-06-11

### Added — Governance hardening: defaults are policy, server-side authoritative floor, spec purity enforced (ADR 0009)

Closes the "Governed: true at the floor, probabilistic above" gap in three layers.

**Layer 1 — Defaults are policy (`commands/dream-init.md` Step 6c, new)**
Hooks install BY DEFAULT: PreToolUse wiring, git pre-commit copy, CI scripts,
content hashes recorded. Opt-out requires `--no-hooks` AND an attributed
decline line in architecture-deployment.md — a missing floor is a visible
decision, never a silent default.

**Layer 2 — Installed once isn't installed forever**
- dream-status check 1p (new, 16 checks total): hook presence, executability,
  content-hash currency, PreToolUse wiring, pre-commit installation. Red when
  absent without recorded opt-out; amber when stale after a plugin upgrade.
- plugin-readiness: "Plugin ready" verdict now REQUIRES check 1p green or a
  recorded decline — a ready verdict with no floor is the overclaim the
  assessment exists to prevent.
- bump-version.sh: re-syncs deployed hooks and refreshes hashes on every bump.

**Layer 3 — Server-side authoritative floor (`hooks/validate-pr-compliance.py`, new)**
Required Build Validation in branch policy — runs where no developer can reach:
- ICEA floor per PR: approved ICEA (or T1 auto-ICEA) matching the branch ADO ID
  must exist when source files changed. Live-tested: blocks correctly.
- T1 bound re-verification as pure diff math: a T1 that grew past 1 file /
  20 lines fails the pipeline even when local checkin was bypassed. Live-tested.
- Bypass telemetry: a CI failure when local gates "passed" is itself a
  gate-override datapoint for the net-value scorecard.
Local hooks become fast feedback; CI is the guarantee. Enforcement ladder:
prompt → local hook → server-side gate; each rule at the lowest rung that holds it.

**Spec purity enforced (validator check 26: warn → ERROR)**
- model-routing-spec.md: tool wiring (`.claude/settings.json` examples) replaced
  with a tool-agnostic contract + pointer to user-guide/README. The durable
  layer is now clean and the purity check is a release blocker.

**ADR 0009** — server-side authoritative enforcement; defaults are policy.
Validator check 27 covers the new script. dream-status check counts: 15 → 16
across plugin-readiness, README. Guides updated and stamped 1.24.0.

---

## [1.23.0] — 2026-06-11

### Fixed — Guide versioning contract; validator dead-code bug (checks 19–28 never ran)

**CRITICAL validator fix:** the report-and-exit block sat mid-file, so every check
appended in v1.22.1 and v1.23.0 (checks 19–28) was dead code after `sys.exit` —
they never executed. The block now sits at the end of the file. First true run
of checks 19–30 surfaced the stale guides below.

**Guide version contract (validator checks 29–30, new)**
- Both HTML guides carry a machine-readable stamp: `<!-- documents-plugin-version: X.Y.Z -->`
- Check 29: a guide >1 minor behind plugin.json is a release-blocking ERROR; 1 behind warns
- Check 30: every command must appear in user-guide.html; every shared spec in plugin-guide-v9.html
- bump-version.sh reports guide staleness on every bump

**Guides updated to v1.23.0 (were documenting v1.21.0 — 2 versions stale)**
- user-guide.html: cards added (dream-audit, gitignore-sync, sync-dirs); new
  "Change tiers" and "Mechanical enforcement" sections; version refs updated
- plugin-guide-v9.html: 4 shared-spec rows added (findings-gate,
  dismissed-findings-reconciliation, change-tier-spec, async-checkpoint-queue);
  release paragraph rewritten

**Known warning (deliberate):** check 26 flags model-routing-spec.md tool
coupling — real finding, deferred to next release (content restructure).

### Added — Evolution release: tiered gates, mechanical enforcement, memory audit loop, net-value scorecard, ADRs, async checkpoint proposal

Implements the seven evolution paths from the AI architect strategic review.
The theme: the structure now justifies and enforces itself.

**1. Change tiers (`skills/shared/change-tier-spec.md`, new) — ADR 0006**
Diff-classified T1 micro / T2 standard / T3 elevated. The system classifies,
never the developer — nothing to game. T1 gets a one-line auto-ICEA with implied
approval; the critic still runs unconditionally. `icea-feature` Step 1 classifies
on intercept; `checkin` Check B re-verifies T1 bounds against the real diff and
blocks if the change outgrew its tier (re-classification only moves up).

**2. Mechanical enforcement floor (`hooks/`, new directory) — ADR 0005**
Principle: prompts propose, hooks dispose.
- `icea-floor.sh` — PreToolUse hook; blocks source writes when no approved ICEA
  (or T1 auto-ICEA) exists. Deterministic floor beneath the prompt gate.
- `findings-gate-precommit.sh` — git pre-commit; open Critical/High findings
  block commits even when /checkin is bypassed. Loud override only.
- `validate-ledgers.py` — CI script; empty dismissal justifications, invalid
  reason categories, FP collisions, and summary-count mismatches fail the pipeline.
- `hooks/README.md` — the three-tier enforcement model and installation.

**3. Memory audit loop (`commands/dream-audit.md`, new) — ADR 0007**
- `session-start` Step 2 now stamps `Last-cited:` on topic files that genuinely
  influenced the session brief (citation telemetry).
- `dream` confidence scoring reads `memory/audit-hints.md` penalties and tags
  `[CORRECTION]` events when developers contradict remembered facts.
- `/dream-audit` aggregates quarterly: archives uncited files (reversibly),
  surfaces contradictions, writes audit hints that lower promotion confidence
  for rollback-prone categories. Dream becomes self-pruning.

**4. ADRs + deprecation policy (`docs/adr/`, new) — ADR 0008**
Eight decision records extracted from project history (ICEA gate, output-gating,
shared primitives, dismissed state, hooks, tiers, memory audit, deprecation).
Deprecation rule: telemetry-driven removal reviews each release; anything unused
two quarters enters review. Bus-factor rule: one release per half-year authored
end-to-end by a second maintainer.

**5. Spec purity + compatibility canary**
- Validator check 26: shared specs must not reference Claude Code mechanics —
  the durable layer stays portable by enforcement, not accident.
- Validator checks 27–28: hooks present; ADR index matches directory.
- `tests/README.md`: eval-suite-as-canary process — run the suite against new
  Claude Code versions before the team upgrades; 3/3 variance passes clears it.

**6. Net-value scorecard (`skills/sprint-metrics/SKILL.md`)**
New Step 5b adds four cost-side metrics from existing artifacts: time-in-gate
(ICEA creation→Approved git timestamps), critic retries, gate overrides
(skip-flag greps), dismissal churn. Report now has BENEFIT/COST/TREND sections.
Publish the trend, not a victory number.

**7. Async checkpoint queue (`skills/shared/async-checkpoint-queue.md`, new — spec v0.9 PROPOSAL)**
Generalizes pr-create's draft pattern: human gates evolve from synchronous
interrupts to asynchronous checkpoints with provisional execution, strict
containment (icea-floor hook required), full audit trail, and phased rollout
gated on net-value telemetry. T3 stays synchronous by design.

**Registration**
- plugin.json: 26 commands, 11 shared specs, version 1.23.0
- dream-audit stub deployed; dream-init/dream-status loops and validator
  CANONICAL_STUBS updated (26); dream-status labels N/26

---

## [1.22.1] — 2026-06-10


### Fixed — 18 structural and functional gaps from AI architect review; validator extended; scaffold scripts added; eval scenarios expanded

**Version consistency (Issues 2, 14)**
- `plugin.json` bumped to 1.22.1
- `CLAUDE.md` Plugin version line updated to 1.22.1
- `README.md` version header updated from stale 1.17.0 to 1.22.1

**plugin.json (Issues 3, 7)**
- `dismissed-findings-reconciliation` added to `components.shared` array
- Description and stack fields updated to reflect current language support
- Java/Spring Boot, Python, and React added to stack array

**Validator — CANONICAL_STUBS (Issue 1)**
- `dismiss.md` and `sync-dirs.md` added to CANONICAL_STUBS (was 23, now 25)
- `N` is now derived from `len(CANONICAL_STUBS)` — stub count labels self-correct automatically

**dream-status / plugin-readiness — check counts (Issue 5)**
- All references to "13 checks" and "14 checks" updated to 15 (matching actual 1a–1o)
- dream-status stub count label updated from N/24 to N/25
- README check count references updated from 13 to 15

**external-dir-map + pr-create — Consent tokens (Issue 4)**
- `external-dir-map/SKILL.md`: Consent: C added to metadata line
- `external-dir-map/SKILL.md`: Reference files section added with source-file-consent and business-context-severity
- `pr-create/SKILL.md`: Consent: B added to metadata line

**Language matrix (Issue 6)**
- `dotnet-framework-rules.md` and `javascript-rules.md` added to `FRONTEND_RULES` in validator
- Validator warnings for these files eliminated

**external-dir-map + sync-dirs documentation (Issue 7)**
- `external-dir-map` row added to README skills table
- `sync-dirs` row added to README commands table
- README skills count updated from 18 to 19

**Fingerprint collision handling (Issue 8)**
- `commands/code-review.md`: collision check added — suffix 'b', 'c' etc. when FP already exists with different content
- `skills/security/SKILL.md`: same collision check added

**dismiss: verify-flag re-opened findings (Issue 9)**
- `commands/dismiss.md` Step 3: warning shown when dismissing a finding that was previously dismissed and re-opened due to code change — surfaces prior dismissal metadata and prompts for re-evaluation

**dream-rollback: conflict handling (Issue 10)**
- `skills/dream-rollback/SKILL.md`: conflict detection now shows a diff of what would be overwritten, with three explicit options (proceed / skip / cancel) instead of vague "proceed with caution"

**sprint-metrics: hardcoded ADO project name (Issue 11)**
- `skills/sprint-metrics/SKILL.md`: hardcoded `'KE'` replaced with `'${ADO_PROJECT}'` in both WIQL queries

**dream: concurrency guard (Issue 12)**
- `commands/dream.md`: Phase 0 Step 0 added — writes `memory/.dream-lock` before starting, removes it after Phase 6, warns and stops if a lock already exists

**bug command: output-gate enforcement (Issue 13)**
- `commands/bug.md` Hard Rules: added rule preventing /bug from being used to bypass the ICEA gate for new features; output-gate principle explicitly stated

**Shared README: British spelling (Issue 15)**
- `skills/shared/README.md`: "artefact" → "artifact" throughout

**dream-status check 1l: model-routing-spec reference (Issue 16)**
- `skills/dream-status/SKILL.md`: check 1l now cites `skills/shared/model-routing-spec.md`

**Validator extended (Issue 17 + future-proofing)**
- Check 19: version consistency across plugin.json / CLAUDE.md / CHANGELOG
- Check 20: every `skills/shared/*.md` must be in `plugin.json` components.shared
- Check 21: scan skills (code-review, security, dynamic-scan) must reference dismissed-findings-reconciliation.md
- Check 22: every plugin.json skill must have a README row (warning)
- Check 23: every plugin.json command must appear in README (warning)
- Check 24: no hardcoded ADO TeamProject values in commands/
- Check 25: commands reading source files should reference source-file-consent (warning)

**Scaffold scripts added (future-proofing)**
- `scripts/new-skill.sh <name>`: creates SKILL.md, stub, test scenario, registers in plugin.json, adds README row
- `scripts/new-command.sh <name>`: creates command file, stub, test scenario, registers in plugin.json
- `scripts/bump-version.sh <X.Y.Z>`: updates plugin.json + CLAUDE.md + CHANGELOG atomically, runs validator

**Eval scenarios expanded (evals recommendation)**
- `tests/skill-scenarios/icea-feature.yaml`: 10 gate enforcement scenarios (trigger/no-trigger, no-code-before-approved, literal-APPROVED required)
- `tests/skill-scenarios/dismiss.yaml`: 9 scenarios (empty justification, confirmation required, fixed-finding guard, accepted-risk warning, undo, verify-flag)
- `tests/skill-scenarios/checkin.yaml`: 6 scenarios (Critical blocks, dismissed non-blocking, accepted-risk informational, skip-security-gate requires justification)
- `tests/skill-scenarios/code-review.yaml`: 6 scenarios (dismissed stays dismissed, code-changed re-opens, regression detection, fingerprint collision, scope flags)
- `tests/skill-scenarios/external-dir-map.yaml`: 3 scenarios (idempotent, no-write when empty, never removes)

Files changed: plugin.json, CLAUDE.md, README.md, CHANGELOG.md, DEVELOPER-GUIDE.md,
commands/dream.md, commands/dismiss.md, commands/bug.md, commands/code-review.md,
skills/dream-status/SKILL.md, skills/plugin-readiness/SKILL.md, skills/dream-rollback/SKILL.md,
skills/security/SKILL.md, skills/sprint-metrics/SKILL.md, skills/pr-create/SKILL.md,
skills/external-dir-map/SKILL.md, skills/shared/README.md, tests/validate.py,
tests/skill-scenarios/icea-feature.yaml, tests/skill-scenarios/dismiss.yaml,
tests/skill-scenarios/checkin.yaml, tests/skill-scenarios/code-review.yaml,
tests/skill-scenarios/external-dir-map.yaml,
scripts/new-skill.sh (new), scripts/new-command.sh (new), scripts/bump-version.sh (new)

---

## [1.22.0] — 2026-06-10


### Added — dismissed-findings-reconciliation shared spec; code-review dismiss gap fixed

**New shared primitive: `skills/shared/dismissed-findings-reconciliation.md` (spec v1.0)**
Extracts the dismissed finding reconciliation rule (Rule 5) into a single canonical
source of truth, following the same pattern as `findings-gate.md`, `scope-flags-spec.md`,
and `file-cache-schema.md`. Rule: keep dismissed if the file is unchanged since
`dismissed-date`; set `verify-flag: code-changed` and re-open as Open (preserving
original dismissal metadata as a note) if the file has commits since `dismissed-date`.
Never count dismissed findings toward open totals. Accepted-risk dismissals on
Critical/High findings remain informational in `checkin` and `pr-create`.

**code-review command — dismiss gap fixed**
`commands/code-review.md` Step 4 Rule 5 now delegates to
`skills/shared/dismissed-findings-reconciliation.md` instead of inline logic.
Previously code-review had no Rule 5 at all — re-scans would re-open dismissed
findings as New, breaking the dismiss workflow for the most-used ledger.

**security and dynamic-scan skills — inline Rule 5 replaced with shared spec delegation**
Both skills previously carried their own inline copy of the dismissed reconciliation
logic. Both now delegate to the shared spec. Logic is identical; the change removes
the drift risk.

**DEVELOPER-GUIDE.md — updated**
- Shared primitives table updated with `dismissed-findings-reconciliation.md` (9th entry)
- New "Finding ledgers and dismissal" section under Security conventions
- Defined-done checklist: new item requiring scan skills to delegate Rule 5 to shared spec

**README.md — updated**
- Token efficiency table: two new rows for `findings-gate.md` and `dismissed-findings-reconciliation.md`

**skills/shared/README.md — updated**
- Contents table: `dismissed-findings-reconciliation.md` row added
- Cross-skill dependency map: `/dismiss` dependency row added

Files changed:
- `skills/shared/dismissed-findings-reconciliation.md` (new)
- `commands/code-review.md` (Step 4 Rule 5)
- `skills/code-review/SKILL.md` (reference table)
- `skills/security/SKILL.md` (Step 0f2 Rule 5)
- `skills/dynamic-scan/SKILL.md` (reconciliation block)
- `skills/shared/README.md` (contents table, dependency map)
- `DEVELOPER-GUIDE.md` (shared primitives table, security conventions, defined-done)
- `README.md` (token efficiency table)

---

## [1.21.0] — 2026-06-10


### Changed — Optional ADO connection in pr-create, shared findings gate, ICEA gate enforcement moved to session-start

**pr-create — optional ADO connection (Option B)**
`pr-create` no longer requires ADO connectivity to produce a PR artifact.
Compliance checks (ICEA review + findings gate) always run on both paths.
After compliance, the skill asks the developer: connect to ADO and submit,
or save a PR draft for manual submission? Draft is written to
`docs/Release<ID>/Sprint<ID>/pr-draft-ADO-<ID>.md` with a pre-filled browser
submit URL. CI/offline mode: `--offline --release <ID> --sprint <ID>` (hard-stops
if either argument is missing). On ADO unreachable during submit, falls through
to draft path automatically rather than hard failing.
Step order reordered: local content first → ICEA compliance → findings gate →
ADO question. PAT resolution moved to the connect path only.

**findings-gate — new shared spec (`skills/shared/findings-gate.md`)**
Extracted the Critical/High ledger-audit bash logic from both `pr-create` and
`checkin` into a single shared specification. Both callers delegate to this spec
rather than re-implementing the ledger-walking logic inline. Output block format
is defined per caller: soft gate (developer decides) for `pr-create`, hard gate
(blocked unless overridden) for `checkin`. Fixes existing drift: the original
`checkin` implementation was doing a heading count without properly verifying
`Status: Open`; the canonical two-pass approach from `pr-create` is now the
single source of truth.

**icea-feature — trigger detection removed**
`## Trigger Detection` block removed from `skills/icea-feature/SKILL.md`.
Self-triggering was unreliable: the gate could only fire after Claude decided
to load the skill, which competed with Claude's default behaviour of starting
to help immediately. Trigger classification is now the developer's responsibility
(team convention) backed by two enforcement layers:
1. `session-start` Step 0 pre-loads the feature gate rule into active context
   at the start of every session.
2. `CLAUDE.md` § Feature Gate carries an output-gated constraint: implementation
   code for new behaviour may not be written without an approved ICEA on disk.

**session-start — Step 0 added**
New Step 0 pre-loads the ICEA feature gate rule before any project context is
loaded. Kept as an inline rule block (not a full skill read) to minimise token
cost on sessions where no feature work is planned.

**Files modified:**
- `skills/pr-create/SKILL.md` — full rewrite (optional ADO, step reorder, offline flag)
- `skills/shared/findings-gate.md` — new file
- `commands/checkin.md` — Step 5c delegated to findings-gate.md
- `skills/icea-feature/SKILL.md` — trigger detection removed, invocation note added
- `commands/session-start.md` — Step 0 feature gate pre-load added
- `.claude-plugin/plugin.json` — version bumped to 1.21.0, findings-gate added to shared components
- `plugin-guide-v9.html` — all v1.17.0 → v1.21.0, pr-create card/timeline updated, ICEA gate references updated
- `user-guide.html` — PR workflow section rewritten, ICEA gate section updated, command cards and skills table updated
- `CHANGELOG.md` — this entry

---

## [1.20.8] — 2026-06-09

### Added — Azure CLI auth blocked; PAT-only decision recorded in MEMORY.md

Azure CLI background calls (`az account get-access-token`) are blocked on the
Kirkland network. This rules out the otherwise-preferred Entra ID Bearer token
flow as a replacement for PAT auth. Added a `[manual] Priority: high` entry to
`memory/MEMORY.md` recording this constraint so it is not re-raised as a future
improvement suggestion. PAT via `AZURE_DEVOPS_PAT` Windows User Environment
Variable remains the correct and only supported auth method for all ADO calls
in this plugin.

**Files modified:**
- `memory/MEMORY.md` — manual entry added
- `.claude-plugin/plugin.json` — version bumped to 1.20.8
- `CHANGELOG.md` — this entry

---

## [1.20.7] — 2026-06-09


### Added — ADO curl flags decision recorded in MEMORY.md

The decision to require `--ssl-no-revoke -4` on all ADO curl calls was not
captured in plugin memory, meaning future `/dream` runs had no record of why
the flags are there and the constraint could silently regress.

Added a `[manual] Priority: high` entry to `memory/MEMORY.md` covering:
- Why `--ssl-no-revoke` is required (corporate proxy blocks revocation checks)
- Why `-4` is required (IPv6 unreachable, silent timeout before IPv4 fallback)
- Why `-u ":$PAT"` must never be used (raw PAT in shell history)
- Why Node.js must be used for JSON parsing instead of python3 (Windows Store alias)
- Source attribution to the live ADO-81469 failure session

`/dream` will promote this to the appropriate topic file on its next run.

**Files modified:**
- `memory/MEMORY.md` — manual entry added
- `.claude-plugin/plugin.json` — version bumped to 1.20.7
- `CHANGELOG.md` — this entry

---

## [1.20.6] — 2026-06-09


### Added — install scripts now create/update `tools/ado-helper/.env` automatically

Developers no longer need to manually copy `.env.template` to `.env` before
using the ADO helper. Both install scripts now handle this as part of the
install flow.

**Behaviour:**

| Situation | Result |
|---|---|
| `.env` does not exist | Copied from `.env.template` with placeholder `ADO_PAT=paste_your_pat_here` |
| `.env` exists, `ADO_PAT=` key present | No change — existing config preserved |
| `.env` exists, `ADO_PAT=` key missing | Key appended with placeholder value |

The developer is shown a coloured status line in all three cases so they know
exactly what happened and what to do next.

**Files modified:**
- `install.sh` — `.env` setup block added before the plugin install step
- `install.ps1` — `.env` setup block added before the marketplace register step
- `.claude-plugin/plugin.json` — version bumped to 1.20.6
- `CHANGELOG.md` — this entry

---

## [1.20.5] — 2026-06-09


### Fixed — Hardened all ADO curl calls across the plugin

**Root cause:** The `ado-tasks` skill required an approved ICEA document
(`docs/icea/ADO-{ID}-*.md`) to exist before it could generate a task breakdown.
When no ICEA was found it stopped with a "run /icea-feature first" message.

A broader audit found that **every skill making ADO API calls** was missing the
`--ssl-no-revoke -4` flags required on the Kirkland corporate network, and two
skills (`app-readiness` SKILL.md and its reference file) were using `-u ":$AZURE_DEVOPS_PAT"`
which embeds the raw PAT value in the command line — visible in shell history and
Claude Code transcripts. All reference files also used `python3` for JSON parsing,
which is unreliable on Windows developer machines.

**Fixes applied across all affected files:**

**1. `skills/ado-tasks/SKILL.md` — ADO fallback path (Step 1b)**
Added Step 1b that runs when no ICEA file is found. Fetches the work item
directly from ADO, extracts title + description + acceptance criteria, and
proceeds with task generation. Flags that no ICEA was found and prompts the
team to formalise via `/icea-feature` before the next sprint.

**2. `skills/ado-tasks/references/ado-connection-guide.md` — new reference**
Troubleshooting guide covering: required curl flags and why, failure symptom
table, PAT storage options ranked by safety, PAT rotation procedure, required
PAT scopes, Node.js JSON parsing pattern, and optional `ado.sh` helper.

**3. `skills/sprint-metrics/SKILL.md` — 6 curl calls fixed**
Added `--ssl-no-revoke -4` to all six ADO API calls.

**4. `skills/pr-create/SKILL.md` — 1 curl call fixed**
Added `--ssl-no-revoke -4` to the PR creation call.

**5. `skills/app-readiness/SKILL.md` — 4 curl calls fixed**
Replaced `-u ":$AZURE_DEVOPS_PAT"` with a pre-built `$ADO_AUTH` header.
Added `--ssl-no-revoke -4` to all four calls. Added `unset AZURE_DEVOPS_PAT`
immediately after building the auth header.

**6. `skills/app-readiness/references/ado-pipelines-api.md` — 7 calls fixed**
Same auth and flag fixes. Replaced all `python3` JSON parsing with Node.js
equivalents. Added authentication section at the top explaining the correct
pattern and why `-u ":$PAT"` must not be used.

**7. `tools/ado-helper/` — new bundled helper**
`ado.sh` persistent helper added to plugin. Bakes in `--ssl-no-revoke -4`,
scrubs PAT after auth header is built, and exposes typed functions. Referenced
from `ado-connection-guide.md` and `ado-pipelines-api.md`.

**Files modified:**
- `skills/ado-tasks/SKILL.md` — Step 1b + hard rules; version → 1.1
- `skills/ado-tasks/references/ado-connection-guide.md` — new file
- `skills/sprint-metrics/SKILL.md` — curl flags
- `skills/pr-create/SKILL.md` — curl flags
- `skills/app-readiness/SKILL.md` — auth pattern + curl flags
- `skills/app-readiness/references/ado-pipelines-api.md` — auth + flags + Node.js
- `tools/ado-helper/` — new directory (ado.sh, .env.template, .gitignore, README.md)
- `.claude-plugin/plugin.json` — version bumped to 1.20.5
- `CHANGELOG.md` — this entry

---

## [1.20.4] — 2026-06-08

### Fixed — Rules files added in plugin updates are now deployed to existing projects

**Root cause:** `dream-init` Step 4c deployed rule files only on first-time setup.
On a re-run it would find `.claude/rules/` already present and skip the entire
deploy loop. Any rule file added in a later plugin version (e.g.
`dotnet-framework-rules.md` and `javascript-rules.md` in v1.20.3) was silently
absent from projects that ran `dream-init` on an earlier version.

**Fixes:**

**1. `dream-init` Step 4c — always run the full deploy loop**
The deploy loop now runs unconditionally on every `dream-init` invocation. The
per-file `if [ ! -f ]` guard stays, so existing customised rule files are never
overwritten. Only genuinely absent files are deployed. This means a single
`/dream-init` re-run after a plugin update is enough to catch up.

**2. `dream-init` — persist `detected_stacks` to `dream-init-state.json`**
After stack detection, `dream-init` now writes `detected_stacks` (array of stack
keys) and `dream_init_plugin_version` to `.claude/dream-init-state.json`. This
gives `session-start` and `plugin-readiness` the data they need to compare
expected vs present rule files without re-running stack detection.

**3. `session-start` Step 3 — warn when rules are out of sync**
Added a rules sync check after the existing Step 3 infrastructure checks. On
every session warm-up, it reads `detected_stacks` from state, maps each stack to
its rule file, and checks whether the file exists in `.claude/rules/`. If any
are missing it surfaces:
```
⚠ Rules out of sync — the following rule files are registered for this project
  but missing from .claude/rules/ (likely added in a plugin update):
    {file list}
  Run /dream-init to deploy them.
```
Silent when everything is in sync. Silent when state is absent (graceful
degradation for projects not yet on v1.20.4).

**4. `plugin-readiness` — rules sync as a scored check**
Replaced the static `.claude/rules/ 4 files` count check with a dynamic
`rules in sync` check using the same `RULES_IN_SYNC` / `RULES_MISSING` signals.
The check is now ❌ Red (Required) when any expected rule file is absent, with a
clear fix instruction. Total check count updated from 13 to 14. Commands stub
count updated from 21 to 22 (`sync-dirs` added in v1.20.2).

**Files modified:**
- `commands/dream-init.md` — Step 4c always-deploy fix; `detected_stacks` + `dream_init_plugin_version` persistence added after stack detection
- `commands/session-start.md` — rules sync check added to Step 3
- `skills/plugin-readiness/SKILL.md` — evidence collection updated; checks table updated (13→14, rules count→rules sync, stubs 21→22)
- `tests/skill-scenarios/dream-init.yaml` — 3 new scenarios
- `tests/skill-scenarios/session-start.yaml` — 3 new scenarios
- `.claude-plugin/plugin.json` — version bumped to 1.20.4
- `CLAUDE.md`, `install.sh`, `install.ps1` — version references updated

---

## [1.20.3] — 2026-06-08

### Added — `.NET Framework` and `JavaScript` rules files

**Why:** The plugin covered .NET Core, Angular, Node.js, Java, and Python but had
no rules for classic ASP.NET Framework 4.x projects (MVC 5 / Web API 2) or for
vanilla JavaScript (ES2015+, non-TypeScript) codebases. Both are common in
enterprise repos and were falling back to `project-rules.md` only.

**What's new:**

- **`rules/dotnet-framework-rules.md`** — rules for ASP.NET Framework 4.x,
  covering MVC 5 and Web API 2 conventions: `IHttpActionResult` response
  standards, `ModelState` validation, Unity/Autofac DI registration, EF 6.x
  repository pattern, `log4net`/`NLog` logging, anti-forgery tokens, and
  `web.config` secret hygiene.

- **`rules/javascript-rules.md`** — rules for vanilla JS / ES2015+ files
  (`.js`, `.mjs`, `.cjs`) where TypeScript is not in use: ESM vs CommonJS
  module discipline, `const`/`let` over `var`, async/await patterns, DOM XSS
  prevention, ESLint + Prettier requirements, and `eval()` / `==` prohibitions.

**Stack detection additions in `dream-init` Step 4a:**

- `HAS_DOTNET_FRAMEWORK` — fires when any `.csproj` targets `net4x` or
  references `System.Web` (distinguishes Framework from Core projects)
- `HAS_JAVASCRIPT` — fires when `.js` source files are present and no
  `tsconfig.json` exists (distinguishes plain JS from TypeScript projects)

Both detectors are additive — a mixed solution (e.g. a Core API alongside a
legacy Framework project) deploys both `dotnet-rules.md` and
`dotnet-framework-rules.md`.

**Files added/modified:**
- Added: `rules/dotnet-framework-rules.md`
- Added: `rules/javascript-rules.md`
- Modified: `commands/dream-init.md` — Step 4a detectors added; DETECTED_STACKS table updated; fallback prompt updated; Step 4c table and deploy script updated
- Modified: `.claude-plugin/plugin.json` — new rules registered; stack and keywords updated; version bumped to 1.20.3
- Modified: `CLAUDE.md` — supported backends comment updated; version bumped

---

## [1.20.2] — 2026-06-08

### Added — External directory auto-mapping (`/sync-dirs` + `dream-init` Step 4d)

**Why:** When a solution references projects outside the solution root (e.g. a
shared library in a sibling repo), Claude Code cannot access those files unless
`--add-dir` is passed manually each session. This change automates that entirely.

**What's new:**

- **`skills/external-dir-map/SKILL.md`** — new skill that scans manifest files
  (`.sln`, `pom.xml`, `settings.gradle`, `angular.json`, `package.json`,
  `pyproject.toml`) for external project references and writes their resolved
  absolute paths into `.claude/settings.local.json` as `additionalDirectories`.
  Works across all supported stacks and is safe to re-run (idempotent).

- **`commands/sync-dirs.md`** — new `/sync-dirs` command that invokes
  `external-dir-map` on demand. Run after adding or removing an external project
  reference without needing a full `/dream-init`.

- **`dream-init` Step 4d** — `dream-init` now calls `external-dir-map`
  automatically after stack detection, so first-time setup requires no extra
  steps.

- **`session-start` Step 3b** — session warm-up now checks whether any manifest
  files have changed since the last sync and surfaces a `⚠ Run /sync-dirs`
  warning if staleness is detected.

**Why `settings.local.json` and not `settings.json`?**
External directory paths are machine-specific. `settings.local.json` is
auto-gitignored by Claude Code, keeping machine-specific paths out of source
control while still applying automatically each session.

**Behaviour guarantees:**
- Creates `settings.local.json` if it does not exist
- Adds `additionalDirectories` key if the file exists but lacks it
- Appends new paths without removing existing ones or touching other keys
- Backs up and recreates the file if it contains invalid JSON
- No-ops when all paths are already listed

**Files added/modified:**
- Added: `skills/external-dir-map/SKILL.md`
- Added: `commands/sync-dirs.md`
- Added: `skills/command-stubs/sync-dirs.md`
- Added: `tests/skill-scenarios/sync-dirs.yaml`
- Modified: `commands/dream-init.md` — Step 4d added; Step 9 summary updated; stub table updated
- Modified: `commands/session-start.md` — Step 3b added
- Modified: `skills/shared/README.md` — cross-skill dependency table updated
- Modified: `.claude-plugin/plugin.json` — `sync-dirs` command and `external-dir-map` skill registered

---

## [1.20.1] — 2026-06-05

### Fixed — `dream-init` now deploys only stack-relevant rules files

**Why:** `dream-init` was unconditionally copying all five stack rules files
(`dotnet-rules.md`, `angular-rules.md`, `nodejs-rules.md`, `java-rules.md`,
`python-rules.md`) into every project's `.claude/rules/` regardless of the actual
tech stack. A Python project got .NET rules; an Angular app got Java rules. Every
extra rules file adds noise and token cost — Claude Code evaluates all rules files
in scope on every action.

**What changed:**

- **`commands/dream-init.md` Step 4** — completely rewritten as a two-sub-step flow:
  - **Step 4a — Stack detection**: runs the same probes used by the `architect` skill
    (`*.csproj`/`*.sln` for .NET, `angular.json` for Angular, `package.json` without
    `@angular/core` for Node.js, `pom.xml`/`build.gradle` with spring-boot for Java,
    `*.py`/`requirements.txt`/`pyproject.toml` for Python). Multiple stacks can fire
    (e.g. .NET API + Angular front-end). If nothing fires, the developer is prompted
    to choose interactively.
  - **Step 4b — project-rules.md** (always deployed — universal guardrails).
  - **Step 4c — stack rules** (deployed only when the matching stack signal fired).
  - Announces detected stacks and which files will/won't be deployed before writing
    anything.

- **`skills/dream-status/SKILL.md` check 1c** — updated to run the same detection
  probes and verify only the *expected* stack rules are present, rather than
  hard-coding the old four-file list. Green = project-rules + all expected stack
  rules present; Amber = one or more expected stack rules missing; Red =
  project-rules.md itself is missing.

- **`commands/dream-init.md` directory tree** — updated to show the conditional
  deployment annotation per rules file.

- **`commands/dream-init.md` frontmatter description** — updated to describe the
  stack-detection behaviour.

No changes to rule files themselves, plugin.json, or command stubs — this is a
behaviour fix only, not a capability addition. Version bumped to 1.20.1 (patch).

## [1.20.0] — 2026-06-05

### Added — `/dismiss` command; fourth finding state: Dismissed

**Why:** the ledger had three states — Open, Fixed, Regression — but no way to say
"we looked at this, it's a false positive, here's why." Without a Dismissed state,
teams either leave noise in Open forever or use a fake Fix. Worse, every scan
re-surfaces the same dismissed finding, and reviewers cannot tell "not yet triaged"
from "deliberately accepted." This release adds a proper fourth state with a required
auditable justification.

**What changed:**

- **New `/dismiss` command** (`commands/dismiss.md`) — moves a finding from
  `## Open Findings` to a new `## Dismissed Findings` section in whichever ledger
  contains it. Requires a fingerprint ID, one of four reason categories
  (`false-positive` · `wont-fix` · `accepted-risk` · `by-design`), and a non-empty
  free-text justification. Refuses to dismiss with an empty reason. Includes
  `/dismiss FP-xxxx --undo` to move a dismissed finding back to Open with a clean
  audit trail. Shows a warning before dismissing Critical/High findings with
  `accepted-risk` so the developer is aware the acceptance will surface downstream.

- **New `## Dismissed Findings` ledger section** — added to all three ledger
  templates (code-review, security, dynamic-scan). Each dismissed entry records:
  `Dismissed date`, `Dismissed by` (git user), `Reason`, `Justification`, and
  `Verify flag` (starts as `none`; set to `code-changed` by future scans when the
  code at that location is modified).

- **New `Dismissed: N` Summary line** — added to the `## Summary` block in all three
  ledger templates so dismissed counts are visible at a glance.

- **Reconciliation rule 5** — added to `code-review.md` (Step 4), `security/SKILL.md`,
  and `dynamic-scan/SKILL.md`: dismissed findings are kept dismissed on re-scan (not
  re-opened, not re-reported as New). **Exception:** if the source file at the
  dismissed finding's location has been modified since the `dismissed-date` (detected
  via `git log --since`), the finding is re-opened as Open with a note that the prior
  justification is preserved but re-review is required because the code changed. This
  keeps dismissal honest — you cannot dismiss a finding and then silently change the
  code it was based on.

- **`/fix` guard** — `/fix` now refuses to apply a fix to a dismissed finding and
  directs the developer to `/dismiss FP-xxxx --undo` first.

- **`/checkin` and `pr-create` gate updates** — the Check D (security/DAST) gate and
  the PR open-findings gate now count only `Status: Open` findings, not dismissed ones.
  `accepted-risk` dismissed Critical/High findings are listed as an informational note
  in the output and in the PR description body, so reviewers can make an informed
  decision without the gate blocking.

- **`dream-status` update** — the `1o — Open findings` check now also counts and
  displays dismissed findings across all three ledgers as a separate informational row:
  `dismissed findings (all ledgers)  ℹ️  N dismissed`. Does not affect the green/amber/red
  status (which is based on open findings only).

- **New command stub** `skills/command-stubs/dismiss.md` — deployed by `dream-init`
  alongside all other stubs. Stub list updated from 23 to 24 commands everywhere
  (plugin.json, dream-init deploy loop and table, dream-status 1d check, install scripts).

**Verified:** dismiss moves the block, undo restores it, summary counts stay consistent,
code-changed re-open logic triggers correctly, /fix rejects dismissed findings, gates
pass when only dismissed Critical/High exist, accepted-risk note appears in checkin and
PR description output.

> **Note for upgrading:** reinstall the plugin so the new `/dismiss` stub is deployed,
> then run `/dream-init` (it will skip existing stubs) or copy
> `skills/command-stubs/dismiss.md` to `.claude/commands/dismiss.md` manually.

## [1.19.0] — 2026-06-05

### Added — `/gitignore-sync` command; dream-init now delegates to it

**Why:** even after the v1.18.0 write fix, `dream-init` could run to completion
without the `.gitignore` step appearing at all — a step buried deep in a long
multi-step command was being summarized past during execution. The write logic was
correct; it simply wasn't being reached. This is the third bug in the
"described-but-not-executed" family, and the structural fix is to stop burying
write logic inside long flows.

**What changed:**
- **New `/gitignore-sync` command** — a single-purpose command that creates
  `.gitignore` if missing, writes the plugin-required entries inside a managed
  block (never touching the developer's own lines), optionally offers detected
  build/env artifacts (`--with-artifacts`), and verifies the result from disk. One
  job in one place is far harder to skip than step 6b-of-9.
- **`dream-init` Step 6b now delegates** to `/gitignore-sync` instead of inlining
  ~245 lines of write logic. Single source of truth; the delegation is one short,
  forceful instruction.
- Registered everywhere: `plugin.json` (23 commands), the canonical stub list,
  `dream-init` deploy loop/table/confirmation, and `dream-status` (now 23/23
  stubs). New command stub added.

**Verified** on the exact failure scenario (`.gitignore` deleted): the command
creates the file, reports `VERIFY_OK`, and on re-run preserves developer lines
without duplicating the managed block.

> **Note for upgrading:** reinstall the plugin so the new command is registered,
> then run `/gitignore-sync` directly — or re-run `/dream-init`, which now calls it.

#### Files
- `commands/gitignore-sync.md`, `skills/command-stubs/gitignore-sync.md` — new.
- `commands/dream-init.md` — Step 6b replaced with delegation; stub references updated.
- `skills/dream-status/SKILL.md` — stub count 22 → 23.
- `tests/validate.py` — `gitignore-sync.md` added to canonical stubs.
- `.claude-plugin/plugin.json`, `CLAUDE.md`, `README.md`, `install.sh`, `install.ps1` — version → 1.19.0, command count 23.

---

## [1.18.1] — 2026-06-05

### Fixed — `/update-arch --deployment` reported "--deployment not found"

**Bug:** running `/update-arch --deployment` errored with a "--deployment not found"
style message. Root cause: `update-arch` Step 0 said "if the `--deployment` flag is
present…" but had **no argument-parsing logic** — no parse table, no inspection of
the argument string. With nothing recognizing the flag, execution fell through to
Step 1, which treats any argument as a path/subtree, so `--deployment` was looked
up as an area and reported as not found. The frontmatter `argument-hint` didn't list
`--deployment` either. Two downstream defects would have surfaced next: the
deployment questionnaire had no explicit file write and self-skipped on an
already-complete file (so an explicit re-capture did nothing).

**Fix:**
- **Step 0 now has an explicit parse table** (mirroring `code-review`'s flag
  handling): `--deployment` → deployment mode; a path → subtree; nothing → auto;
  an unknown `--flag` → a clear error listing valid usage. This removes the
  fall-through that caused the "not found" message.
- **`argument-hint`** updated to advertise `--deployment`.
- **Explicit seed + write:** deployment mode ensures
  `.claude/architecture/architecture-deployment.md` exists (seeding from the
  detected stack's template, or a minimal fallback) before collecting answers, so
  `--deployment` works standalone without a prior full `dream-init`. The write is
  performed, not just described.
- **Re-capture bypass:** architect Step 0.5 gained a FORCE-mode exception so an
  explicit `--deployment` re-runs the questionnaire even on a fully-populated file
  (pre-filling current answers as defaults), instead of silently skipping.
- **Verification:** after writing, the file is re-read and confirmed; success is
  reported from disk state, not intent.
- Added a note that the command is `/update-arch` (not `/arch-update`).

Verified: the parse table resolves `--deployment`, a path, no-args, and an unknown
flag correctly; the seed command creates the file from a template (and a minimal
fallback when no template is present), is idempotent on re-run, and the verify
command confirms the written file.

#### Files
- `commands/update-arch.md` — Step 0 rewritten with parse table + seed + write + verify; `argument-hint` updated.
- `skills/architect/SKILL.md` — Step 0.5 FORCE-mode re-capture exception.
- `.claude-plugin/plugin.json`, `CLAUDE.md`, `install.sh`, `install.ps1` — version → 1.18.1.

---

## [1.18.0] — 2026-06-05

### Fixed — dream-init now actually writes `.gitignore`

**Bug:** `dream-init` ran to completion and printed a `.gitignore` summary, but the file was never created or changed. Root cause: Step 6b described the write declaratively ("add any that are missing", "create `.gitignore` if it does not exist") without ever issuing a write command. The detection bash blocks ran, the summary printed "✓ added", but no bytes were written — the summary reflected intent, not the file on disk. Two secondary defects compounded it: the "already covered" containment check matched substrings anywhere in the file (so a bare `.claude/` line masked `.claude/settings.json` and friends), and Phases 2–3 likewise detected candidates without an explicit write.

**Fix:**
- **Phase 1** now runs an explicit, idempotent Node command that creates `.gitignore` if missing and writes the plugin entries inside a managed block (`# === ai-assisted-development (managed) ===`). Re-runs rewrite the block in place — no duplication. Developer lines outside the block are never touched.
- **Whole-line matching** replaces substring matching, so an existing `.claude/` directory line no longer masks specific `.claude/*.json` entries.
- **Phases 2 and 3** now pass detected/selected items to an explicit append command instead of only detecting them.
- **Phase 4 (new) — mandatory verification:** re-reads `.gitignore` and confirms every plugin entry is present, printing `VERIFY_OK` or `VERIFY_FAIL missing=[…]`. The command must report success from the file on disk, not from intent; on `VERIFY_FAIL` it re-runs the write before proceeding.
- Hard rules updated: always execute the write, whole-line matching only, always verify, summary must reflect actual writes.

Verified against: no existing file, idempotent re-run (block count stays 1), a developer file with their own lines (preserved) including the substring-mask case (now fixed), and a file where some plugin entries genuinely pre-exist (not duplicated).

#### Files
- `commands/dream-init.md` — Step 6b Phases 1–4 rewritten with explicit write + verification; hard rules updated.
- `.claude-plugin/plugin.json`, `CLAUDE.md`, `install.sh`, `install.ps1` — version → 1.18.0.

---

## [1.17.0] — 2026-06-05

### Language-agnostic: .NET, Java/Spring Boot, Python, Node.js

The plugin previously assumed a .NET 8 / Angular / Node.js stack in five layers
(rules, architect detection/scaffold, code-review checkers, dynamic-scan configs,
and the icea-feature generation order). This release makes all five language-aware
and removes the remaining hardcoded stack assumptions so the full
detect → spec → generate → review → scan loop adapts to whatever a repo actually is.

#### Added

**Rules** — `rules/java-rules.md` (Spring Boot layered architecture, Bean
Validation, `ProblemDetail`, constructor injection, JUnit 5, no-PII logging) and
`rules/python-rules.md` (type hints + mypy, FastAPI/Django/Flask boundary
validation, no `eval`/`exec`/unsafe deserialization, pytest, no-PII logging). Both
registered in `plugin.json` — now 6 rule files.

**Architect** — detection for Spring Boot (`pom.xml`/`build.gradle` with a
spring-boot dependency) and Python (Django via `manage.py`, then FastAPI, then
Flask by manifest), with a documented priority order. New prompt files
(`spring-boot`, `python-fastapi`, `python-django`, `python-flask`) and matching
template folders, each carrying the four canonical architecture files. Detection
list, Step 2 template table, and Step 4 prompt table all extended.

**Code-review** — `checkers-java.md` and `checkers-python.md` (the latter covering
FastAPI/Django/Flask specifics). Step 0e now has an explicit language-dispatch
table: the skill inspects the file extensions in scope and loads every matching
checker (a polyglot change loads more than one), falling back to the universal
categories in `checkers.md` when no language file matches. `--area backend` is now
language-aware (`*.cs`, `*.java`, `*.py`).

**Dynamic-scan** — Spring Boot and Python-web detection signals; new
`zap-spring-boot.md` (OpenAPI import, actuator-exposure checks) and
`zap-python-web.md` (per-framework spider/import strategy). `route-extraction.md`
extended with Spring `@*Mapping`, FastAPI/`APIRouter`, Django `urls.py`, and Flask
`@route` patterns. `dependency-scan.md` gained Maven (`pom.xml`), Gradle
(`build.gradle`), and `pyproject.toml` audit rows.

#### Changed (the keystone — removing hardcoded stack assumptions)

- **`icea-feature`** Step 6 no longer generates a fixed ".NET → EF → Angular →
  Node" sequence. It reads the active layers and languages from
  `architecture.md` (falling back to `CLAUDE.md`'s `# Stack:` line) and generates
  only the layers the project has, in dependency order (persistence → service →
  API → UI → tests → PR description), following the rule files for the languages
  in play. It never generates a layer in a language the project doesn't use.
- **`ado-tasks`** description, default-stack note, and Step 2 layer detection are
  now stack-agnostic — tasks are named in the active layer's language as declared
  in `architecture.md`. (It already read active layers from config; the wording
  caught up.)
- **`CLAUDE.md`** `# Stack:` line is now a per-repo placeholder that dream-init /
  architect populate, with the supported backends and frontends documented inline.

#### Validator

New check #18 — a **language-coverage matrix**. Every backend language declared by
a rule file must have a code-review checker and at least one architect
prompt+template; every template folder must carry its canonical files. A rule file
not covered by the matrix warns. This makes half-adding a language (e.g. a rule
with no checker) a blocking error. Verified against a simulated half-add.

#### Files

- `rules/java-rules.md`, `rules/python-rules.md`
- `skills/architect/prompts/{spring-boot,python-fastapi,python-django,python-flask}.md`
- `skills/architect/templates/{spring-boot,python-fastapi,python-django,python-flask}/` (4 files each)
- `skills/code-review/references/checkers-{java,python}.md`
- `skills/dynamic-scan/references/zap-{spring-boot,python-web}.md`
- Edits: `skills/architect/SKILL.md`, `skills/code-review/SKILL.md`,
  `skills/dynamic-scan/SKILL.md` (+ `route-extraction.md`, `dependency-scan.md`),
  `skills/icea-feature/SKILL.md`, `skills/ado-tasks/SKILL.md`, `CLAUDE.md`,
  `tests/validate.py`, `README.md`, `install.sh`, `install.ps1`,
  scenario additions to `architect.yaml` and `code-review.yaml`.
- `.claude-plugin/plugin.json`, `CLAUDE.md` — version → 1.17.0.

---

## [1.16.0] — 2026-06-04

### Consent-category single source of truth + validator enforcement

Closed a latent governance gap: a skill's source-file-consent category was
previously stated in prose in two independent places — the skill's own body and
the central `source-file-consent.md` table — with no machine check that they
agreed. The two could drift silently, and a skill could claim a stricter category
than the central spec recorded (or vice versa) without anything catching it.
Worse, 8 of 18 skills stated no category in any greppable form at all.

#### What changed

**Machine-readable declaration on every skill.** Each `skills/<name>/SKILL.md`
metadata line now carries a mandatory `Consent:` token, e.g.
`_Skill version: 1.0 · Last changed: 2026-06-04 · Plugin compatibility: ≥1.15.0 · Consent: C_`.
A fixed grammar supports context-specific categories for multi-mode skills:
`critic` is `C(internal,icea)|A(code-standalone)` and `dynamic-scan` is
`A(scan)|B(finding-map)`. All 18 skills now carry a token.

**`source-file-consent.md` is now the single source of truth.** Its per-skill
table was restructured into (a) an authoritative skill table — one row per skill,
keyed by directory name, category cell in the same grammar as the tokens — and
(b) a separate, informational command-reference table the validator ignores.
Removed a stale `prod-readiness` entry (the real skills are `app-readiness` /
`plugin-readiness`), moved command-only entries (`/checkin`, `/fix`, `/bug`,
`/explain`, `/session-start`, `/dream`, `/update-arch`) out of the skill table,
and consolidated the previously split `critic` and `dynamic-scan` rows into single
compound-grammar rows.

**Validator check #17 (`tests/validate.py`).** For every skill, the validator now
parses the `Consent:` token and the skill's row in the authoritative table into a
normalised set of `(category, context)` pairs and errors on: any mismatch, any
skill missing a token, any malformed token, any skill missing from the table, and
any table row naming a skill folder that no longer exists. The table parse is
scoped strictly to the authoritative skill table (between its `| Skill | Consent |`
header and the next heading) and un-escapes `\|` inside compound cells, so the
Category A/B/C explainer tables and the command reference table are not mistaken
for it. Verified against all four failure modes (drift, missing token, partial
compound drift, stale row).

#### Scope and limits

This enforces that the *declared* category in the body matches the *declared*
category in the spec. It does not verify that a skill's runtime *behaviour*
matches its declared category — that belongs to the behavioural scenario tests
(`tests/skill-scenarios/*.yaml`). A follow-up should add a scenario per
Category-C skill asserting it refuses a source read.

#### Files

- All 18 `skills/*/SKILL.md` — added `Consent:` token to the metadata line.
- `skills/shared/source-file-consent.md` — grammar definition; authoritative
  skill table; separate command reference table; stale-entry cleanup.
- `tests/validate.py` — new check #17 with `parse_consent()` grammar parser.
- `.claude-plugin/plugin.json`, `CLAUDE.md` — version → 1.16.0.

---

## [1.15.0] — 2026-06-04

### New feature — Critic layer for ICEA and code generation

Added a second-pass **critic** that evaluates generated artefacts before they are written to disk, implemented as both an auto-running skill (inside `icea-feature`) and a parameterized standalone command (`/critic`).

#### What was added

**Critic skill (`skills/critic/SKILL.md`)** — a review-tier generator-critic pass with two modes:
- **ICEA mode** critiques an ICEA draft for completeness, testability, B1–B7 coverage, and scope-vs-Intent.
- **CODE mode** critiques generated implementation for ICEA traceability, simplicity (CLAUDE.md §3), rules compliance, decision transparency, and hidden assumptions.

**Two automatic gates wired into `icea-feature`:**
- **Gate 1 (Step 2.5)** — after the ICEA draft, before the gap list. Critic concerns are folded into the existing Step 3 gap list, tagged `[critic:Dimension]`, so the developer sees one consolidated set of items before approving. No retry loop in ICEA mode.
- **Gate 2 (Step 6, item 3a)** — after code is generated in context but **before any disk write**. The verdict gates the write: PASS / PASS WITH NOTES → write; REVISE → regenerate. The ICEA file is still written on approval; only the implementation code is gated.

**Bounded REVISE loop (CODE mode):** up to **2 automatic retries**, each announced (`🔁 Critic revision R of 2`), with a diminishing-returns guard that surfaces early if a retry produces an identical critique. After 2 failed retries the critic surfaces to the developer with `ACCEPT AS-IS` / `GUIDE` / `HALT`. Nothing reaches disk while the verdict is REVISE.

**Standalone command (`/critic icea|code [ADO-<id>]`):** developers can run either phase independently — e.g. critique an already-approved ICEA, or critique already-written code. Phase is inferred when omitted.

**Model routing:** new `CRITIC_MODEL` variable in the review tier, resolving `CRITIC_MODEL` → `REVIEW_MODEL` → `claude-sonnet-4-6`. This lets teams tune the critic independently (e.g. Opus critic over a Sonnet review tier).

#### Why we implemented it — architecture decision

The plugin already gated **planning** (ICEA approval) and the **committed diff** (`/checkin`, `/code-review`), but nothing evaluated an artefact *at the moment it was produced and before it was persisted*. That gap mattered: a later source-scanning review can find defects, but it has lost the spec-in-context and cannot cheaply check *intent alignment* ("does this code do exactly what the approved AC asked — no more, no less?"). The critic closes that gap with a generator-critic pattern where the ICEA and the generated code are both in context simultaneously.

Three design choices and why:

- **Skill that auto-runs, not just a command.** Skills are the auto-invoked layer; commands are developer-invoked. The critic needs to fire *inside* `icea-feature`'s flow at two gates, so it had to be a skill. A parameterized `/critic` command was added on top so the same critique is available independently for a single phase — mirroring how `/code-review` can run a phase on demand.
- **Critique before disk write, with a bounded retry loop.** Critiquing in-context code (before persistence) means a REVISE verdict regenerates the code rather than producing a `/fix` cycle afterward — cheaper and cleaner. The loop is capped at 2 retries then surfaces, so the critic can never spin indefinitely or burn tokens without developer visibility.
- **Ephemeral, not a ledger.** The critic writes no ledger and assigns no fingerprints. Persistent finding tracking already belongs to `/code-review`, `/security-review`, and `/fix`. Keeping the critic ephemeral avoids duplicating that machinery and keeps its role sharp: a gate, not a tracker.

Consent is differentiated by invocation path: the internal path and all `icea`-mode runs are **Category C** (read only the in-context artefact, the ICEA, and architecture docs — never source from disk); only `/critic code` standalone is **Category A** (the code is already on disk, so it announces scope and reads changed files, same model as `/code-review --changed`). The standalone code path reports concerns only and never rewrites files — the automatic regenerate loop is exclusive to the internal path where code is still unwritten.

#### Structural changes

- `plugin.json` — `critic` registered in both `components.commands` and `components.skills`; version → 1.15.0.
- Stub plumbing updated everywhere the validator checks it: `dream-init` (deploy loop, stub table, confirmation block), `dream-status` (check 1d loop, "all 22 exist", `N/22 stubs deployed`), and `validate.py` CANONICAL_STUBS. Total command stubs now **22**.
- `source-file-consent.md` — critic rows added (internal/icea → Category C; code standalone → Category A) across the category sections and the per-skill application table.
- `model-routing-spec.md` — `CRITIC_MODEL` documented in the review tier with its fallback chain.
- `CLAUDE.md` — routing table row added; version line → 1.15.0.
- `tests/skill-scenarios/critic.yaml` — scenarios covering both phases, the retry bound, Category A scope announcement, no-rewrite guarantee, and ephemerality.

---



## [1.14.0] — 2026-06-03

### Gap analysis C-series — 9 gaps resolved (post-v1.13.0 audit)

#### Critical

**C-01 — REGRESSION: restored HTML report write step in /security-review**
The B-01 fix in v1.13.0 inadvertently removed the explicit `node -e "fs.writeFileSync(...)"` block when consolidating the duplicate Step 2. The command had been describing the HTML report in its Confirm block but never writing it. New Step 3 ("Write the HTML report") restored with the original writeFileSync logic. Confirm renumbered to Step 4. The contract — "writes self-contained HTML report" — is honoured again.

**C-02 — Fixed structural bug in /fix Step 5 ledger update**
The previous logic only flipped `Status: Open` → `Status: Fixed` in place. The ledger format has separate `## Open Findings` and `## Fixed Findings` sections, so flipped entries remained in the wrong section, corrupting Summary counts and breaking the open-findings gates in checkin Step 5c and pr-create Step 3c. Rewrote Step 5 to: (1) extract the full FP block from Open Findings, (2) append it with Fixed metadata to Fixed Findings, (3) remove it from Open Findings, (4) update Summary count (Open -1, Fixed +1). Applies to all three ledgers.

#### High

**C-03 — Fixed validate.py CANONICAL_STUBS list**
The validator's canonical list had 19 entries — missing `ado-tasks.md` and `icea-feature.md` added in v1.12.0. Running it against v1.13.0 produced a confusing error pointing at dream-status (which was correct) when the validator itself was stale. Added the two missing entries. The N derivation (`N = len(CANONICAL_STUBS)`) now correctly checks for N/21. Validator passes clean.

**C-04 — README headline updated to reflect actual current features**
Headline had been describing v1.10 features. Rewritten to surface v1.11 (intelligent gitignore), v1.12 (persistent security/DAST ledgers, /fix multi-ledger routing), and v1.13 (scope-flags-spec v1.4 skill-local extensions).

**C-05 — Updated /fix command card description in user-guide and plugin-guide**
Both said "from code-review ledger only" — predated v1.12 multi-ledger change. Both now state /fix searches all three ledgers.

#### Medium

**C-06 — Updated user-guide stale references**
Health item line: ".gitignore — 11 required entries" → "13 required entries" (post-v1.12 includes security/ and dynamic-scan/). Checkin command card: now mentions Check D security gate.

**C-07 — Fixed explain command description contradiction**
Description said "no source file scanning" but Hard Rules state "Category B — reads ONE source file with explicit consent." Description rewritten to match the actual behaviour: "primarily from architecture docs; will optionally read ONE source file with explicit consent."

**C-08 — Added dream-status check 1o for open findings across all ledgers**
New check counts open Critical/High/Medium findings across `CodeReviews/code-review-ledger.md`, `security/security-ledger.md`, and `dynamic-scan/dynamic-scan-ledger.md`. Uses a two-pass approach: match Critical/High headings, then verify Status: Open per FP block. 🔴 Red if any open Critical, ⚠️ Amber if any open High, ✅ Green otherwise. Recommended actions include `/fix FP-xxxxxxxx` when items are open.

#### Low

**C-09 — Added skill version metadata to all 17 SKILL.md files**
Every skill now carries `_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0_` immediately after its H1 heading. Establishes a per-skill change-tracking primitive. Future skill body changes bump the skill version; future dream-status check can verify plugin/skill compatibility.

---

## [1.13.0] — 2026-06-03

### Gap analysis B-series — 12 gaps resolved (post-v1.12.0 audit)

#### Critical

**B-01 — security-review command: duplicate Step 2 removed, ledger added to confirm block**
The command had two headings labelled `## Step 2`. The leftover "Create the security
folder" step (from a prior version) was merged into the correct Step 2 and the command
renumbered to Steps 0–3. Step 3 (Confirm) now shows `security/security-ledger.md` in
the output block with FP count, manual-fix count, and `/fix` next-step guidance —
making the A-01 ledger feature visible at the point of use.

#### High

**B-02 — README, plugin-guide-v9.html, user-guide.html: model strings updated to 4-6 family**
All three doc files were excluded from the v1.14.0 mass model-string update. All 18
remaining `claude-opus-4-5` / `claude-sonnet-4-5` references updated to `4-6`.

**B-03 — checkin frontmatter description updated to mention Check D (security gate)**
Description now reads: "code-review, ICEA compliance, secrets scan, and open
security/DAST findings check (Check D)."

**B-04 — security-review frontmatter description updated to mention ledger and /fix**
Description now explains: "Writes HTML report to security/ and updates
security/security-ledger.md with FP-fingerprinted findings."

**B-05 — app-readiness now cites scope-flags-spec v1.4 in its references**
`skills/app-readiness/SKILL.md` Step 2 references section updated. Inline note
explains that `--quick` and `--full` are skill-local extensions registered in the spec.

#### Medium

**B-06 — /ado-tasks and /icea-feature added to README and plugin-guide command tables**
Both were previously documented only as auto-trigger skills. README and plugin-guide
now include explicit slash command rows with descriptions and argument hints.

**B-07 — security-ledger and dynamic-scan-ledger added to plugin-guide output table and README**
README command table, directory tree, and prose sections updated. plugin-guide output
files table updated with ledger file names and "FP-fingerprinted findings — use /fix"
annotations.

**B-08 — dynamic-scan frontmatter description updated to mention ledger and /fix**
Description now ends: "…updates dynamic-scan/dynamic-scan-ledger.md with FP-fingerprinted
source-level findings. Use /fix FP-xxxxxxxx to apply remediations."

**B-09 — scope-flags-spec v1.4: skill-local flag extensions section added**
New `§Skill-local flag extensions` table documents `--quick` and `--full` (app-readiness
variants) and `--deployment` (update-arch). Provides a formal mechanism for skills to
register non-standard flags without ambiguity. Spec version bumped 1.3→1.4. Citations
in code-review, security, and app-readiness updated to v1.4.

**B-10 — pr-create Step 3c grep replaced with heading-level match**
Previous `grep -B 5` could miss Critical findings with verbose descriptions (more than
5 lines between heading and Status field). Replaced with two-pass approach: match
`^### [FP-` headings for Critical/High, then verify `Status: Open` in the same section
using `awk` range extraction.

#### Low

**B-11 — checkin Step 5c grep replaced with consistent heading-level approach**
Same fix as B-10 applied to checkin for consistency. The previous `-B 20` approach
was safer but could still produce cross-finding false positives; heading-level matching
is unambiguous.

**B-12 — dream-rollback Hard Rules: ledger files explicitly excluded from rollback scope**
New rule: "NEVER roll back ledger files (CodeReviews/, security/, dynamic-scan/) —
these track real defects across runs. Rolling back a ledger would hide known
vulnerabilities. Use the skill's own re-scan to refresh, or /fix to resolve findings."

---

## [1.12.0] — 2026-06-03

### AI architect gap analysis — 19 gaps resolved

Full structural, governance, and observability pass across the plugin. Gaps are
numbered A-01 through A-19 as identified in the architectural review.

#### Critical gaps

**A-01 — Security skill now writes `security/security-ledger.md`**
Step 0f2 added: after generating the HTML report, the security skill writes/updates
a persistent ledger with FP-fingerprint IDs for source-fixable findings and
`manual-fix-required` for advisory findings. `/fix` can now remediate security findings.
`security/` gitignored automatically.

**A-02 — Dynamic-scan skill now writes `dynamic-scan/dynamic-scan-ledger.md`**
Section 6b added to `skills/dynamic-scan/SKILL.md`. Same contract as A-01.
`dynamic-scan/` gitignored automatically.

**A-03 — `/fix` now searches all three ledgers**
Step 2 checks `CodeReviews/code-review-ledger.md`, `security/security-ledger.md`,
and `dynamic-scan/dynamic-scan-ledger.md` in order. Handles `manual-fix-required`
status. Step 5 updates whichever ledger contained the fingerprint.

**A-04a — plugin-readiness gitignore check synced to 13 entries**
Both plugin-readiness and dream-status now check the same canonical 13-entry list
(added `security/`, `dynamic-scan/`, `.claude/settings.local.json`, `prod-readiness/`,
`.claude/architecture/`, `.claude/dream-init-state.json`). Counts updated to N/13.

**A-04b — model-routing-spec lists all skills (spec v1.2)**
`dynamic-scan` (review), `app-readiness` (infra), `plugin-readiness` (infra), `bug` (infra)
added. Spec version bumped to 1.2.

#### High gaps

**A-05 — scope-flags-spec v1.3: `--area` error contract**
Missing `domain-map.md` → warn + fall back to full scan. Unknown area name → list available
areas and stop. Citations in code-review and security updated to v1.3.

**A-06 — plugin.json shared list complete**
Five missing specs added: `domain-map-spec`, `file-cache-schema`, `model-routing-spec`,
`scope-flags-spec`, `single-writer-assumption`.

**A-07 — single-writer-assumption v1.1**
`.claude/dream-init-state.json`, `security/security-ledger.md`, and
`dynamic-scan/dynamic-scan-ledger.md` added to the files table.

**A-08 — 4 missing test scenarios added**
`tests/skill-scenarios/dream.yaml`, `dream-health.yaml`, `dream-init.yaml` (7 scenarios),
`security-review.yaml` (6 scenarios including ledger writing and fingerprint format).

**A-09 — checkin Step 5c: open security/DAST findings gate**
Checks both security and dynamic-scan ledgers for open Critical/High findings. Blocks
commit with finding list. Override: `--skip-security-gate` with written justification.
Verdict table updated with Check D column.

**A-10 — ado-tasks promoted to direct command**
`commands/ado-tasks.md` and `skills/command-stubs/ado-tasks.md` created. Added to
dream-init loop, dream-status 1d loop, plugin.json. Stub count 19→21 (with A-19).

#### Medium gaps

**A-11 — Model strings updated to claude-opus-4-6 / claude-sonnet-4-6**
All model string references across all skill files, command files, shared specs, CLAUDE.md,
DEVELOPER-GUIDE, and plugin.json updated. `last_reviewed` updated to 2026-06-03.

**A-12 — icea-feature visible advisory banner when deployment context missing**
Prominent bordered warning block inserted at top of generated ICEA. Affected ACs
marked `⚠ [deployment context missing]` inline.

**A-13 — pr-create Step 3c: open Critical findings soft gate**
Checks all three ledgers before Step 4 confirmation. Developer can acknowledge and
proceed; acknowledgement noted in PR description.

**A-14 — dream-status check 1n: sensitive gitignore skips**
Reads `gitignore_skipped_by_developer` from `dream-init-state.json`. Sensitive pattern
matches (`.env`, `appsettings.*`, `*.pem`, credential names) report ⚠️ Amber.

**A-15 — session-start surfaces sensitive gitignore skips**
Step 3 extended: one-line WARNING if sensitive file patterns were declined in dream-init.

**A-16 — scope-flags-spec is single source of truth for CI warning text**
Duplicate string removed from `single-writer-assumption.md`. Cross-reference added.

#### Low gaps

**A-17 — dream-health extraction** — deferred to next major version.

**A-18 — DEVELOPER-GUIDE: shared spec creation checklist**
New "Adding a shared spec" section with 7-item checklist. "Updating" section expanded.

**A-19 — explicit `/icea-feature` command**
`commands/icea-feature.md` and `skills/command-stubs/icea-feature.md` created as
deliberate invocation path when auto-trigger does not fire.

---

## [1.11.0] — 2026-06-03

### dream-init — intelligent .gitignore management (Step 6b)

`/dream-init` now creates or updates `.gitignore` automatically instead of suggesting entries for the developer to paste manually.

**Three-phase approach:**

- **Phase 1 (automatic)** — Plugin-required entries are always added if missing: `.claude/settings.json`, `.claude/settings.local.json`, `.claude/security-checkpoint.json`, `.claude/code-review-checkpoint.json`, `.claude/file-cache.json`, `.claude/dream-init-state.json`, `.claude/architecture/`, `memory/health.html`, `CodeReviews/`, `token-analysis/`, `prod-readiness/`.

- **Phase 2 (automatic)** — Root-level well-known artifacts (`node_modules/`, `.vs/`, `.DS_Store`, `Thumbs.db`, `*.suo`, `*.user`) are added if found on disk and not already covered.

- **Phase 3 (developer-prompted)** — A full repo `find` walk detects build artifact directories (`bin/`, `obj/`, `dist/`, `out/`, `build/`, `coverage/`, `.angular/`, `.next/`, `.nuxt/`, `__pycache__/`) and sensitive files (`.env`, `appsettings.*.json`) anywhere in the repo. Findings are consolidated into minimal patterns (e.g. three nested `bin/` directories become one `/bin/` entry), then presented as a numbered selection prompt. The developer selects which to add; declined entries are recorded in `.claude/dream-init-state.json` and never re-prompted.

- A detailed summary is displayed after each run: what was added, what was already present, and what was skipped by the developer.

**Files changed:** `commands/dream-init.md` (Step 6 tip block removed, Step 6b added, old Step 9 removed, Step 9 renumbered, summary updated, Rules updated), `skills/dream-status/SKILL.md` (1i entry list expanded to 11 entries, count updated N/11, remediation block updated).

**New file:** `.claude/dream-init-state.json` — tracks developer-declined gitignore entries so they are not re-prompted. Gitignored by Phase 1.

### scope-flags-spec citation fixes (GAP-01, GAP-02)

- `skills/code-review/SKILL.md` line 323: updated citation from `spec v1.1` to `spec v1.2`
- `skills/security/SKILL.md` line 598: updated citation from `v1.1` to `v1.2`

Both skills now correctly reference the v1.2 spec that introduced the `--ci` cache-presence warning behaviour.

---

## [1.10.0] — 2026-06-02

### New skill + command — dynamic (DAST) runtime security scanning

#### /dynamic-scan — Dynamic Application Security Testing with OWASP ZAP
The runtime counterpart to `/security-review` (static SAST). Runs OWASP ZAP against
a running web app or API via Docker, driven by the ZAP **Automation Framework** (a
single generated `zap-plan.yaml`) rather than the legacy packaged scripts. Supports
Angular SPA, ASP.NET MVC, ASP.NET Web API, Blazor, and Razor Pages targets, plus
npm / pip / NuGet dependency auditing.

Key behaviours:
- **Safe by default** — the no-flag run is a passive baseline scan plus a dependency
  audit (no attack payloads). Active scanning (`--full`, `--scope`) requires an
  explicit not-production + authorised confirmation.
- **Correct ZAP image** — uses `ghcr.io/zaproxy/zaproxy:stable` (and `:bare` for CI);
  the retired `owasp/zap2docker-stable` name is never used.
- **localhost + HTTPS handling** — rewrites `localhost` to `host.docker.internal`
  and accepts self-signed dev certs for local IIS / `dotnet run` targets.
- **Authentication verification gate** — for authenticated scans, checks ZAP's
  `stats.auth.state.loggedin` statistic before scanning and stops if login failed,
  preventing silent garbage reports.
- **Windows Auth honesty** — flags NTLM/Negotiate as unreliable headless in Docker
  and routes to the Desktop-GUI-test-then-export path instead of overpromising.
- **Route seeding** — extracts Angular and ASP.NET routes from source to cover
  endpoints the spider misses; imports OpenAPI/Swagger for full API coverage.
- **Baseline tuning, run-to-run diff, business-context severity, and source-mapped
  fixes** — findings are rated with the shared B1–B7 overrides and mapped back to
  the responsible `.cs`/`.ts` file (Category B consent) with a concrete fix.
- **CI support** — `--ci` and `--fail-on <severity>` via ZAP's `exitStatus` job.

Deferred to a future release (stated, not silently missing): WebSocket/SignalR
message fuzzing, headless OAuth/Azure AD without a manual browser step.

#### Plugin wiring
- Registered `dynamic-scan` in `plugin.json` (commands 18→19, skills 16→17).
- Added the `dynamic-scan.md` command stub to `dream-init` deployment and the
  `dream-status` stub check (now `N/19 stubs deployed`).
- Added a Category A row for `/dynamic-scan` to `source-file-consent.md`.
- Added a test scenario (`tests/skill-scenarios/dynamic-scan.yaml`) and the stub to
  the structural validator's canonical list.

---

## [1.9.0] — 2026-06-01

### Two new readiness commands — production go-live assessment

#### /app-readiness — Application production readiness assessment
Enterprise Architect and Solution Architect review across 8 domains: deployment
pipeline, resilience, observability, security posture, scalability, data integrity,
operational runbook, and test coverage. Reads deployment context from
`architecture-deployment.md`, queries ADO for pipeline state, and applies the
correct checklist for the hosting model (IIS / container / App Service). Produces
an HTML report. Supports `--quick` (no source reads) and `--full` (consent-gated
source reads for Red domains) modes.

#### /plugin-readiness — Plugin production readiness assessment
AI Architect review of the Claude Code plugin itself across 6 domains:
infrastructure health, model routing, memory health, governance rails, skill
quality, and session budget. Reads plugin state files only — no application
source reads. Produces an HTML report with a maturity score (1–5) per domain
and a go / conditionally-ready / not-ready / blocked verdict.

---

## [1.8.0] — 2026-06-01

### Architect skill enhancements — deployment context and domain-map v1.1

#### architect Step 0.5 — Deployment questionnaire
The architect skill now runs a deployment context questionnaire before populating
architecture templates. Detects CI/CD pipeline files, IIS publish profiles, Docker
configuration, and Entra ID / MSAL signals automatically, then asks only the
questions the filesystem cannot answer. Writes the answers to
`.claude/architecture/architecture-deployment.md`. Required by `app-readiness`.

#### domain-map.md v1.1 — SHA-1 fingerprint staleness detection
`domain-map.md` now carries a `_Fingerprint:` line — a SHA-1 hash of all
entry-point files. `icea-feature`, `icea-review`, and `update-arch` compare the
stored fingerprint against current entry-point file hashes to detect structural
drift without a full re-scan. Maps generated before v1.8 (no `_Fingerprint:` line)
are treated as potentially stale and trigger a warning.

#### Shared spec additions
- `source-file-consent.md` — consent categories (A/B/C) and gate format for all
  skills that read source files
- `business-context-severity.md` — B1–B7 business severity override triggers for
  the project's immigration and attorney-client privileged data context

---

## [1.7.0] — 2026-06-01

### Six new commands — developer workflow and token efficiency

#### /session-start — Zero-cost session context warm-up
Reads CLAUDE.md, memory files, and architecture docs in one pass and prints a
20-line session brief: stack, ADO project, last decision, last error resolved,
active domain areas, and sessions since last /dream. Replaces manual context
re-establishment at the start of every session. Also surfaces any ❌ Red
dream-status items without running the full health check. Estimated saving:
500–2,000 tokens per session.

#### /bug — Lightweight bug fix flow (ICEA-lite)
Targeted alternative to the full ICEA gate for confirmed defects on existing
behaviour. Produces a one-screen Root Cause / Fix Approach / Regression Test spec
with a single approval cycle, then applies the fix. Saves the spec to
docs/icea/ADO-{ID}-bug.md for traceability. Redirects to icea-feature if the
bug requires new design. Estimated saving: 3,000–4,000 tokens vs full ICEA for
simple bugs.

#### /checkin — Pre-commit quality gate
Runs code-review --changed, ICEA compliance check, and secrets scan in a single
shared-context pass. Produces one unified pass/fail verdict. If all checks pass,
outputs a pre-filled git commit command with the ADO ID. Blocks on Critical/High
findings, missing ICEA ACs, or staged secrets. Replaces the manual three-command
sequence developers skip under time pressure.

#### /update-arch — Targeted architecture doc refresh
Refreshes domain-map.md and architecture.md for only the areas whose entry-point
files have changed since the last fingerprint. Reads 2–5 files instead of the
full codebase. Optional path argument to scope to a specific subtree. Use after
adding a service, moving a module, or when dream-status shows domain-map ⚠ Amber.
Estimated token saving: 85–90% vs full architect skill re-run.

#### /explain — Codebase Q&A without source scanning
Answers structural questions (how does X work, where is Y) using only
.claude/architecture/ docs. Provides HIGH/MEDIUM/LOW confidence grading.
For HIGH: answers immediately. For MEDIUM: identifies the one file that
would clarify and asks before reading. For LOW: names the 1–2 most relevant
files and lets the developer decide. Never scans src/ unprompted.

#### /fix — Apply a code-review finding directly
Takes a fingerprint ID (FP-xxxxxxxx) from the code-review ledger, displays the
finding and its fix, waits for explicit confirmation, then applies the fix with
str_replace and marks the finding as Fixed in the ledger. No re-analysis
required — the fix was already computed by /code-review.

#### Security skill — find command formatting fix
The find command in Step 0c was collapsed to a single line during a previous edit,
which could cause shell parsing issues. Reformatted with proper line continuations.
Added a ⚠️ hard rule box at the top of Step 0c: scan root is always `.`, never `./src`.

## [1.6.0] — 2026-06-01

### Architecture hardening — 6 fixes from AI Architect review

#### Fix 1 — domain-map staleness: entry-point file fingerprint (`skills/shared/domain-map-spec.md`)
The 7-day structural-change check only detected added/renamed/deleted files, not changes
to existing entry-point files. Added a SHA-1 `_Fingerprint:` field (written by architect,
verified by icea-feature and icea-review) that hashes all listed entry-point files at
generation time. Readers compare against a fresh hash and warn if the files have changed.
Spec bumped to v1.1.

#### Fix 2 — CI safety: `--ci` flag (`skills/shared/scope-flags-spec.md`, `single-writer-assumption.md`)
Added a `--ci` flag as an alias for `--full` that additionally warns if a cache file is
found on disk (signals a misconfigured pipeline restoring or committing cache artifacts).
Updated single-writer-assumption to recommend `--ci` for all CI/CD invocations.
Scope-flags spec bumped to v1.1.

#### Fix 3 — Model version hygiene (`plugin.json`, `skills/dream-status/SKILL.md`)
Added `recommended_models` block to `plugin.json` with `generation`, `review`,
`last_reviewed`, and `review_cadence_days` fields. Added check `1l` in `dream-status`
that warns when `last_reviewed` is older than `review_cadence_days` (default: 90 days),
prompting the team to review Anthropic's release notes and update defaults.

#### Fix 4 — PAT security posture (`skills/pr-create/SKILL.md`)
Clarified PAT storage options with an explicit preference ordering (Windows User
Environment Variable > settings.json > interactive prompt). Added explicit post-Step-5
scrub instruction: the PAT variable must not be referenced after the API call completes.
Prompt now recommends Option A and cites dream-status credential-leak warning.

#### Fix 5 — Dream token-budget guard (`commands/dream.md`)
Added a pre-flight check in Phase 0 that measures MEMORY.md line count, topic file
count, and estimated session window size before searching. Soft warnings for large
memory or topic file counts; hard stop if estimated combined context exceeds 80K tokens.
Recommends narrowing the keyword search or archiving topic files before retrying.

#### Fix 6 — Dream rollback visibility (`skills/dream-status/SKILL.md`)
Added check `1j` that compares the most recent `dream-rollback` log entry against the
most recent `dream` log entry. Warns (⚠️ Amber) if a rollback occurred after the last
consolidation, prompting the developer to re-run `/dream`. This surfaces the previously
invisible state where memory was manually reverted but no re-consolidation followed.
Status report now has 12 checks (was 10).


## [1.5.10] — 2026-06-01

### Generic constraint — Do not assume; ask when vague or complex

Added a standing **Do not assume** rule to both `rules/project-rules.md` and `CLAUDE.md`.
The existing "stop and ask rather than assume" line in `project-rules.md` was scoped only
to uncertainty about scope. This change adds a broader generic constraint covering any
vague, ambiguous, or multi-interpretation situation across all contexts.

**`rules/project-rules.md`** — New bullet in Scope control.
**`CLAUDE.md`** — New bullet in Section 3 Design Philosophy.
No other files changed. Simplicity/readability/maintainability/testability were already
fully present in both files — not duplicated.

## [1.5.9] — 2026-06-01

### Design philosophy — Decision transparency for complex logic

Added **decision transparency** as a first-class design philosophy across the plugin.
The principle: for any complex logic or non-trivial design choice, document the decision
inline listing options considered, reasons each alternative was rejected, and why the
chosen approach was selected.

#### Changes across 4 files:

**`rules/project-rules.md`** — New bullet added to Design philosophy section with full
inline format specification and a TypeScript example showing filter state storage decision.

**`CLAUDE.md`** — New bullet added to Section 3 Design Philosophy with condensed format
and the trigger criteria (apply when: algorithm, data structure, pattern, or architectural
call not immediately obvious; skip for trivial choices).

**`skills/icea-feature/SKILL.md`** — New sub-section added to Step 6 (Post-Approval:
Generate Artefacts). During implementation generation, any complex logic encountered must
be preceded by a `// DECISION:` block. Includes a C# example for reactive filter-update
stream selection (lock vs event bus vs Subject with distinctUntilChanged).

**`skills/code-review/SKILL.md`** — New checker category `2k` added:
`MISSING_DECISION_COMMENT`. Flags complex logic blocks (non-obvious algorithm, specific
data structure choice, pattern selection, constraint-driven workaround) that lack a
preceding `// DECISION:` comment. Rated Low severity. Added to the severity calibration
table in Section 4 Analysis Rules. Does not flag trivial or standard CRUD patterns.

#### Decision comment format (canonical):
```
// DECISION: <what is being decided>
// Options considered:
//   A) <option> — rejected: <reason>
//   B) <option> — rejected: <reason>
//   C) <chosen option> — chosen: <reason>
```

## [1.5.8] — 2026-05-31

### Global constraint — simplicity, readability, maintainability, testability

Added "Design philosophy" section to `rules/project-rules.md` (applies to all files)
and `CLAUDE.md` (always in context):

- Simplicity first — prefer the simplest correct solution; complexity without a concrete
  requirement is a defect
- Readability — optimise for the reader, not the writer
- Maintainability — explicit and self-contained over clever abstractions
- Testability — no hidden side effects, no global state, no deep coupling


## [1.5.7] — 2026-05-31

### Security skill — complete gap-fill from built-in Claude review comparison

Full diff of ProBono2 built-in output (14 findings) vs plugin output (14 findings, 
different set). 8 patterns present in the built-in were missing from the plugin checklist.
All 8 added to `security/SKILL.md` appsec checklist and `references/language-notes.md`.

#### 8 patterns added to appsec checklist:

1. **Unsafe JSON.parse of localStorage / untrusted data (CWE-20)** — pattern:
   `JSON.parse(localStorage.getItem(...))` with no try/catch. Throws on corrupt data,
   crashes app with no user-facing error. Fix: typed fallback wrapper.

2. **Unsafe deserialization into framework APIs (CWE-502)** — pattern:
   parsed JSON applied directly to AG Grid `applyColumnState()`, `setFilterModel()`,
   Angular `patchValue()` etc. without schema validation. Malicious saved view can
   affect all users. Fix: validate object shape before applying.

3. **window.prompt / native dialogs sending unsanitized input to backend (CWE-20)** —
   pattern: `prompt()` return value trimmed but not sanitized before POST body.
   Stored injection vector + blockable by enterprise browser policy. Fix: Angular modal.

4. **Direct DOM manipulation bypassing Angular security context (CWE-749)** — pattern:
   `document.querySelector()`, `.innerHTML` assignment, `.nativeElement.style` bypassing
   Renderer2. Fix: `@ViewChild` + Renderer2 or template bindings.

5. **Unscoped data export — full dataset ignores active filters (CWE-359)** — pattern:
   export iterates `this.rowData` instead of `gridApi.forEachNodeAfterFilterAndSort()`.
   Exports records user should not see based on filters. Also: no audit log of exports.

6. **No audit logging for sensitive data access or mutations (CWE-778)** — pattern:
   HTTP GETs/POSTs against PII/legal/financial data with no backend structured logging.
   Flag Informational/Low; escalate to Medium if compliance framework applies.

7. **No rate limiting on data-heavy endpoints (CWE-400)** — pattern: preloads all tabs
   on startup, re-fetches on every tab switch, no Cache-Control or ETag. Flag Info.

8. **console.error with full error objects in production (CWE-209)** — pattern:
   `console.error('msg', err)` exposes URLs, headers, body in browser DevTools.
   Fix: remove; use toast/error service; backend logs errors server-side.

#### Angular-specific section added to `references/language-notes.md`:
All 8 patterns plus HttpClient missing auth interceptor and missing CSP, with
Angular-specific code examples and fix guidance. Loaded when Angular is detected.


## [1.5.6] — 2026-05-31

### Security skill — IDOR detection patterns

**Problem:** "Username in URL path (IDOR risk)" was missed because the skill had
`IDOR / broken access control` as a single checklist bullet with no concrete code
patterns to look for. The category was known; the detection was not.

**Fix — three specific IDOR patterns added to the appsec checklist:**

1. **User identity in URL path or query parameter** — flags any route where a username,
   userId, or accountId comes from the client (URL param, query string, request body)
   rather than from the server-side authenticated session. Covers the exact Angular
   pattern `this.http.get(\`/api/views/\${this.currentUsername}\`)` that was missed.

2. **Object ID in URL with no visible ownership check** — flags numeric or opaque IDs
   in URL paths where the backend may not re-verify the authenticated user's ownership
   of the resource.

3. **/whoami used as auth substitute** — flags the pattern where an app calls a
   `/whoami` or `/me` endpoint to discover identity and then uses that value to scope
   data client-side, while API endpoints don't enforce ownership server-side. This is
   exactly what was missed in the ProBono2 scan.

Each pattern includes the specific Angular/TypeScript code to look for, not just the
category name. Title guidance reinforced: "Username in URL path", not "IDOR via
username parameter".


## [1.5.5] — 2026-05-31

### Security skill — plain-language descriptions and targeted remediation

**Problem:** Titles were taxonomy labels; descriptions were generic OWASP category
summaries with no reference to the actual code. Example:
- Bad title: "No HTTP Request Authentication — Identity Relies Solely on /whoami"
- Bad description: "The application lacks proper authentication mechanisms, exposing
  sensitive data per OWASP A07. Implement appropriate session management controls."

The built-in Claude writes plain prose that names the actual file, variable, and
consequence — and gives code-specific remediation, not generic advice.

**Fix — `security/SKILL.md` §2a completely rewritten:**

1. Writing style guide added covering both titles AND descriptions:
   - Titles: plain English ≤6 words, no taxonomy, CWE/OWASP in metadata only
   - Descriptions: must name actual file/function, explain what the code IS DOING,
     why it's dangerous, and who is affected — not a category description
   - Remediation: must name the exact file/function to change with corrected code;
     generic OWASP advice with no code-specific detail not acceptable

2. Side-by-side good/bad examples for both title and description:
   - Good: "No authentication or authorization" + prose explaining /whoami is
     identification not authentication, naming the consequence (anyone with network
     access reads all matter/client/immigration data), naming the fix (NTLM/Kerberos,
     withCredentials: true)
   - Bad: the previous plugin output style shown explicitly so the skill knows to avoid it

3. Hard Rules section updated with two rules:
   - Plain titles rule (retained from v1.5.4)
   - Specific descriptions rule (new): generic OWASP advice with no code-specific
     detail is explicitly prohibited


## [1.5.4] — 2026-05-31

### Security skill — plain-language finding titles

**Problem:** Plugin titles were over-engineered taxonomy labels
(e.g. "No HTTP Request Authentication — Identity Relies Solely on /whoami")
rather than plain descriptions a developer immediately understands
(e.g. "No authentication or authorization").

**Fix — three changes to `security/SKILL.md`:**

1. Added explicit "Finding title convention" section to the vulnerability report format (§2a)
   with ✅ good examples (matching Claude built-in style) and ❌ bad examples to avoid.
   Rule: if the title needs more than 6 words it's probably a description, not a title.
   CWE/OWASP taxonomy belongs in metadata fields, not the title.

2. Added plain-title rule to Hard Rules:
   "Every finding title must be plain English a developer immediately understands.
   Ask: could a non-security developer read this title and instantly know what's wrong?
   If not, rewrite it."

3. Good title reference examples added:
   "No authentication or authorization", "Real client PII in public directory",
   "All traffic is plaintext HTTP", "Stored XSS via unsanitized cell renderer",
   "No CSRF protection on mutating endpoints", "Hardcoded internal server hostname"


## [1.5.3] — 2026-05-31

### Security skill — three gaps fixed after comparing output with Claude built-in

**Root cause analysis:**
The plugin security skill missed `public/data.json` (real PII, Critical) and the
incomplete `.gitignore` finding that Claude's built-in review caught. Three fixes:

#### Fix 1 — Scope broadened beyond `src/`
Step 0a now explicitly scans `public/`, `static/`, `assets/`, `wwwroot/`, `dist/`
in addition to `src/`. Any data file (`.json`, `.csv`, `.xml`, `.db`, `.sql`) found
in a public-serving directory is flagged as a Critical candidate immediately before
other files are scanned.

#### Fix 2 — Critical severity threshold made explicit
Added a "CRITICAL severity — when to use it" section to the output format spec.
PII or confidential data in any publicly accessible path is Critical regardless of
assumed access controls or "internal app" context. Prevents downgrading to High
based on network access assumptions.

#### Fix 3 — Mandatory .gitignore coverage check (Step 0g)
New step runs on every scan regardless of scope flags. Checks whether sensitive
files that exist on disk (`.env`, `appsettings.json`, `.claude/settings.json`, etc.)
are covered by `.gitignore`. Reports each uncovered sensitive file as a Low+ finding
with exact fix. Catches the class of issue Claude's built-in found but the plugin missed.


## [1.5.2] — 2026-05-31

### Model routing — generation vs review tiers

#### New: skills/shared/model-routing-spec.md
- Canonical specification for model routing across the plugin
- Defines generation tier (`ICEA_MODEL`, default `claude-opus-4-5`) and review tier
  (`REVIEW_MODEL`, default `claude-sonnet-4-5`)
- Documents rationale, override instructions, and skill membership for each tier
- Added to `skills/shared/README.md`

#### Generation-tier skills updated
Skills now document their model tier and env var at the top of SKILL.md:
- `icea-feature`, `ado-tasks`, `pr-describe`, `product-docs` → `ICEA_MODEL`

#### Review-tier skills updated
- `icea-review`, `code-review`, `security`, `pr-spec-review`, `pr-create` → `REVIEW_MODEL`

#### CLAUDE.md
- Added Section 3: Model Routing — env var table and `.claude/settings.json` example

#### README.md
- Added "Model routing" section with routing table, rationale, and override instructions

#### Plugin guide (HTML)
- Added Model Routing section before Token Efficiency
- Sidebar nav updated with model routing link


## [1.5.1] — 2026-05-31

### Bug fixes

#### security skill — checkpoint/resume on connection drop
- Added **Step 0f** to `security/SKILL.md`: writes `.claude/security-checkpoint.json`
  before scanning begins; updates it after every file scanned
- On next run after a connection drop: detects the checkpoint, shows how many files
  were completed vs remaining, and offers to resume from where it stopped rather than
  restarting the full scan
- Checkpoint deleted automatically on successful completion
- `.claude/security-checkpoint.json` added to `.gitignore` and `dream-status` coverage

#### code-review skill — same checkpoint pattern
- Added **Step 0f** to `code-review/SKILL.md`: identical checkpoint/resume behaviour
  using `.claude/code-review-checkpoint.json`

#### install scripts — rollback on failure
- `install.ps1` and `install.sh`: if `claude plugin install` fails, scripts now
  automatically run `plugin uninstall`, remove the marketplace registration, delete
  plugin files, and exit with code 1 — never print "installed successfully" on failure
- Cache-clearing step retained from v1.5.0


## [1.5.0] — 2026-05-30

### Round 3 architect review — all criticals, gaps, and recommendations implemented

#### Critical fixes
- **Critical 1 & 2**: Fixed stale inline path references in `code-review` and `security`
  skills — both Step 0e inline instructions now correctly reference
  `../shared/file-cache-schema.md` instead of the non-existent `references/file-cache-schema.md`
- **Critical 3**: Added `.claude/settings.json` and `.claude/settings.local.json` to
  `.gitignore`; added PAT credential warning to `dream-init` gitignore suggestion block

#### Gap fixes
- **Gap 1**: Added lightweight "Codebase Orientation" step to `pr-describe`, `pr-spec-review`,
  and `ado-tasks` — reads `domain-map.md` if present; staleness check; non-blocking
- **Gap 2**: Updated `install.ps1` and `install.sh` to v1.5.0; added `dream-status`,
  `dream-rollback`, and all new commands to post-install messaging
- **Gap 3**: Normalised all `plugin.json` command paths to bare names (`dream`, `dream-health`,
  etc.) — removed legacy `dream/` prefix that referenced a non-existent subdirectory
- **Gap 4**: Deleted orphaned `skills/code-review/references/file-cache-schema.md`
- **Gap 5**: `dream-status` Step 1i now checks `.claude/settings.json` gitignore coverage;
  missing settings.json protection → ❌ Red (credential risk); updated entry count 5→6

#### Recommendations implemented
- **Rec 1 — Test harness**: Added `tests/` folder with `runner.js` (Anthropic API),
  `README.md`, and 4 scenario files: `icea-feature.yaml` (6 scenarios), `code-review.yaml`
  (5 scenarios), `pr-create.yaml` (5 scenarios), `dream-status.yaml` (3 scenarios).
  Run with `node tests/runner.js`. `tests/results/` gitignored.
- **Rec 2 — Versioned shared specs**: All 4 files in `skills/shared/` now carry
  `_Spec version: 1.0 · Last changed: 2026-05-30_` headers. Reference entries in
  `code-review` and `security` skills annotated with `(spec v1.0)`.
- **Rec 3 — Plugin telemetry**: Added Step 4b to `token-analysis` skill — extracts
  plugin skill invocations per session, aggregates into `graph.skillUsage`, reports
  "Skill Usage" table in HTML output (Active / Occasional / Never used). Added Step 1j
  to `dream-status` — reads `skillUsage` from token-graph and surfaces top skills and
  never-used candidates.
- **Rec 4 — dream-rollback**: New `skills/dream-rollback/SKILL.md` — reads
  `memory/dream-log.md`, lists run history, shows before/after for each operation,
  confirms before reversing, logs the rollback as a new auditable entry.
  New `commands/dream-rollback.md` slash command and `command-stubs/dream-rollback.md` stub.
  Registered in `plugin.json`. Added to `dream-init` stub deploy loop.


## [1.4.0] — 2026-05-30

### Architectural recommendations — all 4 implemented

#### Rec 1 — skills/shared/ folder formalised as cross-skill primitive layer
- Added `skills/shared/README.md` — establishes ownership rules: a file belongs
  here only when two or more skills share the same artefact; shared specs are the
  single source of truth; reference via `../shared/<file>` relative path
- Added `skills/shared/scope-flags-spec.md` — canonical definition of `--changed`,
  `--pr`, `--full` flags including precedence rules, scope report format, and
  command-to-skill passthrough contract; referenced by `code-review` and `security`
- Added `skills/shared/domain-map-spec.md` — full schema, authoring rules (architect),
  reading rules (icea-feature, icea-review), staleness definition, and single-writer
  contract; referenced by `architect`, `icea-feature`, `icea-review`
- Updated `architect`, `icea-feature`, `icea-review`, `code-review`, `security`
  reference tables to point to shared specs

#### Rec 2 — /dream-status command (new)
- Added `skills/dream-status/SKILL.md` — read-only health check for all 9 infrastructure
  items: CLAUDE.md, memory/, .claude/rules/, .claude/commands/ stubs, .claude/architecture/,
  domain-map.md (with freshness), file-cache.json, token-graph.json, .gitignore coverage
- Computes overall ✅ / ⚠️ / ❌ status and emits prioritised action list for any
  amber/red items
- Added `commands/dream-status.md` slash command
- Added `skills/command-stubs/dream-status.md` stub for VS Code visibility
- Registered in `plugin.json`; added to `dream-init` stub deploy loop

#### Rec 3 — pr-create auto-runs icea-review before confirmation
- Added Step 3b to `pr-create` skill: runs `icea-review` against the current diff
  automatically before showing the PR confirmation prompt
- On ✅ READY FOR REVIEW: proceeds to confirmation with compliance badge
- On ⚠️ NEEDS WORK: shows warnings in confirmation; developer can proceed or fix first
- On ❌ BLOCKED: halts PR creation entirely; shows block reason and required action
- Override available via `--skip-icea-check`; override noted in PR description
- Updated Hard Rules: NEVER create a PR if icea-review returns BLOCKED

#### Rec 4 — Single-writer assumption documented
- Added `skills/shared/single-writer-assumption.md` — documents which files have
  single-writer constraints, why it is safe today, where it breaks (shared FS, CI/CD
  parallel runs), the last-write-wins behaviour on concurrent writes, the gitignore
  mitigation, and a future file-locking path
- Added single-writer notes to `code-review`, `security`, and `token-analysis` skills
  at the cache-write steps with reference to the shared spec


## [1.3.3] — 2026-05-30

### Architect review fixes — all 10 issues and gaps resolved

#### Issues fixed
- **Issue 1** `security-review` command: added Step 0 to parse and forward `--changed`,
  `--pr`, `--full` scope flags to the security skill's Step 0b before invocation
- **Issue 2** `dream-init`: reordered steps so `file-cache.json` is seeded (new Step 6)
  *before* the architect skill runs (now Step 7) — infrastructure before dependents
- **Issue 3** `sprint-metrics`: created `commands/sprint-metrics.md` slash command;
  registered in `plugin.json` components.commands; stub added to `command-stubs/`

#### Gaps fixed
- **Gap 1** Created missing command stubs: `skills/command-stubs/dream-init.md`,
  `product-docs.md`, `sprint-metrics.md`; added all three to `dream-init` deploy step
  and confirmation summary
- **Gap 2** `domain-map.md` added to `.gitignore`
- **Gap 3** Moved `file-cache-schema.md` to new `skills/shared/` folder; updated
  reference paths in `code-review` and `security` skills to `../shared/file-cache-schema.md`
- **Gap 4** `plugin.json` version bumped to `1.3.3` (was incorrectly reset to `1.2.0`)
- **Gap 5** Added "Codebase Orientation" step to `icea-review` (same pattern as
  `icea-feature` — reads `architecture.md` and `domain-map.md` before diff analysis)
- **Gap 6** Added domain-map staleness check to both `icea-feature` and `icea-review`
  orientation steps — warns developer if map is >7 days older than last structural
  git change; non-blocking
- **Gap 7** `CodeReviews/` added to `.gitignore`

#### .gitignore
Consolidated all generated-file entries into a single annotated block:
`.claude/file-cache.json`, `domain-map.md`, `CodeReviews/`, `token-analysis/`,
`memory/health.html`

#### dream-init
- Stub deploy loop updated to include all 8 stubs
- Gitignore suggestion block updated to cover all generated files


## [1.2.0] — 2026-05-30

### Token Efficiency Architecture — All 6 items from architect review

#### architect skill (updated)
- Added **Step 7: Generate domain-map.md** — produces a lightweight feature-area
  index after populating architecture docs
- domain-map.md maps each feature area to its entry point and key files without
  reading source file contents
- Used by icea-feature, code-review, and security to orient without cold-start scans

#### icea-feature skill (updated)
- Added **Codebase Orientation** step before Step 1 — reads `.claude/architecture/architecture.md`
  and `domain-map.md` instead of scanning raw source files
- Falls back gracefully if neither file exists (prompts developer to run dream-init)
- Reduces token cost 80–95% per ICEA invocation on oriented projects

#### file-cache.json schema (new)
- Added `skills/code-review/references/file-cache-schema.md` — canonical schema,
  field definitions, read/write protocol, and merge rules for the shared cache
- Shared by code-review and security skills

#### code-review skill (updated)
- Added **Step 0: Cache-Aware File Selection** before analysis
- Supports scope flags: `--changed`, `--pr`, `--full`
- Default mode: cache-aware full-project scan (skip unchanged files)
- Reports scope summary before scanning (N changed, M skipped)
- Updates file-cache.json after every run

#### security skill (updated)
- Added **Step 0: Scope & Cache-Aware File Selection** before analysis
- Added **language detection** step — loads only reference sections for
  languages present in the codebase (lazy loading)
- Supports same scope flags as code-review: `--changed`, `--pr`, `--full`
- Updates file-cache.json after every run, merging with code-review entries

#### security-review command (updated)
- Added scope flag documentation to argument-hint
- Flags passed through to security skill: `--changed | --pr | --full`

#### dream-init command (updated)
- Added **Step 7b: Seed .claude/file-cache.json** — empty cache created at
  project initialization so code-review and security have a valid file on first run
- Added .gitignore suggestion for `.claude/file-cache.json`
- Updated confirmation summary to show file-cache.json in created files list

# Changelog

## [1.3.2] — token-graph.json cache, token-analysis/ output folder

### Added
- `skills/token-analysis/references/graph-schema.md` — full schema reference for
  `token-analysis/token-graph.json`. Documents every field, the empty seed template,
  and the delta detection rules (charCountAsHash for files, session ID lookup for
  sessions, trigger condition re-evaluation for recommendations).

### Changed
- `skills/token-analysis/SKILL.md` — fully rewritten around the persistent graph cache.
  Step 1 loads the graph (or initialises empty state on first run). Steps 2–5 are all
  delta-aware: files are only re-measured if their character count changed; sessions
  already in the graph are skipped entirely; aggregates only recomputed when new data
  exists. Step 7 writes the updated graph before generating the report. Subsequent runs
  where nothing changed jump directly to report generation from cache.
- `commands/token-analysis.md` — output path moved from project root to
  `token-analysis/token-analysis-<date>.html`. Gitignore entry changed from
  `token-analysis-*.html` to `token-analysis/` (covers both graph and reports).
  Confirmation output now shows new vs cached session counts and confirms graph update.
- `commands/dream-init.md` — added Step 7 which creates `token-analysis/` and seeds
  an empty `token-graph.json`. Suggests adding `token-analysis/` to `.gitignore`.
  Structure diagram updated. Summary block updated. Final step renumbered to 9.
- `skills/command-stubs/token-analysis.md` — description updated to mention
  `token-analysis/` output folder.
- `README.md` — token-analysis command description updated. Project-scoped table
  gains `token-analysis/` row. Repo structure tree gains `graph-schema.md`.
- `plugin.json` — version bumped to `1.3.2`.

## [1.3.1] — global command stubs for Claude Code VS Code visibility

### Added
- `skills/command-stubs/` — five thin stub files (dream.md, dream-health.md,
  security-review.md, code-review.md, token-analysis.md). Each is 10 lines:
  frontmatter description + argument-hint + skill reference. All logic stays
  in the plugin; the stubs exist solely to make global commands visible in
  Claude Code's VS Code slash command picker.

### Changed
- `commands/dream-init.md` — added Step 3 which deploys all five command stubs
  to `.claude/commands/` in the project (skips any already present). Renumbered
  subsequent steps 3–7 to 4–8. Updated "What this command does" structure diagram
  and summary block to show `.claude/commands/` alongside rules and architecture.
- `README.md` — dream-init description updated. Project-scoped table gains
  `.claude/commands/` row. Repo structure tree gains `command-stubs/` folder.
- `plugin.json` — version bumped to `1.3.1`.

## [1.3.0] — token-analysis command and global/project-scoped classification

### Added
- `commands/token-analysis.md` — global slash command `/ai-assisted-development:token-analysis`.
  Accepts optional `sessions=N` argument (default 10). Writes a self-contained HTML report
  to `token-analysis-<date>.html` in the project root and adds `token-analysis-*.html`
  to `.gitignore` automatically.
- `skills/token-analysis/SKILL.md` — three-pass analysis orchestrator: (1) static audit
  of fixed session overhead from CLAUDE.md, rules, architecture docs and plugin skills;
  (2) session analysis reading last N sessions via `recent_chats` and `conversation_search`,
  measuring estimated tokens, turn counts, skill invocations, file reads, and prompt type
  classification (efficient / vague / redundant / multi-task / correction);
  (3) recommendations engine that applies only rules triggered by actual findings.
  Prompt rewrite section surfaces the highest-cost prompts with rewritten alternatives.
  Trend section compares first vs second half of the session window.
- `skills/token-analysis/references/recommendations.md` — 13-entry recommendation
  catalogue covering static overhead (REC-S01–S05), session patterns (REC-P01–P07),
  and structural improvements (REC-T01–T03). Each entry has trigger condition,
  saving estimate (Low/Medium/High), specific action, and priority level.
- `skills/token-analysis/references/report-template.md` — self-contained HTML report
  template matching the ProductOverview design language. Sections: fixed overhead table
  with RAG status, session token chart, skill/file usage tables, prompt type distribution,
  expensive operations ranking, prompt rewrite cards, prioritised recommendations, trend table.

### Changed
- `README.md` — added `token-analysis` to commands table. Added new
  "Global vs project-scoped components" section that formally classifies every
  plugin component as Global, Project-scoped, or Hybrid with tables for each.
  Repo structure tree updated with token-analysis files.
- `plugin.json` — version bumped to `1.3.0`.

## [1.2.0] — architect skill and architecture docs

### Added
- `skills/architect/SKILL.md` — orchestrator skill that detects repo type,
  deploys matching architecture templates to `.claude/architecture/`, checks
  which files already have real content (skips them), and populates only the
  missing ones. File 1 and File 2 run in parallel; File 3 runs after for
  thorough analysis. Supports 7 repo types: dotnet-api, angular-nx,
  angular-standard, react, js-library, aspnet-framework, aspnet-mvc.
- `skills/architect/prompts/` — 7 per-repo-type prompt files with tailored
  instructions for each of the three architecture files. Each prompt specifies
  exactly what source files to read and what to extract, with explicit fallback
  markers for sections that cannot be determined from code.
- `skills/architect/templates/` — 7 sets of empty scaffolding files
  (architecture.md, architecture-flows/callchains/api.md, architecture-reference.md)
  with `<!-- TEMPLATE -->` marker for population-state detection.

### Changed
- `commands/dream-init.md` — added Step 5 which invokes the architect skill
  after deploying rules. Updated What this command does section and summary
  block to include `.claude/architecture/`. Renumbered subsequent steps.
- `README.md` — dream-init description updated. Repo structure tree updated
  to include architect skill and templates.

## [1.1.0] — project-rules, CLAUDE.md redesign, dream-init overhaul

### Added
- `rules/project-rules.md` — universal guardrail rule scoped to `**/*`. Enforces scope
  control (no unsolicited architectural changes, no unvetted third-party libraries, flag
  before touching `.gitignore`/CI/auth), and code quality standards (no debug logging in
  production, no hardcoded secrets, no `TODO` without an ADO item, no `any` in TypeScript).
  Deployed to `.claude/rules/` by `/dream-init` alongside the stack-specific rules.

### Changed
- `CLAUDE.md` — removed the Guardrails section entirely (those rules now live in
  `project-rules.md`). Sections renumbered. Now contains only project facts that no rule
  file can infer: project overview, ADO coordinates (org, project, repo, branch/commit/PR
  naming conventions), auto-capture rules, and Dream rules.
- `commands/dream-init.md` — overhauled CLAUDE.md handling. Previous behaviour skipped
  the file entirely if it already existed. New behaviour: if CLAUDE.md is absent, offer to
  create it from the template (unchanged); if it already exists, scan for the AUTO-CAPTURE
  and DREAM RULES markers and **append only the missing sections** — existing project
  content is never touched. This ensures every project gets Dream infrastructure regardless
  of whether CLAUDE.md was pre-existing. Also deploys `project-rules.md` as part of Step 3.
  Summary block now prompts the developer to fill in the Repository field in CLAUDE.md.
- `plugin.json` — author updated to `Product Engineering`. Version bumped to `1.1.0`.
- `README.md` — rules table updated to include `project-rules.md` row. `dream-init`
  description updated. Stack rules section renamed to "Stack and project rules". Repo
  structure tree updated.



### Added
- `dream` command — 6-phase memory consolidation with session-first approach via
  `conversation_search`. Tiered review system (auto / diff+confirm / always human).
  Full justification blocks per operation. Append-only dream-log.md audit trail.
- `dream-health` command — self-contained HTML dashboard with confidence distribution,
  decay curve, topic coverage, clickable justification side panel per operation.
- `pr-spec-review` skill — reviews PR diff against spec or ICEA. Produces Spec
  Compliance Check, Code Review Against Spec, Traceability Matrix, Gaps & Risks
  Report, and merge verdict (READY / CAUTION / BLOCK).
- `dotnet-rules.md` — scoped to `**/*.cs`. Clean Architecture, ProblemDetails,
  Azure AD auth, xUnit naming.
- `angular-rules.md` — scoped to `**/*.ts`, `**/*.html`. Standalone/OnPush/async
  pipe/reactive forms/WCAG 2.1 AA.
- `nodejs-rules.md` — scoped to services/routes. Zod, AppError, Winston, no PII.
- `CLAUDE.md` — lean 9-section project template (stack, ICEA process, code gen
  rules, output format, PR review, ADO conventions, gap protocol, out-of-bounds).
