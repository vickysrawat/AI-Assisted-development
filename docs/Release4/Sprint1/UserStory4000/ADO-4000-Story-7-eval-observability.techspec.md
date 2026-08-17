# Tech Spec — Story 7: Eval harness + audit stamping + capability floor + prompt-version gate
ADO #4000 · Release 4 · Sprint 1 · Story 7
Status: DRAFT · STORY · 5 SP

> Per-story tech spec for the LLM-agnostic multi-harness epic. Source ICEA:
> `docs/Release4/Sprint1/UserStory4000/ADO-4000-llm-agnostic-multi-harness.icea.md`
> (Revision Log 2026-08-14 #8 — PROMPT-ARTIFACT VERSIONING added: AC-F9 prompt-version
> manifest + bump-on-change CI check; AC-NF5 stamp extended with prompt-artifact
> version(s) + dated model snapshot + key params; Story 7 gains the eval-gate-on-prompt-
> version-bump. Also honours #6 ASYMMETRIC enforcement gate-point stamp + #7 shared L1
> content core / native L2/L3 per-harness structure). Epic spec: `temp/ADO-4000-tech.md`.
> This is a **plugin/tooling** story — Node.js CJS + markdown, no web app. Standard
> web-app template sections (Schema Changes, browser->API->DB flow, Azure AD/CSRF, Key
> Vault) are adapted or omitted per the plugin's real architecture.
> Depends on Story 6 (governance hardening — approval binding, egress policy, Tier-C gate
> exist by the time this story runs), **Story 4** (which PRODUCES the audit-stamp hook
> `artifact-write.cjs`, the harness-detection helper, and the Copilot-deny PreToolUse
> marker that this story consumes), and **Story 2** (which PRODUCES the L1
> `Shared/prompt-manifest.json` + the SemVer `version:`/`consumes:` frontmatter contract +
> the bump-on-change CI check that this story's prompt-version regression gate reads).

---

## Overview

This story delivers the **assurance and observability** layer of the epic: it makes the
governance tool detect its own regression **deterministically in CI**, gates on any
**prompt-artifact version bump**, and makes every governed artifact auditable across
harnesses under the ASYMMETRIC enforcement model. Four deliverables land together.

**L1/L2/L3 framing.** Under the epic's shared-content structure (Revision Log #7), the eval
fixtures, expected-shape manifests, and the prompt-version manifest are **L1-adjacent**: the
`Shared/prompt-manifest.json` is authored once in `Shared/` as the single L1 versioning
source of truth, and the eval corpus lives under `Shared/eval/` where BOTH harnesses'
artifacts are validated against one shared expected-shape + AC-coverage contract. This story
adds **no per-harness copy** of any eval or manifest artifact — it consumes the single L1
source and validates each harness's checked-in output against it. The audit-stamp writer
(`audit-stamp.cjs`) is wired into `artifact-write.cjs`, which is **produced by Story 4** (the
L3-enforcement/hook story) — this story owns the stamp *content* (an L1-derived record), not
the write hook.

(1) An **audit-stamp writer** that records `model + version + harness + skill-hash`, a
per-artifact **gate point**, AND — new in #8 — the **prompt-artifact version(s)** that
produced the artifact, the **dated model snapshot** (not an alias), and the **key generation
params**. Under the asymmetric model, enforcement is HARD on BOTH harnesses — only the gate
*point* differs: **Claude enforces at a prevention gate (write-time)**; **Copilot enforces at
a merge gate (the CI `ai-gate` as a required status check on a protected branch)**. Neither is
soft: a write-time `exit 2` and an un-bypassable required check are both hard lines, applied
at different points in the flow. The stamp records WHICH gate point governed the artifact so
provenance is auditable — e.g. `gate: prevention` for a Claude-produced artifact vs
`gate: merge` for a Copilot-produced one. This REPLACES the earlier "hard vs soft assurance
tier" framing, which wrongly implied a Copilot artifact was merely soft; there is no "soft"
value and the stamp never asserts one harness is weaker than the other (AC-NF5).

The **gate point is DERIVED from harness detection**, whose signal originates in Story 4: the
harness-detection helper + the Copilot PreToolUse marker Story 4 delivers. Claude detected ->
`gate: prevention`; Copilot detected -> `gate: merge`. The gate point is derived from that
detection, never read from artifact content, so a self-authored gate claim cannot override the
detected value (AC-NF5). The stamp is invoked from `artifact-write.cjs`, which is **produced by
Story 4** — this story does NOT create or modify that hook; it adds `audit-stamp.cjs` as a step
Story 4's hook calls, and depends on Story 4 landing first (dependency edge Story 7 -> Story 4).

**Output -> prompt-version provenance (AC-NF5 x AC-F9, new in #8).** The stamp now closes the
loop from a governed output back to the exact prompt that produced it. On every stamp,
`audit-stamp.cjs` reads the producing skill's `version:` and its `consumes:` L1 pins from
frontmatter, resolves each to the recorded `{version, sha256}` in `Shared/prompt-manifest.json`
(Story 2's artifact), and records:
  - `prompt_versions` — an ordered list of `{artifact, version, sha256}` for the producing
    skill plus every L1 artifact it declares in `consumes:` (so the ICEA/Tech-Spec template +
    critic-rubric version that shaped the output is captured, not just the skill).
  - `model_snapshot` — the **dated** model identifier (e.g. a `claude-*-YYYYMMDD` snapshot id),
    NOT a moving alias, so the record is reproducible after an alias rolls forward.
  - `params` — the key generation params (temperature, top_p, max_tokens, and the routing env
    var that selected the model — e.g. `ICEA_MODEL`).
Any governed output is therefore traceable to the exact prompt-artifact versions AND the exact
dated model + params that produced it (reproducibility). The prompt-version fields are read
from frontmatter + the manifest, never hand-asserted in artifact body — a body claim cannot
override the manifest-resolved value.

(2) A **DETERMINISTIC behavioural eval harness** under `Shared/eval/**` that runs in CI.
There is **no headless Copilot skill-runner** — skills are markdown executed by an
interactive agent, so CI does NOT invoke skills live and does NOT depend on paid,
nondeterministic model calls. Instead the eval validates **checked-in artifacts and/or
recorded transcripts** against an **expected-shape + AC-coverage** contract per supported
model+harness for which a fixture exists. Any live-model eval is **Claude-only, budget-gated,
and best-effort** — never on the CI critical path (AC-NF6).
A deliberately degraded artifact/transcript trips the **capability-floor scoring function**
(defined explicitly below), so a weak model is distinguished from a structural regression.

(3) A **PROMPT-VERSION REGRESSION GATE** (new in #8, AC-F9 x AC-NF6). The eval harness runs on
**ANY prompt-artifact version bump** detected from `Shared/prompt-manifest.json` — i.e. when a
PR changes an artifact's `{version, sha256}` in the manifest, the gate re-runs that artifact's
eval cells before the bump can land. The gate is layered:
  - **Deterministic shape / AC-coverage checks** — the same `shape-check.cjs` contract, so a
    version bump that silently drops a required section or an AC row fails immediately (exit 1).
  - **The critic as LLM-as-judge** — the plugin's existing critic rubric (an L1 artifact) scores
    the new prompt's output against the prior version's output on the golden set. This is the
    ONE deliberately non-deterministic, judgement layer; it is **Claude-only, budget-gated, and
    best-effort** (same constraint as the live probe) — it advises and annotates, it does not by
    itself hard-fail the deterministic CI path.
  - **The capability-floor threshold with a quality-delta guard** — the bumped artifact's
    `score(artifact)` must stay `>= capability_floor` AND must not drop more than a configured
    `max_regression_delta` (per-skill frontmatter, default `0.05`) below the prior manifest
    version's recorded score. A drop beyond the delta **blocks the bump** (exit 3).
  - **Failing cases feed the golden set** — any case that trips the gate is captured (input +
    both artifact versions + the verdict) into `Shared/eval/golden/**` so the regression is
    permanently guarded and cannot silently reappear on a later bump.

(4) A **cross-harness cost/usage telemetry collector** records per-run token/cost/latency per
model+harness — a retrospective replacement for the dropped proactive budget signal. The
governing pattern is *stamp-on-write + validate-checked-in-artifacts-in-CI + gate-on-version-
bump*: stamping is a synchronous side effect of Story 4's artifact-write flow (no new write
gate), and eval + the prompt-version gate + telemetry are additive CI/reporting layers that
never block a developer's local write. All eval and golden fixtures are **synthetic** — no
real privileged, PII, or secret material (ICEA authoring constraint) — so the eval corpus
itself creates no egress or secret-leak risk.

**Capability-floor scoring function (explicit).** The floor is NOT "a score compared to a
frontmatter float" in the abstract. It is a deterministic function over the checked-in
artifact/transcript for a `(skill, fixture)` pair:

```
score(artifact) = weighted sum of graded checks, each in [0,1]:
  0.50 * required_sections_present   (fraction of the skill's expected-shape
                                       headers/sections that appear, in order)
  0.35 * ac_coverage                 (fraction of the fixture's target ACs that
                                       have a matching coverage row/assertion)
  0.15 * shape_wellformedness        (no stray placeholder tokens; stamp block
                                       parses against stamp-schema.json; tables
                                       well-formed)
score in [0,1]; capability_floor (per-skill frontmatter, default 0.80) is the
minimum PASSING score. score < floor => FLOOR TRIP (exit 2). All three checks are
computed from the checked-in artifact only — no model call — so the score is
byte-deterministic and reproducible in CI.
```

Threshold semantics: `capability_floor` is the **inclusive minimum** — `score >= floor`
passes, `score < floor` trips. A structural regression that removes a required section lowers
`required_sections_present` and fails shape-check (exit 1) *before* the floor is even scored;
the floor exists to catch a model that produces syntactically present but substantively weak
coverage (exit 2). The **prompt-version quality-delta guard** adds a third failure mode: on a
version bump, `prior_score - new_score > max_regression_delta` blocks the bump (exit 3) even
when the new score is still above the floor — so a slow quality erosion across bumps is caught.
All three failure modes are reported distinctly.

---

## AC Coverage Matrix

Every AC in this story's scope must be covered by at least one file change; every file change
must satisfy at least one AC. Gaps are flagged with a warning symbol.

### AC -> File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-NF5 | Audit stamp (model+version+harness+skill-hash) + **gate point** (`prevention` Claude / `merge` Copilot — both hard, harness-derived) + **prompt-artifact version(s) + dated model snapshot + key params** (output->prompt-version provenance) on every governed artifact; gate point + prompt versions derived from Story-4 detection + Story-2 manifest, not artifact content | `Shared/eval/audit-stamp.cjs`, `Shared/eval/stamp-schema.json`, skill frontmatter `gate_point` field · **consumes** `Shared/hooks/artifact-write.cjs` (Story 4) + `Shared/prompt-manifest.json` (Story 2) | Covered |
| AC-NF6 | DETERMINISTIC eval: validate checked-in artifacts/recorded transcripts vs expected-shape + AC-coverage in CI, per model+harness with a fixture; no headless Copilot runner; no live paid CI calls; capability-floor scoring function defined; degraded artifact trips floor | `Shared/eval/run-eval.cjs`, `Shared/eval/fixtures/**`, `Shared/eval/transcripts/**`, `Shared/eval/expected/**`, `Shared/eval/shape-check.cjs`, `Shared/eval/capability-floor.cjs`, `.github/workflows/eval.yml`, skill frontmatter `capability_floor` field | Covered |
| AC-F9 | Prompt-artifact versioning: the eval harness runs on ANY prompt-artifact version bump (from `Shared/prompt-manifest.json`) — deterministic shape/AC checks + critic as LLM-as-judge (Claude-only best-effort) + capability-floor threshold with a quality-delta guard; block on a drop beyond the delta; failing cases feed the golden set | `Shared/eval/version-gate.cjs`, `Shared/eval/prompt-diff.cjs`, `Shared/eval/critic-judge.cjs`, `Shared/eval/golden/**`, skill frontmatter `max_regression_delta` field, `.github/workflows/eval.yml` (version-bump trigger) · **consumes** `Shared/prompt-manifest.json` (Story 2) | Covered |
| (telemetry) | Cross-harness usage/cost telemetry replacing dropped proactive budget signal | `Shared/eval/telemetry-collector.cjs`, `Shared/eval/telemetry-sink.cjs`, `Shared/eval/cost-report.cjs` | Covered (supports AC-NF6 cost dimension) |

### File -> AC mapping

| File | ACs satisfied |
|---|---|
| `Shared/eval/audit-stamp.cjs` | AC-NF5 (incl. prompt-version + snapshot + params provenance) |
| `Shared/eval/stamp-schema.json` | AC-NF5 |
| `Shared/hooks/artifact-write.cjs` (**consumed dependency — produced by Story 4**) | AC-NF5 (invocation site of the stamp) |
| `Shared/prompt-manifest.json` (**consumed dependency — produced by Story 2**) | AC-NF5, AC-F9 (source of `{version, sha256, consumes}` per artifact) |
| `Shared/eval/run-eval.cjs` | AC-NF6 |
| `Shared/eval/shape-check.cjs` | AC-NF6, AC-F9 |
| `Shared/eval/capability-floor.cjs` | AC-NF6, AC-F9 (quality-delta guard) |
| `Shared/eval/version-gate.cjs` | AC-F9 |
| `Shared/eval/prompt-diff.cjs` | AC-F9 |
| `Shared/eval/critic-judge.cjs` | AC-F9 (critic as LLM-as-judge, Claude-only best-effort) |
| `Shared/eval/golden/**` (failing cases promoted to the golden set) | AC-F9 |
| `Shared/eval/fixtures/**` (synthetic inputs + reference artifacts) | AC-NF6 |
| `Shared/eval/transcripts/**` (recorded agent transcripts) | AC-NF6 |
| `Shared/eval/expected/**` (expected artifact shapes + AC-coverage manifests) | AC-NF6 |
| `.github/workflows/eval.yml` | AC-NF6, AC-F9 (version-bump trigger) |
| skill frontmatter `gate_point` | AC-NF5 |
| skill frontmatter `capability_floor` | AC-NF6 |
| skill frontmatter `max_regression_delta` | AC-F9 |
| `Shared/eval/telemetry-collector.cjs` | AC-NF6 (cost dimension) |
| `Shared/eval/telemetry-sink.cjs` | AC-NF6 (cost dimension) |
| `Shared/eval/cost-report.cjs` | AC-NF6 (cost dimension) |

**Coverage result:** all three scoped ACs (AC-NF5, AC-NF6, AC-F9) covered plus the
cross-harness telemetry add-on; no orphaned file changes. `artifact-write.cjs` (Story 4) and
`prompt-manifest.json` (Story 2) appear as consumed dependencies, not changes owned by this
story. AC-NF5 is satisfied by the **extended gate-point + prompt-version stamp**, AC-NF6 by the
deterministic eval, and AC-F9 by the **prompt-version regression gate** — matching the revised
ICEA AC-NF5/AC-NF6/AC-F9 (Revision Log 2026-08-14 #8).

---

## Files Changed

Plugin reality: no source/DB layers. "Files Changed" = the eval harness (`Shared/eval/**`),
the prompt-version regression gate, a CI eval workflow, the audit-stamp writer **invoked by**
Story 4's artifact-write hook, per-skill capability-floor / gate-point / regression-delta
declarations in skill frontmatter, and the cost-telemetry collector. Schema Changes omitted
(no relational schema in a markdown/CJS plugin).

**Dependency edges (producer/consumer):** `Shared/hooks/artifact-write.cjs` is **PRODUCED by
Story 4** and **CONSUMED here** — this story adds `audit-stamp.cjs` as the step Story 4's hook
invokes on save. `Shared/prompt-manifest.json` (+ the SemVer `version:`/`consumes:` frontmatter
contract and the bump-on-change CI check) is **PRODUCED by Story 2** and **CONSUMED here** —
both the stamp's prompt-version provenance (AC-NF5) and the prompt-version regression gate
(AC-F9) read it. Story 7 therefore has hard dependency edges **Story 7 -> Story 4** and **Story
7 -> Story 2** (in addition to the existing Story 7 -> Story 6 edge). The gate-point signal
(AC-NF5) also originates in Story 4 (the harness-detection helper + the Copilot-deny PreToolUse
marker); this story derives the gate point from that detection and does not re-implement it.

| Path | Change | Purpose |
|---|---|---|
| `Shared/eval/audit-stamp.cjs` | + | Builds and writes the audit stamp — model, version, harness, skill-hash, harness-derived gate point, PLUS the prompt-artifact version(s) (from frontmatter + `Shared/prompt-manifest.json`), the dated model snapshot, and key params — into a governed artifact's stamp block; invoked by Story 4's `artifact-write.cjs`. |
| `Shared/eval/stamp-schema.json` | + | JSON Schema for the stamp block — validated on write and re-read by CI shape-wellformedness scoring; `gate` is an enum of `prevention` and `merge`; adds required `prompt_versions[]` (`{artifact, version, sha256}`), `model_snapshot` (dated id), and `params` objects. |
| `Shared/hooks/artifact-write.cjs` | consumed (produced by Story 4) | Not owned here. Story 4 delivers this hook; this story wires `audit-stamp.cjs` in as the stamp step it calls. Listed for traceability only — no edit to it lands under Story 7. |
| `Shared/prompt-manifest.json` | consumed (produced by Story 2) | Not owned here. Story 2 delivers the L1 manifest (`{version, sha256, consumes}` per artifact) + the frontmatter contract + the bump-on-change CI check. This story READS it for stamp provenance (AC-NF5) and to trigger the prompt-version regression gate (AC-F9). Listed for traceability only — no edit lands under Story 7. |
| `Shared/eval/run-eval.cjs` | + | Deterministic eval-runner CLI: iterate the model+harness matrix, load checked-in artifacts / recorded transcripts, invoke shape-check + capability-floor, emit verdict + JUnit report. Performs NO live model call on the CI path. |
| `Shared/eval/shape-check.cjs` | + | Compares a checked-in artifact/transcript against its expected-shape spec (required headers/sections in order + AC-coverage assertions). Pure function of file content. |
| `Shared/eval/capability-floor.cjs` | + | Implements the capability-floor scoring function (above); reads each skill's `capability_floor` frontmatter and trips when `score < floor`; also implements the AC-F9 quality-delta guard (`prior_score - new_score > max_regression_delta` on a version bump). Deterministic — scores the checked-in artifact, no model call. |
| `Shared/eval/version-gate.cjs` | + | AC-F9 prompt-version regression gate: reads `Shared/prompt-manifest.json`, detects which artifacts' `{version, sha256}` changed in the PR, and for each bumped artifact re-runs its eval cells — deterministic shape/AC checks + capability-floor quality-delta guard + (best-effort) critic-as-judge. Blocks the bump on a delta breach (exit 3); promotes failing cases into `Shared/eval/golden/`. |
| `Shared/eval/prompt-diff.cjs` | + | Computes the set of prompt artifacts whose manifest `{version, sha256}` changed between the PR base and head — the trigger input for `version-gate.cjs`. Pure function over two manifest snapshots + on-disk hashes. |
| `Shared/eval/critic-judge.cjs` | + | Wraps the plugin's existing critic rubric (L1) as an LLM-as-judge that scores a bumped prompt's output against the prior version's on the golden set. Claude-only, budget-gated, best-effort — advisory: it annotates the verdict, never hard-fails the deterministic CI path. Refuses to run for a non-Claude harness. |
| `Shared/eval/golden/**` | + | The golden set of `(input, prior-artifact, new-artifact, verdict)` cases — seeded synthetic + auto-grown when a case trips the version gate, so a caught regression is permanently guarded and cannot silently reappear. Synthetic only. |
| `Shared/eval/fixtures/**` | + | Synthetic fixture inputs AND their checked-in reference artifacts — no privileged/PII/secret material. |
| `Shared/eval/transcripts/**` | + | Recorded agent transcripts (Claude-only where captured) used as deterministic eval inputs alongside checked-in artifacts. |
| `Shared/eval/expected/**` | + | Expected artifact shape + AC-coverage manifests, one per fixture x skill. |
| `Shared/eval/telemetry-collector.cjs` | + | Records per-run tokens/cost/latency per model+harness during best-effort live runs and normal skill runs. |
| `Shared/eval/telemetry-sink.cjs` | + | Append-only local sink (`.aidev/telemetry/*.jsonl`); degrades to a warning if the sink path is unwritable. |
| `Shared/eval/cost-report.cjs` | + | Rolls telemetry up into a cross-harness cost summary (per model+harness) — retrospective replacement for the dropped proactive budget signal. |
| `.github/workflows/eval.yml` | + | CI workflow: runs `run-eval.cjs` against checked-in artifacts/transcripts on PR; ALSO runs `version-gate.cjs` when the PR changes `Shared/prompt-manifest.json`; fails on shape/AC regression (exit 1), a tripped capability floor (exit 2), or a prompt-version quality-delta breach (exit 3); uploads cost report + JUnit as artifacts. NO live model call on the deterministic path, NO paid API key required. |
| Skill frontmatter (`Shared/skills/*/SKILL.md`) | ~ | Add `gate_point` (`prevention`/`merge`, harness-derived default), `capability_floor` (per-skill minimum passing score, default 0.80), and `max_regression_delta` (per-skill max allowed score drop on a version bump, default 0.05) fields consumed by stamp + floor + version-gate. (The `version:`/`consumes:` frontmatter itself is Story 2's contract; this story reads it.) |
| `.aidev/telemetry/` ignore entry | via managed block | Add to the `GITIGNORE_BASE` managed block owned by `setup-init-bootstrap` and applied by `gitignore-sync` — NOT an ad-hoc `.gitignore` edit (gitignore edits are ask-first per project rules). See Auth & Security. |

---

## API Changes (adapted — CLI surface + telemetry sink)

No HTTP API. The "API" here is the eval-runner CLI, the prompt-version gate CLI, plus the
telemetry sink contract:

- `node Shared/eval/run-eval.cjs [--harness=claude|copilot] [--skill=<name>] [--report=junit|json]`
  — runs the DETERMINISTIC eval over checked-in artifacts/transcripts (defaults: all fixtured
  model+harness pairs, all fixtured skills, JUnit report). Exit 0 = all green; exit 1 =
  shape/AC regression; exit 2 = capability floor tripped. NO live model call on this path.
- `node Shared/eval/version-gate.cjs [--base=<ref>] [--head=<ref>]` — AC-F9 gate: diffs
  `Shared/prompt-manifest.json` between base and head, and for each bumped artifact runs the
  deterministic shape/AC checks + capability-floor quality-delta guard (+ best-effort
  critic-judge if `--judge` and a Claude credential are present). Exit 0 = no regression;
  exit 1 = shape/AC regression on the bumped artifact; exit 3 = quality-delta breach (bump
  blocked). Promotes a tripped case into `Shared/eval/golden/`.
- `node Shared/eval/run-eval.cjs --live --model=<claude-id> [--budget=<usd>]` — OPTIONAL,
  Claude-only, budget-gated, best-effort live-model probe. Off by default, never invoked by
  `eval.yml`, and its result never fails CI. Refuses to run for a non-Claude harness (no
  headless Copilot runner exists).
- `node Shared/eval/cost-report.cjs [--since=<iso>] [--format=md|json]` — emits the
  cross-harness cost summary from the telemetry sink.
- Telemetry sink contract: append-only JSONL at `.aidev/telemetry/<yyyy-mm>.jsonl`, one record
  per run: `ts, harness, model, skill, tokens_in, tokens_out, cost_usd, latency_ms, verdict`.
  The sink is best-effort — a write failure logs a warning and never aborts the skill/eval run.

---

## Auth & Security (adapted — synthetic fixtures, managed-block ignore)

- **Eval fixtures/transcripts/golden cases are SYNTHETIC.** `Shared/eval/fixtures/**`,
  `Shared/eval/transcripts/**`, and `Shared/eval/golden/**` contain no real privileged, PII,
  or secret material (ICEA assumption, verified authoring constraint). This keeps the eval and
  golden corpus itself from creating an egress or secret-leak risk in the dogfood repo, even as
  the golden set auto-grows from tripped cases (those cases derive only from synthetic inputs).
- **No live paid API key on the CI path.** The deterministic eval and the deterministic layers
  of the version-gate read checked-in files only; `eval.yml` needs no model credential. The
  optional `--live` probe and the critic-as-judge (`critic-judge.cjs`) are Claude-only,
  budget-gated, and off in CI — so no paid, nondeterministic call gates a PR.
- The audit stamp records `skill-hash` (content hash of the skill that produced the artifact)
  and prompt-artifact `sha256` values (from the manifest), not any secret; no credential or PAT
  is ever written into a stamp, a golden case, or a telemetry record.
- The stamp's `model_snapshot` and `params` fields record a dated model id + generation params
  (temperature/top_p/max_tokens/routing var) — never a key, token, or endpoint credential.
- Telemetry records carry cost/token counts only — never prompt bodies or artifact content —
  so the sink cannot become an exfiltration channel for privileged context.
- The stamp's gate-point field is **derived from harness detection** (Story 4's
  harness-detection helper + Copilot-deny marker): Claude -> `gate: prevention` (write-time),
  Copilot -> `gate: merge` (CI required-check). Both are hard gates. The prompt-version fields
  are **derived from frontmatter + the Story-2 manifest**, not from artifact body — so neither a
  self-authored gate claim nor a hand-written version claim in the body can override the
  resolved value.
- **`.aidev/telemetry/` ignore routing.** The ignore entry is added through the `GITIGNORE_BASE`
  managed block owned by `setup-init-bootstrap` and applied by `gitignore-sync` — the plugin's
  standard managed-block path. This story does NOT hand-edit `.gitignore` (ad-hoc gitignore
  edits are ask-first per project rules); it registers the entry in the managed block so
  `gitignore-sync` writes it idempotently without touching developer lines.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Eval input is a recorded transcript with minor formatting drift | shape-check asserts on the **shape/AC-coverage invariant** (required sections in order + AC rows), not exact prose text, so benign formatting drift does not fail a case. Determinism comes from scoring file content, not from re-running a model. |
| Capability-floor threshold mis-set (too high -> false trip, or too low -> weak artifact passes) | Floors live in per-skill frontmatter and are scored by the explicit function above; `capability-floor.cjs` emits skill name, the floor, the observed score, AND the per-check breakdown (sections/AC/wellformedness) so a mis-set floor is diagnosable and correctable in one place. |
| Prompt-artifact content changed but `Shared/prompt-manifest.json` NOT bumped | This is Story 2's bump-on-change CI check (on-disk hash != manifest) — it fails first. `version-gate.cjs` additionally asserts the manifest is consistent with on-disk hashes before running, so it never evaluates a stale bump. |
| Prompt-version bump drops quality within the floor but beyond the delta | `capability-floor.cjs` computes `prior_score - new_score`; if it exceeds the skill's `max_regression_delta`, `version-gate.cjs` blocks the bump with **exit 3** (distinct from a floor trip exit 2), names the artifact/prior-version/new-version/prior-score/new-score/delta, and promotes the case into `Shared/eval/golden/`. |
| Critic-as-judge invoked with no Claude credential / non-Claude harness | `critic-judge.cjs` is best-effort: it logs that the judgement layer was skipped and the deterministic verdict stands — the version-gate never hard-fails solely because the judge could not run. Refuses outright for a non-Claude harness (no headless Copilot runner). |
| Prior-version score not recorded for a first-ever manifest entry | `version-gate.cjs` treats an artifact with no recorded prior score as a baseline (no delta comparison possible), runs the deterministic + floor checks only, and records the new score as the baseline for the next bump. |
| Telemetry sink down / path unwritable | `telemetry-sink.cjs` catches the write error, logs a single warning, and continues — telemetry is best-effort and never blocks an eval, a version-gate run, or a skill run. The verdict is independent of telemetry availability. |
| Governed artifact written but stamp step throws | Story 4's `artifact-write.cjs` wraps the stamp call; on `audit-stamp.cjs` failure it blocks finalisation with a clear error (a governed artifact must not be saved unstamped) — stamping is mandatory, telemetry is not. The failure surface lives in Story 4's hook; this story's `audit-stamp.cjs` returns a typed error rather than writing a partial stamp. |
| Prompt-version unresolvable at stamp time (skill `consumes:` pin not in the manifest) | `audit-stamp.cjs` returns a typed error rather than writing a stamp with an unresolved/guessed prompt version — Story 4's hook blocks the save. Provenance is never fabricated. |
| Harness detection returns an unknown/unsupported value | `audit-stamp.cjs` rejects with a typed error rather than defaulting to a gate point — an artifact is never stamped with a guessed gate. Story 4's hook blocks the save so no artifact is finalised with an unresolved gate point. |
| Expected-shape manifest missing for a fixture x skill pair | `run-eval.cjs` treats a missing expected manifest as a hard error (exit 1), not a skip, so coverage cannot silently erode. |
| No checked-in artifact/transcript for a matrix cell | `run-eval.cjs` reports the cell as an uncovered gap (exit 1) rather than silently passing — a harness with no fixture is visibly uncovered, not falsely green. |
| Someone points CI at a live model | `eval.yml` never sets `--live`; if `--live` is passed with a non-Claude harness, `run-eval.cjs` refuses (no headless Copilot runner) and exits non-zero with a clear message. |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-NF5 | Audit-stamp writer + schema + wiring into Story 4's `artifact-write.cjs`; harness-derived gate point (`prevention`/`merge`); prompt-version + dated-snapshot + params provenance (reads Story-2 manifest); skill `gate_point` frontmatter | 2 |
| AC-NF6 | Deterministic eval runner (checked-in artifacts/transcripts) + shape-check + capability-floor scoring function + fixtures/expected + CI workflow; skill `capability_floor` frontmatter | 1.5 |
| AC-F9 | Prompt-version regression gate: `version-gate.cjs` + `prompt-diff.cjs` + `critic-judge.cjs` (best-effort) + quality-delta guard + golden-set growth + version-bump CI trigger; skill `max_regression_delta` frontmatter | 1 |
| Telemetry | Cross-harness cost/usage collector + sink + cost report + managed-block ignore entry | 0.5 |
| **Total** | | **5** |

**Total SP: 5**
**Type: STORY** — a single shippable slice (assurance + observability + prompt-version gate)
that adds no new user-facing behaviour beyond the stamp, the CI eval gate, and the
version-bump gate; under the 5-SP rule, no sub-decomposition. **Blocked by Story 4** (produces
`artifact-write.cjs` + harness detection), **Story 2** (produces `Shared/prompt-manifest.json`
+ the versioning frontmatter contract), **and Story 6** (governance hardening / Tier-C
backstop).

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] All files in Files Changed created/modified as specified (excluding `artifact-write.cjs` (Story 4) and `Shared/prompt-manifest.json` (Story 2), which are consumed dependencies).
- [ ] `audit-stamp.cjs` is wired into Story 4's existing `artifact-write.cjs`; this story adds no new write gate.
- [ ] Gate point is derived from Story 4's harness detection, never read from artifact content — Claude -> `prevention`, Copilot -> `merge`; both are hard gates.
- [ ] The stamp records prompt-artifact version(s) (from frontmatter + Story-2 manifest), a dated model snapshot (not an alias), and key params — output->prompt-version provenance (AC-NF5 x AC-F9).
- [ ] `version-gate.cjs` triggers on any `Shared/prompt-manifest.json` bump; a drop beyond `max_regression_delta` blocks the bump (exit 3); tripped cases are promoted into `Shared/eval/golden/`.
- [ ] The critic-as-judge layer is Claude-only, budget-gated, best-effort, and never hard-fails the deterministic CI path.
- [ ] No hardcoded secrets, tokens, or credentials in any eval fixture, transcript, golden case, stamp, or telemetry record.
- [ ] No `console.log` diagnostic noise in production paths (structured warn/error only).
- [ ] All eval fixtures/transcripts/golden cases are synthetic — reviewed to confirm no real privileged/PII/secret content.
- [ ] Skill frontmatter carries `gate_point`, `capability_floor`, and `max_regression_delta` for every fixtured skill.
- [ ] `.aidev/telemetry/` ignore entry added via the `GITIGNORE_BASE` managed block, applied by `gitignore-sync` — not a hand-edit.

**Quality**
- [ ] All positive and negative unit tests pass — see Test Cases.
- [ ] Integration test passes: deterministic eval green over checked-in artifacts per model+harness; a degraded checked-in artifact trips the floor; a version bump beyond the delta trips the version-gate.
- [ ] CI eval + deterministic version-gate path makes NO live model call and requires NO paid API key.
- [ ] Regression verified: existing artifact writes still succeed and carry a stamp (via Story 4's hook) that now includes prompt-version + snapshot + params; no local write is blocked by telemetry.

**Review readiness**
- [ ] PR title format: `[ADO-4000] Story 7 Eval harness + audit stamping + capability floor + prompt-version gate`
- [ ] PR description maps each changed file to AC-NF5 / AC-NF6 / AC-F9 (reference AC Coverage Matrix) and notes the Story 7 -> Story 4 and Story 7 -> Story 2 dependencies.
- [ ] ICEA + this Tech Spec committed in the same branch.

### Reviewer Checklist

- [ ] Governed artifact stamping is invoked from Story 4's `artifact-write.cjs`; Story 7 adds no separate write gate and does not edit that hook (AC-NF5).
- [ ] Gate point is harness-derived from Story 4's detection, not read from artifact content — a Copilot artifact stamps `gate: merge`, a Claude artifact `gate: prevention`; both are hard, neither is "soft" (AC-NF5).
- [ ] The stamp additionally records `prompt_versions[]` (from frontmatter + Story-2 manifest), `model_snapshot` (dated, not an alias), and `params` — output->prompt-version provenance; unresolvable prompt version = typed error, never a guessed value (AC-NF5 x AC-F9).
- [ ] The stamp schema enumerates exactly two gate points (`prevention`, `merge`); there is no "soft" value and no assertion that one harness is weaker (AC-NF5).
- [ ] The CI eval path is DETERMINISTIC: it validates checked-in artifacts/transcripts, makes no live model call, and needs no paid API key (AC-NF6).
- [ ] The capability-floor scoring function is the explicit weighted function in Overview; failure message names skill/floor/observed score/per-check breakdown (AC-NF6).
- [ ] `version-gate.cjs` runs on any `Shared/prompt-manifest.json` bump: deterministic shape/AC checks + capability-floor quality-delta guard (deterministic, hard) + critic-as-judge (Claude-only, best-effort, advisory only) (AC-F9).
- [ ] A version bump that drops score beyond `max_regression_delta` blocks with exit 3 (distinct from floor exit 2 and regression exit 1); the failing case is added to `Shared/eval/golden/` (AC-F9).
- [ ] A missing expected manifest or an uncovered matrix cell is a hard failure, not a silent skip (AC-NF6).
- [ ] Any `--live` probe and the critic-judge are Claude-only, budget-gated, off in CI, and never fail a PR on their own (AC-NF6 / AC-F9).
- [ ] Golden-set cases are synthetic, including auto-promoted ones (AC-F9); no real privileged/PII/secret content.
- [ ] Telemetry is best-effort: a down sink warns and continues, never blocks an eval, a version-gate run, or a skill run.
- [ ] The `.aidev/telemetry/` ignore entry went through the managed block, not an ad-hoc `.gitignore` edit.
- [ ] Distinct eval exit codes: 1 = shape/AC regression, 2 = floor trip, 3 = prompt-version quality-delta breach — CI reports them differently.

---

## Open Questions

None open. Scope is fully specified by the revised AC-NF5 (gate-point + prompt-version stamp),
AC-NF6 (deterministic eval), and AC-F9 (prompt-version regression gate), plus the cross-harness
telemetry add-on. The eval and the deterministic layers of the version-gate are deterministic
(checked-in artifact/transcript + manifest-diff validation) so no CI model-credential or
paid-API decision is pending; the critic-as-judge is explicitly best-effort/off-CI. The
telemetry backend is a local append-only JSONL sink (no external service). Producer questions
are resolved: Story 4 owns `artifact-write.cjs` + harness detection; Story 2 owns
`Shared/prompt-manifest.json` + the versioning frontmatter contract + the bump-on-change check;
Story 7 consumes both. The gate-point values are fixed by the asymmetric enforcement model
(`prevention` for Claude, `merge` for Copilot).

---

## Request Flow

```
CI EVAL RUN (per PR, GitHub Actions eval.yml) — DETERMINISTIC, no live model:
  eval.yml
    -> node Shared/eval/run-eval.cjs        (no --live; no model credential)
        for each (model, harness) in fixtured matrix:
          for each (fixture, skill):
            load CHECKED-IN artifact / recorded transcript for this cell
            -> shape-check.cjs: required headers/sections in order + AC coverage present?
            -> capability-floor.cjs: score(artifact) >= skill.frontmatter.capability_floor?
                 score = 0.50*sections + 0.35*ac_coverage + 0.15*wellformedness
        verdict:
          all shape+AC pass, no floor trip -> exit 0 (green)
          any shape/AC fail                -> exit 1 (regression) -> CI fails
          any floor tripped                -> exit 2 (degraded)   -> CI fails
          missing manifest / uncovered cell-> exit 1              -> CI fails

PROMPT-VERSION REGRESSION GATE (per PR, only when Shared/prompt-manifest.json changed):
  eval.yml (paths: Shared/prompt-manifest.json)
    -> node Shared/eval/version-gate.cjs --base=<base> --head=<head>
        -> prompt-diff.cjs: which artifacts' {version, sha256} changed?
        for each BUMPED artifact:
          -> shape-check.cjs   (deterministic; drop of a required section -> exit 1)
          -> capability-floor.cjs quality-delta guard:
                prior_score - new_score > max_regression_delta ? -> exit 3 (bump BLOCKED)
          -> critic-judge.cjs  (Claude-only, budget-gated, best-effort, ADVISORY):
                score new vs prior output on the golden set; annotate verdict; never hard-fails
          on any trip -> append (input, prior, new, verdict) to Shared/eval/golden/
    -> cost-report.cjs -> upload cost summary + JUnit as CI artifacts

OPTIONAL LIVE PROBE (developer-run, NOT in CI):
  node Shared/eval/run-eval.cjs --live --model=<claude-id> --budget=<usd>
    -> Claude-only, budget-gated, best-effort; refuses non-Claude; never fails CI

ARTIFACT WRITE (developer saves a governed artifact — ICEA/Tech/tracker):
  Shared/hooks/artifact-write.cjs        (PRODUCED BY STORY 4 — consumed here)
    -> audit-stamp.cjs  (THIS story's contribution):
        harness detected via Story-4 detection (claude|copilot)
          claude  -> gate: prevention   (write-time hard gate)
          copilot -> gate: merge        (CI required-check hard gate)
        resolve prompt_versions[] from skill frontmatter version: + consumes:
          against Shared/prompt-manifest.json (PRODUCED BY STORY 2)
        gather model_snapshot (dated id, not alias) + params + skill-hash
        validate against stamp-schema.json (gate enum: prevention|merge;
          prompt_versions[]/model_snapshot/params required)
        embed stamp block into artifact
    -> artifact finalised WITH stamp (unstamped/unresolved-version save blocked by Story 4's hook)
    -> telemetry-collector.cjs records the run (best-effort)
```

No network/DB tiers — the plugin runs in-process. The CI eval + deterministic version-gate
touch no external endpoint; the optional live probe and the critic-as-judge are the only paths
that reach a model, and both are off in CI. The telemetry sink is a local JSONL file.

---

## Rollback

**Schema migrations:** None — this story is code/config only; the telemetry sink, golden set,
and stamps are additive (`.aidev/telemetry/*.jsonl`, `Shared/eval/golden/**`, and an appended
stamp block).

**Rollback procedure:**
1. This story ships on `feature/4.x-multi-harness`; revert its commit range to remove
   `Shared/eval/**` (incl. `version-gate.cjs`, `critic-judge.cjs`, `golden/`),
   `.github/workflows/eval.yml`, the `audit-stamp.cjs` wiring into Story 4's hook, the
   frontmatter fields, and the managed-block ignore entry. Story 4's `artifact-write.cjs` and
   Story 2's `Shared/prompt-manifest.json` are untouched by this revert (they are Story 4's and
   Story 2's artifacts).
2. Reverting the stamp wiring returns governed-artifact writes to their pre-Story-7 (unstamped)
   behaviour — no data loss; existing artifacts keep any stamp already written (including its
   prompt-version provenance).
3. Reverting `eval.yml` removes the CI eval gate AND the prompt-version regression gate; the
   harness-independent Tier-C `ai-gate` (Story 6) and Story 2's bump-on-change hash check remain
   the enforcement backstops, so governance is not weakened by the rollback.
4. The telemetry sink and the golden set are additive and inert on rollback — `.aidev/telemetry/`
   and `Shared/eval/golden/` can be deleted with no functional impact; remove the telemetry
   managed-block ignore entry via `gitignore-sync`.

**Verify after rollback:** a governed-artifact write still succeeds (via Story 4's hook); the
Story-6 Tier-C gate still blocks a self-forged approval; Story 2's bump-on-change check still
fails an un-bumped prompt edit; no CI job references the removed `eval.yml`.

---

## Handover

### QA Team
**What was added:** every governed artifact now carries an audit stamp (model+version+harness+
skill-hash + a **harness-derived** gate point — `prevention` on Claude write-time, `merge` on
Copilot CI required-check; both hard — PLUS the **prompt-artifact version(s)**, a **dated model
snapshot**, and **key params** so any output traces back to the exact prompt version + model
that produced it), written by `audit-stamp.cjs` invoked from Story 4's `artifact-write.cjs`; a
**deterministic** CI eval harness validates checked-in artifacts / recorded transcripts against
an expected-shape + AC-coverage contract per supported model+harness and fails on regression or
a tripped per-skill capability floor; a **prompt-version regression gate** re-runs the eval on
any `Shared/prompt-manifest.json` bump and blocks a quality drop beyond the per-skill delta
(feeding failing cases into the golden set); a best-effort cross-harness cost/usage telemetry
collector records per-run cost. **How to test:** run `node Shared/eval/run-eval.cjs` locally
against the checked-in fixtures (green, no model credential needed), then swap in a deliberately
degraded checked-in artifact and confirm exit 2 + a floor message with the per-check breakdown.
Bump an artifact's version in `Shared/prompt-manifest.json` with a degraded output and run
`node Shared/eval/version-gate.cjs` — confirm exit 3 (bump blocked), the delta message, and a
new case in `Shared/eval/golden/`. Inspect a Claude-produced vs a Copilot-produced artifact and
confirm both carry a stamp with distinct gate points (`prevention` vs `merge`) derived from
harness detection, plus prompt-version + dated-snapshot + params — and that neither is stamped
"soft". **Test data:** synthetic fixtures/transcripts/golden cases only — no real
privileged/PII/secret material. **Regression risk:** stamping flows through Story 4's
artifact-write hook — confirm normal ICEA/Tech/tracker saves still succeed and are not blocked
by telemetry availability.

### DevOps / Platform Team

| Item | Detail |
|---|---|
| CI workflow `.github/workflows/eval.yml` | New GitHub Actions job; runs the DETERMINISTIC eval over checked-in artifacts/transcripts on PR AND the prompt-version gate when `Shared/prompt-manifest.json` changes; fails on regression (exit 1), floor trip (exit 2), or a prompt-version quality-delta breach (exit 3); uploads JUnit + cost report artifacts. **No model credential / paid API key required** for the deterministic path. Mirror for ADO pipelines if required. |
| Prompt-version gate | `version-gate.cjs` reads Story 2's `Shared/prompt-manifest.json`; the deterministic layers gate a PR, the critic-as-judge layer is Claude-only/best-effort and off in CI. Do not wire the judge onto the required CI path. |
| Telemetry sink `.aidev/telemetry/*.jsonl` | Local append-only file; no external service; best-effort. The `.aidev/telemetry/` ignore entry is added via the `GITIGNORE_BASE` managed block and applied by `gitignore-sync` — do not hand-edit `.gitignore`. |
| Dependency ordering | Story 7 depends on Story 4 (produces `artifact-write.cjs` + harness detection), Story 2 (produces `Shared/prompt-manifest.json` + versioning contract), and Story 6 (Tier-C backstop). Do not deploy Story 7 stamping/gate ahead of those. |
| No new secrets | Deterministic eval + deterministic version-gate use no credential; the optional Claude-only live probe and critic-judge use existing model config and are off in CI. |
| Model+harness matrix | Defined by the fixtures/transcripts present; extend by adding a checked-in fixture + expected manifest for a new model/harness cell. |

### Future Developer — Follow-on Work
- **Add a skill to the eval suite** = add a synthetic fixture + a checked-in reference artifact
  (or recorded transcript) under `Shared/eval/fixtures/` (and `Shared/eval/transcripts/`), an
  expected-shape manifest under `Shared/eval/expected/`, and set `capability_floor`,
  `gate_point`, and `max_regression_delta` in that skill's frontmatter. `run-eval.cjs` and
  `version-gate.cjs` pick it up automatically.
- **Add a supported model/harness** = add a checked-in fixture + expected manifest for that
  cell; no code change if the harness is already stamp-aware. No CI credential needed.
- **Prune the golden set** (periodic): auto-grown golden cases accumulate; a future maintenance
  task can dedupe cases that guard the same regression.
- **Telemetry backend upgrade** (deferred): the local JSONL sink is intentionally simple; a
  future story could point `telemetry-sink.cjs` at a central store without changing callers.

---

## Test Cases

> Derived from the revised AC-NF5 (gate-point + prompt-version stamp), AC-NF6 (deterministic
> eval), and AC-F9 (prompt-version regression gate) plus the telemetry add-on. Every AC gets a
> positive and a negative case; integration cases cover the deterministic CI + write + version-
> bump behaviour end-to-end. NO integration test invokes a live/paid model on the CI path.

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `audit-stamp.cjs` | Governed artifact + Claude harness detected (Story-4 signal) + resolvable prompt versions | Stamp block with model+version+harness+skill-hash, `gate: prevention`, `prompt_versions[]`, dated `model_snapshot`, and `params`; valid against `stamp-schema.json` | AC-NF5 |
| P-U2 | `audit-stamp.cjs` | Same artifact + Copilot harness detected | Stamp block with `gate: merge` — a valid, hard, distinguishable gate point, not "soft"; prompt-version provenance identical shape | AC-NF5 |
| P-U3 | `shape-check.cjs` | Well-formed checked-in artifact + its expected-shape manifest | Pass (all required headers/sections in order + AC coverage present) | AC-NF6 |
| P-U4 | `capability-floor.cjs` | Checked-in artifact scoring 0.92 vs frontmatter floor 0.80 | Pass, no trip; per-check breakdown reported | AC-NF6 |
| P-U5 | `version-gate.cjs` | Manifest bump where new_score 0.90 vs prior 0.91, delta limit 0.05 | Pass (delta 0.01 within 0.05); no bump block; deterministic checks green | AC-F9 |
| P-U6 | `prompt-diff.cjs` | Base vs head manifest differing in one artifact's `{version, sha256}` | Returns exactly that artifact as the bumped set | AC-F9 |
| P-U7 | `cost-report.cjs` | Telemetry JSONL with Claude + Copilot runs | Per-model+harness cost summary rendered | AC-NF6 (cost) |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `audit-stamp.cjs` | Stamp step throws (schema-invalid stamp) | Typed error returned so Story 4's hook blocks the save — no unstamped/partial governed artifact | AC-NF5 |
| N-U2 | `shape-check.cjs` | Checked-in artifact missing a required section / an AC uncovered | Fail (exit 1), report names the missing section/AC | AC-NF6 |
| N-U3 | `capability-floor.cjs` | Degraded checked-in artifact scoring 0.62 vs floor 0.80 | Trip (exit 2); message names skill, floor, observed score, per-check breakdown | AC-NF6 |
| N-U4 | `run-eval.cjs` | Fixture cell with no expected-shape manifest | Hard error (exit 1), not a skip — coverage cannot silently erode | AC-NF6 |
| N-U5 | `telemetry-sink.cjs` | Sink path unwritable | Single warning logged; run continues; eval verdict unaffected | AC-NF6 (cost) |
| N-U6 | `audit-stamp.cjs` | Artifact content claiming `gate: prevention` under a Copilot detection | Recorded gate stays `merge` — content claim cannot override the harness-derived gate point | AC-NF5 |
| N-U7 | `run-eval.cjs` | `--live --harness=copilot` | Refuses (no headless Copilot runner), exits non-zero with a clear message | AC-NF6 |
| N-U8 | `version-gate.cjs` | Manifest bump where new_score 0.83 vs prior 0.91 (still above floor 0.80), delta limit 0.05 | Block the bump (exit 3); delta 0.08 > 0.05; message names artifact/prior/new/delta; case appended to `Shared/eval/golden/` | AC-F9 |
| N-U9 | `audit-stamp.cjs` | Skill `consumes:` pins an L1 artifact absent from `Shared/prompt-manifest.json` | Typed error — no stamp with a guessed/unresolved prompt version; Story 4's hook blocks the save | AC-NF5 x AC-F9 |
| N-U10 | `critic-judge.cjs` | Invoked with no Claude credential | Skips judgement, logs it; deterministic verdict stands; version-gate does not hard-fail on the missing judge | AC-F9 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Deterministic eval green per model+harness | Run `run-eval.cjs` over the checked-in artifacts/transcripts for the full fixtured matrix (no `--live`, no credential) | Exit 0; JUnit all-green; cost report produced; zero live model calls | AC-NF6 |
| INT-2 | Degraded artifact trips floor | Swap in a deliberately weak checked-in artifact and run `run-eval.cjs` | Exit 2; capability floor tripped for the affected skill(s) with per-check breakdown; reported distinctly from a regression | AC-NF6 |
| INT-3 | Gate point + prompt-version on Claude vs Copilot artifact | Produce one governed artifact under Claude and one under Copilot (via Story 4's hook) | Both carry a stamp; Claude stamps `gate: prevention`, Copilot `gate: merge` — both hard, harness-derived; both carry `prompt_versions[]` + dated `model_snapshot` + `params`; neither marked soft | AC-NF5 |
| INT-4 | Shape/AC regression fails CI | Commit a checked-in artifact that drops a required section, run `eval.yml` | CI fails with exit 1 (regression), distinct from a floor trip; no live model call made | AC-NF6 |
| INT-5 | Prompt-version bump gate blocks a quality drop | Bump an artifact's `{version, sha256}` in `Shared/prompt-manifest.json` with a degraded output, run `eval.yml` version-gate job | CI fails with exit 3 (bump blocked); delta breach reported distinct from exit 1/2; failing case added to `Shared/eval/golden/`; deterministic path made no live model call | AC-F9 |
| INT-6 | Telemetry down does not block | Make the sink path unwritable, run the eval matrix | Eval completes with correct verdict; warning logged; no cost rows for the down window | AC-NF6 (cost) |
| INT-7 | CI needs no model credential | Run `eval.yml` (eval + deterministic version-gate) in an environment with NO model API key configured | Both jobs complete deterministically (green/exit 1/2/3 as appropriate); never block on a missing credential; the critic-judge layer is simply skipped | AC-NF6 / AC-F9 |

> NF/F AC verification:
> AC-NF5 (gate-point + prompt-version stamp): verified by INT-3 / P-U1 / P-U2 / N-U6 / N-U9 —
> inspect stamps on a Claude vs a Copilot artifact and confirm model+version+harness+skill-hash
> + a distinct harness-derived gate point (`prevention` vs `merge`), both hard, plus
> `prompt_versions[]` + dated `model_snapshot` + `params`, and that neither a content gate claim
> nor an unresolvable prompt pin yields a guessed value.
> AC-NF6 (deterministic eval): verified by INT-1 (green matrix over checked-in artifacts),
> INT-2 (degraded artifact trips floor), INT-4 (regression fails CI), and INT-7 (no credential
> needed) with distinct exit codes and no live/paid CI call.
> AC-F9 (prompt-version regression gate): verified by INT-5 (a version bump beyond the delta is
> blocked with exit 3 and feeds the golden set), P-U5/P-U6/N-U8 (delta guard + diff), and
> N-U10 (critic-judge best-effort/off-CI) — the gate runs on any manifest bump, layering
> deterministic shape/AC + capability-floor delta guard + best-effort critic-as-judge.

---

### Revision Log
2026-08-13 — Story 7 tech spec drafted from the saved epic ICEA + epic Tech Spec (dogfood; synthetic ADO-4000). Scoped to AC-NF5 (audit stamping + hard/soft assurance tier) and AC-NF6 (behavioural eval per model+harness + per-skill capability floor), plus the cross-harness cost/usage telemetry that replaces the dropped proactive budget signal.
2026-08-13 #2 — REVISED to match ICEA Revision Log 2026-08-13 #4 (revised AC-NF5/NF6) and fix review findings. (1) Eval made DETERMINISTIC: validates checked-in artifacts / recorded transcripts against expected-shape + AC-coverage in CI; removed the assumption of a headless Copilot skill-runner and any live/paid/nondeterministic model call on the CI path; live-model eval is now Claude-only, budget-gated, best-effort, off in CI. (2) Defined the capability-floor SCORING FUNCTION explicitly (weighted sections/AC-coverage/wellformedness; inclusive-minimum threshold semantics). (3) `artifact-write.cjs` reclassified from `~ modified` to a CONSUMED dependency PRODUCED by Story 4; added dependency edge Story 7 -> Story 4; assurance tier now derived from Story 4's harness detection (Copilot-deny marker + detection helper), cited as producer. (4) `.aidev/telemetry/` ignore routed through the `GITIGNORE_BASE` managed block + `gitignore-sync` (not an ad-hoc `.gitignore` edit — gitignore edits are ask-first). (5) Aligned Overview, Files Changed, Auth & Security, Error Handling, Request Flow, DoD, Reviewer Checklist, and Test Cases (added N-U7, INT-6) to the revised ACs.
2026-08-14 #3 — REVISED to match ICEA Revision Log 2026-08-14 #6 (ASYMMETRIC enforcement). AC-NF5 reframed from a "hard-vs-soft assurance tier" to a **gate-point stamp**: every governed artifact records its gate point — Claude = `prevention` (write-time hard gate), Copilot = `merge` (CI required-check hard gate). BOTH are hard, at different points; the stamp records WHICH. Removed all "soft"/"hard vs soft" language and any implication that Copilot lacks a hard gate. (1) Overview rewritten around the gate-point model; gate point derived from Story-4 harness detection, never from artifact content. (2) Frontmatter field renamed `assurance_tier` -> `gate_point` (enum `prevention`/`merge`) across AC matrix, Files Changed, DoD, and Follow-on Work; stamp-schema `gate` enum = `prevention|merge` (no "soft"). (3) Added deterministic test N-U6 direction + INT-3 now asserts `prevention` vs `merge` are both valid and distinguishable; P-U2 no longer marks Copilot "soft". (4) Added error-handling row for unknown harness detection (no guessed gate). (5) Aligned AC Coverage Matrix, Auth & Security, Request Flow, Reviewer Checklist, Handover, and Open Questions to revised AC-NF5/AC-NF6. Kept unchanged: deterministic eval (checked-in artifacts/recorded transcripts; no headless Copilot runner; no live paid CI calls; live eval = Claude-only best-effort); explicit capability-floor scoring function; `artifact-write.cjs` consumed (produced by Story 4); `.aidev/telemetry/` via GITIGNORE_BASE managed block.
2026-08-14 #4 — REVISED to match ICEA Revision Log 2026-08-14 #8 (PROMPT-ARTIFACT VERSIONING, AC-F9) and #7 (shared L1 content core / native L2/L3 structure). (1) Added the **prompt-version regression gate** (AC-F9): `version-gate.cjs` + `prompt-diff.cjs` + `critic-judge.cjs` + `Shared/eval/golden/**` — the eval runs on ANY prompt-artifact version bump detected from Story 2's `Shared/prompt-manifest.json`, layering deterministic shape/AC checks + the critic as LLM-as-judge (Claude-only, best-effort, advisory) + the capability-floor threshold with a `max_regression_delta` quality-delta guard (new exit code 3 = bump blocked); failing cases feed the golden set. (2) **Extended the audit stamp (AC-NF5)** to record `prompt_versions[]` (skill `version:` + `consumes:` L1 pins resolved against the manifest), a dated `model_snapshot` (not an alias), and key `params` — closing output->prompt-version provenance; stamp-schema gains required `prompt_versions[]`/`model_snapshot`/`params`; unresolvable prompt version = typed error (N-U9). (3) Added **L1/L2/L3 framing**: the eval fixtures + `prompt-manifest.json` are L1-adjacent under `Shared/eval`/`Shared/`; single-source, no per-harness copy; `artifact-write.cjs` (stamp hook-in) is Story 4's. (4) Added dependency edge Story 7 -> Story 2 (manifest producer) alongside the existing -> Story 4 and -> Story 6 edges. (5) Added `max_regression_delta` skill frontmatter; eval.yml gains a version-bump trigger; aligned AC matrix, Files Changed, Auth & Security, Error Handling, sizing, DoD, Reviewer Checklist, Request Flow, Rollback, Handover, and Test Cases (P-U5/P-U6/N-U8/N-U9/N-U10/INT-5, re-numbered INT-6/INT-7). Kept unchanged: deterministic eval (no headless Copilot runner; no live paid CI calls; live eval = Claude-only best-effort); explicit capability-floor scoring function; `.aidev/telemetry` via GITIGNORE_BASE. Source-ICEA pointer updated to #8.
