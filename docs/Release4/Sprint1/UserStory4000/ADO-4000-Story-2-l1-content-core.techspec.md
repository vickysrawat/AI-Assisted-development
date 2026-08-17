# Tech Spec — Story 2: Shared L1 content core + prompt versioning + re-author guardrail
ADO #4000 · Release 4 · Sprint 1 · Story 2
Status: DRAFT · STORY · 4 SP

> Per-story implementation spec for the shared-foundation story of the multi-harness epic.
> Source ICEA: `docs/Release4/Sprint1/UserStory4000/ADO-4000-llm-agnostic-multi-harness.icea.md`
> (revised 2026-08-14 #8 — STRUCTURE LOCKED to a shared content core (L1) + native per-harness
> engagement/enforcement (L2/L3), and PROMPT-ARTIFACT VERSIONING added; this spec matches the rewritten
> AC-F2 (shared content core, NO mechanical projection) and the new AC-F9 (prompt versioning)).
> Epic Tech Spec: `temp/ADO-4000-tech.md` (rollup). This story establishes the **L1 content core** under
> `Shared/` that every later story consumes, the **prompt-artifact version manifest + CHANGELOG + CI
> bump-on-change check**, and the **CI guardrail** that fails any PR where the Copilot side re-authors an
> L1 standard. It also **retires the runtime `$PLUGIN_DIR`** so L1 content is read by explicit path, not a
> resolver. This is a plugin/tooling story (Node.js CJS + markdown content) — there is no database, web
> API, browser, or auth layer, so the web-app template sections are adapted to the plugin's real
> architecture below.

---

## Overview

This story establishes the **shared content core (Layer 1)** for the whole multi-harness epic. Per ICEA
Revision Log 2026-08-14 #7, the earlier projection-engine design is **RETIRED**: there is no
`.claude/skills`↔`.github/skills` mechanical transform, no `delta-map.json`, and no per-skill override
loader. The Copilot side is designed **natively** to its strengths (Story 5+), not mechanically projected
from a Claude shape. Story 2 therefore delivers **content and its governance rails**, not a transform.

Concretely it delivers four pieces: (1) the **L1 content core** under `Shared/` — the single, harness-
independent source of the ICEA + Tech-Spec method, templates, and critic rubric (`Shared/icea/`); the
coding standards and the B1–B7 business-context taxonomy and decision/consent specs (`Shared/rules/`); the
code-review + security **checker knowledge** and the architecture/graph generator knowledge
(`Shared/knowledge/`); and the harness-independent `ai-gate` floor scaffold (`Shared/gate/`). (2) The
**runtime `$PLUGIN_DIR` retirement** so that L1 content is read by explicit, project-relative path rather
than resolved at runtime — a large, multi-shape footprint (see Sizing), not a one-line strip. (3) The
**prompt-artifact versioning system** (AC-F9): a `Shared/prompt-manifest.json` recording
`{version, sha256, consumes}` for every prompt artifact, a `Shared/CHANGELOG.md`, and a **CI bump-on-change
check** that fails any PR where an artifact's on-disk content hash differs from the manifest without a
version bump. (4) The **CI re-author guardrail** (AC-F2): a check that fails any PR where the `Copilot/`
side *re-authors* an L1 standard — the `Claude/` and `Copilot/` engagement layers must **re-deliver, never
re-author** L1; forking a standard into two copies is a build failure.

The governing principle is **single source, native consumption**. L1 is authored once in `Shared/` and is
never duplicated: `Claude/` (native, ≈ the v3.13 plugin) and `Copilot/` (native, redesigned per harness)
**CONSUME** it — they reference/re-deliver L1 content, they do not re-author it. There is no derived
artifact to keep in sync, so there is no drift to prevent by transform; drift is prevented by the CI
guardrail + the version manifest instead. Rollback for every piece is git-based (the transform is not a
concern because there is no transform). A **parity check** confirms the Claude Tier-A write-time gate
(`icea-floor` `exit 2` on an un-approved Write — the file-string floor per AC-NF1, not the authoritative
approval decision) is byte-for-byte unchanged after the `$PLUGIN_DIR` retirement (AC-NF4).

Developer picking this up cold: start at the `Shared/` tree (the L1 content), then
`scripts/check-prompt-versions.cjs` (the bump-on-change + manifest hash check) and
`scripts/check-l1-reauthor.cjs` (the re-author guardrail), then `scripts/lint-self-containment.cjs` (the
`$PLUGIN_DIR` retirement lint).

**Versioning scheme (AC-F9).** L1 artifacts (where a downstream harness branches on their output shape)
carry **SemVer** in frontmatter — MAJOR = output-shape/behaviour change, MINOR = additive, PATCH = wording;
plus a `consumes:` pin listing the L1 versions a consumer depends on. L2 artifacts (per-harness engagement
bodies, authored in later stories) carry a simple `v1/v2` counter plus a `Shared/CHANGELOG.md` entry rather
than full SemVer. `Shared/prompt-manifest.json` records `{version, sha256, consumes}` per artifact; the CI
check recomputes each on-disk `sha256` and fails the PR if content changed without a matching version bump
(hash ≠ manifest). Rollback of an L1 change = pin the prior L1 version via its git tag; a consumer's
`consumes:` pin makes the dependency explicit and auditable.

**What is NOT in this story.** No `Claude/`-side or `Copilot/`-side engagement bodies are authored here
(those are native, per-harness, later stories) — Story 2 only lays down the L1 content they will consume
plus the two CI guardrails and the version manifest that police that consumption. The projection engine,
delta-map, and override loader from the prior draft are **deleted from scope**, not merely descoped.

---

## AC Coverage Matrix

