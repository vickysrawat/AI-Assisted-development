# Upgrade Skill — Simplification Plan
**Status:** Planning complete — all 8 items decided; ready for implementation
**Recorded:** 2026-10-03
**Author:** AI Architect review session
**Affects:** `skills/upgrade/SKILL.md`, supporting scripts

---

## Problem Statement

The upgrade skill has accumulated complexity borrowed from the Rewrite skill that does not
fit the simpler in-place upgrade context. An in-place upgrade has a fundamentally different
risk profile than a generative rewrite: the deterministic tool does the bulk transform, not
the LLM. The current SKILL.md treats both with the same ceremony, which creates unnecessary
developer friction and inflates the session length without adding safety.

---

## Items Under Review

| # | Item | Status | Decision |
|---|---|---|---|
| 1 | Too many CONTINUE gates (14 total, 11 boilerplate) | ✅ Decided | Keep 3 real gates; remove 11 CONTINUE gates; tool-missing = hard BLOCK |
| 1b | Manual steps lost in chat | ✅ Decided | Write `ADO-{ID}-upgrade-runbook.md` — all developer actions written to disk |
| 2 | Source Context Manifest replaced with skill-generated Upgrade Intake Summary | ✅ Decided | Three-pass generation: registry (packages) + replacement mapping (cache) + behavioral change scan (code pattern + cache). Developer reviews and confirms — nothing hand-authored. |
| 3 | Step 4.5 delta design docs — Rewrite ceremony on an upgrade | ✅ Decided | Replace with lightweight decision log (one entry per RED/BLOCKER item); drop target-design-spec, design-revision-spec, graph-derive from this step; APPROVE DESIGN gate kept |
| 4 | Migration roots resolution doesn't fit upgrade | ✅ Decided | Remove resolve-migration-roots.cjs call + remove from required scripts preflight; dependency repo constraints move to intake Section 2 (version coupling) |
| 5 | upgrade-checkpoint.cjs thin wrapper creates confusion | ✅ Decided | Keep wrapper (contains real intake-verify gate enforcement); make SKILL.md use it exclusively — no mixed direct checkpoint-ledger.cjs calls |
| 6 | Research agent cache shell block — 30 lines of fragile inline Node.js | ✅ Decided | Exit codes 0=fresh/1=miss/2=stale; add --extract-bundle-to flag; rewrite cache block in both upgrade + rewrite SKILL.md; 1-line script + 2-line test change |
| 7 | Steps 8, 8a, 9 have unnecessary STEP BOUNDARY gates | ✅ Decided | Step 8 dissolved into Steps 4+7 (it's a reference section, not a step); Steps 8a + 9 CONTINUE gates removed; both auto-proceed |
| 8 | Migration log entries per residual fix — too heavyweight | ✅ Decided | Log only unanticipated finds + non-obvious decisions; routine fixes → Write Gate diff is the record; single end-of-step summary covers the batch |

---

## Item 1 — Too many CONTINUE gates

### Current state
The skill has 14 gates total — 3 real decision gates and 11 boilerplate CONTINUE gates.
Every step opens with the same block: "Reply CONTINUE to proceed / Reply COMPACT if near capacity."
That is 11 unnecessary interruptions on top of the 3 real decisions.

### Full gate inventory

| # | Gate | Decision |
|---|---|---|
| 1 | Step 1 opening CONTINUE | ❌ Remove — no ceremony needed at the start |
| 2 | Step 2 CONTINUE (after classify) | ❌ Remove — auto-proceed |
| 3 | Step 3 CONTINUE (tool preflight) | ⚠ Keep as BLOCK only if tool not found — print install steps; auto-proceed if tool available |
| 4 | `INTAKE CONFIRMED ADO-{ID}` | ✅ Keep — source coverage must be confirmed before analysis |
| 5 | Step 4 CONTINUE (before report) | ❌ Remove — auto-proceed after intake |
| 6 | `APPROVE REPORT ADO-{ID}` | ✅ Keep — developer decides whether to proceed to code |
| 7 | Step 4.5 CONTINUE (before design) | ❌ Remove — auto-proceed after APPROVE REPORT |
| 8 | `APPROVE DESIGN ADO-{ID}` | ✅ Keep — required before any git operation |
| 9 | Step 5 CONTINUE (baseline tag) | ❌ Remove — APPROVE DESIGN is sufficient |
| 10 | Step 6 CONTINUE (tool run) | ❌ Remove — auto-proceed after baseline tag |
| 11 | Step 7 CONTINUE (residual) | ❌ Remove — auto-proceed; Write Gate on each fix |
| 12 | Step 8 CONTINUE (judge/checkpoint) | ❌ Remove — inline documentation, not a gate |
| 13 | Step 8a CONTINUE (test plan) | ❌ Remove — contradicts "run automatically" |
| 14 | Step 9 CONTINUE (lessons/TPs) | ❌ Remove — contradicts "run automatically" |

### Decision
**Keep 3 real gates: INTAKE CONFIRMED · APPROVE REPORT · APPROVE DESIGN.**
Tool not found in Step 2 is a hard BLOCK (not a gate) — skill prints install steps and stops
until the developer re-invokes. All other CONTINUE gates removed. Steps still display their
status messages to the developer; removal only affects the mandatory reply requirement.

### Final step addition
The final step (Step 9) must include:
1. A **completion summary** — lists all artifacts produced with their paths
2. An **artifact validation** — checks each file actually exists on disk (not just "was written")

---

## Item 1b — Manual steps lost in chat

### Problem
Steps that the developer must run manually (tool install steps, git commands for the baseline
tag, hop execution commands) are currently only shown inline in chat. Once a discussion starts
(arguing a finding, asking questions), these instructions scroll off and the developer loses
track of what they need to do to complete the upgrade.

### Decision
All manual developer actions must be written to a **persistent runbook document** in addition
to being shown in chat.

**Proposed file:** `docs/migrations/{ADO}/ADO-{ADO_ID}-upgrade-runbook.md`

This document is created at Step 1 and appended to as each step produces developer actions.
It is a living checklist — not a log of what the skill did, but a list of what the developer
must do. Sections:

| Section | Written at | Contains |
|---|---|---|
| Tool install steps | Step 2 (if tool missing) | Exact commands to install + verify the tool |
| Hop execution commands | Step 5 | Ordered git + tool commands per hop |
| Residual fix list | Step 7 | Each residual item the developer must review/approve |
| Verify commands | Step 7 | Commands to run the baseline oracle |
| Sign-off checklist | Step 9 | All artifacts + their paths; tick when done |

The document is a documentation artifact (not subject to the Write Gate). It is the developer's
take-away whether or not the session continues.

---

## Item 2 — Source Context Manifest (intake-verify) replaced with Upgrade Intake Summary

### Current state
The skill requires the developer to hand-author `source-context-manifest.md` — a module-by-module
coverage document that accounts for every file in the codebase. Borrowed from the Rewrite skill
where coverage matters (untranslated modules = missing output). For upgrade, the deterministic
tool handles every file — module accounting adds no safety.

The intake gate (`INTAKE CONFIRMED ADO-{ID}`) is kept. What the developer confirms changes
entirely.

### Decision

**Replace the Source Context Manifest with a skill-generated `ADO-{ID}-upgrade-intake.md`.**

The skill generates the intake document automatically from three detection passes. The developer
reviews and confirms with `INTAKE CONFIRMED ADO-{ID}`. Nothing is hand-authored.

---

### Generation pass 1 — Package compatibility (registry query, live)

For each package in the dependency ledger, query the package registry:

| Result | Label | Meaning |
|---|---|---|
| Compatible version found | ✅ COMPATIBLE | Package has a release for the target framework |
| No compatible version found | → pass 2 | Not necessarily a blocker — check replacement mapping |
| Registry unreachable | 🔍 DEVELOPER REVIEW | Flag for manual check |

Registry is the authoritative source for binary compatibility. Knowledge cache is NOT used for
this question — package releases change continuously and the cache cannot track them.

---

### Generation pass 2 — Replacement mapping (knowledge cache, stable)

For packages with no compatible version found in pass 1, check the knowledge cache replacement
mapping:

| Result | Label | Meaning |
|---|---|---|
| `status: replaced` | ⚠ MIGRATION REQUIRED | Swap package + update registration code |
| `status: sdk_merged` | ⚠ SDK REPLACEMENT | Remove package; use built-in SDK feature |
| Not in mapping | → pass 3 (research agent) | Unknown — invoke research agent |
| Research agent: replacement found | ⚠ MIGRATION REQUIRED | Agent found a known replacement |
| Research agent: none found | ⛔ BLOCKER | Genuine blocker — no path forward |
| Research agent: uncertain | 🔍 DEVELOPER REVIEW | Flag for manual verification |

Replacement mappings are stable knowledge (SDK absorptions and official package renames do not
reverse after release). The knowledge cache is appropriate for this.

Example knowledge cache entry:
```json
{
  "stack": "dotnet", "target_version": "9",
  "replacements": [
    { "package": "Swashbuckle.AspNetCore", "status": "replaced",
      "replacement_package": "Microsoft.AspNetCore.OpenApi",
      "notes": "SDK-native OpenAPI in .NET 9+" },
    { "package": "Microsoft.AspNetCore.Mvc.NewtonsoftJson", "status": "sdk_merged",
      "replacement_sdk": "System.Text.Json",
      "notes": "Built-in from .NET 6+; API differences in date handling, polymorphism" }
  ]
}
```

---

### Generation pass 3 — Behavioral changes (code pattern scan + knowledge cache)

**This is the most dangerous category.** Framework behavioral changes where defaults changed
compile cleanly but fail silently at runtime. Neither the registry check nor the compiler
catches these.

Examples:
- .NET 9+: `MapInboundClaims` defaults to `false` — Entra ID auth silently breaks
- .NET 8: `SameSite=None` cookies require `Secure=true` — silent in dev, fails in prod
- .NET 9: `System.Text.Json` polymorphism behavior changed — silent until specific path runs

**Detection approach:** targeted grep for code patterns that have known behavioral changes at the
target version. Not a full AST parse — the knowledge cache `detection` field drives the scan.

Knowledge cache entry for behavioral changes:
```json
{
  "stack": "dotnet", "target_version": "9",
  "behavioral_changes": [
    {
      "pattern": "AddMicrosoftIdentityWebApi|AddJwtBearer",
      "area": "authentication",
      "change": "MapInboundClaims defaults to false in .NET 9",
      "risk": "SILENT_FAILURE",
      "required_action": "Set jwtOptions.MapInboundClaims = true explicitly",
      "detection": "grep AddMicrosoftIdentityWebApi|AddJwtBearer Program.cs Startup.cs"
    }
  ]
}
```

If the pattern is detected in the codebase → surface as ⚠ BEHAVIORAL CHANGE in the intake
summary. If not detected → skip (not relevant to this app).

---

### The three generation passes produce `ADO-{ID}-upgrade-intake.md`

```
## Dependency ledger
| Package | Status | Action required |
|---|---|---|
| EntityFrameworkCore | ⚠ MIGRATION REQUIRED | Breaking API in 8.x — update migration calls |
| Swashbuckle.AspNetCore | ⚠ MIGRATION REQUIRED | Replace with Microsoft.AspNetCore.OpenApi |
| SomeAbandonedPackage | ⛔ BLOCKER | No compatible version, no known replacement |
| RestSharp | ✅ COMPATIBLE | 111.x supports .NET 8 |

## Behavioral changes (silent failures — no compiler warning)
| Area | Pattern detected | Change at target | Required action |
|---|---|---|---|
| JWT auth | AddMicrosoftIdentityWebApi | MapInboundClaims = false by default | Set explicitly to true |

## Integration inventory
| Integration | Type | Breaking change at target? |
|---|---|---|
| Azure Service Bus | Message bus | No breaking change |
| Auth0 / OIDC middleware | Auth | Middleware pipeline changed |
```

Developer reviews this document and replies `INTAKE CONFIRMED ADO-{ID}` to confirm:
- The integration list is complete (nothing missing)
- The dependency statuses look correct (no false positives on BLOCKER)
- The behavioral change flags are recognised

### Complete intake section list — 12 sections, always rendered

Three anchor sections first (scope before risk). Nine risk/scope sections follow.
Every section renders — findings or "Not applicable — evidence: X". Never silently skipped.

| # | Section | Purpose | Always renders |
|---|---|---|---|
| 0 | Baseline and target | Detected stack layers, version pins, version-pinning files | ✅ Always |
| 1 | Upgrade path | One hop or multi-hop; which intermediates required | ✅ Always |
| 2 | Version coupling | What the target version forces (runtime, toolchain, language) | ✅ Always |
| 3 | Dependency ledger | Package compatibility: registry + replacement mapping | ✅ Always |
| 4 | Build-time breaks | Removed APIs, deprecated APIs that now error, new compiler/linter rules | ✅ Always |
| 5 | Behavioral changes | Silent runtime failures; each flagged with test coverage status | ✅ Always |
| 6 | Data access and schema migration state | ORM migrations + raw driver default changes | ✅ Always |
| 7 | Serialization contracts in flight | Queue/cache/session data format compatibility | ✅ Always |
| 8 | Configuration loading | appsettings, yml, .env — binding rules, precedence, key naming | ✅ Always |
| 9 | Infrastructure gaps | Dockerfile, pipeline files, hosting plan version references | ✅ Always |
| 10 | Test suite impact | Test framework + mock library compatibility at target version | ✅ Always |
| 11 | Downstream consumers | Published packages/libraries that callers depend on | ✅ Always |

**Section notes:**

**Section 0 — Baseline and target**
The anchor for everything else. Without it the developer cannot verify whether the skill
scanned the right stack and version. Lists: detected language runtime + framework + build tool
with current versions; the developer's chosen target; and the files that pin versions
(`global.json`, `.nvmrc`, `.python-version`, `pom.xml properties`, toolchain files).

**Section 1 — Upgrade path**
Some ecosystems forbid skipping majors (Angular: one major at a time; Spring Boot 2→3
requires 2.7 as intermediate). States explicitly whether the target is reachable in one hop
or requires intermediate stops — because that changes the runbook step count in Step 6.

**Section 2 — Version coupling**
Framework target often forces runtime/toolchain target. Spring Boot 3 requires Java 17.
Angular 18 requires Node 18.19+ and TypeScript 5.4+. The developer picks one version; the
skill surfaces what else that choice drags in before INTAKE CONFIRMED. Without this the
developer approves an incomplete picture and hits secondary upgrades mid-run.

**Section 4 — Build-time breaks (distinct from Section 5)**
Removed APIs, deprecated APIs that now error, new compiler/type-checker/linter strictness.
Discovered on first build — high signal, easy to locate. Kept separate from Section 5
because the failure mode and response differ:

| Section | Failure mode | When discovered | Response |
|---|---|---|---|
| 4 — Build-time | Compile / type / lint error | First build | Fix before running |
| 5 — Behavioral | Wrong value / silent drop | Runtime, specific conditions | Test coverage + runtime verification |

**Section 5 — Behavioral changes (with test coverage flag)**
For each behavioral change detected, grep the test directory for coverage of that code path.
Flag each finding as:
- `Test coverage: ✅ covered` — pattern found in test directory
- `Test coverage: ❌ not covered` — no test exercises this path (higher risk)
Coarse detection (grep) but meaningfully different risk signal.

**Section 6 — Data access and schema migration state**
Covers ORM migrations (EF Core, Flyway, Liquibase, Alembic, Prisma, Rails) AND raw database
drivers. Driver upgrades (SqlClient, pg, mysql2, JDBC) change connection defaults silently —
encryption required by default, timeout values, connection pooling — with no ORM involved.
Detection: any database driver or ORM package in the dependency ledger, cross-referenced
against known driver-version behavioral changes.

**Section 11 — Downstream consumers**
If the repo publishes a package (NuGet, npm, Maven artifact), callers in other repos depend
on its public API and minimum runtime requirement. A version bump can break them without any
change to their code. Detection: publishing configuration (`<IsPackable>`, `package.json`
name + version, `pom.xml <distributionManagement>`).

---

### Stack-agnostic design principle

The skill is stack-agnostic. SKILL.md defines *what* to detect (abstract). Per-stack knowledge
files define *how* to detect it (concrete). New stacks get support by adding a knowledge file,
not by modifying SKILL.md.

**Knowledge file location per stack:**
```
skills/shared/migration-knowledge/refs/mappings/
  dotnet-upgrade.md      (exists — partial; needs behavioral_changes section)
  java-upgrade.md        (new)
  angular-upgrade.md     (new)
  react-upgrade.md       (new)
  nodejs-upgrade.md      (new)
  python-upgrade.md      (new)
```

---

### Multi-stack repos — one component per upgrade run

**Decision: one component per upgrade run.**

When multiple stacks are detected in a single repo (e.g. a frontend stack alongside a backend
stack), the skill scopes each upgrade run to one component. The developer selects which
component to upgrade at the start of the run.

**Rationale:**

| Reason | Explanation |
|---|---|
| Tool boundary | Each stack has its own deterministic upgrade tool. A single run cannot coherently drive two tools on two stacks with no clean abort boundary between them. |
| Baseline tag | One unambiguous oracle anchor per run. A shared baseline tag for two components makes bisection impossible if one succeeds and the other fails. |
| Failure isolation | If one component's upgrade fails mid-hop, rollback scope is clear. Mixed-component runs produce ambiguous rollback state. |

**Cross-component coupling is surfaced in the intake, not handled in the run.**

Coupling between components (shared API contracts, generated types, protocol version
dependencies) is surfaced in Section 0 and Section 2 of the intake before
`INTAKE CONFIRMED`. The developer knows which components are coupled and what to verify
after the in-scope component's upgrade completes.

**Section 0 — Baseline and target (multi-stack example):**
```
Detected stack layers:
  [Component A]  vX.x → target vY.x   [pinned in: {version file}]   ← in scope this run
  [Component B]  vX.x → (not upgrading this run)   [pinned in: {version file}]
  [Runtime]      vX.x → (runtime, not upgrading)   [pinned in: {version file}]

This upgrade run scope: Component A vX.x → vY.x
```

**Section 2 — Version coupling (cross-component example):**
```
Cross-component coupling detected:
  Component A communicates with Component B via {protocol} (detected: {evidence})
  ⚠ Verify interface compatibility after this upgrade.
  Component B is at vX.x — no forced upgrade required by this Component A bump.
```

**Developer prompt when multiple stacks are detected:**
```
Multiple stack components detected in this repo:
  1. {Component A}  {current version} → {target version}
  2. {Component B}  {current version} → (upgrade separately)

Which component are you upgrading this run?
(Each component upgrade runs independently with its own baseline and runbook.)
```

Each file provides per-version-hop entries for:
- Package registry endpoint
- Replacement mappings (package renames, SDK merges)
- Behavioral change patterns (with `detection` grep pattern)
- Which of the 7 sections apply to this stack

| Pass | SKILL.md instruction | Knowledge provides |
|---|---|---|
| 1 — Package compatibility | "Query the registry for detected stack" | Registry endpoint per stack token |
| 2 — Replacement mapping | "Check replacement cache for stack + version hop" | Per-stack replacement entries |
| 3 — Behavioral changes | "Grep patterns from knowledge `detection` field" | Per-stack patterns + required actions |

---

### Section rendering rule — always render all 7 sections

**Every section renders in the intake summary — no section is silently skipped.**

If patterns matched: render findings with severity and required action.
If no patterns matched: render "Not applicable" with the specific evidence that produced
the "not found" conclusion.

**Rationale:** A missing section cannot be distinguished from a skipped scan. A stated
"Not applicable — evidence: X" is verifiable. This is consistent with the gate model used
elsewhere in the plugin — the developer confirms what they can see, not what they assume.
It also surfaces knowledge gaps: if the developer knows Redis is in use but the scan shows
"not applicable — no Redis package detected", that's a signal to add the detection pattern
to the knowledge cache.

**The 7 sections (always rendered):**

| # | Section | Applies to | Evidence for "not applicable" |
|---|---|---|---|
| 1 | Dependency ledger | All stacks | n/a — always has entries |
| 2 | Behavioral changes | All stacks | "No patterns from behavioral_changes knowledge matched" |
| 3 | Test suite impact | All stacks | "No test framework package detected in dependency ledger" |
| 4 | Infrastructure gaps | All stacks | "No Dockerfile / pipeline / hosting config detected" |
| 5 | Serialization contracts in flight | Queue/cache stacks | "No queue, cache, or distributed session package detected" |
| 6 | Data migration state | ORM stacks | "No ORM or migration tool detected in dependency ledger" |
| 7 | Configuration binding | All stacks | "No framework config file detected (appsettings / application.properties / environment.ts)" |

**Example not-applicable rendering:**
```
## Data migration state
Not applicable — no ORM or migration tool detected.
  Evidence: no EF Core / Flyway / Liquibase / Alembic / Mongoose in dependency ledger.

## Serialization contracts in flight
Not applicable — no queue, cache, or distributed session dependency detected.
  Evidence: no Azure Service Bus / RabbitMQ / Redis / Kafka packages found.
```

---

### INTAKE CONFIRMED confirms two things simultaneously

1. The findings sections are accurate (no important integration or package missing)
2. The not-applicable sections are correctly dismissed (the stated evidence holds)

If any "not applicable" shows wrong evidence, the developer challenges it before confirming.
Resolution: add the missed detection pattern to the stack knowledge file.

---

### What this replaces
`source-context-manifest.md` (hand-authored, module-by-module coverage accounting). The new
approach is **risk-surface detection** — find what patterns in this specific app have known
breaking changes at the target version. Coverage accounting is the tool's job, not the
developer's.

---

## Item 3 — Step 4.5 delta design documents

### Current state
Step 4.5 runs unconditionally after `APPROVE REPORT`. It requires the skill to author "non-empty
delta documents" using `target-design-spec.md` (a Rewrite spec for creating architecture from
scratch), run a feedback loop via `design-revision-spec.md` (a Rewrite design iteration ceremony),
and derive a graph via `graph-derive-documents.cjs`. Only then is `APPROVE DESIGN` shown.

