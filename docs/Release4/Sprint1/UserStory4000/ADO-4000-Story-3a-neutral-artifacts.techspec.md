# Tech Spec — Story 3a: Neutral shared artifacts

ADO #4000 · Release 4 · Sprint 1 · Story 3a Status: DRAFT (revised 2026-08-14 #3) · STORY · 3 SP

> Per-story spec for the EPIC ADO-4000. Scope: AC-F6 only. Source ICEA:
> `docs/Release4/Sprint1/UserStory4000/ADO-4000-llm-agnostic-multi-harness.icea.md`
> (revised, Revision Log "2026-08-14 #8" + the "Repository structure & layering (L1/L2/L3)"
> subsection + revised AC-F6).
> Epic Tech Spec: `temp/ADO-4000-tech.md`. This is a plugin/tooling story (Node.js CJS + markdown),
> not a web app — no database, no HTTP API, no browser tier. Template sections that assume those
> tiers are adapted below.

---

## Overview

This story makes the four shared, generated artifacts — architecture docs, the codebase knowledge graph, `memory/`, and `docs/` — **single-source** and **read by both harnesses via an explicit, harness-neutral path**, with **no per-harness duplication**. Today architecture lives at `.claude/architecture/` and the graph at `.claude/graph/`. Under multi-harness convergence, Copilot is scoped away from `.claude/` (Story 5 emits `.vscode/settings.json` disabling `.claude/` skills+rules discovery). Any artifact left under `.claude/*` that a skill reads implicitly could therefore become invisible to Copilot or, worse, get regenerated per harness.

The governing pattern is *generate once, read by a neutral-from-repo-root path*: skills stop reaching into a harness-owned folder and instead resolve a single canonical location declared in one place. Per Decision D-2 (below) this story **relocates** architecture to `docs/architecture/` and the graph to `.aidev/graph/`; `memory/` and `docs/` are already neutral and stay put.

The revised ICEA AC-F6 asserts **single-source + shared-read**, and explicitly leaves the *physical location* (relocate vs keep-under-`.claude/` read-by-path) contingent on D-2. This spec resolves D-2 to **relocate**, and is therefore accountable for every consequence of moving — not just a `git mv`. Three consequences make this a non-trivial move rather than a byte-identical relocation:

1. The reader footprint is **20 skills** (plus hooks and rules), not a handful — enumerated and gated by a grep-clean acceptance gate, not a fixed list.
2. `graph-index.md` carries `paths: always` frontmatter (the reason icea-feature orientation auto-loads it) **and** internal markdown links hardcoded to `.claude/graph/...` — both must be regenerated/ re-registered for the new location, or the file converted to explicit-read.
3. `graph.html` moving to `.aidev/` leaves icea-floor's `.claude/` exempt zone and hits the guarded `.html` extension — a coordination point with Story 4.

No skill's *behaviour* changes — only where it reads the one copy from — but the mechanics above are the substance of the work.

### Where this story sits in the L1/L2/L3 layering — the `<neutral artifacts>` tier

The ICEA's "Repository structure & layering (L1/L2/L3)" subsection lays out the locked source shape: `Shared/` is **L1 — content & standards** (the ICEA method, templates, critic rubric, coding rules, the B1–B7 taxonomy, checker knowledge, the Tier-C gate) authored once and never duplicated; `Claude/` and `Copilot/` are the **L2 (engagement) + L3 (enforcement)** layers, designed *natively* per harness. Alongside those three source folders the layout declares a fourth, non-source tier:

```
  <neutral artifacts>  # architecture, graph, memory/, docs/ — generated once, read by both
```

**This story owns exactly that `<neutral artifacts>` tier.** The four artifacts AC-F6 governs — architecture docs, the knowledge graph, `memory/`, and `docs/` — are the *generated-once, read-by-both* tier: they are produced by a generating skill (architect, graph-sync, graph-viz, memory-capture) and consumed by both harnesses through one canonical path. Relocating architecture to `docs/architecture/` and the graph to `.aidev/graph/` (D-2, below) is precisely what makes this tier live *outside* the harness-owned `Claude/`/`.claude/` and `Copilot/`/`.github/` namespaces, so neither harness can claim, scope-hide, or per-harness-duplicate it.

