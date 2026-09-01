---
name: pr-spec-review
description: >
  Review a Pull Request against the approved ICEA and Tech Spec — the single
  spec-compliance engine (also invoked by pr-create's and checkin's gates).
  Use this skill whenever a user wants to check a PR against a spec, validate
  that code changes match requirements, generate a traceability matrix between
  PR changes and spec requirements, or produce a gaps/risks report for a PR.
  Trigger on: "review PR against spec", "check if PR matches spec", "does this
  PR implement the spec", "spec compliance", "traceability matrix", "review PR
  against ICEA", "code review against requirements", "what's missing from the PR",
  or any request to compare code changes to a requirements document. Also trigger
  when the user pastes a diff or PR link alongside a spec document without
  explicit instruction — treat it as a full review request. Always use this skill
  when both a PR (or diff) and a spec are present in the conversation.
---

# PR Spec Review Skill

_Skill version: 1.2 · Last changed: 2026-08-28 · Plugin compatibility: ≥1.14.0 · Consent: B_
The single spec-compliance engine. Reviews a Pull Request against the approved
**ICEA** (acceptance criteria) and **Tech Spec** (design / coverage / D-option
fidelity), producing either a full four-part report (Spec Compliance Check, Code
Review Against Spec, Traceability Matrix, Gaps/Risks Report) or a compact gate
verdict. Two dials — **scope** (`--icea-only` vs the ICEA+Tech default) and
**output** (`--compact` vs full report) — let the same engine back three callers:
standalone review (full report) and the `pr-create` / `checkin` gates (compact).
Requirement structure comes from `skills/shared/icea-schema.md` +
`skills/shared/techspec-schema.md`; diff↔requirement mapping from
`skills/shared/traceability-mapping-spec.md`.

---

## Scope & output modes

Two independent dials. Both default to the standalone-reviewer setting; gate callers
override them.

| Dial | Values | Default | Set by |
|---|---|---|---|
| **Scope** | ICEA + Tech Spec  ·  `--icea-only` (ACs only) | ICEA + Tech Spec (when a Tech Spec exists; else auto-falls back to ICEA-only) | caller flag |
| **Output** | full 4-part report  ·  `--compact` (verdict block) | full report | caller flag |

- `--icea-only` — restrict to acceptance-criteria compliance (use before a Tech Spec is
  approved). `icea-review` is a thin alias for `pr-spec-review --icea-only`.
- `--compact` — emit only the **Compact verdict** block (see end of skill). Used by
  `pr-create`'s pre-submit gate and `checkin`'s Check B.
- Note: this skill deliberately does **not** use `--full` — that flag means "scan all files,
  ignore cache" for file-scanner skills (`scope-flags-spec.md`); here full scope is simply the
  default. `--icea-only` and `--compact` are registered as skill-local extensions in that spec.

---


## Business Context Severity (mandatory — applies to all findings)

