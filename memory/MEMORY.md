# MEMORY.md — Project memory (dream-managed)

## 2026-09-14 — Decoupling audit + fixes (stack-neutral / company-agnostic)

**Architecture decision — coupling lives in *emitted templates*, not skill logic.**
A 3-iteration LLM-as-judge audit found the plugin's skill *headers/logic* were already
stack-neutral, but the **templates skills emit** still hardcoded `.NET/Angular/Node.js`
(the real leak). Pattern to remember: when auditing for stack/company coupling, check the
reference/template bodies a skill outputs — not just the SKILL.md prose.

**What worked / conventions confirmed:**
- Fixed Data Access Convention in `CLAUDE.md` + `_project-deploy/CLAUDE.md` to be
  stack-conditional (per-stack bullets), not an unconditional "Always use Dapper / never EF Core".
- Stack-context fallback in `icea-feature`, `critic`, `pr-describe` now says "No stack is
  assumed" → resolve via `architecture.md` → `.claude/dream-init-state.json`
  (`repo_type`/`detected_stacks[]`) → ask the developer. Never assume a default stack.
- Emitted templates (`ado-tasks/references/task-formats.md`,
  `icea-feature/references/ado-description-template.md`,
  `pr-describe/references/pr-description-template.md` + its SKILL checklist) now derive layers
  from the active stack ("one line/section per active layer"), with .NET/Angular shown only as
  labelled examples.
- Marketplace `owner.name` was the dev's personal name ("Vivek Rawat") in source and
  "Product Engineering" hardcoded in install.sh/.ps1/.cjs. Now: source uses "Your Company"
  placeholder; installers write `$COMPANY`; `sync-config.sh`/`.cjs` propagate `owner.name = cfg.company`.
- No "Kirkland/K&E" literals remain in shipping content (docs/ case-studies are exempt/expected).

**Gotcha:** `Grep` tool times out (~20s) on the OneDrive-synced repo path, especially with
parallel calls. Use per-file scoped greps, `Read`, or delegate to Explore agents that manage
their own search budget.

**Regression guard added** — `tests/validate.js` › "Decoupling guards" section:
(a) denylist scan for company/personal identity in shipping content;
(b) Data Access Convention must be stack-conditional;
(c) the 3 skills must say "No stack is assumed";
(d) the 3 emitted templates must be layer-driven (contain "active layer", no `.NET API:` / `EF Core Entity:` / `.NET: FluentValidation` / `Angular: OnPush`).
Validator: 309 passed / 0 failed after changes.
