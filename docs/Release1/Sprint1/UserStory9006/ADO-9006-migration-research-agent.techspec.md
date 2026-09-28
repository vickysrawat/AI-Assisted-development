# Epic Tech Spec — Migration Research Agent + Options Phase PO Framework
ADO #9006 · Release 1 · Sprint 1
Status: DRAFT · EPIC · 16 SP total

---

## Overview

This epic introduces `skills/migration-research-agent/SKILL.md` — a new Claude subagent that grounds the migration options analysis in cited external facts and adds a Product Owner (PO) decision framework to the existing rewrite, upgrade, and replatform skills' options phases. The agent accepts two discrimination modes: `rewrite/upgrade` (per-layer lifecycle EoL, CVE exposure, ecosystem health, hiring trend, tooling availability) and `replatform` (per-cloud-component pricing range, SLA, GA status, compliance certifications, data egress signal). All research uses WebFetch-only with no MCP, no IAM, and no cloud account dependency across three providers: Azure, AWS, and GCP. The PO framework — (a) what happens if not resolved, (b) tradeoffs, (c) whether it can remain, (d) how to verify success — is added to the options sections of the three migration calling skills, populated from the agent's confidence-annotated bundle where groundable and marked `[project-specific]` where internal data is required.

All deliverables are SKILL.md and Markdown spec files — no scripts, no compiled code, no DB migrations, no deployment changes. Rollback = revert the feature branch.

**Scope boundary:** BigQuery MCP, real-time NVD CVE counts, project-specific TCO calculation, bc-searcher integration, and agent session caching are explicitly out of scope (ICEA Out of Scope).

---

## Story Breakdown

All implementation detail (AC Coverage Matrix, Files Changed, Test Cases) lives in each story's individual tech spec linked below.

| Story | Title | SP | Shippable alone? | Depends on | Tech Spec | Status |
|---|---|---|---|---|---|---|
| 1 | Agent — rewrite/upgrade mode | 3 | Yes | None | ADO-9006-Story-1-agent-rewrite-upgrade.techspec.md | Pending |
| 2 | Agent — replatform mode | 3 | Yes | Story 1 (same SKILL.md extended) | ADO-9006-Story-2-agent-replatform.techspec.md | Pending |
| 3 | Shared spec + [SA] persona | 3 | Yes | Story 2 (documents both agent modes) | ADO-9006-Story-3-shared-spec-persona.techspec.md | Pending |
| 4 | rewrite + upgrade calling skill enrichment | 4 | Yes | Story 3 (parallel with Story 5) | ADO-9006-Story-4-rewrite-upgrade-skills.techspec.md | Pending |
| 5 | replatform calling skill enrichment | 3 | Yes | Story 3 (parallel with Story 4) | ADO-9006-Story-5-replatform-skill.techspec.md | Pending |

> Story 1 owns the new agent SKILL.md directory and the rewrite/upgrade discriminated union mode — the foundational design. Story 2 extends the same SKILL.md with the replatform mode (separate discriminated union branch). Story 3 writes the canonical spec document and adds the [SA] persona — calling skills in Stories 4 and 5 reference this spec when invoking the agent and rendering its output. Stories 4 and 5 both depend on Story 3 but are independent of each other and can run in parallel.
>
> AC-F3 (confidence rendering) is split: Story 4 covers rewrite + upgrade calling skills; Story 5 covers replatform calling skill. Each story's AC Coverage Matrix identifies which portion it covers.
>
> Stories broken by logical completion — each is a shippable slice (<=5 SP). Never broken by AC.

---

## Auth & Security

**Authentication pattern:** None — all changes are SKILL.md and Markdown files. The agent uses WebFetch on public canonical URLs only. No credentials, API keys, or user data involved.

**Authorisation:** Not applicable — plugin skills are invoked by the developer in their own Claude Code session.

**Cross-cutting security concerns:**

| Concern | Mitigation |
|---|---|
| WebSearch/WebFetch queries expose internal identifiers | Queries must contain only publicly recognisable technology terms — no internal class names, file paths, variable names, or org-specific terms (AC-NF2). Enforced by design in agent SKILL.md query examples; verifiable by static inspection. |
| Low-confidence facts presented as authoritative | Confidence rendering rules (AC-F3, AC-F7): `confidence=high` facts stated with source URL and retrieved date; `medium` rendered as `(industry benchmark as of {date})`; `low` and `UNKNOWN` rendered with a warning marker and canonical URL — never stated as established fact. |
| Agent accessing project source files | Agent isolation: migration-research-agent has no codebase access tools available. Project-specific facts that require internal data are always returned as `[project-specific — requires your input]` placeholders (ICEA E5, Constraint Context). |
| BigQuery MCP scope leakage | BigQuery MCP is explicitly excluded (ICEA Constraint Context). Agent SKILL.md must not reference or invoke it. Verifiable by inspection. |