**Orthogonal to L1 content standards — explicitly.** The `<neutral artifacts>` tier is **not part of L1** and this story does **not** touch L1. L1 is *authored* content-and-standards (single-source prompt and rule material that both harnesses consume verbatim, guardrail-enforced against re-authoring). The neutral artifacts are *generated output* about a specific target repo (its architecture, its module graph, its captured memory, its docs) — regenerable, repo-specific, and carrying no authoring authority. They share L1's "single source, read by both" property but for a different reason (dedupe of generated output, not a canonical standard). Concretely: the L1 re-author CI guardrail (AC-F2) does **not** apply to these artifacts, and nothing here consumes, versions (AC-F9), or forks an L1 standard. The two concerns are independent — this story can ship without touching `Shared/` and an L1 change never repoints a neutral artifact.

### Decision D-2 — Neutral artifact locations

- **Chosen option:** Relocate to neutral locations — `.claude/architecture/` → `docs/architecture/`, `.claude/graph/` → `.aidev/graph/`. `memory/` and `docs/` are already neutral and are not moved.
- **Option rejected:** Keep artifacts under `.claude/*` and rely on skills reading them by explicit path. Rejected because (a) `.claude/` is a harness-owned namespace Copilot is deliberately scoped away from, so a `.claude/`-resident artifact is conceptually "Claude's" even when read by path — it invites per-harness duplication and reader confusion; (b) neutrality is the epic's stated success metric ("1 source of truth per artifact ... generated once in neutral locations"); (c) the churn cost (updating ~20 readers) is paid once here regardless of location, so the cleaner end-state wins.
- **Rationale:** Neutral paths make single-source obvious by construction and remove any dependency on `.claude/` scoping behaviour. Both harnesses read the same physical copy.
- **Alternative sub-decision for `graph-index.md`:** because it is auto-loaded via `paths: always`, D-2 forces a follow-on choice — (a) keep `paths: always` and re-register the auto-load from the new path, regenerating its hardcoded internal links; **vs** (b) convert it to explicit-read and update icea-feature's orientation step (SKILL.md ~line 85) to read it by path. This spec chooses **(a)** so icea-feature orientation keeps working without an orchestration change; (b) is the documented fallback if `paths: always` cannot resolve a `.aidev/` path on both harnesses.

### Shared path contract — canonical `artifact-paths.md`

