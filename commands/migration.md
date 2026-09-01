---
description: Migrate an application to a new tech stack (.NET Framework→.NET 10, Java↔.NET, React+Express→Angular+.NET, Node.js→.NET). Run from INSIDE the new target project folder; provide the source app path when prompted. Staged, gated, checkpoint-resumable, with a Target Options Analysis up front and Golden-Master behavioral verification at the end.
argument-hint: ADO-<id>  e.g.  ADO-1847   (run from the empty TARGET folder)
---

## Model routing

This command uses the **generation tier** — `ICEA_MODEL`
(default: `claude-opus-4-8`) for architecture, options analysis, and code generation;
feasibility and verification use the review tier (`REVIEW_MODEL`, default `claude-sonnet-4-6`).

To override: `{{ "env": {{ "ICEA_MODEL": "claude-opus-4-8" }} }}` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

---

# /migration — staged stack migration

Migrates an application from one tech stack to another. **Run this from inside the new,
empty TARGET project folder** — the source application path is collected at Step 0 and
registered as an additional directory (read-only).

```
mkdir my-new-app && cd my-new-app && /migration
```

Supported today: `.NET Framework → .NET 10` · `Java ↔ .NET` · `React+Express → Angular+.NET` ·
`Node.js → .NET`. Execution profiles ship for `.NET` and `Angular`; Java/Python are honest-STOP
stubs pending their execution profiles.

---

## Step 1 — Run the migration skill

```
Read $PLUGIN_DIR/skills/migration/SKILL.md and execute it.
```

The skill runs six gated stages, each pausing for explicit approval:

- **Stage 0 / 0.5** — read the source, then a **Target Options Analysis**: 2–3 scored target
  stacks + migration posture (port / re-architecture / rewrite-from-spec) as an ADR
  (`APPROVE OPTIONS ADO-{ID}`) before the target is locked.
- **Stage 1** — full target architecture (5 Mermaid + ADR docs) → `APPROVE ARCHITECTURE ADO-{ID}`.
- **Stage 2** — feasibility (GREEN/YELLOW/RED/BLOCKER) → `APPROVE FEASIBILITY ADO-{ID}`.
- **Stage 3** — cluster plan + executable specs + skeleton → `APPROVE MIGRATION ADO-{ID}`.
- **Stage 4** — parallel per-cluster migration on isolated branches (toolchain from the target
  execution profile in `references/strategies/`).
- **Stage 5 / 6** — golden-master behavioral verification, tests, E2E, and the migration report.

---

## Keyword handlers (any session)

`MIGRATE ADO-{ID}` · `MIGRATE OPTIONS ADO-{ID}` · `MIGRATE ARCH ADO-{ID}` ·
`MIGRATE FEAS ADO-{ID}` · `MIGRATE CLUSTERS ADO-{ID}` · `MIGRATE RESUME ADO-{ID} [BACKEND|FRONTEND]` —
cross-session resume/regenerate from the on-disk checkpoint.

**Status (read-only):** `/migration-status ADO-{ID}` (or `MIGRATE STATUS ADO-{ID}`) renders the
checkpoint — phase, stage-gates, per-cluster progress, and the next command to resume.

---

## Hard Rules

- NEVER write generated code to the target without `APPROVE MIGRATION ADO-{ID}` (the Write Gate holds).
- NEVER skip Stage 0.5 target-options analysis except for a pure `dotnet` version upgrade.
- NEVER run a target's toolchain without its execution profile — a missing/not-implemented profile STOPs the run.
- SOURCE files are read-only; all source reads use the collected source path, never the current dir.
