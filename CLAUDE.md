# CLAUDE.md — Project Intelligence File (plugin dev sessions)
# Deployment template for target projects: _project-deploy/CLAUDE.md
# This file governs the plugin's OWN development session. When updating deployable sections
# (Write Gate, §0a, §0b, etc.) update _project-deploy/CLAUDE.md — that is the bootstrap source.
#
# Stack: <set per repo — e.g. ".NET 8+ / C# · Angular 17+ · Node.js · Azure DevOps">
#        setup-init / architect populate this from the detected repo type.
# Domain: generic (developer tooling, US jurisdiction — see .claude/business-context.md)
#        Supported backends: .NET Core · ASP.NET Framework 4.x · Java/Spring Boot · Python (FastAPI/Django/Flask) · Node.js
#        Supported frontends: Angular · React. Tracking: Azure DevOps.
#        NOTE: migration source/target support is a SUBSET of stack support — see the rewrite skill's
#        posture/options + the offline mappings under skills/shared/migration-knowledge/refs/mappings/.
#        Python is a target from Node.js (nodejs→python) and React a target from Angular
#        (angular→react); Python-as-source and java/dotnet→python have no mapping refs yet.
# Last updated: keep this file updated when conventions change
# Plugin version: 3.25.0

---

# Dream

**Hard rule:** When a trigger below fires, write to the repo-root `memory/MEMORY.md` **in this
response** — before replying to the next user message. Do not defer to a later turn.
This is the repo-relative `memory/` folder at the project root (committed, dream-managed) —
**never** the `~/.claude/projects/<slug>/memory/` profile directory. The memory-capture hook
will prompt you at the start of each new turn, but write proactively without waiting for it.
`memory/` is explicitly exempt from the Write Gate.

Write an entry to the repo-root `memory/MEMORY.md` whenever one of these triggers fires:

| Trigger               | What to capture                                      |
|-----------------------|------------------------------------------------------|
| Plan approved         | Approach agreed, tools chosen, constraints set       |
| Task completed        | Pattern that worked, convention confirmed            |
| Error resolved        | Error + root cause + fix + gotcha to avoid repeating |
| Approach abandoned    | What failed, why, what not to retry                  |
| Architecture decision | Decision + rationale + alternatives rejected         |

Entry format, consolidation cadence (`/dream` every 5–8 sessions), the 20-entry promotion
cap, topic-file demotion, and `/dream-health` are documented in
`skills/shared/dream-reference.md`.

**Designated Dream runner (team projects):** Dream writes to `memory/topic-*.md`,
`memory/MEMORY.md`, `memory/topic-signals.md`, and `.claude/project-knowledge.md`.
To avoid merge conflicts, **designate one team member (typically the Tech Lead) to run
`/dream` each sprint.** Other developers write signal files to `.claude/signals/` and
memory entries to `memory/MEMORY.md` freely — both are committed and team-shared.
The Dream runner consolidates them, clears processed signal files, and commits the result.

---

## 0. WRITE GATE — Applies to source code and config files only

Source code and config files are NEVER written to disk until the developer replies
`APPROVE ADO-{ID}`. ICEA/Tech Spec/Epic/Tracker docs and `memory/` follow the
draft-then-save flow instead (see the `SAVE PLAN`/`SAVE ICEA`/`SAVE TECH` handlers in §0a).

**Pre-plan gate:** ICEA drafting is BLOCKED until `SAVE PLAN ADO-{ID}` — not inline, not to
temp/. Sequence is strictly Plan → `SAVE PLAN` → ICEA → `SAVE ICEA` → Tech Spec → `SAVE TECH`.

When a skill would write source/config it MUST instead: (1) show the changes — a unified
diff (changed lines + 3 lines of context) for edits, full content for new files; (2) show
the target path; (3) display this prompt and stop:

```
📁 WRITE PENDING — reply APPROVE ADO-{ID} to write, or SKIP to discard.
   Path: {full/file/path}
```

Only `APPROVE ADO-{ID}` unblocks the write (partial responses don't count; multiple files
share one prompt). The gate holds even after an approved ICEA, a passing critic, or prior
confirmation, and regardless of urgency. Full artefact-timing table + rationale:
`skills/shared/write-gate-spec.md`.

