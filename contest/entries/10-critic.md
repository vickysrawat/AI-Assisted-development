# Entry 10 — The Critic

> The one where a second AI reads the first one's work, says "no, do it again," and quietly makes it
> redo the job (twice if it has to) before you ever see it.
> Category: Creativity + Working solution · Status: READY (bonus)
> Numbers pulled from `../measured-claims.md` and labeled honestly; demo in `../demo-scripts.md` §Entry 10.

---

## 1. The pitch, in one breath

An AI is a terrible judge of its own work in the moment it's producing it. So this bolts on a second AI
whose entire job is to distrust the first: to read the freshly generated spec or code *before it's
written to disk*, argue with it, and send it back to be redone if it isn't good enough. You only see
what survived the argument.

## 2. Why it exists

The plugin already checks the *plan* (you approve the spec) and the *committed diff* (the pre-commit
review). But there's a gap right in the middle (the exact moment the AI *generates* the spec or the
code) that nobody was watching. Catch a flaw earlier and there's nothing to look at yet; catch it later
and it's already on disk, or already committed, and the intent it was supposed to satisfy has scrolled
out of memory.

That middle moment is the one place where the artifact *and* the spec it's meant to fulfill are both
still in view: the only place you can check "does this actually match what we asked for" before the
answer becomes rework. This is for anyone using AI to generate specs or code who'd rather catch the
mismatch at birth than after they've built on top of it.

## 3. What actually works today

It's a generator-critic pattern. One pass writes; a separate pass tears it apart, asking the questions a
careful reviewer would; and because the spec and the output are in context together, it can judge
*intent alignment* in a way no later source-scan can.

It runs in three modes (critiquing a spec, a technical design, or generated code) each against its
own checklist. It fires automatically at three points in the workflow, and you can also summon it
yourself. And it's deliberately weightless: it keeps no ledger, assigns no fingerprints, applies no
fixes. Its only output is a verdict and a list of specific, concrete concerns.

## 4. Who does what (the AI, the loop, and you)

- **The AI** plays the reviewer (a Tech Lead's eye on a spec, a Senior Engineer's eye on code),
  producing a verdict and concerns, each one tied to a specific line, criterion, or file.
- **The loop** is fixed control flow, not the model's mood: at most two automatic retries, each
  announced, with a guard that bails early if it's clearly not making progress; and an ironclad rule
  that nothing is written while the verdict is "revise."
- **You** are the backstop: if it's still unhappy after two tries, it stops and hands you the call:
  accept as-is, guide it, or halt.

## 5. How a critique plays out

1. The generator produces the artifact, in context, unwritten.
2. The critic judges it: pass, and it's written; revise, and it goes back.
3. On a revise, a **bounded loop**: "🔁 revision 1 of 2," regenerate against the concerns, re-judge,
   at most twice, and **nothing hits disk while it's still failing.**
4. Still not clean after two tries? It surfaces to **you**: accept, guide, or halt.

## 6. What it's worth (told straight, labeled straight)

The real value is *timing*: because the spec and the output are both in context, it catches
intent-misalignment at the moment of creation, something a later review, working from source alone,
simply can't do. And it's **self-correcting before disk**: a "revise" regenerates the work rather than
patching bad code after the fact. Its highest-value catch is the sneaky one: a *silent assumption*,
where the AI quietly picked a default the spec never mentioned. *(measured: it fires at three gates,
and "nothing written while revising" is a hard rule; `skills/critic/SKILL.md`.)*

What I won't manufacture: a defect-catch rate or an hours-of-rework-saved figure. I believe it earns
its keep, but I haven't measured it, so that's **not-yet-evaluated**.

## 7. Why it sticks with you

An AI that *vetoes its own team's work and quietly redoes it* runs against the grain of what these tools
usually do: most are built to please, this one is built to distrust the last pass. And its concerns
aren't mush. Never "this could be cleaner," always "this interface has one implementer, use a direct
method." Specific enough to act on, which is what makes the skepticism feel earned rather than
performative.

## 8. The responsible-AI part

- Bounded autonomy: two automatic tries, each announced, a diminishing-returns guard, then *you* decide.
  It fixes itself on a short leash, never a runaway one.
- Nothing is written while the verdict is "revise": no draft, no source, until it passes or you
  explicitly accept it as-is.
- Never vague: every concern names a specific section, criterion, or file, so it's auditable.
- **Where your data goes:** almost every path reads only what's already in context, never source; the
  one exception (critiquing already-written code on request) announces its scope first.
- **Runs on Claude Code:** this is a Claude Code plugin; the critic fires from Claude-Code-native
  skill gates, so it won't run as-is on GitHub Copilot, Cursor, or any other agent. The *idea*
  (a generator-critic pass before disk) ports to other tools; this *implementation* doesn't.
- **The honest caveat:** it's a sharp reviewer, not a proof; and after two tries it *deliberately*
  hands the judgment back to you rather than grinding forever.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 10 (2 minutes). The shape: generate code that quietly
over-engineers → the critic returns "revise" with a concrete concern → "🔁 revision 1 of 2" regenerates
it simpler → pass, *then* it writes → point out that nothing touched disk until it cleared. **Backup:**
a saved revise-then-pass transcript.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 4.** Catches spec and code flaws at the moment of creation, before rework.
- **Working solution & use of AI — 5.** A real generator-critic loop with bounded self-correction and a human backstop.
- **Resourcefulness — 5.** Weightless on purpose — no ledger, no fingerprints, no fixes; one job, one moment.
- **Creativity & fun — 5.** "The AI that argues with the AI" and rewrites itself before you see it.
- **Clear story & readiness — 4.** Nine answers, a demo, a backup.
- **Responsible AI — 5.** Bounded autonomy, nothing-written-while-revising, concrete-only, human backstop.

Nothing below a 4 → **READY.**