To prevent Story 3a (this story), Story 4 (hook readers repointing the same graph/arch paths — see ICEA Story-Breakdown correction (b)), and Story 6 (the B1–B7 taxonomy's single canonical location — see AC-NF2) from independently hardcoding and later clobbering each other, this story introduces **one canonical path contract**: `skills/shared/artifact-paths.md`. It is the single source that declares the neutral location of every shared artifact and taxonomy. Story 4 and Story 6 **read from it, never re-declare**. This is the concrete realisation of the ICEA's "3a↔4 must share a single `artifact-paths.md` contract to avoid clobbering," extended to Story 6's taxonomy entry.

---

## AC Coverage Matrix

Every AC in scope must be covered by at least one file change; every file change must satisfy at least one AC.

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F6 | Architecture/graph/memory/docs generated once, read by both harnesses via explicit path, no per-harness duplication, not hidden by Copilot `.claude/` scoping (location contingent on D-2 — resolved here to relocate) | `docs/architecture/**` (relocated), `.aidev/graph/**` (relocated incl. `graph-index.md`, `graph.json`, `.stale`, `graph.html`), `skills/shared/artifact-paths.md` (new canonical path contract), the **20** updated skill readers, updated hook readers under `.claude/hooks/**` (incl. all three `graph-stale-detect` variants), `icea-feature/SKILL.md` orientation, `memory/**` + `docs/**` (already neutral — confirmed single-source) | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `docs/architecture/**` (moved from `.claude/architecture/`) | AC-F6 |
| `.aidev/graph/**` (moved from `.claude/graph/`) | AC-F6 |
| `.aidev/graph/graph-index.md` (frontmatter re-register + internal links regenerated) | AC-F6 |
| `skills/shared/artifact-paths.md` (new — canonical neutral-path contract shared with Stories 4 & 6) | AC-F6 |
| The 20 skill readers (enumerated in Files Changed) | AC-F6 |
| `skills/icea-feature/SKILL.md` (orientation step — graph-index auto-load re-verified/repointed) | AC-F6 |
| `.claude/hooks/graph-stale-detect.cjs` / `.ps1` / `.sh` (all three hardcode `.claude/graph`) | AC-F6 |
| Other hook readers under `.claude/hooks/**` referencing architecture/graph | AC-F6 |
| `memory/**`, `docs/**` (already neutral — no move; documented as single-source read-by-path) | AC-F6 |

**Coverage result:** the single in-scope AC (AC-F6) is covered; no orphaned file changes ✅.

---

## Files Changed

> Plugin story — no database, so **Schema Changes is omitted** (not applicable to a markdown/CJS
> tooling change). This story is dominated by relocations + reader updates.

### Relocations and new files

| Path | Change | Detail |
|---|---|---|
| `.claude/architecture/**` → `docs/architecture/**` | ~ relocate | Move the generated architecture docs to a neutral, harness-agnostic location. Content unchanged; only the directory moves. |
| `.claude/graph/**` → `.aidev/graph/**` | ~ relocate | Move `graph.json` (authoritative), the markdown index/projection, `.stale` flag, and `graph.html` to a neutral location outside any harness namespace. NOT byte-identical for `graph-index.md` — see next two rows. |
| `.aidev/graph/graph-index.md` | ~ regenerate | This file is **not a plain move**. It carries `paths: always` frontmatter (why icea-feature orientation auto-loads it) AND its internal markdown links are hardcoded to `.claude/graph/<domain>/<module>.md`. On relocation, regenerate every internal link to the new `.aidev/graph/...` (or repo-relative) location AND re-verify/re-register the `paths: always` auto-load resolves from the new path. If `paths: always` cannot resolve from `.aidev/` on both harnesses, fall back to explicit-read (see icea-feature row). |
| `skills/shared/artifact-paths.md` | + new | Canonical path contract: the four shared-artifact locations (`docs/architecture/`, `.aidev/graph/`, `memory/`, `docs/`) plus a reserved entry for the Story-6 B1–B7 taxonomy location. Single source that Stories 3a, 4 (hook readers), and 6 (taxonomy) all read — no path hardcoded twice, no clobbering. |

### Skill readers repointed (20 — grep-derived, not a fixed allow-list)

The current reader set that references `.claude/architecture` or `.claude/graph` in its `SKILL.md` is **20 skills**, verified by grep on 2026-08-13 (the earlier draft under-counted at 8). All are repointed to the neutral paths:

| Path | Change | Detail |
|---|---|---|
| `skills/ado-tasks/**` | ~ modify | Repoint architecture/graph reads to neutral paths. |
| `skills/app-readiness/**` | ~ modify | Read `docs/architecture/architecture-deployment.md` (and graph) at the neutral path. |
| `skills/architect/**` | ~ modify | **Write** architecture docs to `docs/architecture/` instead of `.claude/architecture/`. |
| `skills/critic/**` | ~ modify | Repoint architecture/graph reads. |
| `skills/dream-rollback/**` | ~ modify | Repoint graph reads. |
| `skills/dream-status/**` | ~ modify | Repoint architecture/graph reads. |
| `skills/graph-create/**` | ~ modify | **Write** graph to `.aidev/graph/` at the neutral path. |
| `skills/graph-sync/**` | ~ modify | **Write** `.aidev/graph/graph.json` + projection + regenerate `graph-index.md` links + `.stale` at the neutral path. |
| `skills/graph-viz/**` | ~ modify | **Render** `.aidev/graph/graph.html` at the neutral path (see graph.html / icea-floor coordination below). |
| `skills/icea-feature/**` | ~ modify | Orientation step (~SKILL.md:85) reads architecture + auto-loaded `graph-index.md` — re-verify/repoint (see icea-feature row below). |
| `skills/icea-implement/**` | ~ modify | Repoint architecture/graph reads. |
| `skills/icea-review/**` | ~ modify | Repoint architecture/graph reads. |
| `skills/icea-revise/**` | ~ modify | Repoint architecture/graph reads. |
| `skills/migration/**` | ~ modify | Repoint architecture/graph reads. |
| `skills/plugin-readiness/**` | ~ modify | Read `docs/architecture/` (and graph) at the neutral path. |
| `skills/pr-describe/**` | ~ modify | Repoint architecture/graph reads. |
| `skills/pr-spec-review/**` | ~ modify | Repoint architecture/graph reads. |
| `skills/security/**` | ~ modify | Repoint architecture/graph reads. |
| `skills/setup-status/**` | ~ modify | Repoint architecture/graph health checks. |
| `skills/token-analysis/**` | ~ modify | Repoint graph reads. |

> The list above is the current grep result, not the acceptance criterion. The **acceptance gate is a
> grep-clean** (see Reviewer Checklist / N-U1): zero remaining references to `.claude/architecture` or
> `.claude/graph` across `skills/**`, `.claude/hooks/**`, and `.claude/rules/**`. If grep finds an
> additional reader beyond these 20, it is in scope and must be repointed too. This defends against the
> fixed-list under-count that this revision fixes.

### icea-feature orientation

| Path | Change | Detail |
|---|---|---|
| `skills/icea-feature/SKILL.md` (~line 85) | ~ modify | The orientation step reads `.claude/architecture/architecture.md` and *relies on `graph-index.md` being auto-loaded via `paths: always`*. Repoint the architecture read to `docs/architecture/architecture.md`. For the graph-index: if `paths: always` is re-registered successfully from `.aidev/graph/graph-index.md` (chosen D-2 sub-option (a)), the prose stays "already in context"; if it falls back to explicit-read (sub-option (b)), rewrite the step to read `.aidev/graph/graph-index.md` by path. Either way the orientation must still land the module summaries in context. |

### Hook readers repointed (all three graph-stale-detect variants + others)

| Path | Change | Detail |
|---|---|---|
| `.claude/hooks/graph-stale-detect.cjs` | ~ modify | Hardcodes `path.join('.claude','graph','graph.json')` and `path.join('.claude','graph','.stale')` — repoint both to `.aidev/graph/`. |
| `.claude/hooks/graph-stale-detect.ps1` | ~ modify | PowerShell variant of the same fingerprint/stale logic — repoint its hardcoded `.claude/graph` paths to `.aidev/graph/`. |
| `.claude/hooks/graph-stale-detect.sh` | ~ modify | POSIX-shell variant (sha1sum-based) of the same logic — repoint its hardcoded `.claude/graph` paths to `.aidev/graph/`. All three must move together or a merge/checkout on one platform reads a dead path. |
| `.claude/hooks/**` (any other hook referencing architecture/graph) | ~ modify | Grep-clean gate applies to hooks too; repoint any additional reference. |

### graph.html × icea-floor coordination (Story 4)

Moving `graph.html` from `.claude/graph/` to `.aidev/graph/` takes it **out of** icea-floor's `.claude/` exempt zone and **into** the guarded `.html` extension. Verified against `icea-floor.cjs` /`.ps1` /`.sh`: `.claude/` is exempt, but `.html` is in `guardedExts` (the only exempt `.html` files are `plugin-guide.html` / `user-guide.html`). Therefore a Write of `.aidev/graph/graph.html` would be `exit 2`-**BLOCKED** by icea-floor. Resolution (one of):

- **Preferred:** coordinate with **Story 4** to add `.aidev/` (or `.aidev/graph/graph.html`) to icea-floor's exempt patterns in all three variants. This is a Story-4-owned change on the hook layer; this spec records the dependency in `artifact-paths.md` and Handover so the two stories don't clobber.
- **Alternative:** confirm `graph.html` is **not** written via the Write tool (e.g. graph-viz writes it through a Node `fs.writeFileSync` in a `.cjs` script, which PreToolUse Write-hook guards do not intercept). If verified, no icea-floor change is needed. This must be *confirmed*, not assumed — see Open Questions.

### Already-neutral artifacts

| Path | Change | Detail |
|---|---|---|
| `memory/**` | (no move) | Already neutral and read-by-path by both harnesses. Confirmed single-source; documented, not relocated. |
| `docs/**` | (no move) | Already neutral. ICEA docs, plans, generated docs are shared read-by-path. Confirmed single-source; documented, not relocated. Note `docs/architecture/` becomes a child of this already-neutral tree. |

**No external API — artifact path changes + reader updates.** There is no HTTP endpoint or outbound service call in this story. The only "interface" is the set of on-disk artifact paths, which changes from `.claude/architecture` + `.claude/graph` to `docs/architecture` + `.aidev/graph`; every reader (20 skills + hooks) is repointed. Nothing consumes these artifacts over a network.

---

## Auth & Security

No auth tier exists in this plugin story. Security-relevant notes:

1. **`memory/` and `docs/` are untrusted input** — auto-loaded (memory at session start; docs on demand) and can carry attacker- or drift-introduced text. This story grants them no new authority; relocating architecture/graph and confirming memory/docs single-source must **not** make any artifact executable or trusted. Provenance, injection-resistance, and the "no executable authority" guarantee are delivered by **Story 6** (AC-NF3). This story only fixes *location and single-source reads*.
2. **No secret exposure** — the relocated artifacts contain no credentials; `.env` / `settings.local.json` / PAT are never among them.
3. **icea-floor guard interaction (see Files Changed):** moving `graph.html` interacts with the write-time guard. Whichever resolution is chosen must not *weaken* the guard for real source `.html` — the exempt pattern must be narrow (`.aidev/graph/graph.html` or `.aidev/` graph output only), not a blanket `.html` exemption.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| A skill or hook still points at the old `.claude/architecture/` or `.claude/graph/` path after the move | The reader finds nothing at the old path and surfaces a clear "artifact moved to `<new neutral path>` — update this reader" message (via the compatibility note / `artifact-paths.md`), rather than silently proceeding with empty context. Fails loudly. |
| `graph-index.md` internal links still point at `.claude/graph/...` after the move | A link-resolution check (see Test Cases P-U5) fails the build/PR: every `Detail File` link in the relocated `graph-index.md` must resolve to an existing file under `.aidev/graph/`. |
| `paths: always` does not re-register from `.aidev/graph/graph-index.md` | Fall back to D-2 sub-option (b): icea-feature reads it explicitly by path; orientation still lands module summaries. This is a caught, documented degradation — not a silent loss of context. |
| `graph.html` Write blocked by icea-floor (guarded `.html`) | Caught at write time by the guard (`exit 2` with the icea-floor message). Resolution is the Story-4 exempt-pattern add or the confirmed non-Write-tool write path — never bypass the guard with `--no-verify`. |
| Copilot `.claude/` scoping would hide an artifact | Not possible for the relocated artifacts — `docs/architecture/` and `.aidev/graph/` live outside `.claude/`, so Copilot's `.vscode/settings.json` scoping (Story 5) cannot hide them. Both harnesses read the same copy by path. This is the core reason D-2 chose relocation. |
| Neutral artifact directory does not yet exist (fresh repo, artifacts not generated) | Reader treats it as "not generated yet" and directs the developer to run the generating skill (`architect` / `graph-sync`), same as pre-move behaviour — no crash, no per-harness fallback copy. |
| Both `.claude/graph/` (stale, pre-move) and `.aidev/graph/` (new) exist after partial migration | `artifact-paths.md` declares `.aidev/graph/` authoritative; readers use only the neutral path. The stale `.claude/graph/` is flagged for removal, never read as a second source. |
| A reader accidentally writes a per-harness copy | Reviewer Checklist item catches it; there is exactly one write target per artifact (the neutral path). |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F6 (relocate architecture + graph) | Move two directories to neutral paths; preserve content, `.stale`, `graph.html`; regenerate `graph-index.md` links + re-register `paths: always` | 1 |
| AC-F6 (reader updates) | Repoint **20** skills + all three `graph-stale-detect` variants + other hooks; add `artifact-paths.md`; icea-feature orientation; coordinate graph.html/icea-floor with Story 4; grep-clean gate; confirm memory/docs single-source | 2 |
| **Total** | | **3** |

**Total SP: 3** **Type: STORY** — a single shippable slice delivering one capability (shared artifacts read once by both harnesses). No sub-decomposition needed; within the ≤5-SP rule. (The larger reader footprint is mechanical repointing, not new capability, so SP holds at 3.)

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] `.claude/architecture/` moved to `docs/architecture/`; content unchanged; old dir removed.
- [ ] `.claude/graph/` moved to `.aidev/graph/` (incl. `graph.json`, markdown projection, `.stale`, `graph.html`); old dir removed.
- [ ] `.aidev/graph/graph-index.md` internal links regenerated to resolve under `.aidev/graph/`; `paths: always` re-registered from the new path (or converted to explicit-read with icea-feature updated).
- [ ] `skills/shared/artifact-paths.md` created as the canonical path contract (four artifacts + reserved Story-6 taxonomy entry); shared with Stories 4 and 6.
- [ ] All **20** skill readers repointed at the neutral paths (grep-derived list; extend if grep finds more).
- [ ] All three `graph-stale-detect` variants (`.cjs` / `.ps1` / `.sh`) repointed at `.aidev/graph/`; any other hook reference repointed.
- [ ] `icea-feature/SKILL.md` orientation step repointed and re-verified to land module summaries in context.
- [ ] `graph.html` × icea-floor resolved: either Story-4 exempt-pattern add for `.aidev/graph/graph.html`, or confirmed graph.html is not written via the Write tool.
- [ ] `memory/` and `docs/` confirmed single-source read-by-path; no per-harness duplicate created for any of the four artifacts.
- [ ] No hardcoded secrets, connection strings, or credentials introduced.
- [ ] **Grep-clean gate:** no leftover reference to `.claude/architecture` or `.claude/graph` anywhere in `skills/**`, `.claude/hooks/**`, or `.claude/rules/**`.