The problem: in a Rewrite, design documents make sense — you are creating a target architecture
from nothing. In an upgrade, the architecture does not change. The gap/risk report already
captured what changes and why. `target-design-spec.md`, `design-revision-spec.md`, and
`graph-derive-documents.cjs` are Rewrite ceremony grafted onto an in-place tool run.

The `APPROVE DESIGN` gate itself is genuinely valuable — one explicit developer confirmation
before the skill touches git and creates the baseline tag. The gate stays; what changes is what
the developer is approving.

### Decision
**Replace the full design ceremony with a lightweight upgrade decision log.**

- One document generated from the gap/risk report: `ADO-{ID}-upgrade-decisions.md`
- One entry per RED/BLOCKER item that requires a migration pattern choice before execution
  (e.g., "Replace package A with package B: use approach X or approach Y?")
- If no RED/BLOCKER items → the log states: "No architectural decisions required — all items
  are routine fixes" → `APPROVE DESIGN` is still shown but expected to be fast
- `target-design-spec.md`, `design-revision-spec.md`, and `graph-derive-documents.cjs` are
  removed from this step entirely

**What APPROVE DESIGN now confirms:**
- Every RED/BLOCKER item has a documented decision
- The developer has chosen the migration approach for each non-obvious fix
- Nothing requires routing to Rewrite (the infeasibility escape hatch stays)

