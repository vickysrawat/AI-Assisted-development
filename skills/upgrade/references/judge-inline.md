# Upgrade — LLM-as-Judge (extracted to the shared substrate)

> **Moved.** As of Story 2 (ADO-9000), the LLM-as-judge layer is canonical in
> **`skills/shared/judge.md`**. This file is a redirect kept only so older references resolve — do
> not add content here (the shared folder is the single source of truth; skill-local copies are
> forbidden once promoted).

Upgrade's gates (report · residual · verify) use the shared judge: an independent agent (artifact +
rubric + ground-truth only) on a separate model, adversarial-by-default, returning `PASS`/`REVISE`/
`BLOCK`, risk-scaled per the three-tier ladder in `skills/shared/model-routing-spec.md`. Verdicts are
recorded in the ledger (`judge_verdicts` / `stage_gates`).
