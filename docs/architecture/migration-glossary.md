# Migration family — glossary of abbreviations

Full forms + in-context meaning for the terms used across the migration-family architecture docs
([upgrade](upgrade-skill.md) · [rewrite](rewrite-skill.md) · [replatform](replatform-skill.md) ·
[legacy](legacy-migration-skill.md)).

Think of this as the **traveller's phrasebook** for the migration country. The three sibling skills —
Upgrade, Rewrite, and Replatform — all speak the same language, and these are the words they share.
Keep it open beside the other docs: every abbreviation you meet there is defined here precisely, so
the story never has to stop to explain itself.

## Assurance & planning (family core)

The core vocabulary of "how do we know this move is any good?" — the grades, the plans, and the cost
figures the whole family reasons with.

| Abbr. | Full form | In context |
|---|---|---|
| **BAL** | Behavioral Assurance Level | Rewrite's per-cluster assurance grade — weakest-link on mechanical denominators (`min(oracle_ceiling, coverage, tests)`); no runnable oracle caps it at C. |
| **ERL** | Enterprise-Readiness Level | Whole-target readiness assembled from the app-readiness 8 domains, designed-in at Tier-0 (not audited at the end). |
| **NFR** | Non-Functional Requirement | Replatform's PRIMARY oracle — performance / availability / security / cost targets, graded with a measurability ceiling. |
| **SRMT** | Simple · Readable · Maintainable · Testable | The design-quality rubric checked at Rewrite's design + implementation gates. |
| **TCO** | Total Cost of Ownership | Onboarding + web-grounded, dated recurring run-cost shown per target option (often the primary driver). |
| **BYO** | Bring Your Own (design) | A developer-supplied target design (image / doc) accepted in place of generated options — held to the *same* critic scrutiny, never silently accepted. |
| **DAG** | Directed Acyclic Graph | Rewrite's target-space dependency plan; must be acyclic before worktree scheduling (a cycle blocks, exit 11). |
| **6R** | The six Rs of cloud migration | Replatform posture set; this family uses three: **rehost**, **replatform**, **refactor-for-cloud**. |

## Source-authority tags

Two little words that appear everywhere, marking how much you can trust a given fact — straight from
the horse's mouth, or an educated guess.

| Term | Meaning |
|---|---|
| **VERIFIED** | A fact traced to an authoritative official source (host on the allowlist in `scripts/lib/source-classifier.cjs`). |
| **INFERRED** | A fact with no/weak source; confidence auto-lowered; the offline knowledge tier is INFERRED by default. |

## Source-context intake gate

The fail-closed gate every sibling runs *before* options / gap-risk to prove the source was actually
read (not just claimed). Spec: `source-context-intake-spec.md`; script: `scripts/intake-verify.cjs`.

| Term | Meaning |
|---|---|
| **Source Context Manifest** | The gate's artifact at `docs/migrations/{ADO}/source-context-manifest.md` (authored from `source-context-manifest-template.md`): source context files · additional roots · cross-cutting concern scan · full source coverage (every `graph.json` module `mapped`/`out-of-scope`). |
| **Intake gate / `intake_context`** | The fail-closed ledger gate set by `intake-verify.cjs verify` (exit 0) and re-validated by `check-gate` (a hand-set gate is never trusted). **Distinct from the R1/Step-1 "Intake" *stage***: that stage sizes up the move; this *gate* proves the source was read. |
| **PROV** | Provenance tag — every substantive manifest row carries `PROV: {path}#{line}` resolving to a real file+line; behavior-bearing units must cite a **source** file, not a doc. |
| **`source.roots`** | Ledger CORE `string[]` — the scan roots (repo + each `additionalDirectories` entry) the gate's root-coverage check runs over; multi-root by construction ([ADR 0062](../adr/0062-migration-mode-on-ledger.md), contract `skills/shared/multi-root-scan.md`). |

## Cloud & infrastructure

The words for the new premises — the building, its services, and the machinery that provisions it —
mostly Replatform's dialect.