| Before | After |
|---|---|
| Author delta architecture documents (Rewrite ceremony) | Generate decision log from gap/risk RED/BLOCKER items |
| Feedback loop on design documents | No design iteration loop — decisions are scoped to specific findings |
| graph-derive-documents.cjs | Not used in this step |
| APPROVE DESIGN | APPROVE DESIGN (kept; what developer confirms changes) |

---

## Item 4 — Migration roots resolution

### Current state
Step 1 calls `resolve-migration-roots.cjs` immediately after classification. The SKILL.md
acknowledges "For upgrade the source IS the CWD" yet still runs the script. Grep confirmed
the output (`migrationRoots`) is:
- Written to `settings.local.json`
- Read back and written to the checkpoint ledger via `set-source --roots-json`
- Never read by any downstream upgrade step (`migration-source-detect.cjs` uses `--roots=.`,
  hardcoded — not the resolved value)
- Only referenced in the old `source_context` manifest payload (removed by Item 2)

The script is also listed in the required scripts preflight — adding a startup failure risk
for a call that produces no consumed output.

### Valid concern: dependency repo version constraints
If Application A consumes a service from Application B (a dependency repo), that repo may
impose a version constraint on the upgrade target (e.g., a client SDK that caps the runtime
version). This is a real concern — but it is a version compatibility question, not a source
path question. `resolve-migration-roots.cjs` resolves paths to scan; it does not read
dependency repos for version constraints.

