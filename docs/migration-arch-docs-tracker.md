# Migration Skill — Architecture Documents Tracker

**Purpose:** Track the definition and status of all architecture documents created by the migration skill.
**Last updated:** 2026-08-05 (revised stage structure agreed)
**Resume with:** "Let's continue with the migration architecture documents tracker"

---

## Context

The migration skill creates architecture documents in two groups:
- **Migration process docs** (temporary, for the migration execution)
- **Target application docs** (permanent, describe the new app)

Document specifications were moved OUT of SKILL.md into `skills/migration/references/specs/` so SKILL.md stays lean and each spec is loaded only at the phase that needs it.

---

## Agreed: specs/ File Structure

```
skills/migration/references/specs/
  ├── target-app-architecture-spec.md    ← Phase -1 loads this
  ├── feasibility-spec.md                ← Phase 0.5 loads this
  ├── phase1-architecture-spec.md        ← Phase 1 loads this (8 docs)
  ├── integration-contract-spec.md       ← Phase 1 loads this (two-track only)
  └── migration-report-spec.md           ← Phase 4 loads this
```

Each spec file defines the FORMAT and REQUIRED SECTIONS of its documents.
SKILL.md loads the spec, generates the document, then the spec leaves context.

---

## Document Status

### Group 1 — Migration Process Documents

| # | Document | Phase | Spec File | Status |
|---|---|---|---|---|
| 1 | `TARGET-APP-ARCHITECTURE.md` | Stage 1 | `target-app-architecture-spec.md` | ✅ Spec file written — compact standards reference for Stage 4 cluster agents |
| 2 | `MIGRATION-FEASIBILITY.md` | Stage 2 | `feasibility-spec.md` | ✅ Spec file written — GREEN/YELLOW/RED tables, dependency ledger, architecture alignment |
| 3 | `TARGET-ARCHITECTURE.md` | Stage 3 | `phase1-architecture-spec.md` | ✅ Cluster spec format in phase1-architecture-spec.md |
| 4 | `MIGRATION-REPORT.md` | Stage 6 | `migration-report-spec.md` | ✅ Spec file written — clusters, behavioral diffs, E2E results, coverage, residual risks |

### Group 2 — Target Application Architecture Documents (Permanent)

| # | Document | Phase | Spec File | Status | Discussion |
|---|---|---|---|---|---|
| 5 | `INTEGRATION-CONTRACT.md` | Phase 1 (two-track) | `integration-contract-spec.md` | ⏳ Content defined in `shared/fullstack-integration.md` — needs spec file | — |
| 6 | `COMPONENT-ARCHITECTURE.md` (HLD) | Stage 1 | `phase1-architecture-spec.md` | ✅ Spec written — C4 L1+L2 Mermaid, tech stack table, layer diagram, external deps, ADR per component |
| 7 | `DATA-ARCHITECTURE.md` | Stage 1 | `phase1-architecture-spec.md` | ✅ Spec written — entity inventory, ER diagram (Mermaid), data flow sequence (Mermaid), PII inventory, ADR |
| 8 | `SECURITY-ARCHITECTURE.md` | Stage 1 | `phase1-architecture-spec.md` | ✅ Spec written — auth flow sequence (Mermaid), authorization model, secrets, data protection, threat model, ADR |
| 9 | `INFRASTRUCTURE-ARCHITECTURE.md` | Stage 1 | `phase1-architecture-spec.md` | ✅ Spec written — hosting topology (Mermaid), CI/CD flow (Mermaid), environment map, observability, ADR |
| 10 | `ARCHITECTURE-DECISIONS.md` | Stage 1 | `phase1-architecture-spec.md` | ✅ Spec written — ADR log format, initial ADRs from docs 6-9, cross-reference convention |

**Status legend:** ✅ Spec file written · ⏳ Content agreed, spec file not yet written · ❌ Content not yet defined · 🔄 In discussion

---

## Revised Stage Structure (agreed 2026-08-05)

The skill was restructured. Previous Phase -1 (6-question Q&A) eliminated. New flow:

```
Stage 0 — Understand & Confirm (minimal Q&A)
  → Read source: stack, graph, architecture docs, dependencies
  → Display source analysis summary to developer
  → Ask ONLY 3 questions: target platform, cloud/hosting, hard constraints
  → Confirm TARGET spec before Stage 1

Stage 1 — Design Target Architecture (AI proposes, user reviews)
  → Read source in detail (clusters from graph, source architecture docs)
  → Propose ALL architecture documents (see list below) with:
      - Mermaid diagrams (system context C4-L1, component map C4-L2,
        data flow, auth flow, deployment topology)
      - ADR per component: recommendation + options considered + why rejected + benefits
  → Ask targeted questions ONLY when genuinely ambiguous — never assume
  → Developer reviews and approves or requests revisions
  → Gate: APPROVE ARCHITECTURE ADO-{ID}

Stage 2 — Migration Feasibility
  → Assess source → approved target (GREEN/YELLOW/RED)
  → Gate: APPROVE FEASIBILITY ADO-{ID}

Stage 3 — Cluster Plan + Executable Specs
  → Derive cluster plan from graph + approved architecture
  → Per-cluster executable specs for Stage 4 agents

Stage 4+ — Parallel Cluster Migration
  → Branch per cluster, worktree isolation, build + test
  → Integration pass, E2E tests, migration report
```

