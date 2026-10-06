# 0071 — Upgrade intake: skill-generated three-pass vs hand-authored manifest
Status: Accepted · Date: 2026-10-06
Governs: `skills/upgrade/SKILL.md`, `skills/shared/migration-knowledge/refs/mappings/`, `scripts/intake-verify.cjs`
Relates to: [[0070-migration-skill-continue-gate-elimination]], [[0060-migration-owned-source-detection]], [[0063-bundled-substrate-manifest-truth]]

## Problem

The upgrade skill required the developer to hand-author a `source-context-manifest.md` file
before the skill could proceed. This document maps every module in the codebase to an
upgrade concern, accounting for coverage. The pattern was borrowed directly from the Rewrite
skill.

For a Rewrite, module coverage accounting is critical: untranslated modules become missing
output. The LLM must know which modules it is responsible for translating. Coverage gaps
produce incomplete target codebases.

For an upgrade, the deterministic tool (dotnet upgrade-assistant, ng update, etc.) handles
every file automatically. The skill's job is not to account for coverage — the tool does
that. The skill's job is to surface what will break and what the developer must fix by hand.

The hand-authored manifest added developer work (15–30 minutes per project, depending on
codebase size) that produced no additional safety signal for the upgrade case. Meanwhile, the
information the developer actually needs before committing to an upgrade — which packages are
incompatible, which behavioral changes are present, which infrastructure files are affected —
was not collected at all.

## Decision

**Replace `source-context-manifest.md` with a skill-generated `ADO-{ID}-upgrade-intake.md`.**

The skill generates the intake document automatically via three detection passes. The
developer reviews the generated document and replies `INTAKE CONFIRMED ADO-{ID}`. Nothing is
hand-authored.

### Pass 1 — Package compatibility (live registry query)

For each package in the dependency ledger, query the package registry (NuGet, npm, Maven
Central, PyPI, etc.) for a version compatible with the target framework. Registry is the
authoritative source — the knowledge cache is not used for this question because package
releases change continuously.

| Result | Label |
|---|---|
| Compatible version found | COMPATIBLE |
| No compatible version found | Forward to Pass 2 |
| Registry unreachable | DEVELOPER REVIEW |

### Pass 2 — Replacement mapping (knowledge cache — stable)

For packages with no compatible version, check the per-stack knowledge cache for a
replacement mapping entry.

| Cache entry | Label |
|---|---|
| `status: replaced` | MIGRATION REQUIRED — swap package + update registration |
| `status: sdk_merged` | SDK REPLACEMENT — remove package, use SDK feature |
| Not in cache | Forward to research agent |
| Research agent finds replacement | MIGRATION REQUIRED |
| Research agent finds nothing | BLOCKER |
| Research agent uncertain | DEVELOPER REVIEW |

Replacement mappings (SDK absorptions, official package renames) are stable knowledge: they
do not reverse after release. The knowledge cache is appropriate for this.

### Pass 3 — Behavioral change scan (knowledge cache patterns + grep)

For each entry in the per-stack knowledge cache `behavioral_changes` section, grep the
codebase for the detection pattern. If matched, surface as a BEHAVIORAL CHANGE with required
action and test coverage flag. If not matched, skip (not relevant to this app).

This is the highest-risk category: framework behavioral changes that compile cleanly but
fail silently at runtime. Neither the registry check nor the compiler catches these.

### Intake document structure — 12 sections, always rendered

Every section renders in the output — findings or "Not applicable — evidence: X." No section
is silently skipped, because a missing section cannot be distinguished from a skipped scan.

| # | Section |
|---|---|
| 0 | Baseline and target |
| 1 | Upgrade path (one-hop vs multi-hop) |
| 2 | Version coupling |
| 3 | Dependency ledger |
| 4 | Build-time breaks |
| 5 | Behavioral changes (with test coverage flag per finding) |
| 6 | Data access and schema migration state |
| 7 | Serialization contracts in flight |
| 8 | Configuration loading |
| 9 | Infrastructure gaps |
| 10 | Test suite impact |
| 11 | Downstream consumers |

### Stack-agnostic design

SKILL.md defines what to detect (abstract). Per-stack knowledge files define how to detect
it (concrete patterns, registry endpoints, replacement mappings). New stacks get support by
adding a knowledge file — SKILL.md is not modified.

Knowledge files live at:
`skills/shared/migration-knowledge/refs/mappings/{stack}-upgrade.md`

### INTAKE CONFIRMED confirms two things

1. The findings sections are accurate — no important integration or package is missing.
2. The not-applicable sections are correctly dismissed — the stated evidence holds.

If any "not applicable" shows wrong evidence, the developer challenges it before confirming.
Resolution: add the missed detection pattern to the stack knowledge file.

## Rationale

- **Coverage accounting is the tool's job, not the developer's.** The deterministic upgrade
  tool processes every file. Requiring the developer to enumerate files serves no safety
  function in the upgrade context; it adds toil.
- **Risk-surface detection is what the developer needs.** Incompatible packages, behavioral
  changes, infrastructure gaps — these are the decisions the developer must make before
  starting an upgrade. The three-pass intake surfaces exactly this, automatically.
- **Always-render sections prevent silent gaps.** A missing section could mean "no findings"
  or "scan was skipped." An explicit "Not applicable — evidence: X" is verifiable. The
  developer confirms what they can see, not what they assume.
- **Knowledge cache separation by stability tier.** Package registry (live, changes daily)
  is queried live. Replacement mappings (stable, do not reverse after release) come from the
  cache. Behavioral changes (stable patterns, discovered per app by grep) come from the
  cache with live grep against the codebase. Each pass uses the appropriate source.

## Alternatives rejected

- **Keep the hand-authored manifest, add the three-pass generation as supplemental.**
  Rejected — the developer would need to maintain two documents. The manifest was borrowed
  from Rewrite where it serves a different purpose. For upgrade, it is dead weight.
- **Generate the intake but make INTAKE CONFIRMED optional.** Rejected — the intake gate is
  the skill's only check that the developer has seen the risk surface before the skill
  touches git. Removing the gate removes the confirmation that the developer is proceeding
  with full information.
- **Run all three passes via the research agent instead of a cached knowledge file.**
  Rejected — replacement mappings are stable facts; calling the research agent for a package
  that has a known SDK replacement wastes tokens and introduces latency on every run.
  The research agent is reserved for the "unknown" case in Pass 2.

## Consequences

- `source-context-manifest.md` is no longer required for upgrade runs. Existing runs with a
  manifest on disk are unaffected — the intake generation simply supersedes the old document.
- `intake-verify.cjs` now validates the skill-generated `upgrade-intake.md` rather than the
  hand-authored manifest. The gate enforcement is unchanged; what it verifies changes.
- Per-stack knowledge files must be maintained when framework versions add new behavioral
  changes or package replacements. Knowledge-freshness checks (`/knowledge-freshness`) verify
  these files are current.
- Multi-stack repos require the developer to select which component to upgrade before
  generation begins. Each upgrade run scopes to one component with its own baseline and
  runbook (cross-component coupling is surfaced in Sections 0 and 2, not handled mid-run).

## Revisit when

- If a stack has no knowledge file and the research agent is consistently invoked for basic
  package compatibility questions, add a knowledge file for that stack.
- If the "always-render 12 sections" volume overwhelms developers on small codebases, add a
  `--brief` flag that suppresses not-applicable sections while retaining full rendering by
  default.