### Decision
**Remove `resolve-migration-roots.cjs` from upgrade entirely.**

- Remove the call from Step 1
- Remove the script from the required scripts preflight list
- Move dependency repo constraint surfacing to intake **Section 2 (version coupling):**
  add a check — "does any consumed service or package impose a maximum version constraint on
  the upgrade target?" Developer confirms this is complete at `INTAKE CONFIRMED`.

---

## Item 5 — upgrade-checkpoint.cjs wrapper

### Current state
The script is described as a "thin adapter" over `checkpoint-ledger.cjs`. In practice it adds
one genuinely important feature: `set-gate report PASS` spawns `intake-verify.cjs check-gate`
before allowing the gate to pass — a code-level enforcement that the intake is confirmed before
the report gate can advance. Without this guard, a skill or developer could call the shared
ledger directly and bypass intake.

The confusion arises because SKILL.md inconsistently calls BOTH scripts:
- `upgrade-checkpoint.cjs` for init, set-gate (report), set-payload (baseline-tag, hops)
- `checkpoint-ledger.cjs` directly for all step-boundary gate flushes and other set-payload calls

Two scripts, same concern, mixed usage. The intake-verify guard is buried in a file that
looks like a mere adapter.

### Decision
**Option A — Keep the wrapper; make SKILL.md use it exclusively.**

