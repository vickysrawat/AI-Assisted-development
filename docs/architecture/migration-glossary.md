# Migration family — glossary of abbreviations

Full forms + in-context meaning for the terms used across the migration-family architecture docs
([upgrade](upgrade-skill.md) · [rewrite](rewrite-skill.md) · [replatform](replatform-skill.md) ·
[legacy](legacy-migration-skill.md)).

## Assurance & planning (family core)

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

| Term | Meaning |
|---|---|
| **VERIFIED** | A fact traced to an authoritative official source (host on the allowlist in `scripts/lib/source-classifier.cjs`). |
| **INFERRED** | A fact with no/weak source; confidence auto-lowered; the offline knowledge tier is INFERRED by default. |

## Cloud & infrastructure

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

## Plugin process & governance

| Abbr. | Full form | In context |
|---|---|---|
| **ICEA** | Intent · Context · Examples · Acceptance | The plugin's feature-spec artifact; migration skills use architecture docs / NFR specs as the governance substitute. |
| **ADR** | Architecture Decision Record | Append-only decision log under `docs/adr/` (the family split is ADR 0061). |
| **ADO** | Azure DevOps | Work-item tracker; `ADO-{ID}` scopes the Write Gate (`APPROVE ADO-{ID}`). |
| **SRP** | Single Responsibility Principle | Why the orchestrator stays thin (sequence + gates + checkpoint only). |
| **Write Gate** | (not an acronym) | No source/config/IaC/runbook is written until `APPROVE ADO-{ID}`. |
| **LTS** | Long-Term Support (release) | Upgrade's version path prefers the LTS ladder. |
| **KB** | Knowledge Base | The cached, source-tagged breaking-change facts (`upgrade-knowledge-cache.cjs` delta-KB). |

## Personas (expert lenses — never named in output)

| Abbr. | Full form | Used at |
|---|---|---|
| **SA** | Solution Architect (Rafael Mendes) | Intake · posture · options · architecture · NFR spec · decomposition. |
| **SE** | Senior Software Engineer (Elena Fischer) | Code-gen · residual remediation · IaC + runbook authoring. |
| **QA** | Quality Assurance engineer (Sam Okonkwo) | BAL / test-coverage / NFR-assurance / reconciliation gates. |
