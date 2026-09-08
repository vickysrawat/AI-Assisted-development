# Plan — Upgrade Skill (in-place version upgrade, tool-orchestrated)

# Status - In design (design complete; not yet implemented)

> Run this in the **plugin repository** (ai-assisted-development). Paths are relative to the plugin root.
> Part of the three-skill family — see [README.md](README.md). Sibling skills: Rewrite, Replatform.
> Origin: redesign discussion — an in-place upgrade cannot safely reuse the out-of-place `migration`
> engine, and an LLM must NOT hand-author the bulk transform of working code.

---

## Context

An **in-place version upgrade** (same tech stack, current → higher supported version — e.g. .NET 6→8,
Angular 15→17, Java 8→21, Node 18→22) is the archetype with the **worst LLM value-to-risk ratio** if
approached generatively:

1. **In-place mutation, no external oracle.** You are editing a *working* app in its own folder. An LLM
   regenerating working code introduces churn and silent behavioral drift into something already correct.
2. **Deterministic tools already own this space and are safer.** `dotnet upgrade-assistant`, `ng update`,
   OpenRewrite, `pyupgrade` — mechanical, reproducible, reversible. An LLM competing with them offers
   *less determinism at higher risk*.
3. **The "false-upgrade" trap.** Half of what people call "upgrades" are actually out-of-place rewrites
   (Framework→Core, AngularJS→Angular, Py2→3, WebForms→Blazor) — no in-place path exists.

**Resolution:** the Upgrade skill makes the LLM an **orchestrator**, not an author — it detects the stack,
does grounded gap/risk analysis, drives the correct deterministic tool, remediates only the residual
(gated), and verifies against a pre-upgrade baseline. Its **headline deliverable is a decision-grade
Gap + Risk report**, not the code change.

**Intended outcome:** a developer gets a clear, grounded picture of *what is possible, what is blocked,
what is manual, and what to do next* — and, if they proceed, a tool-driven upgrade executed on an
isolated branch with a bisectable history and a behavioral safety net.

---

## Guiding principle to encode

> **The LLM coordinates; the deterministic tool transforms.** In an in-place upgrade the model never
> hand-authors the bulk change to working code — it selects and drives the stack-native tool, grounds its
> gap/risk analysis in authoritative sources, and remediates only the residual the tool cannot handle,
> each fix gated and verified against the pre-upgrade baseline commit. The primary product is the
> **decision-grade report**; the code change is secondary and always reversible.

---

## Skill shape

- **Locality:** in-place (edits the source repo itself).
- **Oracle:** the project's own **pre-upgrade baseline commit/tag** — cheaper and stronger than Rewrite's.
- **Headline deliverable:** the **Gap + Risk report**. The skill delivers value even if the developer
  never proceeds to execution.

### Stage flow
```
Detect stack + current version
  → Classify  (reject false-upgrades → route to Rewrite skill)
  → Plan version path  (multi-hop; e.g. Java 8→11→17→21; Angular one major at a time)
  → Web-grounded Gap + Risk analysis  (cached, source-verified)
  → Decision-grade REPORT            ← primary deliverable; value even if it stops here
  → [if proceed] baseline TAG + working BRANCH
  → Run stack tool per hop           (one COMMIT per hop → bisectable)
  → LLM residual remediation         (each fix behind the Write Gate)
  → Verify vs baseline oracle        (tests + optional golden-master vs pre-upgrade build)
  → Post-upgrade recommendations     (ladder → Rewrite / Replatform)
```

---

## Workstreams (executable)

### A. Intake & classification (the highest-risk component)
- Detect stack + current version via the shared **detection** substrate (`migration-source-detect.cjs`).
- **Reject false-upgrades** — any source→target crossing a runtime boundary (`dotnet_framework→dotnet`,
  `angularjs→angular`, `python2→3`, `webforms→blazor`) STOPS with a clear message and routes to the
  **Rewrite** skill. Misrouting corrupts a working app, so this guard is falsifiable and tested.
- Confirm the requested **target version** with the developer; refuse targets below current.