- `upgrade-checkpoint.cjs` is the upgrade skill's single checkpoint interface
- All checkpoint operations in SKILL.md route through `upgrade-checkpoint.cjs`
- No direct `checkpoint-ledger.cjs` calls in upgrade SKILL.md
- The intake-verify guard on `set-gate report PASS` is correctly placed: upgrade-specific
  enforcement in an upgrade-specific script
- The script's purpose is documented clearly: "upgrade checkpoint interface + intake gate enforcer"

---

## Item 6 — Research agent cache shell block

### Current state
Both `skills/upgrade/SKILL.md` and `skills/rewrite/SKILL.md` contain an identical ~30-line
shell block that calls `research-cache.cjs lookup`, redirects stdout to a temp file, then
uses three separate `node -e` one-liners to parse individual fields (status, staleness,
age_days) out of that temp file. Neither skill checks the exit code — both ignore `$?`
entirely.

Root cause: `lookup` currently exits `0` for both fresh AND stale hits (stale is still
"usable"), so there is no exit-code signal to distinguish the two cases. The `node -e`
inline parsing is the workaround for that limitation.

Replatform skill does NOT use `research-cache.cjs` — unaffected.

### Decision
**Redesign exit codes + add `--extract-bundle-to` flag.**

| Exit code | Meaning |
|---|---|
| `0` | Fresh hit (age ≤ 30 days) — bundle written to `--extract-bundle-to` file |
| `1` | Miss (not found, corrupt, or expired) |
| `2` | Stale hit (30–90 days) — still usable, warn developer; bundle written to file |