A large, already-reviewed multi-file plan may instead be approved once with
`APPROVE ALL ADO-{ID}` — a standing Write-Gate approval for the current plan/ADO that STILL
streams each diff + path before writing (it removes the per-file pause, not the visibility);
`REVOKE ALL ADO-{ID}` cancels it. Gates stay orthogonal: `/skip-icea` = Feature Gate only;
secrets and findings gates are never blanket-skippable. Batch semantics + orthogonality
table: `skills/shared/write-gate-spec.md`.

**Boundary-crossing writes (dependency repos).** When a write target resolves to an absolute
path **outside the repo root** — e.g. a file in a locally-cloned dependency repo listed in
`additionalDirectories` (see `skills/shared/multi-root-scan.md`) — it requires its own explicit
per-file confirmation and **`APPROVE ALL ADO-{ID}` does NOT blanket it**. Access-granted (the path
being in `additionalDirectories`) never implies silent cross-repo writes. Show the diff + full path
and stop with an extra `⚠ WRITE CROSSES REPO BOUNDARY — {path} is outside this repo.` line before
the standard prompt. This holds even under a standing `APPROVE ALL`.

---

## 0a. Keyword Handlers — recognised in any session, any message

Recognised globally, no /command needed. ADO ID is case-insensitive (`ADO-1847`, `ADO #1847`,
`1847` all work). If a pattern matches, execute the skill immediately — priority over chat.

