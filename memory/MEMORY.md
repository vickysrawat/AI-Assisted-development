# MEMORY.md — manual override inbox

> Sessions are now the primary memory source.
> /dream reads your Claude Code conversations directly via conversation_search.
> You do not need to write here manually.
>
> This file is for EXCEPTIONS ONLY:
> - Things Claude should remember that didn't arise naturally in a session
> - Explicit corrections you want to force into memory immediately
> - Context that exists outside Claude Code (e.g. from a document or meeting)
>
> Auto-capture writes here automatically at trigger points (see CLAUDE.md).
> /dream will process and clear entries after each run.

---

## When to write here manually

Only write here if:
1. You have knowledge that Claude Code sessions won't contain
2. You want to guarantee something is captured before the next /dream run
3. You need to correct something that is already in topic-*.md files

For everything else — just work normally. /dream will find it in sessions.

---

## Format for manual entries

```
### [manual] YYYY-MM-DD — <topic>
<what Claude should know>
Source: <where this came from>
Priority: normal | high | urgent
```

For urgent corrections (do not retry / critical failures):
Use `Priority: urgent` — these get fast-tracked to CLAUDE.md
without waiting for the normal Tier 3 review.

---

## Auto-capture entries

Claude writes below automatically at trigger points.
These are processed and removed by /dream each run.

<!-- Auto-capture entries appear below this line -->

### [2026-08-25] Architecture decision — /bug must persist approved spec BEFORE writing fix code
The `icea-floor` PreToolUse hook (.claude/hooks/icea-floor.cjs, wired in settings.json) blocks writes to guarded source exts (.cs/.ts/.js/.py/...) unless a file under docs/ matching `*.icea.md` OR `ADO-*.md`, modified in the last 8h, contains `Status:.*Approved` or `Tier:\s*T1`. GOTCHA: a bug spec with `Status: DRAFT — Awaiting Approval` does NOT match (`.*Approved` ≠ "Approval"), so /bug would be blocked wherever the floor is active. Fix: on APPROVED, /bug stamps the saved `.bugspec.md` header with `Status: ✅ Approved` + `Tier: T1` and writes it to disk in Step 6a BEFORE any source read/edit (reordered — spec was previously saved last). `.md` writes are floor-exempt so persisting the spec is always allowed; a bug fix is genuinely a T1 micro-change so the T1 marker is honest. Rejected: exempting bugspec from the floor (wrong direction — floor guards code, not specs).
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### [2026-08-25] Task completed — first /dream consolidation run (70 entries -> 10 topic files)
First dream run consolidated ~70 auto-capture entries from a 1049-line MEMORY.md into 10 topic files. Pattern: group by topic cluster, extract knowledge (not verbatim), score by existing Confidence tags. conversation_search unavailable in CLI mode — MEMORY.md auto-capture entries used as sole source. MEMORY.md cleaned to ~48 lines. No PROMOTE candidates (need one more cycle). Run /dream every 5-8 sessions to prevent accumulation.
Trigger: Task completed  Confidence: 0.85  Source: auto-capture

### [2026-08-25] Plan approved — migration Stage 0.6 inventory validation/hardening harness
Approved a harness to validate the migration skill's Stage 0.6 Source Behavioral Inventory (the "every behavior traces to a real file:line" promise). Scope: trace/spine/coverage verifier (deterministic, no API key), blind planted-behavior fixtures for 3 stacks (Node/Express → dotnet-fw→dotnet → Angular→React, built incrementally + defect-gated), an LLM-graded scorer (distributional, not recall=100% — LLM output is flaky), golden-master mechanics tested via a HAND-BUILT match+drift target (NOT a live full migration). Reuse tests/validate.py graph-integrity pattern + tests/runner.js eval loop; do NOT build a parallel evals/evals.json. Plan file: ~/.claude/plans/we-have-already-added-golden-iverson.md.
Trigger: Plan approved  Confidence: 0.80  Source: auto-capture