**Quality**
- [ ] All positive unit tests pass — see Test Cases.
- [ ] All negative unit tests pass — see Test Cases.
- [ ] `graph-index.md` link-resolution test passes (every internal link resolves post-move).
- [ ] Integration test passes: both harnesses read the single architecture/graph copy from the neutral path.
- [ ] Regression verified: architecture/graph/memory/docs content and generating-skill behaviour unchanged; only location moved (and graph-index links regenerated).

**Review readiness**
- [ ] PR title format: `[ADO-4000] Neutral shared artifacts — relocate architecture/graph, read-once by both harnesses`
- [ ] PR description maps each changed file to AC-F6 (reference AC Coverage Matrix).
- [ ] ICEA committed in the same branch.

### Reviewer Checklist
- [ ] **Grep-clean:** no skill, hook, or rule reads `.claude/architecture/*` or `.claude/graph/*` after this story (this is the acceptance gate, not a fixed 8-item or 20-item list).
- [ ] All three `graph-stale-detect` variants were updated together (no platform reads a dead path).
- [ ] `graph-index.md` `paths: always` still auto-loads (or was intentionally converted to explicit-read with icea-feature updated); its internal links resolve.
- [ ] `graph.html` write path does not trip icea-floor unresolved — either exempt-added (narrowly) via Story 4 or confirmed non-Write-tool.
- [ ] Exactly one write target and one read path per artifact — no per-harness duplication (AC-F6).
- [ ] Relocated artifacts live outside `.claude/`, so Copilot scoping cannot hide them (AC-F6).
- [ ] `artifact-paths.md` is the single source for the neutral locations; Stories 4 and 6 read from it, do not re-declare; no path hardcoded twice.
- [ ] `project-rules.md` `paths: ["**/*"]` behaviour note reviewed (see below); `.aidev/` exclusion added only if warranted.
- [ ] `memory/` and `docs/` untrusted-input status unchanged — no new executable authority granted here (defer trust hardening to Story 6 / AC-NF3).
- [ ] Content of moved artifacts is byte-identical to pre-move, EXCEPT `graph-index.md` whose internal links are regenerated by design.
- [ ] D-2 decision note present and matches the implemented location.

