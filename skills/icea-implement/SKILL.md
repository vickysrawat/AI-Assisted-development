# Skill: icea-implement

_Skill version: 1.0 · Last changed: 2026-07-07 · Consent: B_

> **Business context severity:** implements ICEAs whose acceptance criteria carry B-series
> sensitivity flags — see `$PLUGIN_DIR/skills/shared/business-context-severity.md`.

## Purpose
Generate and write implementation code for an approved ICEA.
Works in any session — reads all state from disk.

Triggered by:
- `/icea-implement ADO-1847`
- `IMPLEMENT ADO-1847`
- `IMPLEMENT ADO-1847 Story-2`

---

## Persona

Execute as **[SE] Elena Fischer — Senior Software Engineer** (9 yrs across front-end, back-end, and
data layers). Optimizes for simple, correct, maintainable code that matches the codebase's existing
idioms per layer; always asks "what's the simplest change that's still correct at the edges, in this
layer's idioms?" Weigh [QA] Sam Okonkwo's test-coverage concerns. Expertise = this project's actual
stack per layer, never a fixed technology.

The persona sets *what to scrutinize* — it never licenses assumption. The approved ICEA, Tech Spec,
and the codebase's real patterns are the only sources of truth; a persona's "experience" is never
evidence, and ambiguity is resolved by reading the code or asking — never by guessing (subordinate to
CLAUDE.md §3 / decision transparency). Never name the persona in code or comments. See
`$PLUGIN_DIR/skills/shared/personas-spec.md`.

## Step 1 — Resolve ADO ID and Story

Extract from command argument or keyword input.
Normalise ADO ID: ADO-1847, ADO #1847, and 1847 all resolve the same.
For Epics, extract Story number if provided (e.g. Story-2).

If ADO ID missing, ask:
```
Which ICEA would you like to implement?
  ADO #: [e.g. ADO #1847]
```

For Epic stories, also ask for the child ADO number if not already in the
Story Breakdown:
```
What is the ADO # for Story {N}? (created in Azure DevOps)
e.g. ADO-1848
```

Record the child ADO number in the Story Breakdown table of the ICEA and
in the Epic tracker immediately. This is the only time the child ADO is
needed — subsequent `IMPLEMENT ADO-{ID} Story-{N}` calls use it automatically.

**Check for in-flight checkpoint (resume path):**

```bash
ACTIVE_STEP=$(node -e "
try {
  const s = JSON.parse(require('fs').readFileSync('.claude/active-task.json','utf8'));
  if (s.skill === 'icea-implement' && s.ado === '${ADO_ID}' && s.step && s.step !== 'step4-start')
    process.stdout.write(s.step);
} catch(_) {}
" 2>/dev/null)
```

If `ACTIVE_STEP` is non-empty — this is a post-compact resume at a step beyond Step 4. Do not re-run Steps 2–5. Display:

```
🔄 RESUMING ADO #{ADO_ID} — checkpoint: {ACTIVE_STEP}
   Steps before this point already completed — jumping to resume point.
   Re-resolving file paths from disk.
```

Re-resolve all file paths from disk (do not rely on prior in-context values):

```bash
TRACKER=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.tracker.md" 2>/dev/null | head -1)
ICEA_FILE=$(find docs -name "ADO-${ADO_ID}-*.icea.md" 2>/dev/null | head -1)
AUDIT_FILE=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.ai-audit.md" 2>/dev/null | head -1)
TS=$(date '+%Y-%m-%dT%H:%M:%S')
ACTOR=$(node -e "const i=require('.claude/hooks/audit-append.cjs').resolveIdentity();console.log(i.verified_actor||i.os_user||'UNRESOLVED')" 2>/dev/null || echo "UNRESOLVED")
```

Also restore `STORY_N` from the checkpoint (required for EPIC story section targeting):

```bash
STORY_N=$(node -e "
try { const s=JSON.parse(require('fs').readFileSync('.claude/active-task.json','utf8'));
      process.stdout.write(s.story_n||''); } catch(_) {}
" 2>/dev/null)
```

Jump directly to the declared step — do not execute any intermediate steps:
- `step6-start` → jump to Step 6
- `step6a-start` → jump to Step 6a
- `step7-start` → jump to Step 7

---

## Step 2 — Locate and validate files

```bash
GOVERNANCE=$(node -e "try{const s=JSON.parse(require('fs').readFileSync('.claude/dream-init-state.json','utf8'));process.stdout.write(s.governance_mode||'full')}catch(e){process.stdout.write('full')}")

if [ "$GOVERNANCE" = "lightweight" ]; then
  PLAN_FILE=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.plan.md" 2>/dev/null | head -1)
  if [ -z "$PLAN_FILE" ]; then
    echo "LIGHTWEIGHT_GATE_BLOCKED: No plan file"
  else
    PLAN_STATUS=$(grep "^Status:" "$PLAN_FILE" | head -1)
    echo "LIGHTWEIGHT_MODE: $PLAN_FILE | $PLAN_STATUS"
  fi
fi
```

**If `LIGHTWEIGHT_GATE_BLOCKED`** — HARD STOP:
```
⛔ No plan found for ADO #{ADO_ID}. Run: goal-loop ADO-{ADO_ID}
```

**If `LIGHTWEIGHT_MODE` + status ≠ `✅ Approved`** — HARD STOP:
```
⛔ Plan not approved. Run: SAVE PLAN ADO-{ADO_ID} (saves + approves automatically)
```

**If `LIGHTWEIGHT_MODE` + `Status: ✅ Approved`:**
- Extract Must Have items as ACs: `[N] {text}` → `AC-F{N}`
- Create minimal tracker and write to `docs/Release{R}/Sprint{S}/UserStory{ADO_ID}/ADO-{ADO_ID}-{feature}.tracker.md`:
  ```markdown
  # Tracker — {feature} [LIGHTWEIGHT]
  ADO #{ADO_ID} · governance: lightweight

  | AC | Must Have item | Status |
  |---|---|---|
  | AC-F1 | {item 1 text} | ⏳ Pending |
  ```
- Generate code per Must Have item (same layer order as full mode)
- **Step 4a critic (code mode)** — runs unchanged; oracle = plan Must Have items as ACs (no ICEA or Tech Spec oracle)
- **Step 4b AC self-scoring** — `percentDone` = fraction of Must Have items implemented
- Write Gate unchanged (`APPROVE ADO-{ID}` before code hits disk)

**If `GOVERNANCE_MODE=full`** — skip to existing `find docs` commands below (Steps 2–5 unchanged):

```bash
find docs -name "ADO-${ADO_ID}-*.icea.md" 2>/dev/null
find docs -name "ADO-${ADO_ID}-*.techspec.md" 2>/dev/null
find docs -name "ADO-${ADO_ID}-*.tracker.md" 2>/dev/null
```

Read `Status:` line from ICEA file.

If Status is not `✅ Approved`:
```
⚠ ICEA for ADO #{ADO_ID} is not approved (Status: {current status}).
  Approve it first: APPROVE ADO-{ADO_ID}
```
Stop here.