| Pattern | Action |
|---|---|
| `SAVE PLAN ADO-{ID}` | Write plan to disk → write ICEA draft to `temp/ADO-{ID}-icea.md` → tell developer to open in VS Code preview |
| `SAVE PLAN ADO-{ID} CONFIRM` | Save plan with open questions — bypass warning |
| `SAVE ICEA ADO-{ID}` | Run critic gate → save critic output → copy `temp/ADO-{ID}-icea.md` to permanent docs/ → delete temp → write Tech Spec to `temp/ADO-{ID}-tech.md` |
| `SAVE ICEA ADO-{ID} ACCEPT` | Override critic REVISE verdict and save ICEA anyway (with audit note) |
| `SAVE TECH ADO-{ID}` | Write Tech Spec to disk — hard blocks if open questions remain (no bypass) |
| `SAVE TECH ADO-{ID} ACCEPT` | Save Tech Spec despite critic REVISE verdict (override with audit note) |
| `SAVE TEST ADO-{ID}` | Run test-plan skill — generate or refresh the QA test plan for any ADO (icea/upgrade/rewrite/replatform source auto-detected) |
| `SAVE TEST ADO-{ID} --source {type}` | Run test-plan skill with explicit source override (icea · upgrade · rewrite · replatform) |
| `SAVE TEST ADO-{ID} --subagent` | Run test-plan skill in subagent mode — parallel suite generation, no prompts, no budget warning |
| `EXPAND TEST ADO-{ID}` | Expand all stub suites in the test plan that have an approved source artifact on disk |
| `EXPAND TEST ADO-{ID} Suite-N` | Expand a single named stub suite |
| `EXPAND TEST ADO-{ID} TC-{ID}` | Expand a single TC stub to full steps |
| `REFRESH TEST ADO-{ID}` | Re-generate cross-cutting suites (Regression, Security, NFR) from current source artifact |
| `REFRESH TEST ADO-{ID} --combine` | Re-assemble the rewrite combined test plan doc from current cluster files (no cluster files modified) |
| `PLAN ADO-{ID}` | Invoke icea-feature skill — cross-session recovery entry at Step 5 (draft ICEA from saved plan on disk; reads icea-feature SKILL.md before proceeding) |
| `ICEA ADO-{ID}` | Invoke icea-feature skill — cross-session recovery entry at Step 8 (draft Tech Spec from saved ICEA on disk; skip context budget check; reads icea-feature SKILL.md including EPIC branch before proceeding) |
| `TECH ADO-{ID}` | Invoke icea-feature skill — cross-session recovery entry at Step 8 (draft Tech Spec from saved ICEA on disk; skip context budget check; reads icea-feature SKILL.md including EPIC branch before proceeding) |
| `APPROVE ADO-{ID}` | Run icea-approve skill for that ADO ID |
| `APPROVE ADO-{ID} Story-{N}` | Run icea-approve skill for that story |
| `APPROVE ADO-{ID} --skip-test-gate` | Run icea-approve — bypass the test plan existence gate (spike or prototype only). Writes an audit entry automatically. |
| `APPROVE ALL ADO-{ID}` | Grant standing Write-Gate approval for the current plan/ADO — subsequent source/config writes proceed without a per-file pause, but each diff + path is still shown. Does NOT skip Feature/secrets/findings gates. Scope: this session + this ADO only. |
| `REVOKE ALL ADO-{ID}` | Cancel a standing `APPROVE ALL` — return to per-file `APPROVE ADO-{ID}` |
| `IMPLEMENT ADO-{ID}` | Run icea-implement skill for that ADO ID |
| `IMPLEMENT ADO-{ID} Story-{N}` | Run icea-implement skill for that story |
| `REVISE ADO-{ID}` | Run icea-revise skill for that ADO ID |
| `STATUS ADO-{ID}` | Run icea-status skill for that ADO ID |
| `BUG ADO-{ID} — {description}` | Log bug entry to tracker for that ADO ID |
| `SET DOMAIN` | Run `business-context-generation.md` — infer/confirm business domain + jurisdiction, ground the B-series in cited regulatory frameworks, write `.claude/business-context.md` (own `APPROVED` gate; idempotent; architect-independent). Also sets the CLAUDE.md `Domain:` line + `dream-init-state.json` `domain`. Use for first-time setup outside architect, a domain pivot, or backfill. If the file already exists, offers `refresh` or `keep`. |
| `REFRESH DOMAIN` | Re-run `business-context-generation.md` in **refresh mode** — skips the `refresh or keep` prompt, re-grounds the B-series against current regulations, shows a before/after diff of every trigger that changed (added / modified / removed), preserves project-specific entries, writes only on `APPROVED`. Use when regulations have changed, the app has expanded its data scope, or `setup-status` flags the policy as stale. |
| `REFRESH RULES` | Run `skills/shared/rule-refresh.md` — refresh all plugin-deployed rule files in `.claude/rules/`, one at a time. For each file shows a three-way diff: plugin changes (snapshot→canonical) + your edits (snapshot→current) + conflicts marked. Proposes a merged result; writes only on `APPROVED` per file. Use when `setup-status` flags rule staleness or after a stack version upgrade. |
| `REFRESH RULES {filename}` | Same as `REFRESH RULES` but scoped to one file (e.g. `REFRESH RULES angular-rules.md`). File must be plugin-managed (in `_deploy-manifest.json`). |
| `UPGRADE ADO-{ID}` | Run the upgrade skill (`/upgrade`) for that ADO ID — in-place, same-stack version upgrade (orchestrates a deterministic tool; rejects false-upgrades → Rewrite) |
| `REWRITE ADO-{ID}` | Run the rewrite skill (`/rewrite`) for that ADO ID — out-of-place generative migration to a new target folder (posture · options · target-space DAG · per-cluster BAL/ERL · two-gate) |
| `REPLATFORM ADO-{ID}` | Run the replatform skill (`/replatform`) for that ADO ID — hosting/topology migration (on-prem → cloud); LLM authors IaC + human-executable runbooks, human executes; NFR/Well-Architected oracle |
| `UPGRADE RESUME ADO-{ID}` | Resume the upgrade — read `payload.upgrade`, orient (Status), then continue at the first unfinished stage/gate. Per `skills/shared/migration-ledger-schema.md` § Status & Resume |
| `REWRITE RESUME ADO-{ID}` | Resume the rewrite — read `payload.rewrite`, orient, then continue at the first unfinished stage/gate. Per `skills/shared/migration-ledger-schema.md` § Status & Resume |
| `REPLATFORM RESUME ADO-{ID}` | Resume the replatform — read `payload.replatform`, orient, then continue at the first unfinished stage/gate. Per `skills/shared/migration-ledger-schema.md` § Status & Resume |
| `UPGRADE STATUS ADO-{ID}` | Re-entry point (like `icea-status`): read the upgrade's ledger (`payload.upgrade`) fresh, render state, end with the single Next action. Read-only. Per `skills/shared/migration-ledger-schema.md` § Status & Resume |
| `REWRITE STATUS ADO-{ID}` | Re-entry point (like `icea-status`): read the rewrite's ledger (`payload.rewrite`) fresh, render state, end with the single Next action. Read-only. Per `skills/shared/migration-ledger-schema.md` § Status & Resume |
| `REPLATFORM STATUS ADO-{ID}` | Re-entry point (like `icea-status`): read the replatform's ledger (`payload.replatform`) fresh, render state, end with the single Next action. Read-only. Per `skills/shared/migration-ledger-schema.md` § Status & Resume |
| `MIGRATE`, `MIGRATE RESUME`, `MIGRATE STATUS`, `MIGRATE OPTIONS`, `MIGRATE INVENTORY`, `MIGRATE ARCH`, `MIGRATE FEAS`, `MIGRATE CLUSTERS`, `APPROVE OPTIONS`, `APPROVE INVENTORY`, `APPROVE ARCHITECTURE`, `APPROVE FEASIBILITY`, `APPROVE MIGRATION` (each `ADO-{ID}`) | **RETIRED** — the legacy `migration`/`migration-status` skills are gone. Do NOT auto-route. Reply with the signpost so the human picks a named skill: same stack + higher version → `UPGRADE ADO-{ID}` · different stack (translate the code) → `REWRITE ADO-{ID}` · on-prem → cloud (move the host) → `REPLATFORM ADO-{ID}`. See `docs/migrations/2026-09-migration-skill-family.md`. |
| `METRICS RELEASE-{N}` | Run the release-metrics skill for Release {N} — generates `release-metrics/release-metrics-R{N}-{date}.md` (Mermaid) and `.html` (Chart.js) covering all ADOs in the release |
| `METRICS RELEASE-{N} SPRINT-{S}` | Same as above but scoped to a single sprint |
| `METRICS RELEASE-{N} VS RELEASE-{M}` | Same as above with explicit trend comparison against Release {M} |
| `LESSONS RELEASE-{N}` | Alias for `METRICS RELEASE-{N}` — produces the same dual-output report; the Lessons tab is the primary focus |
| `LESSONS ADO-{ID}` | Re-generate the lessons learned section for a single ADO — reads its ai-audit.md and tracker.md, rewrites the `### Lessons learned` section in the tracker. Then asks: "Does any lesson here belong in project-knowledge.md? (yes / no)" — on yes, shows the candidate entry and writes to `.claude/project-knowledge.md` on confirmation. |
| `KNOWLEDGE ADD` | Add a new entry to `.claude/project-knowledge.md` — prompt for title, source ADO(s), code anchor (optional), pattern text. Write after confirmation. See `skills/shared/project-knowledge-spec.md` for format. |
| `KNOWLEDGE REMOVE {N}` | Show entry N from `.claude/project-knowledge.md` and remove after explicit confirmation. |
| `KNOWLEDGE UPDATE {N}` | Show current entry N from `.claude/project-knowledge.md`, prompt for replacement text, write after confirmation. |
| `ONBOARDING GUIDE` | Run onboarding-guide skill — generate `docs/ONBOARDING.md` if it does not exist. Reads architecture docs + ApprovalRoles.json + stack detection. Skips silently if file already exists. |
| `ONBOARDING GUIDE --refresh` | Run onboarding-guide skill — regenerate `docs/ONBOARDING.md` unconditionally (overwrites). |
| `GOVERNANCE REPORT` | Run governance-report skill — sprint governance & quality report for the tech lead. Reads `.claude/audit/` + ledgers + token-graph. Saves to `governance/`. |
| `GOVERNANCE REPORT --since {date}` | Same, scoped from a specific date. |
| `GOVERNANCE REPORT --days {N}` | Same, for the last N days. |
| `GOVERNANCE REPORT --sprint {N}` | Same, scoped to Sprint N (reads sprint dates from docs/). |

