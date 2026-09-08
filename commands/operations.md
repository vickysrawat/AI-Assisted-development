---
description: Generate a master Operational Runbook for the current application from the codebase — the single doc a support engineer opens at 3am. Markdown (source of truth) + offline HTML companion. Evidence-derived; unknowns are ⚠ TODO, never fabricated.
argument-hint: (no arguments needed)
---

<skill>operations</skill>

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

## Your task

Generate the **Operational Runbook** using the `operations` skill. Confirm scope first, derive
everything from evidence, then write the files. **Ask first. Write the files. Output only the
confirmation summary.**

This is a documentation generator — **no ICEA, no gates**. The only interaction is the scope
confirmation.

### Step 1 — Confirm scope

Read `$PLUGIN_DIR/skills/operations/SKILL.md` and show the Step 0 scope box (project name, output
paths, sources). Note explicitly: the readiness / security / code-review ledgers are **not** read
here — that is the `/go-live` skill. Wait for `yes`.

### Step 2 — Generate

Follow the skill Steps 1–7:
1. Load evidence (architecture docs, config, pipeline/IaC, bash signals) — no ledger reads.
2. Load `$PLUGIN_DIR/skills/operations/references/runbook-template.md` + shared specs.
3. Derive environments/resources, secrets inventory, degradation map.
4. Derive symptom→playbook map + failure-mode playbooks (Category B consent gate per source read).
5. Fill the template; build the four Mermaid diagrams; keep every `⚠ TODO` and "⚠ verify" caveat.
6. Run the quality gate.
7. Write `docs/operations/{Project}-Operational-Runbook.md` and the HTML companion
   (`…-Operational-Runbook.html`, offline, from the template embedded in the skill).

### Step 3 — Confirm

Output the confirmation summary (files written, open `⚠ TODO` count, sources used). Never echo the
HTML content to chat.
