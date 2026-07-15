---
name: pr-spec-review
description: >
  Review a Pull Request against a functional specification or ICEA document.
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

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: B_
Reviews a Pull Request against a functional specification and produces four
structured outputs: Spec Compliance Check, Code Review Against Spec,
Traceability Matrix, and Gaps/Risks Report.

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

| How provided          | Action                                              |
|-----------------------|-----------------------------------------------------|
| File path             | Read the file (or all `.md`/`.txt`/`.pdf` in a folder) |
| Pasted text           | Use directly                                        |
| Not provided          | Ask: "Please provide the spec file path or paste the spec text." |

### PR / diff input

| How provided          | Action                                              |
|-----------------------|-----------------------------------------------------|
| `pr=<N>` argument     | Run `gh pr diff <N>` and `gh pr view <N>`           |
| `diff=<file>` argument| Read the file                                       |
| Neither               | Run `git diff $(git merge-base HEAD dev)...HEAD`   |
| Pasted diff text      | Use directly                                        |

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

## Reference Files

- `$PLUGIN_DIR/skills/pr-spec-review/references/output-format.md` — Exact report format with examples for all
  four parts. Read before writing output.
- `$PLUGIN_DIR/skills/pr-spec-review/references/usage-guide.md` — Invocation patterns, argument reference, tips
  for large PRs and multiple spec files.
