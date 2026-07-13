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
8. [Knowledge graph and staleness detection](#knowledge-graph-and-staleness-detection)
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
├── _project-deploy/             ← all files deployed to target projects
│   ├── commands/                ←   command stubs (was skills/command-stubs/)
│   ├── hooks/                   ←   enforcement hooks (was hooks/)
│   ├── rules/                   ←   scoped rule files (was rules/)
│   └── skills/                  ←   project-specific skill context files
├── tests/
│   ├── runner.js                ← Node.js test harness (Anthropic API)
│   └── skill-scenarios/         ← YAML scenario files per skill
├── memory/                      ← Dream memory files (per-project, gitignored)
├── install.ps1                  ← Windows installer
├── install.sh                   ← Unix installer
├── CLAUDE.md                    ← per-project AI context file (seeded by setup-init)
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
6. `_project-deploy/commands/` are thin forwarding stubs deployed by `setup-init` into `.claude/commands/` — they make commands visible in VS Code's slash-command picker without requiring the full plugin path prefix.

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

Create `_project-deploy/commands/<skill-name>.md` with a brief description and forwarding instruction. Update `setup-init` to deploy the stub.

### 6. Add a test scenario

Create `tests/skill-scenarios/<skill-name>.yaml` covering at minimum:
- One trigger-detection scenario (does it activate on the right phrase?)
- One hard-rule scenario (does it enforce its most critical constraint?)

---

## Adding a command

> **Use the scaffold script.** Running `./scripts/new-command.sh <name>` creates the
> command file, stub, test scenario placeholder, and registers in plugin.json. The script
> will remind you of the manual steps (setup-init loop, setup-status loop, README row).

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

Create `_project-deploy/commands/<command-name>.md` and update `setup-init` to deploy it.

---

## Shared primitives layer

`skills/shared/` is the single source of truth for conventions that span multiple skills.
**Never duplicate a shared spec inside a skill.** Reference it with a relative path:

```markdown
> Schema: `../shared/graph-index-schema.md`
```

### When to promote something to shared/

A spec belongs in `shared/` when **two or more skills** read or write the same artefact or follow the same protocol. Current shared files:

| File | Governs |
|---|---|
| `file-cache-schema.md` | Schema and merge rules for `.claude/file-cache.json` |
| `scope-flags-spec.md` | `--changed`, `--pr`, `--full`, `--ci` flag definitions |
| `graph-index-schema.md` | `.claude/graph/graph-index.md` schema — the always-loaded breadth index (module → entry point) |
| `graph-module-schema.md` | `.claude/graph/<module>.md` schema — per-module depth (bounded context, key files, dependencies, patterns) |
| `single-writer-assumption.md` | Cache concurrency constraints and CI guidance |
| `model-routing-spec.md` | Model routing tiers, env vars, fallback defaults |
| `source-file-consent.md` | Category A/B/C consent model — when to announce, gate, or never read source |
| `business-context-severity.md` | B1–B7 business severity override triggers |
| `findings-gate.md` | Canonical bash functions for Critical/High open findings detection across all three ledgers |
| `dismissed-findings-reconciliation.md` | Canonical Rule 5 — dismissed finding reconciliation on re-scan (keep dismissed if unchanged; re-open with verify flag if code changed) |

> **Proposals vs. live specs.** `skills/shared/` holds only primitives that a
> shipping skill actually consumes, and every entry there is listed in
> `plugin.json` `components.shared`. Forward-looking designs that are **not yet
> implemented** live in [`docs/proposals/`](../docs/proposals/) instead — they
> are deliberately kept out of `components.shared` so the manifest lists shipping
> components only. A proposal graduates into `skills/shared/` (and the manifest)
> the moment a skill begins to reference it.

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
| Infrastructure | `INFRA_MODEL` | `claude-sonnet-4-6` | Dream, architect, setup-status, sprint-metrics, token-analysis |

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

`setup-status` check `1l` reads this and warns when `last_reviewed` is older than `review_cadence_days`. When Anthropic releases a new model that should become the default:

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
**Reader:** `code-review`, `security`, `setup-status`.

### `token-analysis/token-graph.json` (token-analysis)

Stores per-session and per-file token usage. On each run, only new sessions and changed files are processed. Schema is defined in `skills/token-analysis/references/`.

**Writer:** `token-analysis` skill.
**Reader:** `token-analysis`, `setup-status`.

### CI usage

Always pass `--ci` in pipeline invocations. This forces a full scan and warns if a cache file is found on disk (indicating a misconfigured pipeline restoring or committing cache artifacts). Never commit cache files from CI.

---

## Knowledge graph and staleness detection

`.claude/graph/` is the single codebase-orientation layer ([ADR 0038](docs/adr/0038-knowledge-graph-orientation.md), superseding the retired `domain-map.md`). It is generated by the `architect` skill (Step 7), refreshed incrementally by `/graph-sync`, and read by `icea-feature`, `icea-review`, `code-review`, `security`, `explain`, and others for orientation. Two schemas define it: `skills/shared/graph-index-schema.md` (breadth index) and `skills/shared/graph-module-schema.md` (per-module depth). **It is committed and PR-reviewed — not gitignored.**

### Fingerprint and staleness

Each `graph/<module>.md` detail file carries a `_Fingerprint:` line (sha1 of its entry-point file). A post-merge/post-checkout git hook (`graph-stale-detect.sh`) re-hashes entry points on `git pull`/branch switch and writes `.claude/graph/.stale` on any mismatch. Reading skills check for that flag and warn (non-blocking) to run `/graph-sync`; `/graph-sync` regenerates only the stale modules and clears the flag.

### Staleness is always non-blocking

The `.stale` flag produces a warning and continue — it never halts execution. The developer decides whether to run `/graph-sync` based on the warning.

### Updating the graph schema

If you change the graph schema, you must:
1. Update `skills/shared/graph-index-schema.md` and/or `graph-module-schema.md` and bump the schema version.
2. Update `skills/architect/SKILL.md` Step 7 to write the new format.
3. Update `skills/graph-sync/SKILL.md` and the orientation-reading sections of the consumer skills.
4. Update `skills/setup-status/SKILL.md` check `1f`.

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

`/dream-rollback` reverts the last consolidation using the `dream-log.md` audit trail. After a rollback, `setup-status` check `1j` shows ⚠️ Amber until `/dream` is run again to re-consolidate.

### Memory auto-capture (Stop hook)

The CLAUDE.md `# Dream` section instructs Claude to write to `memory/MEMORY.md` when specific
triggers fire (plan approved, task completed, error resolved, approach abandoned, architecture
decision). This is reinforced by a **Stop hook** (`hooks/memory-capture.sh`) that fires after
every Claude turn and injects a compact capture checklist back to the model via the
`hookSpecificOutput.additionalContext` mechanism — not plain stdout, which would not reach
the model.

The hook and both its settings.json entries (PreToolUse `icea-floor.sh` + Stop
`memory-capture.sh`) are deployed and wired automatically by `setup-init` and `setup-sync`
via `scripts/setup-init-bootstrap.cjs`. No manual wiring is needed.

**If entries are not appearing in `memory/MEMORY.md`:**

1. Confirm `.claude/settings.json` contains `hooks.Stop` with `memory-capture.sh`:
   ```json
   { "hooks": { "Stop": [{ "hooks": [{"type":"command","command":"bash .claude/hooks/memory-capture.sh"}] }] } }
   ```
2. Confirm `.claude/hooks/memory-capture.sh` exists and is executable (`chmod +x`).
3. Re-run `/setup-sync` — the bootstrap in sync mode wires both hooks automatically.
4. Verify Stop hook injection: add a test entry temporarily to `.claude/settings.json`:
   ```json
   { "hooks": { "Stop": [{ "hooks": [{"type":"command","command":"bash -c 'node -e \\'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:\"Stop\",additionalContext:\"STOP_HOOK_TEST\"}}))\\''"}]}] } }
   ```
   If Claude's next response acknowledges `STOP_HOOK_TEST`, injection is working.

**Design note:** plain `echo` / `cat` from a Stop hook does NOT reach the model; output must
be JSON with `hookSpecificOutput.additionalContext` (see ADR 0049).

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
2. **`.claude/settings.local.json`** — gitignored secret store; NEVER `.claude/settings.json`, which is committed & team-shared and guarded against secrets (`check-settings-secrets.cjs`)
3. **Interactive prompt** — held in memory for the single API call only, then not referenced again

When a PAT is passed interactively, the skill must not reference the variable after the API call in Step 5 completes.

### Secrets in generated code

`rules/project-rules.md` (activated for all files) prohibits hardcoded secrets, connection strings, and credentials. The `code-review` skill has a corresponding checker that flags violations. When generating code that requires configuration, always use environment variable references or configuration service patterns — never inline values.

### `.gitignore` coverage

`setup-init` creates or updates `.gitignore` automatically in three phases: plugin-required entries (always added), root-level well-known artifacts (auto-detected), and a full repo walk for build artifacts (`bin/`, `obj/`, `dist/`, `.env`, etc.) with a developer selection prompt before writing. Developer-declined entries are tracked in `.claude/dream-init-state.json` and not re-prompted. `setup-status` check `1i` verifies coverage of the required entries. The managed block deliberately **shares** `.claude/settings.json` (team config), `.claude/architecture/` (docs), and the three review ledgers (via `!<dir>/<ledger>.md` negations), while ignoring `.claude/settings.local.json` (the secret store), the dated reports, and all `dynamic-scan/*` scan artifacts (which can hold plaintext credentials). The most critical entry is `.claude/settings.local.json` — if the secret store is not ignored, `setup-status` reports ❌ Red; it also reports ❌ Red if a secret is found inside the shared `.claude/settings.json`.

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
- `setup-status` — all 12 checks should have a corresponding scenario
- `token-analysis` — cache miss and delta behaviour

### CI integration

```bash
node tests/runner.js && echo "All scenarios passed"
```

Set `ANTHROPIC_API_KEY` as a pipeline secret. The runner uses `claude-sonnet-4-20250514`. Estimated cost: ~$0.02 per full run.

---

## Rebranding / forking

**The plugin ships company-agnostic.** Organization, project, company, the ADO repo
name, and the marketplace name all live in **one file**: `.claude-plugin/config.json`,
which ships with placeholders:

```json
{
  "company": "Your Company",
  "companyUrl": "",
  "organization": "your-org",
  "project": "your-project",
  "adoBaseUrl": "https://dev.azure.com",
  "pluginRepoName": "ai-assisted-development",
  "marketplaceName": "local-marketplace"
}
```

**Easiest path — the installer prompts you.** On a fresh install, `install.sh` /
`install.ps1` ask for organization, project, company, and ADO base URL (Enter keeps
the shown default), write your answers into the installed `config.json`, and run
`sync-config.sh` for you. An update preserves your entered values.

**Manual path (or CI):**

1. Edit `.claude-plugin/config.json` (any field left as a placeholder is fine).
2. Run `./scripts/sync-config.sh` — propagates derived values into the manifests
   that must carry literals: `plugin.json` (`author.name`, `author.url` from
   `companyUrl`, `repository` = `{adoBaseUrl}/{organization}/{project}/_git/{pluginRepoName}`)
   and `marketplace.json` (`name` from `marketplaceName`, `description`).
3. Re-run `/setup-init` (or `/setup-sync`) in each consuming project — its **Step 5d**
   seeds the CLAUDE.md §2 `Organization` / `Project` / `ADO URL` lines from the config.

**What reads from where:**

| Consumer | How it gets identity |
|---|---|
| `install.sh` / `install.ps1` | Prompt on fresh install → write `config.json`; derive clone URL + marketplace name/description; generic placeholder fallbacks only |
| `plugin.json`, `marketplace.json` | Written by `scripts/sync-config.sh` from `config.json` |
| Runtime skills (`ado-tasks`, `pr-create`, …) | Read `Organization` / `Project` from **CLAUDE.md §2** (seeded from config by `setup-init` Step 5d) |
| Skills locating the plugin dir (`setup-init`, `setup-sync`) | **Registry read** — `~/.claude/plugins/installed_plugins.json`, matching any key starting with `ai-assisted-development@` (fork-agnostic), preferring the `user` scope; falls back to the source-tree glob if the registry is absent. Canonical snippet: `skills/shared/plugin-path-resolution.md` |
| Reference docs & guides | Use `<your-org>` / `<your-project>` placeholders — never real values |

The command namespace `ai-assisted-development` (used in every `/ai-assisted-development:cmd`)
is the plugin's `name` in `plugin.json` and is intentionally **not** parameterised —
renaming it would break every stub and doc reference. `pluginRepoName` is only the
**ADO git repository** name (for the clone URL); `marketplaceName` is the folder under
`~/.claude/plugins/` created at install — it is **derived from the organization**
(`{organization}-marketplace`, or `local-marketplace` when no real org is set) by the
installer and `sync-config.sh`. Skills find the plugin by glob, so the name is free and
`--update`/`--uninstall` locate the install regardless of its name. `--uninstall` (`-Uninstall`)
removes all global config — the cache dir (every version), any caches orphaned by a past
rename, and stale `extraKnownMarketplaces` entries — via `scripts/uninstall-cleanup.js`. It
shows a dry-run plan and prompts before deleting; pass `--yes` (`-Yes`) to skip the prompt.
It does **not** touch per-project `.claude/` provisioning or credentials.

**CLAUDE.md context budget.** CLAUDE.md loads whole every session, so keep it lean — target
**≤ ~200 lines**. This is an *instruction-adherence* budget, **not** a context-window limit
(a 150-line file is ~1% of a 200K window). The plugin's injected governance has a practical
floor (~126–148 lines) because always-active gates and the required §2 ADO config must stay;
that floor was accepted by design, not driven lower. Rationale + target table:
`skills/shared/claude-md-budget-spec.md`; decision: [ADR 0040](docs/adr/0040-claude-md-context-budget.md).
`scripts/claude-md-audit.js` (surfaced by `setup-init`/`dream-health`) flags projects over budget.

`validate.py` check 7 fails the build only once a **real** org is configured (not the
`your-org` placeholder) if that org is hardcoded in a skill/command, and always if the
manifests drift from `config.json`.

`validate.py` check 7 fails the build if the org slug is hardcoded in any skill,
command, or reference doc, and if the manifests drift from `config.json`.

## Releasing a new version

> **Single source of truth: `.claude-plugin/plugin.json` → `version`.** Runtime readers
> (`setup-init`, `setup-sync`, `install.sh`/`.ps1`) read it live and never drift. `marketplace.json`
> carries **no** version (it references the plugin by `source`; the version is plugin.json's).
> The only static copy derived from it is the `CLAUDE.md` `# Plugin version:` label.

> **Use the bump command — never hand-edit the version.**
> `./scripts/bump-version.sh <X.Y.Z>` (full release pass: also re-syncs hooks + runs the Python
> validator when present) or, if Python is unavailable, `node scripts/bump-version.js <X.Y.Z>`.
> It sets `plugin.json`, propagates the `CLAUDE.md` label, prepends a CHANGELOG stub, warns on
> guide staleness, and runs the drift guard. Version writes are all Node — no Python needed.

1. Make all changes on a feature branch.
2. Run the bump command above, then fill in the prepended `CHANGELOG.md` stub — be specific: list affected files and the exact behaviour change.
3. Optionally refresh narrative version mentions (the `README.md` headline, the `*.html` guides) — these are *documentation*, not the canonical version; the bump command warns when guides lag.
4. If model defaults changed, follow the [updating model defaults](#updating-model-defaults) checklist.
5. Run `node tests/runner.js` and confirm all scenarios pass.
6. Confirm no drift: `node scripts/check-version-consistency.js` (also suitable for CI — exits non-zero on any mismatch).
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

The 90-day review cadence (`review_cadence_days` in `plugin.json`) means `setup-status` will surface an amber warning approximately quarterly, prompting maintainers to run through this checklist proactively rather than waiting for developers to notice stale defaults.

---

## First-time project setup order

When setting up this plugin on a **new project**, run these steps in order. Skipping
or reordering them causes downstream skills to fail with confusing errors.

| Step | Command / Action | Creates | Required by |
|---|---|---|---|
| 1 | `/setup-init` | `memory/`, `.claude/rules/`, `.claude/commands/` stubs | Everything |
| 2 | Architect questionnaire (runs inside setup-init Step 7) | `.claude/architecture/architecture-deployment.md` | `app-readiness`, `icea-feature`, `plugin-readiness` |
| 3 | Architect skill (runs inside setup-init Step 7) | `.claude/architecture/*.md`, `.claude/graph/` (index + module files) | `icea-feature`, `icea-review`, `code-review`, `security-review` |
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
| A stub list (add/remove a command stub) | `commands/setup-init.md` stub table + bash loop + Step 10 summary, `skills/setup-status/SKILL.md` check 1d loop + `N/19` count, `_project-deploy/commands/` |
| A check count or table row count | Every place in the same file that cites the count (score descriptions, report templates, bash comments) |
| A shared spec (source-file-consent, business-context-severity, graph-index-schema) | Every SKILL.md that references it — run `grep -r "spec-name" skills/` to find all referencing files |
| An architect template (`skills/architect/templates/`) | Templates are composed from `_shared/` (stack-agnostic base) + `<stack>/` overrides (ADR 0051). Edit the common `decisions`/`integrations`/`security`/`data` files in `_shared/` — **but if you change a file that `dotnet-api` (or a frontend/`js-library` `data.md`) overrides, update that override too** (it won't inherit). Every stack must still compose to 8 files — `node tests/validate.js` enforces this. |
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
[ ] All new commands are in the setup-init stub table AND bash loop AND Step 9 summary
[ ] All new commands have a stub in _project-deploy/commands/
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

