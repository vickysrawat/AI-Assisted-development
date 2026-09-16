# Learning Log — Entry 08: Support Handover (Operations + Go-Live)

> Judge-defense study log. One section per concept: explanation + judge-ready line + summary.
> Companion docs: entry = `../08-handover.md`; evidence = `../../measured-claims.md` §4;
> demo = `../../demo-scripts.md` §Entry 8. Source specs: `skills/operations/SKILL.md`, `skills/go-live/SKILL.md`.

**The spine:** the two docs a support team needs: a **living operational runbook** (operate-in-prod)
and a **one-time go/no-go acceptance gate** (accept-into-support), both **evidence-derived and never
fabricated** (missing input → visible `⚠ TODO`; missing ledger → "unverified" blocker, not a pass).
Lead category: Clear story / demonstrated readiness.

**Concept map (7):** (1) core problem: handover is tribal, two needs conflated · (2) two docs, two
jobs · (3) operations = evidence-derived runbook · (4) go-live = capstone that ingests the ledgers ·
(5) never fabricate / never false-pass · (6) consent/scope · (7) evidence + framing.

Status: ✅ Concepts 1–7 locked.

---

## Concept 1 — The core problem
**Explanation:** support handover is usually tribal knowledge (no runbook, or a stale one), and
"can we accept this into support?" is decided with no evidence. Two distinct needs get conflated or
skipped: how to **operate** the app, and whether to **accept** it. An AI told to "write the runbook"
will invent a rollback step, worse than none.
**Judge line:** *"Handover is where knowledge goes to die: no runbook, and a go/no-go decided on
vibes. And a made-up rollback step is more dangerous than a missing one."*
**Summary:** *Handover is tribal; operate-vs-accept are conflated; fabricated ops steps are dangerous.*
Covers: #2.

## Concept 2 — Two docs, two jobs
**Explanation:** `/operations` = the **living operational runbook** (the doc you open at 3am);
`/go-live` = the **one-time Support-Transition Acceptance Checklist** (go/no-go). Deliberately
separate; a one-time sign-off table doesn't belong in a living runbook.
**Judge line:** *"Two documents for two different moments: the runbook you live with in production,
and the one-time acceptance gate you sign at go-live. We keep them apart on purpose."*
**Summary:** *operations = living runbook (operate); go-live = one-time acceptance gate (accept).
Kept separate.*
Covers: #3.

## Concept 3 — Operations = evidence-derived runbook
**Explanation:** a 16-section master runbook (at-a-glance, arch + dependency map, envs + resources,
access, routine ops, health/logs, secrets + rotation, triage, failure-mode playbooks, known issues,
backup/DR, escalation, incident comms, support targets, command appendix, maintenance) with **four
Mermaid diagrams**; **Markdown source of truth + offline HTML companion (no CDN)**. Every recovery
path ends with a **✅ confirm-resolved smoke test**; secret **names** only.
**Judge line:** *"It's the 3am document: sixteen sections, four diagrams, and every recovery ends
with a smoke test so you know it actually worked. Markdown source of truth, offline HTML companion,
no CDN."*
**Summary:** *16-section runbook + 4 Mermaid diagrams, MD source + offline HTML; every recovery ends
with a confirm-resolved smoke test.*
Covers: #3.

## Concept 4 — Go-live = capstone that ingests the ledgers
**Explanation:** the one-time acceptance checklist **ingests** the latest prod-readiness report +
security ledger + code-review ledger + deployment arch + pipeline, and derives **Section-A blockers**
(open Critical/High, Red readiness domains, failed deploy preconditions) + **Section-B fast-follows**.
The recommendation (go / conditional-go / no-go) is grounded **only** in those rows; FP-ids / CIDs
are copied **verbatim**.
**Judge line:** *"Go-live doesn't re-analyze anything; it's the capstone that turns the readiness,
security, and code-review ledgers into one accept/reject decision, with every finding id copied
verbatim from its ledger."*
**Summary:** *go-live ingests readiness + security + code-review + deployment → Section A/B →
grounded go/no-go; ids copied verbatim.*
Covers: #3, #6.

## Concept 5 — Never fabricate / never false-pass (the trust crux)
**Explanation:** unknowables → `⚠ TODO`; a **missing ledger is an "unverified" blocker row, not a
pass** ("the risk is unverified, which is itself a blocker"); go-live **never emits "go" while a
Section-A 🔴 is open**; operations never invents topology/procedure/contact and writes secret names
only. Owners/dates/sign-offs are always `⚠ TODO` (human-owned).
**Judge line:** *"Missing input becomes a visible TODO, never a silent pass. A missing ledger means
the risk is unverified, and unverified is a blocker, not a green tick. It will not say 'go' while a
red is open."*
**Summary:** *Unknown → ⚠ TODO; missing ledger → unverified blocker; no "go" over an open 🔴; secret
names only. Honesty by construction.*
Covers: #5, #6, #8.

## Concept 6 — Consent / scope
**Explanation:** `/operations` is **Category B**: Steps 1–3 derive most of the runbook with no source
reads; playbook derivation may need **≤6 consent-gated source files**. `/go-live` is **Category C**:
reads generated reports, ledgers, architecture, pipeline **only; never application source**.
**Judge line:** *"The runbook reads source only for failure-mode playbooks, only with consent, capped
at six files. The acceptance gate never reads source at all, just the reports and ledgers."*
**Summary:** *operations Category B (≤6 gated files, playbooks only); go-live Category C (reports/
ledgers only, never source).*
Covers: #4, #8.

## Concept 7 — Evidence + framing
**Explanation:** measured design facts: degrades to `⚠ TODO` rather than false-passing; reads
reports/ledgers not source (go-live Category C); the capstone-ingestion design. **Not-yet-evaluated:**
handover-success / MTTR improvement. Quality depends on the upstream ledgers existing.
**Judge line:** *"What's proven is the honesty: TODO over fabrication, unverified-is-a-blocker,
findings copied verbatim. Whether it lowers MTTR at handover: not-yet-evaluated."*
**Summary:** *Evidence = never-false-pass + ledger-only + capstone ingestion. MTTR/handover outcomes
not-yet-evaluated.*
Covers: #6, #8.

---

## Quick map: concept → form field
| Field | Concepts |
|---|---|
| #1 pitch | 1 + 2 |
| #2 problem | 1 |
| #3 working today | 2, 3, 4 |
| #4 AI role | 3, 4, 6 |
| #5 flow + checkpoints | 3, 4 |
| #6 value + evidence | 4, 5, 7 |
| #7 resourceful | 4 (ingests, no re-analysis) + 3 (offline HTML) |
| #8 responsible AI | 5, 6, 7 |
| #9 demo | 3 + 4; `../../demo-scripts.md` §Entry 8 |

## The 3 lines that win Entry 08
1. **The hook:** "The handover that writes itself: the two docs a support team needs to accept an app."
2. **Honesty:** "Missing input becomes a visible TODO, never a silent pass, and a missing ledger is a blocker, not a green tick."
3. **Capstone:** "Go-live doesn't re-analyze; it turns the readiness, security, and code-review ledgers into one accept/reject call, ids copied verbatim."
