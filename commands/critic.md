---
description: Run the critic as a standalone pass against an ICEA draft or generated code. Phase argument selects the mode — `icea` critiques a spec for completeness, testability, B1–B7 coverage, and scope; `code` critiques implementation for ICEA traceability, simplicity, rules compliance, decision transparency, and hidden assumptions. With no phase, infers from context.
argument-hint: "[icea | code] [ADO-<id>]   e.g.  /critic icea ADO-1847   ·   /critic code"
---

## Model routing

This command uses the **review tier** — `CRITIC_MODEL`
(default: falls back to `REVIEW_MODEL`, default `claude-sonnet-4-6`).

To override: `{{ "env": {{ "CRITIC_MODEL": "claude-sonnet-4-6" }} }}` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

---

# /critic — Standalone critique pass

Runs the same critic that fires automatically inside `icea-feature`, but on
demand and for a single phase. Use this when you already have an approved ICEA
or already-written code and want a second opinion without re-running the whole
feature flow.

This is the independent counterpart to the auto-critic. The auto-critic gates
artefacts **before** they reach disk; this command critiques artefacts that
**already exist** (an ICEA file, or committed/staged code).

---

## Step 0 — Resolve and lock the phase

Parse the invocation arguments:

| User typed | Action |
|---|---|
| `icea` (optionally `ADO-<id>`) | PHASE = `icea`, SOURCE = `standalone` |
| `code` (optionally `ADO-<id>`) | PHASE = `code`, SOURCE = `standalone` |
| a bare `ADO-<id>` only | Infer phase (see below), SOURCE = `standalone` |
| (nothing) | Infer phase (see below) |

**Phase inference when no explicit phase is given:**

1. If generated code exists in this session not yet written to disk → `code`.
2. Else if a recently approved ICEA exists for the current branch's ADO id → `icea`.
3. Else prompt:
   ```
   Which phase should I critique?
     /critic icea [ADO-<id>]   — critique an ICEA spec
     /critic code [ADO-<id>]   — critique generated/changed code
   ```
   and stop until the developer answers.

Announce before proceeding:
```
🔎 Critic — phase: {PHASE} · source: standalone {· ADO-<id> if known}
```

---

## Step 1 — Resolve the target

**PHASE = icea:**
- If an ADO id was given, locate `docs/icea/ADO-<id>-*.md`:
  ```bash
  ls docs/icea/ADO-<id>-*.md 2>/dev/null | head -1
  ```
- If no id was given, extract it from the branch name (pattern `ADO-[0-9]+`) and
  locate the matching ICEA file.
- If no ICEA file is found:
  ```
  ⚠ No ICEA file found for ADO-<id>. Run /icea-feature ADO-<id> first,
    or pass the id explicitly: /critic icea ADO-1847
  ```
  and stop.
- Reading an ICEA file plus architecture docs is **Category C** — no source-file
  consent gate is required.

**PHASE = code:**
- The code is already on disk. This is **Category A** (implicit consent — the
  developer invoked the command), the same model as `/code-review --changed`.
- Identify the changed files:
  ```bash
  git diff --name-only          # unstaged
  git diff --name-only --cached # staged
  ```
- Announce scope before reading any file, per `$PLUGIN_DIR/skills/shared/source-file-consent.md`:
  ```
  🔎 Critic — code critique (standalone)
    Will read: {N} changed files ({first 3}, and N more)
    Why     : Critiquing already-written code against the approved ICEA for
              traceability, simplicity, rules compliance, decision
              transparency, and hidden assumptions.
    Token cost: ~{estimate}
  Proceeding. Type STOP to halt.
  ```

---

## Step 2 — Execute the critic skill in full

```
Read skills/critic/SKILL.md and execute it for the resolved PHASE and SOURCE.
```

- Pass `mode = PHASE` and `source = standalone`.
- In standalone `code` mode there is **no automatic regenerate loop** — the code
  is already committed, so the critic reports concerns and recommends `/fix` or a
  manual edit. It never rewrites files in this path.
- In `icea` mode, print the critique block directly (it is not folded into a
  parent skill's gap list when run standalone).

---

## Hard Rules

- The standalone `code` path reports concerns only — it never rewrites source
  files. To apply a remediation, use `/fix FP-xxxxxxxx` (for ledger findings) or
  edit manually. The automatic regenerate loop applies only to the internal
  auto-critic gates (`icea`/`tech` in `icea-feature`, `code` in `icea-implement`),
  where the artefact is still in context and unwritten.
- The `icea` path never reads source files — architecture docs and the ICEA file
  only (Category C).
- The critic is ephemeral here too — no ledger, no fingerprints.