### project-rules.md path-match note

`.claude/rules/project-rules.md` declares `paths: ["**/*"]`, so it already matches every file and will now also match the relocated `docs/architecture/**` and `.aidev/graph/**` artifacts (previously these lived under `.claude/` which `**/*` also matched — so the *rule-loading* behaviour is unchanged in practice). This is a **minor behaviour note**, not a defect: project-rules is a coding-standards rule and these artifacts are generated markdown/JSON, so the rule is inert on them. Add a `.aidev/` exclusion to the rule's `paths:` **only if** a reviewer finds the rule producing noise on generated artifacts; otherwise leave `["**/*"]` unchanged to avoid scope creep into Story 3's rule work.

---

## Open Questions

- **graph.html write mechanism (blocking for the icea-floor decision, not for APPROVE):** is `graph.html` written via the Write tool (→ needs Story-4 exempt-pattern add) or via a `.cjs` `fs.writeFileSync` inside graph-viz (→ PreToolUse Write guard never fires, no change needed)? The DoD carries both resolution paths; this must be confirmed during implementation, coordinated with Story 4. It does not block APPROVE of this spec because both outcomes are specified.

D-2 is resolved in this spec (relocate to neutral). No other blocking question remains before APPROVE.

---

## Request Flow

Both harnesses read the one copy of each artifact from its neutral path — no per-harness generation, no `.claude/`-scoped read.