### B. Version-path planning (multi-hop)
- Most large jumps cannot be one shot — sequence the hops (LTS-to-LTS, one Angular major at a time).
- Emit the planned hop sequence into the report before any execution.

### C. Gap + Risk analysis (the value driver)
- **Web-search grounding required** — breaking-change/deprecation data is version-specific and
  post-training; it cannot come from model memory.
- **Source verification (LLM-as-judge on sources):** a claim is `VERIFIED` only when traced to an
  **authoritative** source (official migration guide / release notes / deprecation list); otherwise
  `INFERRED`. Reuses the confidence-tier discipline from the inventory spec.
- **Caching — two layers, different volatility** (lives in the shared substrate, not inside Upgrade):
  - **Stable delta-KB:** breaking-change facts for `{stack, from_version, to_version}` are *immutable
    once the version ships* → cache-once, reuse-forever, negligible staleness. Consumed by Rewrite and
    Replatform too.
  - **Volatile tooling layer:** "what the tool can handle today" → shorter TTL.
- **Report contents** (reuses the existing **feasibility spine**, GREEN/YELLOW/RED/BLOCKER):
  - per-item classification + resolution options;
  - dependency ledger — a package with no version supporting the target = hard **BLOCKER**;
  - what's possible / blocked / manual;
  - **post-upgrade next steps** (the ladder to Rewrite / Replatform).
- **Graceful degradation:** even a RED verdict yields value (the developer learns *why* + options),
  unlike a generative skill that just fails at a blocker.

### D. Safe execution
- **Branch + baseline tag:** the branch isolates work; the **tag is the oracle anchor** ("prove behaviour
  matches this exact pre-upgrade commit").
- **One commit per version hop:** multi-hop upgrades stay bisectable — pin the exact hop that broke a test.
- **Residual remediation** is where in-place danger re-enters (the tool leaves ~10–30% manual) — contain
  it with per-fix **Write Gate** + the baseline-oracle regression net. Consider a hard remediation ceiling
  (auto-stop → hand back to developer), mirroring Rewrite's goal-loop escalation.
- **No merge until verification passes** against the baseline oracle.

### E. Verification
- Run the existing test suite against the upgraded branch and diff behavior vs the baseline tag.
- Optional **golden-master** captured from the pre-upgrade build for behavior-heavy apps (reuses
  Rewrite's golden-master harness from the shared substrate).

---

## Tool coverage varies by stack — the report must say which side of the line the project is on

| Stack | Deterministic tool | Coverage | LLM residual load |
|---|---|---|---|
| .NET (Core→Core) | `dotnet upgrade-assistant` | Good | Low–Med |
| Angular | `ng update` (schematics) | Excellent | Low |
| Java | OpenRewrite (recipes) | Good (recipe-dependent) | Med |
| Python | `pyupgrade` / `ruff` | Modest (syntax, not deps) | Med–High |
| Node/npm | `npm-check-updates` | Weak (bumps versions, not code) | High |

Where the tool is strong (Angular, .NET) → thin, safe wrapper. Where weak (Node) → residual + risk grow;
the Gap/Risk report MUST state this explicitly.

---

## Reuse from shared substrate
Detection · feasibility engine (GREEN/YELLOW/RED/BLOCKER) · checkpoint + single-writer · gate keyword
grammar · Write Gate · personas · model-routing · **migration-knowledge cache** · verification harness
(baseline oracle, shared with Rewrite's golden-master).

---

## Open questions
- Exact cache format/location + invalidation policy for the volatile tooling layer.
- Whether residual remediation has a hard ceiling (auto-stop → developer) like Rewrite's goal-loop.
- Whether Upgrade emits its own checkpoint (resumable multi-hop) or runs single-shot per invocation.

---

## Verification (of the skill itself)
- Fixture repos per stack (.NET, Angular, Java, Python, Node) at a known version. Assert:
  - correct classification, **including false-upgrade rejection → route to Rewrite**;
  - correct tool selection per stack;
  - baseline tag created + **one commit per hop**;
  - a well-formed Gap/Risk report (feasibility classification, dependency ledger, post-upgrade ladder);
  - graceful **RED** handling (report produced, no code mutated).
