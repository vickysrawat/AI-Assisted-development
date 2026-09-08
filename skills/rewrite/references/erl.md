# Rewrite — Enterprise-Readiness Level (ERL) (AC-F5)

> Loaded by `skills/rewrite/SKILL.md`. ERL grades the **whole target** (not per-cluster) on enterprise
> readiness, reusing the `app-readiness` skill's 8 domains. Design of record:
> `docs/plans/migrationSkill/rewrite.md` T3 ("enterprise-readiness, designed-in at Tier 0").

## What ERL is

BAL asks *"does the target behave like the source?"* (per cluster). ERL asks *"is the target
production-ready as an enterprise system?"* (whole target). The two axes are captured at intake and
gated at completion — behavioral **and** enterprise-readiness.

## Reuse the app-readiness 8 domains

ERL does **not** invent a new rubric — it reuses the 8 domains the `app-readiness` skill already scores
(see `$PLUGIN_DIR/skills/app-readiness/`):

1. Deployment pipeline · 2. Resilience · 3. Observability · 4. Security posture · 5. Scalability ·
6. Data integrity · 7. Operational runbook · 8. Test coverage.

Each domain gets a grade; the overall ERL is reported with the per-domain breakdown (weakest domains
called out), mirroring app-readiness's Red/Amber/Green.

## Designed-in at Tier 0 — not audited at the end

The critical rule: ERL is a **readiness backbone built in Tier 0** of the rewrite (deployment,
observability, resilience scaffolding are generated from the start), **not** a compliance audit bolted
on after all clusters are done. Auditing readiness at the end guarantees expensive rework; designing it
in means each cluster is generated onto a ready-made backbone.

## Gate interaction

- ERL is assembled from the app-readiness domains as clusters complete and reported at the **completion
  gate** alongside the final BAL.
- A weak ERL domain (e.g. no observability) is surfaced with remediation — for B-series/regulated
  targets it composes with the BAL completion gate's hard-block posture.

Record the ERL grade + per-domain breakdown in the ledger (`payload.rewrite.ERL`).
