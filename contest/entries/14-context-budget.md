# Entry 14 — The Context Budget (spending the model's attention wisely)

> The one that obsesses over how *little* it puts in front of the model, because the scarce resource
> was never the context window, it was the model's attention.
> Category: Resourcefulness + Practical value · Status: READY (bonus)
> Numbers pulled from `../measured-claims.md` and labeled honestly; demo in `../demo-scripts.md` §Entry 14.
>
> Boundary vs Entry 4: Entry 4 is about *cost*, spending fewer tokens per task. This one is about
> *adherence*: keeping the always-on instructions small enough that the model actually follows them.
> Related, but different scarce resources: dollars vs attention.

---

## 1. The pitch, in one breath

Everyone brags about how much context their AI can hold. This plugin does the opposite: it's engineered
to keep the always-on instructions *lean*, because the real limit was never how much the model can read.
It's how much it can actually keep faithfully in mind while it works.

## 2. Why it exists

There's a comfortable myth in AI tooling: "the context window is huge now, so just stuff everything in."
And it's true that capacity is enormous: a 150-line instruction file is about 1% of a 200K window.
Capacity is a non-constraint.

But that's the wrong thing to measure. Always-on instruction text isn't reference material the model
consults; it's a set of *rules competing for the model's attention every single turn*. Past a few
hundred lines, adherence measurably degrades: the model starts quietly missing rules. So a plugin whose
whole value is its governance rails has a real problem if those rails bloat: the more you tell the model
to do, the less reliably it does any of it. This is for anyone who's watched an over-instructed AI start
ignoring its own guidelines, and wants a system designed around the limit that actually matters.

## 3. What actually works today

The core instruction file is held to a deliberate budget (about 200 lines) enforced by an audit script
and reported at setup and in the memory dashboard. It's not arbitrary: it's the line past which
adherence starts to slip. Verbose rationale, design philosophy, and model config are pushed out to
reference files that load only when relevant, leaving a one-line pointer behind.

And the same discipline runs through the whole system, not just one file. The knowledge graph is never
auto-loaded; a skill pulls in only the slice it needs. Big "hub" modules are deliberately left out of
graph expansions so a single sprawling module can't blow the budget. Memory consolidation has hard
stops when a run would get too large. Every generated detail file has a token ceiling. Readiness runs
have a lean mode that reads no source at all. It's a house style: spend the model's attention like it's
scarce, because it is.

## 4. Who does what (the AI, the guards, and you)

- **The AI** works against a preamble that's been kept high-signal on purpose, so its attention goes to
  the rules that matter, not to wading through prose.
- **The guards are deterministic:** an audit script flags an over-budget instruction file; the graph
  carries no auto-load flag; memory runs hard-stop past a size threshold; detail files are capped. None
  of it depends on the model choosing to be frugal.
- **You** get told when something drifts over budget, with a concrete "move this to a rule file"
  suggestion; the system nudges you toward adherence, it doesn't silently bloat.

## 5. How the budget holds

1. The always-on preamble (the instruction file, memory, architecture head, the graph index) is kept
   deliberately small and high-signal.
2. An audit flags the instruction file if it drifts past ~200 lines, and points at what to externalise.
3. Everything else that *could* balloon (the graph, memory, generated docs) either loads on demand,
   caps its size, or hard-stops before it can crowd out the model's attention.

## 6. What it's worth (told straight, labeled straight)

The insight is the value, and it's an honest reframe most tools get backwards: **capacity is a
non-constraint; adherence is the real limiter.** The ~200-line budget, the never-auto-loaded graph, the
hard stops in memory, the token-capped detail files, the lean readiness mode: all of it exists so the
model's working attention stays on the rules that govern it. *(measured: the audit script, the
no-auto-load graph, the memory hard-stops, and the file caps all exist;
`../measured-claims.md`.)*

What I *won't* claim is a measured adherence number: "rules followed X% more often under budget." I
believe the effect is real and it's why the whole system is built this way, but I haven't run the
controlled test, so it stays **not-yet-evaluated**.

## 7. Why it sticks with you

Because it's a genuine contrarian take, delivered with a straight face: while every other tool measures
its worth in how *much* context it can swallow, this one measures its discipline in how *little* it
needs to. It treats the model's attention the way a good editor treats a reader's: as precious, and
easy to lose. That restraint is unusual enough to be memorable, and it's the same instinct (say less,
mean more) that makes the rest of the plugin trustworthy.

## 8. The responsible-AI part

- It's built around the *real* limit (instruction adherence) rather than the flattering one (raw
  capacity), so the governance rails stay reliable instead of quietly decaying under their own weight.
- The guards are deterministic (audit script, no-auto-load graph, memory hard-stops), not the model
  promising to be tidy.
- It's transparent: when something drifts over budget, you're told, with a concrete fix.
- **Where your data goes:** it's an internal discipline over local files; nothing leaves the environment
  except the calls you initiate.
- **Runs on Claude Code:** this is a Claude Code plugin; the budget applies to Claude-Code-native
  always-on context (CLAUDE.md, memory, the graph index, rules), so it won't run as-is on GitHub
  Copilot, Cursor, or another agent. The *idea* (budget attention, not just tokens) ports to any
  agent; this *implementation* doesn't.
- **The honest caveat:** the budget is a well-reasoned target with a floor of required governance that
  can't be cut, not a proven adherence dial; the quality effect is a design conviction, not yet measured.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 14 (2 minutes). The shape: open the `dream-health` dashboard
and show its "CLAUDE.md: N lines vs ~200 budget" status line → run the audit script (`claude-md-audit.js`,
note it's *advisory-only*: it prints move-these suggestions when you're **over** budget, and stays
silent when you're lean) → show the knowledge graph is *not* auto-loaded (a skill pulls only the slice
it needs) → mention the memory hard-stops and the token-capped detail files → land the line: "capacity
was never the constraint; attention was." **Backup:** a saved `dream-health` panel showing the
line-count-vs-budget status, plus a saved audit advisory captured from a deliberately over-budget file.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 4.** Reliable rule-following is the difference between governance that works and governance that decays.
- **Working solution & use of AI — 4.** Deterministic budget guards across the whole system, not one file.
- **Resourcefulness — 5.** The purest "more with less" in the portfolio — value measured in restraint.
- **Creativity & fun — 4.** A contrarian thesis (capacity isn't the point) that's genuinely memorable.
- **Clear story & readiness — 4.** Nine answers, a demo, a backup, held on the adherence lens vs Entry 4.
- **Responsible AI — 5.** Built around the real limiter so the rails stay reliable; deterministic, transparent guards.

Nothing below a 4 → **READY.**
