# Data Handling & Privacy Statement

**Plugin:** ai-assisted-development  
**Version:** 3.25.0+  
**Last updated:** 2026-09-20  
**Audiences:** developers using the plugin · compliance and legal teams

---

## Executive Summary

This plugin runs locally on the developer's machine. It reads source code, architecture
documents, and project governance data to assist with software development. The plugin
itself stores all data locally — it does not transmit data independently.

Data does reach Anthropic's servers as part of normal Claude Code operation: when a
developer invokes any plugin skill, the prompt content (which may include code, ICEA
documents, or other project material) is sent to Anthropic's API for processing.
**This transmission is governed by your organisation's agreement with Anthropic, not
by this plugin.** Reference your Anthropic enterprise contract and Data Processing
Addendum (DPA) for coverage of that data flow.

---

## 1. Data Inventory

### 1a — Data stored locally (never transmitted by the plugin)

| Data | Location | Committed to git? | Retention |
|---|---|---|---|
| Governance audit trail | `.claude/audit/*.json` | Yes — by design (immutability) | Until manually deleted from git history |
| Memory / learned patterns | `memory/MEMORY.md`, `memory/topic-*.md` | Yes | Until `/dream` deletes processed entries |
| Project knowledge patterns | `.claude/project-knowledge.md` | Yes | Until removed via `KNOWLEDGE REMOVE` |
| Architecture documentation | `.claude/architecture/*.md` | Yes | Until regenerated via `/update-arch` |
| Codebase knowledge graph | `.claude/graph/*.json`, `*.md` | Yes | Until regenerated via `/graph-sync` |
| Plugin configuration | `.claude/settings.json` | Yes (secret-free — guarded) | Persistent |
| Local secrets / PAT | `.claude/settings.local.json` | No — gitignored | Machine-local |
| Onboarding guide | `docs/ONBOARDING.md` | Yes | Until regenerated |
| Governance reports | `governance/*.md` | Yes | Until manually deleted |
| Token analysis | `token-analysis/token-graph.json` | No — gitignored | Machine-local |
| Approval roles | `.claude/ApprovalRoles.json` | Yes | Until edited |
| ICEA documents | `docs/Release*/Sprint*/**.icea.md` | Yes | Persistent artefact |

### 1b — Data transmitted to Anthropic (via Claude Code)

When a developer invokes a skill, the prompt sent to Claude may include:

- Source code excerpts (read by skills under explicit consent — see below)
- Architecture document content
- ICEA and Tech Spec document content
- Commit messages and branch names
- Error messages and stack traces
- Conversation history (managed by Claude Code's context window)

**The plugin does not call the Anthropic API directly.** All transmission occurs through
the Claude Code client, which the developer has installed and authenticated. The plugin
is a passenger in that session — it contributes content to prompts but does not initiate
API calls independently.

### 1c — Data the plugin explicitly does NOT read

- Contents of files the developer has not opened or referenced in the session
- Files outside the project root and configured `additionalDirectories`
- Contents of `.claude/settings.local.json` (secret store — hook guards block its exposure)
- Database contents, production logs, or external service data

---

## 2. Data Flow

```
Developer machine
  │
  ├─ Plugin reads:
  │    architecture docs · graph · ICEA files · audit trail · settings
  │
  ├─ Plugin writes (locally):
  │    audit events · memory entries · governance reports · generated code
  │
  └─ Claude Code sends prompts to:
         │
         └─ Anthropic API  ←── governed by your Anthropic enterprise agreement
              │
              └─ Response returned to Claude Code session (not stored by plugin)
```

---

## 3. For Developers — Practical Data Hygiene

**What gets sent to Anthropic:**
Any text visible in the Claude Code session — including architecture docs, ICEA content,
and code snippets that skills read — becomes part of the prompt sent to Anthropic's API.

**What you should never put in prompts, ICEA documents, or commit messages:**
- Authentication credentials, API keys, connection strings, or passwords
- Production personally identifiable information (PII) — use anonymised test data
- Client-confidential content beyond what is necessary for the development task

**What is safe to include:**
- Code, design decisions, and technical specifications — this is normal software development
- Architecture descriptions and system design — expected use case

**Gitignored files stay local:**
`.claude/settings.local.json`, `token-analysis/`, `temp/` — these are never committed
and remain on your machine only. The plugin's `.gitignore` managed block covers these.

**The audit trail is committed:**
`.claude/audit/*.json` events are committed to git by design — they form the immutable
governance trail. Do not store sensitive business data in the `context` field of audit events;
the plugin populates this field with generic governance labels only.

---

## 4. For Compliance Teams — GDPR Considerations

### 4a — Roles under GDPR

| Entity | Role | Basis |
|---|---|---|
| Your organisation | Data Controller | Determines purposes of processing; operates the development workflow |
| Anthropic | Data Processor | Processes prompt data per your enterprise DPA with Anthropic |
| Plugin author | Not a data processor | Plugin runs locally; no data is transmitted to the plugin author |

The plugin author receives no data, telemetry, or usage information from deployments.
The plugin contains no analytics, tracking pixels, or callback URLs.

### 4b — Personal data in scope

Personal data that may be processed:

| Category | Example | Where it appears |
|---|---|---|
| Developer identity | `git config user.email` | Audit trail, governance report |
| Developer identity | `git config user.name` | Memory entries, audit trail |
| Approval role assignment | email addresses in `ApprovalRoles.json` | Committed to git |
| Session metadata | Claude Code conversation IDs | Dream consolidation (read-only) |

No special-category personal data (health, biometric, religious, etc.) is processed
by the plugin in normal operation.

### 4c — Lawful basis (Art. 6 GDPR)

Processing of developer identity data (email, name) in the audit trail is based on:
- **Legitimate interest** (Art. 6(1)(f)): maintaining an immutable governance audit trail
  is a legitimate interest of the organisation operating the development workflow.
- The audit trail records who performed governance actions (approved ICEAs, dismissed
  findings, bypassed gates) — this is analogous to a code-signing log or access control log.

### 4d — Data subject rights

**Right to access (Art. 15):** developer identity data appears in `.claude/audit/*.json`
(committed to git). A data subject can inspect these files directly or request a
`GOVERNANCE REPORT` to see all events attributed to their email.

**Right to erasure (Art. 17):** audit trail entries are committed to git. Erasure from
the live files is straightforward (delete the file). Complete erasure from git history
requires `git filter-repo` or equivalent — document this procedure in your organisation's
DSAR process. `ApprovalRoles.json` entries can be removed by editing the file and committing.

**Right to rectification (Art. 16):** email addresses in `ApprovalRoles.json` can be
corrected by editing the file. Audit entries contain the email as recorded at event time
— correction requires editing the committed JSON files.

**Right to portability (Art. 20):** audit trail events are structured JSON — machine-readable
by design. A `GOVERNANCE REPORT` export provides a human-readable summary.

### 4e — Data Processing Addendum with Anthropic

Your organisation's data processing relationship with Anthropic covers the prompt data
that flows through Claude Code. Ensure:

1. A valid DPA is in place with Anthropic covering your jurisdiction
2. Standard Contractual Clauses (SCCs) or equivalent mechanism is in place if data
   leaves the EEA (Anthropic processes in the US; EU data transfer mechanisms apply)
3. Your Anthropic enterprise agreement includes the privacy and confidentiality provisions
   appropriate for your use case

The plugin cannot substitute for or satisfy these requirements — they are between your
organisation and Anthropic.

### 4f — Data Protection Impact Assessment (DPIA)

A DPIA may be required under Art. 35 if the development workflow systematically
processes special-category data or large volumes of personal data. For typical software
development use, the only personal data in scope is developer identity (email/name)
in the governance audit trail — a low-risk processing activity.

If your ICEA documents or generated code routinely handles health data, criminal records,
or other special-category data, assess the prompt content sent to Anthropic's API as
part of your DPIA for that data processing activity.

---

## 5. Attorney-Client Privilege Considerations (Law Firm Context)

The plugin is designed for software development workflows. Prompts sent to Anthropic's
API during plugin skill execution may include descriptions of software features, technical
specifications, or design documents.

**If a software feature implements legal functionality** (e.g., matter management, billing,
client portal), the ICEA document describing that feature may characterise the legal workflow.
Whether such content is privileged depends on its nature and the context of the communication
— consult your professional responsibility counsel.

Practical guidance:
- ICEA documents should describe software behaviour, not legal strategy
- Do not include client-identifying information in ICEA documents or architecture docs
  unless necessary for the technical specification
- The plugin's ICEA Examples section expects technical input/output pairs — not
  descriptions of legal advice or client matters
- Review your Anthropic enterprise agreement for confidentiality provisions covering
  API prompt content

---

## 6. Data Retention Summary

| Data | Retention period | Deletion method |
|---|---|---|
| Audit trail | Indefinite (committed to git) | `git filter-repo` for full erasure |
| Memory files | Until next `/dream` run processes them | Delete file or `KNOWLEDGE REMOVE` |
| Governance reports | Indefinite (committed to git) | `git rm governance/governance-report-*.md` |
| ApprovalRoles entries | Until edited | Edit `.claude/ApprovalRoles.json` and commit |
| Token analysis | Machine-local; no automatic deletion | Delete `token-analysis/token-graph.json` |
| Settings (local) | Machine-local; no automatic deletion | Delete `.claude/settings.local.json` |

---

## 7. Contact

For data subject access requests, erasure requests, or compliance questions related
to this plugin's deployment in your organisation, contact your internal data protection
officer or the team responsible for developer tooling.

For questions about Anthropic's data processing, refer to:
- Anthropic Privacy Policy: https://www.anthropic.com/privacy
- Your Anthropic enterprise agreement and DPA

For issues with the plugin itself: https://github.com/anthropics/claude-code/issues
