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

**Graph-first framing:** the efficiency engine is the knowledge graph — a dozen skills orient
from it instead of re-reading source. Lead with the measured 96.9% prompt-cache number; keep the
file-cache out of the lead (it's a narrow review/security optimization, and its reduction is only
*estimated*).

1. **[SAY]** "Understanding a codebase without re-reading it. Watch how the AI orients."
2. **[DO]** `/explain "how does the write gate work?"` (or `/graph-viz`).
   **[SHOW]** it answers from `.claude/graph/graph.json` — structure + dependencies — **without
   re-scanning every source file.** **[SAY]** "One graph. Generate, modify, review, explain — they
   all orient from it. Read the codebase's shape once; reuse it everywhere."
3. **[SHOW]** hover a node in `graph.html` — dependencies + dependents.
   **[SAY]** "And these edges are script-extracted from imports, not guessed — so no hallucinated
   dependencies."
4. **[DO]** edit one source file → `/graph-sync`.
   **[SHOW]** it regenerates **only the changed module** (fingerprint-based). **[SAY]** "Not a
   full re-scan — just the delta."
5. **[DO]** `/token-analysis` → **[SHOW]** the cost report + recommendations.
6. **[SAY]** "Measured over this project's own 34 dev sessions: **96.9% of input-side tokens came
   from cache**, 97.6% of turns had a cache hit. The workflow reuses context instead of
   re-reading it." **[SAY]** "That number is prompt-cache — measured. The graph-orientation
   savings I label estimated. I don't let the strong number vouch for the unproven one."

**Backup:** pre-rendered `graph.html` (2D) + a saved `/token-analysis` HTML.
**Measured line (lead with this):** the 96.9% / 97.6% figures from §2 (prompt cache —
mechanism-agnostic). Label graph-orientation and the review-only file-cache 60–95% as
**estimated** unless you ran the benchmark in §3. **Boundary:** this is the graph as an
*efficiency engine* — Entry 3 is the same graph as an *artifact*; say so to pre-empt "isn't this
Entry 3?"

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

## Entry 9 — The Persona Cast  (2 min)

1. **[SAY]** "Same code, two skills — watch them ask completely different questions."
2. **[DO]** run `security` on a file → **[SHOW]** it reasoning as [SEC]: "how would I abuse this?"
3. **[DO]** run `app-readiness` → **[SHOW]** it reasoning as [EA]: "what happens at 3am when this fails?"
   **[SAY]** "Thirteen expert lenses, one per skill — a writers' room for your codebase."
4. **[SHOW]** open `personas-spec.md` roster; point at a signature question.
5. **[SHOW]** the guardrail line: *"the persona sets what to scrutinize — it never licenses assumption."*
   **[SAY]** "A lens, not roleplay. It reasons like the expert, but it's still not allowed to guess,
   and the output never even names the persona."

**Backup:** the roster table + two saved skill outputs showing the different lenses.
**Measured line:** "13 personas, assigned per skill; role and model tier are orthogonal." (§4)

---

## Entry 10 — The Critic  (2 min)

