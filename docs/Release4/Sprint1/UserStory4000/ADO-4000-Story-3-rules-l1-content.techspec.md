# Tech Spec — Story 3: Rules as L1 content, consumed natively by both harnesses

ADO #4000 · Release 4 · Sprint 1 · Story 3 Status: DRAFT · STORY · 3 SP

> Per-story spec under the Epic ADO-4000 (LLM-Agnostic Multi-Harness Convergence). Source ICEA:
> `docs/Release4/Sprint1/UserStory4000/ADO-4000-llm-agnostic-multi-harness.icea.md` (Revision Logs
> #6/#7/#8 — asymmetric enforcement; STRUCTURE LOCKED to shared L1 content + native per-harness L2/L3, NO
> mechanical projection; prompt-artifact versioning AC-F9). Governing ACs: AC-F3, AC-F9. Epic Tech Spec:
> `temp/ADO-4000-tech.md`. This is a plugin/tooling story — Node.js CJS rule-authoring/consumption logic
> plus markdown rule authoring — NOT a web app; standard web-app sections (schema, browser→API→DB flow,
> Azure AD/CSRF) are omitted or adapted to the plugin's real architecture.

---

## Overview

This story establishes the plugin's authoring-time coding rules — including the **B1–B7 business-context taxonomy** — as **L1 content**: a single, harness-independent source under `Shared/rules/**` that both harnesses CONSUME natively. Per ICEA Revision Log #7 (STRUCTURE LOCKED), there is **NO mechanical projection** between harnesses: the delta-map / per-skill mechanical projection / runtime `$PLUGIN_DIR` bridge are RETIRED. L1 is the single source; `Claude/` and `Copilot/` each **consume** it in their own native rule mechanism, and neither re-authors it (CI guardrail, AC-F2, owned by Story 2).

Concretely for rules:

- **Claude** reads the L1 rules **natively** through its existing `.claude/rules` mechanism (project-level rule files with front-matter). A creation-critical rule uses Claude's existing `detect.always:true`, which is ALREADY in the active instruction set at new-file creation. No transform layer sits between `Shared/` and Claude — the L1 rule content is the source the Claude native rule carries.
- **Copilot** consumes the **same L1 rule content natively** into its own paths — `.github/instructions/*` (`applyTo` globs) for path-relevant rules and `CLAUDE.md` (read via `chat.useClaudeMdFile:true`, always active) for creation-critical rules. This is **authored per harness to Copilot's native shape**, NOT produced by a mechanical delta-map from the Claude form.

"Consumed natively" (not "projected") is the load-bearing distinction from earlier drafts: each harness's rule surface is written to that harness's idiom, both drawing from the one L1 rule content. The single source of truth is the L1 rule set; the two harness surfaces are native deliveries of it, not two copies and not a transform output.

The rule content itself is a **versioned L1 artifact** per AC-F9 — SemVer frontmatter (`version:`) plus a `consumes:` pin, recorded in `Shared/prompt-manifest.json` with `{version, sha256, consumes}`, and guarded by the CI bump-on-change + L1 re-author checks. **That manifest, the versioning frontmatter, and the CI checks are owned and delivered by Story 2** (the L1 content core). This story does not build the manifest or the CI check; it AUTHORS the two creation-critical rule entries as L1 content that participates in Story 2's versioning scheme, and references the manifest as the source of their version/hash record.

**Creation-critical means:** the rule must constrain the model *while it writes new code*, not only when an existing matching file is opened. The two creation-critical rules are the **Dapper-only data-access** rule (all DB access uses Dapper with parameterised SQL; never EF Core or an auto-SQL ORM) and the **no-hardcoded-secrets** rule (no secrets, connection strings, credentials, or PATs in source).

**Rule-inventory / refactor precursor (FIRST work item — the two rules do NOT exist as discrete files today).** Before establishing the L1 rule content, this story reconciles the *actual* current state, which is not what an earlier draft assumed:

- **no-hardcoded-secrets** exists today only as a bullet inside `.claude/rules/project-rules.md` (under "Code quality"). That rule file is ALREADY `paths:["**/*"]` + `detect.always:true` — i.e. it is ALREADY always-on at creation on Claude. It is NOT absent at creation on the Claude side.
- **Dapper-only** exists today as root `CLAUDE.md` prose ("## Data Access Convention") PLUS a directory-scoped `data-access-rules.md`. So it is duplicated across two homes and neither is a discrete single-source rule.

The precursor therefore: (1) EXTRACTS both statements into discrete, single-authoritative `Shared/rules/` L1 entries (e.g. `Shared/rules/no-hardcoded-secrets.md` and `Shared/rules/dapper-only.md`), each tagged creation-critical; (2) RECONCILES the existing copies so each rule has exactly ONE authoritative L1 home — no triplication. The no-hardcoded-secrets bullet is sourced from L1 and continues to be carried by the always-on `project-rules.md`-equivalent on Claude; the Dapper rule's two current copies (CLAUDE.md prose + `data-access-rules.md`) are collapsed to the single L1 source, with the directory-scoped copy retired.

**Corrected load-timing premise (kept from the code-grounded finding).** Claude ALREADY loads no-hardcoded-secrets at creation via `detect.always:true` on `project-rules.md`. So the unconditional-in- `CLAUDE.md` carrier is chiefly needed for **Copilot**, which has NO `always` equivalent — its path-scoped `applyTo` instructions load only when a matching file is in context. Therefore this story does NOT add a third copy of the Dapper (or secrets) rule into a CLAUDE.md managed block on the Claude side: Claude keeps its existing always-on mechanism (`detect.always:true` project-rule). The CLAUDE.md-inline managed block is the Copilot-facing carrier only.