### [2026-08-25] Architecture decision — 3 anti-hallucination controls for Stage 0.6 (provenance token, absolute-scope gate, sub-agent extraction)
(1) Provenance is asserted "falsifiable" but nothing falsifies it — added a machine-readable `PROV:<relpath>#L<start>[-L<end>]` (or `PROV:cluster:<name>`) token to source-inventory-spec.md, REQUIRED on every §5/§6/§11 item, additive to prose, so the trace verifier can extract+resolve citations. (2) The shared context-budget-check.md measures SESSION DEPTH only — it waves through a whole-app inventory in a fresh session that's too large for one honest pass; so add a SEPARATE absolute-scope gate (do NOT fork the budget check) that forces index+per-cluster decomposition when scope > ~6 clusters. (3) Decomposed clusters extract in orchestrator + per-cluster SUB-AGENTS (mirrors Stage 4) — context isolation is the root fix for exhaustion-driven confabulation; constraints: centralized F-NN assignment, orchestrator owns cross-cutting §4/§7/§8/§9/§11/§1, decompose along bounded contexts NOT horizontal layers, per-fragment trace-verify-before-merge. Fresh source graph is a HARD prereq for rewrite-from-spec (denominator+cluster units come from graph.json); graph/arch docs give STRUCTURE only — behavior/thresholds/error-strings/provenance are irreducible from code. Rejected: forking the context-budget script; using arch docs as a behavior oracle (stale secondary artifact = hallucination amplifier); one bundled "anti-hallucination" script (overclaims + mixes deterministic & LLM concerns — split them for CI-runnability).
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### [2026-08-25] Error resolved — verifier fixture prose must not contain the ID tokens it scans for
verify-inventory-trace.cjs treats every `F-NN`/`GAP-NN` token found ANYWHERE in the inventory text as a "defined" spine ID. A BAD self-test fixture that mentioned the intended dangling ref ("F-99") in its own explanatory comment silently polluted the defined-ID set, so the dangling-ref check passed when it should have failed (6/7). Fix: keep the sentinel token out of fixture prose — describe it as "an undefined feature-ID" instead. Gotcha for all future fixtures: any token matching the verifier's scan regex (F-\d{2,}, GAP-\d{2,}, PROV:) in comments/headers counts as real. The verifier itself was correct — the fixture was self-sabotaging.
Trigger: Error resolved  Confidence: 0.80  Source: auto-capture

### [2026-08-26] Task completed — Increment 1 harness caught a real defect (STATIC/INFERRED under-specified)
The blind-author → blind-extract → deterministic-verify → LLM-score pipeline worked and yielded a genuine defect on its first run against a Node/Express fixture (25 planted behaviors). Result: 100% recall, 0 hallucinations, BOTH planted traps handled correctly (dead code + misleading comment logged as gaps, not asserted), verbatim-exact, ambiguous branch correctly gap-flagged — BUT 10/25 items OVER-claimed STATIC where truth is INFERRED. Root cause = the source-inventory-spec STATIC vs INFERRED cut-line is under-specified: extractor treated "a guard/validator is PRESENT" as STATIC, when the outcome (which roles admitted, what/why rejected) requires reading a conditional → INFERRED. Over-claiming STATIC understates needed verification — the opposite of the safety margin wanted. Pattern confirmed: hold each role (author/extractor/scorer) in a SEPARATE subagent to preserve blindness; the deterministic verifier proved out on real generated output (69/69 PROV tokens resolved). Fix in flight: sharpen STATIC/INFERRED definitions in the spec, then re-run extraction to confirm the tier numbers move.
Trigger: Task completed  Confidence: 0.80  Source: auto-capture

