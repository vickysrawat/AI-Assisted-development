# Entry 4 — Token-Efficiency Engine

> The one where the same review costs a fraction of what it used to, and I show you the receipt, and
> I'm careful about which number the receipt actually proves.
> Category: Resourcefulness · Status: READY
> Numbers pulled from `../measured-claims.md` and labeled honestly; demo in `../demo-scripts.md` §Entry 4.
>
> Companion to Entry 3: that entry is the graph as a *thing you build*; this one is the graph as the
> *engine that saves you money*. One artifact, two stories, which is itself the point.

---

## 1. The pitch, in one breath

AI dev tools quietly re-read your entire codebase every time you ask them anything. This one is built
to *reuse* what it already understands instead of re-learning it from scratch (chiefly by reading a
knowledge graph instead of re-scanning source), and then it measures exactly how much that saved.

## 2. Why it exists

Here's the maddening bit about most AI tooling: the cost doesn't scale with your *work*, it scales
with your *repo*. Change one line in a five-hundred-file project and a naive tool re-reads five hundred
files to review it. You're paying to re-learn things the model understood perfectly well yesterday.

And it doesn't just cost money; it costs the *habit*. When every review is expensive, people run
fewer of them, and "we stopped running the review" is how quality quietly rots. So this is for the
teams who run AI generation, review, and explanation often enough that the waste actually hurts, and
who'd like their cost to track what *changed*, not how big the repo happens to be.

## 3. What actually works today

The real engine is the **knowledge graph**. Instead of re-reading source to understand structure, a
whole family of skills (generating code, fixing bugs, reviewing, explaining, migrating) orient
themselves by reading the graph. Learn the shape of the codebase once; reuse that understanding
everywhere.

Alongside it, `/token-analysis` keeps a running tally of what you're spending and where, processing
only the new sessions each time it runs. (There's also a narrower file-cache that lets `code-review`
and `security` skip unchanged files, but it's a supporting act here, not the headline.)

## 4. Who does what (the AI, the scripts, and you)

- **The AI** does the actual work (generating, reviewing, explaining) but oriented by the graph
  rather than by a full re-scan.
- **The scripts** are where the savings actually live: the graph's edges are extracted by a parser
  (ADR 0041), the sync is fingerprint-driven, the token accounting is script-kept. Run it twice on the
  same state and you get the same savings; it's engineering, not luck.
- **You** pick the scope and decide which recommendations to act on. Nothing auto-applies.

## 5. How the savings happen

1. A skill (say `explain` or `code-review`) orients from `graph.json`; no re-reading every file.
2. You edit something; `/graph-sync` regenerates only the module that changed, so the next task's
   orientation stays cheap.
3. `/token-analysis` shows you the cost and where it went, and you decide what to tune.

## 6. What it's worth (and exactly what the number proves)

Here's the headline, measured over this project's *own* development (34 sessions, ~30 days, 13,328
turns): **96.9% of input-side tokens came from cache, and 97.6% of turns had a cache hit.** In plain
terms, the workflow paid roughly a tenth of what a cache-blind one would on input. That's real, and
it's a legitimate resourcefulness story. *(measured: `../measured-claims.md` §2.)*

Now the part I refuse to fudge, because it's where most demos cheat: **that 96.9% is Claude Code's
built-in prompt cache**; it proves the workflow reuses context, and *that's all it proves.* It is
**not** proof that the graph-orientation saves what I think it does, and it's not the file-cache's
"60–95%" number either. Those are different mechanisms, and I've labeled them **estimated** until
someone runs the benchmark. I will not let the strong number vouch for the ones I can't back yet.

## 7. Why it sticks with you

Because it measured *itself*. Most efficiency claims are hand-wavy; this one turned its own 30 days of
development into evidence and put the receipt on the table, a single, memorable line: *96.9% from
cache.* And then, unusually, it drew a bright line around exactly what that receipt does and doesn't
say. Honesty is disarming in a demo.

## 8. The responsible-AI part

- No overclaiming, on purpose: the strong number is labeled prompt-cache; the mechanism savings stay
  estimated until benchmarked. The two are never blurred.
- No hallucinated structure; the graph the savings ride on is script-built (ADR 0041).
- **Where your data goes:** it works on your local repo and sessions; nothing leaves except the calls
  you initiate.
- **Runs on Claude Code:** this is a Claude Code plugin, and the headline 96.9% is *Claude Code's*
  prompt cache specifically; skills, hooks, and slash commands are Claude-Code-native, so it won't
  run as-is on GitHub Copilot, Cursor, or any other agent. The *idea* ports; this *implementation*
  doesn't.
- **The honest caveat:** 96.9% is *this* project's own dev, not a universal benchmark; your mileage
  varies with repo size, change frequency, and how warm the cache is.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 4 (2 minutes). The shape: `/explain` answers from the graph
without re-scanning source → hover a node ("script-extracted, no hallucinated deps") → edit a file →
`/graph-sync` regenerates just that module → `/token-analysis` shows the cost → deliver the 96.9% /
97.6% line, then immediately label the graph savings as estimated. Open on the number. **Backup:** a
pre-rendered `graph.html` and a saved `/token-analysis` report.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 5.** A direct cost problem, answered with a hard measured number.
- **Working solution & use of AI — 4.** Savings clearly attributed to scripts vs cache vs model.
- **Resourcefulness — 5.** One graph, many consumers; proven on its own logs — the flagship for this criterion.
- **Creativity & fun — 4.** Self-measurement is a neat trick, and the number is memorable.
- **Clear story & readiness — 5.** Nine answers, a tight demo, a backup.
- **Responsible AI — 5.** Ruthless label discipline; the measured number never vouches for the estimated ones.

Nothing below a 4 → **READY.**