**Core principle:** Minimal questions upfront. If more information is needed during architecture design, ask that specific question at that specific decision point. Never assume.

---

## Where We Left Off

**Agreed on:**
1. Revised stage structure (show source first, ask minimal questions, then propose architecture)
2. `specs/` reference file structure for document format specifications
3. Mermaid diagrams required for all architecture documents
4. ADR-style justification per component (recommendation + options considered + benefits)

**Next action:** Rewrite SKILL.md v1.5 with the new stage structure, then define the format specifications for each document (docs 6–10 content).

After SKILL.md is rewritten, resume defining document content in this order:
1. `COMPONENT-ARCHITECTURE.md` — system context + component map (C4 L1+L2 in Mermaid)
2. `DATA-ARCHITECTURE.md` — ER diagram + data access patterns
3. `SECURITY-ARCHITECTURE.md` — auth flow diagram + authorization model
4. `INFRASTRUCTURE-ARCHITECTURE.md` — deployment topology diagram
5. `ARCHITECTURE-DECISIONS.md` — ADR format and which decisions get captured

---

## Completed Tasks

| Task | Status |
|---|---|
| Create `specs/target-app-architecture-spec.md` | ✅ Done |
| Create `specs/feasibility-spec.md` | ✅ Done |
| Create `specs/phase1-architecture-spec.md` | ✅ Done (docs 3, 6, 7, 8, 9, 10) |
| Create `specs/integration-contract-spec.md` | ✅ Done |
| Create `specs/migration-report-spec.md` | ✅ Done |
| Rewrite SKILL.md v1.5 with Stage 0–6 structure | ✅ Done |
| Define docs 6–10 content (component, data, security, infra, ADRs) | ✅ Done |

## 3-Iteration Review Findings (42 total — 2026-08-05)

Review ran via Workflow with 3 parallel agents + synthesis. Resume discussion with:
**"Let's continue reviewing migration skill findings"**

### Findings Review Status

