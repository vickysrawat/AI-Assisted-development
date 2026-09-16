# Learning Log — Entry 13: Business Context (domain-aware severity)

> Judge-defense study log. Explanation + judge-ready line + summary per concept.
> Companion: entry = `../13-business-context.md`; source specs:
> `skills/shared/business-context-severity.md`, `business-context-generation.md`, `business-context-presets.md`.

**The spine:** learn the project's domain + jurisdiction, ground a **B-series** sensitivity policy in
cited regulations, and apply it so **business severity can only raise a finding, never lower it**,
across every review. "CVSS is a floor, not a ceiling."
**Boundary vs Entry 11:** Entry 11 = *how* the policy is researched safely (airgapped agents); Entry 13 =
*what the policy is and what it governs* (severity across the toolchain).

**Concept map (6):** (1) core problem (context-blind severity) · (2) the B-series + generation flow · (3)
the floor-not-ceiling override rule · (4) applied across every review + disclosed by ID · (5) beyond
severity (what-counts / remediation) · (6) evidence + framing.

Status: ✅ locked.

## Concept 1 — Context-blind severity
**Explanation:** technical scores (CVSS) are context-blind: a 7.5 whether the data is cat photos or
medical history. In a regulated domain, "PII to the console" isn't informational, it's a confidentiality
breach with notification duties. Reviewing on the technical score alone waves through the finding that
ends your afternoon in a compliance meeting.
**Judge line:** *"CVSS scores the mechanism, not the consequence. It'll call a leak a 7.5 whether it's
cat photos or someone's medical history. In a hospital, that's not a 7.5, it's a breach."*
**Summary:** *Technical severity is consequence-blind; regulated domains need business severity.*
Covers: #2.

## Concept 2 — The B-series + generation flow
**Explanation:** the plugin infers the domain (from the data model), confirms domain + jurisdiction with
you, and grounds a **B-series** (ordered triggers B1..Bn, length domain-defined) in cited regulations.
Locked-preset domains (legal) are copied byte-for-byte; others start from a checklist. Written to
`.claude/business-context.md` on APPROVED, with citation + retrievalDate per trigger.
**Judge line:** *"It figures out what business you're in, confirms it with you, and grounds a
domain-specific trigger list in the actual regulations — cited, dated, and only written once you approve."*
**Summary:** *Infer→confirm domain+jurisdiction→ground B-series in cited regs→APPROVED→business-context.md.*
Covers: #3.

## Concept 3 — The floor-not-ceiling override rule (the crux)
**Explanation:** reported severity = the **higher** of (technical score, business severity). Business
context can only **raise**, never lower. The override check is mandatory on **every** finding in **every**
review. Resolution is project-local-first (`.claude/business-context.md` beats the neutral fallback).
**Judge line:** *"One rule everywhere: severity is the higher of the technical score and the business
severity. Context can raise it, never lower it; a floor that couldn't rise wouldn't protect anyone."*
**Summary:** *Reported = max(technical, business); business raises only; check runs on every finding.*
Covers: #4, #6, #8.

## Concept 4 — Applied across every review + disclosed by ID
**Explanation:** consumed by security, code-review, icea-review, checkin, pr-spec-review, the critic
(B-coverage), and app/plugin-readiness (B-series findings are blockers). When business severity exceeds
technical, the override is **stated by trigger ID** with the technical score shown alongside; no silent
inflation. Business-Critical **blocks**, it's not a warning.
**Judge line:** *"Every review applies it, and when it fires it shows its work: 'Critical, business
override, B1, technical score 7.5.' You see the number, the override, and exactly which regulation-grounded
trigger made the difference."*
**Summary:** *All review skills apply it; overrides disclosed by trigger ID with technical score shown;
business-Critical blocks.*
Covers: #4, #6, #8.

## Concept 5 — Beyond severity (what-counts / remediation)
**Explanation:** business context also changes *what counts as a finding at all* (PII to console:
informational generically, High in a confidentiality domain) and *what counts as remediation*: for
committed regulated data, "delete the file" isn't done until git history is purged, access logs checked
from first commit, and notification obligations assessed.
**Judge line:** *"It doesn't just re-score, it changes what's even a finding, and it tells you that
deleting a leaked file isn't remediation until you've purged git history and checked who accessed it."*
**Summary:** *Also reshapes what-counts-as-a-finding and what-counts-as-remediation, not just severity.*
Covers: #6, #8.

## Concept 6 — Evidence + framing
**Explanation:** measured. The severity model + override discipline are specified and consumed by every
review skill; project-local-first resolution; disclosed-by-ID overrides; remediation-completeness
definition. **Not-yet-evaluated:** whether it catches more *real* domain breaches than a generic scan.
**Judge line:** *"What's real is the model: floor-not-ceiling, applied everywhere, disclosed by ID.
Whether it beats a generic scan on real breaches, not-yet-evaluated."*
**Summary:** *Evidence = severity model + override discipline across all reviews. Real-breach hit-rate
not-yet-evaluated.*
Covers: #6, #8.

## Quick map: concept → form field
| Field | Concepts |
|---|---|
| #1 pitch | 1 + 3 |
| #2 problem | 1 |
| #3 working today | 2, 4 |
| #4 AI role | 2, 3, 4 |
| #5 flow | 2, 3 |
| #6 value + evidence | 3, 5, 6 |
| #7 resourceful | 2 (one B-series drives all reviews) |
| #8 responsible AI | 3, 4, 5 |
| #9 demo | 3/4; `../../demo-scripts.md` §Entry 13 |

## The 3 lines that win Entry 13
1. **Problem:** "CVSS scores the mechanism, not the consequence: cat photos or medical history, same 7.5."
2. **The rule:** "Severity is the higher of the technical score and the business severity; context raises, never lowers."
3. **Transparency:** "When it overrides, it shows its work: the technical score, the business score, and the exact trigger by ID."