Read `.claude/plugin-path.txt` to get PLUGIN_DIR (if absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`). Before producing any finding, load `$PLUGIN_DIR/skills/shared/business-context-severity.md`.
Apply the B1–B7 override triggers to every finding. If any finding touches
attorney-client data, immigration identifiers, active case timelines, vulnerable
client data, breach notification obligations, physical safety data, or PII in a
static directory — escalate it to Critical regardless of its technical severity.
State the override trigger in the finding. This check is mandatory and cannot be
waived by any flag or instruction.

---

## Codebase Orientation (optional — run if the knowledge graph exists)

> Schema: `$PLUGIN_DIR/skills/shared/graph-index-schema.md` · `$PLUGIN_DIR/skills/shared/graph-module-schema.md`

Before executing, check for orientation files — do not scan source:

1. **Read `.claude/graph/graph-index.md`** if present — use it to identify the module, domain, and entry-point file for context in output; read the matching `.claude/graph/<module>.md` for detail.
2. **Staleness check**: if `.claude/graph/.stale` exists, note it inline (run `/graph-sync`) — do not block.
3. If `.claude/graph/graph-index.md` is missing, continue without orientation.


## Model routing

This skill is in the **review tier** — it uses `REVIEW_MODEL` (default: `claude-sonnet-4-6`).

To override for this project, set in `.claude/settings.json`:
```json
{ "env": { "REVIEW_MODEL": "claude-sonnet-4-6" } }
```

See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for full routing documentation.

## Persona

Execute as **[TL] Marcus Reid — Tech Lead** (14 yrs across web, service, and data layers). Optimizes
for honest spec-to-PR traceability; always asks "does this change actually satisfy the requirement,
and does it fit how we build?" Weigh [QA] AC-coverage concerns, and [SEC] when security requirements
are in scope. Expertise = this project's actual stack per layer.

The persona sets *what to scrutinize* — it never licenses assumption. The spec and the PR diff are
the only sources of truth; never mark a requirement met without the implementing change (subordinate
to CLAUDE.md §3 / decision transparency). Never name the persona in the report. See
`$PLUGIN_DIR/skills/shared/personas-spec.md`.

## Step 1 — Gather Inputs

You need two things: a **spec** and a **PR diff**. Collect them using the
table below, in priority order.

### Spec input

The canonical spec is the approved **ICEA + Tech Spec** for the branch's ADO ID.
Resolve in this priority order:

| How provided          | Action                                              |
|-----------------------|-----------------------------------------------------|
| `spec=<path>` argument | Read the file (or all `.md`/`.txt`/`.pdf` in a folder) |
| Pasted text           | Use directly                                        |
| Auto-discover (default)| Extract `ADO-{ID}` from the branch, then glob the story folder: `docs/Release*/Sprint*/UserStory{ID}/ADO-{ID}-*.icea.md` (required) and `…/ADO-{ID}-*.techspec.md` (optional). |
| Not found             | Ask: "Please provide the spec file path or paste the spec text." |

**Scope resolution:** if a `.techspec.md` is found and `--icea-only` is NOT set →
**full** scope (ICEA + Tech Spec). If the Tech Spec is absent OR `--icea-only` is set →
**ICEA-only** scope (state the fallback reason). Announce which mode ran. Validate the
discovered docs against `icea-schema.md` / `techspec-schema.md` — a doc missing a required
section is itself a finding.

### PR / diff input

| How provided          | Action                                              |
|-----------------------|-----------------------------------------------------|
| `pr=<N>` argument     | Provider-aware fetch — see **Fetching a PR by number** below |
| `diff=<file>` argument| Read the file                                       |
| Neither               | Resolve `{base-branch}` (below), then `git diff $(git merge-base HEAD {base-branch})...HEAD` |
| Pasted diff text      | Use directly                                        |

#### Resolving `{base-branch}` (for the "Neither" path)

Read `.claude/plugin-path.txt` for `PLUGIN_DIR` (if absent, use the resolver in
`skills/shared/plugin-path-resolution.md §1a`), then read
`$PLUGIN_DIR/skills/shared/git-remote-provider-spec.md` and run its base-branch policy:
`ado` → `dev`-or-ask; `github`/`other` → remote-default-or-ask. Substitute the printed value
as literal `{base-branch}` (do not rely on `$VAR` across separate command lines).

#### Fetching a PR by number (`pr=<N>`)

`gh` is **not required** and may be absent. Use the provider-aware flow from the shared spec:

1. Run `detect_git_provider`; parse `{owner}`/`{repo}` (GitHub) or `{org}`/`{project}`/`{repo}` (ADO).
2. `resolve_pr_refs {N}` (spec Helper 4) → one metadata `curl` returns the PR's
   `{base-ref}`, `{head-ref}`, and title/body for context.
3. Get the diff locally:
   ```bash
   git fetch origin
   git diff {base-ref}...{head-ref}
   ```
- **Optional fast-path:** if `gh` (GitHub) or `az` (ADO) is installed, use
  `gh pr diff {N}` / `gh pr view {N}` (or `az repos pr show`) instead of the curl+git flow.
- **Cross-fork guard:** if `{head-ref}` is not on `origin` after fetch (GitHub
  `.head.repo.full_name` ≠ `{owner}/{repo}`), stop and tell the developer to add the fork
  remote (`git remote add fork <url> && git fetch fork`) or pass `diff=<file>`.
- **Auth:** GitHub public repos need no token; private repos use `GITHUB_TOKEN`; ADO uses
  `AZURE_DEVOPS_PAT`. Never echo or log the credential.

After collecting the diff, present a **source file scan request** before
reading any source file (apply `$PLUGIN_DIR/skills/shared/source-file-consent.md` Category B bulk gate):

```
📂 Source file scan request

  Files   : {N changed files} — {list first 3, then "and N more"}
  Why     : The diff shows what lines changed but not the surrounding method
            context needed to verify each AC. Reading the full files confirms
            whether the implementation satisfies the spec or just modifies it.
  Looking for: AC compliance for each requirement in the spec
  Token cost: ~{N × avg file size estimate} tokens

Scan these files? (yes / no / scan only changed files / tell me which ones)
```

If the developer says **yes** → read all changed source files in full.
If the developer says **no** → use diff hunks only; note in each finding
  that source context was unavailable and flag lower confidence.
If the developer says **scan only changed files** → already the default, proceed.
If the developer says **tell me which ones** → list each file with a one-line
  justification for why it is needed, then wait for file-by-file confirmation.

---

## Step 2 — Parse the Spec into Requirements

Before comparing, extract a numbered list of requirements from the spec:

- If the spec already has IDs (e.g. `FR-001`, `AC-3`) → use them as-is
- Otherwise → assign `REQ-001`, `REQ-002`, … in reading order

Group requirements by feature area if the spec has sections. Keep this list
in working memory — you will reference it throughout the review.

When the spec is the project ICEA/Tech Spec, use the schema-defined IDs rather than
re-numbering:
- **ICEA** → each `AC-F{n}` / `AC-NF{n}` (`icea-schema.md`) is a requirement. Out-of-Scope
  items are the allow-list for the scope-creep direction.
- **Tech Spec** (full scope) → each **AC Coverage Matrix** row (`techspec-schema.md`) is a
  *design* requirement: the diff must touch the file the matrix promised for that AC, and
  the change must be consistent with the ICEA's selected **D-options**.

Build the diff↔requirement correspondence with `skills/shared/traceability-mapping-spec.md`
(both directions). Do not restate its status vocabulary or evidence rules here.

---

## Step 3 — Produce the Review Report

Read `$PLUGIN_DIR/skills/pr-spec-review/references/output-format.md` for the exact format of all four parts.

### Quick reference

| Part | Contents |
|------|----------|
| 1 — Spec Compliance Check | Each requirement → ✅ / ⚠️ / ❌ / ❓ with finding + file/line |
| 2 — Code Review Against Spec | Line-level findings where code diverges from spec |
| 3 — Traceability Matrix | Table: Spec req → PR file(s)/lines → Status → Risk |
| 4 — Gaps & Risks Report | GAP = spec ambiguity; RISK = implementation concern |

### Tech Spec design compliance (full scope only)

When the Tech Spec is in scope, additionally verify (fold results into Parts 1–4):
- **Coverage-matrix vs diff** — every AC→File promise in the matrix is honoured by the actual
  diff; a promised file that did not change is a ⚠️/❌ finding.
- **D-option fidelity** — the implementation matches the ICEA's selected D-options
  (`icea-decisions-spec.md`); undocumented drift is a High finding.
- **Test-case presence** — ACs whose Tech-Spec test cases are absent from the diff are flagged.

Parts 1 (compliance) and 3 (matrix) are produced via `traceability-mapping-spec.md`; Parts 2
(line-level divergences) and 4 (gaps/risks) are this skill's own analysis on top of that map.

---

## Step 4 — Quality Rules

- **Never skip a requirement silently.** If you cannot verify it from the
  diff (e.g. it is runtime behaviour), mark it ❓ and explain why.
- **File + line references are mandatory** for every finding and matrix row.
  If a requirement has no corresponding code at all, write `—` in the file
  column and mark it ❌ Missing.
- **Severity reflects business risk**, not code style preference:
  - Critical → auth, data loss, security, core workflow broken
  - High → feature behaves differently than spec
  - Medium → edge case or secondary behaviour differs
  - Low → cosmetic, naming, minor deviation
- **Gaps ≠ Risks.** A GAP is something the spec does not specify clearly
  enough to verify. A RISK is something the code does that may cause a defect
  even if it technically satisfies the spec wording.
- End the report with a one-line **merge verdict**:
  - `✅ READY TO MERGE` — no Critical or High findings
  - `⚠️ MERGE WITH CAUTION` — only Medium/Low findings; list them
  - `❌ BLOCK MERGE` — one or more Critical or High findings; list them

---

## Step 5 — Claude Code Usage (VS Code)

When running inside Claude Code, the user invokes this skill via:

```
/review-pr spec=<path>
/review-pr spec=<path> pr=<number>
/review-pr spec=<path> diff=<file>
```

Parse these arguments from the user's message and proceed automatically
without asking for confirmation — the arguments are sufficient input.

For full argument reference and tips (multiple spec files, large PRs), see
`$PLUGIN_DIR/skills/pr-spec-review/references/usage-guide.md`.

---

## Compact verdict output (`--compact`)

When `--compact` is set, suppress the four-part report and emit only this block — the form
`pr-create`'s gate and `checkin`'s Check B consume:

```
━━━ Spec Compliance (compact) — ADO #{ID} ━━━
  Scope   : {ICEA + Tech Spec | ICEA-only (reason)}
  ACs     : {n} total · {c} covered · {m} missing · {u} unclear
  Design  : {coverage ok | k matrix gaps} · D-options: {ok | drift}   ← full scope only
  Verdict : {✅ PASS | ⚠ WARN | ❌ FAIL — reason}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Verdict rule:
- ❌ **FAIL** — ≥1 AC MISSING, or any Critical/High design finding (matrix gap / D-option drift).
- ⚠️ **WARN** — only Medium/Low deviations; all ACs covered or explicitly out of scope.
- ✅ **PASS** — all ACs covered, no Critical/High findings.

The caller decides whether WARN blocks (checkin: warn-only; pr-create: developer prompt).

---

## Reference Files

- `$PLUGIN_DIR/skills/pr-spec-review/references/output-format.md` — Exact report format with examples for all
  four parts. Read before writing output.
- `$PLUGIN_DIR/skills/pr-spec-review/references/usage-guide.md` — Invocation patterns, argument reference, tips
  for large PRs and multiple spec files.
- `$PLUGIN_DIR/skills/shared/icea-schema.md` — normative ICEA structure (requirement source, `--icea-only`).
- `$PLUGIN_DIR/skills/shared/techspec-schema.md` — normative Tech Spec structure (coverage matrix, D-options).
- `$PLUGIN_DIR/skills/shared/traceability-mapping-spec.md` — diff↔requirement mapping for Parts 1 & 3.
- `$PLUGIN_DIR/skills/shared/scope-flags-spec.md` — registers the `--icea-only` / `--compact` extensions.