---

## 0b. Shell & Git Configuration

- Use `C:\Program Files\Git\mingw64\bin\git.exe` for git and `C:\Program Files\Git\usr\bin\bash.exe` as the shell. Run git/shell via the Bash tool
  only — never `mcp__ide__executeCode` or Python subprocess.
- Never rely on `HEAD` as a symbolic ref — resolve with `git rev-parse HEAD` first.

> `C:\Program Files\Git\mingw64\bin\git.exe`/`C:\Program Files\Git\usr\bin\bash.exe` are written by `/setup-init`; run `/setup-sync` if unresolved.

---

## 1. PROJECT OVERVIEW

This is the **ai-assisted-development** Claude Code plugin (v3.25.0) — an ICEA-driven development workflow toolkit for distributed teams using Azure DevOps. It provides 47 skills (Markdown SKILL.md files executed by Claude), ~45 Node.js utility scripts, an enforcement hook suite, and a codebase knowledge graph system, targeting .NET, Java/Spring Boot, Python, Node.js, Angular, and React projects.

Distributed team (PM · Developers · QA). All feature work is driven by ICEA documents
(Intent · Context · Examples · Acceptance) — no ticket goes Active without an approved ICEA.
Approved ICEAs are saved to `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-{feature}.icea.md`.

---

