# Plan — `operations` (master Runbook) + `go-live` (transition gate) skills

> **Status:** Implemented.
> **Author context:** AI-architect brainstorm session, 2026-09-04.
> **Golden master:** `C:/Users/rawatv/source/AI-POD/ELSA/docs/operations/` (real, hand-made
> ops-transition package — the templates are reverse-engineered from it).
> **Ephemeral plan mirror:** `~/.claude/plans/polymorphic-rolling-wombat.md`.

---

## 1. Context — why these skills exist

The plugin can *assess* operational readiness ([app-readiness](../../skills/app-readiness/SKILL.md)
EA-7 literally `grep`s for a `RUNBOOK*` file and scores **Red** when missing) but has **no skill
that produces the artifact**. [product-docs](../../skills/product-docs/SKILL.md) covers
stakeholder / end-user docs; nothing covers:

- the **operate-in-prod** audience — the support engineer keeping a live app running, and
- the **go-live transition gate** — the sign-off authorities deciding whether to accept the app
  into support.

Two new skills fill that gap. Running them closes the loop: app-readiness flags "no runbook →
EA-7 Red" → `/operations` generates one → re-run app-readiness → EA-7 goes Green.

---

## 2. Key architectural decisions

### 2.1 Two skills, split by lifecycle (SRP)

| Skill | Lifecycle | Audience | Output | Inputs |
|---|---|---|---|---|
| **`operations`** | Living, incident-driven | 3am support engineer | **ONE master Runbook** (Markdown + HTML companion) | **Live-system truth only** — architecture docs, config, IaC/pipeline, consent-gated code reads. **No ledgers.** |
| **`go-live`** | One-time gate | Sign-off authorities | Transition Acceptance Checklist | **Capstone** — ingests `prod-readiness/` report, security ledger, code-review ledger + architecture + pipeline |

A ledger-synthesizing go/no-go gate does not belong inside a support-doc generator. `go-live` is
the natural capstone that consumes `app-readiness` + `security-review` + `code-review` outputs.

### 2.2 Merge the operate-cluster into ONE Runbook (revised from an earlier 3-doc split)

The ELSA package used four files, but the Runbook was already the superset — **Ownership** lived
in §11, **Secrets** in §6, **Backup/DR** in §10. The separate Ownership Matrix and Secrets Rotation
Calendar were expansions of sections that already existed in the runbook.

**Decision:** `operations` emits **one master Runbook** that absorbs Ownership + Secrets as full
sections. Rationale:
- The runbook's stated purpose is *"the single document a support engineer opens when something is
  wrong"* — one file at 3am beats four (simplicity-first).
- The "different refresh cadence" concern that argued for splitting is solved **inside** one doc
  with per-section **"Last reviewed"** stamps + a **maintenance table** — separate files are not
  required to track staleness.

**The go-live Acceptance Checklist stays a separate doc/skill** — it is a one-time gate consumed
once and archived, and it ingests the ledgers. A dev-team sign-off table does not belong in a
*living* operational runbook (it would sit stale forever after go-live).

### 2.3 Markdown source of truth + self-contained HTML companion

- **Markdown** in `docs/operations/` is the source of truth — versioned, diffable, and
  grep-discoverable by app-readiness EA-7.
- **HTML** is a *rendered view* of the same content for navigation / print — not a second source.
- **HTML + Mermaid caveat:** self-contained HTML must **vendor `mermaid.min.js` locally** (as
  `graph-viz` vendors its WebGL lib) or **pre-render diagrams to inline SVG** — **no external CDN**,
  per the plugin convention in `product-docs` ("do not add external CDN links").

### 2.4 No ICEA, no gates

Both skills are documentation generators (like `product-docs`). They do **NOT** use the ICEA
pattern, the source Write Gate, the critic gate, or any `APPROVE ADO-{ID}` flow. The CLAUDE.md
Feature Gate blocks *implementation code* only; doc generation is exempt. The only interaction is
the "which docs / confirm scope?" prompt (a selection, not a gate). Each SKILL.md states this
exemption explicitly.

### 2.5 Never fabricate — the `⚠ TODO` discipline

A runbook with an invented rollback step is more dangerous than no runbook. Every value that must
come from a human or a live check is an explicit, greppable **`⚠ TODO`** placeholder (adopted
verbatim from ELSA). Every shell command carries a **"⚠ verify against live/CLI"** caveat. Failure
modes and diagram topology are derived **only** from concrete evidence; anything beyond evidence →
`⚠ TODO`. This is the skill's spine.

