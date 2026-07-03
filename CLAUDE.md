# CLAUDE.md — Project Intelligence File
# Stack: <set per repo — e.g. ".NET 8 / C# · Angular 17+ · Node.js · Azure DevOps">
#        dream-init / architect populate this from the detected repo type.
#        Supported backends: .NET Core · ASP.NET Framework 4.x · Java/Spring Boot · Python (FastAPI/Django/Flask) · Node.js
#        Supported frontends: Angular · React. Tracking: Azure DevOps.
# Last updated: keep this file updated when conventions change
# Plugin version: 3.0.0 (update this line after dream-init or plugin upgrade)

---

## 0. WRITE GATE — Applies to source code and config files only

**Source code and config files are never written to disk until the developer
replies `APPROVE ADO-{ID}`. ICEA documents, Tech Specs, Epic docs, Trackers,
and memory/ follow the draft-then-save flow below — not the APPROVE gate.**

| Artefact | When written |
|---|---|
| `temp/ADO-{ID}-icea.md` | On SAVE PLAN — draft rendering aid, deleted on SAVE ICEA |
| `temp/ADO-{ID}-tech.md` | On SAVE ICEA — draft rendering aid, deleted on SAVE TECH |
| `*.plan.md` | On SAVE PLAN ADO-{ID} |
| `*.icea.md` | On SAVE ICEA ADO-{ID} — after plan saved and ICEA reviewed in temp/ |
| `*.techspec.md` | On SAVE TECH ADO-{ID} — after ICEA saved and Tech Spec reviewed in temp/ |
| `*.epic.md` | On SAVE TECH ADO-{ID} — derived, no interaction |
| `*.tracker.md` | On SAVE TECH ADO-{ID} — derived, no interaction |
| `memory/` | Automatic on trigger — no gate (Dream pipeline) |
| Source code, config files | Blocked until `APPROVE ADO-{ID}` |

**Pre-plan gate — enforced before any ICEA work begins:**
ICEA drafting is BLOCKED until the plan is saved via `SAVE PLAN ADO-{ID}`.
Do NOT draft or output ICEA content before this — not inline, not to temp/.
Sequence is strictly: Plan → `SAVE PLAN` → ICEA draft → `SAVE ICEA` → Tech Spec → `SAVE TECH`.

When a skill would normally write source code or config files it MUST instead:
1. Show the changes using the following format:
   - **Modifications to existing files:** show a unified diff (changed lines + 3 lines of surrounding context). Never re-output unchanged lines.
   - **New files:** show the full intended content.
2. Show the target file path
3. Display this prompt and stop:

```
📁 WRITE PENDING — reply APPROVE ADO-{ID} to write, or SKIP to discard.
   Path: {full/file/path}
```

Only after receiving `APPROVE ADO-{ID}` may source code or config files be
written. Partial responses do not count. For multiple files, all paths are
listed in a single prompt.

No exceptions for source code and config files. This gate applies even when:
- An ICEA has been approved
- The critic has passed
- A previous step already confirmed the approach
- The developer seems impatient or in a hurry

---

## 0a. Keyword Handlers — recognised in any session, any message

Claude recognises the following patterns globally. No /command needed.
ADO ID is case-insensitive: ADO-1847, ADO #1847, and 1847 all work.

| Pattern | Action |
|---|---|
| `SAVE PLAN ADO-{ID}` | Write plan to disk → write ICEA draft to `temp/ADO-{ID}-icea.md` → tell developer to open in VS Code preview |
| `SAVE PLAN ADO-{ID} CONFIRM` | Save plan with open questions — bypass warning |
| `SAVE ICEA ADO-{ID}` | Copy `temp/ADO-{ID}-icea.md` to permanent docs/ → delete temp → write Tech Spec to `temp/ADO-{ID}-tech.md` |
| `SAVE TECH ADO-{ID}` | Write Tech Spec to disk (warn if open questions remain) |
| `SAVE TECH ADO-{ID} CONFIRM` | Write Tech Spec with open questions — bypass warning |
| `PLAN ADO-{ID}` | Draft ICEA from saved plan — cross-session recovery |
| `ICEA ADO-{ID}` | Draft Tech Spec from saved ICEA — cross-session recovery |
| `TECH ADO-{ID}` | Draft Tech Spec from saved ICEA — cross-session recovery |
| `APPROVE ADO-{ID}` | Run icea-approve skill for that ADO ID |
| `APPROVE ADO-{ID} Story-{N}` | Run icea-approve skill for that story |
| `IMPLEMENT ADO-{ID}` | Run icea-implement skill for that ADO ID |
| `IMPLEMENT ADO-{ID} Story-{N}` | Run icea-implement skill for that story |
| `REVISE ADO-{ID}` | Run icea-revise skill for that ADO ID |
| `STATUS ADO-{ID}` | Run icea-status skill for that ADO ID |
| `BUG ADO-{ID} — {description}` | Log bug entry to tracker for that ADO ID |

These handlers take priority over general conversation.
If the pattern is recognised, execute the skill immediately.

---

## 0b. Shell & Git Configuration

- Always use `{GIT_PATH}` for all git commands
- Always use `{BASH_PATH}` as the shell when executing commands
- Never rely on `HEAD` as a symbolic ref — resolve first with `git rev-parse HEAD` and use the resulting SHA
- Never use `mcp__ide__executeCode` to run git or shell commands — use the Bash tool only
- For git operations, always use the Bash tool directly, never Python subprocess via the IDE tool

> Paths above are detected and written by `/dream-init`. If they show
> `{GIT_PATH}` or `{BASH_PATH}`, run `/dream-sync` to resolve them.

---

## 1. PROJECT OVERVIEW