| Abbr. | Full form | In context |
|---|---|---|
| **IaC** | Infrastructure as Code | Bicep / Terraform / ARM / Pulumi — authored by Replatform, executed by a human. |
| **WAF** | Well-Architected Framework | The cloud-vendor best-practice framework Replatform grades the target against (reuses app-readiness/ERL). |
| **Tier-0** | (not an acronym) Foundation tier | The landing zone — provisioned first and inherited by every cloud capability; never parallelized ahead of. |
| **VM** | Virtual Machine | IaaS compute option (the `rehost` target). |
| **AKS** | Azure Kubernetes Service | A managed-container cloud option. |
| **ARM** | Azure Resource Manager (templates) | An IaC flavor. |
| **CI/CD** | Continuous Integration / Continuous Delivery | The deployment pipeline platform asked at intake (Azure DevOps / GitHub Actions / GitLab). |
| **PII** | Personally Identifiable Information | A regulated-data trigger; regulated/PII/financial constraints are hard-block NFRs. |

## The 6R postures (cloud migration)

The **6R** row above is worth its own page in the phrasebook, because "which R?" is the first
question Replatform asks. The six Rs are the industry's menu of *how far you change an app when you
move it to the cloud* — from touching nothing to rebuilding it. This family implements the three
that involve an actual move (the other three are portfolio decisions made before Replatform is even
called):

| R | Also called | What it means | In this family |
|---|---|---|---|
| **Rehost** | "lift and shift" | Move the app as-is onto cloud IaaS (e.g. a VM); minimal or no code change. | **Used** — Replatform's minimal-change posture (the IaaS VM / `rehost` target). |
| **Replatform** | "lift, tinker and shift" | Move with targeted optimizations — swap in managed services, adjust identity/config — without redesigning the app. | **Used** — Replatform owns the adaptation delta. |
| **Repurchase** | "drop and shop" | Replace the app with a different product, usually a SaaS offering. | Not used — a buy-vs-move decision outside the migration family. |
| **Refactor / Re-architect** | — | Reshape the app for cloud-native (containerize / serverless / split). | **Used as `refactor-for-cloud`** — Rewrite does the code; Replatform overlays the host via the shared ledger. |
| **Retire** | — | Decommission components no longer needed. | Not used — a portfolio decision, not a migration move. |
| **Retain** | "revisit" | Keep as-is for now; defer the move. | Not used — the "do nothing yet" option. |

## Plugin process & governance

The house rules of the wider plugin — the gates, records, and trackers the migration skills plug
into.

| Abbr. | Full form | In context |
|---|---|---|
| **ICEA** | Intent · Context · Examples · Acceptance | The plugin's feature-spec artifact; migration skills use architecture docs / NFR specs as the governance substitute. |
| **ADR** | Architecture Decision Record | Append-only decision log under `docs/adr/` (the family split is ADR 0061; the ledger owns source/target mode incl. `source.roots` per ADR 0062). |
| **ADO** | Azure DevOps | Work-item tracker; `ADO-{ID}` scopes the Write Gate (`APPROVE ADO-{ID}`). |
| **SRP** | Single Responsibility Principle | Why the orchestrator stays thin (sequence + gates + checkpoint only). |
| **Write Gate** | (not an acronym) | No source/config/IaC/runbook is written until `APPROVE ADO-{ID}`. |
| **LTS** | Long-Term Support (release) | Upgrade's version path prefers the LTS ladder. |
| **KB** | Knowledge Base | The cached, source-tagged breaking-change facts (`upgrade-knowledge-cache.cjs` delta-KB). |

## Personas (expert lenses — never named in output)

The three recurring characters in the family's stories — the architect, the builder, and the
inspector. They're lenses the skills reason through, never names shown to the end user.

| Abbr. | Full form | Used at |
|---|---|---|
| **SA** | Solution Architect (Rafael Mendes) | Intake · posture · options · architecture · NFR spec · decomposition. |
| **SE** | Senior Software Engineer (Elena Fischer) | Code-gen · residual remediation · IaC + runbook authoring. |
| **QA** | Quality Assurance engineer (Sam Okonkwo) | BAL / test-coverage / NFR-assurance / reconciliation gates. |