1. **[SAY]** "Most AI writes code and hands it to you. This one has a second AI tear it apart first."
2. **[DO]** generate code that quietly over-engineers (a one-implementer interface).
3. **[SHOW]** the critic returns **REVISE** with a concrete concern ("IFilterStrategy<T> has one
   implementer — use a direct method"). **[SAY]** "Not 'could be cleaner' — a specific, actionable concern."
4. **[SHOW]** "🔁 revision 1 of 2" → regenerates simpler → **PASS** → *then* it writes.
   **[SAY]** "It fixed its own work — up to twice, on its own — and nothing touched disk until it cleared."
5. **[SAY]** "Two automatic tries max; after that it stops and asks me. Autonomy on a leash."

**Backup:** a saved critic REVISE→PASS transcript.
**Measured line:** "Fires at 3 gates; nothing written while the verdict is REVISE." (§4)

---

## Entry 11 — The Two Agents That Can't Collude  (2 min)

1. **[SAY]** "This one tailors your data-sensitivity rules to your industry — using two agents that
   physically can't leak your code."
2. **[DO]** run `SET DOMAIN` → confirm domain + jurisdiction.
3. **[SHOW]** the `bc-searcher` spawn — it gets **only** `{domain, jurisdiction}` and has **web tools,
   no file access.** **[SAY]** "It can search regulations. It cannot read a single line of your code."
4. **[SHOW]** the `bc-synthesizer` — **file tools, no network.** **[SAY]** "It can read your code. It
   cannot make a network call."
5. **[SHOW]** the drafted B-series with citations → `APPROVED` writes `.claude/business-context.md`.
6. **[SAY]** "To leak your code to the web, one agent would need both file access and a network. Neither
   has both. Privacy here isn't a promise — it's physics."

**Backup:** the two agent tool-set definitions side by side + a sample `business-context.md` with citations.
**Measured line:** "Disjoint-capability subagents; the web agent only ever receives domain + jurisdiction." (§4)

---

## Entry 12 — The Application Landscape  (2 min)

1. **[SAY]** "Real apps aren't one repo. Watch the AI stop working blind."
2. **[DO]** wire a dependency repo into `additionalDirectories` → run `explain` or `/graph-viz`.
3. **[SHOW]** it announces "📁 also scanning dependency: {path}" and draws graph edges that **cross the
   repo boundary.** **[SAY]** "One shared resolver — every skill sees the same landscape, not just this folder."
4. **[DO]** change a field in your repo → ask what it impacts.
5. **[SHOW]** it names modules in the **other** repo that depend on it. **[SAY]** "That's the blast radius —
   before you shipped it, not three days after the API team files a ticket."
6. **[SAY]** "And a write that crosses into another repo always stops for approval — even under approve-all."

**Backup:** a pre-wired two-repo setup with a cross-repo graph rendered.
**Measured line:** "One shared scan-root resolver; read deps by default, write findings only on --with-deps." (§4)

---

## Entry 13 — Business Context  (2 min)

1. **[SAY]** "The same bug is a shrug in a to-do app and a breach in a hospital. Watch the AI learn the difference."
2. **[SHOW]** a finding scored **medium** on CVSS in a generic app.
3. **[DO]** `SET DOMAIN` → confirm **healthcare** + jurisdiction → approve the grounded policy.
4. **[DO]** re-run the review → **[SHOW]** the same finding is now **Critical**, with the override stated by
   trigger ID and the technical score shown beside it. **[SAY]** "CVSS is a floor, not a ceiling — context
   can raise it, never lower it, and it shows its work."
5. **[SAY]** "It blocks now. And 'delete the file' is no longer remediation — git history has to be purged too."

**Backup:** a saved `business-context.md` with cited triggers + a before/after severity screenshot.
**Measured line:** "Reported severity = the higher of technical and business; override disclosed by trigger ID." (§4)

---

## Entry 14 — The Context Budget  (2 min)

1. **[SAY]** "Every AI tool brags about how much context it can hold. This one obsesses over how little it needs."
2. **[DO]** open the `dream-health` dashboard → **[SHOW]** its "CLAUDE.md: N lines vs ~200 budget" status
   line. **[SAY]** "Capacity was never the limit — past a few hundred lines the model starts missing its
   own rules. This budgets its *attention*."
3. **[DO]** run `claude-md-audit.js`. **[SAY]** "It's advisory-only — silent when you're lean, and when
   you drift over budget it prints exactly which sections to move out (never the governance rails)."
   **[SHOW]** (optional) the advisory firing on a deliberately over-budget copy.
4. **[SHOW]** the knowledge graph is **not** auto-loaded — a skill pulls only the slice it needs.
5. **[SAY]** "Same discipline everywhere — memory runs hard-stop before they get too big, generated docs are
   token-capped. None of it relies on the model deciding to be tidy. Capacity was never the constraint; attention was."

**Backup:** a saved `dream-health` panel showing the line-count-vs-budget status + a saved audit advisory
captured from a deliberately over-budget file.
**Measured line:** "~200-line budget (`claude-md-audit.js --budget 200`, advisory-only); status shown in `dream-health`; graph never auto-loaded; memory hard-stops." (§4)

---

## Presentation logistics (applies to all)

- Have every **Backup** artifact open in a second tab before you start.
- Anything touching a live service (ADO API in `sprint-metrics`/`pr-create`, Docker/ZAP in
  `dynamic-scan`) → **use the backup capture**; don't risk it live.
- Open with the *refusal* (Entry 1) or the *96.9% cache* number (Entry 4) — strongest hooks.
- Close every demo by naming the **human checkpoint** — it's half the rubric.
