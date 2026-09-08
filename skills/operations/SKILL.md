---
name: operations
description: >
  Generate a master Operational Runbook for the current application from the codebase — the
  single document a support engineer opens at 3am. Produces Markdown (source of truth,
  grep-discoverable) plus a self-contained offline HTML companion. Sections: at-a-glance,
  architecture + dependency map (Mermaid), environments + resource inventory, access needed,
  routine ops (deploy/rollback/restart/migrations, Mermaid), health/logs/monitoring + alerts,
  secrets + rotation, symptom→playbook triage (Mermaid), failure-mode playbooks, known issues,
  backup/DR, escalation + ownership (Mermaid), incident comms, support targets, command appendix,
  maintenance cadence. Evidence-derived only; every unknowable is a ⚠ TODO — never fabricated.
  Triggered by the /ai-assisted-development:operations command.
  Also triggers on: "generate a runbook", "operational runbook", "operations doc", "support
  runbook", "on-call guide", "ops documentation".
---

# Operations Runbook Skill

_Skill version: 1.0 · Last changed: 2026-09-04 · Plugin compatibility: ≥3.20.0 · Consent: B_

Generates the **master Operational Runbook** — the one document a support engineer reaches for
during an incident or a routine operational task. Output is Markdown (the source of truth, written
where [app-readiness](../app-readiness/SKILL.md) EA-7 can find it) plus a self-contained,
offline HTML companion rendered from the same content.

> **Scope boundary:** this skill produces the *operate-in-prod* runbook only. The one-time
> **go-live acceptance checklist** (which ingests the readiness / security / code-review ledgers)
> is a separate skill — `/go-live`. Do not generate a sign-off checklist here.

---

## No ICEA · No gates

This is a **documentation generator**, exactly like `product-docs`. It does **NOT** use the ICEA
pattern, the source Write Gate, the critic gate, or any `APPROVE ADO-{ID}` flow. The CLAUDE.md
Feature Gate blocks *implementation code* only — doc generation is exempt. The only interaction is
the Step 0 scope confirmation. Write the Markdown directly; confirm with a one-line summary.

---

## Model routing

**Generation tier** — uses `ICEA_MODEL` (default: `claude-opus-4-8`). Authoring a runbook is
generation, not review. Override per project in `.claude/settings.json` → `env`. See
`$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

## Persona

Execute as **[SRE] On-call / Site-Reliability Engineer** (10 yrs). Optimizes for *time-to-restore*,
not completeness; always asks "at 3am, what do I actually run to bring this back, and how do I know
it worked?" Writes for a tired engineer who has never seen this codebase.

The persona sets *what to scrutinize* — it never licenses assumption. Architecture docs,
configuration, IaC/pipeline definitions, and (consent-gated) source are the only sources of truth;
a persona's "experience" is never evidence (subordinate to CLAUDE.md §3 / decision transparency).
Never name the persona in the runbook. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## Source file consent

This skill is **Category B** — Steps 1–3 (architecture docs, config, IaC/pipeline, bash signals)
produce most of the runbook with **no source reads**. Step 4 (failure-mode playbook derivation)
may need targeted source reads; each is consent-gated per
`$PLUGIN_DIR/skills/shared/source-file-consent.md`. Maximum 6 files across the whole run; state for
each: which section it serves, what it confirms, why bash/architecture evidence was insufficient.

---

## Resolve PLUGIN_DIR — do this first

Read `.claude/plugin-path.txt` to get PLUGIN_DIR. If absent or empty, use the resolver in
`skills/shared/plugin-path-resolution.md §1a`. If it resolves empty, stop and tell the user to run
`/setup-sync`.

---

## Step 0 — Confirm scope

Announce and confirm before doing work:

```
📕 Operational Runbook generation
  Project : {detected project name}
  Output  : docs/operations/{Project}-Operational-Runbook.md
            docs/operations/{Project}-Operational-Runbook.html  (offline companion)
  Sources : architecture docs · config · pipeline/IaC · (consent-gated) source for playbooks
  Ledgers : NOT read — this is the operate-in-prod runbook (use /go-live for the acceptance gate)

