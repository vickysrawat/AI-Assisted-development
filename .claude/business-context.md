# Business Context — ai-assisted-development Plugin

**Domain:** generic (developer tooling)
**Jurisdiction:** US
**Generated:** 2026-09-23

## Summary

This is a local Claude Code plugin used by software development teams. It processes developer codebase excerpts, ADO work items, and project documentation. It does not handle regulated personal data (no healthcare, financial, or legal records), payment information, or government-classified information. The primary sensitivity is intellectual property (source code).

## B-Series Triggers

| Code | Trigger | Action |
|---|---|---|
| B1 | Source code excerpts from client/proprietary codebases | Announce files before reading; obtain Category B consent per `skills/shared/source-file-consent.md` |
| B2 | ADO work item content that may contain business-sensitive feature descriptions | Do not log or persist beyond memory/MEMORY.md without developer awareness |
| B3 | Developer credentials / PAT tokens appearing in any context | Block write immediately (secret-guard hook); never log |
| B4 | Architecture docs describing security posture of client systems | Do not include in prompts sent to external services without developer consent |

## Regulatory Frameworks

No mandatory regulatory frameworks apply to this generic developer tooling context. The B-series above is derived from:
- **IP protection**: source code is proprietary intellectual property
- **Credential hygiene**: ADO PATs and API keys are high-value secrets
- **Data minimisation**: only the minimum codebase context needed for each task should be read

## Notes

- The plugin's own `memory/` and `.claude/architecture/` files may contain project-specific architectural details — treat as internal/confidential
- When operating against client project repos (as a plugin in a target project), the target project's own `business-context.md` governs — not this file