For an Epic with a Story argument, locate the story-level ICEA:
```bash
find docs -path "*Epic${ADO_ID}*" -name "ADO-${STORY_ADO_ID}-*.icea.md"
```
Validate the story-level ICEA Status is also `✅ Approved`.

---

## Step 3 — Check tracker for progress

Read the tracker file. Determine tracker type:

**Story tracker** (Type: STORY) — rows are ACs:
- `✅ Done` — skip
- `⏳ Pending` — implement
- `🚫 Blocked` / `🐛 Bug` — flag before proceeding

**Epic tracker** (Type: EPIC) — rows are stories:
- Read the Story Breakdown from the ICEA to find the logical scope for Story {N}
- Check tracker row for Story {N}: `✅ Done` → skip, `⏳ Pending` → implement

**If tracker Story status is `🔄 Revised`:**
Reset all ACs for this story: change `✅ Done` → `⏳ Pending` in the tracker before proceeding. Display:
```
🔄 Story {story_n} marked Revised — resetting all ACs to ⏳ Pending for re-implementation.
   Prior code on disk will be overwritten at the Write Gate.
```
Continue to Step 4 (code generation) — do not skip any AC.

Display:
```
📋 IMPLEMENTATION PLAN — ADO #{ADO_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type:         {STORY / EPIC}
{If EPIC:}
Story {N}:    {logical scope from Story Breakdown}
Child ADO:    ADO-{child_id}

Already done:  {list or "none"}
To implement:  {list of ACs / story scope}
Blocked:       {list or "none"}
Bugs open:     {list or "none"}
```

If EPIC type AND no Story-N argument was given — store `EPIC_AUTO_FLOW = true` and display:
```
📋 EPIC MODE — {total_stories} stories to implement.
   Batch-approve all Write Gate diffs:  APPROVE ALL ADO-{ADO_ID}
   Stop after any story:  reply PAUSE
   Resume command:        IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}
   (PAUSE reminder shown before each story advance.)
```

If EPIC type AND Story-N argument was given — store `EPIC_AUTO_FLOW = false`.

If there are open `🐛 Bug` rows in the tracker — HARD STOP:
```
⛔ {bug_count} open bug(s) must be resolved before Story {story_n} can start.
   Tracker: {TRACKER} — rows marked 🐛 Bug
   Fix each bug and mark ✅ Done, then re-run:
     IMPLEMENT ADO-{ADO_ID}{if Epic: ' Story-{story_n}'}
```
No CONTINUE option. Skill does not proceed to Step 4.

---

## Step 3c — Detect test framework

Resolve the test framework before code generation — tests cannot be generated without it.

**1. Check `dream-init-state.json` first** (fastest path — never ask again once stored):

```bash
node -e "
try {
  const s = JSON.parse(require('fs').readFileSync('.claude/dream-init-state.json','utf8'));
  if (s.test_framework) { console.log(s.test_framework); process.exit(0); }
} catch(_) {}
console.log('NEEDS_DETECTION');
"
```

If `test_framework` is present: use it, skip to Step 4.

**2. Auto-detect from existing test files** (Option C):

Scan the repo for the dominant test file pattern:

| File pattern / config file | Inferred framework |
|---|---|
| `*.spec.ts` or `*.test.ts` + `jest.config.*` | Jest |
| `*.spec.ts` or `*.test.ts` in Angular project (no jasmine config) | Jest |
| `*.spec.ts` with `jasmine.json` present | Jasmine |
| `*Tests.cs` containing `[Fact]` or `[Theory]` | xUnit |
| `*Tests.cs` containing `[TestMethod]` | MSTest |
| `*Tests.cs` containing `[TestFixture]` | NUnit |
| `test_*.py` or `*_test.py` + `pytest.ini` / `pyproject.toml [tool.pytest]` | pytest |
| `test_*.py` or `*_test.py` with no pytest config | unittest |
| `*.test.java` with `org.junit.jupiter` import | JUnit 5 |
| `*.test.java` with `org.testng` import | TestNG |

Scan up to 20 test files for the dominant pattern. If ≥ 80% match one framework: infer it.

**If ambiguous or no test files found:** prompt once —

```
❓ TEST FRAMEWORK — Could not auto-detect from existing test files.
   Please confirm which framework this project uses:
     A) xUnit    B) NUnit    C) MSTest
     D) Jest     E) Jasmine  F) pytest
     G) unittest H) JUnit 5  I) TestNG
   Reply with the letter (e.g. A).
```

**3. Store in `dream-init-state.json`** — write once, never ask again:

```bash
node -e "
const fs=require('fs'),p='.claude/dream-init-state.json';
let s={};try{s=JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){}
s.test_framework='REPLACE_WITH_DETECTED_FRAMEWORK';
fs.writeFileSync(p,JSON.stringify(s,null,2));
console.log('Stored test_framework: ' + s.test_framework);
"
```

Use the stored value for all test generation in Step 4.

---

## Step 3d — Context budget guard (before code generation)

Count pending ACs from the tracker located in Step 3:

```bash
AC_COUNT=$(grep -c "⏳ Pending" "$TRACKER" 2>/dev/null || echo 1)
echo "AC_COUNT=$AC_COUNT"
```

> Write `.claude/active-task.json`: `{"skill":"icea-implement","step":"step4-start","ado":"{ADO_ID}","resume_cmd":"IMPLEMENT ADO-{ADO_ID}"}`

Write the file via Bash:
```bash
node -e "require('fs').writeFileSync('.claude/active-task.json', JSON.stringify({skill:'icea-implement',step:'step4-start',ado:'${ADO_ID}',resume_cmd:'IMPLEMENT ADO-'+String('${ADO_ID}')},null,2))"
```

Read $PLUGIN_DIR/skills/shared/context-budget-check.md and execute it with:
  operation_name    = "Code generation — {AC_COUNT} pending ACs / ADO #{ADO_ID}"
  size_signal       = $AC_COUNT
  size_label        = "{AC_COUNT} pending ACs"
  threshold_medium  = 10
  threshold_high    = 20
  recovery_command  = "IMPLEMENT ADO-{ADO_ID}{if Epic: ' Story-{N}'}"
  skip_keywords     = ["IMPLEMENT ADO-"]
  operation_needs   = [
    "Read ICEA, Tech Spec, and architecture docs from disk",
    "Generate implementation code for each pending AC across all layers",
    "Run the critic (Step 4a) and goal-loop (Step 4b) on the full output"
  ]
  risks_if_continue = [
    "Truncated code — missing layers or incomplete ACs",
    "Critic and goal-loop evaluate partial output — false pass"
  ]
  saved_context = "ICEA, Tech Spec, and tracker at docs/.../UserStory{ADO_ID}/ — nothing on disk is lost"

**On BUDGET_OK or BUDGET_SKIPPED** — proceed directly to Step 4. `active-task.json` is already written. No developer reply required.