A developer picking this up cold implements, in order: (0) the rule-inventory/refactor precursor above; (1) the `Shared/rules/**` L1 rule content (the coding rules + B1–B7 taxonomy as the single source), each entry carrying the AC-F9 version frontmatter defined by Story 2; (2) each harness's native consumption of that content — Claude via `.claude/rules` (`detect.always:true` for creation-critical, `paths:` for the rest); Copilot via `.github/instructions` (`applyTo`) plus the CLAUDE.md creation-critical carrier — authored to each harness's native shape, landed AFTER/WITH the AC-F8a hash-tracked user-edit protection for the CLAUDE.md block (see Dependencies); (3) the round-trip test that generates a new file on each harness and asserts both creation-critical rules were in force.

Decision D-5 is resolved here (see the Decision D-5 note below) and aligned to AC-F3 under the #7 structure.

---

## AC Coverage Matrix

Every AC from the ICEA in this story's scope must be covered by at least one file change. Every file change must satisfy at least one AC. Gaps are flagged ⚠.

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F3 (precursor) | Rule inventory/refactor: extract Dapper-only + no-hardcoded-secrets into discrete `Shared/rules/` L1 entries; reconcile existing copies to ONE authoritative home each (no triplication) | `Shared/rules/no-hardcoded-secrets.md`, `Shared/rules/dapper-only.md`, `.claude/rules/project-rules.md` (dedupe source), `CLAUDE.md` (retire duplicate Dapper prose into carrier block), `data-access-rules.md` (retire directory-scoped copy) | ✅ Covered |
| AC-F3 (native consumption) | The L1 rule content (coding rules + B1–B7 taxonomy) is consumed natively by both harnesses; creation-critical rules active at code-generation time on BOTH harnesses via each harness's native always-on mechanism (Claude `detect.always:true`; Copilot CLAUDE.md carrier) — not path-scoped-load-on-read, NO mechanical projection | `Shared/rules/**` (L1 single source incl. B1–B7 taxonomy), `.claude/rules/*.md` (Claude native: `paths:` for path-relevant, `detect.always:true` for creation-critical), `.github/instructions/*.instructions.md` (Copilot native: `applyTo`), `CLAUDE.md` (creation-critical carrier — Copilot), `scripts/provision.*` (native rule-consumption authoring step) | ✅ Covered |
| AC-F9 (referenced — owned by Story 2) | The two creation-critical L1 rule entries carry SemVer `version:`/`consumes:` frontmatter and are recorded in `Shared/prompt-manifest.json`; the versioning scheme, manifest, and CI bump/hash/re-author checks are Story 2 deliverables — this story authors rules that conform to them | `Shared/rules/no-hardcoded-secrets.md`, `Shared/rules/dapper-only.md` (frontmatter conforms), `Shared/prompt-manifest.json` (recorded by Story 2) | ✅ Covered (conformance only; artifact owned by Story 2) |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `Shared/rules/no-hardcoded-secrets.md`, `Shared/rules/dapper-only.md` (discrete L1 sources, AC-F9 frontmatter) | AC-F3, AC-F9 (conformance) |
| `Shared/rules/**` (other L1 rules + B1–B7 taxonomy, single source) | AC-F3 |
| `.claude/rules/project-rules.md` (deduped; retains `detect.always:true` for creation-critical on Claude) | AC-F3 |
| `.claude/rules/*.md` (Claude native consumption, `paths:` for path-relevant) | AC-F3 |
| `.github/instructions/*.instructions.md` (Copilot native consumption, `applyTo` glob) | AC-F3 |
| `CLAUDE.md` (creation-critical carrier — Copilot always-active; Dapper prose duplicate retired) | AC-F3 |
| `data-access-rules.md` (directory-scoped Dapper copy retired — single L1 source in `Shared/`) | AC-F3 |
| `scripts/provision.*` (native rule-consumption authoring step + creation-critical routing) | AC-F3 |
| `Shared/prompt-manifest.json` (version/sha256/consumes record — WRITTEN by Story 2, referenced here) | AC-F9 (referenced) |

**Coverage result:** AC-F3 (precursor + native consumption) covered; AC-F9 covered by conformance and referenced to its Story-2 owner; no orphaned file changes ✅.

---

## Files Changed

> Plugin rule content + native harness surfaces — no application schema, no compiled artifacts. `+` = new,
> `~` = modified, `-` = retired/removed. Schema Changes section is intentionally omitted (plugin/tooling
> story, no database).

