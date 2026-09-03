# Business Context Grounding Loop
_Spec version: 1.0 · Created: 2026-09-01_
_Consumed by: `business-context-generation.md`_

Grounds the B-series in **real, cited regulatory frameworks** for the confirmed
`{domain, jurisdiction}`, instead of relying on the model's memory. Best-effort: when the web
is unavailable the generation module falls back to the seed/locked table.

---

## Goal-based loop

**Goal:** enumerate the governing frameworks for `{domain} + {jurisdiction}` and their
mandatory data-sensitivity + breach-notification categories, each with an authoritative
citation (statute / regulator page).

**Loop:**
1. Fan-out `WebSearch` over the framework/category space for `{domain, jurisdiction}`.
2. `WebFetch` authoritative sources; extract candidate categories.
3. **Adversarially verify** each claimed category against its cited source (reject
   uncited/unsupported claims).
4. **Completeness critic:** "what governing framework for this domain+jurisdiction is not yet
   represented?" If it returns nothing new for **K=2** consecutive rounds, stop.
5. **Budget ceiling:** stop at a search-count budget (default 24 searches) regardless. No
   unbounded fan-out. `log` what was dropped if the ceiling is hit before the critic is dry.

Output: a list of `{category, rationale, citation, retrievalDate}` handed to the synthesizer.

---

## ENFORCEMENT — structural, not prose

The guarantee **"no project/client data leaves the machine"** is enforced by mechanisms
outside the LLM's discretion. The prose here is only a hint; the controls below are the
enforcement.

### 1. Capability separation via two custom subagents (primary)

Spawn two purpose-built subagents (`agents/bc-searcher.md`, `agents/bc-synthesizer.md`). Each
starts with a **fresh, isolated context** — it does NOT inherit the orchestrator's window, so
the loaded architecture/graph/source is physically absent.

- **Searcher** — frontmatter `tools: WebSearch, WebFetch` **only** (no Read/Bash/Edit → it
  structurally cannot open project files). Its context is seeded with `{domain, jurisdiction}`
  **only**, via a fixed template. It cannot leak data it never held and cannot read data it
  was not given. Returns the grounded `{category, citation, date}` list.
- **Synthesizer** — frontmatter grants **NO web tool**. Its context = the Searcher's cited
  facts + local architecture. It cannot exfiltrate — no network reach exists in its toolset.

**Residual vector — the prompt is parent-authored.** Isolation stops *inheritance*, not
*injection*: the parent (which holds project data) writes the Searcher's prompt, so it MUST
pass only `{domain, jurisdiction}` through the fixed template — never free-form project
context. This one LLM-authored spot is covered by control #2.

### 2. PreToolUse deny hook (deterministic backstop)

`.claude/hooks/web-grounding-guard.cjs`, wired in `.claude/settings.json` `PreToolUse` for
`WebSearch`/`WebFetch`, modeled on `check-settings-secrets.cjs --hook`. Project-level
PreToolUse hooks fire for **and can block** subagent tool calls (verified against the Claude
Code hook model), so this covers both the main agent and the Searcher subagent. Before any web
call it:

1. **Default-denies** unless a grounding-session marker is active AND the kill-switch
   (`BUSINESS_CONTEXT_GROUNDING`) is on.
2. **Denies on project-identifier collision** — loads the project's own vocabulary
   (entity/table/file/dir names from `.claude/graph/graph.json` + architecture docs + the
   source tree) and blocks the query if it contains any of them, or code/PII-shaped tokens.
3. **Regulatory-grammar allowlist** — the query must be composed of
   framework/jurisdiction/category/year terms.

The hook reads `agent_type`/`agent_id` from its JSON input to apply the strict rule to the
searcher specifically. A denied call never leaves the machine.

### 3. Constrained query construction

Queries are assembled from fixed slots — framework names enumerated in the domain seed +
the confirmed jurisdiction + year. Architecture text is never an input to query building.

### 4. Audit

Every attempted query (allowed AND denied) is appended to the committed `.claude/audit/`
shards (reuse the `audit-append.cjs` pattern) → the no-leak property is continuously
verifiable, not a one-time check.

### 5. Kill switch / default posture

`BUSINESS_CONTEXT_GROUNDING` (settings `env`) — a firm may set it to seed-only. When off, the
hook denies all grounding web calls and generation falls back to the seed/locked table.

---

## Fallback (graceful)

Skip the loop and use the seed (or verbatim-locked) table, stamping `web-grounded: false` in
the generated file, when **any** of:
- No network / headless / CI run.
- `WebSearch`/`WebFetch` not permitted in the target harness (tool-unavailable — detect this,
  not only no-network).
- `BUSINESS_CONTEXT_GROUNDING` is off.

Never silently degrade — always record `web-grounded: false` and why.

---

## Output contract

Grounding **informs, never auto-adopts.** The synthesizer produces a draft B-series with
citations + retrieval dates; the human `APPROVED` gate (see `business-context-generation.md`)
is required before the file is written. For a **verbatim-locked** domain (e.g. `legal`),
grounding may only *append* `(project-specific)` entries — locked entries are reproduced
unchanged.