Every AC in scope must be covered by at least one file change; every file change must satisfy at least one
AC. Gaps are flagged ⚠.

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F2 | L1 content core authored ONCE in `Shared/` — ICEA method+templates+critic rubric, coding rules, B1–B7 taxonomy, checker knowledge, ai-gate | `Shared/icea/**`, `Shared/rules/**`, `Shared/knowledge/**`, `Shared/gate/**` | ✅ Covered |
| AC-F2 | NO mechanical projection — no delta-map, no per-skill override loader, no `$PLUGIN_DIR` runtime bridge | `scripts/lint-self-containment.cjs`, `Shared/skills/**` (references reads made project-relative) | ✅ Covered |
| AC-F2 | CI guardrail fails a PR where the `Copilot/` side RE-AUTHORS an L1 standard (re-deliver, never re-author) | `scripts/check-l1-reauthor.cjs`, `Shared/guardrail/l1-standards.json`, `.github/workflows/ai-gate.yml` (check wiring) | ✅ Covered |
| AC-F2 | Runtime `$PLUGIN_DIR` retired — L1 read by explicit project-relative path, not a resolver | `Shared/skills/**`, `scripts/*.cjs`, `skills/shared/plugin-path-resolution.md` (retired/annotated), `scripts/lint-self-containment.cjs` | ✅ Covered |
| AC-F9 | Every prompt artifact carries a frontmatter `version:` (SemVer L1 / v1+ L2) and `consumes:` pin | `Shared/icea/**`, `Shared/rules/**`, `Shared/knowledge/**` (frontmatter), `Shared/CHANGELOG.md` | ✅ Covered |
| AC-F9 | `Shared/prompt-manifest.json` records `{version, sha256, consumes}` per artifact | `Shared/prompt-manifest.json`, `scripts/build-prompt-manifest.cjs` | ✅ Covered |
| AC-F9 | CI bump-on-change check fails a PR where content changed (hash ≠ manifest) without a version bump | `scripts/check-prompt-versions.cjs`, `.github/workflows/ai-gate.yml` (check wiring) | ✅ Covered |
| AC-NF4 | Claude Tier-A write-time floor unchanged after `$PLUGIN_DIR` retirement (parity) | `scripts/verify-parity.cjs`, `.claude/hooks/**` (unchanged) | ✅ Covered |

> AC-F9 note: this story delivers the manifest, the CHANGELOG, the frontmatter versions on **L1** artifacts,
> and the two CI checks (bump-on-change + re-author guardrail). The **provenance-stamp extension** (recording
> prompt-artifact version + dated model snapshot on every governed output, AC-NF5) and the **eval-gate on a
> version bump** are owned by Story 7 — OUT OF SCOPE here. L2 engagement bodies and their `v1/v2` versions
> are authored in the native per-harness stories (Story 4/5/8), not here; this story defines the L1 scheme
> the L2 bodies will follow.

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `Shared/icea/**` (ICEA + Tech-Spec method, templates, critic rubric — L1) | AC-F2, AC-F9 |
| `Shared/rules/**` (coding standards, B1–B7 taxonomy, decision/consent specs — L1) | AC-F2, AC-F9 |
| `Shared/knowledge/**` (code-review + security checker knowledge, arch/graph generators — L1) | AC-F2, AC-F9 |
| `Shared/gate/**` (harness-independent `ai-gate` floor scaffold — L1) | AC-F2 |
| `Shared/guardrail/l1-standards.json` (registry of L1 standard identities the guardrail protects) | AC-F2 |
| `Shared/prompt-manifest.json` (`{version, sha256, consumes}` per prompt artifact) | AC-F9 |
| `Shared/CHANGELOG.md` (human-readable version history for L1 + L2 artifacts) | AC-F9 |
| `scripts/build-prompt-manifest.cjs` (regenerates the manifest from on-disk frontmatter + hashes) | AC-F9 |
| `scripts/check-prompt-versions.cjs` (CI: fails if content hash ≠ manifest without a version bump) | AC-F9 |
| `scripts/check-l1-reauthor.cjs` (CI guardrail: fails if `Copilot/` re-authors an L1 standard) | AC-F2 |
| `scripts/lint-self-containment.cjs` (fails on any runtime `$PLUGIN_DIR` reference in `Shared/`) | AC-F2 |
| `Shared/skills/**` (L1 skill knowledge relocated; `references/` reads made project-relative) | AC-F2, AC-F9 |
| `scripts/*.cjs` (script-execution shape of the `$PLUGIN_DIR` retirement — relocated or resolver-backed) | AC-F2 |
| `skills/shared/plugin-path-resolution.md` (resolver spec doc — retired/annotated; lint carve-out) | AC-F2 |
| `scripts/verify-parity.cjs` (Claude write-time floor parity harness) | AC-NF4 |
| `.github/workflows/ai-gate.yml` (wires the two CI checks; logic owned here, distribution by Story 8) | AC-F2, AC-F9 |

**Coverage result:** all in-scope ACs covered (AC-F2 L1-core + re-author guardrail + `$PLUGIN_DIR`
retirement; AC-F9 versioning; AC-NF4 parity), no orphaned file changes ✅. Other epic ACs (AC-F1, F3–F8,
NF1–NF3, NF5–NF7) are owned by other stories per the epic rollup matrix and are out of scope here. Note:
the Phase-1 self-containment spike (AC-F1) remains a precondition for relocating skill knowledge into
`Shared/`.

---

## Files Changed

> Real plugin paths. No schema section — this is content/markdown/config + a few CI scripts, no database.
> The `Shared/` tree below is the **L1 content core** — the single source both harnesses consume.