| Path | Change | Purpose |
|---|---|---|
| `Shared/rules/no-hardcoded-secrets.md` | + | Discrete L1 creation-critical rule (precursor). Single authoritative source for the no-hardcoded-secrets statement previously embedded as a bullet in `project-rules.md`. Carries AC-F9 `version:`/`consumes:` frontmatter per Story 2's scheme. |
| `Shared/rules/dapper-only.md` | + | Discrete L1 creation-critical rule (precursor). Single authoritative source for the Dapper-only statement previously duplicated across `CLAUDE.md` prose and `data-access-rules.md`. Carries AC-F9 frontmatter. |
| `Shared/rules/**` | + | L1 single source for the remaining path-relevant rules and the B1–B7 business-context taxonomy. Each file tagged creation-critical (→ always-on) or path-relevant (→ `paths:`/`applyTo`) so each harness consumes it natively. |
| `.claude/rules/project-rules.md` | ~ | Deduped: keeps `detect.always:true` (already loads at creation on Claude); no-hardcoded-secrets now sourced from the L1 content rather than hand-authored inline. Claude's existing always-on mechanism is UNCHANGED — no third copy added. |
| `.claude/rules/*.md` | ~ (native) | Claude native consumption of the L1 rules with `paths:` front-matter for path-relevant rules (project-level only — user-level `paths:` rules are bugged per #21858). |
| `.github/instructions/*.instructions.md` | + (native) | Copilot native consumption of the SAME L1 rule content, authored to Copilot's `applyTo`-glob idiom for path-relevant rules. Not a mechanical transform of the Claude form. |
| `CLAUDE.md` | ~ | Creation-critical rules carried in a plugin-managed block as the **Copilot always-active carrier** (Copilot reads `CLAUDE.md` via `chat.useClaudeMdFile:true`; it has no `always` equivalent). The duplicate Dapper "Data Access Convention" prose is retired into this managed block so the rule has one home. Claude does NOT rely on this block — it uses `detect.always:true`. |
| `data-access-rules.md` | - | Directory-scoped Dapper copy retired; single source is now `Shared/rules/dapper-only.md`, consumed natively. Removes triplication. |
| `scripts/provision.*` (rule-consumption step) | ~ | Rule-classification pass over L1: creation-critical → Claude `detect.always:true` output + Copilot CLAUDE.md managed block; path-relevant → Claude `paths:` + Copilot `applyTo`. Authors each harness's native surface from the single L1 source (native consumption, not a delta-map). Managed-block writer ordered after/with AC-F8a hash protection (see Dependencies). |
| `Shared/prompt-manifest.json` | (ref) | The two creation-critical L1 rules' `{version, sha256, consumes}` are recorded here; this file is WRITTEN/maintained by Story 2 (AC-F9) — referenced, not created, by this story. |

---

## No external API — native rule surfaces

This story exposes **no external/network API**. Its "interface" is the L1 rule content and the native surface each harness consumes it into, plus the contract each harness applies them under:

- **Claude Code** — reads `.claude/rules/*.md` natively; a rule with `paths:` front-matter loads when a matching file is READ/edited; a rule with `detect.always:true` (e.g. the deduped `project-rules.md` carrying the creation-critical statements) is ALWAYS in the active instruction set, including at new-file creation.
- **GitHub Copilot (VS Code ≥1.109)** — reads `.github/instructions/*.instructions.md` natively; a rule with an `applyTo` glob applies only when a matching file is in context (no `always` equivalent). Creation-critical coverage therefore comes from `CLAUDE.md` via `chat.useClaudeMdFile:true` (default true), always active.

L1 consumption contract: (a) every `Shared/rules/**` L1 entry maps to exactly one destination class on each harness — path-relevant → `paths:`(Claude)+`applyTo`(Copilot); creation-critical → Claude always-on + Copilot CLAUDE.md carrier — never orphaned, never re-authored into a second L1 copy (AC-F2 guardrail, Story 2); (b) the two creation-critical rules appear in the CLAUDE.md managed block (Copilot carrier) and in the Claude always-on rule, and are NOT emitted as path-scoped `.claude/rules` files scoped to a file type; (c) each harness surface is deterministic — re-running the consumption step produces byte-identical output for unchanged L1 source.

---

## Auth & Security

The **no-hardcoded-secrets rule is itself a security control**, not merely a style rule. This story keeps it active at generation time on both harnesses: on Claude via the existing `detect.always:true` project-rule (unchanged), and on Copilot via the CLAUDE.md managed-block carrier — the exact moment a path-scoped `applyTo` rule would be silent on Copilot (there is no matching file in context yet). This composes with the plugin's existing settings-secret guard (secrets never in committed `settings.json`) and the Tier-C `ai-gate` secret scan (Story 6). Security posture for this story specifically:

- no-hardcoded-secrets is in the model's active instructions at generation time on Claude (existing `detect.always:true`) AND Copilot (CLAUDE.md carrier) — verified by INT-2 below.
- The Dapper-only rule prevents auto-SQL ORM code paths (a maintainability + parameterisation/SQL-injection hygiene control) from being generated unguarded.
- The B1–B7 taxonomy now lives as single-source L1 content here (its single canonical location, referenced by AC-NF2 and consumed by the Story-6 classifier) — one authoritative source removes drift risk in the classification vocabulary downstream.
- The precursor dedupe REDUCES risk: collapsing three scattered copies to one authoritative L1 source removes the chance of a stale/contradictory copy silently overriding the intended rule.
- No new secrets introduced; the rule-consumption step reads/writes local files only, no network calls.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| A creation-critical rule was mis-classified as path-relevant (emitted with a file-type `paths:`/`applyTo` instead of routed to always-on) | Consumption validation FAILS loudly: the classifier asserts each creation-critical rule reaches its always-on destination on each harness (Claude `detect.always:true` rule + Copilot CLAUDE.md managed block) and is NOT emitted only as a file-type-scoped output; a violation aborts provisioning naming the rule and the load-on-read gotcha. |
| Rule not active at creation time on Copilot (path-scoped rule expected to constrain a brand-new file) | This is the defended-against failure on the Copilot side specifically. A brand-new file has no matching file in context, so an `applyTo` rule does not apply — Copilot would generate unconstrained. Mitigation: creation-critical rules ride the CLAUDE.md always-active carrier on Copilot; INT-2 generates a NEW file to prove it fired at creation. On Claude the risk does not arise — `detect.always:true` already loads it. |
| The precursor leaves a duplicate (triplication) — e.g. Dapper prose left in `CLAUDE.md` outside the managed block AND in `data-access-rules.md` AND in `Shared/` | Precursor validation asserts each creation-critical rule has exactly ONE authoritative L1 source and that the legacy copies (CLAUDE.md free-text prose; `data-access-rules.md`) are retired/replaced by the carrier/native output. A residual hand-authored duplicate fails the check. |
| L1 re-author instead of consume (a Copilot rule surface hand-forks an L1 standard rather than delivering it) | Story 2's AC-F2 CI guardrail fails the PR — the Copilot side may RE-DELIVER an L1 rule natively but must not RE-AUTHOR it into a second source. This story authors the harness surfaces as native consumptions of L1 to stay on the right side of that guardrail. |
| An L1 rule's content changed without an AC-F9 version bump | Story 2's CI bump-on-change check (on-disk hash ≠ `Shared/prompt-manifest.json`) fails the PR. This story's authored rules must carry conformant `version:`/`consumes:` frontmatter so that check passes. |
| Glob divergence between harnesses (a path-relevant rule's `paths:` vs `applyTo` diverge in an UNINTENDED way) | See "Glob-parity: no unintended divergence" below — the check is divergence-aware, not identical-set. |
| `CLAUDE.md` managed block missing or hand-edited so the Copilot-carrier inline is dropped | The managed-block writer is idempotent on `setup-sync`, but MUST run after/with AC-F8a hash-tracked user-edit protection (Story 8) so a genuine hand-edit is preserved/flagged rather than clobbered. Until AC-F8a lands, the writer is not enabled (see Dependencies). |
| Copilot on VS Code < 1.109 (no `chat.useClaudeMdFile`) | Documented minimum version; provisioning surfaces a version notice. Below the floor the CLAUDE.md carrier is not guaranteed — treated as an unsupported configuration for Copilot creation-critical enforcement rather than silently assumed active. |

---

## Glob-parity: no unintended divergence (downgraded from identical-set)

Earlier drafts asserted the Claude `paths:` and Copilot `applyTo` for each path-relevant rule must resolve to an **identical file set**. That is INCORRECT and is downgraded here to **"no unintended divergence."** Because both surfaces now consume the SAME L1 content natively (not a mechanical projection), a legitimate per-harness difference is expected wherever a harness idiom has no analogue on the other.

Reason: Claude's `detect.excludeIfDependencies` (e.g. *exclude this rule when `typescript` is present in the project*) has NO Copilot `applyTo` equivalent — `applyTo` is a pure include-glob with no dependency-aware exclusion. So for any rule that carries a `detect.excludeIfDependencies` condition, the Claude effective file set and the Copilot `applyTo` file set will LEGITIMATELY differ, and demanding identity would fail a correct native consumption.

How it is handled:

- The consumption step records, per rule, whether an intended, dependency-driven divergence exists (i.e. the rule carries `detect.excludeIfDependencies` or another Claude-only selector with no Copilot analogue).
- The parity test asserts that the two harness globs match EXCEPT where such a divergence is declared — i.e. after removing the Claude-only exclusion dimension, the include-selectors agree. Any divergence NOT attributable to a declared Claude-only selector fails the test (that is an unintended divergence / a real bug).
- Where a Claude-only exclusion cannot be expressed on Copilot, the Copilot surface emits a documented note in the generated `.github/instructions/*` header stating the rule may apply on Copilot in a context Claude would exclude, so the divergence is visible, not silent.

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F3 (precursor) | Rule inventory + extract Dapper-only & no-hardcoded-secrets into discrete `Shared/rules/` L1 entries (AC-F9 frontmatter); reconcile 3 scattered copies to one authoritative L1 home each | 1 |
| AC-F3 (native consumption) | Rule-classification step: route creation-critical to Claude `detect.always:true` + Copilot CLAUDE.md carrier; author `paths:`/`applyTo` native surfaces for path-relevant; deterministic + validated + AC-F2 consume-not-re-author | 1 |
| AC-F3 (verification) | Both-harness round-trip: generate a new source file on each harness, assert Dapper-only + no-secrets active; divergence-aware glob-parity + mis-classification + dedupe tests | 1 |
| **Total** | | **3** |

**Total SP: 3** **Type: STORY** — a single logical shippable slice (L1 rule content + native per-harness consumption + precursor dedupe working on both harnesses), within the ≤5-SP rule; does not sub-decompose. Depends on **Story 2 (L1 content core: manifest + versioning + AC-F2 guardrail) only**. SEQUENCING NOTE (not a blocking dependency): the CLAUDE.md carrier writer is idempotent and edits only its own delimited block, so Story 3 ships without Story 8; full hash-tracked user-edit protection is layered on when Story 8's AC-F8a lands.

---

## Dependencies

- **Story 2 (L1 content core)** — provides the `Shared/` L1 structure, the `Shared/prompt-manifest.json`
  + AC-F9 versioning frontmatter scheme, and the AC-F2 CI guardrail (Copilot must not re-author L1). This story authors its two creation-critical rule entries AS L1 content conforming to that scheme and consumes them natively per harness. Per Revision Log #7 there is NO projection engine to inherit — the earlier "author-once, project-per-harness" machinery was retired; both surfaces are native consumptions of L1.
- **Story 8 — AC-F8a hash-tracked user-edit protection (SEQUENCING NOTE, not a blocking dependency).** The CLAUDE.md managed-block carrier this story ships is **idempotent and edits only its own delimited managed block**, so it does not clobber hand-edits and Story 3 is NOT blocked by Story 8. When Story 8's AC-F8a hash-tracking lands it layers full preserve/flag protection over the same block. (Demoting this to a note avoids the 3→8→6→5→3 dependency cycle a hard edge would create; the Claude side is already covered by the existing `detect.always:true`.)

---

## Decision D-5 — Creation-critical rule mechanism (aligned to AC-F3 under the #7 L1 structure)

**Decision:** Creation-critical coding rules are carried by each harness's **existing native always-on mechanism**, both consuming the one L1 rule content — Claude via `detect.always:true` (no change; already loads at creation), Copilot via the always-active `CLAUDE.md` managed block (its only always-on carrier, since Copilot has no `always` equivalent). All other (path-relevant) rules are consumed natively as `.claude/rules` `paths:` (Claude) / `.github/instructions` `applyTo` (Copilot). There is NO mechanical projection between the two surfaces — each is authored natively from the shared L1 source.

**Options considered:**
- A) All rules path-scoped (`paths:`/`applyTo`) — rejected: path-scoped rules load on READ/edit of a matching file, NOT at new-file creation; on Copilot a Dapper-only or no-secrets rule scoped to `*.cs`/`*.ts` would be silent exactly when the model authors a brand-new file, so creation-critical enforcement fails (breaks AC-F3).
- B) Add a fresh unconditional copy of every creation-critical rule into a CLAUDE.md managed block on BOTH harnesses — rejected: on Claude this creates a THIRD copy (the `detect.always:true` project-rule already loads no-hardcoded-secrets at creation), risking drift/triplication. Claude does not need it.
- C) Route by harness capability from the single L1 source: keep Claude on its existing `detect.always:true`; use the CLAUDE.md managed block ONLY as the Copilot carrier; path-relevant rules → `paths:`/`applyTo` — **chosen**: guarantees creation-time coverage on both harnesses without a redundant third Claude copy, and matches AC-F3's code-grounded note (Claude already loads at creation; carrier chiefly needed for Copilot). It also fits the #7 structure — both harnesses consume the L1 content natively, no transform layer.