### [2026-08-26] Task completed — spec fix verified: tier inflation 10→0, score 15/25→23/25
Sharpened the STATIC vs INFERRED cut-line in source-inventory-spec.md (element PRESENT → STATIC; its DECISION/OUTCOME/VALUES → INFERRED, or OBSERVED if tested; "when unsure, lower-confidence"). Re-ran a FRESH blind extraction (blind of both the answer key AND the prior scorecard) → re-scored: tier matches 15/25→23/25, STATIC over-claims 10→0, recall stayed 100%, traps + B25 gap still correct, verifier 66/66 PROV resolved. The 2 remaining mismatches are benign UNDER-claims (STATIC facts marked INFERRED — the safe direction). Confirms the validation loop can drive AND verify a real skill/spec improvement, not just flag one. Method note: use a fresh subagent for the re-extraction so it can't teach-to-the-test from the prior scorecard.
Trigger: Task completed  Confidence: 0.80  Source: auto-capture

### [2026-08-26] Architecture decision — LLM scoring runs via a session SUBAGENT + rubric, NOT an API-calling script
Dropped the planned API-calling score-inventory.cjs (which mirrored runner.js's raw-HTTPS + ANTHROPIC_API_KEY pattern). Reason: the migration validation runs INTERACTIVELY inside Claude Code, where an LLM is already in the loop — the natural judge is a scoring subagent (Agent tool), so a standalone script re-calling the API is redundant (separate key, out-of-session token spend, divergent second model path). Corrected split: deterministic axis = verify-inventory-trace.cjs (script, CI-runnable, no LLM); LLM-judged axes (recall/tier/verbatim/gap) = a versioned RUBRIC .md the session hands to a scoring subagent, run N times for a distribution. The raw-API pattern (runner.js) is only justified for a HEADLESS CI lane with no session (the Approach-4 migration.yaml extension) — not for interactive scoring. General rule: don't write an API-calling script for LLM work that a subagent in the live session can do.
Trigger: Architecture decision  Confidence: 0.80  Source: auto-capture

### [2026-08-26] Task completed — Increment 2 (dotnet-fw) confirms stack-agnosticism; Increment-1 fix generalized
Ran the full loop on a .NET Framework 4.8 Web API fixture (19 behaviors, blind-authored): verifier 52/52 PROV resolve (C# source, unchanged verifier = stack-agnostic confirmed), recall 100%, both traps caught, gap-flag + verbatim pass, and CRITICALLY the STATIC-over-claim tier inflation from stack #1 did NOT recur (14/19 strict, 0 over-claims, 5 conservative UNDER-claims). Surfaced one benign spec nuance: the cut-line ("outcome → INFERRED") is slightly too aggressive for DECLARATIVE/framework-guaranteed outcomes (e.g. `[Authorize]` present → 401 for unauth is mechanically guaranteed by the attribute, arguably STATIC, no branch read) — the two blind authors disagreed on 5 such items. Errs conservative (safe). Candidate refinement: distinguish declarative/attribute-guaranteed outcome (STATIC) from imperative-branch outcome (INFERRED). Pending user decision.
Trigger: Task completed  Confidence: 0.75  Source: auto-capture

### [2026-08-26] Architecture decision — declarative-STATIC exception + web-grounded, self-learning framework-fact cache
Refined the STATIC/INFERRED cut-line: a DECLARATIVE, framework-GUARANTEED outcome is STATIC (e.g. [Authorize]→401 unauth), but only if the attribute is NOT defined in the source tree ("defined-in-source ⇒ INFERRED" — the local guard that closes the custom-attribute caveat; web search cannot answer this — it's a fact about THIS repo). Resolution ladder for a framework attribute's guaranteed outcome: (1) defined-in-source→INFERRED; (2) framework→confirm VERSION-specific behavior via the stack's list, else WebSearch OFFICIAL docs and cite the URL; (3) unresolved→INFERRED. Self-learning: grounded facts are auto-appended to a FENCED managed block (<!-- LEARNED:BEGIN/END -->) in stacks/{stack}.md (user chose plugin-global auto-write). GUARDRAILS (non-negotiable, or the cache launders hallucinations): entry MUST carry attribute·framework@version·outcome·official-doc URL·date·trust=learned; no URL ⇒ not persisted; append-only; dedup by attribute@version; orchestrator-owned (not per-cluster agents); lower-trust-until-promoted; the OFFLINE verifier never triggers a lookup. Durability caveat: stacks/*.md live in the install/cache dir (overwritten on upgrade) — the fenced managed block must be preserved by setup-sync/dream-sync to survive; reliable only in the plugin SOURCE repo otherwise.
Trigger: Architecture decision  Confidence: 0.80  Source: auto-capture

### [2026-08-26] Architecture decision — SUPERSEDE: framework-fact self-learning goes via memory → /dream promotion, NOT inline auto-write
Refines the prior turn: instead of the migration run auto-writing grounded framework facts directly into stacks/*.md, Stage 0.6 writes a provenance-carrying MEMORY entry (tagged, e.g. "Framework-fact", with attribute·framework@version·outcome·official-doc URL·date), and the /dream consolidation run detects those entries and PROPOSES promotion into the stacks/{stack}.md LEARNED block under its normal tiered-approval + promotion-cap flow. Why better: reuses the plugin's sanctioned auto-capture→dream→promote pipeline, so /dream is the review gate (a bad web-grounded fact is caught at review, never entrenched); memory/ is durable (repo-root, committed) unlike the install-cache stacks files; no silent mid-run mutation of shared reference files. In-run memoization still avoids re-searching within one run. Implementation touchpoints: SKILL Stage 0.6 (write memory entry on web-ground), /dream (recognize Framework-fact entries → propose stacks promotion), stacks/{stack}.md (fenced LEARNED block as promotion target), setup-sync (preserve the block across upgrades).
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

### [2026-08-26] Error resolved — setup-sync CANNOT preserve the stacks LEARNED block; /dream re-promotion is the durability mechanism
Correction to the prior entry: setup-sync/dream-sync provision the TARGET project's .claude/, NOT the plugin's own reference files (skills/migration/references/stacks/*.md) — so they cannot "preserve" a LEARNED block that lives inside a plugin reference file (a plugin upgrade replaces that file wholesale). Correct design: /dream DEMOTES each promoted Framework-fact to memory/topic-framework-facts.md (the DURABLE source of truth) as well as writing the stacks LEARNED block (a rebuildable PROJECTION). After an upgrade wipes the block, the next /dream re-promotes any topic-framework-facts.md fact missing from the fresh block. So durability = topic file + re-promotion, NOT setup-sync. Implemented as STACK-PROMOTE (Tier 2) in commands/dream.md; marker comment in stacks/dotnet.md corrected from "preserved by setup-sync" to "rebuilt from memory/topic-framework-facts.md after upgrades".
Trigger: Error resolved  Confidence: 0.80  Source: auto-capture

### [2026-08-26] Task completed — Increment 3 (Angular) cleanest run; refined cut-line validated across 3 stacks
Ran the loop on an Angular 17+ fixture (24 behaviors, canActivate guard + reactive-form Validators + env-flag ambiguity + traps). Verifier 53/53 PROV resolve; recall 100%; 0 hallucinations; both traps caught; gap + verbatim pass; tier 24/24 with 0 over-claims. Critically the declarative-contract refinement (made in response to Increment 2) worked on a structurally very different frontend stack: framework CONTRACTS (Validators.required→INVALID{required:true}; canActivate false→cancel / UrlTree→redirect) tiered STATIC, while the guard/validator's own DECISION logic stayed INFERRED — "finest-grained application of the cut-line seen so far." Net: tooling + refined cut-line are stack-agnostic across Node/Express, .NET Framework, Angular (tier over-claims: Node 10→0 after spec fix, dotnet-fw 0, Angular 0). Extraction dogfooded the seeded stacks/angular.md curated table. Validation harness thesis fully proven.
Trigger: Task completed  Confidence: 0.85  Source: auto-capture
