# Tech Spec — Story 1: Upgrade Skill (MVP) + Minimal Inline Substrate
ADO #9000 · Story 1 · Release 1 · Sprint 1
Status: DRAFT · 21 SP

> Artifact: a new markdown skill (`skills/upgrade/`) + supporting CJS scripts + JS test fixtures.
> App-shaped template sections are mapped to the plugin's real equivalents; N/A sections state why.
> Design of record: `docs/plans/migrationSkill/upgrade.md` + README (shared substrate).

---

## Overview

Story 1 delivers the **Upgrade** skill: in-place, same-stack, version → higher-version migration in
which the LLM is an **orchestrator of a deterministic upgrade tool** (`dotnet upgrade-assistant`,
`ng update`, OpenRewrite, `pyupgrade`), never a generative author. The headline deliverable is a
**decision-grade Gap + Risk report**, not the code change — the skill delivers value even if the
developer stops after the report. Execution (when the developer proceeds) is made safe by a
pre-upgrade **baseline tag** (the oracle anchor), a working **branch**, and **one commit per version
hop** (bisectable). A **false-upgrade guard** rejects cross-runtime changes (e.g. .NET Framework →
.NET) and routes them to Rewrite. This story also lands the **minimal inline substrate** needed to
run one skill — a checkpoint envelope, gate-keyword grammar, the feasibility spine
(GREEN/YELLOW/RED/BLOCKER), model-routing, and a minimal LLM-as-judge — **without** extracting it to
`skills/shared/` yet (extraction is deferred to Story 2 per rule-of-three).

Governing pattern: LLM-orchestrates-deterministic-tool + baseline-oracle verification + graceful
degradation (a RED verdict still yields a decision-grade report).

---

## AC Coverage Matrix

Every AC from the ICEA must be covered by at least one file change. Every file change must satisfy
at least one AC. Gaps are flagged ⚠.

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F1 | Classify stack+version; reject false-upgrades → route to Rewrite | `skills/upgrade/SKILL.md`, `skills/upgrade/references/classification.md`, `scripts/upgrade-classify.cjs` | ✅ Covered |
| AC-F2 | Tool-availability preflight + per-tool/OS install & verify guidance; never bundle | `skills/upgrade/references/tool-matrix.md`, `scripts/upgrade-tool-preflight.cjs`, `skills/upgrade/SKILL.md` | ✅ Covered |
| AC-F3 | Web-grounded, source-verified, cached gap/risk report; baseline tag + branch + commit-per-hop; verify vs baseline oracle | `skills/upgrade/references/gap-risk-report.md`, `scripts/upgrade-orchestrate.cjs`, `scripts/upgrade-knowledge-cache.cjs`, `skills/upgrade/SKILL.md` | ✅ Covered |
| AC-F9 (◐ inline) | Minimal LLM-as-judge (separate model) per gate | `skills/upgrade/references/judge-inline.md` | ✅ Covered (inline; extracted in Story 2) |
| AC-F10 (◐ inline) | Minimal checkpoint envelope (upgrade payload) | `skills/upgrade/references/checkpoint-inline.md`, `scripts/upgrade-checkpoint.cjs` | ✅ Covered (inline; extracted in Story 2) |
| AC-NF1 | `tests/validate.js` green after merge | `tests/fixtures/upgrade/*`, `tests/upgrade.test.cjs` | ✅ Covered |
| AC-NF2 | Write Gate on all source/config writes | (process — enforced by existing hook; no new file) | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `skills/upgrade/SKILL.md` | AC-F1, AC-F2, AC-F3 |
| `skills/upgrade/references/classification.md` | AC-F1 |
| `scripts/upgrade-classify.cjs` | AC-F1 |
| `skills/upgrade/references/tool-matrix.md` | AC-F2 |
| `scripts/upgrade-tool-preflight.cjs` | AC-F2 |
| `skills/upgrade/references/gap-risk-report.md` | AC-F3 |
| `scripts/upgrade-orchestrate.cjs` | AC-F3 |
| `scripts/upgrade-knowledge-cache.cjs` | AC-F3 |
| `skills/upgrade/references/judge-inline.md` | AC-F9 |
| `skills/upgrade/references/checkpoint-inline.md`, `scripts/upgrade-checkpoint.cjs` | AC-F10 |
| `tests/upgrade.test.cjs`, `tests/fixtures/upgrade/*` | AC-NF1 (verifies AC-F1/F2/F3) |