---

## 3. Skill 1 — `operations` (master Runbook)

**Pattern:** [product-docs](../../skills/product-docs/SKILL.md) (confirm-scope + template-fill +
write-and-confirm) + [app-readiness](../../skills/app-readiness/SKILL.md) (bash evidence sweep +
Category B source-file consent).

- **Model:** generation tier (`ICEA_MODEL`, default opus).
- **Persona:** new SRE / on-call engineer ("what do I do *right now* to restore service?"), per
  `skills/shared/personas-spec.md` (never named in output; never licenses assumption).
- **Consent:** Category B — architecture docs + bash signals produce most content with no source
  reads; failure-mode playbook derivation is consent-gated per `skills/shared/source-file-consent.md`.
- **Output:** `docs/operations/{Project}-Operational-Runbook.md` + `…-Operational-Runbook.html`.

### 3.1 Master Runbook structure (superset, genericized from ELSA)

1. At a glance
2. Architecture recap — **+ Mermaid dependency graph**
3. Environments + resource inventory
4. Access a support engineer needs (pre-incident)
5. Routine operations — deploy / rollback / restart / migrations — **+ Mermaid deploy+rollback flow**
6. Health, logs & monitoring — **+ per-signal alert table (what / where / threshold)**
7. **Secrets & rotation** — absorbs the Secrets Rotation Calendar (inventory + procedures + calendar)
8. Symptom → layer → playbook map — **+ Mermaid triage decision tree**
9. Failure-mode playbooks — each: Symptoms → Diagnose → Recover → **Smoke-test / confirm resolved** → Escalate
10. Known issues & watch-items
11. Backup & disaster recovery
12. **Escalation & ownership** — absorbs the Ownership & Contacts Matrix (app / resource / dependency ownership + severities) — **+ Mermaid escalation flow**
13. **Incident comms & time-to-declare** (notify who, status cadence, P1/P2/P3 thresholds)
14. Support targets & open questions
15. Appendix — quick command reference
16. **Maintenance & review cadence** — per-section "Last reviewed" stamps + owner table

Sections **7, 12, 13, 16** and the improvements in **6, 9** are the enhancements over the
hand-made ELSA runbook.

### 3.2 Mermaid diagrams (evidence-derived; unknown edges → `⚠ TODO` nodes, never invented)

| Section | Diagram | Type |
|---|---|---|
| §2 Architecture recap | Component/dependency graph (client → app → dependencies, auth mechanism per edge) | `flowchart` |
| §5 Routine ops | Deploy & rollback flow (build → registry → per-env deploy, manual-approval points) | `flowchart` |
| §8 Symptom→playbook | Triage decision tree (symptom → layer → playbook §) | `flowchart` |
| §12 Escalation | Severity → first responder → escalation path | `flowchart` |

### 3.3 Steps (in SKILL.md)

0. **Scope** — confirm the target project + that the Runbook (and HTML companion) will be generated.
1. **Load evidence — no ledger reads:** `.claude/architecture/*.md`; resource/env grid from
   `pipelines/ENVIRONMENTS.md` / `azure-pipelines*.yml` / bicep/terraform; config
   (`appsettings*.json`, `.env*`, `VITE_*`); `db/` scripts; package manifests. Bash-signal sweep
   (health / logging / APM / retry / timeout / secrets / graceful-shutdown) — reuse the grep block
   in [app-readiness Step 3](../../skills/app-readiness/SKILL.md).
2. **Load references:** the runbook template (MD + HTML) + shared specs (`source-file-consent`,
   `personas-spec`, `model-routing-spec`, `business-context-severity`).
3. **Derive** resource/env grid + secrets inventory (UAMI vs stored-secret, blast radius per secret).
4. **Derive** symptom→layer map (from user features + dependency graph) and failure-mode bodies
   (evidence-gated, consent-gated source reads); unknowns → `⚠ TODO`.
5. **Fill** the template; build Mermaid diagrams from the derived topology; apply B-series
   business-context flagging (e.g. PII-adjacent logs like ELSA `search_log`).
6. **Quality gate:** no unfilled `{{PLACEHOLDER}}`; every `⚠ TODO` intentional; every command has a
   "⚠ verify" caveat; no invented procedure; every Mermaid block is well-formed and topology-honest.
7. **Write** the MD, then render the HTML companion from the same content; confirm + list sources +
   count open `⚠ TODO`s.