> 📊 **STEP BOUNDARY — Step 4: Code generation**
> `active-task.json` written — safe to resume here after `/compact` or a new session.
> Proceeding to code generation for: {pending_ac_ids}

**⛔ BUDGET_WARN / BUDGET_STOP — HARD STOP. No override.**

Continuing will produce truncated code (partial ACs, missing layers, false critic pass).
There is no FORCE or CONTINUE option — the context window is a hard limit.

```
⛔ CONTEXT BUDGET — continuing will produce truncated code.

   Recover (context still warm — recommended):
     1. Run /compact
     2. Re-run: IMPLEMENT ADO-{ADO_ID}
        active-task.json is written — resumes at Step 4, skips Done ACs.

   Start fresh (cold context, maximum room):
     1. Open a new Claude Code session
     2. Run: IMPLEMENT ADO-{ADO_ID}
```
Do NOT proceed to Step 4 under any BUDGET_WARN or BUDGET_STOP condition. No escape hatch.

---

## Step 4 — Generate code

Generate implementation code for each pending AC in order.
Follow the Tech Spec exactly — do not deviate or invent.

**Tracker and audit — mark story as in progress:**

Locate the tracker and audit files:
```bash
TRACKER=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.tracker.md" 2>/dev/null | head -1)
AUDIT_FILE=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.ai-audit.md" 2>/dev/null | head -1)
```

Update the tracker — change the story/implementation section `**Status:** ⏳ Pending` to `**Status:** 🔄 In Progress`:
- For STORY type: find `## Implementation — ADO #{ADO_ID}` section
- For EPIC type: find `## Story {N} — ` section matching the story being implemented