**Coverage result:** all 7 ACs covered; no orphaned file changes ✅.

---

## Files Changed

> Plugin artifact — no controllers/DTOs/views. Files are markdown skill assets, CJS scripts, and JS
> tests. Detection reuses `scripts/migration-source-detect.cjs` (raven, ADR 0060) — not re-created.

| File | Type | Purpose |
|---|---|---|
| `skills/upgrade/SKILL.md` | new | Skill entry: stage flow (detect → classify → plan version path → gap/risk report → [proceed] baseline tag + branch → orchestrate commit-per-hop → residual remediation → verify → recommendations); model-routing note; hard rules |
| `skills/upgrade/references/classification.md` | new | False-upgrade taxonomy (cross-runtime rejections) + multi-hop version-path planning rules (e.g. Java 8→11→17→21; Angular one major at a time) |
| `skills/upgrade/references/tool-matrix.md` | new | Per-stack deterministic tool, coverage rating, residual load, and per-tool/OS install + verify steps (script-transparency 5-point format) |
| `skills/upgrade/references/gap-risk-report.md` | new | Report schema: possible/blocked/manual; per-item GREEN/YELLOW/RED/BLOCKER (feasibility spine); dependency ledger; VERIFIED/INFERRED source tags; post-upgrade next steps |
| `skills/upgrade/references/judge-inline.md` | new | Minimal LLM-as-judge rubric + per-gate verdict grammar (PASS/REVISE/BLOCK); separate-model routing note (extracted to shared in Story 2) |
| `skills/upgrade/references/checkpoint-inline.md` | new | Minimal checkpoint envelope shape + upgrade payload (`hops[]`, `baseline_tag`, `gate_verdicts`) (extracted to shared in Story 2) |
| `scripts/upgrade-classify.cjs` | new | Deterministic classifier: from detected stack+version, returns `upgrade` / `false-upgrade→rewrite` / `unsupported` |
| `scripts/upgrade-tool-preflight.cjs` | new | Probes tool presence + version; on missing emits copy-pasteable install/verify steps; exit code signals available/installable/absent |
| `scripts/upgrade-knowledge-cache.cjs` | new | Web-grounding + verify + cache engine: stable delta-KB (`{stack,from,to}`, immutable) + volatile tool layer (TTL); every claim tagged VERIFIED/INFERRED with dated source |
| `scripts/upgrade-orchestrate.cjs` | new | Drives baseline tag + branch, invokes the stack tool per hop, one commit per hop, runs verify vs baseline oracle |
| `scripts/upgrade-checkpoint.cjs` | new | Reads/writes the minimal checkpoint (single-writer, merge-write) |
| `commands/upgrade.md` + `.claude-plugin/plugin.json` | modify | Register the `/upgrade` command + skill metadata |
| `CLAUDE.md` §0a | modify | Add `UPGRADE ADO-{ID}` keyword handler |
| `tests/upgrade.test.cjs` | new | Fixture-driven tests (see Test Cases) |
| `tests/fixtures/upgrade/{dotnet,angular,java,python,node,false-upgrade}/` | new | Known-version fixture repos incl. a .NET Framework false-upgrade case |

---

## Schema Changes

N/A — no database. (Section intentionally present to state N/A because reviewers expect it; the
checkpoint is a JSON file, documented under `checkpoint-inline.md`, not a DB schema.)

---

## Auth & Security

**Auth pattern:** N/A — runs in the developer's Claude Code session. No new secrets/env vars.

**Security / safety analysis (Upgrade-specific):**