Generate the runbook now? (yes / no)
```

If the user declines, stop. Otherwise continue.

---

## Step 1 — Load evidence (no ledger reads)

Read these (skip silently if absent). **Do not** read `prod-readiness/`, `security/`,
or `CodeReviews/` — those are engineering-lifecycle artifacts, out of scope here.

| Source | Extract |
|---|---|
| `.claude/architecture/architecture.md` + `architecture-*.md` | stack, components, dependencies, auth model, deployment topology, data store, degradation behaviour |
| `pipelines/ENVIRONMENTS.md` / `azure-pipelines*.yml` / `*.bicep` / `*.tf` | environments, resource names, deploy/rollback mechanism, approval gates |
| `appsettings*.json` / `.env*` / `VITE_*` / equivalent | config keys, dependency endpoints, secret references (names only — never values) |
| `db/` migration scripts, `package.json` / `*.csproj` / manifests | migration mechanism, versions, entry points |

Then run the bash signal sweep (no source content — file discovery + grep for markers), reusing the
patterns in [app-readiness Step 3](../app-readiness/SKILL.md): health/readiness endpoints, logging
(structured? correlation IDs?), APM/OTel, retry/timeout/circuit-breaker, graceful-shutdown, secrets
references, existing runbook/ops docs. Record each as PRESENT / MISSING / PARTIAL.

---

## Step 2 — Load references

```
Read $PLUGIN_DIR/skills/operations/references/runbook-template.md
Read $PLUGIN_DIR/skills/shared/personas-spec.md
Read $PLUGIN_DIR/skills/shared/source-file-consent.md
Read .claude/business-context.md if present, else $PLUGIN_DIR/skills/shared/business-context-severity.md
```

---

## Step 3 — Derive structured facts

- **Environments + resource inventory** — one row per env; resource-name grid from IaC/ENVIRONMENTS.
- **Secrets inventory** — every credential: what it's for, where it lives, type, whether rotation is
  auto-picked-up, and **blast radius if expired**. Classify workload-identity (nothing to rotate)
  vs stored secret. Owners + expiry dates are always `⚠ TODO`.
- **Degradation map** — which dependency failures degrade gracefully vs hard-fail (from error
  handling evidence). Unknown → `⚠ TODO`.

Any value not backed by a read source becomes `⚠ TODO`. Never guess.

---

## Step 4 — Derive playbooks (evidence-gated)

Build the **symptom → layer → playbook** map from the user-facing features + dependency graph, then
one **failure-mode playbook** per dependency/layer. Each playbook: Symptoms → Diagnose → Recover →
**✅ Confirm resolved (smoke test)** → Escalate.

Derive Diagnose/Recover steps only from concrete evidence (dependency call-sites, `catch` blocks,
config fallbacks, health checks). Where a recovery step is not derivable, write `⚠ TODO`. If a
source read is required to confirm a failure mode, apply the Category B consent gate (Step 4 only).

---

## Step 5 — Fill the Markdown template

Fill `runbook-template.md`:
- Replace `{{PLACEHOLDER}}` with derived values; expand/delete `{{#each}}`/`{{#if}}` blocks per data.
- Leave every `⚠ TODO` literally in place; keep every command's "⚠ verify against live/CLI" caveat.
- Build the four **Mermaid** diagrams (§2 dependency map, §5 deploy/rollback, §8 triage, §12
  escalation) from the derived topology. Unknown node/edge → a node labelled `⚠ TODO`; **never
  invent an edge**.
- Strip all `<!-- guidance -->` comments.
- Apply B-series flagging: if the app handles regulated/confidential/PII-adjacent data (e.g. a
  search/query log), note the retention question in §14 and flag it — do not ignore it.

---

## Step 6 — Quality gate (before writing)

Verify every item; fix before writing:
- [ ] No unfilled `{{PLACEHOLDER}}` / leftover `{{#each}}` / `{{#if}}` tokens
- [ ] Every `⚠ TODO` is intentional (a genuine human/live-check unknown), not laziness
- [ ] Every shell command carries the "⚠ verify" caveat
- [ ] No invented procedure, contact, URL, expiry date, or topology
- [ ] Every ```mermaid block is syntactically well-formed and topology-honest
- [ ] Every recovery path (rollback/restart/playbook) ends with a ✅ Confirm-resolved step

---

## Step 7 — Write outputs & confirm

```bash
mkdir -p docs/operations
```

1. Write `docs/operations/{Project}-Operational-Runbook.md` (the source of truth).
2. Render the HTML companion `docs/operations/{Project}-Operational-Runbook.html` from the **HTML
   companion template below**, filling exactly the placeholders noted in the template comment:
   convert the runbook body to HTML (`<h2 id>`, tables, and each Mermaid diagram as
   `<pre class="mermaid">…source…</pre>`), and inline a locally-vendored `mermaid.min.js` at
   `/*__MERMAID_LIB__*/` **only if** the developer committed one at `docs/operations/vendor/
   mermaid.min.js` — otherwise leave it empty (diagrams degrade to readable source text; **never**
   fetch from a CDN). Never echo the HTML to chat.

Then confirm:
```
✅ Operational Runbook generated
  → docs/operations/{Project}-Operational-Runbook.md   ({N} open ⚠ TODOs)
  → docs/operations/{Project}-Operational-Runbook.html  (offline companion)
  Derived from: {list sources actually read}
  Next: close the ⚠ TODOs with the owning team; run /go-live for the acceptance gate.
```

---

## HTML companion template

Write the HTML file using this template **verbatim**, replacing only the placeholders described in
the leading comment. Do not add external CDN links — the file must open offline over `file://`.

````html
<!doctype html>
<!--
  Fill exactly these placeholders — change nothing else:
    {{PROJECT_NAME}}         → project name (title + header)
    {{DATE}}                 → generation date
    <!--__RUNBOOK_BODY__-->  → runbook content as HTML (<h2 id="…">, tables, blockquotes, and each
                               Mermaid diagram as <pre class="mermaid">…source…</pre>); keep ⚠ TODO
                               verbatim, wrapping each in <span class="todo">⚠ TODO</span>
    /*__MERMAID_LIB__*/      → contents of a locally-vendored mermaid.min.js IF committed at
                               docs/operations/vendor/mermaid.min.js; else leave empty (NO CDN)
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{PROJECT_NAME}} — Operational Runbook</title>
<style>
  :root { --bg:#ffffff; --fg:#1c2330; --muted:#5b6472; --line:#e2e6ec; --accent:#2b6cb0;
          --todo-bg:#fff4e5; --todo-fg:#8a5300; --code-bg:#f5f7fa; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f1115; --fg:#e6e6e6; --muted:#9aa4b2; --line:#2a2f3a; --accent:#5b9dff;
            --todo-bg:#3a2a12; --todo-fg:#ffd39a; --code-bg:#171a21; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
         font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  #layout { display:flex; align-items:flex-start; }
  nav { position:sticky; top:0; height:100vh; overflow:auto; min-width:240px; max-width:240px;
        padding:20px 14px; border-right:1px solid var(--line); font-size:13px; }
  nav h2 { font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted);
           margin:0 0 10px; border:0; padding:0; }
  nav a { display:block; padding:3px 6px; color:var(--fg); text-decoration:none; border-radius:4px; }
  nav a:hover { background:var(--code-bg); }
  main { flex:1; padding:28px 40px; max-width:900px; min-width:0; }
  h1 { font-size:26px; margin:0 0 4px; }
  h2 { font-size:20px; margin:34px 0 10px; padding-top:8px; border-top:1px solid var(--line); }
  h3 { font-size:16px; margin:20px 0 8px; }
  table { border-collapse:collapse; width:100%; margin:12px 0; font-size:14px; }
  th, td { border:1px solid var(--line); padding:7px 10px; text-align:left; vertical-align:top; }
  th { background:var(--code-bg); }
  code { background:var(--code-bg); padding:1px 5px; border-radius:4px; font-size:13px; }
  pre { background:var(--code-bg); padding:12px 14px; border-radius:6px; overflow:auto; font-size:13px; }
  blockquote { margin:12px 0; padding:8px 14px; border-left:3px solid var(--accent);
               background:var(--code-bg); color:var(--muted); }
  .meta { color:var(--muted); font-size:13px; }
  .todo { background:var(--todo-bg); color:var(--todo-fg); padding:0 4px; border-radius:3px;
          font-weight:600; white-space:nowrap; }
  pre.mermaid { text-align:center; }
  @media print { nav { display:none; } main { max-width:none; padding:0; }
    a { color:inherit; text-decoration:none; } }
</style>
</head>
<body>
<div id="layout">
  <nav aria-label="Contents"><h2>Contents</h2><div id="toc"></div></nav>
  <main>
    <h1>{{PROJECT_NAME}} — Operational Runbook</h1>
    <p class="meta">Rendered view · Last updated {{DATE}} · Source of truth: the companion
       <code>.md</code> file. Verify every value against the live environment before an incident.</p>
    <!--__RUNBOOK_BODY__-->
  </main>
</div>
<script>/*__MERMAID_LIB__*/</script>
<script>
  if (window.mermaid && typeof window.mermaid.initialize === "function") {
    try { window.mermaid.initialize({ startOnLoad: true,
      theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default" }); }
    catch (e) {}
  } else {
    document.querySelectorAll("pre.mermaid").forEach(function (el) {
      var note = document.createElement("div"); note.className = "meta";
      note.textContent = "⚠ diagram shown as source — commit mermaid.min.js to vendor/ to render it";
      el.parentNode.insertBefore(note, el);
    });
  }
  var toc = document.getElementById("toc");
  document.querySelectorAll("main h2").forEach(function (h) {
    if (!h.id) h.id = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    var a = document.createElement("a"); a.href = "#" + h.id; a.textContent = h.textContent;
    toc.appendChild(a);
  });
</script>
</body>
</html>
````

---

## Hard rules

- **Never fabricate.** Any value not traceable to a read source is `⚠ TODO`. A wrong rollback step
  is more dangerous than a missing one.
- **Never invent Mermaid topology** — unknown nodes/edges are `⚠ TODO` nodes.
- **Never read the readiness / security / code-review ledgers** — out of scope (use `/go-live`).
- **Never read a source file without the Category B consent gate** (Step 4 only; max 6 files).
- **Never write secret values** into the runbook — reference names only.
- **Never echo the HTML content to chat** — write it to disk and confirm with one line.
- Output must be offline — no CDN, no remote assets in the HTML.
- Markdown is the source of truth; the HTML is a rendered view of the same content.
