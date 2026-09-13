# Spec: Options Insight

_Defines how migration options are presented to the developer at the decision point — the
provenance/basis discipline, the comparative web-grounded insight block, the triggered judge pass,
and the web-search suggestion. Shared by all migration-family skills (**Upgrade · Rewrite ·
Replatform**) at their options step._

> **Why this exists.** The option decision is the **highest-leverage, hardest-to-reverse** point in
> a migration — every downstream artifact (design documents, DAG, generated code) is authored for
> the selected option. A number without its reasoning is not a decision input, and a wrong number at
> this point costs the entire design and generation phase. This spec makes the options presentation
> accurate, honest about uncertainty, and grounded where it matters.

---

## Principle: provenance, not confidence

Every attribute in the options table carries a **basis** — where the value came from — not a
confidence score. Provenance is a fact (deterministic, testable); confidence is a judgment
(non-deterministic, unvalidatable, and prone to false assurance on high-stakes attributes).

**Fixed basis vocabulary** (the only permitted values — enumerable and testable):

| Basis | Meaning | Example attribute |
|---|---|---|
| `computed` | Deterministic from source analysis or a fixed model | capability count, cluster count |
| `web-grounded:{YYYY-MM}` | Verified against an authoritative source at that date | TCO fixed pricing, published SLA |
| `published-spec` | From a declared spec (NFR spec, source config) | NFR availability requirement |
| `estimate:{source}` | Pattern-derived estimate — inherent uncertainty, not a fact | IaC effort, runbook complexity |
| `requires:{who/what}` | Cannot be determined without information/authority not yet available | compliance sign-off, TCO at peak load |

Rules:
- EVERY attribute row carries exactly one basis from this vocabulary.
- `estimate:` is honest about softness — it prevents false confidence; it does not create real
  confidence. Never dress an estimate as `computed` or `web-grounded`.
- `requires:{who}` names the resolver (e.g. `requires: compliance sign-off`) — an action item
  pointing at the right human, not a tier the developer silently defers to.
- NEVER assign a confidence tier (✓/~/? or percentages) — basis only.

---

## Comparative insight block

The options table is paired with a **comparative insight** per decision-critical attribute —
explaining the DELTA between options, not describing each option in isolation. The developer must
be able to answer "why does A have 5 and B have 9" without doing the comparison themselves.

Each insight separates three content kinds by how they are grounded:

| Content | Grounding | Web search? |
|---|---|---|
| **Source-derived reasoning** — what the app needs | `computed` from source topology | No — already known |
| **Volatile cloud fact** — service bundling, pricing, SLA, capability behaviour | `web-grounded:{date}` via the cache (below) | Yes — the accuracy-critical part |
| **Synthesis** — the conclusion (the count, the effort, "A over B") | the skill's reasoning; judged when triggered | No — not a fact |

**Example — capability delta:**
```
Why App Service is 5 and AKS is 9:
  Both need: compute, data, identity, secrets, observability      [computed — 5 shared needs from source]
  App Service bundles into compute: TLS, load balancing, autoscale [web-grounded:2026-09 · Azure App Service docs]
  AKS requires as separate capabilities: cluster mgmt, ingress,
    node networking, TLS                                          [web-grounded:2026-09 · AKS docs]
  → App Service 5, AKS 9. The 4-capability delta is operational
    surface you provision and maintain, not application function. [synthesis]
```

---

## Web grounding — through the existing cache

Volatile cloud facts (service capabilities, pricing, SLAs) MUST be grounded through the plugin's
existing knowledge machinery — never ad-hoc, un-dated, or from model memory:

1. **Cache first** — read the volatile-layer cache (`upgrade-knowledge-cache.cjs` pattern) before searching.
2. **Ground on miss/stale** — WebSearch an **authoritative source** (the cloud provider's own docs /
   pricing / SLA pages). Never source a decision-critical fact from a blog or model memory.
3. **Tag deterministically** — `source-classifier.cjs`: authoritative host → `VERIFIED`; anything
   else → `INFERRED` (confidence lowered, shown as such).
4. **Date every fact** — `web-grounded:{YYYY-MM}`. A verified-but-old fact at a decision point must
   show its age.

**Offline mode:** degrade to the `refs/mappings` + `refs/strategies` INFERRED tier, dated via the
freshness manifest, staleness shown. The decision can still be made — with honest, visible
degradation, never silent.

---

## Web-search suggestion — awareness before the search

Before triggering a web search for an insight, tell the developer — following the plugin's
"graceful pause" pattern:

```
The {attribute} comparison for this decision needs current cloud facts verified via web search
(e.g. {App Service vs AKS capability bundling}). This may take a moment.
  · Proceed with web grounding (recommended at the decision point)
  · Use offline reference tier (faster; facts dated {manifest date}, may be stale)
```

The developer's choice is recorded. In a constrained/air-gapped environment the offline tier is the
honest fallback — the skill states the facts are offline-sourced and may be stale.

---

## Triggered judge pass

Verified facts can still yield a wrong conclusion — a confidently-wrong option choice built on real
citations is the most dangerous output at this point. The comparative **synthesis** therefore gets an
independent judge pass (separate model, per the shared judge ladder) — but **triggered, not
mandatory**:

**Triggers:**
- Options are within a threshold on the deciding attributes (a close call — where wrong reasoning
  does damage), OR
- The developer explicitly asks "why this option?"

The judge reads the cited facts + the synthesis and checks the conclusion actually follows from the
facts. Verdict recorded alongside the insight (`Judge verdict: PASS/REVISE`). A clear-cut option
choice does not need the pass — judging every obvious decision taxes the common case.

---

## Options table format

```
| Attribute            | Option A                        | Option B                        |
|----------------------|---------------------------------|---------------------------------|
| {attribute}          | {value} [{basis}]               | {value} [{basis}]               |
```

Every value carries its basis inline. Decision-critical attributes are followed by their comparative
insight block. Attributes with `requires:{who}` basis are the developer's action items before
`APPROVE OPTIONS`.

---

## Gate at APPROVE OPTIONS

- Attributes with `requires:{X}` basis are **explicitly acknowledged** by the developer before
  approval — logged as an acknowledgement.
- `requires:` on **compliance, NFR hard-floors, or security/auth** routes to the **named human**
  (compliance sign-off, security review) — it is NOT self-acceptable by the developer. These block
  `APPROVE OPTIONS` until resolved or signed off by the right authority.
- `requires:` on soft attributes (TCO at peak, effort refinement) is advisory — acknowledged and
  logged, does not block.
- Write `[OPTION]` and `[DECISION]` (APPROVE OPTIONS) entries per `migration-log-spec.md`, including
  the basis of each deciding attribute and any judge verdict.

---

## Hard rules

- EVERY options-table attribute carries a basis from the fixed vocabulary — NEVER a confidence tier.
- NEVER present a decision-critical cloud fact from model memory — web-ground it (VERIFIED/INFERRED,
  dated) or use the offline INFERRED tier with staleness shown.
- NEVER dress an `estimate:` as `computed` or `web-grounded` — softness must be visible.
- ALWAYS make the insight COMPARATIVE (the delta between options), not per-option description.
- ALWAYS suggest the web search before running it — awareness + consent, never a silent stall.
- Judge pass is TRIGGERED (close call or developer asks) — not mandatory on every option decision.
- `requires:` on compliance / NFR-floor / security routes to a named human — never self-accepted.
- ALWAYS record option basis + judge verdict in the migration log.