**New flag:** `--extract-bundle-to=<file>` on `lookup` — on hit (exit 0 or 2), writes
`entry.bundle` as standalone JSON to the specified file. On miss, writes nothing.

**SKILL.md cache block (both skills) rewrites to ~8 lines:**
```bash
BUNDLE_FILE="$(mktemp).json"
node "$PLUGIN_DIR/scripts/research-cache.cjs" lookup \
  --key="$CACHE_KEY" --extract-bundle-to="$BUNDLE_FILE"
CACHE_EXIT=$?
# 0=fresh hit · 1=miss · 2=stale hit
if [ $CACHE_EXIT -eq 2 ]; then
  echo "⚠ Research cache is stale — facts may have changed. Delete cache entry to refresh."
fi
if [ $CACHE_EXIT -eq 1 ]; then
  # invoke research agent → write bundle to $BUNDLE_FILE
fi
# BUNDLE_FILE now contains the bundle for all hit cases
```

**Full change surface:**

| File | Change |
|---|---|
| `scripts/research-cache.cjs` | Set `exit = 2` in stale hit branch (1 line) |
| `tests/research-cache.test.cjs` | Line 99: `=== 0` → `=== 2`; update description (2 lines) |
| `skills/upgrade/SKILL.md` | Rewrite cache block |
| `skills/rewrite/SKILL.md` | Same cache block rewrite |
| `skills/replatform/SKILL.md` | No change — does not use research-cache |

---