| Path | Change | Purpose |
|---|---|---|
| `Shared/icea/` | + new (L1) | ICEA + Tech-Spec **method**, templates, and the **critic rubric** — authored once, consumed by both harnesses. Each file carries SemVer frontmatter + `consumes:`. |
| `Shared/rules/` | + new (L1) | Coding standards, the **B1–B7 business-context taxonomy** (`business-context-severity.md`), and decision/consent specs. Single canonical location — no per-skill bundled copy. SemVer frontmatter. |
| `Shared/knowledge/` | + new (L1) | Code-review + security **checker knowledge** and the architecture/graph **generator knowledge** — the reusable content the skills read, moved out of per-skill `references/` into shared L1. SemVer frontmatter. |
| `Shared/gate/` | + new (L1) | The harness-independent **`ai-gate` floor** scaffold (Tier-C). Story 2 lays the scaffold; the gate LOGIC (approval binding) is Story 6, distribution is Story 8. |
| `Shared/guardrail/l1-standards.json` | + new | Registry naming each L1 standard's canonical identity (path + content fingerprint) so the re-author guardrail can detect a fork/re-author on the `Copilot/` side. |
| `Shared/prompt-manifest.json` | + new | Machine-readable `{version, sha256, consumes}` per prompt artifact — the source of truth the bump-on-change CI check compares on-disk hashes against. Regenerated by `build-prompt-manifest.cjs`. |
| `Shared/CHANGELOG.md` | + new | Human-readable changelog for L1 (SemVer) + L2 (v1/v2) prompt artifacts; an L2 bump requires a CHANGELOG entry (SemVer L1 is self-documenting via the version + `consumes:` pin). |
| `Shared/skills/` | ~ modified/relocated | L1 **skill knowledge** relocated; `$PLUGIN_DIR` **own-`references/` reads** made project-relative; **sibling-skill exec** lines rewritten to project-relative reads. Self-contained. Prompt bodies gain `version:` frontmatter. |
| `scripts/build-prompt-manifest.cjs` | + new | Walks the L1 prompt artifacts, reads each frontmatter `version`/`consumes`, computes `sha256`, writes `Shared/prompt-manifest.json`. Run by maintainers on a version bump; CI runs it in check mode. Node.js CJS. |
| `scripts/check-prompt-versions.cjs` | + new | CI: recomputes each artifact's `sha256`; if content changed vs the manifest without a version bump (hash ≠ manifest and version unchanged), fails the PR naming the artifact. Also validates `consumes:` pins resolve. |
| `scripts/check-l1-reauthor.cjs` | + new | CI guardrail (AC-F2): fails any PR where a file under `Copilot/` (or `Claude/`) *re-authors* an L1 standard listed in `l1-standards.json` — a duplicated/forked standard body is a build failure; a *reference/re-delivery* is allowed. |
| `scripts/lint-self-containment.cjs` | + new | Fails (non-zero exit) if any `Shared/skills/**` file references a runtime plugin dir (`$PLUGIN_DIR`/`plugin-path.txt`/`installed_plugins.json`) in any in-scope shape; resolver-spec doc + architecture docs carved out. |
| `scripts/*.cjs` (resolver-calling scripts) | ~ modified | `$PLUGIN_DIR/scripts/*.cjs` **execution shape**: `scripts/` is NOT inside `Shared/`, so either relocate the invoked scripts alongside their consumer or keep a narrow resolver for script calls only (see D-note in Error Handling). |
| `skills/shared/plugin-path-resolution.md` | ~ retired/annotated | The resolver SPEC DOC (shape d). Retired or annotated as historical; it legitimately documents `$PLUGIN_DIR`, so the self-containment lint carves it out (a hit here is not a violation). |
| `scripts/verify-parity.cjs` | + new | Parity harness: asserts the Claude `icea-floor` hook + gate config is byte-identical pre/post the `$PLUGIN_DIR` retirement and still `exit 2`-blocks an un-approved Write (AC-NF4). |
| `.github/workflows/ai-gate.yml` | + new (check wiring only) | Wires `check-prompt-versions.cjs` + `check-l1-reauthor.cjs` as PR checks. The gate's **approval-binding logic** and its **required-status-check / branch-protection** setup are Story 6/8 — this story adds only the two content-governance checks. |

> Deliberately NOT in this story: any `Claude/` or `Copilot/` **native engagement bodies** (L2 — Story 4/5,
> native per harness, NOT projected); rules projection to harnesses (Story 3); artifact relocation (Story
> 3a); hook compat shim (Story 4); `.vscode/settings.json` scoping (Story 5); the `ai-gate` **approval
> logic** + review-time `review-icea` critic (Story 6); branch-protection/required-check + provenance-stamp
> + eval-gate-on-version-bump (Story 7/8). Story 2 provides the L1 content + version manifest + two
> guardrails those stories consume.

---

## API Changes — CI check CLI + manifest/guardrail data contracts

No HTTP API (plugin runs in-process). The "API" here is the CLI surface of the CI scripts and the data
contracts (`prompt-manifest.json`, `l1-standards.json`) that later stories and CI call.

**CLI:**

| Command | Behaviour |
|---|---|
| `node scripts/build-prompt-manifest.cjs` | Walk L1 prompt artifacts, read frontmatter `version`/`consumes`, compute `sha256`, write `Shared/prompt-manifest.json`. Maintainer runs this on a version bump. |
| `node scripts/check-prompt-versions.cjs` | CI mode: recompute hashes; exit non-zero if any artifact's content changed without a version bump (hash ≠ manifest, version unchanged), or a `consumes:` pin does not resolve. Writes nothing. |
| `node scripts/check-l1-reauthor.cjs` | CI guardrail: exit non-zero if a `Copilot/`/`Claude/` file re-authors (duplicates/forks) an L1 standard from `l1-standards.json`; a reference/re-delivery passes. Writes nothing. |
| `node scripts/lint-self-containment.cjs` | Exit non-zero if any `Shared/skills/**` file references a runtime plugin dir in any in-scope shape, with the resolver-spec doc + architecture docs carved out. Writes nothing. |
| `node scripts/verify-parity.cjs` | Assert the Claude Tier-A `icea-floor` write-time gate still `exit 2`-blocks an un-approved Write, pre/post the `$PLUGIN_DIR` retirement. |