**Rationale:** AC-F3 established (code-grounded) that Claude ALREADY loads the creation-critical statements at creation via `detect.always:true`, so the CLAUDE.md carrier is a Copilot concern, not a Claude one. Option C honours that and the #7 lock: one L1 source, each harness delivering it natively, no re-authoring and no mechanical projection.

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] Precursor complete: Dapper-only and no-hardcoded-secrets extracted into discrete `Shared/rules/` L1 entries; the three scattered copies (project-rules.md bullet, CLAUDE.md Dapper prose, `data-access-rules.md`) reconciled to ONE authoritative L1 source each; no triplication remains.
- [ ] `Shared/rules/**` L1 content authored (coding rules + B1–B7 taxonomy); each rule tagged creation-critical or path-relevant and carrying AC-F9 `version:`/`consumes:` frontmatter per Story 2's scheme.
- [ ] Path-relevant rules consumed natively into `.claude/rules/*.md` (`paths:`) and `.github/instructions/*.instructions.md` (`applyTo`) — the SAME L1 content, no mechanical delta-map.
- [ ] Creation-critical rules carried by Claude `detect.always:true` (existing mechanism, unchanged — NO third copy) and by the Copilot CLAUDE.md managed block; NOT emitted only as file-type-scoped outputs.
- [ ] Copilot rule surfaces RE-DELIVER L1 content, never RE-AUTHOR it (passes Story 2's AC-F2 CI guardrail).
- [ ] CLAUDE.md carrier writer enabled only after/with AC-F8a hash-tracked user-edit protection (Story 8).
- [ ] No hardcoded secrets, connection strings, or credentials introduced by the rule surfaces.
- [ ] No diagnostic output (`console.log`) left in the rule-consumption script paths.
- [ ] `// DECISION:` note recorded in the rule-consumption step where creation-critical routing is applied.

**Quality**
- [ ] All positive + negative unit tests pass (see Test Cases).
- [ ] Both-harness integration tests pass — new file generated on each harness with both rules active.
- [ ] Regression: existing Claude 3.x rule loading unchanged (parity, AC-NF4) — `detect.always:true` and path-scoped rules load exactly as before.

**Review readiness**
- [ ] PR title format: `[ADO-4000] Rules as L1 content (Story 3) — precursor dedupe + native per-harness always-on + paths/applyTo`.
- [ ] PR description maps each changed file to AC-F3 (and AC-F9 conformance; reference AC Coverage Matrix).
- [ ] ICEA + this story tech spec committed in the same branch.

### Reviewer Checklist

- [ ] Precursor: each creation-critical rule has exactly ONE authoritative `Shared/` L1 source; the legacy copies (project-rules.md bullet, CLAUDE.md Dapper prose, `data-access-rules.md`) are retired/replaced — no triplication.
- [ ] Rules are treated as L1 content consumed natively by both harnesses — NO mechanical projection / delta-map / `$PLUGIN_DIR` bridge reintroduced (per Revision Log #7).
- [ ] Copilot surfaces RE-DELIVER, do not RE-AUTHOR, the L1 rules (AC-F2 guardrail green).
- [ ] The two creation-critical L1 rule entries carry AC-F9 `version:`/`consumes:` frontmatter and are recorded in `Shared/prompt-manifest.json` (owned by Story 2).
- [ ] Claude's existing `detect.always:true` mechanism is preserved for the creation-critical rules — NO third copy added on the Claude side.
- [ ] The CLAUDE.md managed block is used as the Copilot always-active carrier only; it lands after/with AC-F8a hash protection (Story 8).
- [ ] Every `Shared/rules/**` L1 entry maps to exactly one destination class on each harness — never orphaned, never triplicated.
- [ ] Glob-parity check is divergence-aware: Claude `paths:` and Copilot `applyTo` agree except where a declared Claude-only selector (e.g. `detect.excludeIfDependencies`) legitimately diverges; unintended divergence fails.
- [ ] Mis-classification guard aborts provisioning if a creation-critical rule is emitted only file-type-scoped.
- [ ] No user-level `paths:` rules emitted (bug #21858 — project level only).
- [ ] Native consumption is deterministic — re-run produces byte-identical output for unchanged L1 source.
- [ ] Claude 3.x parity: `detect.always:true` and path-scoped rules load exactly as before.

---

## Open Questions

None open. D-5 is resolved in this spec (option C — native harness-appropriate always-on from the single L1 source, aligned to AC-F3 under the #7 structure). AC-F9 versioning conformance references Story 2 as owner; no further forks block SAVE TECH for this story.

---

## Request Flow

Rule-load timing on each harness — this is the load-order that AC-F3 turns on, from the single L1 source consumed natively (no projection layer):

```
PRECURSOR (rule inventory / dedupe — runs first):
  project-rules.md  --extract no-hardcoded-secrets bullet-->  Shared/rules/no-hardcoded-secrets.md (L1)
  CLAUDE.md "Data Access Convention" prose + data-access-rules.md
                    --collapse to single L1 source-->         Shared/rules/dapper-only.md (L1)
  reconcile: each creation-critical rule has ONE Shared/ L1 source; legacy copies retired -> else FAIL
  (each L1 entry carries AC-F9 version:/consumes: frontmatter — scheme owned by Story 2)

CONSUMPTION (rule-classification step over L1 — native per harness, NOT a projection):
  Shared/rules/**  --classify-->
     creation-critical (Dapper-only, no-hardcoded-secrets)
        --> Claude native: project-rules.md-equiv with detect.always:true  (EXISTING mechanism, no 3rd copy)
        --> Copilot native carrier: CLAUDE.md managed block (chat.useClaudeMdFile) [enabled after AC-F8a, Story 8]
     path-relevant
        --> Claude native:  .claude/rules/<name>.md              (paths: <glob>)
        --> Copilot native: .github/instructions/<name>.instructions.md (applyTo: <glob>)
  validate: creation-critical reaches always-on on BOTH harnesses; not only file-type-scoped -> else ABORT
  validate: Copilot re-delivers, does not re-author, the L1 content -> else AC-F2 guardrail FAIL (Story 2)

RUNTIME — new-file CREATION (the load-on-read gotcha window):
  Claude:  detect.always:true rule ALREADY in active instructions -> Dapper-only + no-secrets ACTIVE
           (no CLAUDE.md 3rd copy needed)
  Copilot: CLAUDE.md read via chat.useClaudeMdFile:true -> Dapper-only + no-secrets ACTIVE at creation
           .github/instructions applyTo NOT applied (no matching file in context yet; no `always` equivalent)

RUNTIME — READ/edit an existing matching file:
  Claude:  matching .claude/rules paths: rule loads
  Copilot: matching .github/instructions applyTo rule applies
  (creation-critical rules remain active throughout via their always-on carrier)
```

On Copilot the creation-critical rules MUST ride the always-active CLAUDE.md carrier because Copilot has no `always` equivalent — at new-file creation there is no matching file to trigger an `applyTo` rule. On Claude this is already solved by `detect.always:true`, so no third copy is introduced there. Both surfaces deliver the one L1 rule content natively — there is no mechanical transform between them.

---

## Rollback

Purely additive/config — no schema, no data migration.

1. This story ships on `feature/4.x-multi-harness`; revert its commit range to remove the discrete L1 `Shared/rules/no-hardcoded-secrets.md` + `Shared/rules/dapper-only.md` sources, the native `.claude/rules`/`.github/instructions` surfaces, and the CLAUDE.md creation-critical managed block; restore the retired `data-access-rules.md` and the CLAUDE.md Dapper prose from the reverted range. The frozen `v3.13.0` tag remains the permanent Claude-only fallback. (The `Shared/prompt-manifest.json` entries for these rules are Story-2 owned — coordinate their removal with Story 2 on a full rollback.)
2. Per provisioned target repo: `setup-sync` re-consumes the previous rule set into each harness surface; the CLAUDE.md managed block is idempotently rewritten (or removed on rollback) under AC-F8a hash protection, leaving developer-authored `CLAUDE.md` content untouched.
3. Verify after rollback: Claude's `detect.always:true` project-rule still loads at creation and path-scoped rules still load on read (parity); no orphaned creation-critical managed block left in `CLAUDE.md`; the legacy Dapper copies are back exactly as before (no partial-dedupe state).

---

## Handover

### QA Team

**What was added:** the two creation-critical rules were consolidated from three scattered copies into one authoritative L1 `Shared/` source each (the coding rules + B1–B7 taxonomy now live as single-source L1 content), then each harness consumes that L1 content natively — Claude via `.claude/rules`, Copilot via `.github/instructions` + the CLAUDE.md carrier — with Dapper-only + no-hardcoded-secrets guaranteed active at new-file generation on BOTH harnesses (Claude via existing `detect.always:true`; Copilot via the CLAUDE.md carrier). There is NO mechanical projection between harnesses. **How to test:** run INT-1/INT-2 — generate a brand-new source file on each harness and assert both rules constrained the output (Dapper used, no secrets emitted). **Regression risk:** Claude's `detect.always:true` and path-scoped rules must load exactly as in 3.x; run the parity check (N-U2). **Test data:** synthetic scratch files only; no real privileged/PII/secret material in fixtures.

### DevOps / Platform Team

- No new secrets, no new environment variables, no network calls introduced by this story.
- Rule consumption runs as part of `provision`/`setup-sync`; no new pipeline stage. The AC-F9 versioning CI check + AC-F2 re-author guardrail are Story-2 gates that this story's rules must pass — coordinate with Story 2, do not duplicate the check here.
- The CLAUDE.md managed-block carrier writer is gated on AC-F8a hash-tracked user-edit protection (Story 8) — do not enable it before Story 8 lands, or a hand-edited `CLAUDE.md` could be clobbered.

### Future Developer — follow-on work

- To add a new rule: author it ONCE as L1 content in `Shared/rules/**` (with AC-F9 version frontmatter) and tag it creation-critical or path-relevant. If creation-critical it routes to Claude `detect.always:true` + the Copilot CLAUDE.md carrier; otherwise it is consumed natively as `paths:`/`applyTo`. Do NOT hand-edit the harness surfaces (`.claude/rules`/`.github/instructions`) — they are regenerated from L1.
- Never re-author an L1 rule into the Copilot side — re-deliver it (AC-F2 guardrail). Never re-introduce a third copy of a creation-critical rule on Claude — `detect.always:true` already loads it at creation; the CLAUDE.md managed block is the Copilot carrier only.
- To add a harness later, the new harness consumes the SAME `Shared/rules/**` L1 content natively; add its always-on carrier + path-scoped output format in the consumption step (one place) — no projection layer.
- Known gotcha to preserve: on Copilot, path-scoped `applyTo` rules load only when a matching file is in context — never move a creation-critical rule to `applyTo`-only.

---

## Test Cases

> Derived from AC-F3 under the #7 L1 structure. Positive + negative unit tests on the
> precursor/consumption/classification logic; integration tests generate a NEW source file on each harness
> and assert both creation-critical rules were active at creation.

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | precursor dedupe | current tree (no-secrets bullet in project-rules.md; Dapper in CLAUDE.md prose + data-access-rules.md) | Two discrete `Shared/rules/` L1 sources created; each creation-critical rule has exactly ONE authoritative home; legacy copies retired/replaced; no triplication | AC-F3 |
| P-U2 | rule classifier / native router | `Shared/rules/` with Dapper-only + no-secrets tagged creation-critical, plus one path-relevant rule | Creation-critical routed to Claude `detect.always:true` + Copilot CLAUDE.md carrier; path-relevant authored natively as `.claude/rules/*.md` (`paths:`) and `.github/instructions/*.instructions.md` (`applyTo`) | AC-F3 |
| P-U3 | divergence-aware glob-parity | a path-relevant rule with a source selector AND a `detect.excludeIfDependencies` (Claude-only) condition | Claude `paths:` and Copilot `applyTo` include-selectors agree; the declared Claude-only exclusion is recorded as intended divergence and a note is emitted in the Copilot header — test passes | AC-F3 |
| P-U4 | determinism | re-run consumption on unchanged `Shared/rules/**` | byte-identical outputs (idempotent) | AC-F3 |
| P-U5 | AC-F9 frontmatter conformance | the two creation-critical L1 entries | each carries a valid SemVer `version:` + `consumes:` pin recognised by Story 2's manifest schema; a missing/malformed version is rejected | AC-F9 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | mis-classification guard | Dapper-only rule tagged (wrongly) path-relevant only | provisioning ABORTS naming the rule + the load-on-read gotcha; no file-type-scoped-only creation-critical output written | AC-F3 |
| N-U2 | 3.x parity | existing `detect.always:true` + path-scoped rule set | `detect.always:true` loads at creation and path-scoped rules load on read exactly as in 3.x on Claude (no regression) | AC-F3 / AC-NF4 |
| N-U3 | triplication guard | a creation-critical rule left duplicated (e.g. Dapper prose still in CLAUDE.md free text AND in `data-access-rules.md` AND in `Shared/`) | validation fails — each creation-critical rule must have exactly one authoritative L1 source | AC-F3 |
| N-U4 | unintended divergence guard | a path-relevant rule whose Claude `paths:` and Copilot `applyTo` differ with NO declared Claude-only selector | parity test fails — that is an unintended divergence / real bug | AC-F3 |
| N-U5 | L1 re-author guard | a Copilot rule surface that hand-forks an L1 rule's content instead of delivering it | Story 2's AC-F2 CI guardrail fails the PR — Copilot must re-deliver, not re-author, L1 | AC-F2 / AC-F9 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Creation-critical rules active at new-file generation on Claude | Provision a scratch repo for Claude; in Claude Code generate a BRAND-NEW data-access source file (no pre-existing matching file) | Generated code uses Dapper with parameterised SQL (no EF/auto-SQL ORM) AND contains no hardcoded secrets — both rules active at creation via `detect.always:true`, not load-on-read | AC-F3 |
| INT-2 | Creation-critical rules active at new-file generation on Copilot | Provision the same repo for Copilot; in VS Code Copilot ≥1.109 generate the same BRAND-NEW data-access source file | Same result via `chat.useClaudeMdFile` — Dapper-only + no-secrets active at creation on Copilot via the CLAUDE.md carrier (no `applyTo` match needed) | AC-F3 |
| INT-3 | Path-relevant rule loads on read (both harnesses) | Open/edit an EXISTING file matching a path-relevant rule's glob on each harness | The path-scoped rule loads on read (`paths:` on Claude, `applyTo` on Copilot); confirms the split mechanism works for non-creation-critical rules | AC-F3 |

> NF AC verification:
> AC-F3 is functional; its creation-time property is verified behaviourally by INT-1/INT-2 (generate a NEW
> file, assert both rules constrained the output) rather than by static grep — a static presence check would
> not prove the rule was *active at generation time*. INT-2 specifically exercises the Copilot carrier, since
> that is the harness lacking an `always` equivalent. AC-F9 conformance is checked at P-U5/N-U5 (frontmatter
> valid; Copilot re-delivers not re-authors); the authoritative manifest/CI enforcement is Story 2's.

---

### Revision Log
2026-08-13 — Story 3 tech spec drafted from the saved Epic ICEA (AC-F3) and Epic Tech Spec (dogfood; synthetic ADO-4000). Adapted to plugin reality: Schema Changes omitted; API Changes → "No external API — rule projection outputs"; Auth & Security reframed around the no-hardcoded-secrets rule as a security control. Decision D-5 resolved (option C — creation-critical unconditional-in-`CLAUDE.md`, rest `paths:`/`applyTo`). Load-on-read gotcha encoded in Overview, Error Handling, Request Flow, and Test Cases.
2026-08-13 #2 — Re-revised to match revised ICEA (Revision Log #4 + revised AC-F3). Fixes: (1) added rule-inventory/refactor PRECURSOR as first work item — the two creation-critical rules do NOT exist as discrete files today (no-hardcoded-secrets is a bullet in `project-rules.md`, already `paths:["**/*"]`+`detect.always:true`; Dapper-only is CLAUDE.md prose + `data-access-rules.md`); extract into discrete `Shared/rules/` entries, reconcile to one authoritative home each (no triplication). (2) Corrected load-timing premise — Claude ALREADY loads at creation via `detect.always:true`, so CLAUDE.md-inline is chiefly a COPILOT need; Claude keeps its existing always-on mechanism, NO third copy of the Dapper rule on the Claude side. (3) Added Story-8 AC-F8a dependency — CLAUDE.md managed-block writer must land after/with hash-tracked user-edit protection. (4) Downgraded glob-parity test from "identical file set" to "no unintended divergence" — Claude `detect.excludeIfDependencies` has no Copilot `applyTo` equivalent, so file sets legitimately differ; divergence-aware parity + emitted Copilot header note. (5) Aligned D-5, AC Coverage Matrix, and all test cases to revised AC-F3.
2026-08-14 #3 — Re-revised to match ICEA Revision Logs #6/#7/#8 (source pointer updated to #8). Structural reframe per #7 (STRUCTURE LOCKED): rules are now **L1 content** — a single `Shared/rules/**` source (the coding rules + B1–B7 taxonomy) that both harnesses **consume natively**; the mechanical projection / delta-map / `author-once-project-per-harness` engine and the runtime `$PLUGIN_DIR` bridge are RETIRED. Claude reads the L1 rules natively (`.claude/rules` + `detect.always:true`); Copilot consumes the SAME L1 rules natively into `.github/instructions`/`CLAUDE.md`, authored per harness — not delta-mapped. Retitled the spec and the "No external API" and Sizing/Handover/Request-Flow sections from "projection" to "native consumption." Added AC-F9 (#8): the two creation-critical L1 rule entries carry SemVer `version:`/`consumes:` frontmatter recorded in `Shared/prompt-manifest.json` — the versioning scheme, manifest, and CI bump/hash/re-author checks are OWNED by Story 2; this story conforms and references them (added to AC Coverage Matrix, Error Handling, DoD, Reviewer Checklist, P-U5/N-U5). Added the AC-F2 re-deliver-not-re-author guardrail (Story 2) to Error Handling, DoD, Reviewer Checklist, and N-U5. KEPT unchanged (already consistent): the rule-inventory precursor, the `detect.always:true`-loads-at-creation code-grounded finding, and the D-5 resolution (option C). Story 2 dependency reframed from "projection engine + delta-map" to "L1 content core: manifest + versioning + AC-F2 guardrail"; Story 8 AC-F8a sequencing note retained.
