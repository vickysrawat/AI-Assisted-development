# Demo Scripts — word-for-word (deliverable "c")

Each script is timed for a live judge demo. Format:
- **[SAY]** = say this out loud (verbatim).
- **[DO]** = type/run exactly this.
- **[SHOW]** = point the camera/screen at this.
- **Backup** = the pre-made artifact to fall back to if anything live fails.

**Golden rule for all demos:** narrate the *human checkpoint* every time one appears — that is
what the judges are scoring. Keep each under the stated time. Always have the backup open in a
second tab.

---

## Entry 1 — Governed AI Development  (3 min)

**Setup:** a target project with the plugin deployed; no approved ICEA for a "CSV export" feature.

1. **[SAY]** "Most AI coding demos show AI writing code fast. Watch this one refuse to."
2. **[DO]** `Add a quick CSV export button to the reports page.`
3. **[SHOW]** AI declines and invokes the ICEA gate — no code written.
   **[SAY]** "It won't write a line until there's an approved spec on disk. That's a hook, not a suggestion."
4. **[SHOW]** the generated ICEA draft — point at a **B-series sensitivity flag** on an acceptance criterion.
   **[SAY]** "It even flagged that this AC touches sensitive data."
5. **[DO]** `APPROVE ADO-1234`
6. **[SHOW]** now code generates, and each write pauses at the Write Gate with a diff + path.
   **[SAY]** "Every file still shows me the diff before it lands. I'm responsible for each one."
7. **[DO]** try to commit with a planted secret in `.claude/settings.json`.
8. **[SHOW]** `check-settings-secrets` hook blocks the commit.
   **[SAY]** "The secret never reaches shared config. Governance is enforced, not hoped for."

**Backup:** pre-saved approved ICEA + a screen-recording of steps 2–8.
**Measured line to drop in:** "25 governance hooks; 300/0 validation checks passing." (§1)

---

## Entry 2 — Dream (Project Memory)  (2 min)

**Setup:** a repo with several days of Claude Code sessions and an existing `memory/MEMORY.md`.

1. **[SAY]** "AI forgets everything between sessions. This one dreams to remember."
2. **[DO]** `/dream`
3. **[SHOW]** the scored ADD/UPDATE/DELETE proposals, each with a justification.
   **[SAY]** "It read past sessions, scored what's worth keeping, and is proposing — not writing."
4. **[SHOW]** approve one proposal; decline another.
   **[SAY]** "Tiered human approval. It writes nothing on its own."
5. **[DO]** `/dream-health`
6. **[SHOW]** open `memory/health.html` — confidence distribution + decay curve.
   **[SAY]** "And it's all reversible — `/dream-rollback` undoes any run, itself audited."

**Backup:** pre-generated `memory/health.html` and a saved proposal screen.
**Measured line:** "Reversible, audited memory; every promotion carries a citation." (§4)

---

## Entry 3 — Codebase Knowledge Graph  (2 min)

1. **[SAY]** "Instead of re-reading source to understand structure, it reads a graph."
2. **[DO]** `/graph-viz`
3. **[SHOW]** open `.claude/graph/graph.html`; hover a hub node — dependencies + dependents appear.
   **[SAY]** "These edges aren't guessed by the model — a script extracts them from imports. No hallucinated dependencies."
4. **[DO]** edit one source file, then `git checkout` back / trigger the stale hook.
5. **[SHOW]** the git hook marks the graph stale.
6. **[DO]** `/graph-sync`
   **[SAY]** "It regenerates only the changed module — fingerprint-based, not a full re-scan."
7. *(optional)* **[DO]** `/graph-viz --3d` → **[SHOW]** the rotating 3D map. "Fully offline."

**Backup:** pre-rendered `graph.html` (2D and 3D).
**Measured line:** "Deterministic edges (ADR 0041); incremental fingerprint sync." (§4)

---

## Entry 4 — Token-Efficiency Engine  (2 min)

1. **[SAY]** "Same review — a fraction of the cost, after the first run."
2. **[DO]** `/code-review --full`  → **[SHOW]** total tokens (T_full).
3. **[DO]** change one file, then `/code-review --changed` → **[SHOW]** tokens (T_changed).
   **[SAY]** "It skipped every unchanged file via the file-cache."
