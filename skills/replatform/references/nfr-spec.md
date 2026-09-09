# NFR Spec — Replatform's primary intent (AC-F7)
_Reference · skills/replatform · ADO-9000 Story 3_

Replatform's primary oracle is non-functional. The NFR spec is the "defined intent" (the axis-flip vs
Rewrite's behavioral inventory). Capture it at intake (R1); grade it at R5.

## Categories
| NFR | Examples | Verification kind |
|---|---|---|
| Latency / throughput | p50/p95/p99, RPS | testable (load test) |
| Availability / failover | SLA %, multi-AZ/region, failover time | testable (chaos / failover drill) |
| RTO / RPO | recovery time / data-loss window | testable (DR drill) |
| Cost | monthly budget, per-tx cost | projected-then-measured |
| Compliance / data-residency | region pinning, PII handling, financial | auditable (config audit) — **HARD-BLOCK** |

## Measurability tags (drive the R5 ceiling)
Each NFR is tagged by how it can be verified:
- **testable** — can be exercised (load test / drill). Highest assurance possible.
- **auditable** — provable by config/policy inspection (e.g. region pinning).
- **projected** — modeled from design, not exercised (e.g. cost pre-deploy).

## The load profile = the oracle
The realistic load profile is the analog of the golden-master oracle. The source's ACTUAL traffic (if
measurable) → highest assurance; synthetic-only → assurance drops. State the profile explicitly.

## Measurability ceiling (symmetric to BAL)
An NFR that CANNOT be measured caps the assurance it can claim. No green report without a stated ceiling.
| NFR-assurance | reached when |
|---|---|
| Measured | realistic load test + failover/DR drills executed |
| Drilled-partial | some drills, synthetic load only |
| Projected | modeled from design, not exercised |
| Modeled-only | no load profile available |

## Hard-blocks
Compliance/regulated NFRs (data-residency, financial RTO/RPO, PII) are hard-blocks — an unmet OR
unmeasurable regulated NFR blocks the move; no override without a named approver + written reason.

## Staged (shift-left)
projected@design → measured@post-deploy → validated. Cost has a long tail (projected TCO → early-measured
→ steady-state) → flagged **provisional until steady-state**; FinOps right-sizing post-deploy.