## Item 7 — Steps 8, 8a, 9 STEP BOUNDARY gates

### Current state

**Step 8** ("Checkpoint + judge at every gate"): A reference section describing the judge/
checkpoint substrate — how verdicts are recorded, how the shared ledger works, which scripts
to call. Not a procedural step with work to perform. Yet it opens with a CONTINUE gate that
stops execution waiting for a developer reply before... reading documentation.

**Step 8a** ("Generate test plan"): Invokes the test-plan skill in subagent mode — explicitly
configured with "no prompt, no budget warning." The CONTINUE gate in front of the subagent
invocation contradicts the subagent's own design.

**Step 9** ("Completion gate + Lessons + Transferable Patterns"): The SKILL.md text at line
804 says verbatim: *"Run automatically after Step 8a — no developer prompt required. This is
a documentation step, not a gate."* — immediately followed by a CONTINUE gate. The skill
describes its own behaviour correctly and then contradicts it.

These are gates 12, 13, and 14 from the Item 1 inventory — all marked for removal there.

### Decision
- **Step 8:** Dissolved as a standalone step. Judge substrate documentation inlined into
  Steps 4 and 7 where judge verdicts are actually recorded. The `upgrade-checkpoint.cjs
  set-gate` call at Step 4 (report gate) and Step 7 (verify gate) already do this work —
  Step 8 was a duplicate reference section.
- **Step 8a:** CONTINUE gate removed. Auto-proceeds when `upgrade-orchestrate.cjs verify`
  exits 0. Test-plan failure logs a warning to `migration-log.md` but does not block completion.
- **Step 9:** CONTINUE gate removed. Auto-proceeds as the SKILL.md itself states it should.

---

## Item 8 — Migration log entries per residual fix

### Current state
Step 7 requires, for every residual fix:
1. A `[FINDING]` entry written before applying the fix
2. A `[DECISION]` entry written after the Write Gate approves
3. Optionally a `[LESSON]` + `lessons.md` entry

A typical upgrade with 10–15 residual compile errors produces 20–30 migration log writes.
Most of these are for routine fixes — namespace renames, package version bumps, API renames
that the intake already flagged — where the log entry adds no information beyond what the
Write Gate diff already captures.

The migration log is intended as an audit trail for decisions and surprises. Requiring
identical structure for every routine fix buries that signal in noise.

### Decision
**Scope migration log entries to non-routine fixes only.**

| Fix type | Criteria | Log entry required |
|---|---|---|
| Unanticipated find | Not flagged by intake; first discovered during the tool run or residual phase | ✅ `[FINDING]` + `[DECISION]` |
| Non-obvious choice | Multiple approaches available; architectural decision made | ✅ `[DECISION]` with alternatives |
| Surprising behavioral change | Runtime failure not caught by build; not in intake | ✅ `[FINDING]` + `[DECISION]` + consider `[LESSON]` |
| Routine fix | Matches an intake finding; single obvious fix; no choice required | ❌ Write Gate diff is the record |

**End-of-step summary entry (always written):**
After all residual fixes, append one summary entry to `migration-log.md`:
```markdown
### [RESIDUAL SUMMARY] Step 7 — {N} fixes applied — {date}
Anticipated (intake-matched): {N}
Unanticipated (logged individually above): {N}
```
This gives the audit trail the count without forcing per-fix entries for routine work.

---

## Proposed simplified flow

```
Step 1 — Intake & classification
  Detect stack + current version
  Confirm target version with developer
  Classify (reject false-upgrades → route to Rewrite; hard BLOCK if tool missing)
  Generate ADO-{ID}-upgrade-intake.md (three passes: registry + cache + grep)
  ── INTAKE CONFIRMED ADO-{ID} ──────────────────── [Gate 1 of 3]

Step 2 — Tool-availability preflight
  Probe the deterministic tool
  Tool missing → hard BLOCK (print install steps to runbook + chat); skill stops
  Tool found → auto-proceed

Step 3 — Gap + risk analysis
  Web-grounded gap/risk analysis (research-cache.cjs: exit 0=fresh / 1=miss / 2=stale)
  Bundle written by --extract-bundle-to; no inline node -e parsing
  Generate ADO-{ID}-gap-risk-report.md
  ── APPROVE REPORT ADO-{ID} ────────────────────── [Gate 2 of 3]

Step 4 — Decision log + APPROVE DESIGN
  Generate ADO-{ID}-upgrade-decisions.md from RED/BLOCKER items in report
  No RED/BLOCKER items → log states "no decisions required"
  Infeasibility discovered here → route to Rewrite
  ── APPROVE DESIGN ADO-{ID} ────────────────────── [Gate 3 of 3]

Step 5 — Baseline tag + working branch
  upgrade-orchestrate.cjs plan (orchestrator emits runbook; never runs commands)
  Runbook written to ADO-{ID}-upgrade-runbook.md (§ Hop execution commands)
  Auto-proceed

Step 6 — Run stack tool per hop
  One commit per hop (bisectable history)
  Auto-proceed

Step 7 — Residual remediation + verify
  Each residual fix behind Write Gate
  Migration log: [FINDING]+[DECISION] only for unanticipated finds / non-obvious decisions
  Routine fixes: Write Gate diff is the record
  [RESIDUAL SUMMARY] entry written at end of step
  upgrade-orchestrate.cjs verify → exit 0 = pass / exit 9 = blocked

Step 8 — Test plan (auto)
  test-plan skill in subagent mode (no prompt, no budget warning)
  Failure → log warning; does not block completion
  Auto-proceed

Step 9 — Completion summary + Lessons + Transferable Patterns (auto)
  Pre-append guards on migration-log.md + lessons.md
  Generate TP-{N} entries from [LESSON] entries in lessons.md
  Artifact validation: confirm each file exists on disk
  Completion summary: all artifacts + paths listed
  Auto-proceed (documentation step, not a gate)
```