```
GENERATION (once, harness-neutral):
  architect     -> writes docs/architecture/architecture*.md          (single copy)
  graph-sync    -> writes .aidev/graph/graph.json (+ projection,
                   regenerates graph-index.md links, re-registers
                   paths: always)                                     (single copy)
  graph-viz     -> writes .aidev/graph/graph.html                     (single copy; icea-floor coordination)
  memory-capture-> writes memory/MEMORY.md                            (already neutral)
  (docs authored/generated under docs/)                              (already neutral)

READ (both harnesses, same physical file):
  Dana (Claude Code)   -> resolve neutral path via artifact-paths.md -> read docs/architecture, .aidev/graph, memory/, docs/
  Cody (Copilot >=1.109)-> resolve neutral path via artifact-paths.md -> read docs/architecture, .aidev/graph, memory/, docs/
       (Copilot's .claude/ scoping is irrelevant — none of the four artifacts live under .claude/)

INVARIANT: one write target + one read path per artifact. No per-harness copy is ever created.
```

---

## Rollback

Purely a relocation + reader-repoint; no data migration, no schema. Rollback = revert the story's commit range on `feature/4.x-multi-harness`, which moves the directories back to `.claude/architecture/` and `.claude/graph/`, restores the old reader paths in the 20 skills and three hook variants, and restores `graph-index.md`'s original `.claude/graph/...` links. Content is preserved byte-for-byte both directions (graph-index links are regenerated deterministically from location, so the revert regenerates them too). The frozen `v3.13.0` git tag remains the Claude-only fallback (epic-level rollback). No target-repo data is affected; `memory/` and `docs/` are untouched by a rollback since they were never moved.

