# Measured Claims — evidence bank (deliverable "b")

Every number here is **measured** from this repo or its local Claude Code session logs on
2026-09-15, unless the label says otherwise. Pull entry "value/evidence" lines from here so no
claim is invented per-entry. **Always keep the label** (measured / observed / estimated /
projected / not-yet-evaluated) when you copy a line into a form.

---

## 1. Repo scale — MEASURED (verifiable by any judge)

| Fact | Value | How to verify |
|---|---|---|
| Skills | **49** | `ls skills \| wc -l` |
| Shared spec primitives | **47** | `ls skills/shared/*.md \| wc -l` |
| Layered coding-rule files | **44** | `ls _project-deploy/rules/*.md \| wc -l` |
| Governance/automation hooks | **25** | `ls _project-deploy/hooks \| wc -l` |
| Deterministic (non-LLM) scripts | **34** | `ls scripts/*.cjs scripts/*.js \| wc -l` |
| Test files | **24** `.test.cjs` | `ls tests/*.test.cjs \| wc -l` |
| Structural validation checks passing | **300 / 0** | `node tests/validate.js` |
| Architecture Decision Records | **64** | `ls docs/adr/*.md \| wc -l` |
| Git commits | **66** | `git rev-list --count HEAD` |

> Re-verified against the codebase 2026-09-16 (`node tests/validate.js` → 300 passed / 0 failed).
> These grow over time — re-run the verify commands before final submission. Note the validator is
> `tests/validate.js` (Node); a separate `tests/validate.py` also exists but the 300/0 figure is the
> JS validator's.

**Use for:** any entry's credibility ("built as a disciplined, tested system, not a script").
Especially Entry 1 (governance is hook-enforced, 25 hooks) and Entry 3/4.

---

## 2. Development-effort & cache-efficiency — MEASURED (from local session logs)

Extracted from 34 Claude Code session logs for this project (`~/.claude/projects/…AI-Assisted-development/`),
spanning **2026-08-17 → 2026-09-15** (~30 days), **13,328** assistant turns with usage data.

| Metric | Value | Label |
|---|---|---|
| Sessions | **34** | measured |
| Assistant turns (with token usage) | **13,328** | measured |
| Development window | **~30 days** (2026-08-17 → 09-15) | measured |
| Output tokens generated | **24.7 M** | measured |
| Fresh input tokens | **4.84 M** | measured |
| Cache-read tokens | **3.78 B** | measured |
| Cache-creation tokens | **116.6 M** | measured |
| **Input-side served from cache** | **96.9 %** | measured |
| **Assistant turns with a cache hit** | **97.6 %** | measured |

### What this proves (and what it doesn't)

- ✅ **Proves:** the workflow is extremely prompt-cache-efficient. **96.9 % of the priced
  input surface was cache reads** (billed ~10 % of fresh input), not full-price fresh tokens.
  This is a real, defensible **resourcefulness** claim for Entry 4.
- ⚠️ **Does NOT prove** the plugin's own `file-cache.json` "60–95 % per-invocation reduction"
  claim. The 96.9 % above is **Claude Code's built-in prompt caching** measured over this
  repo's own development — a different mechanism. Keep them separate and labeled.

**Honest phrasing for a form:**
> *Measured over 34 development sessions (~30 days, 13,328 turns): 96.9% of input-side tokens
> were served from prompt cache and 97.6% of turns had a cache hit — the workflow is designed
> to reuse context rather than re-read it. (Measured; Claude Code prompt caching over the
> project's own dev sessions.)*

---

## 3. The still-ESTIMATED claim + how to make it MEASURED

**Claim:** the plugin's `file-cache.json` + knowledge-graph orientation cuts per-invocation
review token cost by **60–95 %** after the first baseline run.
**Current status:** *estimated / internal (README) — not independently benchmarked.*

### Reproducible benchmark (run in a real deployed target project, ~10 min)

1. In a project with the plugin set up (`/setup-init` done, `.claude/` present):
2. Baseline: `rm .claude/file-cache.json` then `/code-review --full` → note total tokens
   (from `/token-analysis` or the run summary). Call it **T_full**.
3. Change **one** file. Re-run `/code-review --changed` → note tokens. Call it **T_changed**.
4. Reduction = `1 − (T_changed / T_full)`. **This number is now `measured` for your repo.**
5. Record: repo name, file count, T_full, T_changed, %reduction, date. Cite that in Entry 4.

Until then, label Entry 4's file-cache figure **estimated (internal)** and lead with the
measured 96.9 % prompt-cache number from §2 instead.

---

## 4. Structural / behavioral facts — MEASURED (design guarantees)

Use these as "working solution" evidence (criterion 2). Each is a checkable design fact, not a
performance claim:

- **Governance is hook-enforced, not advisory** — 25 hooks incl. `icea-floor`,
  `findings-gate-precommit`, `check-settings-secrets`, `script-review-gate`. (measured: files exist)
- **Deterministic dependency edges** — knowledge-graph edges come from a script
  (`graph-extract-edges.js`), not the model (ADR 0041). No hallucinated dependencies. (measured)
- **Source-file consent is declared per skill** — Category A/B/C in `source-file-consent.md`;
  Category C skills *never* read source. (measured: spec exists + enforced)
- **No-fabrication guarantee** — `operations`/`go-live` render unknowables as greppable
  `⚠ TODO` rows rather than inventing content. (observed in skill specs)
- **Reversible memory** — every `/dream` run is logged and reversible via `/dream-rollback`;
  audited by `/dream-audit`. (measured: skills exist + audit trail)
- **Claude Code-native — NOT portable to other agents** — this is a Claude Code plugin:
  `.claude-plugin/plugin.json` manifest, 47 `SKILL.md` skills, 25 `PreToolUse`/`PostToolUse`
  hooks, slash-command stubs, Anthropic model routing, and runtime deps on `conversation_search`
  / `~/.claude/plugins` / session URLs. It will **not** run as-is on GitHub Copilot, Cursor, or
  any other agent. (measured: verified against plugin.json + skill/hook counts, 2026-09-16.)
  The *concepts* (governance gate, provenance-labeled graph, capability-airgapped agents) are
  portable patterns; the *implementation* is not. Disclose in every entry's field 8.

---

## 5. NOT-YET-EVALUATED (be explicit — do not imply these)

- Rework-hour / cycle-time reduction from the ICEA gate (design goal; `sprint-metrics` can
  measure it once run against a real sprint with an ADO PAT — not available in this repo).
- Onboarding-time reduction from architecture docs.
- Migration success rate on a production app.
- Correlation of readiness scores with real incident rates.

Label all of the above **projected** or **not yet evaluated** if referenced at all.
