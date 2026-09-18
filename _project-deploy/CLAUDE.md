# CLAUDE.md — Project Intelligence File
# Stack: <set per repo — e.g. ".NET 8+ / C# · Angular 17+ · Node.js · Azure DevOps">
#        setup-init / architect populate this from the detected repo type.
# Domain: <business domain, identified at setup by business-context-generation.md — e.g.
#          legal / healthcare / fintech / ecommerce / govtech / generic. Drives the
#          project-local B-series in .claude/business-context.md. Re-run with `SET DOMAIN`.>
# Plugin version: 3.25.0

# Dream

**Hard rule:** write to `memory/MEMORY.md` **in this response** when any trigger below fires — never to `~/.claude/projects/<slug>/memory/`, never deferred. The memory-capture hook prompts each turn; write proactively regardless. `memory/` is exempt from the Write Gate.

Write an entry whenever one of these triggers fires:

| Trigger               | What to capture                                      |
|-----------------------|------------------------------------------------------|
| Plan approved         | Approach agreed, tools chosen, constraints set       |
| Task completed        | Pattern that worked, convention confirmed            |
| Error resolved        | Error + root cause + fix + gotcha to avoid repeating |
| Approach abandoned    | What failed, why, what not to retry                  |
| Architecture decision | Decision + rationale + alternatives rejected         |

Detail: `skills/shared/dream-reference.md`.

## 0. WRITE GATE — Applies to source code and config files only

Source code and config files are NEVER written to disk until the developer replies
`APPROVE ADO-{ID}`. ICEA/Tech Spec/Epic/Tracker docs and `memory/` follow the
draft-then-save flow instead (see the `SAVE PLAN`/`SAVE ICEA`/`SAVE TECH` handlers in §0a).

**Pre-plan gate:** ICEA drafting is BLOCKED until `SAVE PLAN ADO-{ID}` — not inline, not to
temp/. Sequence is strictly Plan → `SAVE PLAN` → ICEA → `SAVE ICEA` → Tech Spec → `SAVE TECH`.

When a skill would write source/config it MUST instead: (1) show the changes — a unified diff
(changed lines + 3 lines of context) for edits, full content for new files; (2) show the target
path; (3) display this prompt and stop:

```
📁 WRITE PENDING — reply APPROVE ADO-{ID} to write, or SKIP to discard.
   Path: {full/file/path}
```

Full gate semantics, artefact timing, and batch approval rules: `skills/shared/write-gate-spec.md`.

`APPROVE ALL ADO-{ID}` grants standing approval for the current plan/ADO — each diff + path is
still shown before writing; `REVOKE ALL ADO-{ID}` cancels it. Secrets and findings gates are
never blanket-skippable.

**Boundary-crossing writes.** A write outside the repo root (dependency repo in `additionalDirectories`)
requires its own per-file confirmation — `APPROVE ALL` does NOT blanket it. Show the diff + path
and add `⚠ WRITE CROSSES REPO BOUNDARY — {path} is outside this repo.` before the prompt.

## 0a. Keyword Handlers — recognised in any session, any message

Recognised globally, no /command needed. ADO ID is case-insensitive. If a pattern matches,
execute the skill immediately — priority over chat.