---

## Handover

### QA Team
**What was added:** architecture docs and the knowledge graph now live at neutral paths (`docs/architecture/`, `.aidev/graph/`) instead of under `.claude/`; `memory/` and `docs/` were already neutral. Both Claude Code and Copilot read the same single copy by path. **How to test:** provision a scratch repo for both harnesses, open in each tool, confirm each reads the same architecture/graph files (INT-1), and confirm the relocated `graph-index.md` links all resolve (P-U5). **Regression risk:** a skill or hook (esp. one of the three `graph-stale-detect` variants) left pointing at an old `.claude/` path — verify grep-clean (N-U1). **Test data:** existing generated artifacts in a scratch repo; no privileged/PII material.

### DevOps / Platform Team
No pipeline, secret, environment-variable, or infrastructure change. This is a file relocation within the repo plus reference updates in markdown/CJS/PS/shell skills and hooks. The `.aidev/` directory is a new top-level neutral folder (also home to `.aidev/manifest.json` in Story 8) — ensure the ignore file does not exclude `.aidev/graph/` artifacts that must be committed. **Story-4 dependency:** if `graph.html` is Write-tool-written, icea-floor's three variants need a narrow `.aidev/graph/graph.html` exempt-pattern add — this is Story-4-owned; do not duplicate the hook edit here. No new HTTP clients, no Docker/AKS change.

### Future Developer — Follow-on Work
- The canonical artifact locations live in `skills/shared/artifact-paths.md` — read that before adding any new reader; never hardcode `.claude/architecture` or `.claude/graph` again. Stories 4 and 6 read the same contract (Story 6 adds the B1–B7 taxonomy location there).
- When adding a new harness (epic extension point), the four artifacts do **not** move — new adapters read them from the same neutral paths.
- Trust/injection hardening for `memory/` and `docs/` (untrusted input) is **Story 6** (AC-NF3), not this story — do not assume these artifacts are safe to execute.

---

## Test Cases

> Derived from AC-F6. Positive + negative + integration + link-resolution. NF verification noted where relevant.

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | architect skill write path | Run architect on a scratch repo | Architecture docs written to `docs/architecture/`, not `.claude/architecture/` | AC-F6 |
| P-U2 | graph-sync write path | Run graph-sync | `graph.json` + projection + `.stale` written to `.aidev/graph/` | AC-F6 |
| P-U3 | artifact-paths.md resolution | A reader resolves architecture + graph + taxonomy path | Returns `docs/architecture/`; graph `.aidev/graph/`; taxonomy entry reserved for Story 6 | AC-F6 |
| P-U4 | memory/docs single-source | Inspect after run | `memory/` and `docs/` present once, at repo root; no per-harness copy | AC-F6 |
| P-U5 | graph-index link resolution | Parse relocated `.aidev/graph/graph-index.md` | Every internal `Detail File` link resolves to an existing file under `.aidev/graph/`; none point at `.claude/graph/` | AC-F6 |
| P-U6 | graph-index auto-load | Start an icea-feature orientation | `graph-index.md` module summaries are in context (via re-registered `paths: always`, or explicit read if fallback) | AC-F6 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | grep-clean gate | Grep `skills/**`, `.claude/hooks/**`, `.claude/rules/**` for `.claude/architecture` / `.claude/graph` | Zero matches; any residual reference fails the gate loudly (this is THE acceptance gate) | AC-F6 |
| N-U2 | no duplication guard | Scan for a second copy of architecture/graph under `.claude/` or `.github/` | No per-harness duplicate exists; only the neutral copy | AC-F6 |
| N-U3 | Copilot scoping cannot hide artifact | Copilot scoped away from `.claude/` (Story 5 settings) | Neutral artifacts still resolvable — outside `.claude/`, so scoping is irrelevant | AC-F6 |
| N-U4 | partial-migration guard | Both `.claude/graph/` (stale) and `.aidev/graph/` exist | `.aidev/graph/` is authoritative; stale copy flagged, never read as second source | AC-F6 |
| N-U5 | stale-detect variant parity | Trigger post-merge on each platform (cjs/ps1/sh path) | All three variants read `.aidev/graph/graph.json` / `.stale`; none reads the dead `.claude/graph/` path | AC-F6 |
| N-U6 | graph.html guard | Attempt the graph.html write path | Either icea-floor exempts `.aidev/graph/graph.html` (Story-4 add) OR the write does not go through the Write tool — never a bypassed guard | AC-F6 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Both harnesses read the single architecture/graph copy | Provision a scratch repo for `claude,copilot`; generate artifacts once; open in Claude Code and Copilot ≥1.109; each reads architecture + graph | Both tools read the **same** physical files at `docs/architecture/` and `.aidev/graph/`; no per-harness duplication; behaviour identical | AC-F6 |
| INT-2 | No hidden-by-scoping regression | With Copilot `.vscode/settings.json` scoping active, run explain/session-start/icea-feature orientation in Copilot | Architecture + graph + graph-index resolve normally from the neutral paths despite `.claude/` scoping | AC-F6 |

