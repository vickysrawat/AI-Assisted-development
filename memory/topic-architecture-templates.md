# Architecture Templates

> Consolidated from MEMORY.md auto-capture entries (2026-07-09 to 2026-07-17).
> Dream run: 2026-08-25. Confidence: 0.85 (avg).

---

## Doc-Set Expansion (4 to 8 files, ADR 0050, v3.8.0)

Expanded per-stack architecture doc set to close structural blind spots. New files:
- `architecture-data.md` — schema/entities/ownership
- `architecture-integrations.md` — external deps + timeout/retry/circuit-breaker/SLA
- `architecture-security.md` — trust zones + authorization model
- `architecture-decisions.md` — evolving AD-NNN log (seed only, never auto-invent rationale)

Plus: NFR section in `architecture-deployment.md`, two Mermaid diagrams in `architecture.md` (End-to-End flowchart LR + Layered flowchart TB replacing ASCII).

## _shared/ Dedup Pattern (ADR 0051)

`skills/architect/templates/_shared/` holds common templates (decisions, integrations, security, data-backend-base). Stack folders keep only stack-specific files + overrides. Bootstrap `stepPreCopyArchTemplates` composes `Map<filename,src>` from _shared/ then overlays stack/ (stack wins collisions). 88 to 56 files.

**Critical coupling:** file-moves and bootstrap compose rewrite MUST ship atomically — moving common files to _shared/ without the rewrite makes every non-dotnet stack deploy incomplete.

## Mermaid Diagram Standards

All template files use `<div style="background-color: white; padding: 25px; border-radius: 8px;">` wrappers.

**Node color palette:**
- User: `#7F8C8D`
- Backend: `#1F618D`
- Frontend: `#3498DB`
- External: `#1ABC9C`
- DataStore: `#2C3E50`
- Proxy/Office: `#E67E22`
- Auth: `#8E44AD`

Every `style` directive must include `color:`, `stroke:`, and `stroke-width:2px` (not just `fill:`).

## VSTO Stack Support

VSTO added as supported stack (12 files modified + 14 created). Key gotcha: VSTO csproj lacks System.Web/System.ServiceModel so external-stack-detection.cjs must explicitly force dotnet_framework. Tech spec overlay must check for vsto token BEFORE the generic dotnet_framework row.

## Two-Phase Bootstrap for Templates

Phase 2 (`--mode post-detect --repo-type TYPE`) pre-copies 4 architecture template files with `<!-- TEMPLATE -->` marker stripped so architect skips expensive bash detection in Steps 0.5-6.

## Consumers

Wired: security Step 0g (loads architecture-security.md), icea-feature (data/integrations + seeds AC-NF), icea-review, app-readiness (NFR/security scores). `/update-arch` supports `--data|--integrations|--security|--decisions` refresh flags.