Append to the audit file:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | impl-started | {Story N \| ADO #{ADO_ID}} | - | Implementing: {AC-Fx, AC-Fy, … \| full story scope} |
```

Get the ISO 8601 timestamp and actor once — reuse for all audit rows in this story:
```bash
TS=$(date '+%Y-%m-%dT%H:%M:%S')
ACTOR=$(node -e "const i=require('.claude/hooks/audit-append.cjs').resolveIdentity();console.log(i.verified_actor||i.os_user||'UNRESOLVED')" 2>/dev/null || echo "UNRESOLVED")
```

Initialise counters in context (reset at Step 4 start for this story):
`critic_revise_count = 0` · `build_issue_count = 0` · `follow_up_count = 0`

**Determine active layers from architecture docs, not assumption.**
Read `.claude/architecture/architecture.md` for the stack. If absent,
fall back to the `# Stack:` line in `CLAUDE.md`. Generate only layers
the project actually has.

**Per-project .NET generation/version (authoritative — do NOT rely on the coarse `name`).**
For a .NET target file, read `.claude/dream-init-state.json` → `generations.dotnet.versions[]`
and match the project the file belongs to (by `path`). Key generation on **that project's**
`generation` (a `dotnet-framework` project → Framework idioms; `dotnet-modern` → modern), NOT the
repo-level `name` — a mixed solution has both. Cap generated C# to the project's `tfm` LangVersion
(**net8→C# 12 · net9→C# 13 · net10→C# 14**); for a **multi-target** project use the LOWEST tfm
(lowest-common-denominator so it compiles on all targets). If the file's project is absent from
`versions[]` or its csproj mtime is newer than `generations_meta.detected_at`, re-parse that one
csproj for a fresh TFM rather than trusting the snapshot (best-effort freshness).

Generate in dependency order:

- **Persistence / data layer** — Dapper repository + parameterised SQL (.NET)
  · JPA entity/repository (Spring Boot) · ORM model + migration (Python)
  · TypeORM/Prisma (Node.js)
  **NEVER use EF Core** — always Dapper with parameterised SQL for .NET
- **Service / business layer** — backend language per stack
- **API / controller layer** — .NET controller · Spring @RestController ·
  FastAPI router / Django view / Flask blueprint · Express route
- **UI layer** (if project has a frontend) — Angular component + service,
  or the framework actually present
- **Unit tests — ICEA Examples as primary source (full gap analysis)**

  > **Hard rule — applies to ALL story types without exception:**
  > This gap analysis runs for SKILL.md-only stories, documentation-only stories, and
  > Markdown-only stories exactly as it runs for compiled-code stories. The gap signal
  > categories (return-shape-unspecified, test-data-unspecified, edge-case-missing,
  > mock-contract-missing, dependency-contract-missing) apply equally to manual scenario
  > tests. "No compiled test framework" is never a reason to skip this step — it is a
  > reason to check even more carefully, because manual tests have no compiler to catch
  > underspecified inputs. For non-compiled stories, "assertion" means "observable outcome
  > from a concrete manual invocation" — the concreteness requirement is identical.

  For every Example in the ICEA `## Examples` section, attempt to generate a real
  assertion using the framework detected in Step 3c. For SKILL.md-only or non-compiled
  stories, map each Example's input/output pair to a concrete manual scenario verification
  (specific input JSON or action → specific observable output or state). For compiled
  stories, map to the framework's assertion syntax:

  | Framework | Assertion syntax |
  |---|---|
  | xUnit | `Assert.Equal(expected, actual)` · `Assert.True(condition)` |
  | NUnit | `Assert.That(actual, Is.EqualTo(expected))` |
  | MSTest | `Assert.AreEqual(expected, actual)` |
  | Jest | `expect(actual).toBe(expected)` · `expect(actual).toEqual(expected)` |
  | pytest | `assert actual == expected` |
  | JUnit 5 | `assertEquals(expected, actual)` |

  One positive test per Example (the happy path). One negative test per Exception
  or error case described in the Examples section.

  **Gap analysis — run BEFORE generating any assertion:**

  For each Example, check all three conditions:
  1. **Concrete input:** the Example's input is a specific value, object, or state —
     not "some value", "valid data", or "a request".
  2. **Concrete output:** the expected result is a specific value, object shape, or
     side-effect — not "returns success", "completes correctly", or "works".
  3. **Dependency contract:** if the Example references a dependency
     (`IUserRepository.GetById`, `IEmailService.Send`, etc.), that dependency's
     return type and contract (what it returns on success/failure) appears in
     the ICEA `## Context` section.

  If all three conditions pass: generate the assertion. No TODO.

  If any condition fails: record a `GAP_FOUND` — do NOT emit a TODO, do NOT
  generate a partial assertion. Collect all gaps across all Examples before acting.

  **After processing all Examples — if any gaps were found:**

  This is an ICEA defect, not a test gap. Stop code generation entirely. Annotate
  the ICEA file (write immediately — tracking artefact, no Write Gate):

  ```markdown
  > ⚠ ICEA DEFECT — incomplete Examples flagged at IMPLEMENT time ({date}):
  > • Example {N}: {precise gap — e.g. "IUserRepository.GetById return contract
  >   not declared in Context; cannot assert repository interaction"}
  > • Example {N}: {precise gap — e.g. "expected output not concrete: 'returns success'"}
  > Run REVISE ADO-{ADO_ID} to resolve before implementation can proceed.
  ```

  Write one gap signal per gap found (best-effort — never blocks):

  ```bash
  PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
  # Category mapping — use the most specific category for each gap:
  #   Dependency referenced but contract not in Context → dependency-contract-missing
  #   Result described as "success/failure/works" without object shape → return-shape-unspecified
  #   No error/null/boundary Example despite method needing one → edge-case-missing
  #   Example references data object without defining its shape → test-data-unspecified
  #   Unit test needs a mock but interface not derivable from ICEA → mock-contract-missing
  [ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/signal-write.cjs" \
    --type gap \
    --category "{most-specific category from the mapping above}" \
    --ado-id "${ADO_ID}" \
    --detail "{brief description of this specific gap}" 2>/dev/null || true
  ```

  Then surface to the developer:

  ```
  ⛔ ICEA DEFECT — {N} Example(s) cannot produce real assertions.

  The ICEA's blast radius analysis is incomplete. Found gaps:
  • Example {N}: {gap}
  • Example {N}: {gap}

  These are ICEA defects, not test gaps. A well-specified Example always
  produces a real assertion — if it cannot, the feature was not fully modelled.

  Action: REVISE ADO-{ADO_ID}

  The ICEA has been annotated with the specific gaps above. After revision,
  re-run IMPLEMENT ADO-{ADO_ID} — the annotation will be cleared automatically
  once all gaps are resolved.
  ```

  Stop. Do not proceed to Step 4a until all gaps are resolved.

  **If all Examples produce real assertions:** generate the tests. TODOs are
  permitted ONLY when a dependency mock contract is genuinely absent from both the
  ICEA Context AND the codebase (a verifiable gap — not a framing issue). In that
  case emit one precisely-scoped TODO per gap:
  ```
  // TODO: mock contract for {Interface.Method} — not in ICEA Context and not
  // found in codebase. Raise with story author before running tests:
  // need: {what specific value/type it should return in this scenario}
  ```

- **Tech Spec test cases (supplementary)** — after the ICEA Example tests are
  generated, add any further tests from the `## Test Cases` section of the Tech
  Spec not already covered: integration tests, NFR tests, multi-AC scenario tests.
  These supplement the ICEA Example tests — they do not replace them.
- **PR description** — pre-filled with ICEA compliance checklist

Follow the active rule files for the languages in play
(`dotnet-rules` / `angular-rules` / `nodejs-rules` / `java-rules` / `python-rules`).

**Decision transparency** — for any complex or non-trivial design choice,
document the decision inline immediately before the relevant block:

```
// DECISION: <what is being decided>
// Options considered:
//   A) <option> — rejected: <reason>
//   B) <option> — rejected: <reason>
//   C) <chosen option> — chosen: <reason>
```

Apply when: selecting an algorithm, choosing a data structure, picking a
pattern, or making any architectural call not immediately obvious from the
surrounding code. Skip for trivial or self-evident choices.

If any Tech Spec section has a `[? — verify]` marker, stop and ask:
```
❓ Tech Spec `{section heading}` has an unresolved item: {item}
   Resolve this before implementation: REVISE ADO-{ADO_ID}
```

**Generate all code in context first — do not write anything to disk yet.**
The critic gate (Step 4a) runs before any disk write.

---

## Step 4a — Auto-critic (code gate)

After generating code in context but before any disk write, run the critic:

```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
Read $PLUGIN_DIR/skills/critic/SKILL.md and execute it with mode = code, source = internal.
```

The critic evaluates for ICEA + Tech Spec traceability, simplicity, rules
compliance, decision transparency, and hidden assumptions. Give it BOTH governing
specs located in Step 2 — the approved ICEA (intent) and the approved Tech Spec
(plan) — so it can check the three-way oracle ICEA → Tech Spec → code, not intent
alone. On an ICEA↔Tech-Spec conflict the ICEA wins and the critic routes to
`REVISE ADO-{ADO_ID}` (per critic CODE-mode precedence). This is Category C — the
ICEA and Tech Spec are docs/ artefacts, not source; no source files are read, only
the in-context generated code plus those two specs.

Gate the disk write on the verdict:

- **PASS** or **PASS WITH NOTES** → proceed to Step 5 (Write Gate).
  Carry any notes forward into the confirmation so they are visible.
- **REVISE** → do NOT write anything. Run the bounded regenerate-and-
  re-critique loop: up to 2 automatic retries, announcing each attempt
  (`🔁 Critic revision {N} of 2`), then surface to the developer with
  `ACCEPT AS-IS` / `GUIDE` / `HALT` if still failing after 2 retries.
  Only proceed to Step 5 on PASS / PASS WITH NOTES / explicit ACCEPT AS-IS.

Nothing reaches disk while verdict is REVISE.

**Audit logging and tracker follow-ups — code critic gate:**

For each REVISE verdict + fix attempt: increment `critic_revise_count`, then:
1. Append audit row:
   ```
   | {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | code-critic-revise | {Story N \| ADO #{ADO_ID}} | {critic_revise_count} | {one-line finding — e.g. "Missing null guard in GetById controller"} |
   ```
2. Increment `follow_up_count`. Append a Follow-ups row to the tracker under the correct story/implementation section:
   ```
   | {follow_up_count} | {issue — one line, root cause noted} | {fix applied — one line} | {file(s) changed} |
   ```

On PASS or PASS WITH NOTES, append audit row:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | code-critic-pass | {Story N \| ADO #{ADO_ID}} | {critic_revise_count} retries | Critic: {verdict} |
```

On ACCEPT AS-IS escalation (after ceiling), append audit row:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | code-critic-accept | {Story N \| ADO #{ADO_ID}} | {critic_revise_count} retries | Escalated after {critic_revise_count} retries — unmet ACs carried to Write Gate |
```

---

## Step 4b — AC self-scoring goal-loop (completeness gate)

Step 4a asks *is the code sound?* Step 4b asks *does the code satisfy every
Acceptance Criterion this story owns **and** realize every planned change in the
approved scope?* — the completeness counterpart to the critic's quality check. "Done"
depends on both **intent** (the ICEA ACs) and the **approved scope of change** (the
Tech Spec's planned deliverables); code that passes every AC but leaves a planned
file/change unbuilt is not done. It runs on the in-context code, still before any
disk write, and it **augments** 4a; it does not replace it.

Run the bounded goal-loop engine:

```
Read .claude/plugin-path.txt to get PLUGIN_DIR (if absent, use §1a resolver), then
Read $PLUGIN_DIR/skills/shared/goal-loop-spec.md and run the engine with:
  goal       = the ICEA Goal one-liner
  rubric     = the completion criteria for this story, each VERBATIM from its
               source, as one ordered list combining intent + approved scope:
                 • Intent — every pending AC from the ICEA Acceptance section /
                   tracker (id = AC-F*/AC-NF*, type = functional | non-functional)
                 • Approved scope of change — every planned deliverable in this
                   story's scope from the Tech Spec's AC Coverage Matrix (AC→File
                   table) + Files Changed section (id = the Tech Spec file/row ref,
                   type = structural). This makes "done" require every planned
                   change to be realized, not only that the ACs pass.
                 • Test suite expansion — one deferred criterion (id = test-suite-{STORY_N},
                   type = process): "The story's test plan suite shows status: generated
                   in the test-plan-state metadata block of the test plan file."
                   This criterion is checked post-write in Step 6a, not pre-write.
                   Score it as `deferred` in the goal-loop rubric — it does not block
                   the Write Gate (Step 5) but it DOES block marking the story Done
                   in Step 6. If Step 6a has not yet run, this criterion is unmet and
                   percentDone is < 100% for the story's completion record.
                   For SKILL.md-only stories: "verified by design" is never an
                   acceptable score — status: generated in metadata is the only pass.
  artifact   = the in-context generated code from Step 4
  regenerate = re-run Step 4 code generation addressing each `remaining`,
               then re-run Step 4a (critic) on the result
  ceilings   = { maxIterations: 3 }
```

> **Precedence (ICEA authoritative).** The ICEA is the ratified intent; the Tech Spec is
> the approved plan. A structural criterion that is genuine scope creep vs the ICEA (a
> planned change no AC justifies) is not a completion target — the Step 4a critic, sharing
> this same iteration, flags it as a traceability REVISE and routes to `REVISE ADO-{ADO_ID}`.
> The goal-loop scores completion of the plan; it never forces building scope the ICEA never
> asked for.

- The engine and the Step 4a critic share **one** iteration budget — one iteration
  is `regenerate → critic (4a) → self-score`. This keeps the ceiling meaningful and
  avoids nesting two bounded loops (goal-loop-spec §"Composing with the critic").
- The self-score is **Category C** — it reads only the in-context code and the
  rubric, never source from disk, and writes nothing (`rubric-score-schema.md`).
- **Goal met** (`percentDone == 100`, no blocking ACs) → proceed to Step 5.
- **Escalation** (ceiling or no progress) surfaces `ACCEPT AS-IS / GUIDE / HALT`
  per the engine. On `ACCEPT AS-IS`, the unmet ACs are carried into the Step 5
  WRITE PENDING prompt so partial completion is explicit at approval. On `HALT`,
  write nothing.

The loop never writes and never issues `APPROVE` — it stops AT the Write Gate.
Nothing reaches disk until Step 5.

**Audit logging — goal-loop:**

After each goal-loop iteration, append:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | goal-loop-iter | {Story N \| ADO #{ADO_ID}} | iter {N} of {max} | {percentDone}% — {unmet AC count} ACs remaining: {AC ids} |
```

On goal met (100%), append:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | goal-loop-complete | {Story N \| ADO #{ADO_ID}} | - | All ACs met — proceeding to Write Gate |
```

On escalation (ceiling or no progress), do NOT append a completion row — the ACCEPT AS-IS / HALT outcome is captured by Step 4a's escalation row and carried into the Write Gate prompt.

---

## Step 5 — Write Gate (source code only)

Present all files to be written:

```
📁 WRITE PENDING — reply APPROVE ADO-{ADO_ID} to write all files, or SKIP to discard.

  Implementation files:
  [1] {path/to/file}  — {one line description}
  [2] {path/to/file}  — {one line description}
  ...

  Test files:
  [N] {path/to/test}  — {AC reference} positive + negative cases
  ...

  {If Step 4b exited via ACCEPT AS-IS, list carried-forward unmet ACs so partial
   completion is explicit at approval:}
  ⚠ Unmet ACs at {percentDone}%: {AC-id — what remains}, …
```

Write only after receiving `APPROVE ADO-{ADO_ID}`.

**Boundary-crossing writes.** If any target file resolves to an absolute path **outside the repo
root** — e.g. a dependency repo in `additionalDirectories` that the Tech Spec's file-change table
named (multi-root graph; see `$PLUGIN_DIR/skills/shared/multi-root-scan.md`) — that file requires
its **own** confirmation and is **NOT** covered by `APPROVE ALL ADO-{ID}`. Precede such a file's
entry with `⚠ WRITE CROSSES REPO BOUNDARY — {path} is outside this repo (dependency: {dep root}).`
and stop for an explicit `APPROVE ADO-{ADO_ID}` on it, per CLAUDE.md §0 and
`$PLUGIN_DIR/skills/shared/write-gate-spec.md` § Boundary-crossing writes.

After all files are written to disk, immediately write the step6 checkpoint — before any Step 6 work begins. If the session is compacted after this point, `IMPLEMENT ADO-{ADO_ID}` resumes directly at Step 6 without re-running code generation or re-triggering the Write Gate:

```bash
node -e "require('fs').writeFileSync('.claude/active-task.json', JSON.stringify({skill:'icea-implement',step:'step6-start',ado:'${ADO_ID}',story_n:'${STORY_N:-}',resume_cmd:'IMPLEMENT ADO-${ADO_ID}'},null,2))"
```

---

## Step 6 — Update tracker

**Write implementation signal (best-effort — never blocks):**

After files are written, record that implementation happened for this ADO. This feeds
Dream's pattern learning — even if the category is generic, it confirms implementation
activity against this ADO:

```bash
PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
[ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/signal-write.cjs" \
  --type revision \
  --category scope-changed \
  --ado-id "${ADO_ID}" \
  --detail "Story ${STORY_N:-main} source/config files written via icea-implement" \
  2>/dev/null || true
```

After writing, update the tracker immediately (no gate — tracking artefact):
- AC rows: `⏳ Pending` → `✅ Done`
- Update `Last Updated` date
- If all ACs are done, write `Status: COMPLETE` to the ICEA file

**Populate the tracker's implementation section (no gate — tracking artefact):**

> **On resume from `step6-start` checkpoint:** Re-read written source and test files from disk — they are already on disk from the prior Write Gate. Use these files to derive Delivered, Tests added, and Design decisions content. All section population is idempotent — re-derive and overwrite placeholder or partial content with freshly derived values.

Find the correct section in the tracker:
- STORY type → `## Implementation — ADO #{ADO_ID}`
- EPIC type → `## Story {N} — {title}`

Update each sub-section in place:

**1. Status:** `🔄 In Progress` → `✅ Done`

**2. Delivered** — replace the placeholder with a bullet per module/file cluster written. One bullet per layer. Be specific — name the component/class/file and its purpose:
```
- `{layer}`: `{ClassName}` — {one-line purpose} (`{primary/file/path}`)
- `{layer}`: `{ServiceName}` — {one-line purpose} (`{primary/file/path}`)
```

**3. Tests added** — replace the placeholder with one line per spec file:
```
- `{spec-file.spec.ts}` — {N} cases: {brief scope, e.g. "AC-F1 positive/negative, AC-F2 edge cases"}
```

**4. Design decisions** — extract each `// DECISION:` block from the written code and format as:
```
- **{decision topic}:** {chosen option} — {reason in one line}. Rejected: {alternatives}.
```
If no `// DECISION:` blocks were written: _(no non-trivial design choices in this story)_

**5. Known gaps** — list any deferred items, partially-met ACs, or ACCEPT AS-IS outcomes carried from Step 4b. If the story was fully met with no deferrals:
```
_(none — all ACs fully met)_
```

**6. Generate lessons learned section:**

Read the audit trail rows for this story (from `impl-started` to `story-complete`). Group revision rows by phase and count:

| Phase | Audit events to count |
|---|---|
| Plan | `plan-revised` |
| ICEA | `icea-revised` · `icea-critic-revise` |
| Tech Spec | `tech-revised` · `tech-critic-revise` |
| Code | `code-critic-revise` |
| Build | `build-issue` |

**Rule:** Only generate a lesson for a phase with ≥ 2 events OR ≥ 2 follow-up rows. A single event is noise.

For qualifying phases, read the Summary column of each revision row to extract what changed, group by theme, and generate a specific actionable "next time" item.

Append to the tracker story/implementation section:

```markdown
### Lessons learned

**Revision summary**
| Phase | Count | Dominant themes (from audit summaries) |
|---|---|---|
| {phase} | {N} | {theme × count · theme × count} |

**Root cause analysis**
{2–3 sentences synthesising what drove the revisions and follow-ups. Be specific —
name the gap (e.g. "Azure AD policy not identified before ICEA") not the category
(e.g. "auth issues"). Cross-reference Follow-ups table root causes.}

**What to do differently next time**
- [ ] {specific actionable item — e.g. "Ask for Azure AD policy name before drafting ICEA for any story touching auth"}
- [ ] {specific actionable item}
```

If all phases had ≤ 1 event and ≤ 1 follow-up:
```markdown
### Lessons learned
_(Clean delivery — no recurring patterns identified in this story)_
```

**Audit logging — story complete:**
```bash
AUDIT_FILE=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.ai-audit.md" 2>/dev/null | head -1)
```
Append:
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | implementation | story-complete | {Story N \| ADO #{ADO_ID}} | {critic_revise_count} critic retries · {follow_up_count} follow-ups | ACs written: {AC-F1, AC-F2, …} |
```

Confirm:
```
✅ Implementation written — ADO #{ADO_ID}
   {list of ACs marked ✅ Done}

   Tracker updated: {tracker path}

   If bugs are found during testing, log them:
   BUG ADO-{ADO_ID} — {description}

   {If EPIC_AUTO_FLOW = true AND more stories remain:}
   Display:
     ▶ Story {story_n} complete. Advancing to Story {next_story_n} of {total_stories}.
       Reply PAUSE to stop here. Resume: IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}

   If developer replies PAUSE:
     ⏸ Epic paused after Story {story_n}.
        Story {story_n}: ✅ Done
        Story {next_story_n}: ⏳ Pending
        Resume: IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}
     Stop. Do not start Story {next_story_n}.

   If no PAUSE reply:
     Proceed to IMPLEMENT ADO-{ADO_ID} Story-{next_story_n} (loop back to Step 3).

   {If EPIC_AUTO_FLOW = false (explicit Story-N targeted):}
   Display:
     ✅ Story {story_n} complete.
        Next: IMPLEMENT ADO-{ADO_ID} Story-{next_story_n}
   Stop. Do not auto-advance.

   {If all ACs done:}
   All ACs complete. ICEA marked COMPLETE.
```

> Write `.claude/active-task.json`: `{}` — clears the active step; hook exits 0 on next unrelated message.

Then run Step 6a (test suite expansion) before the pre-commit gate.

---

## Step 6a — Test suite expansion (mandatory post-write — NEVER skip)

Write the step6a checkpoint immediately — before any test plan operation. If the session is compacted after Step 6 completes, `IMPLEMENT ADO-{ADO_ID}` resumes here, skipping the already-complete tracker update:

```bash
node -e "require('fs').writeFileSync('.claude/active-task.json', JSON.stringify({skill:'icea-implement',step:'step6a-start',ado:'${ADO_ID}',story_n:'${STORY_N:-}',resume_cmd:'IMPLEMENT ADO-${ADO_ID}'},null,2))"
```

The test plan skeleton was generated at SAVE TECH (icea-feature Step 10b). Each story's suite is
a stub until this step runs. This step runs post-write, after the tracker is updated, before
checkin. It is mandatory for ALL story types without exception — including SKILL.md-only stories,
documentation-only stories, and stories with no compiled test framework. "Verified by design" is
never an acceptable substitute for an expanded test suite.

**1. Locate the test plan file:**
```bash
TEST_PLAN=$(find docs -path "*UserStory${ADO_ID}*" \
  -name "ADO-${ADO_ID}-*.test-plan.md" 2>/dev/null | head -1)
echo "TEST_PLAN=${TEST_PLAN:-NOT_FOUND}"
```

**2. If NOT_FOUND:**

First check whether the approval used `--skip-test-gate` (spike or prototype):
```bash
AUDIT_FILE=$(find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.ai-audit.md" 2>/dev/null | head -1)
SKIP_GATE=$([ -n "$AUDIT_FILE" ] && grep -c "gate.test-plan-skip" "$AUDIT_FILE" 2>/dev/null || echo "0")
```

**If `SKIP_GATE > 0`** (approval deliberately bypassed test gate — spike/prototype):
```
⚠ No test plan found for ADO #{ADO_ID}.
  Note: test-gate was bypassed at approval (spike/prototype — audit entry exists).
  Proceeding without test plan. Run SAVE TEST ADO-{ADO_ID} when ready.
```
Append audit row and continue to Step 7:
```
| {next #} | {TS} | {actor} | implementation | test-plan-skipped | Story {N} | ADO #{ADO_ID} | - | No test plan — skip-test-gate bypass recorded at approval |
```

**If `SKIP_GATE = 0`** — Auto-generate (full mode parity with lightweight):
Display: `⚠ No test plan found for ADO #{ADO_ID} — generating now.`

Execute:
```
Read $PLUGIN_DIR/skills/test-plan/SKILL.md and run:
  SAVE TEST ADO-{ADO_ID} --subagent
```

On success:
```bash
rm -f ".claude/signals/test-plan-stale-ADO-${ADO_ID}.json"
```
Display: `✅ Test plan generated — continuing.`
Append audit row and continue to Step 7:
```
| {next #} | {TS} | {actor} | implementation | test-plan-generated | Story {N} | ADO #{ADO_ID} | - | Auto-generated test plan (none existed at implementation time) |
```

On failure (non-zero exit or error from test-plan skill):
```
⛔ Test plan generation failed for ADO #{ADO_ID}.
   Run manually: SAVE TEST ADO-{ADO_ID}
   Then re-run: IMPLEMENT ADO-{ADO_ID} Story-{N}
```
Append audit row and stop:
```
| {next #} | {TS} | {actor} | implementation | test-plan-gen-failed | Story {N} | ADO #{ADO_ID} | - | BLOCKED — test plan auto-generation failed; run SAVE TEST ADO-{ADO_ID} |
```

**Lightweight mode — auto-generate after code write instead of blocking:**

In lightweight mode (`GOVERNANCE=lightweight`), when `TEST_PLAN=NOT_FOUND`, generate the
test plan automatically now (after code has been written) rather than blocking:
```
Read $PLUGIN_DIR/skills/test-plan/SKILL.md and execute:
  SAVE TEST ADO-{ADO_ID} --subagent
```
The skill auto-detects `--source plan` from the plan file on disk and generates a
Plan Verification suite from Must Have items. After generation:
```bash
rm -f ".claude/signals/test-plan-stale-ADO-${ADO_ID}.json"
```
Confirm: `✅ Test plan generated from plan — developer can now use it to verify the implementation.`
Then continue to Step 7.

**3. If found:** Check whether the test plan is stale (ICEA, Tech Spec, or Plan was revised after generation):

```bash
test -f ".claude/signals/test-plan-stale-ADO-${ADO_ID}.json" \
  && echo "TEST_PLAN_STALE" || echo "TEST_PLAN_CURRENT"
```

**If `TEST_PLAN_STALE`:** Auto-refresh before expanding stubs — no developer prompt needed:
```
Read $PLUGIN_DIR/skills/test-plan/SKILL.md and execute with:
  REFRESH TEST ADO-{ADO_ID}
```
After refresh:
```bash
rm -f ".claude/signals/test-plan-stale-ADO-${ADO_ID}.json"
```
Continue with the freshly refreshed test plan.

**If `TEST_PLAN_CURRENT`:** Read the `<!-- test-plan-state` metadata block at the top of the file.
Find the entry where `id: Story-{STORY_N}` matches the story just implemented. Extract the
`suite` value and the `status` value.

**If `status: stub`** — expand now in subagent mode (no prompts, no budget warning):
```
Read $PLUGIN_DIR/skills/test-plan/SKILL.md and execute it with:
  EXPAND TEST ADO-{ADO_ID} {suite} --subagent
```
After expansion succeeds:
- Update the metadata entry in the test plan file: `status: stub` → `status: generated`
- Append audit row:
  ```
  | {next #} | {TS} | {actor} | implementation | test-suite-expanded | Story {N} | ADO #{ADO_ID} | - | {suite} expanded — {TC count} TCs written |
  ```

**If `status: generated`** — already expanded from a prior run (idempotent — safe to check every
time). Append audit row:
```
| {next #} | {TS} | {actor} | implementation | test-suite-already-expanded | Story {N} | ADO #{ADO_ID} | - | {suite} already generated — skipped |
```

**Hard rules for this step:**
- NEVER skip this step — not for SKILL.md-only stories, not for documentation-only stories,
  not under APPROVE ALL ADO-{ID}, not under time pressure, not when context is low
- NEVER treat "verified by design" as expanded TCs — it is not
- NEVER require developer interaction — `--subagent` flag suppresses all prompts; runs silently
- The `status` field in the metadata block is machine-readable — no LLM judgment required;
  `stub` means expand, `generated` means skip
- This step closes the goal-loop's deferred `test-suite-{STORY_N}` criterion — the story is
  not 100% done until this step appends a `test-suite-expanded` or `test-suite-already-expanded`
  audit row

---

## Step 7 — Post-write gate: bounded fix loop

Write the step7 checkpoint immediately — before the fix loop begins. If the session is compacted after Step 6a completes, `IMPLEMENT ADO-{ADO_ID}` resumes here, skipping Steps 5–6a:

```bash
node -e "require('fs').writeFileSync('.claude/active-task.json', JSON.stringify({skill:'icea-implement',step:'step7-start',ado:'${ADO_ID}',story_n:'${STORY_N:-}',resume_cmd:'IMPLEMENT ADO-${ADO_ID}'},null,2))"
```

Ceiling: 3 cycles per loop invocation. Each invocation (initial or Option A guided) gets a fresh 3-cycle budget.

**Step 7.0 — Detect test command (once, before loop):**
```bash
TEST_CMD=""
TEST_CMD=$(node -e "try{const s=JSON.parse(require('fs').readFileSync('.claude/dream-init-state.json','utf8'));process.stdout.write(s.test_command||'')}catch(e){}" 2>/dev/null)
if [ -z "$TEST_CMD" ]; then
  TEST_CMD=$(node -e "try{const p=JSON.parse(require('fs').readFileSync('package.json','utf8'));process.stdout.write(p.scripts&&p.scripts.test||'')}catch(e){}" 2>/dev/null)
fi
if [ -z "$TEST_CMD" ]; then
  echo "⚠ No test command found — fix loop runs checkin only."
fi
```

**Step 7.1 — Stage the written set:**
```bash
git add {file_1} {file_2} ... {test_files}   # exact Write-Gate set — never git add -A
```

**Step 7.2 — Fix loop (up to 3 cycles):**

For each cycle N (1, 2, 3):

1. Run checkin:
   ```
   Read $PLUGIN_DIR/skills/checkin/SKILL.md and execute against the staged set.
   ```

2. Run test suite (if TEST_CMD non-empty):
   ```bash
   $TEST_CMD 2>&1   # capture exit code and output
   ```

3. **If checkin ✅/⚠ AND (test suite passes OR TEST_CMD empty):**
   Loop exits clean. Append audit row and proceed to story summary:
   ```
   | {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | build | checkin-pass | {Story N \| ADO #{ADO_ID}} | {fix_count} fixes applied | checkin: ✅ |
   ```

4. **If any failure:**
   Display: `🔁 Fix cycle {N}: {category} at {file}:{line} — fixing`
   Apply targeted fix. Re-stage fixed file: `git add {file}`
   Append audit row:
   ```
   | {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | build | build-issue | {Story N \| ADO #{ADO_ID}} | {N} | {category}: {one-line description} at {file}:{line} |
   ```
   Append tracker Follow-ups row (under correct story/implementation section):
   ```
   | {follow_up_count} | {issue at file:line — root cause one line} | {fix applied one line} | {file} |
   ```
   Continue to next cycle.

**Step 7.3 — On ceiling-hit (cycle 3 failed):**

**7.3a — Write gap signal (best-effort, before diagnostic — exits 0 always):**
```bash
PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
[ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/signal-write.cjs" \
  --type gap \
  --category "{most-specific: dependency-contract-missing|return-shape-unspecified|edge-case-missing|test-data-unspecified|mock-contract-missing}" \
  --ado-id "${ADO_ID}" \
  --detail "Fix loop ceiling: {specific unresolvable contract/value} after 3 cycles" \
  2>/dev/null || true
```

**7.3b — Append audit row:**
```
| {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | build | fix-loop-ceiling | {Story N \| ADO #{ADO_ID}} | 3 | {category} at {file}:{line} — ceiling hit; gap signal written |
```

**7.3c — Surface diagnostic:**
```
⛔ FIX LOOP CEILING — 3 cycles completed, issue not resolved.

FAILING FINDING
  Category : {e.g. null reference / assertion mismatch / missing return}
  File     : {exact/path/to/file.ext}:{line_number}
  Error    : {verbatim error text — not paraphrased}

WHAT WAS TRIED
  Cycle 1: Changed {what} at {file}:{line} → still failed: {exact error after change}
  Cycle 2: Changed {what} at {file}:{line} → still failed: {exact error after change}
  Cycle 3: Changed {what} at {file}:{line} → still failed: {exact error after change}

ROOT CAUSE ASSESSMENT
  {1–2 sentences on the underlying blocker the fix loop cannot resolve alone}

YOUR OPTIONS
  A) Provide guidance — reply with the correct fix, e.g.:
       "The mock for IFoo.Bar should return: new FooDto { Id = 1, Name = 'test' }"
       A new 3-cycle loop will run with your guidance applied.

  B) Revise the ICEA — the spec is missing information needed to fix this:
       REVISE ADO-{ADO_ID}

  C) Halt — stop this story. Prior stories in this Epic are unaffected:
       HALT ADO-{ADO_ID}
```

**Step 7.4 — On developer reply:**

**Option A — Guidance provided:**
Start a new 3-cycle loop (fresh ceiling, cycle count resets to 1):
- Apply guidance to the identified file+line
- Run Step 7.2 loop with guidance as directive for each cycle
- Each cycle: display `🔁 Guided cycle {N}: ...`; append build-issue + Follow-ups rows as normal
- On clean pass: story summary + auto-advance (if EPIC_AUTO_FLOW = true)
- On second ceiling: surface new diagnostic with GUIDANCE APPLIED section:
  ```
  GUIDANCE APPLIED
    Your instruction: "{developer_guidance_text}"
    Applied at: {file}:{line}

  WHAT HAPPENED UNDER GUIDANCE
    Guided cycle 1: {what changed} → still failed: {exact error}
    Guided cycle 2: {what changed} → still failed: {exact error}
    Guided cycle 3: {what changed} → still failed: {exact error}

  UPDATED ASSESSMENT
    {updated 1–2 sentence root cause incorporating what was tried under guidance}

  YOUR OPTIONS
    A) Refine guidance — {specific gap that still cannot be resolved without more info}
    B) REVISE ADO-{ADO_ID}
    C) HALT ADO-{ADO_ID}
  ```

**Option B — REVISE ADO-{ADO_ID}:**
1. Set tracker Story status to `🔄 Revised`:
   Find the correct story section → change `**Status:** ✅ Done` or `**Status:** 🔄 In Progress` → `**Status:** 🔄 Revised`
2. Append audit row:
   ```
   | {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | build | fix-loop-revise | {Story N \| ADO #{ADO_ID}} | - | Tracker set to Revised; icea-revise initiated with diagnostic context |
   ```
3. Run REVISE ADO-{ADO_ID} — pass ceiling diagnostic (specific gap, what was tried) as input context.

**Option C — HALT ADO-{ADO_ID}:**
1. Append audit row:
   ```
   | {next #} | {YYYY-MM-DDTHH:MM:SS} | {actor} | build | fix-loop-halt | {Story N \| ADO #{ADO_ID}} | - | Developer halted — Story {story_n} left on disk unresolved |
   ```
2. Display:
   ```
   Story {story_n} halted. Prior stories in this Epic are unaffected.
   To resume: IMPLEMENT ADO-{ADO_ID} Story-{story_n}
   ```
3. Stop. Do not auto-advance.

**Hard rules for Step 7:**
- NEVER skip the fix loop — not under APPROVE ALL, not under time pressure
- NEVER auto-commit — checkin suggests the git command; the developer runs it
- NEVER proceed to story summary while any failure remains (checkin ❌ or test suite ❌)
- ALWAYS write the gap signal before surfacing the ceiling diagnostic — never after
- ALWAYS show exact file+line in every fix cycle display and audit row

---

## Hard Rules

- ALWAYS update the tracker story/implementation section Status to `🔄 In Progress` at Step 4 start — before any code generation
- ALWAYS append the `impl-started` audit row at Step 4 start
- ALWAYS append `code-critic-revise` audit rows and tracker Follow-ups for every critic REVISE+fix cycle in Step 4a
- ALWAYS append `goal-loop-iter` audit rows for every goal-loop iteration in Step 4b
- ALWAYS populate tracker Delivered, Tests added, Design decisions, and Known gaps sections at Step 6 — never leave them as placeholders after implementation
- ALWAYS run the Step 4 Example gap analysis for every story type — SKILL.md-only, documentation-only, and Markdown-only stories are NOT exempt; "no compiled code" never skips gap analysis
- ALWAYS write a gap signal via signal-write.cjs for every Example that fails the gap analysis — even for SKILL.md stories; gap categories apply equally to manual scenario tests
- ALWAYS run Step 6a (test suite expansion) after Step 6 for every story — SKILL.md-only stories are NOT exempt; "verified by design" is never an acceptable substitute for status: generated in the test-plan-state metadata
- ALWAYS update the tracker story/implementation section Status to `✅ Done` at Step 6
- ALWAYS append the `story-complete` audit row at Step 6
- ALWAYS append `build-issue`, Follow-ups tracker row, and `build-fixed` audit rows for each checkin ❌ FAIL + fix cycle in Step 7
- ALWAYS append `checkin-pass` audit row when checkin ✅ / ⚠ in Step 7
- NEVER leave Follow-ups table empty after a REVISE cycle or build failure — every rework leaves a row
- ALWAYS offer the test-plan skill after checkin passes — do not silently skip it (AC-F50)
- Mid-story context exhaustion (after CONTINUE is allowed in) produces REWORK, not corruption — the tracker is the implicit checkpoint (✅ Done ACs are skipped on re-run; ⏳ Pending ACs regenerate cleanly). Per-AC temp writes (`temp/ADO-{ID}-AC-{N}.draft.md`) would reduce rework to one AC but are deferred as a follow-up — do not implement inline.
- ALWAYS check `active-task.json` for a non-`step4-start` checkpoint at Step 1 after resolving the ADO ID — if found, jump directly to the declared step; never re-run code generation or re-trigger the Write Gate on resume
- ALWAYS write the `step6-start` checkpoint after files land on disk (Step 5 exit) — before any Step 6 tracker update begins; this is the only guarantee that a mid-Step-6 compact does not cause IMPLEMENT to skip Step 6 silently
- ALWAYS write the `step6a-start` checkpoint at Step 6a entry and the `step7-start` checkpoint at Step 7 entry — every step boundary must have its own checkpoint or compact at that boundary produces silent data loss

---

## Step 8 — Offer test plan generation

After checkin passes (Step 7 ✅ or ⚠), invoke the test-plan skill:

```
Read $PLUGIN_DIR/skills/test-plan/SKILL.md and execute Steps 1–2 for this ADO ID
with --source icea. The developer prompt (Step 2) is shown — if the developer
replies N, exit cleanly without blocking story closure.
```

This step is **non-blocking**: if the developer declines or the skill errors, log
a warning and stop — story closure is not gated on test plan generation.
- NEVER populate Delivered or Tests sections before the Write Gate — only write them after APPROVE and the code is on disk
