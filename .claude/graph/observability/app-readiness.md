---
paths: skills/app-readiness
---
_Fingerprint: eba9e2240bc532d6a58421f255bf3591f4efd9aa | Updated: 2026-07-18_

## Bounded context
Application production readiness assessment from Enterprise / Solution Architect perspective. Evaluates domains per hosting model. VSTO add-ins use a separate 7-domain checklist (Signing & Trust, ClickOnce Manifest, Office Compatibility, Build Pipeline, Test Coverage, Secrets, Runbook). Requires `architecture-deployment.md`.

## Key files
- `SKILL.md` — detects HOSTING_MODEL=vsto from deployment doc; loads vsto-checklist.md and runs ClickOnce/signing evidence collection
- `references/vsto-checklist.md` — VSTO-specific readiness checklist with Green/Yellow/Red thresholds for 7 domains

## Dependencies
- `.claude/architecture/architecture-deployment.md` — blocks if missing
- `.claude/architecture/architecture-security.md`

## Patterns
- Flags: --quick (~12K tokens) | --full (targeted source reads for Red domains, ~25K tokens)
- VSTO branch replaces IIS/container domains with ClickOnce/signing/Office compatibility domains
