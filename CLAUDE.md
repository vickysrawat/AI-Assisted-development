# CLAUDE.md — Project Intelligence File
# Stack: <set per repo — e.g. ".NET 8+ / C# · Angular 17+ · Node.js · Azure DevOps">
#        dream-init / architect populate this from the detected repo type.
#        Supported backends: .NET Core · ASP.NET Framework 4.x · Java/Spring Boot · Python (FastAPI/Django/Flask) · Node.js
#        Supported frontends: Angular · React. Tracking: Azure DevOps.
# Last updated: keep this file updated when conventions change
# Plugin version: 3.5.0 (update this line after dream-init or plugin upgrade)

---

## 0. WRITE GATE — Applies to source code and config files only

Source code and config files are NEVER written to disk until the developer replies
`APPROVE ADO-{ID}`. ICEA/Tech Spec/Epic/Tracker docs and `memory/` follow the
draft-then-save flow instead (see the `SAVE PLAN`/`SAVE ICEA`/`SAVE TECH` handlers in §0a).

**Pre-plan gate:** ICEA drafting is BLOCKED until `SAVE PLAN ADO-{ID}` — not inline, not to
temp/. Sequence is strictly Plan → `SAVE PLAN` → ICEA → `SAVE ICEA` → Tech Spec → `SAVE TECH`.

When a skill would write source/config it MUST instead: (1) show the changes — a unified
diff (changed lines + 3 lines of context) for edits, full content for new files; (2) show
the target path; (3) display this prompt and stop:

```
📁 WRITE PENDING — reply APPROVE ADO-{ID} to write, or SKIP to discard.
   Path: {full/file/path}
```

Only `APPROVE ADO-{ID}` unblocks the write (partial responses don't count; multiple files
share one prompt). The gate holds even after an approved ICEA, a passing critic, or prior
confirmation, and regardless of urgency. Full artefact-timing table + rationale:
`skills/shared/write-gate-spec.md`.

---

## 0a. Keyword Handlers — recognised in any session, any message

Recognised globally, no /command needed. ADO ID is case-insensitive (`ADO-1847`, `ADO #1847`,
`1847` all work). If a pattern matches, execute the skill immediately — priority over chat.

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

---

## 0b. Shell & Git Configuration

- Use `{GIT_PATH}` for git and `{BASH_PATH}` as the shell. Run git/shell via the Bash tool
  only — never `mcp__ide__executeCode` or Python subprocess.
- Never rely on `HEAD` as a symbolic ref — resolve with `git rev-parse HEAD` first.

> `{GIT_PATH}`/`{BASH_PATH}` are written by `/dream-init`; run `/dream-sync` if unresolved.

---

## 1. PROJECT OVERVIEW

Distributed team (PM · Developers · QA). All feature work is driven by ICEA documents
(Intent · Context · Examples · Acceptance) — no ticket goes Active without an approved ICEA.
Approved ICEAs are saved to `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-{feature}.icea.md`.

---

## 2. AZURE DEVOPS

> Per-project runtime source of truth — skills read Organization/Project here at execution
> time. Defaults come from `.claude-plugin/config.json`; to change org/project/company
> plugin-wide, edit that file and run `scripts/sync-config.sh` (see DEVELOPER-GUIDE.md >
> Rebranding / forking) — do not edit scattered copies.

- Organization  : {ADO_ORG}
- Project       : {ADO_PROJECT}
- Repository    : [set per project — update this line after dream-init]
- ADO URL       : {ADO_URL}
- PAT storage   : Windows env var `AZURE_DEVOPS_PAT` (recommended), or `.claude/settings.json` → env (only if gitignored)
- Target branch : dev
- Branch naming : feature/ADO-[ID]-short-description
- Commit format : [ADO-ID] Short description of change
- PR title      : [ADO-ID] Feature name — brief summary

---

## 3. DESIGN PHILOSOPHY

Simplicity first · readability · maintainability · testability · **do not assume** (stop and
ask when ambiguous) · **decision transparency** (document non-trivial choices inline with a
`// DECISION:` options-considered comment). The full statement and the DECISION comment
format live in `rules/project-rules.md`, which is loaded on every file edit — that rule is
the enforced source of truth; this section is a pointer.

---

## 4. MODEL ROUTING

Skills route by task type via env vars — `ICEA_MODEL` (generation), `REVIEW_MODEL` (review),
`CRITIC_MODEL` (falls back to `REVIEW_MODEL`), `INFRA_MODEL` (infrastructure). Override per
project in `.claude/settings.json` → `env`. Full table, defaults, and per-skill assignments:
`skills/shared/model-routing-spec.md`.

---

## Data Access Convention

Always use **Dapper with parameterised SQL** for all database access.
Never use EF Core or any ORM that generates SQL automatically.
This applies to all new code and any code generated by skills.

---

## Feature Gate

NEVER write implementation code for a new feature or capability without an approved ICEA on
disk with `Status: ✅ Approved` at
`docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-*.icea.md` (the folder is always
`UserStory{ID}` for both STORY and EPIC — the type is recorded inside the ICEA).

If asked to implement something new and no approved ICEA exists: say so, run
`/ai-assisted-development:icea-feature`, and do not proceed until `APPROVE ADO-{ID}`. This is
output-gated — orientation, questions, and reading architecture docs are always permitted;
only implementation-code generation is blocked. Override: `/skip-icea` (warns once; not recommended).

---

# Dream

Write an entry to `memory/MEMORY.md` whenever one of these triggers fires:

| Trigger               | What to capture                                      |
|-----------------------|------------------------------------------------------|
| Plan approved         | Approach agreed, tools chosen, constraints set       |
| Task completed        | Pattern that worked, convention confirmed            |
| Error resolved        | Error + root cause + fix + gotcha to avoid repeating |
| Approach abandoned    | What failed, why, what not to retry                  |
| Architecture decision | Decision + rationale + alternatives rejected         |

Entry format, consolidation cadence (`/dream` every 5–8 sessions), the 20-entry promotion
cap, topic-file demotion, and `/dream-health` are documented in
`skills/shared/dream-reference.md`.
