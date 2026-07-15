# Architecture — Reference

_Generated: 2026-07-13_

## Package Metadata

| Field | Value |
|---|---|
| Name | `ai-assisted-development` |
| Version | 3.12.0 |
| Author | Your Company |
| Repository | `https://dev.azure.com/your-org/your-project/_git/ai-assisted-development` |
| Distribution | KirklandAndEllis-marketplace (Claude Code plugin registry) |

## npm Dependencies

| Package | Version | Purpose |
|---|---|---|
| `pptxgenjs` (devDependency) | ^4.0.1 | PowerPoint generation for story slide decks (`scripts/gen-story-pptx.cjs`) |

No runtime dependencies — all plugin logic uses Node.js built-ins (`fs`, `path`, `crypto`,
`child_process`) plus markdown skill files loaded by Claude Code.

## Recommended Models (from plugin.json)

| Tier | env var | Default model | Purpose |
|---|---|---|---|
| Generation | `ICEA_MODEL` | `claude-opus-4-6` | ICEA/Tech Spec drafting, code generation |
| Review | `REVIEW_MODEL` | `claude-sonnet-4-6` | Code review, security review, critic |
| Infrastructure | `INFRA_MODEL` | `claude-sonnet-4-6` | Setup, graph-sync, architect, session-start |
| Critic fallback | `CRITIC_MODEL` | falls back to `REVIEW_MODEL` | Critic skill |
| Review cadence | — | 90 days | `setup-status` warns when `last_reviewed` is stale |

## Test Coverage

| Test file | Mode | Checks |
|---|---|---|
| `tests/validate.js` | Offline (no API, no network) | 259 assertions: commands, skills, rules, scenarios, hooks, version consistency |
| `tests/runner.js` | API + network required | End-to-end skill invocation tests |

`tests/validate.js` is the **offline release gate** — must be 259✓/0✗ before any version bump.

## Version History (last 5 releases)

| Version | Date | Key change |
|---|---|---|
| 3.12.0 | 2026-07-12 | Shared `settings.json` + secret guard (`check-settings-secrets.cjs`); shared durable artifacts (architecture/, ledgers) |
| 3.11.1 | 2026-07-12 | CLAUDE.md managed sections CRLF duplication fix in `extractSection()` |
| 3.11.0 | 2026-07-12 | `autoMemoryEnabled: false` in bootstrap — Dream captures now land in repo `memory/` not profile |
| 3.10.0 | 2026-07-12 | Two-signal arch-populated detector (ADR 0053); `<!-- TEMPLATE -->` marker retained through all copy paths |
| 3.9.0 | 2026-07-10 | Critic wired at ICEA-draft (Step 5) and Tech-Spec-draft (Step 8) gates; new `tech` mode (ADR 0052) |

Full history: `CHANGELOG.md`.

## Key Scripts

| Script | Purpose |
|---|---|
| `scripts/setup-init-bootstrap.cjs` | All mechanical setup-init work in one deterministic Node.js pass |
| `scripts/graph-extract-edges.js` | Deterministic EXTRACTED edge extraction from source imports (ADR 0041) |
| `scripts/plugin-state.cjs` | Plugin version drift detection (provisioned vs installed) |
| `scripts/bump-version.js` | Version bump across all files |
| `scripts/check-version-consistency.js` | Validates version is consistent across all files |
| `scripts/gen-story-pptx.cjs` | PowerPoint story slide deck generation |

## Publish Process

> ⚠ Could not determine — needs manual input (no pubxml, pipeline, or publish script found)

Manual process; version is bumped via `scripts/bump-version.js`, then published to the
KirklandAndEllis marketplace registry.