---

## Overall Request Flow

```
Developer invokes migration skill (/rewrite, /upgrade, or /replatform)
  |
  |-[Stories 4-5] Skill options phase preamble
  |    Constructs discriminated union input:
  |      rewrite/upgrade: { migration_type, source_layers[], target_layers[] }
  |      replatform:      { migration_type, source_environment, target_environment }
  |    Invokes Agent tool --> migration-research-agent/SKILL.md (SINGLE subagent call)
  |
  |-[Stories 1-2] migration-research-agent/SKILL.md
  |    For each layer/component:
  |      WebFetch canonical URL per provider/stack lookup strategy
  |      --> { status, value, source_url, retrieved_date, confidence } per fact
  |    Returns: structured JSON bundle (one entry per layer/component, all facts cited)
  |
  +-[Stories 4-5] Calling skill renders from bundle:
       Confidence rendering (AC-F3):
         high    --> stated fact with citation "[source, YYYY-MM-DD]"
         medium  --> "(industry benchmark as of {date})"
         low     --> "WARNING: {claim} -- unverified, check: {canonical URL}"
         UNKNOWN --> "WARNING: {fact type} not found -- check: {canonical URL}"
       PO framework sections per option:
         (a) What happens if not resolved  -- grounded by lifecycle/CVE signals
         (b) Tradeoffs                     -- grounded by ecosystem/TCO signals
         (c) Whether it can remain         -- grounded or [project-specific]
         (d) How to verify success         -- grounded or [project-specific]
```

---

## Rollback

**Schema migrations:** None.

**Rollback procedure:**
1. Revert the feature branch merge in the main branch
2. Plugin reads SKILL.md at runtime — rollback takes effect immediately on next invocation (no compilation, no caching step)
3. Verify by running any migration skill and confirming agent invocation preamble is absent and PO framework sections have been removed

**Per-story rollback:** Each story is an independent Markdown file create or modify. Revert by reverting the story's commit.

---

## Handover

### QA Team

**What was added:**
- New skill: `skills/migration-research-agent/SKILL.md` — rewrite/upgrade mode (Story 1) and replatform mode (Story 2)
- New spec: `skills/shared/migration-research-spec.md` — discriminated union schema, per-mode output bundle, confidence rendering rules, per-provider lookup strategy table (Story 3)
- Modified: `skills/shared/personas-spec.md` — [SA] Solution Architect entry (Story 3)
- Modified: `skills/rewrite/SKILL.md`, `skills/upgrade/SKILL.md` — agent invocation preamble, confidence rendering, PO framework sections (Story 4)
- Modified: `skills/replatform/SKILL.md` — agent invocation preamble, confidence rendering, PO framework sections (Story 5)

**Test entry points:**
- Story 1: Invoke `/rewrite` or `/upgrade` on a well-known stack (e.g. Angular 15 to React 18; .NET 6 to .NET 10). Verify: (i) agent subagent invoked; (ii) at least one fact per source/target layer grounded with source URL and retrieved date; (iii) UNKNOWN confidence renders with warning and canonical URL, not stated as fact.
- Story 2: Invoke `/replatform` (e.g. IIS on-prem to Azure App Service + Azure SQL MI). Verify pricing/SLA/compliance facts per component appear with source URLs and confidence levels.
- Story 3: Verify `skills/shared/migration-research-spec.md` exists with discriminated union schema, confidence rendering table, and per-provider lookup strategy. Verify `[SA]` persona entry in personas-spec.md contains background, lens, signature questions, and weigh instructions.
- Story 4: Run `/rewrite` — verify PO framework sections (a)-(d) present for each option. Run `/upgrade` — verify "what happens if not resolved" and "whether it can remain" sections present in gap+risk report.
- Story 5: Run `/replatform` — verify PO framework sections (a)-(d) present for each 6R option.