4. **[DO]** `/token-analysis` → **[SHOW]** the cost report + recommendations.
5. **[SAY]** "And measured over this project's own 34 dev sessions: **96.9% of input-side
   tokens came from cache**, 97.6% of turns had a cache hit. The workflow reuses context
   instead of re-reading it."

**Backup:** two saved review reports (full vs changed) + a saved `/token-analysis` HTML.
**Measured line (lead with this):** the 96.9% / 97.6% figures from §2. Label the file-cache
60–95% as **estimated** unless you ran the benchmark in §3.

---

## Entry 5 — The Architect  (2 min)

**Setup:** a repo with NO architecture docs.

1. **[SAY]** "Point it at undocumented code and get living architecture docs back."
2. **[DO]** run the architect skill (answer the short deployment questionnaire).
3. **[SHOW]** `.claude/architecture/` populated — open the system overview.
4. **[SHOW]** the End-to-End + Layered **Mermaid diagrams** rendering.
   **[SAY]** "Generated from code it had never seen before this demo."
5. **[SHOW]** scroll to a `⚠ TODO` where something wasn't inferable.
   **[SAY]** "It never fabricates — gaps become explicit TODOs."

**Backup:** pre-generated `.claude/architecture/` set with diagrams.
**Measured line:** "One doc set feeds icea-feature, security, app-readiness, explain — write-once, read-many." (§4)

---

## Entry 6 — Legacy Migration Family  (3 min)

1. **[SAY]** "Modernizing legacy code — without the cowboy. Three gated skills."
2. **[DO]** `UPGRADE ADO-1234` (same-stack version bump) on a legacy .NET project.
3. **[SHOW]** the gap/risk report; point at a rejected false-upgrade → routed to Rewrite.
   **[SAY]** "It orchestrates a deterministic tool and refuses to pretend a rewrite is an upgrade."
4. **[DO]** kill the session mid-run, reopen, `UPGRADE RESUME ADO-1234`.
5. **[SHOW]** it resumes from the ledger exactly where it stopped.
   **[SAY]** "Every stage is resumable — and for replatform, the AI writes the runbook, a human runs the cutover."

**Backup:** a mid-run ledger + saved gap/risk report.
**Measured line:** "Resumable ledger; per-cluster verification oracle." (§4)

---

## Entry 7 — Production Readiness (App + Plugin)  (2 min)

1. **[SAY]** "Two architects in a box — one grades the app, one grades the AI workflow itself."
2. **[DO]** `/app-readiness --quick`
3. **[SHOW]** the HTML scorecard — 8 domains, Red/Amber/Green with rationale. Point at a Red domain's reasoning.
4. **[DO]** `/plugin-readiness`
5. **[SHOW]** the 6-domain AI-governance scorecard.
   **[SAY]** "This one reads plugin state only — never touches application source. It grades its own guardrails."

**Backup:** pre-generated reports in `prod-readiness/`.
**Measured line:** "Structured multi-domain scoring with per-domain rationale." (§4)

---

## Entry 8 — Support Handover (Operations + Go-Live)  (3 min)

1. **[SAY]** "The handover that writes itself — the two docs a support team needs to accept an app."
2. **[DO]** `/operations`
3. **[SHOW]** the runbook HTML — 16 sections, open the Mermaid triage/escalation diagram.
4. **[DO]** `/go-live`
5. **[SHOW]** the acceptance checklist — Section-A blockers derived from **open findings** in the
   ledgers, plus `⚠ TODO` rows where inputs were missing.
   **[SAY]** "Missing input becomes a visible TODO — never a silent pass. It tells you what it couldn't verify."

**Backup:** pre-generated runbook + checklist.
**Measured line:** "Degrades to TODO rows rather than false-passing; reads reports/ledgers only, never source." (§4)

---

## Presentation logistics (applies to all)

- Have every **Backup** artifact open in a second tab before you start.
- Anything touching a live service (ADO API in `sprint-metrics`/`pr-create`, Docker/ZAP in
  `dynamic-scan`) → **use the backup capture**; don't risk it live.
- Open with the *refusal* (Entry 1) or the *96.9% cache* number (Entry 4) — strongest hooks.
- Close every demo by naming the **human checkpoint** — it's half the rubric.
