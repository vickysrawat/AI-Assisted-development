# Well-Architected Grade — reuse app-readiness OUTPUT (AC-F8)
_Reference · skills/replatform · ADO-9000 Story 3_

The Well-Architected posture is the SECONDARY "done" axis (NFR assurance is primary). It is assembled
from **existing outputs** — never re-graded by hand and never double-counted.

## Sources (no new grader)
- **Run the `app-readiness` skill against the TARGET** → consume its **8-domain ERL report** as the
  evidence base. Do NOT re-grade readiness by hand.
- Take NFR-measurable pillars from the **measured NFR assurance** (`replatform-nfr-assess`) — do NOT
  re-grade them.

## WAF pillar ↔ source mapping (structure only)
| WAF pillar | Graded from |
|---|---|
| Performance Efficiency | NFR assurance (measured latency/throughput) |
| Reliability | NFR assurance (availability/failover, RTO/RPO drills) |
| Security | `app-readiness` ERL output |
| Operational Excellence | `app-readiness` ERL output |
| Cost Optimization | NFR cost (projected→measured) + `app-readiness` where relevant |
| Sustainability (if used) | `app-readiness` ERL output |

> The mapping's only job is to **project** the two existing outputs onto WAF pillars. No pillar is graded
> twice: NFR-measurable pillars come from the NFR engine, the rest from the app-readiness output.

## Behavioral regression (secondary)
Reuse the golden-master as a pre-move → post-move smoke ("still works after the move") — depth:
`skills/shared/migration-knowledge/refs/specs/golden-master-spec.md`. Behavioral parity is secondary to
NFR/readiness for Replatform (the inverse of Rewrite).

## Gate
"Done" = NFR measured-met (or projected + explicitly accepted for unmeasurable) **+** a Well-Architected
posture **+** behavioral regression passes. Same two-gate + hybrid + friction-proportional model as the
family; compliance/regulated NFRs **hard-block** (see `nfr-assurance.md`).