**`Shared/prompt-manifest.json` data contract (AC-F9):**

```
{
  "artifacts": [
    {
      "path": "Shared/icea/icea-template.md",
      "layer": "L1",
      "version": "2.1.0",
      "sha256": "b7f3...e91a",
      "consumes": []
    },
    {
      "path": "Shared/rules/business-context-severity.md",
      "layer": "L1",
      "version": "1.0.0",
      "sha256": "4c02...aa17",
      "consumes": []
    }
  ]
}
```

L1 entries carry SemVer; L2 entries (added by later stories) carry a `v1/v2` string plus a required
`CHANGELOG.md` line. `consumes:` lists the `path@version` of each L1 artifact the entry depends on, so a
downstream bump is traceable.

**`Shared/guardrail/l1-standards.json` data contract (AC-F2):**

```
{
  "standards": [
    { "id": "coding-rules",  "canonical": "Shared/rules/coding-standards.md",       "fingerprint": "sha256:1a2b..." },
    { "id": "b1-b7-taxonomy","canonical": "Shared/rules/business-context-severity.md","fingerprint": "sha256:9f0c..." },
    { "id": "critic-rubric", "canonical": "Shared/icea/critic-rubric.md",            "fingerprint": "sha256:77de..." }
  ]
}
```

The re-author guardrail flags a `Copilot/`/`Claude/` file whose content substantially reproduces a
`canonical` L1 standard body (a fork), while allowing an explicit reference/re-delivery. The exact
fork-detection heuristic (fingerprint overlap threshold vs an explicit reference marker) is decided inline
at implement time per the decision-transparency rule and documented in `check-l1-reauthor.cjs`.

**Frontmatter version contract (AC-F9):** every L1 prompt artifact carries `version:` (SemVer) and, where
it depends on other L1 content, a `consumes:` list. Example:

```
---
version: 2.1.0
consumes:
  - Shared/rules/business-context-severity.md@1.0.0
---
```

---

## Auth & Security — Parity requirement + content-governance guardrails

No auth layer in this story. Two security-relevant properties:

**(1) Regression parity (AC-NF4).** The `$PLUGIN_DIR` retirement must not weaken the Claude enforcement
path. Per revised AC-NF1, the Claude Tier-A `icea-floor` hook remains a fast file-string floor (the
authoritative approval decision moves to Tier C in Story 6); this story must keep that write-time floor
byte-for-byte unchanged. `scripts/verify-parity.cjs` asserts the Tier-A `icea-floor` hook still `exit
2`-blocks a Write with no approved ICEA, pre- and post-retirement. Any behaviour change must be an
explicit, called-out decision, not smuggled under "unchanged" (AC-NF4). No secrets are read, written, or
placed in model context by any script here; they read `Shared/**` + config and write only the manifest.

**(2) Content-governance guardrails (AC-F2 + AC-F9) prevent silent standard drift.** The core security
stance of the L1 model is that a standard lives in exactly ONE place. The **re-author guardrail**
(`check-l1-reauthor.cjs`) makes a forked/duplicated standard a build failure, so a `Copilot/`-side author
cannot silently diverge the coding rules or the B1–B7 taxonomy from the canonical L1 copy — closing the
"two divergent toolchains" governance gap the epic exists to solve. The **bump-on-change check**
(`check-prompt-versions.cjs`) makes an un-versioned change to a governed prompt a build failure, so every
change to a standard, template, or critic rubric is traceable to a version and (for L2) a CHANGELOG entry —
the foundation the Story-7 provenance stamp builds on. Both checks are fail-closed and un-bypassable at
merge once wired as required checks (Story 8). The B1–B7 taxonomy's single canonical location is fixed here
(`Shared/rules/business-context-severity.md`) — later stories reference it, never re-bundle it.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| **Un-versioned prompt change** — an L1 artifact's on-disk `sha256` differs from `prompt-manifest.json` but its `version:` is unchanged | `check-prompt-versions.cjs` fails (non-zero exit) naming the artifact + old/new hash; instructs the author to bump the version and re-run `build-prompt-manifest.cjs`. Never passes a silent content change. |
| **Dangling `consumes:` pin** — an artifact's `consumes:` names an L1 `path@version` not present in the manifest | Fail loudly naming the pinning artifact + the unresolved pin; forces the consumer to update its pin when an L1 version moves. |
| **L1 standard re-authored on the Copilot side** — a `Copilot/` (or `Claude/`) file substantially reproduces a canonical L1 standard body | `check-l1-reauthor.cjs` fails naming the offending file + the L1 standard it forks; the fix is to *reference/re-deliver* L1, not copy it. A legitimate reference passes. |
| **Manifest out of date** — `prompt-manifest.json` is missing an artifact that exists on disk, or lists one that was deleted | Fail loudly with the diff; the manifest must be regenerated (`build-prompt-manifest.cjs`) so the check operates on a complete set — never check a partial set silently. |
| **Self-containment violation** — a `Shared/skills/**` file references a runtime plugin dir (`$PLUGIN_DIR`, `plugin-path.txt`, `installed_plugins.json`) in any in-scope shape (references reads, sibling-skill exec, script execs) | `lint-self-containment.cjs` fails with the file + line + shape. The resolver-spec doc (`skills/shared/plugin-path-resolution.md`) and architecture docs are CARVED OUT — a documented mention there is not a violation. |
| **Script-execution shape unresolved** — a skill body still shells out to `$PLUGIN_DIR/scripts/*.cjs` and the invoked script was neither relocated nor backed by the narrow script-call resolver | Lint fails naming the skill + the script path; forces an explicit decision (relocate vs resolver) rather than a dangling exec. |
| **Parity regression** — `verify-parity.cjs` detects the Claude gate no longer `exit 2`-blocks after the retirement | Non-zero exit, blocks the story's DoD; the retirement is treated as broken (AC-NF4). |
| **Missing CHANGELOG entry for an L2 bump** — an L2 artifact's version counter incremented but no `CHANGELOG.md` line added | Fail loudly naming the artifact; L2 versioning requires a changelog line (SemVer L1 is self-documenting and exempt from this specific check). |