## 2. AZURE DEVOPS

> Per-project runtime source of truth — skills read Organization/Project here at execution
> time. Defaults come from `.claude-plugin/config.json`; to change org/project/company
> plugin-wide, edit that file and run `scripts/sync-config.sh` (see DEVELOPER-GUIDE.md >
> Rebranding / forking) — do not edit scattered copies.

- Organization  : {ADO_ORG}
- Project       : {ADO_PROJECT}
- Repository    : [set per project — update this line after setup-init]
- ADO URL       : {ADO_URL}
- PAT storage   : Windows env var `AZURE_DEVOPS_PAT` (recommended), or `.claude/settings.local.json` → env (gitignored). NEVER in `.claude/settings.json` (committed/shared) — a write-time + pre-commit guard blocks secrets there.
- Target branch : dev
- Branch naming : feature/ADO-[ID]-short-description
- Commit format : [ADO-ID] Short description of change
- PR title      : [ADO-ID] Feature name — brief summary

---

## 3. DESIGN PHILOSOPHY

Simplicity first · readability · maintainability · testability · **do not assume** (stop and
ask when ambiguous) · **decision transparency** (document non-trivial choices inline with a
`// DECISION:` options-considered comment). The full statement and the DECISION comment
format live in `rules/project-rules.md`, which is loaded on every file edit — that rule is
the enforced source of truth; this section is a pointer.

---

## 4. MODEL ROUTING

Skills route by task type via env vars — `ICEA_MODEL` (generation), `REVIEW_MODEL` (review),
`CRITIC_MODEL` (falls back to `REVIEW_MODEL`), `INFRA_MODEL` (infrastructure). Override per
project in `.claude/settings.json` → `env`. Full table, defaults, and per-skill assignments:
`skills/shared/model-routing-spec.md`.

---

## Data Access Convention

Use parameterised queries for all database access — never build SQL by string
concatenation. The idiomatic library is stack-specific; the detected stack's rule
file is authoritative:

- .NET: **Dapper with parameterised SQL** — never EF Core or any ORM that generates SQL automatically (see `rules/csharp-dotnet-rules.md`, `rules/data-access-rules.md`)
- Python: parameterised DB-API or ORM parameter binding — never f-string / `%`-built SQL (see `rules/python-rules.md`)
- Node.js: driver/ORM parameter binding — never template-literal SQL (see `rules/nodejs-typescript-rules.md`)
- Java: `PreparedStatement` or JPA parameter binding — never string-built SQL (see `rules/java-rules.md`)

This applies to all new code and any code generated by skills.

---

## Feature Gate

NEVER write implementation code for a new feature or capability without an approved ICEA on
disk with `Status: ✅ Approved` at
`docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-*.icea.md` (the folder is always
`UserStory{ID}` for both STORY and EPIC — the type is recorded inside the ICEA).

If asked to implement something new and no approved ICEA exists: say so, run
`/ai-assisted-development:icea-feature`, and do not proceed until `APPROVE ADO-{ID}`. This is
output-gated — orientation, questions, and reading architecture docs are always permitted;
only implementation-code generation is blocked. Override: `/skip-icea` (warns once; not recommended).

---

## Common Commands

```bash
# Run all tests (CI mode, via Jest wrapper that spawns each *.test.cjs as a subprocess)
npm test

# Run a single test file directly (each file is a self-contained node script)
node tests/<name>.test.cjs

# Run tests in watch mode
npm run test:watch

# Run tests with c8 coverage (HTML + cobertura + lcov in coverage/)
npm run test:coverage

# Bump version and commit release
npm run bump:patch   # or bump:minor / bump:major
npm run release      # bump + git commit

# Audit npm dependencies for high-severity vulnerabilities
npm audit
```

**Architecture:** This repo IS the plugin. All skills live under `skills/<skill-name>/SKILL.md` — plain Markdown read by Claude at runtime (no compilation). Scripts under `scripts/` are Node.js `.cjs` files invoked by skills via `Bash` tool calls. Tests in `tests/` mirror `scripts/` 1:1 (`scripts/foo.cjs` → `tests/foo.test.cjs`). The `_project-deploy/` folder contains the CLAUDE.md template that `setup-init-bootstrap.cjs` copies into target projects. `skills/shared/` holds cross-skill specs referenced by `$PLUGIN_DIR` paths — never by relative paths (see `skills/shared/plugin-path-resolution.md`).