**Gates removed:** 11 boilerplate CONTINUE gates (Items 1, 7)
**Gates kept:** 3 real decision gates (INTAKE CONFIRMED · APPROVE REPORT · APPROVE DESIGN)
**New artifacts:** upgrade-intake.md · upgrade-decisions.md · upgrade-runbook.md
**Removed artifacts:** source-context-manifest.md (hand-authored)
**Scripts removed from skill:** resolve-migration-roots.cjs
**Scripts consolidated:** all checkpoint ops route through upgrade-checkpoint.cjs (no direct checkpoint-ledger.cjs calls from SKILL.md)
**Scripts modified:** research-cache.cjs (exit 2 for stale + --extract-bundle-to flag)
**Skills updated:** upgrade SKILL.md + rewrite SKILL.md (same cache block fix)

---

## Revision Log
2026-10-03 — Planning document created. Item 1 under discussion.
2026-10-03 — Item 1 decided: 3 real gates kept (INTAKE CONFIRMED, APPROVE REPORT, APPROVE DESIGN); 11 CONTINUE gates removed; tool-missing = hard BLOCK. Item 1b decided: upgrade-runbook.md captures all manual developer actions persistently.
2026-10-03 — Item 8 decided: migration log entries required only for unanticipated finds and non-obvious decisions. Routine intake-matched fixes: Write Gate diff is the record. Single [RESIDUAL SUMMARY] entry at end of Step 7 captures the count.
2026-10-03 — Item 7 decided: Step 8 dissolved (reference doc inlined into Steps 4+7); Steps 8a and 9 CONTINUE gates removed; both auto-proceed. Steps 8a/9 are gates 13+14 from Item 1 inventory.
2026-10-03 — Item 6 decided: research-cache.cjs lookup exit codes redesigned to 0=fresh/1=miss/2=stale. New --extract-bundle-to flag writes bundle on hit. Both upgrade + rewrite SKILL.md cache blocks rewritten (~30 lines → ~8 lines, no inline node -e). Replatform unaffected. Impact: 1-line script, 2-line test, 2 SKILL.md cache block rewrites.
2026-10-03 — Item 5 decided: keep upgrade-checkpoint.cjs; it contains a real intake-verify enforcement gate on set-gate report PASS. Fix is to make SKILL.md use it exclusively — no mixed direct checkpoint-ledger.cjs calls from upgrade SKILL.md.
2026-10-03 — Item 4 decided: remove resolve-migration-roots.cjs from upgrade (source is always CWD; output is written but never consumed downstream; required scripts preflight entry removed). Dependency repo version constraints move to intake Section 2 (version coupling), confirmed at INTAKE CONFIRMED.
2026-10-03 — Item 3 decided: Step 4.5 design ceremony replaced with lightweight decision log (ADO-{ID}-upgrade-decisions.md). One entry per RED/BLOCKER item requiring a migration pattern choice. No RED/BLOCKER items → log states "no decisions required" → APPROVE DESIGN is fast. target-design-spec.md, design-revision-spec.md, graph-derive-documents.cjs dropped from this step. APPROVE DESIGN gate retained.
2026-10-03 — Item 2 decided (full). Source Context Manifest replaced with skill-generated ADO-{ID}-upgrade-intake.md. Three generation passes: (1) live registry query for package compatibility, (2) replacement mapping from knowledge cache (stable: SDK merges, package renames), (3) behavioral change scan via grep against knowledge cache patterns. 12 intake sections always render — findings or "Not applicable — evidence: X" (never silently skipped). Sections 0–2 are anchors (baseline/target, upgrade path, version coupling). Sections 3–11 are risk/scope. Build-time breaks (Section 4) kept distinct from behavioral changes (Section 5). Section 5 behavioral changes include test coverage flag per finding. Section 6 renamed "Data access and schema migration state" (ORM + raw drivers). Section 7 "Serialization contracts." Section 8 renamed "Configuration loading." Section 11 new: downstream consumers. Stack-agnostic: SKILL.md defines what to detect; per-stack knowledge files define how.
