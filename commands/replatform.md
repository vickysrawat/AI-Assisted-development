---
description: Hosting/topology migration (on-prem → cloud) — move where an application runs, not what it is written in. Classifies the 6R posture, captures an NFR spec as the primary intent, decomposes by cloud capability (landing-zone Tier-0), and authors IaC + config + pipeline + human-executable migration/reconciliation/cutover/rollback runbooks. The LLM authors + rehearses; a human executes anything touching real infra/data. "Done" = NFR assurance (measurability-ceilinged) + Well-Architected + behavioral regression.
argument-hint: ADO-<id>  e.g.  ADO-1847   (run from the target-app / infra working folder)
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL` (default: `claude-sonnet-4-6`) for IaC /
config / pipeline authoring; **options / NFR spec / decomposition** use `ICEA_MODEL`
(`claude-opus-4-8`); the **judge** on every gate uses the shared three-tier ladder
(`CRITIC_MODEL` → `CRITIC_MODEL_MAX` → different-family panel).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-sonnet-4-6" }} }}` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

---

# /replatform — hosting/topology migration (LLM authors · human executes)

Moves an application's hosting/topology (on-prem → cloud). Code often barely changes; the assurance
axis is **non-functional** (NFR / Well-Architected).

```
/replatform ADO-1847
```

---

## Step 1 — Run the replatform skill

```
Read $PLUGIN_DIR/skills/replatform/SKILL.md and execute it.
```

The skill runs: detect source topology → **6R posture** (+ overlay Rewrite for refactor-for-cloud) →
intake (target cloud · CI/CD platform · IaC flavor · env progression · regulated) + **NFR spec** →
cloud-capability decomposition (**landing-zone Tier-0**) → author **IaC + runbooks** (design-quality +
judge + security scan; author-only via the executor seam) → **human executes** migration →
reconciliation gate → cutover → rollback → **NFR assurance** (measurability-ceilinged) +
Well-Architected + behavioral regression. State is written to the shared migration ledger.

---

## Keyword handlers (any session)

`REPLATFORM ADO-{ID}` — run the replatform · `REPLATFORM RESUME ADO-{ID}` — resume from the shared
ledger · `REPLATFORM STATUS ADO-{ID}` — read-only re-entry (loads the ledger, ends with the next
action). See CLAUDE.md §0a.

---

## Hard Rules

- The LLM AUTHORS; the HUMAN EXECUTES — anything touching real infra/data, in ANY environment.
- prod + regulated are permanently human-executed (future-autonomy flag OFF; even ON bars them).
- NEVER assume target cloud / CI-CD platform / IaC flavor — ask at intake.
- Landing zone is Tier-0 (provisioned first, inherited by all capabilities).
- Reconciliation is a mandatory pre-cutover gate; regulated/PII/financial require a full pass.
- NFR assurance is measurability-ceilinged — an unmeasurable NFR is capped, never reported as passed.