> NF verification: AC-F6's "no per-harness duplication" is verified by N-U2 (filesystem scan) plus INT-1
> (both harnesses provably read the same path). The grep-clean gate (N-U1) is the completeness backstop
> against an under-counted reader list. No performance/accessibility NF applies to this relocation story.

---

### Revision Log
2026-08-13 — Story 3a tech spec drafted from the saved Epic ICEA/Tech Spec (dogfood; synthetic ADO-4000). Scope AC-F6. D-2 resolved: relocate architecture → `docs/architecture/`, graph → `.aidev/graph/`; memory/docs already neutral. Schema Changes omitted (no DB); API Changes replaced with artifact-path-change note; Auth & Security replaced with memory/docs-untrusted note cross-referencing Story 6.
2026-08-14 #3 — Align to current ICEA (Revision Logs #6/#7/#8 + "Repository structure & layering (L1/L2/L3)" subsection). Framing-only update — the spec was already consistent on substance (20 readers + grep-clean gate; `graph-index.md` regenerate-not-move + `paths: always`; `graph.html`/icea-floor `.aidev` exempt coordination with Story 4; the `artifact-paths.md` contract — all retained unchanged). Added: (a) a new Overview subsection framing the four shared artifacts as the `<neutral artifacts>` tier of the locked L1/L2/L3 layout (generated once, read by both harnesses), and (b) an explicit statement that this tier is **orthogonal to L1 content standards** — generated repo-specific output, not authored single-source standards, so the L1 re-author guardrail (AC-F2) and prompt-versioning (AC-F9) do not apply. Updated source-ICEA pointer #4→#8.
2026-08-13 #2 — REVISE to match revised ICEA (Revision Log 2026-08-13 #4 + revised AC-F6). Fixes: (1) reader enumeration corrected 8→**20** skills (grep-verified: ado-tasks, app-readiness, architect, critic, dream-rollback, dream-status, graph-create, graph-sync, graph-viz, icea-feature, icea-implement, icea-review, icea-revise, migration, plugin-readiness, pr-describe, pr-spec-review, security, setup-status, token-analysis), and made **grep-clean** the acceptance gate rather than a fixed list. (2) `graph-index.md` treated as a regenerate-not-move: `paths: always` re-register + internal-link regeneration (D-2 sub-option), with explicit-read fallback + icea-feature SKILL.md:85 update + link-resolution test (P-U5). (3) `graph.html` × icea-floor guard conflict enumerated (all three graph-stale-detect variants + `.html` guarded-ext block) with Story-4 exempt-pattern coordination or confirmed non-Write-tool path. (4) Single canonical `artifact-paths.md` path contract shared with Story 4 (hook readers) and Story 6 (taxonomy). (5) `project-rules.md` `paths:["**/*"]` behaviour note (add `.aidev/` exclusion only if warranted). (6) Aligned to revised AC-F6 (location contingent on D-2; asserts single-source + shared-read).