This project uses a distributed team with PM, Developers, and QA in separate roles.
All feature work is driven by ICEA documents (Intent · Context · Examples · Acceptance).
No ticket moves to Active in Azure DevOps without an approved ICEA.
ICEA files are saved to `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-{feature}.icea.md` after approval.

---

## 2. AZURE DEVOPS

> These values are the per-project runtime source of truth — skills read
> Organization/Project from this section at execution time. Their **defaults**
> come from the plugin's single identity file `.claude-plugin/config.json`
> (`organization`, `project`, `adoBaseUrl`); `dream-init` seeds this section from
> it. To change the org/project/company across the whole plugin, edit
> `.claude-plugin/config.json` and run `scripts/sync-config.sh` — do not edit
> scattered copies. See DEVELOPER-GUIDE.md > Rebranding / forking.

- Organization  : {ADO_ORG}
- Project       : {ADO_PROJECT}
- Repository    : [set per project — update this line after dream-init]
- ADO URL       : {ADO_URL}
- PAT storage   : Option A — Windows User Environment Variables → AZURE_DEVOPS_PAT (recommended)
                : Option B — .claude/settings.json → env.AZURE_DEVOPS_PAT (only if gitignored)
- Target branch : dev
- Branch naming : feature/ADO-[ID]-short-description
- Commit format : [ADO-ID] Short description of change
- PR title      : [ADO-ID] Feature name — brief summary

---

## 3. DESIGN PHILOSOPHY

**Simplicity first.** Do not over-complicate. Prefer the simplest solution that correctly solves the problem. If a simpler approach exists, take it — even if it means writing more lines. Complexity that cannot be justified by a concrete requirement is a defect.

- **Readability** — optimise for the reader, not the writer
- **Maintainability** — explicit and self-contained over clever abstractions
- **Testability** — no hidden side effects, no global state, no deep coupling
- **Do not assume** — if a requirement, instruction, or expected behaviour is vague, ambiguous, or complex enough to support more than one reasonable interpretation, stop and ask. Never guess and proceed. A wrong assumption costs more to unwind than the question costs to ask.
- **Decision transparency** — for any complex logic or non-trivial design choice, document the decision inline before the implementation. List all options considered, explain why each alternative was rejected, and state why the chosen approach was selected. Format:
  ```
  // DECISION: <what is being decided>
  // Options considered:
  //   A) <option> — rejected: <reason>
  //   B) <option> — chosen: <reason>
  ```
  Apply when choosing between viable approaches, selecting a data structure, picking an algorithm, or making an architectural call that is not immediately obvious. Skip for trivial choices. Goal: the next developer understands **why**, not just **what**.

---

## 4. MODEL ROUTING

Skills route to different models based on task type. Override via `.claude/settings.json`.

| Variable | Default | Used by |
|---|---|---|
| `ICEA_MODEL` | `claude-opus-4-6` | icea-feature, ado-tasks, pr-describe, product-docs |
| `REVIEW_MODEL` | `claude-sonnet-4-6` | icea-review, code-review, security, pr-spec-review |
| `CRITIC_MODEL` | falls back to `REVIEW_MODEL` | critic (auto-runs in icea-feature; also `/critic`) |
| `INFRA_MODEL`  | `claude-sonnet-4-6` | dream, architect, dream-status, dream-rollback, sprint-metrics, token-analysis, session-start, update-arch, checkin, explain, fix, prod-readiness |

To override for this project, add to `.claude/settings.json`:
```json
{
  "env": {
    "ICEA_MODEL":   "claude-opus-4-6",
    "REVIEW_MODEL": "claude-sonnet-4-6",
    "INFRA_MODEL":  "claude-sonnet-4-6"
  }
}
```

If a variable is not set the skill uses its hardcoded default — no action needed
unless you want to change the routing.

---

# Dream

## Auto-Capture

Write an entry to `memory/MEMORY.md` whenever one of these triggers fires:

| Trigger               | What to capture                                      |
|-----------------------|------------------------------------------------------|
| Plan approved         | Approach agreed, tools chosen, constraints set       |
| Task completed        | Pattern that worked, convention confirmed            |
| Error resolved        | Error + root cause + fix + gotcha to avoid repeating |
| Approach abandoned    | What failed, why, what not to retry                  |
| Architecture decision | Decision + rationale + alternatives rejected         |

Format for auto-capture entries:
```
### [auto] YYYY-MM-DD — <topic>
<what to remember>
Trigger: <which trigger fired>
Source: auto-capture
```

## Rules

- Run `/dream` every 5–8 sessions to consolidate memory
- Run `/dream-health` to see confidence scores and decay dashboard
- Max entries promoted to this file: **20** — demote stale entries to topic files
- `memory/topic-*.md` holds detail; this file holds only promoted, high-confidence facts
- `memory/health.html` is generated — do not commit it (add to `.gitignore`)


---

## Data Access Convention

Always use **Dapper with parameterised SQL** for all database access.
Never use EF Core or any ORM that generates SQL automatically.
This applies to all new code and any code generated by skills.

---

## Feature Gate

NEVER write implementation code for a new feature or capability without
an approved ICEA document on disk with `Status: ✅ Approved`:

```
docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-*.icea.md
```

The folder is always `UserStory{ID}` regardless of whether the ICEA is a
STORY or EPIC — the type is recorded inside the ICEA's Story Breakdown section.

If asked to implement something new and no approved ICEA exists:
1. Say so explicitly
2. Run `/ai-assisted-development:icea-feature`
3. Do not proceed until `APPROVE ADO-{ID}` is received

This is an output-gated constraint — orientation, questions, and reading
architecture docs are always permitted. The constraint is on generating
implementation code only.

Override: `/skip-icea` warns once then proceeds. Not recommended.