**Regression risk:** All three migration skills are modified. After each story ships verify:
- Existing options matrix structure still renders correctly (PO sections are additive)
- Upgrade gap+risk report core structure preserved (PO sections are appended)
- Agent invocation bounded to one subagent call — no chained calls (AC-NF3)
- WebSearch queries sanitized — no internal identifiers visible in SKILL.md query examples (AC-NF2)

**Test data:** Use well-known public stacks for all test inputs — agent queries must not expose internal project identifiers.

### DevOps / Platform Team

No environment variables, Key Vault secrets, pipeline changes, DB migrations, or infrastructure changes. All deliverables are Markdown files read by Claude Code at runtime.

| Item | Story | Detail |
|---|---|---|
| None | — | Pure Markdown skill files; no ops changes required |

### Future Developer — Follow-on Work

1. **Add a new stack (rewrite/upgrade mode):** Open `skills/migration-research-agent/SKILL.md`, find the rewrite/upgrade per-stack lookup strategy table, add a new row with the vendor lifecycle URL, fallback URL, and expected confidence level. Update the corresponding entry in `migration-research-spec.md`.
2. **Add a new cloud provider (replatform mode):** Add a new provider row to the per-provider lookup strategy table in both `migration-research-agent/SKILL.md` and `migration-research-spec.md`.
3. **Deferred items to revisit:** Agent session caching (V1 — deferred in ICEA); AWS central lifecycle portal (update medium-high to high if AWS publishes one); GCP BigQuery MCP (add as optional primary path if IAM requirement removed).
4. **Offline fallback tier:** `skills/shared/migration-knowledge/refs/` serves as `confidence=high` fallback when WebSearch fails for well-known stacks (ICEA Risks & Pre-Mortem mitigation). Extend this tier before considering MCP or API integrations.

---

## Definition of Done — Epic

**Delivery**
- [ ] All 5 story tech specs generated and saved (tracker shows all complete)
- [ ] All 5 stories implemented, reviewed, and merged (tracker Child ADO # filled)
- [ ] All child ADOs closed in Azure DevOps

**Quality**
- [ ] Agent returns structured bundle with source URL and retrieved date for every grounded fact (AC-NF1)
- [ ] UNKNOWN and low-confidence facts render with warning marker and canonical URL — never stated as fact (AC-F3, AC-F7)
- [ ] WebSearch/WebFetch query examples in agent SKILL.md contain only generic technology terms — no internal identifiers (AC-NF2, verifiable by inspection)
- [ ] Agent invocation bounded to single subagent call in each calling skill (AC-NF3)
- [ ] BigQuery MCP not referenced anywhere in the agent SKILL.md (ICEA Constraint Context)
- [ ] PO framework sections (a)-(d) present in all three calling skills' options output (AC-F4, AC-F5, AC-F6)
- [ ] [SA] persona entry in personas-spec.md includes background, lens (3-year fitness, full TCO, failure modes first), signature questions, weigh instructions for [TL] and [PM] (AC-F8)

**Review**
- [ ] Epic tech spec reviewed by Tech Lead
- [ ] Each story's PR maps changed files to ACs (AC Coverage Matrix in each story spec)
- [ ] ICEA and all story tech specs committed in the feature branch

---

## Reviewer Checklist

- [ ] Agent SKILL.md: discriminated union is structurally correct — rewrite/upgrade and replatform are separate input/output branches with no shared mutable state
- [ ] Agent SKILL.md: all three cloud providers (Azure, AWS, GCP) handled in both modes with lookup strategy matching migration-research-spec.md Table
- [ ] `migration-research-spec.md`: covers both modes, defines all confidence level rendering rules, documents per-provider lookup strategy
- [ ] AC-F3 (confidence rendering) covered in Story 4 (rewrite + upgrade) and Story 5 (replatform) — both stories' AC Coverage Matrix reference AC-F3
- [ ] AC-F8: [SA] persona entry present in personas-spec.md with all four required elements (background, lens, signature questions, weigh instructions)
- [ ] No story exceeds 5 SP — Story 4 is the largest at 4 SP
- [ ] Per-provider lookup strategy in spec matches what agent SKILL.md actually does (verify table parity between both documents)
- [ ] PO framework sections in all three calling skills are populated from agent bundle where possible, and clearly marked [project-specific] where internal data is needed

---

## Open Questions

None — ICEA lists no open questions.

---

## Revision Log

2026-09-26 — Epic tech spec re-derived from saved ICEA (TECH cross-session recovery) · 16 SP · 5 stories
