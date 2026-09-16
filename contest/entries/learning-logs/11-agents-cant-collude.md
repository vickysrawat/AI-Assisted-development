# Learning Log — Entry 11: The Two Agents That Can't Collude

> Judge-defense study log. One section per concept: explanation + judge-ready line + summary.
> Companion docs: entry = `../11-agents-cant-collude.md`; source spec:
> `skills/shared/business-context-generation.md` + the `bc-searcher` / `bc-synthesizer` agent definitions.

**The spine:** to tailor sensitivity rules you must research regulations (web) AND read the codebase
(files), dangerous together. The plugin **splits them across two subagents with disjoint
capabilities** so exfiltration is **physically impossible, not just forbidden**. Responsible-AI +
creativity.

**Concept map (7):** (1) core problem (web + source together = exfil risk) · (2) the split (searcher
vs synthesizer) · (3) airgap by capability, not policy (the crux) · (4) minimal disclosure to the web
· (5) cited + human-gated output · (6) what it produces & why it matters · (7) evidence + fun.

Status: ✅ Concepts 1–7 locked.

## Concept 1 — The core problem
**Explanation:** tailoring data-sensitivity rules to a codebase needs two capabilities that are
dangerous in one place: **researching regulations on the web** and **reading proprietary source**. An
agent with both is, by construction, an exfiltration risk (one prompt-injection from posting your
schema into a search). Most tools answer this with a *policy*: a promise the model can break.
**Judge line:** *"To make the rules fit your domain, something has to read your code and something has
to search the web. Put both in one agent and you've built an exfiltration machine. A 'don't send code
out' policy is just a promise the model can break."*
**Summary:** *Web-research + source-read in one agent = exfil risk; policy is a breakable promise.*
Covers: #2.

## Concept 2 — The split (searcher vs synthesizer)
**Explanation:** grounding spawns two subagents with **disjoint** tools:
- **`bc-searcher`**: `WebSearch`/`WebFetch`, **no file access**; receives only `{domain, jurisdiction}`.
- **`bc-synthesizer`**: `Read`/`Grep`/`Glob`, **no web tools**; combines the searcher's cited
  categories with local architecture to draft the B-series.
**Judge line:** *"Two agents. One can reach the internet but can't read your files. The other can read
your files but can't reach the internet. They hand off cited facts in the middle."*
**Summary:** *bc-searcher = web-only (domain+jurisdiction in); bc-synthesizer = files-only (drafts
triggers). Disjoint tools.*
Covers: #3.

## Concept 3 — Airgap by capability, not policy (THE crux)
**Explanation:** the safety property is the **tool wiring**: neither agent holds *both* file-read and
network. Leaking source to the web would require an agent with both, which **does not exist** in this
design. So exfiltration isn't "against the rules," it's **not a reachable state**.
**Judge line:** *"Here's the elegant part: leaking your code to the web isn't forbidden, it's
impossible. It would take one agent with both file access and a network connection, and neither agent
has both. The guarantee is in the wiring, so there's nothing to enforce or trust at runtime."*
**Summary:** *Neither agent has both file-read + network → exfiltration is unreachable by
construction, not by policy.*
Covers: #6, #8.

## Concept 4 — Minimal disclosure to the web
**Explanation:** the web-capable agent receives **only `{domain, jurisdiction}`**, never the
codebase. It can't leak what it never sees; the only thing that leaves the environment is a domain
label + a jurisdiction (by design).
**Judge line:** *"And the web agent is starved on purpose: it only ever gets a domain and a
jurisdiction, never a line of your code. It can't leak what it was never given."*
**Summary:** *Searcher receives only {domain, jurisdiction}; the codebase is never handed to the web
agent.*
Covers: #5, #8.

## Concept 5 — Cited + human-gated output
**Explanation:** the drafted B-series triggers carry **`citation` + `retrievalDate`**; the file is
written only on the exact word **`APPROVED`** (architect draft flow, not the ICEA gate); the
no-network fallback degrades **explicitly** (`web-grounded: false`, reason recorded) — never silently.
Verbatim-locked domains (legal) copied byte-for-byte; grounding may only *append* project-specific rows.
**Judge line:** *"Every trigger is cited with a retrieval date, nothing is written until a human types
APPROVED, and if grounding can't run it says so out loud instead of quietly guessing."*
**Summary:** *Triggers carry citation + retrievalDate; write only on APPROVED; fallback records why,
never silent.*
Covers: #5, #8.

## Concept 6 — What it produces & why it matters
**Explanation:** the output is `.claude/business-context.md`, the project's **B-series severity
policy** that then drives sensitivity across the whole plugin (findings gates, the Critic's B-series
coverage check, readiness blockers). So this airgapped pass is upstream of every "is this data
sensitive?" decision the tooling makes.
**Judge line:** *"What it produces isn't a one-off: it's the B-series policy the whole plugin uses to
decide what's sensitive. So the privacy guarantee sits at the root of every sensitivity call downstream."*
**Summary:** *Produces the B-series policy that governs sensitivity plugin-wide; airgap sits upstream
of every sensitivity decision.*
Covers: #3, #6.

## Concept 7 — Evidence + fun framing
**Explanation:** measured. The two agents' tool sets ARE exactly `web-only` and `files-only` (a real
capability constraint, not a description); the spawn contract passes only `{domain, jurisdiction}`;
output carries citations. **Not-yet-evaluated:** grounding accuracy vs a compliance expert. Fun:
"privacy is physics." Honest limit: the searcher's web queries still leave the environment (labels only).
**Judge line:** *"What's real is the wiring: one agent is web-only, the other file-only, verifiable
in their definitions. Whether the grounding matches a lawyer's read, not-yet-evaluated. And the line
that sells it: privacy here isn't a promise, it's physics."*
**Summary:** *Evidence = the actual disjoint tool sets + minimal spawn payload + citations. Grounding
accuracy not-yet-evaluated.*
Covers: #6, #7.

## Quick map: concept → form field
| Field | Concepts |
|---|---|
| #1 pitch | 1 + 3 |
| #2 problem | 1 |
| #3 working today | 2, 5 |
| #4 AI role | 2, 3 |
| #5 flow + checkpoints | 4, 5 |
| #6 value + evidence | 3, 4, 6, 7 |
| #7 resourceful/fun | 3 (airgap by wiring) |
| #8 responsible AI | 3, 4, 5 |
| #9 demo | 2/4; `../../demo-scripts.md` §Entry 11 |

## The 3 lines that win Entry 11
1. **The hook:** "Privacy here isn't a promise, it's physics. To leak your code, one agent would need both file access and a network. Neither has both."
2. **The design:** "One agent can reach the web but can't read your files; the other can read your files but can't reach the web. They trade cited facts in the middle."
3. **Minimal disclosure:** "The web agent only ever gets a domain and a jurisdiction; it can't leak what it was never given."
