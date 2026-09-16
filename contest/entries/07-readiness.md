# Entry 7 — Production Readiness (App + Plugin)

> The one with two architects in a box: one grades your application, the other grades the AI workflow
> that built it, and neither is allowed to give you a green light it can't defend.
> Category: Practical value · Status: READY
> Numbers pulled from `../measured-claims.md` §4 and labeled honestly; demo in `../demo-scripts.md` §Entry 7.

---

## 1. The pitch, in one breath

"Is it ready for production?" almost always gets answered by a gut feeling in a meeting. This answers it
properly — a maturity score across every domain that matters, with the evidence and the reasoning
attached — and then it does something unusual: it turns the same lens on the *AI workflow itself*.

## 2. Why it exists

Readiness isn't one thing you can feel; it's a dozen: is the pipeline sane, does it survive failure,
can you see what it's doing, is it secure, will it scale, is the data safe, is there a runbook, are
there tests? Answer those on vibes and you ship blind.

And there's a second blind spot nobody looks at: the AI tooling that built the app. Its model routing,
its governance, its memory, its token budget, normally graded by no one. This exists to score both,
honestly, and (the part I care about most) to *refuse to overclaim*. A readiness tool that hands out
easy green lights is worse than useless; it's dangerous. So this one is engineered to withhold the
green when it can't back it up. It's for the leads and architects making an actual go-live call.

## 3. What actually works today

`/app-readiness` scores your app across eight enterprise-architect domains (pipeline, resilience,
observability, security, scalability, data integrity, runbook, tests), each on a 1–5 maturity scale
with red/amber/green and a plain-English reason. It runs `--quick` (no source reads at all) or `--full`
(reading source only for the red domains, only with your consent).

`/plugin-readiness` turns the same rigor on the AI workflow, across six domains (infrastructure, model
routing, memory, governance, skill quality, session budget), and it reads *plugin state only*, never a
line of your application source.

## 4. Who does what (the AI, the rubric, and you)

- **The AI** gathers the evidence, scores each domain against an explicit rubric, and writes the
  reasoning and the remediation roadmap.
- **The rubric and the thresholds** keep it honest: a failed API call becomes "❓ Unknown," never a
  guess; a domain is never scored above its evidence; security is never quietly skipped.
- **You** choose quick vs full, grant consent for any source read, and act on the roadmap. The app
  assessment talks to Azure DevOps (with your token); the plugin assessment touches only plugin state.

## 5. How an assessment runs

1. `/app-readiness --quick` → evidence sweep + pipeline state → eight domains scored → a red/amber/green
   scorecard with blockers, no source read.
2. Only in `--full`, only for red domains, does it ask **your consent** to read a specific source file.
3. `/plugin-readiness` grades the six AI domains from plugin state, and won't call the plugin "ready"
   at all unless the enforcement floor is actually installed (or you've recorded an explicit opt-out).

## 6. What it's worth (told straight, labeled straight)

What's real today is **structured, multi-domain scoring with a reason for every score**: eight app
domains, six plugin domains, an explicit scale, a verdict gated by the *critical* domains rather than a
flattering average. *(measured: the rubrics exist; `../measured-claims.md` §4.)*

And the thing I'm proudest of is the **anti-overclaim wiring**: unknowns are marked unknown, security
is never skipped, and a "ready" verdict for the plugin *requires* the mechanical floor to exist,
because a green light with no floor beneath it is exactly the lie this tool was built to prevent.
*(measured: hard rules.)* Any finding that touches regulated data is a blocker regardless of its score.

What I can't yet claim: that a green score actually predicts fewer 3am pages. That correlation is
**not-yet-evaluated**, and I won't imply it.

## 7. Why it sticks with you

The framing carries it: *two architects in a box, and one of them grades the AI that built the app.*
Underneath the framing sits a temperament. This is an assessment tool that would rather tell you "I
don't know" than hand you a comforting number, and in a field full of confident dashboards, the one
that refuses to bluff is the one you can actually act on.

## 8. The responsible-AI part

- Evidence, not vibes: every score cites what it found; anything unverifiable is "❓ Unknown."
- No overclaim: verdicts are gated by the critical domains, and the plugin can't be "ready" without its
  floor.
- Scope discipline: `--quick` reads no source; `--full` reads source only for red domains, only with
  consent; `/plugin-readiness` never reads app source at all.
- **Where your data goes:** local docs and ledgers, plus the ADO calls you authorize; nothing else
  leaves.
- **Runs on Claude Code:** this is a Claude Code plugin — its skills, hooks, and slash commands are
  Claude-Code-native, so it won't run as-is on GitHub Copilot, Cursor, or any other agent. The *idea*
  here ports to other tools; this *implementation* doesn't.
- **The honest caveat:** without an ADO token the pipeline domain is capped and flagged; the scores are
  a maturity heuristic, not a guarantee.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 7 (2 minutes). The shape: `/app-readiness --quick` → open the
scorecard, point at a red domain's reasoning → `/plugin-readiness` → the six-domain AI scorecard, and
the line: "this one reads plugin state only; it grades its own guardrails." **Backup:** pre-generated
reports in `prod-readiness/`.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 5.** A structured go-live call for both the app and the AI workflow.
- **Working solution & use of AI — 4.** Evidence and rubric constrain the score; a failed call becomes Unknown, not a guess.
- **Resourcefulness — 4.** A full eight-domain scorecard with zero source reads in quick mode.
- **Creativity & fun — 4.** "Grades its own guardrails," and refuses a green it can't justify.
- **Clear story & readiness — 4.** Nine answers, a demo, a backup.
- **Responsible AI — 5.** Anti-overclaim floor, Unknown-not-guess, consent-scoped, B-series override.

Nothing below a 4 → **READY.**
