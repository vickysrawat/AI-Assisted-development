# Fixture — on-prem → cloud replatform (manual / skill-run QA)

_ADO-9000 Story 3 · AC-F11 / INT-1..4. **Static input only** — no deterministic automated assertion:
verifying the replatform SKILL end-to-end requires the model to execute `skills/replatform/SKILL.md`
(a behavior test, not part of the no-API `validate.js` gate). The mechanical logic is covered by
`tests/replatform-plan.test.cjs` + `tests/replatform-nfr-assess.test.cjs`._

## Signals in `src/`
| Signal | Cloud capability | Expected target (grounded at runtime) |
|---|---|---|
| IIS + `web.config` | compute | App Service / Container Apps |
| Windows auth | identity | Entra ID |
| SQL Server connection string | data | Azure SQL |
| File-share path | data (blob) | Blob Storage |
| MSMQ (`System.Messaging`) | messaging | Service Bus |
| Task Scheduler entry point | compute | Timer Function / Logic App |

## Manual INT procedure
1. `REPLATFORM ADO-<id>` at this folder (cloud=Azure; CI/CD=Azure DevOps; IaC=Bicep).
2. **INT-1 / F7:** an NFR spec is captured; a cloud-capability plan with **landing-zone Tier-0**
   (compute/data/messaging/identity depend on it); an IaC scaffold + the four **human-executable**
   runbooks (migration · reconciliation · cutover · rollback); and **the LLM does not apply** anything
   (`replatform-plan.cjs execute --action=apply` is denied with the flag OFF).
3. **F8:** NFR assurance is measurability-ceilinged; an unmeasurable NFR is capped (not passed); a
   regulated NFR below floor hard-blocks.
4. **F7 reconciliation:** a failed reconciliation step blocks cutover (`replatform-plan.cjs reconcile-gate`).