| Concern | Mitigation |
|---|---|
| Misrouting a false-upgrade → mutating a working app across a runtime boundary | `upgrade-classify.cjs` rejects cross-runtime changes and routes to Rewrite before any edit (AC-F1) |
| In-place residual remediation editing working code | Each LLM fix passes the **Write Gate** (`APPROVE ADO-9000`); baseline-oracle regression net catches behavior change (AC-NF2, AC-F3) |
| Running an unvetted install command from the tool-preflight output | Preflight only **emits** install steps (script-transparency 5-point format) for the developer to run — it never executes them (LLM authors, human executes) |
| Fabricated breaking-change facts from model memory | Cache tags every claim VERIFIED (authoritative source, dated) or INFERRED; report surfaces the tag (AC-F3) |
| Unsupported stack with no tool | Report states which side of the coverage line the project sits on; no silent proceed |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Stack detected but target version is a cross-runtime jump (false-upgrade) | Classification **rejects**: "Not an in-place upgrade — {source}→{target} crosses the runtime boundary. Routing to Rewrite." No edits made. |
| Deterministic tool not installed | Not a failure — preflight emits exact install + verify steps (per tool/OS), the skill **pauses**, and re-checks after the developer installs. |
| Source stack has no mapping/tool reference | HARD STOP listing supported stacks; no fabrication. |
| A version hop breaks a baseline-oracle test | The offending hop is isolated (one commit per hop); the report pins the exact hop and offers resolution options; no merge until verify passes. |
| Web-grounding unreachable and cache empty | Report marks affected items INFERRED and lowers confidence; recommends re-run when connectivity returns; still emits a partial decision-grade report. |
| Residual remediation exceeds a sane ceiling | Auto-stop → hand back to developer with the residual list (mirrors Rewrite's goal-loop escalation). |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F1 | Classifier + false-upgrade taxonomy + multi-hop path planning | 5 |
| AC-F2 | Tool preflight script + per-tool/OS matrix + guidance | 3 |
| AC-F3 | Gap/risk report schema + web-grounding/verify/cache engine + orchestration (baseline tag/branch/commit-per-hop) + baseline-oracle verify | 8 |
| AC-F9/F10 (inline) | Minimal judge + checkpoint envelope | 3 |
| AC-NF1 | Fixtures + `tests/validate.js` integration | 2 |
| **Total** | | **21** |

**Total SP: 21**
**Type: STORY** (child of EPIC ADO-9000) — a whole skill; larger than the ≤5 SP app-feature
heuristic by design. Decomposed into implementation tasks at `IMPLEMENT ADO-9000 Story-1`.

---

## Definition of Done

**Implementation**
- [ ] All files in Files Changed created/modified as specified
- [ ] No hardcoded secrets, connection strings, or credentials
- [ ] No `console.log` / diagnostic output in the CJS scripts (production paths)
- [ ] Every script that asks the developer to run something displays the script-transparency 5 points
- [ ] `// DECISION:` comments on non-trivial choices in the CJS scripts (classifier routing, cache volatility split)

**Quality**
- [ ] Positive + negative unit tests pass (see Test Cases)
- [ ] Integration tests (fixture repos) pass, incl. false-upgrade rejection and graceful RED
- [ ] `node tests/validate.js` = 0 failures (AC-NF1)
- [ ] Regression: existing skills unaffected (Upgrade is additive; no `skills/shared/` change in Story 1)

**Review readiness**
- [ ] PR title: `[ADO-9000] Upgrade skill (Story 1) — in-place tool-orchestrated migration`
- [ ] PR description maps each changed file to its ACs (AC Coverage Matrix)
- [ ] ICEA + this story spec committed in the feature branch

### Reviewer Checklist

- [ ] Classifier rejects EVERY cross-runtime fixture (.NET Framework→.NET, AngularJS→Angular, Py2→3, WebForms→Blazor)
- [ ] Orchestration produces exactly one commit per version hop (bisectable)
- [ ] Baseline tag is created BEFORE any edit and used as the verify oracle
- [ ] Report tags every breaking-change claim VERIFIED/INFERRED with a dated source
- [ ] Preflight never executes install commands — only emits them
- [ ] Inline substrate is genuinely minimal (no premature `skills/shared/` abstraction)

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None. | — | — | Resolved |

> Cache format/location and residual-remediation ceiling were resolved in design
> (`docs/plans/migrationSkill/upgrade.md` §1.4–§1.8): cache lives in the (minimal inline) substrate
> as delta-KB + volatile layer; residual remediation has an auto-stop ceiling.

---

## Request Flow

```
UPGRADE ADO-{ID}
  → migration-source-detect.cjs (reuse) → stack + current version
  → upgrade-classify.cjs → {upgrade | false-upgrade→Rewrite | unsupported}
       ├─ false-upgrade → STOP, route to Rewrite (no edits)
       └─ upgrade →
  → plan multi-hop version path
  → upgrade-tool-preflight.cjs → {available | emit install steps + pause | absent→report}
  → upgrade-knowledge-cache.cjs → web-grounded, source-verified gap/risk facts
  → EMIT decision-grade Gap+Risk report  (value delivered even if developer stops here)
  → [developer proceeds] baseline TAG + working branch
  → upgrade-orchestrate.cjs → run tool per hop → ONE commit per hop
  → LLM residual remediation (each fix behind Write Gate)
  → verify vs baseline oracle (tests + optional golden-master)
  → post-upgrade recommendations (ladder → Rewrite / Replatform)
  → checkpoint written at each gate (single-writer, merge-write)
```

---

## Rollback

Purely additive at the plugin level — Upgrade is new files under `skills/upgrade/`, `scripts/`,
`tests/` plus two metadata edits. Rollback = revert the feature-branch merge and re-run
`node tests/validate.js` (0 failures). A migration *run* the skill performs is itself reversible via
the baseline tag + branch it creates (a runtime concern, not an epic-rollback concern).

---

## Handover

### QA Team
Fixture repos live under `tests/fixtures/upgrade/`. To test: point the skill at each fixture; assert
classification, tool selection, baseline-tag + commit-per-hop, and a well-formed report; confirm the
`false-upgrade/` fixture is rejected and routed to Rewrite; confirm a RED verdict still yields a
report. No external network — grounding is mocked/cached in tests.

### DevOps / Platform Team
No new runtime infra, secrets, or env vars. New CI expectation: `node tests/validate.js` stays green.
Deterministic upgrade tools are **not** bundled — they are the developer's responsibility, guided by
the preflight.

### Future Developer — Follow-on Work
The inline substrate (`judge-inline.md`, `checkpoint-inline.md`, `upgrade-checkpoint.cjs`) is
**deliberately local** to `skills/upgrade/`. In Story 2 it is extracted to `skills/shared/` at the
second consumer (Rewrite). Do not extract earlier — the rule-of-three has not been met with one
consumer. When extracting, preserve the checkpoint core as additive-only.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `upgrade-classify.cjs` | stack=dotnet(core) 6, target 8 | classification `upgrade`, tool `dotnet upgrade-assistant` | AC-F1 |
| P-U2 | `upgrade-classify.cjs` | stack=java 8, target 21 | `upgrade`, multi-hop path 8→11→17→21 | AC-F1 |
| P-U3 | `upgrade-tool-preflight.cjs` | tool installed, compatible version | status `available`, no install steps emitted | AC-F2 |
| P-U4 | `upgrade-knowledge-cache.cjs` | `{dotnet,6,8}` with authoritative source | fact cached, tagged VERIFIED with dated source | AC-F3 |
| P-U5 | `upgrade-orchestrate.cjs` | 2-hop plan | baseline tag created first; exactly 2 commits, one per hop | AC-F3 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `upgrade-classify.cjs` | stack=dotnet_framework 4.8, target dotnet 8 | `false-upgrade→rewrite`; no edit path returned | AC-F1 |
| N-U2 | `upgrade-classify.cjs` | stack with no mapping reference | `unsupported`; hard-stop message; no fabrication | AC-F1 |
| N-U3 | `upgrade-tool-preflight.cjs` | tool absent | status `installable`; emits install+verify steps; never executes them | AC-F2 |
| N-U4 | `upgrade-knowledge-cache.cjs` | no authoritative source found | fact tagged INFERRED (not VERIFIED); confidence lowered | AC-F3 |
| N-U5 | `upgrade-orchestrate.cjs` | a hop fails baseline-oracle verify | no merge; failing hop pinned; resolution options returned | AC-F3 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | .NET Core fixture upgrade | run skill on `fixtures/upgrade/dotnet` target 8 | report emitted; branch off baseline tag; commit-per-hop; verify passes | AC-F1/F2/F3 |
| INT-2 | False-upgrade rejection | run skill on `fixtures/upgrade/false-upgrade` (Framework→Core) | rejected + routed to Rewrite; zero edits | AC-F1 |
| INT-3 | Missing tool | run skill with tool uninstalled | install guidance emitted; skill pauses; re-check succeeds after mock install | AC-F2 |
| INT-4 | Graceful RED | run skill on a fixture with a hard BLOCKER dependency | decision-grade report with RED + options; no unsafe proceed | AC-F3 |

> NF AC verification:
> AC-NF1 (`tests/validate.js` green): verified by CI run — 0 failures after merge.
> AC-NF2 (Write Gate): verified by inspection — no source/config write occurs before `APPROVE ADO-9000`; residual-remediation edits each pause on the Write Gate.

---

### Revision Log
2026-09-07 — Story 1 (Upgrade) tech spec drafted from ADO-9000 ICEA + upgrade.md.