| Pattern | Action |
|---|---|
| `SAVE PLAN ADO-{ID}` | Write plan to disk → write ICEA draft to `temp/ADO-{ID}-icea.md` → tell developer to open in VS Code preview |
| `SAVE PLAN ADO-{ID} CONFIRM` | Save plan with open questions — bypass warning |
| `SAVE ICEA ADO-{ID}` | Run critic gate → save critic output → copy `temp/ADO-{ID}-icea.md` to permanent docs/ → delete temp → write Tech Spec to `temp/ADO-{ID}-tech.md` |
| `SAVE ICEA ADO-{ID} ACCEPT` | Override critic REVISE verdict and save ICEA anyway (with audit note) |
| `SAVE TECH ADO-{ID}` | Write Tech Spec to disk — hard blocks if open questions remain (no bypass) |
| `SAVE TECH ADO-{ID} ACCEPT` | Save Tech Spec despite critic REVISE verdict (override with audit note) |
| `PLAN ADO-{ID}` | Invoke icea-feature skill — cross-session recovery at Step 5 (draft ICEA from saved plan on disk) |
| `ICEA ADO-{ID}` | Invoke icea-feature skill — cross-session recovery at Step 8 (draft Tech Spec from saved ICEA; EPIC branch active) |
| `TECH ADO-{ID}` | Invoke icea-feature skill — cross-session recovery at Step 8 (draft Tech Spec from saved ICEA; EPIC branch active) |
| `APPROVE ADO-{ID}` | Run icea-approve skill for that ADO ID |
| `APPROVE ADO-{ID} Story-{N}` | Run icea-approve skill for that story |
| `APPROVE ALL ADO-{ID}` | Grant standing Write-Gate approval for the current plan/ADO — subsequent source/config writes proceed without a per-file pause, but each diff + path is still shown. Does NOT skip Feature/secrets/findings gates. Scope: this session + this ADO only. |
| `REVOKE ALL ADO-{ID}` | Cancel a standing `APPROVE ALL` — return to per-file `APPROVE ADO-{ID}` |
| `IMPLEMENT ADO-{ID}` | Run icea-implement skill for that ADO ID |
| `IMPLEMENT ADO-{ID} Story-{N}` | Run icea-implement skill for that story |
| `REVISE ADO-{ID}` | Run icea-revise skill for that ADO ID |
| `STATUS ADO-{ID}` | Run icea-status skill for that ADO ID |
| `BUG ADO-{ID} — {description}` | Log bug entry to tracker for that ADO ID |
| `SET DOMAIN` | Execute `skills/shared/business-context-generation.md` — uses its own `APPROVED` gate (not `APPROVE ADO-{ID}`). |
| `REFRESH DOMAIN` | Execute `skills/shared/business-context-generation.md` in refresh mode — skips refresh/keep prompt; shows before/after diff of every trigger change before `APPROVED`. |
| `REFRESH RULES` | Execute `skills/shared/rule-refresh.md` — per-file three-way diff (plugin changes + your edits vs baseline); writes only on `APPROVED` per file. |
| `REFRESH RULES {filename}` | Same as `REFRESH RULES` scoped to one plugin-managed file (must appear in `_deploy-manifest.json`). |
| `UPGRADE ADO-{ID}` | Run the upgrade skill (`/upgrade`) for that ADO ID — in-place, same-stack version upgrade (orchestrates a deterministic tool; rejects false-upgrades → Rewrite) |
| `REWRITE ADO-{ID}` | Run the rewrite skill (`/rewrite`) for that ADO ID — out-of-place generative migration to a new target folder (posture · options · target-space DAG · per-cluster BAL/ERL · two-gate) |
| `REPLATFORM ADO-{ID}` | Run the replatform skill (`/replatform`) for that ADO ID — hosting/topology migration (on-prem → cloud); LLM authors IaC + human-executable runbooks, human executes; NFR/Well-Architected oracle |
| `UPGRADE RESUME ADO-{ID}` | Resume the upgrade — read `payload.upgrade`, orient (Status), then continue at the first unfinished stage/gate. Per `skills/shared/migration-ledger-schema.md` § Status & Resume |
| `REWRITE RESUME ADO-{ID}` | Resume the rewrite — read `payload.rewrite`, orient, then continue at the first unfinished stage/gate. Per `skills/shared/migration-ledger-schema.md` § Status & Resume |
| `REPLATFORM RESUME ADO-{ID}` | Resume the replatform — read `payload.replatform`, orient, then continue at the first unfinished stage/gate. Per `skills/shared/migration-ledger-schema.md` § Status & Resume |
| `UPGRADE STATUS ADO-{ID}` | Re-entry point: read upgrade ledger fresh, render state, end with the single Next action. Read-only. Per `skills/shared/migration-ledger-schema.md` |
| `REWRITE STATUS ADO-{ID}` | Re-entry point: read rewrite ledger fresh, render state, end with the single Next action. Read-only. Per `skills/shared/migration-ledger-schema.md` |
| `REPLATFORM STATUS ADO-{ID}` | Re-entry point: read replatform ledger fresh, render state, end with the single Next action. Read-only. Per `skills/shared/migration-ledger-schema.md` |
| `MIGRATE` (and all MIGRATE variants, each `ADO-{ID}`) | **RETIRED** — `migration`/`migration-status` skills are gone. Do NOT auto-route. Use: `UPGRADE ADO-{ID}` (same stack, higher version) · `REWRITE ADO-{ID}` (different stack) · `REPLATFORM ADO-{ID}` (on-prem → cloud). See `docs/migrations/2026-09-migration-skill-family.md`. |

## 0b. Shell & Git Configuration

- Use `{GIT_PATH}` for git and `{BASH_PATH}` as the shell — written by `/setup-init` (run `/setup-sync` if unresolved). Run git/shell via the Bash tool only — never `mcp__ide__executeCode` or Python subprocess.
- Never rely on `HEAD` as a symbolic ref — resolve with `git rev-parse HEAD` first.

## 1. PROJECT OVERVIEW

## 2. AZURE DEVOPS

- Organization  : {ADO_ORG}
- Project       : {ADO_PROJECT}
- Repository    : [set per project — update this line after setup-init]
- ADO URL       : {ADO_URL}
- PAT storage   : env var `AZURE_DEVOPS_PAT` or `.claude/settings.local.json` → env. NEVER in `.claude/settings.json` (committed/shared).
- Target branch : {TARGET_BRANCH}
- Branch naming : feature/ADO-[ID]-short-description
- Commit format : [ADO-ID] Short description of change
- PR title      : [ADO-ID] Feature name — brief summary

## 4. MODEL ROUTING

Model env vars: `ICEA_MODEL` (generation) · `REVIEW_MODEL` (review) · `CRITIC_MODEL` · `INFRA_MODEL` (infrastructure). Override in `.claude/settings.json` → `env`. Full table: `skills/shared/model-routing-spec.md`.

## Web Search Policy

Before calling WebSearch or WebFetch, sanitize the query:
- Remove all internal identifiers: class names, method names, file paths,
  variable names, and any project- or organization-specific terms.
- Replace them with generic technology descriptors.
- The query must contain only publicly recognizable technology terms.
Example: an internal error message containing a proprietary identifier →
  language + framework + error type only.

## Feature Gate

NEVER write implementation code for a new feature or capability without an approved ICEA on
disk with `Status: ✅ Approved` at
`docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-*.icea.md` (the folder is always
`UserStory{ID}` for both STORY and EPIC — the type is recorded inside the ICEA).

If asked to implement something new and no approved ICEA exists: say so, run
`/ai-assisted-development:icea-feature`, and do not proceed until `APPROVE ADO-{ID}`. Override: `/skip-icea` (warns once; not recommended).