| ID | Severity | Title | Status |
|---|---|---|---|
| B-01 | BLOCKER | Not in source-file-consent.md or personas-spec.md tables | ✅ Approved |
| B-02 | BLOCKER | Write Gate uses `APPROVE MIGRATION` instead of `APPROVE ADO-{ID}` | ✅ Approved — (1) replace `APPROVE MIGRATION ADO-{ID}` with `APPROVE ADO-{ID}` in SKILL.md; (2) add migration checkpoint exemption to `icea-floor.cjs`: if `.claude/migration-checkpoint.json` exists with `stage !== 'complete'` bypass 8-hour window entirely; (3) migration feasibility doc must include `Status: ✅ Approved` after APPROVE FEASIBILITY for short migrations within 8h |
| B-03 | BLOCKER | Stage gate keywords not in `_project-deploy/CLAUDE.md §0a` | ✅ Approved — `APPROVE ARCHITECTURE`/`APPROVE FEASIBILITY` are in-session replies (no §0a entry needed); `MIGRATE RESUME` stays in §0a; add `migration-keyword-hook.cjs` UserPromptSubmit hook for deterministic cross-session recovery (hook reads `input.prompt`, injects checkpoint + SKILL.md section before Claude responds) |
| B-04 | BLOCKER | `Codebase Orientation` circular `$PLUGIN_DIR` bootstrap | ✅ Approved — create `plugin-dir-context.cjs` UserPromptSubmit hook: reads plugin-path.txt, injects `PLUGIN_DIR: {path}` into every message context; fallback runs Node.js scanner + writes plugin-path.txt; remove resolution bash block from Step 0.1; remove circular text from Codebase Orientation; Claude inlines literal path into bash commands (no shell var scope issues) |
| B-05 | BLOCKER | `{port}` placeholder never defined — E2E healthchecks fail | ✅ Approved — Option B: define default port per target stack table (.NET=5000, Spring Boot=8080, Node.js=3000, Angular=4200); resolve after Q1 answer; store in checkpoint; ask only if ambiguous (e.g. API + frontend both need ports) |
| B-06 | BLOCKER | `{Name}` app name never defined — all dotnet commands fail | ⏳ Pending discussion |
| B-07 | BLOCKER | Python stack silently fails (no matrix row, no stop message) | ⏳ Pending discussion |
| H-01 | HIGH | `TARGET-APP-ARCHITECTURE.md` never generated | ⏳ Pending |
| H-02 | HIGH | `integration-contract-spec.md` never loaded; wrong spec loaded | ⏳ Pending |
| H-03 | HIGH | Context budget check missing required parameters | ⏳ Pending |
| H-04 | HIGH | Git commands hardcode Windows path `C:/Program Files/Git/...` | ⏳ Pending |
| H-05 | HIGH | Checkpoint missing: release, sprint, app_name, target_stack, docs_path | ⏳ Pending |
| H-06 | HIGH | `MIGRATE RESUME [CLUSTER-NAME]` doesn't match §0a `[BACKEND\|FRONTEND]` | ⏳ Pending |
| H-07 | HIGH | Shell quoting broken for SOURCE_PATH with spaces | ⏳ Pending |
| H-08 | HIGH | No fallback for zero-cluster graph result; empty SharedKernel guard missing | ⏳ Pending |
| H-09 | HIGH | `{sha}` in agent prompts never substituted with actual branch SHA | ⏳ Pending |
| H-10 | HIGH | `appsettings.Development.json` pre-flight misleading when file missing | ⏳ Pending |
| H-11 | HIGH | `.NET → Java` in Q1 matrix has no implementation | ⏳ Pending |
| H-12 | HIGH | FRONTEND cluster agent not defined | ⏳ Pending |
| H-13 | HIGH | API contract preservation (Q3) has no downstream enforcement | ⏳ Pending |
| H-14 | HIGH | No guard against cluster agent writing to Program.cs | ⏳ Pending |
| H-15 | HIGH | No merge conflict resolution procedure in Stage 4 | ⏳ Pending |
| H-16 | HIGH | Entra ID E2E credentials never collected or checked | ⏳ Pending |
| H-17 | HIGH | Stage 1 ADR format conflicts with phase1-architecture-spec.md | ⏳ Pending |
| H-18 | HIGH | `icea-status` incompatible with migration tracker format | ⏳ Pending |
| M-01 | MEDIUM | Skeleton generates `appsettings.json` but Stage 6 checks `appsettings.Development.json` | ⏳ Pending |
| M-02 | MEDIUM | `additionalDirectories` script write block has no error handling | ⏳ Pending |
| M-03 | MEDIUM | Angular unit test framework unspecified; Karma fails headless | ⏳ Pending |
| M-04 | MEDIUM | Playwright install uses interactive `npm init` command | ⏳ Pending |
| M-05 | MEDIUM | Q2 "Local / dev only" has no fallback in infrastructure arch doc | ⏳ Pending |
| M-06 | MEDIUM | Stage 5.1 doesn't instruct reading feasibility doc on resume | ⏳ Pending |
| M-07 | MEDIUM | Stage 1 revision loop spec is incomplete | ⏳ Pending |
| M-08 | MEDIUM | "Genuine ambiguity" for developer questions is undefined | ⏳ Pending |
| M-09 | MEDIUM | Stage 1 document spec source-of-truth is ambiguous | ⏳ Pending |
| M-10 | MEDIUM | Frontend E2E `cd web` assumes undocumented `web/` path | ⏳ Pending |
| M-11 | MEDIUM | `README.md` missing from cluster FORBIDDEN list | ⏳ Pending |
| M-12 | MEDIUM | `RETRY CLUSTER` flow undocumented; branch deletion destroys partial work | ⏳ Pending |
| M-13 | MEDIUM | `docs/migration-arch-docs-tracker.md` untracked and undocumented | ⏳ Pending |
| L-01 | LOW | `phase1-architecture-spec.md` loaded twice | ⏳ Pending |
| L-02 | LOW | `find` commands rely on model-level substitution for quoting | ⏳ Pending |
| L-03 | LOW | Checkpoint uses `schema_version` vs shared spec `_schema` | ⏳ Pending |
| L-04 | LOW | Frontend start assumes `ng serve` without confirming script name | ⏳ Pending |

**Approved so far: B-01, B-02**
**Next to discuss: B-03**

### Full findings detail: see workflow output file
`C:\Users\rawatv\AppData\Local\Temp\claude\...\tasks\wsi0oydwk.output`

---

## Key Design Decisions (already agreed)

| Decision | Choice | Rationale |
|---|---|---|
| Run skill from | TARGET project folder | `isolation:"worktree"` works correctly; git branches are in TARGET |
| SOURCE_PATH | Registered in additionalDirectories | Plugin infrastructure sees source files for analysis |
| Phase 2 agents | One branch per cluster in TARGET | Independently buildable/testable; no race conditions |
| SharedKernel | Sequential before parallel clusters | All clusters depend on it |
| E2E tests | Generated Phase 3, run headless Phase 4 via Bash | Zero LLM tokens during test execution |
| Document specs | In references/specs/ not SKILL.md | Context budget — specs loaded once per phase, then out of context |
| Phase -1 Q&A | Defines auth, infra, security, observability, API standards | All Phase 2 agents apply these standards without re-reading |

---

## Reference

- Migration skill: `skills/migration/SKILL.md` (v1.4)
- Architecture doc: `docs/migration-architecture.md` (human reference)
- Stack files: `skills/migration/references/stacks/`
- Mapping files: `skills/migration/references/mappings/`
- Shared refs: `skills/migration/references/shared/`
