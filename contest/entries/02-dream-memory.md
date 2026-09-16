# Entry 2 — Dream (Project Memory)

> The one where the AI learns to sleep on it, and wakes up remembering only the things worth keeping.
> Category: Creativity + Practical value · Status: READY
> Numbers pulled from `../measured-claims.md` §4 and labeled honestly; demo in `../demo-scripts.md` §Entry 2.

---

## 1. The pitch, in one breath

Your AI forgets everything the moment a session ends: every decision, every hard-won fix, every
"never do that again." Dream fixes that the way *people* fix it: it sleeps on the day's work,
consolidates what mattered, and lets the rest fade. What survives is memory you can actually trust.

## 2. Why it exists

"AI forgets between sessions" is the shallow version of the problem. The real one has two ends.

The first is amnesia: you and the AI solve something clever on Tuesday, and by Thursday it's gone.
You explain the same constraint for the third time.

The second is worse, and it's the one everybody trips on: the obvious fix, *"just save everything to
a memory file"*, rots. Within weeks it's a swamp of stale facts, quiet contradictions, and lines
nobody trusts. And a memory you can't trust is worse than no memory at all, because it doesn't just
fail to help; it confidently misleads.

So the whole design is one careful balancing act: cure the forgetting *without* growing the swamp.

## 3. What actually works today

You run `/dream` every handful of sessions. It reads your *actual* Claude Code history (not a file
you dutifully maintained, the real sessions) and pulls out the things worth keeping: decisions made,
bugs rooted out, approaches abandoned, conventions confirmed. It scores each one, and then it
*proposes* changes (add this, update that, retire this stale thing), each with its reasoning and its
evidence attached.

Then there's `/dream-health` (a little dashboard with a confidence distribution and a decay curve),
`/dream-rollback` (undo any run), and `/dream-audit` (a quarterly conscience-check that feeds its own
findings back into the scores).

## 4. Who does what (the AI, the rules, and you)

- **The AI** reads the sessions, scores what it finds, and drafts proposals with evidence. It's a
  librarian, not an author.
- **The rules** (the confidence math and the three approval tiers) decide what's safe to auto-file
  versus what needs your eyes. That part isn't up for the model's interpretation.
- **You** approve anything with real consequences, and *everything* that gets promoted into the
  top-level memory the AI reads at the start of every session. It reads your sessions and its own
  memory files; it never touches your source code.

## 5. How a memory forms

1. `/dream` reads recent sessions and shows you a scored inventory of candidates.
2. It proposes tiered changes. Tidy-ups apply themselves; real edits show you a diff; **promotions to
   top-level memory always stop for you, one at a time.**
3. It writes an append-only log of everything it did, so if a run ever goes sideways,
   `/dream-rollback` walks it straight back.

## 6. What it's worth (told straight, labeled straight)

The value you can verify today is that this memory is **reversible, audited, and cited**: every run
is logged and undoable, a quarterly audit keeps it honest, and nothing gets promoted without a
citation to where it was learned. That's **measured** in the sense that matters: the machinery exists,
the audit trail exists, go look (`../measured-claims.md` §4).

The lovely part is that it's **self-cleaning by design**: confirm a fact and it strengthens, ignore it
and it decays a little each cycle, contradict it and it's demoted on the spot. You don't prune the
swamp; physics does. *(measured: the scoring contract is real.)*

What I *won't* claim is that it makes your team faster or onboards people quicker. It should. But I
haven't measured it over enough time to say so honestly, so that's **not-yet-evaluated**.

## 7. Why it sticks with you

Because of the metaphor, and because the metaphor is *true*. It's called Dream because it works like
memory during sleep: the day's experiences get consolidated, the important ones reinforced, the noise
allowed to fade. Watch the decay curve in `health.html` and you can literally *see* the forgetting
happen on purpose. That's a rare thing: a feature that's poetic and honest at the same time.

## 8. The responsible-AI part

- It never writes anything that matters on its own; promotions to top-level memory are always yours,
  one at a time.
- Every run is reversible and audited; every promoted fact carries a citation. No assertions from
  nowhere.
- **Where your data goes:** it reads your Claude Code sessions and local memory files only, never
  your application source; nothing leaves the environment except the calls you initiate.
- **Runs on Claude Code:** this is a Claude Code plugin; its skills, hooks, and slash commands are
  Claude-Code-native (Dream in particular reads Claude Code's own session history), so it won't run
  as-is on GitHub Copilot, Cursor, or any other agent. The *idea* here ports to other tools; this
  *implementation* doesn't.
- **The honest caveat:** the scoring is a smart heuristic, not ground truth, and two people running
  `/dream` at once is guarded against but not merged. It's a memory, not an oracle.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 2 (2 minutes). The shape: run `/dream` → watch it surface
scored proposals with reasons → approve one, decline another (that's the human tier, live) → run
`/dream-health` and open the decay curve → mention that any run is one `/dream-rollback` away from
undone. **Backup:** a pre-generated `health.html` and a saved proposals screen.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 4.** Trustworthy long-term memory is real value; the productivity payoff I've
  labeled not-yet-evaluated rather than oversell.
- **Working solution & use of AI — 5.** AI proposes, rules tier, human approves — visibly separate.
- **Resourcefulness — 4.** It mines memory from sessions that already exist; no new data collection.
- **Creativity & fun — 5.** The sleep-and-consolidate metaphor, made literal in a decay curve.
- **Clear story & readiness — 5.** Nine answers, a tight demo, a backup.
- **Responsible AI — 5.** Reversible, audited, cited, human-gated, and it never reads your code.

Nothing below a 4 → **READY.**
