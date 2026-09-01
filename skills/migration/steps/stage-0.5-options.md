# Migration Step — Stage 0.5: Target Options Analysis

_Part of the `migration` skill. Loaded and dispatched by the orchestrator
(`skills/migration/SKILL.md`) — not a standalone/registered skill. Cross-session resume: `MIGRATE OPTIONS ADO-{ID}`._

**Persona:** [SA] Rafael Mendes — Solution Architect. **Model tier:** `${ICEA_MODEL:-claude-opus-4-8}`.
**Checkpoint:** single source of truth (schema 1.9); the approval is persisted as
`stage_gates.options_approved = true` when the Step 0.4 checkpoint is written (or merged in place if a
checkpoint already exists).

---

Run this **before Q1** (Step 0.3) unless the run is a pure `dotnet` version upgrade — for a version
upgrade there is no genuine target choice: skip to Q2, and `options_approved` is recorded `true` when
the checkpoint is written at Step 0.4.

```
Read $PLUGIN_DIR/skills/migration/references/specs/target-options-spec.md
```

Produce `docs/.../ADO-{ADO_ID}-target-options.md` (planning doc, no Write Gate) with:
- 2–3 scored candidate targets,
- a migration posture per bounded context (port / re-architecture / rewrite-from-spec),
- a weighted decision matrix,
- a rough order of magnitude, and
- ONE recommendation expressed as an ADR.

Then present the Stage 0.5 gate from that spec and **STOP**. Only `APPROVE OPTIONS ADO-{ADO_ID}` (or an
explicit override naming another candidate) advances. Record the approval — it is persisted as
`stage_gates.options_approved = true` when the checkpoint is written at Step 0.4 (or updated in place if
a checkpoint already exists from a prior run) — then pre-fill Q1 with the recommendation. This turns Q1
from a cold menu pick into a confirmation.

> Resume (`MIGRATE OPTIONS ADO-{ADO_ID}`): requires the source confirmed (Step 0.1). Re-read the
> target-options spec and regenerate/refresh `ADO-{ADO_ID}-target-options.md`, then re-present the gate.
