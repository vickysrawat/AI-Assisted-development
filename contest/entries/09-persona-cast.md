# Entry 9 — The Persona Cast

> The one where your AI stops being a single flat voice and becomes a writers' room of thirteen
> experts, each with their own obsession, none of them allowed to bluff.
> Category: Creativity, personality & fun · Status: READY (bonus)
> Numbers pulled from `../measured-claims.md` and labeled honestly; demo in `../demo-scripts.md` §Entry 9.

---

## 1. The pitch, in one breath

A single generic "assistant" asks the same shallow questions of everything. This gives every skill a
*character* (a security engineer who wonders how to break in, an SRE who wonders what fails at 3am) so
each task gets the right obsessions brought to bear. And the twist that keeps it honest: the character
is a lens, never a license to make things up.

## 2. Why it exists

There's a real reason a security review and a runbook shouldn't be written by the same flat voice: they
need *different questions*. The generic assistant reasons evenly and shallowly across everything, and
misses what a specialist would catch.

But the obvious fix, "act as a senior engineer," has a nasty failure mode of its own. Roleplay makes
the model *bluff*, treating an invented "twenty years of experience" as if it were evidence, delivering
guesses in a confident expert voice. This is for anyone who wants sharper, role-appropriate reasoning,
*especially* the people who've been burned by persona-prompting and watched it turn into confident
fiction.

## 3. What actually works today

There's a canonical cast of thirteen (Product Owner, Tech Lead, Security Engineer, QA, Solution
Architect, Enterprise Architect, AI Architect, and more) each written as a little card: what they're
expert in, what they optimize for, what they're accountable for, and their one signature question.

Every skill is assigned its primary character. The security scan runs as Dana Ito, security engineer.
The architecture skill runs as Rafael Mendes, solution architect. The readiness assessment runs as
Grace Lin, enterprise architect. The judgment-heavy skills get the full character; the mechanical ones
get a one-line lens, because role-priming does nothing for a deterministic task.

## 4. Who does what (the AI, the spec, and you)

- **The AI** adopts the character's *judgment and priorities* while it reasons: the concerns it raises,
  the questions it asks.
- **The spec** (`personas-spec.md`) is fixed: the roster, the per-skill assignments, and the guardrails
  aren't the model's to reinvent. And a character can't upgrade the model it runs on; role and
  horsepower are separate dials.
- **You** get sharper, role-appropriate output, and you never see the character in the artifact,
  because it shapes the thinking, not the prose.

## 5. How a lens gets applied

1. A skill starts and puts on its assigned character's lens.
2. That lens decides *what to scrutinize*, but the codebase, the docs, and the spec remain the only
   things it's allowed to treat as true.
3. The output carries the right priorities and **never names the character**; and if a genuine second
   opinion is needed, that's a separate pass (the Critic, Entry 10), not two characters talking over
   each other.

## 6. What it's worth (told straight, labeled straight)

What's concretely real: a roster of thirteen roles, each assigned per skill, each with a hard
no-assume guardrail, all of it written down in one spec you can read. Role and model-tier are
orthogonal by design, and the "expertise" is always *your* actual detected stack, never a hardcoded
one. *(measured: the roster, the assignment table, and the guardrails all exist in `personas-spec.md`.)*

What I *believe* but haven't put a number on: how much the role-priming actually lifts output quality.
It should sharpen judgment where judgment matters, but that lift is **not-yet-evaluated**, so I'll
call it a design conviction, not a measured result.

## 7. Why it sticks with you

It's the signature questions that carry the idea. Read them out loud and the roster stops being
abstract: the QA engineer asking *"how do I make this fail?"*, the security engineer asking *"how would
I abuse this?"*, the enterprise architect asking *"what happens at 3am when this fails?"* A writers'
room for your codebase, with a discipline underneath ("a lens, not a costume; no 'as Marcus, I feel',
ever") that keeps it serious rather than a gimmick.

## 8. The responsible-AI part

- The core safeguard: a character changes *what to scrutinize*, never *the confidence to assume*. A
  projected twenty-year expert is still not allowed to guess; it's subordinate to the "do not assume,
  stop and ask" rule.
- It's never attributed: no "Reviewed by…" lines, no character flavor bleeding into output.
- It can't inflate the model tier; routing stays separate.
- **Where your data goes:** nothing external; this is a reasoning layer over your existing skills.
- **Runs on Claude Code:** this is a Claude Code plugin; the persona layer sits over Claude-Code-native
  skills, so it won't run as-is on GitHub Copilot, Cursor, or any other agent. The *idea* (role-lens
  priming with a no-assume guardrail) ports to other tools; this *implementation* doesn't.
- **The honest caveat:** role-priming only helps where a skill relies on judgment; mechanical skills get
  nothing from it, and the quality lift is a conviction, not yet a measurement.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 9 (2 minutes). The shape: run the same file through two
skills → watch security reason as "how would I abuse this?" and readiness reason as "what happens at
3am?" → open the roster → land on the guardrail line: "it sets what to scrutinize, never the license to
assume." **Backup:** the roster table plus two saved outputs showing the different lenses.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 4.** Sharper, role-appropriate reasoning across the whole skill set.
- **Working solution & use of AI — 4.** A real spec-driven layer; role and model tier cleanly separated.
- **Resourcefulness — 4.** One roster reused everywhere; stack-agnostic by design.
- **Creativity & fun — 5.** The cast and their signature questions — the personality peak of the portfolio.
- **Clear story & readiness — 4.** Nine answers, a demo, a backup.
- **Responsible AI — 5.** Lens-not-roleplay, never-assume subordination, never attributed in output.

Nothing below a 4 → **READY.**
