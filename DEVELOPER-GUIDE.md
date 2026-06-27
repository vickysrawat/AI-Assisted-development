# Developer Guide — ai-assisted-development

This guide is for contributors and maintainers of the plugin itself. If you are
a developer *using* the plugin on a project, the [README](README.md) is the right
starting point.

---

## Contents

1. [Repository layout](#repository-layout)
2. [How the plugin loads](#how-the-plugin-loads)
3. [Adding a skill](#adding-a-skill)
4. [Adding a command](#adding-a-command)
5. [Shared primitives layer](#shared-primitives-layer)
6. [Model routing](#model-routing)
7. [Cache architecture](#cache-architecture)
8. [Domain-map and staleness detection](#domain-map-and-staleness-detection)
9. [Dream memory system](#dream-memory-system)
10. [Security conventions](#security-conventions)
11. [Testing](#testing)
12. [Releasing a new version](#releasing-a-new-version)
13. [Updating model defaults](#updating-model-defaults)
14. [First-time project setup order](#first-time-project-setup-order)
15. [Fix protocol — making changes without creating new gaps](#fix-protocol--making-changes-without-creating-new-gaps)
16. [Defined done — release readiness checklist](#defined-done--release-readiness-checklist)

---

## Repository layout

```
ai-assisted-development/
├── .claude-plugin/plugin.json   ← plugin manifest — name, version, component lists
├── commands/                    ← slash command implementations (Markdown)
├── skills/
│   ├── shared/                  ← cross-skill specs and schemas (single source of truth)
│   └── <skill-name>/
│       ├── SKILL.md             ← skill implementation
│       └── references/          ← reference data loaded lazily by the skill
├── skills/command-stubs/        ← thin stubs deployed to .claude/commands/ by dream-init
├── rules/                       ← scoped rules deployed to .claude/rules/ by dream-init
├── tests/
│   ├── runner.js                ← Node.js test harness (Anthropic API)
│   └── skill-scenarios/         ← YAML scenario files per skill
├── memory/                      ← Dream memory files (per-project, gitignored)
├── install.ps1                  ← Windows installer
├── install.sh                   ← Unix installer
├── CLAUDE.md                    ← per-project AI context file (seeded by dream-init)
├── README.md                    ← end-user documentation
├── DEVELOPER-GUIDE.md           ← this file
└── CHANGELOG.md                 ← append-only version history
```

---

## How the plugin loads

1. `plugin.json` declares all components under `components.commands`, `components.skills`, and `components.rules`.
2. Claude Code reads `plugin.json` on load and registers all commands and skills.
3. **Commands** (`commands/*.md`) are invoked explicitly via `/ai-assisted-development:<name>`.
4. **Skills** (`skills/<name>/SKILL.md`) are invoked automatically when the developer's message matches trigger keywords listed in the skill's YAML frontmatter `description` field.
5. **Rules** (`rules/*.md`) are loaded automatically when Claude edits a file matching the rule's `paths` glob.
6. `skills/command-stubs/` are thin forwarding stubs deployed by `dream-init` into `.claude/commands/` — they make commands visible in VS Code's slash-command picker without requiring the full plugin path prefix.

---

## Adding a skill

> **Use the scaffold script.** Running `./scripts/new-skill.sh <name>` from the plugin
> root creates the folder structure, SKILL.md template, command stub, test scenario
> placeholder, registers the skill in plugin.json, and adds a README row. Fill in the
> TODO fields it leaves, then run the validator. Manual creation is error-prone — use
> the script.

### 1. Create the skill folder

```
skills/<skill-name>/
├── SKILL.md
└── references/          ← optional; create only if the skill needs lazily-loaded data
```

### 2. Write the SKILL.md frontmatter

The YAML frontmatter `description` field is what Claude uses for trigger detection:

```yaml
---
name: my-skill
description: >
  One or two sentences describing what this skill does and when to use it.
  List trigger phrases on the last line: "phrase one", "phrase two", "phrase three".
---
```

Keep the description concise. Claude matches against it at invocation time — precision reduces false triggers.

### 3. Write the skill body

Follow the conventions used by existing skills:

- Start with a `## Purpose` section explaining what the skill does and what it doesn't do.
- List hard rules in a `## Hard Rules` section at the end — things the skill must never do regardless of user input.
- Add a `## Model routing` section citing `../shared/model-routing-spec.md` and stating which tier the skill belongs to.
- If the skill reads or writes a shared cache file, add a `## Single-writer assumption` note citing `../shared/single-writer-assumption.md`.
- Reference data that is large or only needed for specific conditions (e.g. language-specific checklists) goes in `references/` and is loaded lazily in the relevant step, not at skill start.

### 4. Register in plugin.json

Add the skill name to `components.skills` in `.claude-plugin/plugin.json`.

### 5. Add a command stub (if the skill should also be slash-invokable)

Create `skills/command-stubs/<skill-name>.md` with a brief description and forwarding instruction. Update `dream-init` to deploy the stub.

### 6. Add a test scenario

Create `tests/skill-scenarios/<skill-name>.yaml` covering at minimum:
- One trigger-detection scenario (does it activate on the right phrase?)
- One hard-rule scenario (does it enforce its most critical constraint?)

---

## Adding a command

> **Use the scaffold script.** Running `./scripts/new-command.sh <name>` creates the
> command file, stub, test scenario placeholder, and registers in plugin.json. The script
> will remind you of the manual steps (dream-init loop, dream-status loop, README row).

Commands are Markdown files in `commands/`. They differ from skills in that they are always invoked explicitly — there is no keyword trigger detection.

### Structure

```markdown
---
description: One-line summary shown in VS Code command picker.
argument-hint: <argument format, e.g. "--changed | --pr | --full">
---
# /command-name — Human-readable title

## Purpose
What this command does and when to run it.

## Steps
### Step 1 — ...
### Step 2 — ...
```

### Register in plugin.json

Add the command name (without `/`) to `components.commands`.

### Add a stub

Create `skills/command-stubs/<command-name>.md` and update `dream-init` to deploy it.

---

## Shared primitives layer

`skills/shared/` is the single source of truth for conventions that span multiple skills.
**Never duplicate a shared spec inside a skill.** Reference it with a relative path:

```markdown
> Schema: `../shared/domain-map-spec.md`
```

### When to promote something to shared/

A spec belongs in `shared/` when **two or more skills** read or write the same artefact or follow the same protocol. Current shared files:

| File | Governs |
|---|---|
| `file-cache-schema.md` | Schema and merge rules for `.claude/file-cache.json` |
| `scope-flags-spec.md` | `--changed`, `--pr`, `--full`, `--ci` flag definitions |
| `domain-map-spec.md` | `domain-map.md` schema, staleness rules, fingerprint contract |
| `single-writer-assumption.md` | Cache concurrency constraints and CI guidance |
| `model-routing-spec.md` | Model routing tiers, env vars, fallback defaults |
| `source-file-consent.md` | Category A/B/C consent model — when to announce, gate, or never read source |
| `business-context-severity.md` | B1–B7 business severity override triggers |
| `findings-gate.md` | Canonical bash functions for Critical/High open findings detection across all three ledgers |
| `dismissed-findings-reconciliation.md` | Canonical Rule 5 — dismissed finding reconciliation on re-scan (keep dismissed if unchanged; re-open with verify flag if code changed) |

### Adding a shared spec

When you add a new shared spec, touch all of these in the same commit:

```
[ ] Create skills/shared/<spec-name>.md with _Spec version: 1.0 · Last changed: <date>_ header
[ ] Add to plugin.json components.shared array
[ ] Add a row to the shared specs table in this DEVELOPER-GUIDE
[ ] If the spec governs a writable file, add it to single-writer-assumption.md files table
[ ] If the spec defines a model routing rule, add the affected skills to model-routing-spec.md
[ ] Add a cross-reference in every skill that is governed by the new spec
[ ] Update CHANGELOG.md with the new spec and its governed skills
```

### Updating a shared spec

When you update a shared spec, you must update **all skills that reference it in the same commit**. There is no runtime version negotiation — a skill reading a stale local copy will silently use wrong conventions.

Checklist:
```
[ ] Bump _Spec version_ in the spec file (patch for additive, minor for breaking)
[ ] Update _Last changed_ date
[ ] Update every skill's reference table citation to the new version number
[ ] If behaviour changed, update the affected step(s) in every referencing skill
[ ] Update CHANGELOG.md
```

---

## Model routing

Skills belong to one of three routing tiers. The tier determines which model the skill uses by default:

| Tier | Env var | Default | Used for |
|---|---|---|---|
| Generation | `ICEA_MODEL` | `claude-opus-4-6` | ICEA planning, code generation, ADO task breakdown, product docs |
| Review | `REVIEW_MODEL` | `claude-sonnet-4-6` | Static analysis, compliance checks, security scanning, spec review |
| Infrastructure | `INFRA_MODEL` | `claude-sonnet-4-6` | Dream, architect, dream-status, sprint-metrics, token-analysis |

Every skill's `## Model routing` section documents which tier it belongs to and which env var to set to override. Skills read the env var at the start of their first step and fall back to the hardcoded default if it is not set.

### Keeping defaults current

Model defaults are declared in `.claude-plugin/plugin.json` under `recommended_models`:

```json
"recommended_models": {
  "generation": "claude-opus-4-6",
  "review": "claude-sonnet-4-6",
  "last_reviewed": "2026-06-01",
  "review_cadence_days": 90
}
```

`dream-status` check `1l` reads this and warns when `last_reviewed` is older than `review_cadence_days`. When Anthropic releases a new model that should become the default:

1. Update `generation` and/or `review` in `plugin.json`.
2. Update the `last_reviewed` date to today.
3. Update the hardcoded fallbacks in every skill's `## Model routing` section.
4. Update `CLAUDE.md` Section 4 model routing table.
5. Update README model routing table.
6. Add a CHANGELOG entry.

---

## Cache architecture

Two persistent cache files reduce token cost on repeated runs:

### `.claude/file-cache.json` (code-review, security)

Stores the character count of every scanned file. On each run, the skill compares the current character count against the cached value. If they match, the file is skipped. Schema is defined in `skills/shared/file-cache-schema.md`.

**Writer:** `code-review` and `security` skills (last-write-wins, see single-writer assumption).
**Reader:** `code-review`, `security`, `dream-status`.

### `token-analysis/token-graph.json` (token-analysis)

Stores per-session and per-file token usage. On each run, only new sessions and changed files are processed. Schema is defined in `skills/token-analysis/references/`.

**Writer:** `token-analysis` skill.
**Reader:** `token-analysis`, `dream-status`.

### CI usage

Always pass `--ci` in pipeline invocations. This forces a full scan and warns if a cache file is found on disk (indicating a misconfigured pipeline restoring or committing cache artifacts). Never commit cache files from CI.

---

## Domain-map and staleness detection

`.claude/architecture/domain-map.md` is generated by the `architect` skill and read by `icea-feature` and `icea-review` for codebase orientation. The schema is defined in `skills/shared/domain-map-spec.md`.

### Fingerprint (v1.1)

From spec v1.1, the architect skill writes a `_Fingerprint:` line into the map header:

```
_Fingerprint: <sha1 of all entry-point files, sorted>
```

Reading skills verify the fingerprint by re-hashing the same files. If it differs, the skill warns that entry-point files have changed since the map was generated, even if no files were structurally added, renamed, or deleted (the gap in the old 7-day check).

### Staleness is always non-blocking

Both staleness signals (structural and fingerprint) produce a warning and continue. They never halt execution. The developer decides whether to re-run the architect skill based on the warning.

### Updating the architect skill

If you change the domain-map schema, you must:
1. Update `skills/shared/domain-map-spec.md` and bump the spec version.
2. Update `skills/architect/SKILL.md` to write the new format.
3. Update `skills/icea-feature/SKILL.md` and `skills/icea-review/SKILL.md` reading sections.
4. Update `skills/dream-status/SKILL.md` check `1f`.

---

## Dream memory system

The Dream system maintains per-project AI memory across Claude Code sessions.

### Components

| File | Purpose | Written by |
|---|---|---|
| `memory/MEMORY.md` | High-confidence facts promoted for in-context loading | `/dream` command |
| `memory/dream-log.md` | Append-only audit trail of consolidation runs | `/dream` command |
| `memory/topic-*.md` | Detailed knowledge by topic area | `/dream` command |
| `memory/health.html` | Visual dashboard (generated, gitignored) | `/dream-health` command |

### Consolidation phases

`/dream` runs in 6 phases:

1. **Session discovery** — searches Claude Code conversations since the last run
2. **Inventory** — merges session candidates with existing topic files
3. **Score** — rates each candidate by confidence, recency, and usage
4. **Propose** — presents ADD/UPDATE/DELETE actions with justification
5. **Tiered approval** — waits for developer sign-off before any write
6. **Log** — appends a summary to `dream-log.md`

### Token budget guard

Phase 0 (before session search) runs a pre-flight check. Soft warnings at >200 `MEMORY.md` lines, >10 topic files, or >30 conversations in the search window. Hard stop if estimated combined context exceeds 80K tokens.

### Rollback

`/dream-rollback` reverts the last consolidation using the `dream-log.md` audit trail. After a rollback, `dream-status` check `1j` shows ⚠️ Amber until `/dream` is run again to re-consolidate.

---

## Security conventions

### Finding ledgers and dismissal

Every skill that produces findings (`code-review`, `security`, `dynamic-scan`) maintains
a persistent ledger with five reconciliation states: Still Open, Newly Fixed, New,
Already Fixed, and **Dismissed**. The Dismissed state is governed by
`skills/shared/dismissed-findings-reconciliation.md` — never implement Rule 5 inline
in a skill. The three scan skills delegate to the shared spec.

Dismissed findings are excluded from all gate counts. `accepted-risk` dismissals on
Critical/High findings are surfaced as informational in `checkin` output and the
`pr-create` PR description via `skills/shared/findings-gate.md`.

The `/dismiss` command (with `--undo`) is the only supported way to move a finding
into or out of the Dismissed state. Manual ledger edits are not supported.

The `pr-create` and `sprint-metrics` skills use `$AZURE_DEVOPS_PAT`. The recommended storage order (documented in `pr-create/SKILL.md` Step 1) is:

1. **Windows User Environment Variable** — never touches the repo
2. **`.claude/settings.json`** — only if gitignored; `dream-status` flags this as ❌ Red if unprotected
3. **Interactive prompt** — held in memory for the single API call only, then not referenced again

When a PAT is passed interactively, the skill must not reference the variable after the API call in Step 5 completes.

### Secrets in generated code

`rules/project-rules.md` (activated for all files) prohibits hardcoded secrets, connection strings, and credentials. The `code-review` skill has a corresponding checker that flags violations. When generating code that requires configuration, always use environment variable references or configuration service patterns — never inline values.

### `.gitignore` coverage

`dream-init` creates or updates `.gitignore` automatically in three phases: plugin-required entries (always added), root-level well-known artifacts (auto-detected), and a full repo walk for build artifacts (`bin/`, `obj/`, `dist/`, `.env`, etc.) with a developer selection prompt before writing. Developer-declined entries are tracked in `.claude/dream-init-state.json` and not re-prompted. `dream-status` check `1i` verifies coverage of all 11 required entries. The most critical entry is `.claude/settings.json` — if it exists but is not gitignored, `dream-status` reports ❌ Red and the recommended action list prioritises it above all other fixes.

---

## Testing

The test harness in `tests/runner.js` validates skill behaviour using the Anthropic API. It does not require a full Claude Code session.

### Running tests

```bash
# Set your API key
export ANTHROPIC_API_KEY=your-key

# Run all scenarios
node tests/runner.js

# Run one skill
node tests/runner.js --skill icea-feature

# Show full model responses
node tests/runner.js --verbose
```

### Scenario format

Each `tests/skill-scenarios/<skill>.yaml` file follows this structure:

```yaml
skill: icea-feature
scenarios:
  - id: trigger-build-verb
    description: "Should trigger on 'build' action verb"
    input: "Build a user search filter for the deals list"
    expect:
      triggered: true
      contains: ["ICEA GATE", "ICEA DRAFT", "APPROVAL REQUIRED"]
      not_contains: ["function", "class", "Controller"]

  - id: hard-rule-no-code-before-approval
    description: "Must not generate code before APPROVED"
    input: "Build a search filter."
    expect:
      triggered: true
      contains: ["APPROVAL REQUIRED"]
      not_contains: ["public class", "async Task"]
```

### Coverage gaps

The following skills currently have no test scenarios and should be added in the next release:

- `security` — highest-priority given its size and recent pattern additions
- `architect` — fingerprint writing should be validated
- `dream-status` — all 12 checks should have a corresponding scenario
- `token-analysis` — cache miss and delta behaviour

### CI integration

```bash
node tests/runner.js && echo "All scenarios passed"
```

Set `ANTHROPIC_API_KEY` as a pipeline secret. The runner uses `claude-sonnet-4-20250514`. Estimated cost: ~$0.02 per full run.

---

## Releasing a new version

> **Use the bump script.** Running `./scripts/bump-version.sh <X.Y.Z>` updates
> `plugin.json`, `CLAUDE.md`, and prepends a CHANGELOG stub in one atomic operation,
> then runs the validator. Never update these files manually — they drift apart.

1. Make all changes on a feature branch.
2. Update `CHANGELOG.md` — prepend a `## [X.Y.Z] — YYYY-MM-DD` section summarising every change. Be specific: list affected files and the exact behaviour change.
3. Bump `version` in `.claude-plugin/plugin.json`.
4. Update the version badge at the top of `README.md`.
5. If model defaults changed, follow the [updating model defaults](#updating-model-defaults) checklist.
6. Run `node tests/runner.js` and confirm all scenarios pass.
7. Open a PR to `main`. PR title format: `[vX.Y.Z] Short description`.
8. After merge, tag the commit: `git tag vX.Y.Z && git push --tags`.

### Version semantics

| Change type | Version bump |
|---|---|
| New skill, new command, new shared spec | Minor (X.Y → X.Y+1) |
| Bug fix, spec update, new checker, documentation | Patch (X.Y.Z → X.Y.Z+1) |
| Breaking change to shared spec or cache schema | Major (X → X+1) |

A breaking change to a shared spec requires every skill that references it to be updated in the same commit — see [shared primitives layer](#shared-primitives-layer).

---

## Updating model defaults

Run this checklist when Anthropic releases a new model that should become a routing default:

- [ ] Update `generation` and/or `review` in `.claude-plugin/plugin.json` → `recommended_models`
- [ ] Update `last_reviewed` in `plugin.json` to today's date
- [ ] Update hardcoded fallback in every generation-tier skill's `## Model routing` section
- [ ] Update hardcoded fallback in every review-tier skill's `## Model routing` section
- [ ] Update `skills/shared/model-routing-spec.md` default values
- [ ] Update `CLAUDE.md` Section 4 model routing table
- [ ] Update `README.md` model routing table
- [ ] Run `node tests/runner.js` — spot-check that output quality is acceptable on new model
- [ ] Add CHANGELOG entry describing the model change and the reason
- [ ] Bump patch version

The 90-day review cadence (`review_cadence_days` in `plugin.json`) means `dream-status` will surface an amber warning approximately quarterly, prompting maintainers to run through this checklist proactively rather than waiting for developers to notice stale defaults.

---

## First-time project setup order

When setting up this plugin on a **new project**, run these steps in order. Skipping
or reordering them causes downstream skills to fail with confusing errors.

| Step | Command / Action | Creates | Required by |
|---|---|---|---|
| 1 | `/dream-init` | `memory/`, `.claude/rules/`, `.claude/commands/` stubs | Everything |
| 2 | Architect questionnaire (runs inside dream-init Step 7) | `.claude/architecture/architecture-deployment.md` | `app-readiness`, `icea-feature`, `plugin-readiness` |
| 3 | Architect skill (runs inside dream-init Step 7) | `.claude/architecture/*.md`, `domain-map.md` | `icea-feature`, `icea-review`, `code-review`, `security-review` |
| 4 | `/session-start` | — (verifies setup) | — |
| 5 | Normal workflow | `docs/icea/`, `CodeReviews/`, `security/` | — |

If `architecture-deployment.md` was skipped (Step 2 incomplete), run:
```
/update-arch --deployment
```

For the full cross-skill dependency map, see `skills/shared/README.md`.

---

## Fix protocol — making changes without creating new gaps

Every edit to this plugin must follow this protocol. It is why gaps accumulate
when it is skipped: a change to one file creates a stale reference in another.

### Before making any change

1. Run the structural validator to confirm you're starting from a clean baseline:
   ```bash
   python3 tests/validate.py
   ```
2. Read the file you're about to change and note every number, list, or cross-reference it contains.

### While making the change

For every edit, immediately ask: **what else references this data?**

| If you change | Also update |
|---|---|
| A stub list (add/remove a command stub) | `commands/dream-init.md` stub table + bash loop + Step 10 summary, `skills/dream-status/SKILL.md` check 1d loop + `N/19` count, `skills/command-stubs/` |
| A check count or table row count | Every place in the same file that cites the count (score descriptions, report templates, bash comments) |
| A shared spec (source-file-consent, business-context-severity, domain-map-spec) | Every SKILL.md that references it — run `grep -r "spec-name" skills/` to find all referencing files |
| A step that reads a new file | Add it to the source-file-consent.md table row for that skill |
| A numbered list in any skill's Codebase Orientation | Check for duplicate numbers before committing |
| The plugin version in `plugin.json` | `CLAUDE.md` Plugin version line, `CHANGELOG.md` entry |
| An ADO org/project value | Ensure it's read from CLAUDE.md dynamically — never hardcode it in a SKILL.md body |

### After making the change

Run the validator again and confirm zero errors before committing:
```bash
python3 tests/validate.py
```

The validator catches: stub count mismatches, duplicate step numbers, stale check counts,
missing architecture-deployment references, inline B1-B7 duplication, hardcoded ADO orgs,
missing consent table entries, missing business-context-severity references, consecutive
separator artifacts, plugin.json/file mismatches, and missing CHANGELOG entries.

It does **not** catch: logic errors in bash commands, wrong file paths in prose,
or semantic drift between a shared spec and a skill that references it. Those require
a manual read of the changed files and their dependents.

---

## Defined done — release readiness checklist

A version is ready to release when all of the following are true:

```
[ ] python3 tests/validate.py exits 0 (zero errors)
[ ] CHANGELOG.md has an entry for the current plugin.json version
[ ] CLAUDE.md Plugin version line matches plugin.json
[ ] All new scan skills (producing finding ledgers) delegate Rule 5 (Dismissed) to dismissed-findings-reconciliation.md — no inline copies
[ ] All new skills have a row in business-context-severity.md (or reference it)
[ ] All new commands are in the dream-init stub table AND bash loop AND Step 9 summary
[ ] All new commands have a stub in skills/command-stubs/
[ ] All modified shared specs have been grep'd for all referencing skills — all updated
[ ] No consecutive --- separators in any SKILL.md or command file
[ ] No hardcoded ADO org in any SKILL.md body (reference files excepted)
[ ] README.md reflects current command list and feature set
[ ] DEVELOPER-GUIDE.md reflects current architecture
[ ] user-guide.html reflects current command list
[ ] node tests/runner.js passes on a sample project (or spot-checked manually)
```

This checklist is the answer to "why do we keep finding gaps?" — run it before every
release instead of discovering gaps afterwards.