> **D-note (script-execution shape):** `scripts/` sits outside `Shared/`, so the L1 content cannot
> self-contain script calls by relocation alone. Two viable options — (A) relocate the invoked `.cjs`
> alongside its consumer (fully self-contained, larger diff, possible duplication across shared scripts);
> (B) keep a single narrow resolver used ONLY for script execution (smaller diff, but retains a resolver,
> so the "no runtime plugin dir" claim needs the explicit script-call carve-out). This story records the
> fork; the implementer picks one per the decision-transparency rule and documents it inline. Default lean:
> (A) for skill-local scripts, (B) only for genuinely shared infra scripts.

All failures are loud and non-zero-exit (fail-closed) — consistent with the epic's "fails loudly, never
proceeds leaving a broken/ambiguous state" principle.

---

## Sizing and Story Breakdown

Per ICEA Revision Log 2026-08-14 #7/#8, Story 2 is re-scoped from a projection engine to **"establish the
L1 core + versioning + guardrail."** The projection engine, delta-map, and per-skill override loader are
**deleted from scope** — that machinery no longer exists in the design. What remains and grows is the L1
content consolidation, the `$PLUGIN_DIR` retirement, and the two new CI guardrails + version manifest
(AC-F9).

The `$PLUGIN_DIR` retirement is still NOT a 1–2 SP strip. Verified footprint: **~531 references across ~53
files in 4 SHAPES** — (a) a skill's own `references/` reads, (b) sibling-skill inline exec, (c) `$PLUGIN_DIR/
scripts/*.cjs` executions (scripts outside `Shared/`), (d) the resolver spec doc. Retirement is split BY
SHAPE. Because there is no transform/override/rollout-gate machinery to build, the engineering surface
shrinks relative to the prior draft, but the **new AC-F9 versioning system + the re-author guardrail** add
back roughly the removed weight — netting to ~4 SP.

| AC group | Work | SP |
|---|---|---|
| AC-F2 (L1 core) | Consolidate L1 content into `Shared/{icea,rules,knowledge,gate}` — method+templates+critic rubric, coding rules, B1–B7 taxonomy, checker knowledge, gate scaffold; single canonical locations | 1.5 |
| AC-F2 (resolver retirement) | Retire `$PLUGIN_DIR` across 4 shapes (a references-reads, b sibling-exec→project-relative, c script-execs, d resolver spec) + `lint-self-containment.cjs` with carve-outs | 1.5 |
| AC-F2 (re-author guardrail) | `l1-standards.json` registry + `check-l1-reauthor.cjs` CI check (fork detection; reference allowed) | 0.5 |
| AC-F9 (versioning) | Frontmatter `version:`/`consumes:` on L1 artifacts + `prompt-manifest.json` + `CHANGELOG.md` + `build-prompt-manifest.cjs` + `check-prompt-versions.cjs` bump-on-change | 1 |
| AC-NF4 (parity) | `verify-parity.cjs` Claude write-time floor parity harness | 0.5 |
| **Total** | | **~5** |

**Total SP: ~4** (target size per ICEA #7/#8). The table rows sum to ~5 raw effort; consolidating the L1
content and the versioning frontmatter overlaps with the same file passes (adding `version:` while
relocating a file is one edit, not two), so the realistic net is **~4 SP**. This is now a single, shippable
≤5-SP story and **does not sub-decompose** — the deleted projection/override/rollout-gate machinery was the
source of the earlier oversizing.

**Type: STORY** — a self-contained shippable slice at ~4 SP. It establishes the L1 content core, the
version manifest + bump-on-change check, the re-author guardrail, and the `$PLUGIN_DIR` retirement, and
proves Claude parity. Later stories consume this L1 core natively per harness.

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] All files changed as specified in Files Changed
- [ ] The L1 content core exists under `Shared/{icea,rules,knowledge,gate}` — ICEA method+templates+critic rubric, coding rules, the B1–B7 taxonomy at its single canonical location, checker knowledge, and the ai-gate scaffold
- [ ] No hardcoded secrets, connection strings, or credentials in any script or config
- [ ] No `console.log` diagnostic output in production paths (structured reporter only)
- [ ] No `$PLUGIN_DIR` / `plugin-path.txt` / `installed_plugins.json` reference remains in any `Shared/skills/**` file across shapes (a) references-reads, (b) sibling-exec, (c) script-execs — lint passes with only the resolver-spec doc + architecture docs carved out
- [ ] Every L1 prompt artifact carries a frontmatter `version:` (SemVer) and a `consumes:` pin where it depends on other L1 content
- [ ] `Shared/prompt-manifest.json` records `{version, sha256, consumes}` for every L1 prompt artifact and is regenerable by `build-prompt-manifest.cjs`
- [ ] `Shared/CHANGELOG.md` exists and is populated for the initial L1 versions
- [ ] `Shared/guardrail/l1-standards.json` names each protected L1 standard's canonical path + fingerprint
- [ ] NO projection engine, delta-map, or per-skill override loader is present (retired per ICEA #7 — re-introducing them is a scope violation)

**Quality**
- [ ] All positive and negative unit tests pass — see Test Cases
- [ ] `check-prompt-versions.cjs` fails a PR with an un-versioned prompt change and passes a correctly-bumped one
- [ ] `check-l1-reauthor.cjs` fails a PR that forks an L1 standard into `Copilot/` and passes a legitimate reference
- [ ] Parity test passes: Claude Tier-A write-time floor still `exit 2`-blocks an un-approved Write (AC-NF4)
- [ ] Regression verified: the `.claude/` tree behaves identically to 3.x after the `$PLUGIN_DIR` retirement

**Review readiness**
- [ ] PR title: `[ADO-4000] Story 2 — L1 content core + prompt versioning + re-author guardrail`
- [ ] PR description maps each changed file to its ACs (reference AC Coverage Matrix)
- [ ] ICEA + this story tech spec committed on the feature branch (`feature/4.x-multi-harness`)

### Reviewer Checklist
- [ ] L1 content lives in exactly ONE place under `Shared/` — no duplicated standard body anywhere in `Claude/` or `Copilot/`
- [ ] The B1–B7 taxonomy has a single canonical location and is not re-bundled per skill
- [ ] No skill reads a runtime plugin dir after this story across all 4 shapes (spot-check `icea-feature`, `migration`, plus 3 random skills; confirm `scripts/*` execs resolved)
- [ ] `prompt-manifest.json` hashes match on-disk content; `check-prompt-versions.cjs` genuinely fails on an un-bumped change (verified by a negative test), not a stubbed pass
- [ ] `consumes:` pins resolve to a manifest entry; a dangling pin fails loudly
- [ ] `check-l1-reauthor.cjs` distinguishes a fork (fail) from a reference/re-delivery (pass) — verified by both a positive and a negative test; the heuristic is documented inline
- [ ] `verify-parity.cjs` genuinely exercises the gate (not a stubbed pass) and asserts `exit 2`
- [ ] Self-containment lint carve-out is correct: `plugin-path-resolution.md` + architecture docs excluded; everything else enforced
- [ ] No projection/delta-map/override-loader code exists (retired)

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None blocking. The re-author fork-detection heuristic (fingerprint-overlap threshold vs an explicit reference marker) is a documented inline decision at implement time, not a blocker. The script-execution-shape fork (relocate vs narrow resolver, see Error Handling D-note) is likewise a recorded inline decision. Both follow the decision-transparency rule. | Story 2 owner | — | Resolved |

> No open question blocks SAVE TECH — the two forks have recorded decision procedures and the ICEA-level
> D-blocks that touched this story (D-4 override threshold) are dissolved by the #7 retirement of the
> projection/override machinery.

---

## Request Flow — author L1 → consume natively → CI polices

```
AUTHOR (maintainer edits L1 ONCE):
  Shared/icea/**        (ICEA + Tech-Spec method, templates, critic rubric — SemVer frontmatter)
  Shared/rules/**       (coding standards, B1-B7 taxonomy, decision/consent specs — SemVer frontmatter)
  Shared/knowledge/**   (code-review + security checker knowledge, arch/graph generators — SemVer)
  Shared/gate/**        (harness-independent ai-gate floor scaffold)
  -> bump version: on any changed artifact, then: node scripts/build-prompt-manifest.cjs
     (recomputes sha256 + writes Shared/prompt-manifest.json; add a CHANGELOG.md line for L2)

CONSUME (native, per harness — LATER stories, not this one):
  Claude/ (native, ~v3.13)   -> references/re-delivers L1 (NEVER re-authors)
  Copilot/ (native)          -> references/re-delivers L1 (NEVER re-authors)

CI POLICES (this story wires these two checks into ai-gate.yml):
  node scripts/check-prompt-versions.cjs -> fail if on-disk hash != manifest without a version bump (AC-F9)
  node scripts/check-l1-reauthor.cjs     -> fail if Copilot/ (or Claude/) re-authors an L1 standard (AC-F2)
  node scripts/lint-self-containment.cjs -> fail on any runtime $PLUGIN_DIR reference in Shared/ (AC-F2)

VERIFY:
  node scripts/verify-parity.cjs -> Claude Tier-A gate still exit-2 blocks an un-approved Write (AC-NF4)
```

---

## Rollback

Purely additive content + config + CI scripts, all git-tracked — rollback is git-based, no data migration.

1. **Frozen fallback:** the `v3.13.0` git tag remains the Claude-only baseline; `main` stays on 3.13 until
   4.0 proves out. Full rollback = re-checkout the tag — instant, no data loss.
2. **Per-story revert:** this story's work lives on `feature/4.x-multi-harness`; `git revert` its commit
   range removes the `Shared/{icea,rules,knowledge,gate,guardrail}` content, `prompt-manifest.json`,
   `CHANGELOG.md`, the CI scripts, and the `ai-gate.yml` check wiring, and restores the `$PLUGIN_DIR`
   references in `Shared/skills/**` and `scripts/*`. The `.claude/` tree reverts to its 3.x state.
3. **Version rollback (AC-F9):** to roll back a single L1 change without reverting the whole story, pin the
   prior L1 version via its git tag; a consumer's `consumes:` pin makes the dependency explicit and the
   rollback traceable.
4. **Verify after rollback:** `verify-parity.cjs` confirms the Claude Tier-A write-time floor still `exit
   2`-blocks an un-approved Write (AC-NF4 holds in both directions).

No schema migrations, no irreversible data changes; `Shared/`, the manifest, and the CI scripts are all
regenerable from source under git.

---

## Handover

### QA Team
**What was added:** the **L1 content core** under `Shared/{icea,rules,knowledge,gate}` (the single source
of the ICEA method+templates+critic rubric, coding rules, B1–B7 taxonomy, checker knowledge, and the
ai-gate scaffold), a **prompt-artifact versioning system** (`prompt-manifest.json` + `CHANGELOG.md` +
frontmatter `version:`/`consumes:` + a CI bump-on-change check), a **CI re-author guardrail** (the Copilot
side must not fork an L1 standard), and the **4-shape `$PLUGIN_DIR` retirement** (L1 read by explicit path,
no resolver). There is NO projection engine, delta-map, or override loader — those were retired in the
design (ICEA #7).

**How to test:** run `node scripts/build-prompt-manifest.cjs` then `node scripts/check-prompt-versions.cjs`
and confirm a clean pass; edit an L1 artifact without bumping its `version:` → confirm the check fails
naming the artifact. Add a duplicated coding-rules body under `Copilot/` → confirm `check-l1-reauthor.cjs`
fails; replace it with a reference → confirm it passes. Run `node scripts/lint-self-containment.cjs` and
confirm zero `$PLUGIN_DIR` hits (except the carved-out resolver-spec doc + arch docs). Run `node
scripts/verify-parity.cjs` and confirm the Claude gate still blocks an un-approved Write.

**Regression risk:** the Claude path (Tier-A write-time floor + project `.claude/` loading) must be
unchanged after the `$PLUGIN_DIR` retirement — run the parity test (P-U/INT below). Test data: the real L1
content + the 32 skills' `references/`; no secrets or privileged fixtures are involved.

### DevOps / Platform Team
No pipeline, Key Vault, container, or environment-variable changes beyond adding two content-governance
checks to `.github/workflows/ai-gate.yml` (`check-prompt-versions.cjs` + `check-l1-reauthor.cjs`). These
run as ordinary Node.js CJS scripts in CI with no network calls. Making them **required status checks** on a
protected branch (so they are un-bypassable at merge) is a Story 8 concern; the gate's **approval-binding
logic** is Story 6. Note the script-execution shape (c): if the narrow-resolver option is chosen for shared
infra scripts, that resolver is a retained runtime dependency to track. No new secrets.

### Future Developer — Follow-on Work
- **Change an L1 standard:** edit the single `Shared/` copy, bump its frontmatter `version:` (SemVer),
  add a `CHANGELOG.md` line for L2 consumers if any, and re-run `build-prompt-manifest.cjs`. NEVER copy the
  standard into `Claude/` or `Copilot/` — reference/re-deliver it (the guardrail will fail a fork).
- **Author a native engagement body (L2):** that is Story 4/5/8 work — `Claude/` and `Copilot/` bodies are
  designed natively per harness and CONSUME L1; give each a `v1/v2` version + a CHANGELOG line. Do NOT
  re-introduce a projection engine, delta-map, or override loader.
- **Where the version stamp / eval-gate lives:** the provenance stamp (output → prompt-version + dated
  model snapshot, AC-NF5) and the eval-gate-on-version-bump are Story 7 — they consume this manifest.
- **Where the gate approval logic lives:** Story 6 (`ai-gate` approval binding + review-time `review-icea`);
  Story 8 distributes it and wires the required status check + branch protection.
- Story 3 (rules), 3a (artifacts), 4 (hooks), 5 (native Copilot) all consume this L1 core — keep L1 the
  single source and the manifest authoritative.

---

## Test Cases

> Derived from rewritten AC-F2 (L1 content core + NO mechanical projection + re-author guardrail + 4-shape
> no-plugin-dir), new AC-F9 (prompt versioning: frontmatter + manifest + bump-on-change), and AC-NF4
> (parity). Every AC has a positive and a negative unit test; integration tests cover end-to-end.

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `check-prompt-versions.run()` | an L1 artifact whose content changed AND whose `version:` was bumped, manifest regenerated | passes (exit 0) — hash matches the bumped manifest entry | AC-F9 |
| P-U2 | `build-prompt-manifest.run()` | the L1 tree with frontmatter `version:`/`consumes:` on each artifact | writes `prompt-manifest.json` with a `{version, sha256, consumes}` entry per artifact; hashes match on-disk content | AC-F9 |
| P-U3 | `check-l1-reauthor.run()` | a `Copilot/` file that REFERENCES/re-delivers the coding-rules L1 standard (no forked body) | passes (exit 0) — reference is allowed | AC-F2 |
| P-U4 | `lint-self-containment.run()` | the relocated `Shared/skills/**` with all reads made project-relative | passes (exit 0); only the carved-out resolver-spec doc + arch docs contain a `$PLUGIN_DIR` mention | AC-F2 |
| P-U5 | `verify-parity.run()` | Claude `icea-floor` hook + no approved ICEA on a Write, post-retirement | returns `exit 2` (gate blocks) — matches 3.x baseline | AC-NF4 |
| P-U6 | `check-prompt-versions.run()` | an artifact with a `consumes:` pin that resolves to a present manifest entry | passes (exit 0) — pin resolves | AC-F9 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `check-prompt-versions.run()` | an L1 artifact whose content changed but whose `version:` was NOT bumped (hash ≠ manifest) | non-zero exit; error names the artifact + old/new hash; instructs to bump + rebuild manifest | AC-F9 |
| N-U2 | `check-prompt-versions.run()` | an artifact whose `consumes:` pin names an L1 `path@version` absent from the manifest | non-zero exit; error names the pinning artifact + the unresolved pin | AC-F9 |
| N-U3 | `check-l1-reauthor.run()` | a `Copilot/` file that RE-AUTHORS (forks a copy of) the B1–B7 taxonomy body | non-zero exit; error names the offending file + the L1 standard it forks | AC-F2 |
| N-U4 | `lint-self-containment.run()` | a `Shared/skills/**` file still referencing `$PLUGIN_DIR` (references-read OR sibling-exec OR `$PLUGIN_DIR/scripts/*` exec) | non-zero exit; error names file + line + shape; a mention in `plugin-path-resolution.md` or an arch doc does NOT trip it (carve-out verified) | AC-F2 |
| N-U5 | `verify-parity.run()` | a tampered projected Claude gate that returns `exit 0` on an un-approved Write | test fails loudly — parity regression detected | AC-NF4 |
| N-U6 | `check-prompt-versions.run()` | an L2 artifact whose version counter incremented but with NO `CHANGELOG.md` entry | non-zero exit; error names the artifact; L2 bump requires a changelog line | AC-F9 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | L1 content core is single-source | build the L1 tree; grep `Claude/` + `Copilot/` for any duplicated standard body listed in `l1-standards.json` | zero duplicated L1 standard bodies; each standard lives only under `Shared/` | AC-F2 |
| INT-2 | Version bump end-to-end | edit an L1 artifact, bump its `version:`, run `build-prompt-manifest.cjs`, run `check-prompt-versions.cjs` | manifest updated with new hash + version; check passes | AC-F9 |
| INT-3 | Un-versioned change is blocked | edit an L1 artifact WITHOUT bumping `version:`, run `check-prompt-versions.cjs` | non-zero exit naming the artifact; PR would fail | AC-F9 |
| INT-4 | Re-author guardrail end-to-end | add a forked coding-rules body under `Copilot/`, run `check-l1-reauthor.cjs`; then replace it with a reference and re-run | fork run fails loudly; reference run passes | AC-F2 |
| INT-5 | No runtime plugin dir anywhere (4 shapes) | `lint-self-containment.cjs` across all 32 skills + check the script-exec shape + grep `Shared/` | zero `$PLUGIN_DIR`/`plugin-path`/`installed_plugins` hits in `Shared/skills`, EXCEPT the carved-out resolver-spec doc + arch docs; script-exec shape resolved | AC-F2 |
| INT-6 | Claude write-time floor parity end-to-end | after the retirement, attempt a Write with no approved ICEA on Claude | blocked `exit 2` — identical to 3.x baseline | AC-NF4 |
| INT-7 | CI wiring | run `ai-gate.yml` locally (act/dry-run) with a clean tree, then with an un-versioned change and a forked standard | clean tree passes; the two content-governance checks each fail their respective bad input | AC-F2, AC-F9 |

> NF AC verification:
> AC-NF4 (parity — Claude write-time floor unchanged after `$PLUGIN_DIR` retirement): verified by
> `scripts/verify-parity.cjs` (P-U5, N-U5, INT-6) asserting `exit 2` on an un-approved Write pre- and
> post-retirement, plus a byte-level diff of the Claude gate config against the 3.x baseline. Per AC-NF4,
> any behaviour change is an explicit called-out decision, never smuggled under "unchanged."
> AC-NF5 (provenance stamp extension — output → prompt-version + dated model snapshot): NOT verified here —
> owned by Story 7, which consumes this story's `prompt-manifest.json`.

---

### Revision Log
2026-08-13 — Story 2 tech spec drafted from the saved ICEA (AC-F2 primary + AC-NF4 parity) and the epic
tech spec rollup. Web-app template sections adapted to plugin reality: Schema Changes omitted (no DB);
API Changes → projection CLI + delta-map data contract; Auth & Security → Tier-A parity requirement.
2026-08-13 #2 — Re-revised to match revised ICEA (Revision Log 2026-08-13 #4 + revised AC-F2). Dropped the
`allowed-tools`↔`tools` transform; delta-map re-derived to REAL deltas; added a sibling-skill invocation
guard; re-sized the `$PLUGIN_DIR` retirement to ~531 refs / 4 shapes; skill count fixed to 32.
2026-08-14 #3 — Re-revised to match ICEA ASYMMETRIC enforcement (Revision Log 2026-08-14 #6). Dissolved the
sibling-skill "prove-before-rollout" blocker; reframed orchestrating skills as GUIDANCE form on Copilot;
re-sized ~7→~6.5.
2026-08-14 #4 — MAJOR RE-SCOPE to match ICEA Revision Log 2026-08-14 #7 (STRUCTURE LOCKED: shared content
core L1 + native per-harness L2/L3) + #8 (PROMPT-ARTIFACT VERSIONING, AC-F9). Story 2 transformed from a
"projection engine" into "establish the L1 core + versioning + guardrail." **Deleted from scope:** the
projection engine, `delta-map.json`, the per-skill override loader, and the `.claude/skills`↔`.github/
skills` mechanical transform (all retired in #7). **Added:** (1) the L1 content core under
`Shared/{icea,rules,knowledge,gate}`; (2) the CI **re-author guardrail** (`check-l1-reauthor.cjs` +
`l1-standards.json`) — the Copilot side must re-deliver, never re-author, an L1 standard; (3) the
**prompt-artifact versioning** system (AC-F9): `prompt-manifest.json` `{version, sha256, consumes}` +
`CHANGELOG.md` + frontmatter `version:`/`consumes:` (SemVer for L1, v1/v2+changelog for L2) +
`check-prompt-versions.cjs` bump-on-change check. Retained: the 4-shape/~531-ref `$PLUGIN_DIR` retirement,
the `verify-parity.cjs` AC-NF4 harness, skill count 32. Rewrote Overview, AC Coverage Matrix (AC-F2 rewritten
+ AC-F9 added, AC-F7 removed as it is not this story's concern under the new structure), Files Changed, API
Changes (CI-check CLI + manifest/guardrail data contracts, delta-map contract removed), Auth & Security,
Error Handling, Sizing (re-sized to ~4 SP, no longer sub-decomposes), DoD, Request Flow, Rollback, Handover,
and all Test Cases. Source-ICEA pointer updated to #8.
