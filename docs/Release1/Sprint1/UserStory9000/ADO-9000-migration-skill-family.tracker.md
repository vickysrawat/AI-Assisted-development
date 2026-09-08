# Tracker — Migration Skill Family (Upgrade · Rewrite · Replatform)
ADO #9000 · Type: EPIC · 76 SP total

| Story | Child ADO # | Logical scope | SP | Status | Notes |
|---|---|---|---|---|---|
| 1 | ADO-9001 | Upgrade skill (MVP) — detect/classify + false-upgrade guard + web-grounded gap/risk report + tool preflight/guidance + baseline-tag/branch/commit-per-hop orchestration + baseline-oracle verify + minimal inline substrate | 21 | 🔨 In progress | Increment 1/4 (AC-F1 classifier) generated — awaiting APPROVE ADO-9000 to write |
| 2 | TBD | Rewrite skill + **extract** shared substrate (checkpoint ledger, migration-knowledge cache, LLM-as-judge, gate grammar, model-routing) + vendored-copy/drift-check seam | 34 | ⏳ Pending | Spec drafted ✅ · flagship · depends on Story 1 · behavior-preserving extraction |
| 3 | TBD | Replatform skill (NFR/Well-Architected oracle, cloud-capability decomposition, human-executed IaC/data/cutover) + CI-enforced standalone packaging + retire legacy `migration` (`MIGRATE` router) + future-autonomy flag (OFF) | 21 | ⏳ Pending | Spec drafted ✅ · depends on Story 2 · zero-orphan router requirement |

> Child ADO numbers filled when `IMPLEMENT ADO-9000 Story-{N}` is run.
> Sequencing is a walking skeleton: Story 1 → Story 2 (extract substrate at 2nd consumer) → Story 3.