---

## 4. Skill 2 — `go-live` (Transition Acceptance Checklist)

**Purpose:** the go/no-go gate deciding whether the app is accepted into support at go-live.

- **Model:** infrastructure tier (`INFRA_MODEL`) — assessment/synthesis, like app-readiness.
- **Persona:** the app-readiness EA/SA persona (go-live safety).
- **Consent:** Category B, but reads generated reports/ledgers, not source.
- **Output:** `docs/operations/{Project}-Transition-Acceptance-Checklist.md` (+ optional HTML).

**Inputs (each optional; if absent → `⚠ TODO` row + "run /X"):**
- Latest `prod-readiness/app-readiness-*.html` → Red/Amber domains seed Section A blockers + B fast-follow.
- Security ledger (`security/security-ledger.md`) → open Critical/High by FP-ID → Section A blockers.
- Code-review ledger (`CodeReviews/`) → open defects/CIDs → Section A/B.
- `architecture-deployment.md` + pipeline → prod env exists? approval gate? backup/PITR confirmed?
- The `operations` Runbook (if present) → auto-linked in Section D "artifacts handed over"; if
  absent, recommend running `/operations` first.

**Structure (from ELSA):** A. Go-live blockers (🔴, derived) · B. Accept-with-fast-follow (🟠) ·
C. Knowledge-transfer checklist · D. Artifacts handed over (auto-linked) · Recommendation ·
Sign-off table. People/dates → `⚠ TODO`.

---

## 5. Files to create / modify

**`operations` skill**
- `skills/operations/SKILL.md` — includes the self-contained HTML companion template **embedded
  inline** (` ```html ` fenced block), following the `graph-viz` precedent. (The ICEA-floor hook
  guards standalone `.html` writes; embedding in the exempt `.md` SKILL is also the idiomatic
  pattern for offline-HTML-generating skills, so there is **no separate `.html` reference file**.)
- `skills/operations/references/runbook-template.md`

**`go-live` skill**
- `skills/go-live/SKILL.md`
- `skills/go-live/references/transition-checklist-template.md`

**Command stubs** (mirror [commands/product-docs.md](../../commands/product-docs.md))
- `commands/operations.md`
- `commands/go-live.md`

**Registration / release**
- `.claude-plugin/plugin.json` — add `"operations"` and `"go-live"` to `components.commands` **and**
  `components.skills`; version bump.
- `CHANGELOG.md` entry; `CLAUDE.md` `Plugin version:` line.
- Consider `_project-deploy/commands/{operations,go-live}.md` stubs so setup deploys them to target
  projects (confirm at execution).

---

## 6. Verification (end-to-end)

1. **Golden-master reproduction:** run both skills against ELSA (`C:/Users/rawatv/source/AI-POD/ELSA`)
   and diff output against the hand-made `docs/operations/` package. `operations` should recover the
   Runbook structure (now including Ownership §12 + Secrets §7), the resource grid (from
   `ENVIRONMENTS.md`), the secrets inventory, and the `⚠ TODO` set; `go-live` should reproduce the
   A/B/C/D checklist and — given ELSA's `prod-readiness/` + security ledger exist — recover the
   security-derived blockers (the A2–A5 equivalent).
2. **Fabrication audit:** grep output for any concrete value (URL, contact, expiry, SQL server name)
   not traceable to a read source — must be none; each is `⚠ TODO`.
3. **HTML fidelity:** the HTML companion renders the same sections + Mermaid diagrams as the MD,
   opens offline (no CDN), and matches the MD content (no drift).
4. **EA-7 loop:** run app-readiness after `/operations` — EA-7 detects `docs/operations/*Runbook*.md`
   and scores higher.
5. **Capstone coupling:** run `/go-live` with and without ledgers — with → derived blockers; without
   → `⚠ TODO` rows + "run /security-review, /code-review, /app-readiness".
6. **Registration & consent:** both resolve as commands, appear in `/setup-status`,
   `plugin-readiness` passes; `operations` reads no source in step 1 and consent-gates every
   playbook source read.

---

## 7. Open decision (please confirm)

The plan assumes **the go-live Acceptance Checklist stays a separate skill/doc** (recommended — it
is a different lifecycle and ingests ledgers). If you instead want it folded into the single
Runbook too, say so and the `go-live` skill collapses into a §17 of the Runbook — but note the
"stale sign-off table in a living doc" trade-off in §2.2.
